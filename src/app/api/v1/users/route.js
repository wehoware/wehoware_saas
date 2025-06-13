import { NextResponse } from 'next/server';
// Import the dedicated admin client for auth operations
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const roles = searchParams.getAll('role'); // Allows for multiple role parameters, e.g., ?role=admin&role=employee

    // 1. Fetch user profiles from the database (using ADMIN client)
    let query = supabaseAdmin
      .from('wehoware_profiles')
      .select('*');

    if (roles.length > 0) {
      query = query.in('role', roles);
    }
    
    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    // 2. Fetch authentication users using the *admin* client
    const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      // No need to check for 401/403 specifically here anymore,
      // as the admin client should have the correct permissions.
      // If an error still occurs, it might be a different issue.
      throw new Error(`Failed to fetch auth users: ${authError.message}`);
    }

    // Handle potential pagination if listUsers returns markers (though unlikely for moderate user counts)
    const authUsers = authUsersData?.users || [];


    // 3. Merge profile and auth details
    const mergedUsers = profiles.map(profile => {
      const authUser = authUsers.find(u => u.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || 'No email found',
        // Add any other relevant fields from authUser if needed
        last_sign_in_at: authUser?.last_sign_in_at,
        created_at_auth: authUser?.created_at, // Differentiate from profile created_at if necessary
      };
    });

    // Return the merged user list
    return NextResponse.json({ users: mergedUsers }, { status: 200 });

  } catch (error) {
    console.error('API Error fetching users:', error);
    // Ensure the error message is passed correctly
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST - Create a new user (Secure implementation)
export async function POST(request) {
  const body = await request.json();

  // Validate required fields
  if (!body.email || !body.password || !body.role) {
    return NextResponse.json({ error: "Email, password, and role are required" }, { status: 400 });
  }

  if (body.role === "client" && (!body.client_ids || body.client_ids.length === 0)) {
    return NextResponse.json({ error: "Client role requires at least one client association" }, { status: 400 });
  }
  if (body.role === "employee" && body.client_ids && body.client_ids.length > 0) {
    return NextResponse.json({ error: "Employee role cannot have client associations during creation" }, { status: 400 });
  }

  let userId = null; // To store the new user's ID for potential cleanup

  try {
    // 1. Create Auth User using Admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Or false if you want email verification
    });

    if (authError) throw new Error(`Auth user creation failed: ${authError.message}`);
    userId = authData.user.id; // Store ID for potential cleanup

    // 2. Create User Profile
    const profileData = {
      id: userId,
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      role: body.role, // Assign role
      client_id: body.role === 'client' ? (body.client_ids[0] || null) : null, // Assign primary client ID only if role is client
    };

    const { error: profileError } = await supabaseAdmin
      .from("wehoware_profiles")
      .insert(profileData);

    if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

    // 3. Create User-Client Associations (only for 'client' role)
    if (body.role === 'client') {
      const clientIdsToAssociate = body.client_ids || []; // Should always have at least one due to validation
      const userClientRows = clientIdsToAssociate.map(clientId => ({
        user_id: userId,
        client_id: clientId,
        is_primary: clientId === profileData.client_id, // Mark the one matching profile as primary
      }));

      const { error: assocError } = await supabaseAdmin
        .from("wehoware_user_clients")
        .insert(userClientRows);

      if (assocError) throw new Error(`User-client association failed: ${assocError.message}`);
    }

    // If all steps succeeded
    return NextResponse.json({ message: "User created successfully", userId: userId });

  } catch (error) {
    console.error("API User Creation Error:", error);

    // Cleanup: Attempt to delete the auth user if created
    if (userId) {
      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteError) {
          console.error(`Failed to clean up auth user ${userId}:`, deleteError);
        } else {
          console.log(`Cleaned up auth user ${userId} due to error.`);
        }
      } catch (cleanupError) {
        console.error(`Error during auth user cleanup for ${userId}:`, cleanupError);
      }
    }

    // Return the specific error message
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
