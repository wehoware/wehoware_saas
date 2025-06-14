import { NextResponse } from 'next/server';
import { withAuth } from '../../utils/auth-middleware';

// GET a list of tasks with sorting, filtering, and pagination
export const GET = withAuth(async (request) => {
  const { supabase, user } = request;
  const { searchParams } = new URL(request.url);

  // Pagination
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const rangeFrom = (page - 1) * limit;
  const rangeTo = rangeFrom + limit - 1;

  // Sorting
  const sortField = searchParams.get('sortField') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Filtering
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const searchQuery = searchParams.get('q'); // 'q' is used by some conventions for general search
  const assigneeFilter = searchParams.get('assignee_id'); // For assignee filter

  let query = supabase
    .from('wehoware_tasks')
    .select(`
      *,
      client:wehoware_clients(id, company_name),
      assignee:wehoware_profiles(id, first_name, last_name, avatar_url)
    `, { count: 'exact' });

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }
  if (priority) {
    query = query.eq('priority', priority);
  }
  // Apply role-based filtering and assignee filter
  if (user.role === 'employee') {
    // Employees ONLY see tasks assigned to them. Ignore any assigneeFilter from query params.
    query = query.eq('assignee_id', user.id);
  } else if (user.role === 'admin' && assigneeFilter) {
    // Admins can filter by a specific assignee_id if provided
    query = query.eq('assignee_id', assigneeFilter);
  }
  // If user is admin and no assigneeFilter is provided, all tasks (matching other filters) are returned.

  if (searchQuery) {
    // Example: searching in title OR description. Adjust as needed.
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
  }

  // Apply sorting
  if (sortField === 'clientName') {
    query = query.order('company_name', { referencedTable: 'wehoware_clients', ascending: sortOrder === 'asc' });
  } else {
    query = query.order(sortField, { ascending: sortOrder === 'asc' });
  }

  // Apply pagination
  query = query.range(rangeFrom, rangeTo);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }

  return NextResponse.json({ 
    tasks: data,
    total: count,
    page,
    limit
  });
});

// POST to create a new task
export const POST = withAuth(async (request) => {
  const { supabase, user } = request;
  const body = await request.json();

  const { title, description, due_date, priority, status, client_id, assignee_id } = body;

  if (!title || !client_id) {
    return NextResponse.json({ error: 'Title and Client are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('wehoware_tasks')
    .insert({
      title,
      description,
      due_date,
      priority,
      status,
      client_id,
      assignee_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }

  // Log the creation activity
  await supabase.from('wehoware_task_activities').insert({
    task_id: data.id,
    user_id: user.id,
    activity_type: 'created',
    details: { title: data.title }
  });

  return NextResponse.json(data, { status: 201 });
}, { allowedRoles: ['admin', 'employee'] });
