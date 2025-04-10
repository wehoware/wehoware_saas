import { NextResponse } from 'next/server';
// Import the regular supabase client for profile fetching
import supabase from '@/lib/supabase'; 
// Import the dedicated admin client for auth operations
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function GET(request) {
  try {
    // 1. Fetch user profiles from the database (using regular client)
    const { data: profiles, error: profilesError } = await supabase
      .from('wehoware_profiles')
      .select('*'); // You might want to add sorting here if needed later

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

// You can add POST, PUT, DELETE handlers here later for user creation, update, deletion
