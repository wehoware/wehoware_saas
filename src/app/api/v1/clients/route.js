import { NextResponse } from 'next/server';
import { withAuth } from '../../utils/auth-middleware';

// GET clients (employees/admins see their active client, clients only see their own)
async function getClients(request) {
  try {
    const { supabase } = request;
    const userRole = request.user.role;
    const userClientId = request.user.clientId; // For client role
    const activeClientId = request.user.activeClientId; // For employee/admin role

    // If user is client, they can only see their own client record
    if (userRole === 'client') {
      if (!userClientId) {
        // This case should ideally be caught by middleware, but double-check
        return NextResponse.json({ error: 'Client association not found.' }, { status: 403 });
      }
      const { data, error } = await supabase
        .from('wehoware_clients')
        .select('*')
        .eq('id', userClientId)
        .single();
        
      if (error) {
        console.error(`Error fetching client record for client ${userClientId}:`, error);
        if (error.code === 'PGRST116') { // Not found
          return NextResponse.json({ error: 'Client record not found.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to fetch client record.' }, { status: 500 });
      }
      
      // Return single client in an array for consistency
      return NextResponse.json({ clients: data ? [data] : [] });
    }
    
    // For employees/admins, fetch the specific client from their active context
    if (userRole === 'employee' || userRole === 'admin') {
      if (!activeClientId) {
        return NextResponse.json({ error: 'Active client context required.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('wehoware_clients')
        .select('*')
        .eq('id', activeClientId)
        .single();

      if (error) {
        console.error(`Error fetching active client record ${activeClientId} for user ${request.user.id}:`, error);
        if (error.code === 'PGRST116') { // Not found
          return NextResponse.json({ error: 'Active client record not found.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to fetch active client record.' }, { status: 500 });
      }

      // Return single client in an array for consistency
      return NextResponse.json({ clients: data ? [data] : [] });
    }

    // Fallback if role is somehow unexpected (should be caught by middleware)
    return NextResponse.json({ error: 'Invalid user role for this operation.' }, { status: 403 });

  } catch (error) {
    console.error('Unexpected error in GET /clients:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// POST create new client (employees only)
async function createClient(request) {
  try {
    const { supabase } = request;
    
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('wehoware_clients')
      .insert([{
        ...body,
        created_at: new Date(),
        updated_at: new Date()
      }])
      .select();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ client: data[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Export the handlers with auth middleware
export const GET = withAuth(getClients, { allowedRoles: ['client', 'employee', 'admin'] });
export const POST = withAuth(createClient, { allowedRoles: ['employee', 'admin'] });
