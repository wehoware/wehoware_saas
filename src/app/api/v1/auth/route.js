// src/app/api/v1/auth/route.js

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Helper: create a Supabase SSR client with proper cookie handling
const createSupabaseInstance = async () => {
  const cookieStore = await cookies(); // ✅ await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Ignore errors in read-only contexts or if headers are already sent
          }
        },
        // Adding deprecated methods to potentially satisfy Supabase SSR checks/warnings
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
};

// — LOGIN —
export async function POST(request) {
  const supabase = await createSupabaseInstance(); // ✅ await here
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  // Sign in and get a **verified** user and session
  const {
    data: { user, session },
    error: authError,
  } = await supabase.auth.signInWithPassword({ email, password });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 });
  }

  // Fetch your own profiles table
  const { data: profileData, error: profileError } = await supabase
    .from("wehoware_profiles")
    .select("id, first_name, last_name, role, client_id, avatar_url")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching user profile:", profileError);
  }

  // Build accessibleClients + clientDetails as before...
  let accessibleClients = [];
  if (profileData?.role && ["employee", "admin", "client"].includes(profileData.role)) {
    const { data: clientsData, error: clientsError } = await supabase
      .from("wehoware_user_clients")
      .select(
        "client_id, is_primary, wehoware_clients(id,company_name,domain,website)"
      )
      .eq("user_id", user.id);

    if (!clientsError && clientsData) {
      accessibleClients = clientsData.map((c) => ({
        id: c.wehoware_clients.id,
        name: c.wehoware_clients.company_name,
        domain: c.wehoware_clients.domain,
        website: c.wehoware_clients.website,
        isPrimary: c.is_primary,
      }));
    }
  }

  let clientDetails = null;
  if (profileData?.role === "client" && profileData.client_id) {
    const { data: clientData, error: clientError } = await supabase
      .from("wehoware_clients")
      .select("id, company_name, domain, website")
      .eq("id", profileData.client_id)
      .single();

    if (!clientError && clientData) {
      clientDetails = {
        id: clientData.id,
        name: clientData.company_name,
        domain: clientData.domain,
        website: clientData.website,
      };
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: profileData?.role || "unknown",
      firstName: profileData?.first_name || "",
      lastName: profileData?.last_name || "",
      avatarUrl: profileData?.avatar_url || "",
      clientId: profileData?.client_id || null,
      accessibleClients,
      clientDetails,
    },
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
    },
  });
}

// — LOGOUT —
export async function DELETE(request) {
  const supabase = await createSupabaseInstance(); // ✅ await here
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// — GET CURRENT USER & SESSION —
export async function GET(request) {
  const supabase = await createSupabaseInstance(); // ✅ await here

  // 1) Retrieve session tokens (from your cookie store)
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 401 });
  }

  // 2) Fetch a **verified** user by contacting Supabase Auth
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 401 });
  }

  // If no session or no user, return nulls
  if (!session || !user) {
    return NextResponse.json({ user: null, session: null });
  }

  // 3) Fetch profile data & client info exactly like in POST
  const { data: profileData, error: profileError } = await supabase
    .from("wehoware_profiles")
    .select("id, first_name, last_name, role, client_id, avatar_url")
    .eq("id", user.id)
    .single();
  if (profileError) {
    console.error("Error fetching user profile:", profileError);
  }

  let accessibleClients = [];
  if (profileData?.role && ["employee", "admin", "client"].includes(profileData.role)) {
    const { data: clientsData, error: clientsError } = await supabase
      .from("wehoware_user_clients")
      .select(
        "client_id, is_primary, wehoware_clients(id,company_name,domain,website)"
      )
      .eq("user_id", user.id);

    if (!clientsError && clientsData) {
      accessibleClients = clientsData.map((c) => ({
        id: c.wehoware_clients.id,
        name: c.wehoware_clients.company_name,
        domain: c.wehoware_clients.domain,
        website: c.wehoware_clients.website,
        isPrimary: c.is_primary,
      }));
    }
  }

  let clientDetails = null;
  if (profileData?.role === "client" && profileData.client_id) {
    const { data: clientData, error: clientError } = await supabase
      .from("wehoware_clients")
      .select("id, company_name, domain, website")
      .eq("id", profileData.client_id)
      .single();

    if (!clientError && clientData) {
      clientDetails = {
        id: clientData.id,
        name: clientData.company_name,
        domain: clientData.domain,
        website: clientData.website,
      };
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: profileData?.role || "unknown",
      firstName: profileData?.first_name || "",
      lastName: profileData?.last_name || "",
      avatarUrl: profileData?.avatar_url || "",
      clientId: profileData?.client_id || null,
      accessibleClients,
      clientDetails,
    },
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
    },
  });
}
