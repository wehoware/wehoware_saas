import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use per-request client
import { cookies } from 'next/headers'; // Needed for createRouteHandlerClient
import { withAuth } from '../../../../../utils/auth-middleware';

/**
 * GET handler for settings by group.
 * Retrieves settings belonging to a specific group for a client.
 * Supports pagination (default format) and key-value formatting.
 */
async function getSettingsByGroup(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { group } = params;
    if (!group) {
      return NextResponse.json({ error: 'Group name parameter is required.' }, { status: 400 });
    }
    
    const { searchParams } = new URL(request.url);
    
    // Formatting
    const format = searchParams.get('format') || 'default'; // Optional format parameter
    
    // Pagination (only applies to 'default' format)
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // 1. Determine Client ID based on role
    let clientId;
    if (request.user.role === 'client') {
        clientId = request.user.clientId;
    } else { // 'employee' or 'admin'
        clientId = request.user.activeClientId;
        if (!clientId) {
            return NextResponse.json({ error: 'Active client context required for employee/admin.' }, { status: 400 });
        }
    }
    
    // 2. Build query
    let query = supabase
      .from('wehoware_settings')
      // Select with count only needed for default format pagination
      .select(format === 'default' ? '*, count' : '*', { count: format === 'default' ? 'exact' : undefined })
      .eq('client_id', clientId)
      .eq('setting_group', group);

    // Apply pagination only for default format
    if (format === 'default') {
      query = query.range(offset, offset + limit - 1);
      // Optional: Add sorting if needed for default format
      // query = query.order('setting_key', { ascending: true });
    }
    
    // 3. Execute query
    const { data, error, count } = await query;
    
    if (error) {
      console.error(`Database error fetching settings for group ${group}:`, error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }
    
    // 4. Transform and return the response based on format
    if (format === 'keyValue') {
      // Return as a simple key-value object
      const keyValueFormat = {};
      data.forEach(setting => {
        keyValueFormat[setting.setting_key] = setting.setting_value;
      });
      // Standardized response, removed group field
      return NextResponse.json({ data: keyValueFormat });
    } else {
      // Return as an array of setting objects with pagination
      const totalItems = count || 0;
      const totalPages = Math.ceil(totalItems / limit);
      // Standardized response, removed group field
      return NextResponse.json({ 
        data,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        }
      });
    }
  } catch (error) {
    // Catch unexpected errors
    console.error(`Unexpected error fetching settings for group ${params.group}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * PUT handler to update multiple settings in a group at once (Upsert).
 */
async function updateSettingsByGroup(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { group } = params;
    if (!group) {
      return NextResponse.json({ error: 'Group name parameter is required.' }, { status: 400 });
    }
    
    const body = await request.json();
    
    // 1. Validate the request body format
    if (!body.settings && !body.keyValues) {
      return NextResponse.json({ 
        error: 'Invalid request format. Provide `settings` array or `keyValues` object.' 
      }, { status: 400 });
    }
    
    // 2. Determine Client ID based on role
    let clientId;
    if (request.user.role === 'client') {
        clientId = request.user.clientId;
    } else { // 'employee' or 'admin'
        clientId = body.client_id || request.user.activeClientId; // Allow explicit override
        if (!clientId) {
             return NextResponse.json({ error: 'Client ID must be provided in the request body for employee/admin updates.' }, { status: 400 });
        }
        // Optional: Add check if employee/admin's activeClientId must match the provided clientId
    }

    // 3. Prepare settings data for upsert
    let settingsToUpdate = [];
    // const now = new Date().toISOString(); // Let DB handle timestamp
    
    if (Array.isArray(body.settings)) {
      // Array of setting objects
      settingsToUpdate = body.settings.map(setting => ({
        client_id: clientId,
        setting_key: setting.setting_key,
        setting_value: String(setting.setting_value ?? ''),
        setting_group: group, // Force the group from URL param
        // updated_at: now,
      })).filter(s => s.setting_key); // Ensure key is present
    } else if (typeof body.keyValues === 'object') {
      // Key-value object
      settingsToUpdate = Object.entries(body.keyValues).map(([key, value]) => ({
        client_id: clientId,
        setting_key: key,
        setting_value: String(value ?? ''),
        setting_group: group, // Force the group from URL param
        // updated_at: now,
      }));
    }
    
    // Validate prepared data
    if (settingsToUpdate.length === 0) {
      return NextResponse.json({ warning: 'No valid settings to update were provided.' }, { status: 400 });
    }
    if (settingsToUpdate.some(s => !s.setting_key)) {
        return NextResponse.json({ error: 'One or more settings are missing the required `setting_key`.' }, { status: 400 });
    }
    
    // 4. Perform upsert operation
    const { data, error: upsertError } = await supabase
      .from('wehoware_settings')
      .upsert(settingsToUpdate, { 
        onConflict: 'client_id, setting_key',
        returning: 'representation' // Return updated/inserted rows
      })
      .select(); // Ensure results are selected
    
    if (upsertError) {
      console.error(`Database error upserting settings for group ${group}:`, upsertError);
      return NextResponse.json({ error: `Database error: ${upsertError.message}` }, { status: 500 });
    }
    
    // 5. Return standardized success response with data
    return NextResponse.json({ data }, { status: 200 });

  } catch (error) {
    // Catch unexpected errors
    console.error(`Unexpected error updating settings for group ${params.group}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * DELETE handler to remove all settings in a specific group.
 */
async function deleteSettingsByGroup(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { group } = params;
    if (!group) {
      return NextResponse.json({ error: 'Group name parameter is required.' }, { status: 400 });
    }
    
    // 1. Determine Client ID based on role
    let clientId;
    if (request.user.role === 'client') {
        clientId = request.user.clientId;
    } else { // 'employee' or 'admin'
        clientId = request.user.activeClientId;
        // If allowing deletion based on query param client_id (like GET originally did):
        // clientId = request.user.activeClientId || searchParams.get('client_id'); 
        if (!clientId) {
            return NextResponse.json({ error: 'Active client context required for employee/admin.' }, { status: 400 });
        }
    }
    
    // 2. Delete all settings in this group for the client
    // Use count: 'exact' to get the number deleted
    const { data, error, count } = await supabase
      .from('wehoware_settings')
      .delete({ count: 'exact' })
      .eq('client_id', clientId)
      .eq('setting_group', group);
    
    if (error) {
      console.error(`Database error deleting settings for group ${group}:`, error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }
    
    // 3. Return standardized success response
    return NextResponse.json({
      message: `Successfully deleted settings in group: ${group}`, // More descriptive message
      deleted: count || 0
    }, { status: 200 });

  } catch (error) {
    // Catch unexpected errors
    console.error(`Unexpected error deleting settings for group ${params.group}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Export handlers with auth middleware
export const GET = withAuth(getSettingsByGroup, { allowedRoles: ['client', 'employee', 'admin'] });
export const PUT = withAuth(updateSettingsByGroup, { allowedRoles: ['client', 'employee', 'admin'] });
export const DELETE = withAuth(deleteSettingsByGroup, { allowedRoles: ['client', 'employee', 'admin'] });
