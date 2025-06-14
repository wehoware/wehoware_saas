import { NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { withAuth } from '../../utils/auth-middleware';

// Create a new inquiry (for contact form) - Public Endpoint
export async function POST(request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
          set(name, value, options) { try { cookieStore.set({ name, value, ...options }); } catch (error) {} },
          remove(name, options) { try { cookieStore.set({ name, value: '', ...options }); } catch (error) {} },
        },
      }
    );

    const body = await request.json();
    const { name, email, phone, subject, message, client_id } = body;

    // Validate required fields
    if (!name || !email || !subject || !message || !client_id) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, subject, message, or client_id" },
        { status: 400 }
      );
    }
    
    // Insert the inquiry
    const { data, error } = await supabase
      .from("wehoware_inquiries")
      .insert({
        name,
        email,
        phone,
        subject,
        message,
        client_id: client_id,
        status: "New",
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown"
      })
      .select();

    if (error) {
      console.error("Error creating inquiry:", error);
      if (error.code === '23503') { 
           return NextResponse.json({ error: "Invalid client_id provided." }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Failed to create inquiry" },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0], { status: 201 });
  } catch (error) {
    console.error("Unexpected error creating inquiry:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Get inquiries with filtering and pagination
export const GET = withAuth(async (request) => {
  try {
    const { supabase } = request; // Use the Supabase client from middleware

    // Get query parameters
    const url = new URL(request.url);
    const filterClientIdParam = url.searchParams.get("client_id"); 
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const sortBy = url.searchParams.get("sort_by") || "created_at";
    const sortOrder = url.searchParams.get("sort_order") || "desc";
    
    const offset = (page - 1) * limit;

    // Determine the client ID to filter by based on user role and context
    let queryClientId = null;
    if (request.user.role === 'client') {
        queryClientId = request.user.clientId;
        // Optional: If client provides client_id param, ensure it matches their own
        if (filterClientIdParam && String(filterClientIdParam) !== String(queryClientId)) {
            return NextResponse.json({ error: "Clients can only filter by their own client ID." }, { status: 403 });
        }
    } else if (['employee', 'admin'].includes(request.user.role)) {
        // Use explicit filter param if provided AND it matches active context (or if no active context, allow param?)
        // Let's prioritize active context for security.
        if (request.user.activeClientId) {
            queryClientId = request.user.activeClientId;
            // If admin/employee *also* provides a client_id param, ensure it matches their active context
            if (filterClientIdParam && String(filterClientIdParam) !== String(queryClientId)) {
                 return NextResponse.json({ error: "Employees/Admins can only view inquiries for their active client context." }, { status: 403 });
            }
        } else if (filterClientIdParam) {
            // Allow admin/employee without active context to filter if they provide the param?
            // Or enforce active context? Let's enforce active context for now.
            return NextResponse.json({ error: "Active client context required for employees/admins." }, { status: 400 });
        } else {
            // No active context and no filter param - cannot proceed
            return NextResponse.json({ error: "Active client context or client_id filter required for employees/admins." }, { status: 400 });
        }
    }

    if (!queryClientId) {
        // Should not happen if logic above is correct, but as a safeguard
         return NextResponse.json({ error: "Could not determine client context for filtering inquiries." }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from("wehoware_inquiries")
      .select("*", { count: 'exact' }) 
      .eq('client_id', queryClientId) 
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    // Apply optional status filter
    if (status) {
      query = query.eq("status", status);
    }

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching inquiries:", error);
      return NextResponse.json(
        { error: "Failed to fetch inquiries" },
        { status: 500 }
      );
    }
    
    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    return NextResponse.json({
      data,
      pagination: {
        totalItems: totalItems,
        page,
        limit,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error("Unexpected error fetching inquiries:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}, { allowedRoles: ['client', 'employee', 'admin'] }); 

// Update an inquiry (e.g., change status)
export const PUT = withAuth(async (request) => {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const body = await request.json();
    // Expecting ID in the body for PUT
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "Missing required fields: id and status" },
        { status: 400 }
      );
    }

    // 1. Fetch the existing inquiry to check ownership
    const { data: existingInquiry, error: fetchError } = await supabase
      .from('wehoware_inquiries')
      .select('id, client_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingInquiry) {
        if (fetchError?.code === 'PGRST116') { // Not found
             return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
        }
        console.error("Error fetching inquiry for update:", fetchError);
        return NextResponse.json({ error: "Failed to fetch inquiry for update." }, { status: 500 });
    }

    const inquiryClientId = existingInquiry.client_id;

    // 2. Authorization check based on role and client context
    let authorized = false;
    if (['employee', 'admin'].includes(request.user.role)) {
        if (request.user.activeClientId && String(request.user.activeClientId) === String(inquiryClientId)) {
            authorized = true;
        }
    }
    // Add other roles/conditions if needed, e.g., if a client could update specific fields

    if (!authorized) {
        return NextResponse.json({ error: "Unauthorized to update this inquiry." }, { status: 403 });
    }

    // 3. Update the inquiry, ensuring we filter by id AND client_id
    const { data, error } = await supabase
      .from("wehoware_inquiries")
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('client_id', inquiryClientId) // Ensure we only update the record for the correct client
      .select()
      .single();

    if (error) {
      console.error("Error updating inquiry:", error);
      return NextResponse.json(
        { error: "Failed to update inquiry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error updating inquiry:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}, { allowedRoles: ['employee', 'admin'] }); // Only employees/admins can update status

// Delete an inquiry
export const DELETE = withAuth(async (request) => {
  try {
    const supabase = createRouteHandlerClient({ cookies }); 
    // Get ID from query parameters for DELETE
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing inquiry ID in query parameters" },
        { status: 400 }
      );
    }

    // Middleware already confirmed user is admin (due to allowedRoles)
    // Now, check if admin has active client context
    if (!request.user.activeClientId) {
        return NextResponse.json({ error: "Admin must have an active client context set to delete an inquiry." }, { status: 400 });
    }

    const adminActiveClientId = request.user.activeClientId;

    // 1. Fetch the existing inquiry to check ownership
    const { data: existingInquiry, error: fetchError } = await supabase
      .from('wehoware_inquiries')
      .select('id, client_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingInquiry) {
        if (fetchError?.code === 'PGRST116') { // Not found
             return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
        }
        console.error("Error fetching inquiry for delete:", fetchError);
        return NextResponse.json({ error: "Failed to fetch inquiry for delete." }, { status: 500 });
    }

    // 2. Verify inquiry belongs to the admin's active client context
    if (String(existingInquiry.client_id) !== String(adminActiveClientId)) {
        return NextResponse.json({ error: "Unauthorized: Inquiry does not belong to the admin's active client context." }, { status: 403 });
    }

    // 3. Delete the inquiry, filtering by id AND client_id
    const { error, count } = await supabase
      .from("wehoware_inquiries")
      .delete()
      .eq("id", id)
      .eq("client_id", adminActiveClientId); // Ensure delete targets the correct client's inquiry

    if (error) {
      console.error("Error deleting inquiry:", error);
      return NextResponse.json(
        { error: "Failed to delete inquiry" },
        { status: 500 }
      );
    }

    // 4. Check if delete actually happened
    if (count === 0) {
        console.warn(`Delete operation for inquiry ${id} affected 0 rows unexpectedly.`);
        return NextResponse.json({ error: 'Inquiry not found or delete failed unexpectedly.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error deleting inquiry:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}, { allowedRoles: ['admin'] }); // Only Admin can delete
