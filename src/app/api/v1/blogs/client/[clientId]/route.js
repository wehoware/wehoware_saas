import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { withAuth } from '../../../../utils/auth-middleware';

// GET blogs by client ID with pagination and filtering
export const GET = withAuth(async (request, { params }) => {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { clientId } = params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    const status = url.searchParams.get('status') || '';
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    
    // Authorization check
    if (request.user.role === 'client' && String(request.user.clientId) !== String(clientId)) {
      return NextResponse.json({ error: 'Unauthorized: Clients can only view their own blogs' }, { status: 403 });
    } else if (['employee', 'admin'].includes(request.user.role)) {
        if (!request.user.activeClientId) {
             return NextResponse.json({ error: 'Unauthorized: No active client context set.' }, { status: 403 });
        }
        if (String(request.user.activeClientId) !== String(clientId)) {
            return NextResponse.json({ error: 'Unauthorized: Admins/Employees can only view blogs for their active client.' }, { status: 403 });
        }
    }
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build query
    let query = supabase
      .from('wehoware_blogs')
      .select('*, wehoware_blog_categories(name), wehoware_profiles(first_name, last_name)', { count: 'exact' })
      .eq('client_id', clientId);
    
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
      },
      client_id: clientId
    });
  } catch (error) {
    console.error('Error fetching blogs by client ID:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}, { allowedRoles: ['client', 'employee', 'admin'] });
