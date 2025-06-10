import { NextResponse } from 'next/server';
import { withAuth } from '../../../../utils/auth-middleware';

// Helper function to get page and check authorization
// The Supabase client is retrieved from the request object.
async function getPageAndAuthorize(request, id) {
    const { supabase } = request; // Use the Supabase client from middleware
    if (!id) {
        return { error: NextResponse.json({ error: 'Static Page ID is required.' }, { status: 400 }), data: null };
    }

    // Use the supabase client from the request
    const { data: page, error: fetchError } = await supabase
        .from('wehoware_static_pages')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError) {
        if (fetchError.code === 'PGRST116') { // Not found
            return { error: NextResponse.json({ error: 'Static page not found.' }, { status: 404 }), data: null };
        }
        console.error("Database error fetching static page:", fetchError);
        return { error: NextResponse.json({ error: `Database error: ${fetchError.message}` }, { status: 500 }), data: null };
    }

    // Authorization check
    const isClient = request.user.role === 'client';
    const isEmployeeOrAdmin = ['employee', 'admin'].includes(request.user.role);
    const userClientId = request.user.clientId;
    const activeClientId = request.user.activeClientId;

    const authorized = 
        (isClient && page.client_id === userClientId) ||
        (isEmployeeOrAdmin && page.client_id === activeClientId);

    if (!authorized) {
        return { error: NextResponse.json({ error: 'Forbidden: You do not have permission to access this page.' }, { status: 403 }), data: null };
    }

    return { error: null, data: page };
}

/**
 * GET handler for a specific static page by ID.
 */
async function getStaticPageById(request, { params }) {
  try {
    const { id } = params;
    
    // The helper function now gets the client from the request
    const { error, data } = await getPageAndAuthorize(request, id);
    if (error) return error; // Return error response from helper

    // Return standardized response
    return NextResponse.json({ data });

  } catch (error) {
    // Catch unexpected errors from helper or elsewhere
    console.error(`Unexpected error fetching static page by ID ${params.id}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * PUT handler to update a static page.
 */
async function updateStaticPage(request, { params }) {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const { id } = params;
    const body = await request.json();
    
    // 1. Get page and authorize
    const { error: authError, data: existingPage } = await getPageAndAuthorize(request, id);
    if (authError) return authError;
    
    // 2. Build update object - DO NOT allow page_slug update
    const updates = {
      // page_slug: body.page_slug, // Excluded
      title: body.title,
      content: body.content,
      template_name: body.template_name,
      layout: body.layout,
      meta_title: body.meta_title,
      meta_description: body.meta_description,
      meta_keywords: body.meta_keywords,
      open_graph_title: body.open_graph_title,
      open_graph_description: body.open_graph_description,
      open_graph_image: body.open_graph_image,
      is_active: body.is_active,
      // updated_at is handled by the database
    };
    
    // Remove undefined keys to avoid overwriting fields with null
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields provided for update.' }, { status: 400 });
    }
    
    // 3. Execute update using the per-request client
    const { data, error: updateError } = await supabase
      .from('wehoware_static_pages')
      .update(updates)
      .eq('id', id) // Already authorized, just update by ID
      .select() // Select the updated record
      .single(); // Expect a single record
    
    if (updateError) {
      console.error("Database error updating static page:", updateError);
      // Handle potential db errors during update
      return NextResponse.json({ error: `Database error: ${updateError.message}` }, { status: 500 });
    }
    
    // 4. Return standardized success response
    return NextResponse.json({ data });

  } catch (error) {
    // Catch unexpected errors (e.g., JSON parsing)
    console.error(`Unexpected error updating static page ${params.id}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * DELETE handler to remove a static page.
 */
async function deleteStaticPage(request, { params }) {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const { id } = params;
    
    // 1. Get page and authorize
    const { error: authError, data: existingPage } = await getPageAndAuthorize(request, id);
    if (authError) return authError;

    // 2. Execute delete using the per-request client
    const { error: deleteError } = await supabase
      .from('wehoware_static_pages')
      .delete()
      .eq('id', id); // Already authorized, just delete by ID
    
    if (deleteError) {
      console.error("Database error deleting static page:", deleteError);
      return NextResponse.json({ error: `Database error: ${deleteError.message}` }, { status: 500 });
    }
    
    // 3. Return success response (204 No Content is also common)
    return NextResponse.json({ 
      message: 'Static page deleted successfully.' 
    }, { status: 200 });

  } catch (error) {
    // Catch unexpected errors
    console.error(`Unexpected error deleting static page ${params.id}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Export handlers with auth middleware
export const GET = withAuth(getStaticPageById, { allowedRoles: ['client', 'employee', 'admin'] });
export const PUT = withAuth(updateStaticPage, { allowedRoles: ['client', 'employee', 'admin'] });
export const DELETE = withAuth(deleteStaticPage, { allowedRoles: ['client', 'employee', 'admin'] });
