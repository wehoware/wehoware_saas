import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { withAuth } from '../../../utils/auth-middleware';

// GET blog by ID
export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = params;
    
    // Build query
    let query = supabase
      .from('wehoware_blogs')
      .select('*, wehoware_blog_categories(name), wehoware_profiles(first_name, last_name)')
      .eq('id', id)
      .single();
    
    // Add client filter for client users
    if (request.user.role === 'client') {
      query = query.eq('client_id', request.user.clientId);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Blog not found or unauthorized' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ blog: data });
  } catch (error) {
    console.error('Error fetching blog:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

// PUT update blog
export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Validate required fields
    const { title, content, category_id, status, featured_image } = body;
    
    if (!title || !content || !category_id) {
      return NextResponse.json(
        { error: 'Title, content, and category are required' },
        { status: 400 }
      );
    }
    
    // Build update query
    let query = supabase
      .from('wehoware_blogs')
      .update({
        title,
        content,
        category_id,
        status: status || 'draft',
        featured_image,
        updated_at: new Date().toISOString()
      });
    
    // Add filters
    query = query.eq('id', id);
    
    // Add client filter for client users
    if (request.user.role === 'client') {
      query = query.eq('client_id', request.user.clientId);
    }
    
    // Execute update
    const { data, error } = await query.select();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Blog not found or unauthorized' }, { status: 404 });
    }
    
    return NextResponse.json({ blog: data[0] });
  } catch (error) {
    console.error('Error updating blog:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}, { allowedRoles: ['client', 'employee', 'admin'] });

// DELETE blog
export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = params;
    
    // Build delete query
    let query = supabase
      .from('wehoware_blogs')
      .delete();
    
    // Add filters
    query = query.eq('id', id);
    
    // Add client filter for client users
    if (request.user.role === 'client') {
      query = query.eq('client_id', request.user.clientId);
    }
    
    // Execute delete
    const { error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting blog:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}, { allowedRoles: ['client', 'employee', 'admin'] });
