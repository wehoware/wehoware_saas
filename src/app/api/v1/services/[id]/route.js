import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { withAuth } from '../../../utils/auth-middleware';

// GET a single service by ID
async function getServiceById(request, { params }) {
  try {
    const { id } = params;
    
    // Build query with base select
    let query = supabase
      .from('wehoware_services')
      .select(`
        *,
        wehoware_service_categories(id, name, slug)
      `)
      .eq('id', id)
      .single();
    
    // Apply client filtering based on role
    if (request.user.role === 'client') {
      query = query.eq('client_id', request.user.clientId);
    } else if (['employee', 'admin'].includes(request.user.role) && request.user.activeClientId) {
      query = query.eq('client_id', request.user.activeClientId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ service: data });
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update service
async function updateService(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Determine which client_id to use based on role
    let clientId = null;
    if (request.user.role === 'client') {
      clientId = request.user.clientId;
    } else if (['employee', 'admin'].includes(request.user.role)) {
      clientId = request.user.activeClientId || body.client_id;
    }
    
    // Build update query
    let query = supabase
      .from('wehoware_services')
      .update({
        ...body,
        updated_by: request.user.id,
        updated_at: new Date()
      })
      .eq('id', id);
    
    // Apply client filtering based on role
    if (request.user.role === 'client') {
      query = query.eq('client_id', request.user.clientId);
    } else if (clientId) {
      query = query.eq('client_id', clientId);
    }
    
    // Execute update
    const { data, error } = await query.select();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Service not found or unauthorized' }, { status: 404 });
    }
    
    return NextResponse.json({ service: data[0] });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE service
async function deleteService(request, { params }) {
  try {
    const { id } = params;
    
    // Build delete query
    let query = supabase
      .from('wehoware_services')
      .delete()
      .eq('id', id);
    
    // Apply client filtering based on role
    if (request.user.role === 'client') {
      query = query.eq('client_id', request.user.clientId);
    } else if (['employee', 'admin'].includes(request.user.role) && request.user.activeClientId) {
      query = query.eq('client_id', request.user.activeClientId);
    }
    
    // Execute delete
    const { error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Export the handlers with auth middleware
export const GET = withAuth(getServiceById, { allowedRoles: ['client', 'employee', 'admin'] });
export const PUT = withAuth(updateService, { allowedRoles: ['client', 'employee', 'admin'] });
export const DELETE = withAuth(deleteService, { allowedRoles: ['client', 'employee', 'admin'] });
