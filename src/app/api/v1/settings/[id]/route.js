import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use per-request client
import { cookies } from 'next/headers'; // Needed for createRouteHandlerClient
// import supabase from '@/lib/supabase'; // Do not use shared client here
import { withAuth } from '../../../utils/auth-middleware';

// Helper function now accepts supabase client instance
async function getSettingAndAuthorize(supabase, request, id) {
    if (!id || isNaN(parseInt(id))) { // Basic validation for ID
        return { error: NextResponse.json({ error: 'Valid Setting ID is required.' }, { status: 400 }), data: null };
    }

    const { data: setting, error: fetchError } = await supabase
        .from('wehoware_settings')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError) {
        if (fetchError.code === 'PGRST116') { // Not found
            return { error: NextResponse.json({ error: 'Setting not found.' }, { status: 404 }), data: null };
        }
        console.error(`Database error fetching setting ID ${id}:`, fetchError);
        return { error: NextResponse.json({ error: `Database error: ${fetchError.message}` }, { status: 500 }), data: null };
    }

    // Authorization check (remains the same, relies on request.user)
    const isClient = request.user.role === 'client';
    const isEmployeeOrAdmin = ['employee', 'admin'].includes(request.user.role);
    const userClientId = request.user.clientId;
    const activeClientId = request.user.activeClientId;

    const authorized = 
        (isClient && setting.client_id === userClientId) || 
        (isEmployeeOrAdmin && setting.client_id === activeClientId);

    if (!authorized) {
        return { error: NextResponse.json({ error: 'Forbidden: You do not have permission to access this setting.' }, { status: 403 }), data: null };
    }

    return { error: null, data: setting };
}


/**
 * GET handler for a specific setting by ID.
 */
async function getSettingById(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { id } = params;
    
    // Use helper to fetch and authorize, passing the client instance
    const { error, data } = await getSettingAndAuthorize(supabase, request, id);
    
    if (error) return error; // Return error response from helper

    // Return standardized response
    return NextResponse.json({ data });

  } catch (error) {
    console.error(`Unexpected error in GET /settings/${params.id}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * PUT handler to update a specific setting by ID.
 */
async function updateSettingById(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { id } = params;
    const body = await request.json();
    
    // 1. Validate required body field
    if (body.setting_value === undefined || body.setting_value === null) {
      return NextResponse.json({ error: 'Setting value (setting_value) is required.' }, { status: 400 });
    }
    
    // 2. Get setting and authorize using helper, passing the client instance
    const { error: authError, data: existingSetting } = await getSettingAndAuthorize(supabase, request, id);
    if (authError) return authError;
    
    // 3. Prepare update data
    const updateData = {
      setting_value: String(body.setting_value),
    };
    if (body.setting_group !== undefined) {
      updateData.setting_group = body.setting_group;
    }
    
    // 4. Execute the update
    const { data, error: updateError } = await supabase
      .from('wehoware_settings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error(`Database error updating setting ID ${id}:`, updateError);
      return NextResponse.json({ error: `Database error: ${updateError.message}` }, { status: 500 });
    }
    
    // 5. Return standardized success response
    return NextResponse.json({ data });

  } catch (error) {
    console.error(`Unexpected error in PUT /settings/${params.id}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * DELETE handler to remove a specific setting by ID.
 */
async function deleteSettingById(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { id } = params;
    
    // 1. Get setting and authorize using helper, passing the client instance
    const { error: authError, data: existingSetting } = await getSettingAndAuthorize(supabase, request, id);
    if (authError) return authError;

    // 2. Execute delete
    const { error: deleteError } = await supabase
      .from('wehoware_settings')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error(`Database error deleting setting ID ${id}:`, deleteError);
      return NextResponse.json({ error: `Database error: ${deleteError.message}` }, { status: 500 });
    }
    
    // 3. Return standard success response
    return NextResponse.json({ message: 'Setting deleted successfully.' }, { status: 200 });

  } catch (error) {
    console.error(`Unexpected error in DELETE /settings/${params.id}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Export handlers with auth middleware
export const GET = withAuth(getSettingById, { allowedRoles: ['client', 'employee', 'admin'] });
export const PUT = withAuth(updateSettingById, { allowedRoles: ['client', 'employee', 'admin'] });
export const DELETE = withAuth(deleteSettingById, { allowedRoles: ['client', 'employee', 'admin'] });
