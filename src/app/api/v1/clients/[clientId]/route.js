import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { withAuth } from '../../utils/auth-middleware';

// GET client by ID (with proper authorization check)
async function getClientById(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const clientId = params.clientId;

    // Authorization check: Clients can only see their own data
    if (request.user.role === 'client' && String(request.user.clientId) !== String(clientId)) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('wehoware_clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update existing client
async function updateClient(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const clientId = params.clientId;
    const body = await request.json();

    // Validation check
    if (!body) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    // Check if the client exists
    const { data: existingClient, error: checkError } = await supabase
      .from('wehoware_clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (checkError || !existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Update the client
    const updateData = {
      ...body,
      updated_at: new Date(), 
    };

    const { data, error } = await supabase
      .from('wehoware_clients')
      .update(updateData)
      .eq('id', clientId)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ client: data[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE client
async function deleteClient(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const clientId = params.clientId;

    // Verify admin role for deletion
    if (request.user.role !== 'admin') {
      return NextResponse.json({ error: 'Only administrators can delete clients' }, { status: 403 });
    }

    // Check if the client exists
    const { data: existingClient, error: checkError } = await supabase
      .from('wehoware_clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (checkError || !existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Delete client
    const { error } = await supabase
      .from('wehoware_clients')
      .delete()
      .eq('id', clientId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Export the handlers with auth middleware
export const GET = withAuth(getClientById, { allowedRoles: ['client', 'employee', 'admin'] });
export const PUT = withAuth(updateClient, { allowedRoles: ['employee', 'admin'] });
export const DELETE = withAuth(deleteClient, { allowedRoles: ['admin'] });
