import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use per-request client
import { cookies } from 'next/headers'; // Needed for createRouteHandlerClient
import { withAuth } from '../../../utils/auth-middleware';

// GET a single service by ID
async function getServiceById(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { id } = params;
    
    // 1. Determine required client context
    let requiredClientId = null;
    if (request.user.role === 'client') {
        requiredClientId = request.user.clientId;
    } else if (['employee', 'admin'].includes(request.user.role)) {
        if (!request.user.activeClientId) {
            return NextResponse.json({ error: 'Active client context required.' }, { status: 400 });
        }
        requiredClientId = request.user.activeClientId;
    } else {
         return NextResponse.json({ error: 'Unauthorized role.' }, { status: 403 });
    }

    // 2. Build query using the user-scoped client (RLS applies)
    let query = supabase
      .from('wehoware_services')
      .select(`
        *,
        wehoware_service_categories(id, name, slug)
      `)
      .eq('id', id)
      .eq('client_id', requiredClientId) // Enforce client context
      .single();
    
    const { data, error } = await query;
    
    if (error) {
      if (error.code === 'PGRST116') { // PostgREST code for no rows found
        return NextResponse.json({ error: 'Service not found or not accessible within your current context.' }, { status: 404 });
      }
      console.error("Error fetching service:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ service: data });
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update service
async function updateService(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { id: serviceId } = params;
    const body = await request.json();

    // 1. Ensure user has active client context (employee/admin only)
    if (!request.user.activeClientId) {
        return NextResponse.json({ error: 'Active client context required to update a service.' }, { status: 400 });
    }
    const activeClientId = request.user.activeClientId;
    const userId = request.user.id;

    // 2. Fetch the existing service using the user-scoped client
    const { data: existingService, error: fetchError } = await supabase
        .from('wehoware_services')
        .select('id, client_id')
        .eq('id', serviceId)
        .single();

    if (fetchError || !existingService) {
        if (fetchError?.code === 'PGRST116') {
            return NextResponse.json({ error: "Service not found" }, { status: 404 });
        }
        console.error("Error fetching service for update:", fetchError);
        return NextResponse.json({ error: "Failed to fetch service for update." }, { status: 500 });
    }

    // 3. Authorization check
    if (String(existingService.client_id) !== String(activeClientId)) {
         return NextResponse.json({ error: "Unauthorized: Service does not belong to your active client context." }, { status: 403 });
    }

    // 4. Prepare update data (only allowed fields)
    const { title, description, category_id, price, currency, duration, active, featured, image_url, metadata } = body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (duration !== undefined) updateData.duration = duration;
    if (active !== undefined) updateData.active = active;
    if (featured !== undefined) updateData.featured = featured;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (metadata !== undefined) updateData.metadata = metadata;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 });
    }

    updateData.updated_by = userId;
    updateData.updated_at = new Date().toISOString();

    // 5. Execute update using the user-scoped client (RLS applies)
    const { data, error } = await supabase
      .from('wehoware_services')
      .update(updateData)
      .eq('id', serviceId)
      .eq('client_id', activeClientId) // Redundant check, but safe
      .select();
    
    if (error) {
        console.error('Error updating service:', error);
        return NextResponse.json({ error: 'Failed to update service.' }, { status: 500 });
    }
    
    if (!data || data.length === 0) {
        // This shouldn't happen if fetch/auth checks passed, but handle defensively
        return NextResponse.json({ error: 'Service not found or update failed unexpectedly.' }, { status: 404 });
    }
    
    return NextResponse.json({ service: data[0] });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE service
async function deleteService(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { id: serviceId } = params;

    // 1. Ensure user is admin and has active client context
     if (!request.user.activeClientId) {
        return NextResponse.json({ error: 'Active client context required to delete a service.' }, { status: 400 });
    }
    const activeClientId = request.user.activeClientId;

    // 2. Fetch the existing service using the user-scoped client
    const { data: existingService, error: fetchError } = await supabase
        .from('wehoware_services')
        .select('id, client_id')
        .eq('id', serviceId)
        .single();

    if (fetchError || !existingService) {
        if (fetchError?.code === 'PGRST116') {
            return NextResponse.json({ error: "Service not found" }, { status: 404 });
        }
        console.error("Error fetching service for delete:", fetchError);
        return NextResponse.json({ error: "Failed to fetch service for delete." }, { status: 500 });
    }

    // 3. Authorization check
    if (String(existingService.client_id) !== String(activeClientId)) {
         return NextResponse.json({ error: "Unauthorized: Service does not belong to the admin's active client context." }, { status: 403 });
    }

    // 4. Execute delete using the user-scoped client (RLS applies)
    const { error, count } = await supabase
      .from('wehoware_services')
      .delete()
      .eq('id', serviceId)
      .eq('client_id', activeClientId);
    
    if (error) {
        console.error("Error deleting service:", error);
        return NextResponse.json({ error: 'Failed to delete service.' }, { status: 500 });
    }

    if (count === 0) {
        // This shouldn't happen if fetch/auth checks passed, but handle defensively
        console.warn(`Delete operation for service ${serviceId} affected 0 rows unexpectedly.`);
        return NextResponse.json({ error: 'Service not found or delete failed unexpectedly.' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Export the handlers with auth middleware
export const GET = withAuth(getServiceById, { allowedRoles: ['client', 'employee', 'admin'] });
export const PUT = withAuth(updateService, { allowedRoles: ['employee', 'admin'] }); // Restricted PUT
export const DELETE = withAuth(deleteService, { allowedRoles: ['admin'] }); // Restricted DELETE
