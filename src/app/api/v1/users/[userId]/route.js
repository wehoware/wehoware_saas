import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

// GET handler for /api/v1/users/[userId]
export async function GET(request, { params }) {
  const userId = params.userId;

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    // 1. Fetch user profile from the database using ADMIN client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('wehoware_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    // 2. Fetch authentication user details using admin client
    const { data: authUserData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError) {
      throw new Error(`Failed to fetch auth user: ${authError.message}`);
    }

    const authUser = authUserData?.user;

    // 3. Fetch user's client associations using ADMIN client
    const { data: userClients, error: clientsError } = await supabaseAdmin
      .from('wehoware_user_clients')
      .select('client_id, is_primary')
      .eq('user_id', userId);

    if (clientsError) {
      console.error('Error fetching user client associations:', clientsError);
    }

    // 4. Merge all user data
    const userData = {
      ...profile,
      email: authUser?.email || 'No email found',
      last_sign_in_at: authUser?.last_sign_in_at,
      created_at_auth: authUser?.created_at,
      client_ids: userClients?.map(c => c.client_id) || [],
      primary_client_id: userClients?.find(c => c.is_primary)?.client_id || profile.client_id
    };

    return NextResponse.json({ user: userData }, { status: 200 });

  } catch (error) {
    console.error(`API Error fetching user (${userId}):`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PUT handler for /api/v1/users/[userId]
export async function PUT(request, { params }) {
  const userId = params.userId;
  const body = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    // Begin a transaction for multi-table updates
    const updates = [];

    // 1. Update profile data if provided
    if (body.first_name !== undefined || body.last_name !== undefined || body.role !== undefined) {
      const profileUpdates = {};
      
      if (body.first_name !== undefined) profileUpdates.first_name = body.first_name;
      if (body.last_name !== undefined) profileUpdates.last_name = body.last_name;
      if (body.role !== undefined) profileUpdates.role = body.role;
      
      // Include updated_at timestamp
      profileUpdates.updated_at = new Date();

      const { error: profileError } = await supabaseAdmin
        .from('wehoware_profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profileError) {
        throw new Error(`Profile update failed: ${profileError.message}`);
      }
      
      updates.push('profile');
    }

    // 2. Update email via auth admin if provided
    if (body.email) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { email: body.email }
      );

      if (emailError) {
        throw new Error(`Email update failed: ${emailError.message}`);
      }
      
      updates.push('email');
    }

    // 3. Update password if provided
    if (body.password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: body.password }
      );

      if (passwordError) {
        throw new Error(`Password update failed: ${passwordError.message}`);
      }
      
      updates.push('password');
    }

    // 4. Handle client associations if role is 'client' and client_ids are provided
    if (body.role === 'client' && body.client_ids) {
      // First, delete existing associations
      const { error: deleteError } = await supabaseAdmin
        .from('wehoware_user_clients')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(`Failed to update client associations: ${deleteError.message}`);
      }

      // Then create new associations
      if (body.client_ids.length > 0) {
        const primaryClientId = body.primary_client_id || body.client_ids[0];
        
        const userClientRows = body.client_ids.map(clientId => ({
          user_id: userId,
          client_id: clientId,
          is_primary: clientId === primaryClientId
        }));

        const { error: insertError } = await supabaseAdmin
          .from('wehoware_user_clients')
          .insert(userClientRows);

        if (insertError) {
          throw new Error(`Failed to create client associations: ${insertError.message}`);
        }
        
        // Update the primary client_id in profile
        const { error: primaryError } = await supabaseAdmin
          .from('wehoware_profiles')
          .update({ client_id: primaryClientId })
          .eq('id', userId);

        if (primaryError) {
          throw new Error(`Failed to update primary client: ${primaryError.message}`);
        }
      }
      
      updates.push('client_associations');
    }

    // Return success with list of updated components
    return NextResponse.json({ 
      message: `User updated successfully`, 
      userId,
      updates
    }, { status: 200 });

  } catch (error) {
    console.error(`API Error updating user (${userId}):`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

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
