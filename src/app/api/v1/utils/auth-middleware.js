import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export function withAuth(handler, options = {}) {
  return async (request, context) => {
    // Parse options
    const allowedRoles = options.allowedRoles || ['client', 'employee', 'admin'];
    
    // Create a per-request Supabase client (avoids session leakage)
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('Auth middleware: No valid session found');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get user profile from database to check role
    const { data: profile, error: profileError } = await supabase
      .from('wehoware_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profileError || !profile) {
      console.error('Auth middleware: Profile not found for authenticated user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }
    
    // Check if user role is allowed
    if (!allowedRoles.includes(profile.role)) {
      console.error(`Auth middleware: User role ${profile.role} not allowed. Allowed roles: ${allowedRoles.join(', ')}`);
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    // If user role is client, ensure client_id is set
    if (profile.role === 'client' && !profile.client_id) {
      console.error('Auth middleware: Client user without client_id');
      return NextResponse.json(
        { error: 'Client association not found' },
        { status: 403 }
      );
    }
    
    // For employees, check for activeClientId in request headers
    const activeClientId = request.headers.get('x-active-client-id');
    
    // Add user data to request for downstream handlers
    request.user = {
      id: session.user.id,
      email: session.user.email,
      role: profile.role,
      clientId: profile.client_id,
      activeClientId: activeClientId || null,
    };
    
    // Continue to handler
    return handler(request, context);
  };
}
