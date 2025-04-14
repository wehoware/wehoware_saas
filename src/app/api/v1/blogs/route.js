import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { withAuth } from '../../utils/auth-middleware';

// GET all blogs with pagination and filtering
export const GET = withAuth(async (request) => {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    const status = url.searchParams.get('status') || '';
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build query
    let query = supabase
      .from('wehoware_blogs')
      .select('*, wehoware_blog_categories(name)', { count: 'exact' });
    
    // Add filters if provided
    if (search) {
      query = query.or(`title.ilike.%${search}%, content.ilike.%${search}%`);
    }
    
    if (category) {
      query = query.eq('category_id', category);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Add client filter for client users
    if (request.user.role === 'client') {
      query = query.eq('client_id', request.user.clientId);
    }
    
    // Add sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);
    
    // Execute query
    const { data, error, count } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Calculate total pages
    const totalPages = Math.ceil(count / limit);
    
    return NextResponse.json({
      blogs: data,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

// POST create new blog
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { title, content, category_id, status, featured_image } = body;
    
    if (!title || !content || !category_id) {
      return NextResponse.json(
        { error: 'Title, content, and category are required' },
        { status: 400 }
      );
    }
    
    // Set client_id based on user role
    let client_id = null;
    
    if (request.user.role === 'client') {
      client_id = request.user.clientId;
    } else if (['employee', 'admin'].includes(request.user.role) && request.user.activeClientId) {
      client_id = request.user.activeClientId;
    }
    
    // Prepare blog data
    const blogData = {
      title,
      content,
      category_id,
      status: status || 'draft',
      featured_image,
      client_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Insert blog
    const { data, error } = await supabase
      .from('wehoware_blogs')
      .insert(blogData)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ blog: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating blog:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}, { allowedRoles: ['client', 'employee', 'admin'] });
