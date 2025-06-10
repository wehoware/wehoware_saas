import { NextResponse } from 'next/server';
import { withAuth } from '../../../utils/auth-middleware';

/**
 * GET handler for client keywords (Employee/Admin use).
 * Fetches keywords associated with the active client for the currently logged-in employee/admin.
 * Note: Keywords are stored per-client AND per-employee.
 */
async function getKeywords(request) {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    // 1. Determine client ID from active context (employee/admin only)
    const clientId = request.user.activeClientId;
    if (!clientId) {
      return NextResponse.json({ 
        error: 'Active client context required.' 
      }, { status: 400 });
    }
    
    // Authorization handled by withAuth roles below

    // 2. Get keywords for this client and the current employee/admin
    const { data, error } = await supabase
      .from('wehoware_client_keywords')
      .select('*')
      .eq('client_id', clientId)
      .eq('employee_id', request.user.id) // Specific to the logged-in user
      .maybeSingle();
    
    if (error) {
      console.error("Database error fetching keywords:", error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }
    
    // 3. Format the response
    if (data) {
      // Return existing data
      return NextResponse.json({
        data: {
          id: data.id,
          client_id: data.client_id,
          employee_id: data.employee_id,
          sections: data.keywords?.sections || [],
          created_at: data.created_at,
          updated_at: data.updated_at
        }
      });
    } else {
      // Return empty structure if no data exists yet for this client/employee pair
      return NextResponse.json({
        data: {
            client_id: clientId,
            employee_id: request.user.id,
            sections: []
        }
      });
    }
  } catch (error) {
    // Catch unexpected errors
    console.error('Unexpected error fetching keywords:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * POST handler to create or update client keywords (Employee/Admin use).
 * Creates/updates keywords associated with the active client for the currently logged-in employee/admin.
 * Note: Keywords are stored per-client AND per-employee.
 */
async function createOrUpdateKeywords(request) {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const body = await request.json();
    const userId = request.user.id;
    
    // 1. Validate required fields from body
    if (!body.sections || !Array.isArray(body.sections)) {
      return NextResponse.json({ error: 'Sections array is required and must be an array.' }, { status: 400 });
    }
    
    // 2. Determine client ID from active context (employee/admin only)
    const clientId = request.user.activeClientId;
    if (!clientId) {
      return NextResponse.json({ 
        error: 'Active client context required.' 
      }, { status: 400 });
    }
    
    // Authorization handled by withAuth roles below
    
    // 3. Check if record already exists for this client/employee pair
    const { data: existingRecord, error: checkError } = await supabase
      .from('wehoware_client_keywords')
      .select('id')
      .eq('client_id', clientId)
      .eq('employee_id', userId)
      .maybeSingle();
    
    if (checkError) {
      console.error("Database error checking for existing keywords:", checkError);
      return NextResponse.json({ error: `Database error during check: ${checkError.message}` }, { status: 500 });
    }
    
    let resultData;
    let statusCode = 200;
    
    if (existingRecord) {
      // Update existing record
      const { data, error } = await supabase
        .from('wehoware_client_keywords')
        .update({
          keywords: { sections: body.sections }, // Ensure sections is structured correctly
          updated_at: new Date().toISOString(),
          // employee_id is implicitly checked by the query below, no need to update
        })
        .eq('id', existingRecord.id)
        // .eq('client_id', clientId) // id is unique, client_id check not strictly needed here
        // .eq('employee_id', userId) // id is unique, employee_id check not strictly needed here
        .select()
        .single(); // Expecting a single result
      
      if (error) {
          console.error("Database error updating keywords:", error);
          return NextResponse.json({ error: `Database error during update: ${error.message}` }, { status: 500 });
      }
      resultData = data;
      statusCode = 200;
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('wehoware_client_keywords')
        .insert({
          client_id: clientId,
          employee_id: userId,
          keywords: { sections: body.sections } // Ensure sections is structured correctly
        })
        .select()
        .single(); // Expecting a single result
      
      if (error) {
          console.error("Database error inserting keywords:", error);
          // Handle potential constraint violations etc.
          return NextResponse.json({ error: `Database error during insert: ${error.message}` }, { status: 500 });
      }
      resultData = data;
      statusCode = 201;
    }
    
    // 4. Return standardized success response
    return NextResponse.json({ data: resultData }, { status: statusCode });

  } catch (error) {
     // Catch unexpected errors (e.g., JSON parsing issues)
    console.error('Unexpected error saving keywords:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Export handlers with auth middleware - Restricted to Employee/Admin
export const GET = withAuth(getKeywords, { allowedRoles: ['employee', 'admin'] });
export const POST = withAuth(createOrUpdateKeywords, { allowedRoles: ['employee', 'admin'] });
