import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Use the non-public environment variables here
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Ensure you have renamed the variable to SUPABASE_SERVICE_ROLE_KEY in your .env.local
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Error: Supabase URL or Service Role Key is not defined in environment variables.");
  // Optionally, you could throw an error during build or startup
}

// Create a Supabase client configured for server-side admin operations
// NOTE: It's crucial this instance uses the service_role key and is ONLY used server-side.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request) {
  try {
    // 1. Fetch user profiles from the database
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('wehoware_profiles')
      .select('*'); // You might want to add sorting here if needed later

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    // 2. Fetch authentication users using the admin client
    const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      // Check for specific permission errors
      if (authError.status === 401 || authError.status === 403) {
         throw new Error('Authentication Error: Service role key might be invalid or missing permissions.');
      }
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
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

// You can add POST, PUT, DELETE handlers here later for user creation, update, deletion
