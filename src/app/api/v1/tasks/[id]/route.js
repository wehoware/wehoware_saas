import { NextResponse } from 'next/server';
import { withAuth } from '../../../utils/auth-middleware';

// Helper to get a task and authorize
async function getTaskAndAuthorize(request, taskId) {
  const { supabase, user } = request;
  const { data, error } = await supabase
    .from('wehoware_tasks')
    .select(`
      *,
      client:wehoware_clients(id, company_name),
      assignee:wehoware_profiles(id, first_name, last_name, avatar_url)
    `)
    .eq('id', taskId)
    .single();

  if (error || !data) {
    throw new Error('Task not found or failed to fetch.');
  }

  // In a real RLS scenario, the query itself would fail if the user doesn't have access.
  // This is an extra layer of check.
  if (user.role === 'client' && data.client_id !== user.clientId && !user.accessibleClients.some(c => c.id === data.client_id)) {
     throw new Error('Unauthorized');
  }

  return data;
}

export const GET = withAuth(
  async (request, { params }) => {
    try {
      // await the entire params object, then destructure `id`
      const { id } = await params;
      const task = await getTaskAndAuthorize(request, id);
      return NextResponse.json(task);
    } catch (error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      console.error(error);
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
    }
  },
  { allowedRoles: ['admin', 'employee'] }
);

// PUT to update a task
export const PUT = withAuth(async (request, { params }) => {
  const { supabase, user } = request;
  const body = await request.json();
  const { id } = await params;

  let existingTask;
  // Ensure task exists and user is authorized before updating
  try {
    existingTask = await getTaskAndAuthorize(request, id);
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Perform the update
  const { data: updatedTask, error: updateError } = await supabase
    .from('wehoware_tasks')
    .update(body)
    .eq('id', id)
    .select(`
      *,
      client:wehoware_clients(id, company_name),
      assignee:wehoware_profiles(id, first_name, last_name, avatar_url)
    `)
    .single();

  if (updateError) {
    console.error('Error updating task:', updateError);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }

  // Log activities for changes
  const activities = [];
  const fieldsToTrack = ['status', 'priority', 'assignee_id', 'title', 'description', 'due_date'];
  
  fieldsToTrack.forEach(field => {
    if (body.hasOwnProperty(field) && body[field] !== existingTask[field]) {
      activities.push({
        task_id: id,
        user_id: user.id,
        activity_type: `${field}_change`,
        details: { from: existingTask[field], to: body[field] }
      });
    }
  });

  if (activities.length > 0) {
    const { error: activityError } = await supabase.from('wehoware_task_activities').insert(activities);
    if (activityError) {
        // Don't fail the whole request, but log the error
        console.error('Failed to log task activities:', activityError);
    }
  }

  return NextResponse.json(updatedTask);
}, { allowedRoles: ['admin', 'employee'] });

// DELETE a task
export const DELETE = withAuth(async (request, { params }) => {
  const { supabase, user } = request;
  const { id } = await params;

  let existingTask;
  try {
    existingTask = await getTaskAndAuthorize(request, id);
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('wehoware_tasks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }

  // Log deletion
  await supabase.from('wehoware_task_activities').insert({
    task_id: taskId,
    user_id: user.id,
    activity_type: 'deleted',
    details: { title: existingTask.title }
  });

  return NextResponse.json({ success: true }, { status: 200 });
}, { allowedRoles: ['admin', 'employee'] });
