import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { cookies } from 'next/headers';

// GET single service by ID
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const { data, error } = await supabase
      .from('wehoware_services')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    
    return NextResponse.json({ service: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update service by ID
export async function PUT(request, { params }) {
  try {
    const { id } = params;
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
      .update({
        ...body,
        updated_by: session.user.id,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ service: data[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE service by ID
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    // Get user session
    const cookieStore = cookies();
    const supabaseClient = supabase;
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { error } = await supabaseClient
      .from('wehoware_services')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
