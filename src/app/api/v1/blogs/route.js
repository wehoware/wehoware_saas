import { NextResponse } from 'next/server';
import { withAuth } from '../../utils/auth-middleware';

// Helper function to generate a unique slug
// Accepts the supabase client instance as the first argument
async function generateUniqueSlug(supabase, title, clientId) {
  let slug = title
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text

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
      // Potentially throw an error or return a generic slug error
      throw new Error('Failed to verify slug uniqueness');
    }

    if (!data) {
      // Slug is unique
      break;
    }

    // Slug exists, append counter and try again
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }

  return uniqueSlug;
}

// GET all blogs with pagination and filtering
export const GET = withAuth(async (request) => {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const userRole = request.user.role;
    const userClientId = request.user.clientId; // For client role
    const activeClientId = request.user.activeClientId; // For employee/admin role

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
    
    // Build query using the per-request client
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
    
    // --- Updated Client Filtering Logic ---
    // Add client filter based on user role
    if (userRole === 'client') {
      if (!userClientId) {
        return NextResponse.json({ error: 'Client association not found.' }, { status: 403 });
      }
      query = query.eq('client_id', userClientId);
    } else if (userRole === 'employee' || userRole === 'admin') {
      if (!activeClientId) {
        // Employees/Admins must have an active client context to view blogs
        return NextResponse.json({ error: 'Active client context required.' }, { status: 400 });
      }
      query = query.eq('client_id', activeClientId);
    } else {
      // Should not happen due to withAuth, but safety check
      return NextResponse.json({ error: 'Unauthorized role.' }, { status: 403 });
    }
    // --- End of Updated Client Filtering Logic ---
    
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
    const { supabase } = request; // Use the Supabase client from middleware
    const body = await request.json();
    
    // Validate required fields
    const { title, content, category_id, status, thumbnail } = body;
    
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

    if (!client_id) {
        return NextResponse.json({ error: 'Could not determine client context for blog creation.' }, { status: 400 });
    }

    // Generate unique slug using the per-request client
    const slug = await generateUniqueSlug(supabase, title, client_id);
    
    // Prepare blog data
    const blogData = {
      title,
      slug,
      content,
      category_id,
      status: status || 'draft',
      thumbnail,
      client_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: request.user.id,
      updated_by: request.user.id
    };
    
    // Insert blog using the per-request client
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
