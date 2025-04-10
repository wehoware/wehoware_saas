import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { withAuth } from '../../utils/auth-middleware';

// GET clients (employees can see all, clients only see their own)
async function getClients(request) {
  try {
    // If user is client, they can only see their own client
    if (request.user.role === 'client') {
      const { data, error } = await supabase
        .from('wehoware_clients')
        .select('*')
        .eq('id', request.user.clientId)
        .single();
        
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      return NextResponse.json({ clients: [data] });
    }
    
    // For employees/admins, get all clients or filter by query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const active = searchParams.get('active');
    const sortBy = searchParams.get('sortBy') || 'company_name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    
    let query = supabase.from('wehoware_clients').select('*');
    
    // Apply filters if provided
    if (active === 'true') {
      query = query.eq('active', true);
    }
    
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_person.ilike.%${search}%`);
    }
    
    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ clients: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create new client (employees only)
async function createClient(request) {
  try {
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
