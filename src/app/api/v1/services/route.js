import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use per-request client
import { cookies } from 'next/headers'; // Needed for createRouteHandlerClient
import { withAuth } from '../../utils/auth-middleware';

// GET services list with filtering, sorting, and pagination
async function getServices(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const featured = url.searchParams.get('featured');
    const active = url.searchParams.get('active');
    const search = url.searchParams.get('search');
    const categoryId = url.searchParams.get('categoryId');
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;
    
    // Determine client ID based on user role and context
    let queryClientId = null;
    if (request.user.role === 'client') {
      queryClientId = request.user.clientId;
    } else if (['employee', 'admin'].includes(request.user.role) && request.user.activeClientId) {
      queryClientId = request.user.activeClientId;
    } else {
        // If employee/admin has no active client, they shouldn't see services via this general route
        return NextResponse.json({ error: 'Unable to determine client context.' }, { status: 400 });
    }

    // Build query with base select and count for pagination
    let query = supabase
      .from('wehoware_services')
      .select(`
        *,
        wehoware_service_categories(id, name, slug)
      `, { count: 'exact' })
      .eq('client_id', queryClientId);
    
    // Apply additional filters
    if (featured === 'true') {
      query = query.eq('featured', true);
    }
    if (active === 'true') {
      query = query.eq('active', true);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    // Apply sorting and pagination
    query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error("Error fetching services:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / limit);
    
    return NextResponse.json({
        data,
        pagination: {
            totalItems,
            page,
            limit,
            totalPages,
        },
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create new service
async function createService(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const body = await request.json();
    
    // Determine client_id - require active context for employee/admin
    let clientId = null;
    // Note: Role check already done by withAuth allowedRoles below
    if (['employee', 'admin'].includes(request.user.role)) {
        if (!request.user.activeClientId) {
            return NextResponse.json({ error: 'Active client context required to create a service.' }, { status: 400 });
        }
        clientId = request.user.activeClientId;
    } else {
        // This case should not be hit if allowedRoles is set correctly, but as safeguard:
         return NextResponse.json({ error: 'Unauthorized role for creating service.' }, { status: 403 });
    }
    
    // Basic validation (can be expanded)
    const { title, description, category_id, price, currency, duration, active, featured, image_url, metadata } = body;
    if (!title || !category_id || !price) {
        return NextResponse.json({ error: 'Missing required fields: title, category_id, price' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('wehoware_services')
      .insert([
        {
          client_id: clientId,
          title,
          description,
          category_id,
          price,
          currency: currency || 'USD', // Default currency?
          duration,
          active: active === undefined ? true : active, // Default active to true?
          featured: featured === undefined ? false : featured, // Default featured to false?
          image_url,
          metadata,
          created_by: request.user.id,
          updated_by: request.user.id
        }
      ])
      .select()
      .single(); // Expecting one record back
    
    if (error) {
      console.error("Error creating service:", error);
      // Handle specific errors like foreign key violation (e.g., invalid category_id)
      if (error.code === '23503') {
          return NextResponse.json({ error: `Invalid reference provided (e.g., category_id): ${error.details}` }, { status: 400 });
      }
      return NextResponse.json({ error: `Failed to create service: ${error.message}` }, { status: 500 });
    }
    
    // Check if insert succeeded
    if (!data) {
        console.warn(`Insert for service for client ${clientId} returned no data unexpectedly.`);
        return NextResponse.json({ error: 'Service creation failed unexpectedly (check permissions/RLS).' }, { status: 500 });
    }

    return NextResponse.json({ service: data }, { status: 201 }); // Return the created service

  } catch (error) {
    console.error('Error creating service:', error);
    // Handle potential JSON parsing errors
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON format in request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Export the collection-level handlers
export const GET = withAuth(getServices, { allowedRoles: ['client', 'employee', 'admin'] });
export const POST = withAuth(createService, { allowedRoles: ['employee', 'admin'] }); // Restricted POST

// Handlers requiring dynamic ID (GET by ID, PUT, DELETE) are in [id]/route.js
