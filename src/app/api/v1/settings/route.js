import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use per-request client
import { cookies } from 'next/headers'; // Needed for createRouteHandlerClient
import { withAuth } from '../../utils/auth-middleware';

/**
 * GET handler for application settings.
 * Retrieves settings with optional filtering, pagination, sorting, and formatting.
 */
async function getSettings(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { searchParams } = new URL(request.url);
    
    // Filters
    const group = searchParams.get('group');
    const keys = searchParams.get('keys');
    
    // Formatting
    const format = searchParams.get('format') || 'default'; // Optional format parameter (default or keyValue)
    
    // Pagination (only applies to 'default' format)
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Sorting (only applies to 'default' format)
    const sortBy = searchParams.get('sortBy') || 'setting_key';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

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
      .eq('client_id', clientId);
    
    // Apply group filter if provided
    if (group) {
      query = query.eq('setting_group', group);
    }
    
    // Apply keys filter if provided (comma-separated list)
    if (keys) {
      const keyArray = keys.split(',').map(k => k.trim()).filter(Boolean); // Ensure keys are trimmed and not empty
      if (keyArray.length > 0) {
        query = query.in('setting_key', keyArray);
      }
    }

    // Apply sorting and pagination only for default format
    if (format === 'default') {
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);
    }
    
    // 3. Execute query
    const { data, error, count } = await query;
    
    if (error) {
      console.error("Database error fetching settings:", error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }
    
    // 4. Transform and return the response based on the requested format
    if (format === 'keyValue') {
      // Return as a simple key-value object
      const keyValueFormat = {};
      data.forEach(setting => {
        keyValueFormat[setting.setting_key] = setting.setting_value;
      });
      return NextResponse.json({ data: keyValueFormat }); // Standardized
    } else {
      // Return as an array of setting objects with pagination
      const totalItems = count || 0;
      const totalPages = Math.ceil(totalItems / limit);
      return NextResponse.json({ 
        data, // Standardized
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
    console.error('Unexpected error fetching settings:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * POST handler to create or update settings (Upsert).
 * Supports single setting, batch arrays, or key-value objects.
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
        clientId = body.client_id || request.user.activeClientId; // Allow explicit override
        if (!clientId) {
             return NextResponse.json({ error: 'Client ID must be provided in the request body for employee/admin updates.' }, { status: 400 });
        }
        // Ensure employee/admin has context for the client they are updating
        if (clientId !== request.user.activeClientId) {
            // Optional: Add a check here if admins should be restricted to active client context
            // For now, assume admin/employee can update any client if they provide the ID
        }
    }

    // 2. Prepare settings data for upsert
    let settingsToUpdate = [];
    const now = new Date().toISOString();
    
    if (Array.isArray(body.settings)) {
      // Batch update: Array of setting objects
      settingsToUpdate = body.settings.map(setting => ({
        client_id: clientId,
        setting_key: setting.setting_key, // Validation might be needed here
        setting_value: String(setting.setting_value ?? ''), // Use nullish coalescing
        setting_group: setting.setting_group || 'general',
        // updated_at: now // Let database handle timestamp
      })).filter(s => s.setting_key); // Ensure setting_key is present
    } else if (body.setting_key) {
      // Single setting update
      settingsToUpdate = [{
        client_id: clientId,
        setting_key: body.setting_key,
        setting_value: String(body.setting_value ?? ''),
        setting_group: body.setting_group || 'general',
        // updated_at: now
      }];
    } else if (body.keyValues && typeof body.keyValues === 'object') {
      // Key-value object update
      const group = body.group || 'general';
      settingsToUpdate = Object.entries(body.keyValues).map(([key, value]) => ({
        client_id: clientId,
        setting_key: key,
        setting_value: String(value ?? ''),
        setting_group: group,
        // updated_at: now
      }));
    } else {
      return NextResponse.json({ 
        error: 'Invalid request format. Provide `settings` array, single setting fields (`setting_key`, etc.), or `keyValues` object.' 
      }, { status: 400 });
    }
    
    // Basic validation: ensure there are settings and keys are valid
    if (settingsToUpdate.length === 0) {
      return NextResponse.json({ warning: 'No valid settings to update were provided.' }, { status: 400 });
    }
    if (settingsToUpdate.some(s => !s.setting_key)) {
        return NextResponse.json({ error: 'One or more settings are missing the required `setting_key`.' }, { status: 400 });
    }
    
    // 3. Perform upsert operation
    const { data, error: upsertError } = await supabase
      .from('wehoware_settings')
      .upsert(settingsToUpdate, { 
        onConflict: 'client_id, setting_key',
        returning: 'representation' // Return the updated/inserted rows
      })
      .select(); // Ensure we select the results after upsert
    
    if (upsertError) {
      console.error("Database error upserting settings:", upsertError);
      return NextResponse.json({ error: `Database error: ${upsertError.message}` }, { status: 500 });
    }
    
    // 4. Return standardized success response with the data
    return NextResponse.json({ data }, { status: 200 }); // Use 200 OK for upsert

  } catch (error) {
    // Catch unexpected errors (e.g., JSON parsing)
    console.error('Unexpected error updating settings:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Export handlers with auth middleware
export const GET = withAuth(getSettings, { allowedRoles: ['client', 'employee', 'admin'] });
export const POST = withAuth(updateSettings, { allowedRoles: ['client', 'employee', 'admin'] });
