import { NextResponse } from 'next/server';
import { withAuth } from '../../utils/auth-middleware';

// GET list of reports with filtering, sorting, and pagination
export const GET = withAuth(async (request) => {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const filterType = url.searchParams.get('type') || '';
    const filterStatus = url.searchParams.get('status') || '';
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    // Determine client ID based on user role and context
    let queryClientId = null;
    if (request.user.role === 'client') {
      queryClientId = request.user.clientId;
    } else if (['employee', 'admin'].includes(request.user.role) && request.user.activeClientId) {
      queryClientId = request.user.activeClientId;
    } else {
      // If user has no client context (e.g., admin without active client), return error
      return NextResponse.json({ error: 'Unable to determine client context.' }, { status: 400 });
    }

    // Build query using the user-scoped client (RLS will be applied)
    let query = supabase
      .from('wehoware_reports')
      .select('*, created_by:wehoware_profiles!created_by(first_name, last_name)', { count: 'exact' })
      .eq('client_id', queryClientId); // RLS should enforce this anyway, but explicit filter is good practice

    // Apply optional filters
    if (filterType) {
      query = query.eq('type', filterType);
    }
    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching reports:', error);
      return NextResponse.json({ error: 'Failed to fetch reports.' }, { status: 500 });
    }

    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    return NextResponse.json({
      data,
      pagination: {
        totalItems,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Unexpected error fetching reports:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { allowedRoles: ['client', 'employee', 'admin'] });

// POST create a new report
export const POST = withAuth(async (request) => {
  try {
    const { supabase } = request; // Use the Supabase client from middleware
    const body = await request.json();
    const { title, content, type, report_date, status } = body;

    // Validate required fields
    if (!title || !type || !report_date) {
      return NextResponse.json({ error: 'Missing required fields: title, type, report_date' }, { status: 400 });
    }

    // Ensure user has active client context
    if (!request.user.activeClientId) {
        return NextResponse.json({ error: 'Active client context required to create a report.' }, { status: 400 });
    }
    const clientId = request.user.activeClientId;
    const userId = request.user.id;

    // Prepare data for insertion
    const insertData = {
      client_id: clientId,
      title,
      content: content || null, // Content is JSONB, allow null
      type,
      report_date,
      status: status || 'Draft', // Default status
      created_by: userId,
      updated_by: userId,
    };

    // Insert the report using the user-scoped client (RLS will be applied)
    const { data, error } = await supabase
      .from('wehoware_reports')
      .insert(insertData)
      .select()
      .single(); // Expecting one record back after insert

    if (error) {
      console.error('Error creating report:', error);
       // Check for specific errors like foreign key violation if client_id is somehow invalid
      if (error.code === '23503') {
           return NextResponse.json({ error: "Invalid client context for report creation." }, { status: 400 });
      }
      // Handle other potential errors (e.g., RLS)
      return NextResponse.json({ error: `Failed to create report: ${error.message}` }, { status: 500 });
    }

    // Check if insert actually happened (single() returns null if no row inserted, though insert should error if fails)
    if (!data) {
        console.warn(`Insert for report for client ${clientId} returned no data unexpectedly.`);
        return NextResponse.json({ error: 'Report creation failed unexpectedly (check permissions/RLS).' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 }); // Return the newly created report

  } catch (error) {
    console.error('Unexpected error creating report:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { allowedRoles: ['employee', 'admin'] }); // Only employees/admins can create reports
