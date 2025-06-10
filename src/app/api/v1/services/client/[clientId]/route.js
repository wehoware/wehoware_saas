import { NextResponse } from 'next/server';
import { withAuth } from '../../../../utils/auth-middleware';

// GET services by client ID (for employee/admin use) with pagination and filtering
export const GET = withAuth(async (request, { params }) => {
  try {
    const { supabase } = request; 
    const { clientId } = params;
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const featured = searchParams.get('featured');
    const active = searchParams.get('active');
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Authorization is handled by withAuth restricting roles below
    // Removed redundant client role check
    // if (request.user.role === 'client' && request.user.clientId !== clientId) {
    //   return NextResponse.json({ error: 'Unauthorized to view other clients\' services' }, { status: 403 });
    // }
    
    // Build query with base select and count
    let query = supabase
      .from('wehoware_services')
      .select(`
        *,
        wehoware_service_categories(id, name, slug)
      `, { count: 'exact' })
      .eq('client_id', clientId);
    
    // Apply additional filters
    if (featured === 'true') {
      query = query.eq('featured', true);
    }
    if (active === 'true') {
      query = query.eq('active', true);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
        // Handle potential error if clientId doesn't exist or other db issues
        console.error('Error fetching services by client ID:', error);
        return NextResponse.json({ error: 'Failed to fetch services for the specified client.' }, { status: 500 });
    }
    
    // Calculate total pages
    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Standardized response format
    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Unexpected error fetching services by client ID:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { allowedRoles: ['employee', 'admin'] }); // Only employee/admin can use this route
