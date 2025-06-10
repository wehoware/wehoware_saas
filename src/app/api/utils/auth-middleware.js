import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function withAuth(handler, options = {}) {
  return async (request, context) => {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
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

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        return NextResponse.json(
          { error: 'Unauthorized - Not authenticated' },
          { status: 401 }
        );
      }

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

      if (options.allowedRoles && options.allowedRoles.length > 0) {
        if (!options.allowedRoles.includes(profileData.role)) {
          return NextResponse.json(
            { error: `Unauthorized - Requires one of these roles: ${options.allowedRoles.join(', ')}` },
            { status: 403 }
          );
        }
      }

      const requestWithAuth = new Request(request);
      // Attach the per-request Supabase client and user info to the request object
      requestWithAuth.supabase = supabase;
      requestWithAuth.user = {
        id: session.user.id,
        email: session.user.email,
        role: profileData.role,
        clientId: profileData.client_id
      };

      if (['employee', 'admin', 'client'].includes(profileData.role)) {
        const url = new URL(request.url);
        const activeClientId = url.searchParams.get('clientId');
        
        if (activeClientId) {
          const { data: clientAccess, error: clientAccessError } = await supabase
            .from('wehoware_user_clients')
            .select('client_id')
            .eq('user_id', session.user.id)
            .eq('client_id', activeClientId)
            .single();
          
          if (!clientAccessError && clientAccess) {
            await supabase
              .from('wehoware_client_switch_history')
              .insert({
                user_id: session.user.id,
                client_id: activeClientId,
                ip_address: request.headers.get('x-forwarded-for') || 'unknown',
                user_agent: request.headers.get('user-agent') || 'unknown'
              });
            
            requestWithAuth.user.activeClientId = activeClientId;
          }
        }
      }

      try {
        if (requestWithAuth.user.activeClientId) { // Prioritize activeClientId if set (applies to all roles that can switch)
          await supabase.rpc('set_client_context', { client_id: requestWithAuth.user.activeClientId });
        } else if (profileData.role === 'client' && profileData.client_id) { // Fallback for client role to their primary client_id
          await supabase.rpc('set_client_context', { client_id: profileData.client_id });
        }
      } catch (contextError) {
        console.error('Error setting client context:', contextError);
      }

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

