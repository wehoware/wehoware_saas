import { NextResponse } from 'next/server';
import { withAuth } from '../../../../utils/auth-middleware';

// POST a new comment to a task
export const POST = withAuth(async (request, { params }) => {
  const { supabase, user } = request;
  const { content } = await request.json();
  const { id: taskId } = params;

  if (!content) {
    return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
  }

  // Insert the comment
  const { data: comment, error: commentError } = await supabase
    .from('wehoware_task_comments')
    .insert({
      task_id: taskId,
      user_id: user.id,
      content,
    })
    .select()
    .single();

  if (commentError) {
    console.error('Error creating comment:', commentError);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }

  // Also log this as a task activity
  await supabase.from('wehoware_task_activities').insert({
    task_id: taskId,
    user_id: user.id,
    activity_type: 'commented',
    details: { comment_id: comment.id }
  });

  return NextResponse.json(comment, { status: 201 });

}, { allowedRoles: ['admin', 'employee'] });
