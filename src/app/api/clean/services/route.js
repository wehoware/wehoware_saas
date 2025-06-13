import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { cookies } from 'next/headers';

// GET all services
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get('featured');
    const active = searchParams.get('active');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    let query = supabase.from('wehoware_services').select('*');
    
    // Apply filters if provided
    if (featured === 'true') {
      query = query.eq('featured', true);
    }
    
    if (active === 'true') {
      query = query.eq('active', true);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ services: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create new service
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Get user session
    const cookieStore = cookies();
    const supabaseClient = supabase;
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data, error } = await supabaseClient
      .from('wehoware_services')
      .insert([
        {
          ...body,
          created_by: session.user.id,
          updated_by: session.user.id
        }
      ])
      .select();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ service: data[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
