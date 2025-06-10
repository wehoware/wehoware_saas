import { NextResponse } from 'next/server';
import { withAuth } from '../../../../utils/auth-middleware';

/**
 * GET handler for client keywords by ID (Employee/Admin use).
 * Retrieves a specific keywords record by its ID, verifying active client context and ownership/admin role.
 */
async function getKeywordsById(request, { params }) {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const { id } = params;
    const userId = request.user.id;
    const userRole = request.user.role;
    const activeClientId = request.user.activeClientId;

    if (!id) {
      return NextResponse.json({ error: 'Keywords ID is required' }, { status: 400 });
    }

    // Require active client context for employees/admins
    if (!activeClientId) {
        return NextResponse.json({ error: 'Active client context required.' }, { status: 400 });
    }
    
    // 1. Get the specific keywords record using per-request client
    const { data, error } = await supabase
      .from('wehoware_client_keywords')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') { // PostgREST code for 'Not Found'
        return NextResponse.json({ error: 'Keywords record not found or not accessible.' }, { status: 404 });
      }
      console.error("Database error fetching keywords by ID:", error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    // 2. Check permissions - must belong to active client AND (user is admin or owner)
    if (data.client_id !== activeClientId) {
        return NextResponse.json({
            error: 'Forbidden: Record does not belong to your active client context.'
        }, { status: 403 });
    }
    if (userRole !== 'admin' && userId !== data.employee_id) {
      return NextResponse.json({ 
        error: 'Forbidden: You do not have permission to access this keywords record.' 
      }, { status: 403 });
    }
    
    // 3. Return the formatted response
    return NextResponse.json({
        data: {
            id: data.id,
            client_id: data.client_id,
            employee_id: data.employee_id,
            keywords: data.keywords,
            created_at: data.created_at,
            updated_at: data.updated_at
        }
    });
  } catch (error) {
    // Catch unexpected errors
    console.error('Unexpected error fetching keywords by ID:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * DELETE handler to remove a keywords record (Employee/Admin use).
 * Verifies active client context and ownership/admin role before deletion.
 */
async function deleteKeywords(request, { params }) {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const { id } = params;
    const userId = request.user.id;
    const userRole = request.user.role;
    const activeClientId = request.user.activeClientId;

    if (!id) {
      return NextResponse.json({ error: 'Keywords ID is required' }, { status: 400 });
    }

    // Require active client context for employees/admins
    if (!activeClientId) {
        return NextResponse.json({ error: 'Active client context required.' }, { status: 400 });
    }
    
    // 1. Get the current record to verify ownership before deleting using per-request client
    const { data: existingRecord, error: checkError } = await supabase
      .from('wehoware_client_keywords')
      .select('client_id, employee_id') // Select only needed fields for check
      .eq('id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') { // PostgREST code for 'Not Found'
        return NextResponse.json({ error: 'Keywords record not found or not accessible.' }, { status: 404 });
      }
      console.error("Database error checking keywords before delete:", checkError);
      return NextResponse.json({ error: `Database error during check: ${checkError.message}` }, { status: 500 });
    }
    
    // 2. Check permissions - must belong to active client AND (user is admin or owner)
    if (existingRecord.client_id !== activeClientId) {
        return NextResponse.json({
            error: 'Forbidden: Record does not belong to your active client context.'
        }, { status: 403 });
    }
    if (userRole !== 'admin' && userId !== existingRecord.employee_id) {
      return NextResponse.json({ 
        error: 'Forbidden: You do not have permission to delete this keywords record.' 
      }, { status: 403 });
    }
    
    // 3. Delete the record using per-request client (RLS also applies)
    const { error: deleteError } = await supabase
      .from('wehoware_client_keywords')
      .delete()
      .eq('id', id)
      .eq('client_id', activeClientId); // Explicitly ensure we only delete from the correct context
    
    if (deleteError) {
      console.error("Database error deleting keywords:", deleteError);
      return NextResponse.json({ error: `Database error during deletion: ${deleteError.message}` }, { status: 500 });
    }
    
    // 4. Return success response
    return NextResponse.json({
      message: 'Keywords record deleted successfully'
    }, { status: 200 }); // 200 OK or 204 No Content are suitable

  } catch (error) {
    // Catch unexpected errors
    console.error('Unexpected error deleting keywords:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Export handlers with auth middleware - Restricted to Employee/Admin
export const GET = withAuth(getKeywordsById, { allowedRoles: ['employee', 'admin'] });
export const DELETE = withAuth(deleteKeywords, { allowedRoles: ['employee', 'admin'] });
