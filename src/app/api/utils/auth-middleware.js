import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabase from '@/lib/supabase';

/**
 * Authentication middleware for API routes
 * Verifies user is authenticated and attaches user info to request context
 * 
 * @param {Function} handler - The API route handler function
 * @param {Object} options - Options for the middleware
 * @param {Array<string>} options.allowedRoles - Roles allowed to access the route ['client', 'employee', 'admin']
 * @returns {Function} - Middleware wrapped handler function
 */
export function withAuth(handler, options = {}) {
  return async (request, context) => {
    try {
      // Get the auth token from the cookies
      const cookieStore = cookies();
      
      // Get session from Supabase auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        return NextResponse.json(
          { error: 'Unauthorized - Not authenticated' },
          { status: 401 }
        );
      }
      
      // Get the user profile with role information
      const { data: profileData, error: profileError } = await supabase
        .from('wehoware_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profileError || !profileData) {
        return NextResponse.json(
          { error: 'Unauthorized - User profile not found' },
          { status: 401 }
        );
      }
      
      // Check if user has allowed role
      if (options.allowedRoles && options.allowedRoles.length > 0) {
        if (!options.allowedRoles.includes(profileData.role)) {
          return NextResponse.json(
            { error: `Unauthorized - Requires one of these roles: ${options.allowedRoles.join(', ')}` },
            { status: 403 }
          );
        }
      }
      
      // Create a modified request with the user info
      const requestWithAuth = new Request(request);
      requestWithAuth.user = {
        id: session.user.id,
        email: session.user.email,
        role: profileData.role,
        clientId: profileData.client_id
      };
      
      // If user is an employee, set the active client from query param if provided
      if (['employee', 'admin'].includes(profileData.role)) {
        const url = new URL(request.url);
        const activeClientId = url.searchParams.get('clientId');
        
        if (activeClientId) {
          // Verify this employee has access to this client
          const { data: clientAccess, error: clientAccessError } = await supabase
            .from('wehoware_user_clients')
            .select('client_id')
            .eq('user_id', session.user.id)
            .eq('client_id', activeClientId)
            .single();
          
          if (!clientAccessError && clientAccess) {
            // Record the client switch in history
            await supabase
              .from('wehoware_client_switch_history')
              .insert({
                user_id: session.user.id,
                client_id: activeClientId,
                ip_address: request.headers.get('x-forwarded-for') || 'unknown',
                user_agent: request.headers.get('user-agent') || 'unknown'
              });
            
            // Set the active client for this request
            requestWithAuth.user.activeClientId = activeClientId;
          }
        }
      }
      
      // Set RLS policies for supabase based on user role
      try {
        if (['employee', 'admin'].includes(profileData.role) && requestWithAuth.user.activeClientId) {
          // For employees with active client, use that client's context
          await supabase.rpc('set_client_context', { client_id: requestWithAuth.user.activeClientId });
        } else if (profileData.role === 'client') {
          // For client users, use their own client_id
          await supabase.rpc('set_client_context', { client_id: profileData.client_id });
        }
        
        // The session token is already being used by the Supabase client
        // No need to manually set it as it's handled by cookies
      } catch (contextError) {
        console.error('Error setting client context:', contextError);
        // Continue anyway as the basic authentication is valid
      }
      
      // Call the actual handler with the enhanced request
      return await handler(requestWithAuth, context);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error in auth middleware' },
        { status: 500 }
      );
    }
  };
}
