import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use per-request client
import { cookies } from 'next/headers'; // Needed for createRouteHandlerClient
import { withAuth } from '../../../utils/auth-middleware';

/**
 * GET handler for static pages.
 * Fetches static pages based on user role and active client context.
 * Supports filtering, pagination, and sorting.
 */
async function getStaticPages(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const { searchParams } = new URL(request.url);
    
    // Filters
    const slug = searchParams.get('slug');
    const isActive = searchParams.get('is_active');
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'page_slug';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    
    // 1. Determine Client ID based on role
    let clientId;
    if (request.user.role === 'client') {
        clientId = request.user.clientId;
    } else { // 'employee' or 'admin'
        clientId = request.user.activeClientId;
        if (!clientId) {
            return NextResponse.json({ error: 'Active client context required for employee/admin.' }, { status: 400 });
        }
    }
    
    // 2. Build query with count using the user-scoped client
    let query = supabase
      .from('wehoware_static_pages')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId);
    
    // Apply filters if provided
    if (slug) {
      query = query.eq('page_slug', slug);
    }
    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }
    
    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);
    
    // 3. Execute query
    const { data, error, count } = await query;
    
    if (error) {
      console.error("Database error fetching static pages:", error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    // 4. Calculate pagination details
    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / limit);
    
    // 5. Standardized response
    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      }
    });

  } catch (error) {
    // Catch unexpected errors
    console.error('Unexpected error fetching static pages:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * POST handler to create a new static page.
 */
async function createStaticPage(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Use per-request client
    const body = await request.json();
    
    // 1. Validate required fields
    if (!body.page_slug) {
      return NextResponse.json({ error: 'Page slug (page_slug) is required.' }, { status: 400 });
    }
    
    // 2. Determine Client ID based on role
    let clientId;
    if (request.user.role === 'client') {
        clientId = request.user.clientId;
    } else { // 'employee' or 'admin'
        clientId = request.user.activeClientId;
        if (!clientId) {
            return NextResponse.json({ error: 'Active client context required for employee/admin.' }, { status: 400 });
        }
    }
    
    // 3. Check if page slug already exists using the user-scoped client
    const { data: existingPage, error: checkError } = await supabase
      .from('wehoware_static_pages')
      .select('id')
      .eq('client_id', clientId)
      .eq('page_slug', body.page_slug)
      .maybeSingle();
    
    if (checkError) {
      console.error("Database error checking existing page slug:", checkError);
      return NextResponse.json({ error: `Database error during validation: ${checkError.message}` }, { status: 500 });
    }
    
    if (existingPage) {
      return NextResponse.json({ 
        error: `Conflict: A page with slug "${body.page_slug}" already exists for this client.` 
      }, { status: 409 }); // Use 409 Conflict status code
    }
    
    // 4. Prepare new page data
    const newPageData = {
      client_id: clientId,
      page_slug: body.page_slug,
      title: body.title || '',
      content: body.content || '',
      template_name: body.template_name || null,
      layout: body.layout || null,
      meta_title: body.meta_title || '',
      meta_description: body.meta_description || '',
      meta_keywords: body.meta_keywords || '', // Consider if this is still relevant for modern SEO
      open_graph_title: body.open_graph_title || '',
      open_graph_description: body.open_graph_description || '',
      open_graph_image: body.open_graph_image || '',
      is_active: body.is_active !== undefined ? body.is_active : true,
      // created_at and updated_at are handled by the database
    };
    
    // 5. Insert the new page using the user-scoped client
    const { data, error: insertError } = await supabase
      .from('wehoware_static_pages')
      .insert(newPageData) // Insert object directly
      .select() // Select the newly created row
      .single(); // Expecting a single row back
    
    if (insertError) {
        console.error("Database error inserting static page:", insertError);
        // Handle potential constraint violations etc.
        return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 });
    }
    
    // 6. Return standardized success response
    return NextResponse.json({ data }, { status: 201 });

  } catch (error) {
    // Catch unexpected errors (e.g., JSON parsing issues)
    console.error('Unexpected error creating static page:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Export handlers with auth middleware
export const GET = withAuth(getStaticPages, { allowedRoles: ['client', 'employee', 'admin'] });
export const POST = withAuth(createStaticPage, { allowedRoles: ['client', 'employee', 'admin'] });
