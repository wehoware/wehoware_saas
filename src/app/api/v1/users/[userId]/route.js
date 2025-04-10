import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Use the non-public environment variables here
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Error: Supabase URL or Service Role Key is not defined in environment variables.");
  // Consider throwing an error during build or startup in production
}

// Create a Supabase client configured for server-side admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// DELETE handler for /api/v1/users/[userId]
export async function DELETE(request, { params }) {
  const userId = params.userId; // Extract userId from the route parameters

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  console.log(`API Route: Attempting to delete user with ID: ${userId}`);

  try {
    // Add authorization check here if needed: ensure the request comes from an authorized user (admin/employee)
    // const { data: { session } } = await request.supabase.auth.getSession(); // Example using middleware-added supabase
    // if (!session || !['admin', 'employee'].includes(session.user?.app_metadata?.role)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    // }

    // Perform the delete operation using the admin client
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`API Route Error deleting user ${userId}:`, error);
       // Handle specific errors, e.g., user not found (might be a 404 or specific error code)
      if (error.status === 404 || error.message.includes('not found')) {
         return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
       // Handle potential permission issues with the service key
      if (error.status === 401 || error.status === 403) {
          return NextResponse.json({ error: 'Authentication Error: Service role key might be invalid or missing permissions.' }, { status: 403 });
       }
      throw new Error(error.message || 'Failed to delete user');
    }

    console.log(`API Route: Successfully deleted user ${userId}`);
    // Return 204 No Content on successful deletion (common practice for DELETE)
    // Or return 200 OK with a success message if preferred
    return new NextResponse(null, { status: 204 }); 
    // return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error(`API Error during user deletion (${userId}):`, error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred during deletion' }, { status: 500 });
  }
}
