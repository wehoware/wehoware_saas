import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { cookies } from "next/headers";

// Login endpoint
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    // Get user profile with role information
    const { data: profileData, error: profileError } = await supabase
      .from("wehoware_profiles")
      .select("id, first_name, last_name, role, client_id, avatar_url")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      // Continue anyway as the user is authenticated, just might not have a complete profile
    }

    // For employees, fetch list of accessible clients
    let accessibleClients = [];
    if (profileData && ["employee", "admin"].includes(profileData.role)) {
      const { data: clientsData, error: clientsError } = await supabase
        .from("wehoware_user_clients")
        .select(
          "client_id, is_primary, wehoware_clients(id, company_name, domain, website)"
        )
        .eq("user_id", authData.user.id);

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

    // For client users, get client details
    let clientDetails = null;
    if (profileData && profileData.role === "client" && profileData.client_id) {
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

    // Store session in cookie (handled automatically by Supabase)
    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profileData?.role || "unknown",
        firstName: profileData?.first_name || "",
        lastName: profileData?.last_name || "",
        avatarUrl: profileData?.avatar_url || "",
        clientId: profileData?.client_id || null,
        accessibleClients: accessibleClients,
        clientDetails: clientDetails,
      },
      session: {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresAt: authData.session.expires_at,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}

// Logout endpoint
export async function DELETE(request) {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during logout" },
      { status: 500 }
    );
  }
}

// Get current user session
export async function GET(request) {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.session) {
      return NextResponse.json({ user: null, session: null }, { status: 200 });
    }

    // Get user profile with role information
    const { data: profileData, error: profileError } = await supabase
      .from("wehoware_profiles")
      .select("id, first_name, last_name, role, client_id, avatar_url")
      .eq("id", data.session.user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      // Continue anyway as the user is authenticated
    }

    // For employees, fetch list of accessible clients
    let accessibleClients = [];
    if (profileData && ["employee", "admin"].includes(profileData.role)) {
      const { data: clientsData, error: clientsError } = await supabase
        .from("wehoware_user_clients")
        .select(
          "client_id, is_primary, wehoware_clients(id, company_name, domain, website)"
        )
        .eq("user_id", data.session.user.id);

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

    // For client users, get client details
    let clientDetails = null;
    if (profileData && profileData.role === "client" && profileData.client_id) {
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
      user: data.session
        ? {
            id: data.session.user.id,
            email: data.session.user.email,
            role: profileData?.role || "unknown",
            firstName: profileData?.first_name || "",
            lastName: profileData?.last_name || "",
            avatarUrl: profileData?.avatar_url || "",
            clientId: profileData?.client_id || null,
            accessibleClients: accessibleClients,
            clientDetails: clientDetails,
          }
        : null,
      session: data.session
        ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at,
          }
        : null,
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while checking session" },
      { status: 500 }
    );
  }
}
