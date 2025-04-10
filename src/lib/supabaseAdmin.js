import { createClient } from '@supabase/supabase-js';

// Ensure your environment variables are loaded correctly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  // Provide a more helpful error message in the server logs
  console.error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. This key is required for admin operations.");
  throw new Error("Server configuration error: Missing Supabase service role key.");
}

// Create a Supabase client configured for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // It's generally recommended to disable auto-refresh for server-side clients
    // unless you have specific reasons to keep the session alive.
    autoRefreshToken: false,
    persistSession: false,
    // Detect session in server-side code may not be necessary for admin client
    // detectSessionInUrl: false, // Optional: depending on your auth strategy
  },
});

export default supabaseAdmin;
