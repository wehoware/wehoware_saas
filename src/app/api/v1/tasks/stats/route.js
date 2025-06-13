import { NextResponse } from 'next/server';
import { withAuth } from '../../../utils/auth-middleware';

// GET task statistics
export const GET = withAuth(async (request) => {
  const { supabase, user } = request;

  // Only admins and employees can see stats
  if (!['admin', 'employee'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const commonQuery = supabase.from('wehoware_tasks');

    const queries = [
      commonQuery.select('*', { count: 'exact', head: true }),
      commonQuery.select('*', { count: 'exact', head: true }).eq('status', 'To Do'),
      commonQuery.select('*', { count: 'exact', head: true }).eq('status', 'In Progress'),
      commonQuery.select('*', { count: 'exact', head: true }).eq('status', 'Done'),
    ];

    const [total, todo, inProgress, done] = await Promise.all(queries);

    const stats = {
      total: total.count || 0,
      todo: todo.count || 0,
      inProgress: inProgress.count || 0,
      done: done.count || 0,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching task stats:', error);
    return NextResponse.json({ error: 'Failed to fetch task statistics' }, { status: 500 });
  }
}, { allowedRoles: ['admin', 'employee'] });
