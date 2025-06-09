import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use per-request client
import { cookies } from 'next/headers'; // Needed for createRouteHandlerClient
import { withAuth } from '../../../utils/auth-middleware';

/**
 * GET handler for client settings (including SEO).
 * Fetches settings based on user role and active client context.
 */
async function getSettings(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { searchParams } = new URL(request.url);
    const settingGroup = searchParams.get('group');
    const settingKey = searchParams.get('key');
    const format = searchParams.get('format');
    
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
    
    // 2. Build query using the user-scoped client (RLS applies)
    let query = supabase
      .from('wehoware_settings')
      .select('*')
      .eq('client_id', clientId);
    
    // Apply additional filters if provided
    if (settingGroup) {
      query = query.eq('setting_group', settingGroup);
    }
    if (settingKey) {
      query = query.eq('setting_key', settingKey);
    }
    
    // 3. Execute query
    const { data, error } = await query;
    
    if (error) {
      console.error("Database error fetching settings:", error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }
    
    // 4. Format response
    if (format === 'keyValue') {
      const keyValueFormat = {};
      data.forEach(setting => {
        keyValueFormat[setting.setting_key] = setting.setting_value;
      });
      return NextResponse.json({ data: keyValueFormat });
    }
    
    // Default: return array of setting objects
    return NextResponse.json({ data });

  } catch (error) {
    // Catch unexpected errors
    console.error('Unexpected error fetching settings:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * POST handler to create or update client settings (including SEO).
 * Uses upsert based on user role and active client context.
 * Supports both single setting and batch updates.
 */
async function updateSettings(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const body = await request.json();
    
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
    
    // 2. Prepare data for upsert
    let settingsToUpdate = [];
    const defaultGroup = 'seo_global'; // Define default group explicitly
    
    if (Array.isArray(body.settings)) {
      // Batch update
      settingsToUpdate = body.settings.map(setting => {
        if (!setting.setting_key || setting.setting_value === undefined) {
            throw new Error('Each setting in the batch must have setting_key and setting_value.');
        }
        return {
          client_id: clientId,
          setting_key: setting.setting_key,
          setting_value: setting.setting_value,
          setting_group: setting.setting_group || defaultGroup,
          // updated_at is handled by default value in db or trigger
        };
      });
    } else if (body.setting_key && body.setting_value !== undefined) {
      // Single setting update
      settingsToUpdate = [{
        client_id: clientId,
        setting_key: body.setting_key,
        setting_value: body.setting_value,
        setting_group: body.setting_group || defaultGroup,
        // updated_at is handled by default value in db or trigger
      }];
    } else {
      return NextResponse.json({ 
        error: 'Invalid request format. Provide either a settings array or a single setting object with setting_key and setting_value.' 
      }, { status: 400 });
    }

    if (settingsToUpdate.length === 0) {
         return NextResponse.json({ error: 'No valid settings provided for update.' }, { status: 400 });
    }
    
    // 3. Perform upsert operation using the user-scoped client (RLS applies)
    const { data, error } = await supabase
      .from('wehoware_settings')
      .upsert(settingsToUpdate, { 
        onConflict: 'client_id, setting_key' // Assumes this unique constraint exists
        // returning: 'minimal' // Remove this to get data back
      })
      .select(); // Select the upserted rows
    
    if (error) {
      console.error("Database error upserting settings:", error);
      // Check for specific errors like constraint violations if needed
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }
    
    // 4. Return standardized success response with upserted data
    return NextResponse.json({ data }, { status: 200 });

  } catch (error) {
     // Catch unexpected errors (e.g., JSON parsing issues, validation errors in map)
    console.error('Unexpected error updating settings:', error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}

// Export handlers with auth middleware
export const GET = withAuth(getSettings, { allowedRoles: ['client', 'employee', 'admin'] });
export const POST = withAuth(updateSettings, { allowedRoles: ['client', 'employee', 'admin'] });
