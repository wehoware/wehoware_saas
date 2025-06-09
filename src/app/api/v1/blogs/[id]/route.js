import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // Use per-request client
import { cookies } from 'next/headers'; // Needed for createRouteHandlerClient
import { withAuth } from '../../../utils/auth-middleware';

// Helper function to generate a unique slug (copied from route.js)
// Accepts the supabase client instance as the first argument
async function generateUniqueSlug(supabase, title, clientId, currentSlug = null) {
  let slug = title
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text

  // If the generated slug hasn't changed, no need to check uniqueness
  if (slug === currentSlug) {
      return slug;
  }

  let uniqueSlug = slug;
  let counter = 1;

  // Check if slug exists for the client
  while (true) {
    // Use the passed-in supabase client
    const { data, error } = await supabase
      .from('wehoware_blogs')
      .select('id')
      .eq('client_id', clientId)
      .eq('slug', uniqueSlug)
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 result

    if (error) {
      console.error('Error checking slug uniqueness:', error);
      throw new Error('Failed to verify slug uniqueness');
    }

    if (!data) {
      break; // Slug is unique
    }

    // Slug exists, append counter and try again
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }

  return uniqueSlug;
}

// GET blog by ID
export const GET = withAuth(async (request, { params }) => {
  try {
    const supabase = createRouteHandlerClient({ cookies }); // Create client here
    const { id } = params;
    
    // Build query using the per-request client
    let query = supabase
      .from('wehoware_blogs')
      .select('*, wehoware_blog_categories(name), wehoware_profiles(first_name, last_name)')
      .eq('id', id)
      .single();
    
    // Add client filter based on role
    if (request.user.role === 'client') {
      query = query.eq('client_id', request.user.clientId);
    } else if (['employee', 'admin'].includes(request.user.role) && request.user.activeClientId) {
        // Employees/Admins should only see blogs for their active client context
        query = query.eq('client_id', request.user.activeClientId);
    } else if (['employee', 'admin'].includes(request.user.role) && !request.user.activeClientId) {
        // If employee/admin has no active client, they shouldn't see specific client blogs via this route
        return NextResponse.json({ error: 'No active client context set.' }, { status: 400 });
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
    const supabase = createRouteHandlerClient({ cookies }); // Create client here
    const { id } = params;
    const body = await request.json();
    
    // Validate required fields
    const { title, content, category_id, status, thumbnail } = body;
    
    if (!title || !content || !category_id) {
      return NextResponse.json(
        { error: 'Title, content, and category are required' },
        { status: 400 }
      );
    }

    // Determine client context for filtering
    let filterClientId = null;
    if (request.user.role === 'client') {
      filterClientId = request.user.clientId;
    } else if (['employee', 'admin'].includes(request.user.role) && request.user.activeClientId) {
      filterClientId = request.user.activeClientId;
    }

    if (!filterClientId) {
        return NextResponse.json({ error: 'Could not determine client context for update.' }, { status: 403 });
    }

    // Fetch existing blog to check ownership and title
    const { data: existingBlog, error: fetchError } = await supabase
        .from('wehoware_blogs')
        .select('title, slug, client_id')
        .eq('id', id)
        .single();

    if (fetchError || !existingBlog) {
        return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    // Verify client ownership based on role
    if (String(existingBlog.client_id) !== String(filterClientId)) {
        return NextResponse.json({ error: 'Unauthorized to update this blog' }, { status: 403 });
    }

    // Prepare update data
    const updateData = {
      title,
      content,
      category_id,
      status: status || 'draft',
      thumbnail,
      updated_at: new Date().toISOString(),
      updated_by: request.user.id
    };

    // Check if title changed and update slug if necessary
    if (title !== existingBlog.title) {
        try {
          // Pass the per-request client to the helper
          updateData.slug = await generateUniqueSlug(supabase, title, filterClientId, existingBlog.slug);
        } catch (slugError) {
          console.error('Slug generation failed during update:', slugError);
          return NextResponse.json({ error: 'Could not generate unique slug for the title.' }, { status: 500 });
        }
    }
    
    // Build and execute update query using the per-request client
    const { data, error } = await supabase
      .from('wehoware_blogs')
      .update(updateData)
      .eq('id', id)
      .eq('client_id', filterClientId) // Ensure we only update if client matches
      .select();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Although we filter, Supabase update might return empty if RLS prevents it
    // But our explicit client_id check should catch ownership issues earlier.
    // Still, good practice to check the result.
    if (!data || data.length === 0) {
      // This case might indicate an unexpected issue if previous checks passed
      console.warn(`Update for blog ${id} returned no data despite prior checks.`);
      return NextResponse.json({ error: 'Blog not found or update failed unexpectedly' }, { status: 404 });
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
    const supabase = createRouteHandlerClient({ cookies }); // Create client here
    const { id } = params;

    // Determine client context for filtering deletion
    let filterClientId = null;
    if (request.user.role === 'client') {
        // Clients shouldn't delete blogs via API directly? Or only their own?
        // For now, restricting delete to admin role via allowedRoles.
        // If clients/employees could delete, we'd use request.user.clientId here.
        // filterClientId = request.user.clientId; 
    } else if (['employee', 'admin'].includes(request.user.role) && request.user.activeClientId) {
        filterClientId = request.user.activeClientId;
    } 
    
    // Since only admin is allowed by middleware, check if they have context
    if (!filterClientId && request.user.role === 'admin') {
        // Admin might be operating without a specific client context? 
        // How should deletion work? For now, require active client context for safety.
        // Alternative: allow admin to delete any blog if filterClientId is null.
        // Let's require context for now.
         return NextResponse.json({ error: 'Admin must have an active client context set to delete a blog.' }, { status: 400 });
    }

    // Check if the blog exists and belongs to the client context *before* deleting
    const { data: existingBlog, error: fetchError } = await supabase
      .from('wehoware_blogs')
      .select('id')
      .eq('id', id)
      .eq('client_id', filterClientId) // Check ownership against active context
      .single();

    if (fetchError || !existingBlog) {
        return NextResponse.json({ error: 'Blog not found within the active client context or unauthorized' }, { status: 404 });
    }
    
    // Build and execute delete query using the per-request client
    const { error, count } = await supabase
      .from('wehoware_blogs')
      .delete()
      .eq('id', id)
      .eq('client_id', filterClientId); // Redundant check but ensures atomicity
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (count === 0) {
        // This shouldn't happen if the pre-check passed, but good to handle.
        console.warn(`Delete operation for blog ${id} affected 0 rows unexpectedly.`);
        return NextResponse.json({ error: 'Blog not found or delete failed unexpectedly.' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting blog:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}, { allowedRoles: ['admin'] }); // Restricted DELETE to admin only
