import { NextResponse } from 'next/server';
// Import the dedicated admin client for auth operations
import supabaseAdmin from '@/lib/supabaseAdmin';

// DELETE handler for /api/v1/users/[userId]
export async function DELETE(request, { params }) {
  const userId = params.userId; // Extract userId from the route parameters

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  console.log(`API Route: Attempting to delete user with ID: ${userId}`);

  try {
    // Add authorization check here if needed: ensure the request comes from an authorized user (admin/employee)
    // Example: Check user role from a session or JWT passed in headers
    // if (!isAuthorized(request)) { // Replace isAuthorized with your actual auth check logic
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    // }

    // Perform the delete operation using the *admin* client
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`API Route Error deleting user ${userId}:`, error);
      // Handle specific errors, e.g., user not found (check Supabase error codes/messages)
      // Supabase might return a specific error code or message for not found users.
      // Adjust this check based on actual Supabase behavior.
      if (error.message.includes('User not found')) { // Example check
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      // No need to specifically check for 401/403 permission errors here anymore,
      // as the admin client *should* have the correct permissions.
      // If an error occurs, it might be a different configuration issue or a standard API error.
      throw new Error(error.message || 'Failed to delete user');
    }

    console.log(`API Route: Successfully deleted user ${userId}`);
    // Return 204 No Content on successful deletion (common practice for DELETE)
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error(`API Error during user deletion (${userId}):`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during deletion';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
