'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function getInitials(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

const FeedItem = ({ user, timestamp, children }) => (
  <div className="flex items-start space-x-4 py-4">
    <Avatar className="h-10 w-10">
      <AvatarImage src={user?.avatar_url} alt={user?.first_name} />
      <AvatarFallback>{getInitials(user?.first_name, user?.last_name)}</AvatarFallback>
    </Avatar>
    <div className="flex-1">
      <div className="flex items-center justify-between">
        <p className="font-semibold">
          {user ? `${user.first_name} ${user.last_name}` : 'System'}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </p>
      </div>
      <div className="text-sm text-muted-foreground mt-1">
        {children}
      </div>
    </div>
  </div>
);

const ActivityDetails = ({ activity }) => {
  const { activity_type, details } = activity;
  switch (activity_type) {
    case 'created':
      return <p>Created the task: <span className='font-medium text-primary'>{details.title}</span></p>;
    case 'status_change':
      return <p>Changed status from <span className='font-medium'>{details.from || 'none'}</span> to <span className='font-medium'>{details.to || 'none'}</span></p>;
    case 'priority_change':
      return <p>Changed priority from <span className='font-medium'>{details.from || 'none'}</span> to <span className='font-medium'>{details.to || 'none'}</span></p>;
    case 'assignee_change':
        return <p>Changed the assignee</p>; // Details might be too complex to show simply
    case 'title_change':
        return <p>Changed the title to <span className='font-medium text-primary'>{details.to}</span></p>;
    case 'deleted':
        return <p>Deleted the task: <span className='font-medium text-destructive'>{details.title}</span></p>;
    case 'commented':
        return <p>Added a comment.</p>; // The comment itself is rendered separately
    default:
      return <p>Made an update to the task.</p>;
  }
};

export default function ActivityFeed({ feed }) {
  if (!feed || feed.length === 0) {
    return (
        <div className="text-center py-10 border-dashed border-2 rounded-lg mt-6">
            <p className="text-muted-foreground">No activity yet.</p>
        </div>
    );
  }

  return (
    <Card className="mt-6">
        <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
            {feed.map((item) => (
                <FeedItem key={item.id} user={item.user} timestamp={item.created_at}>
                {item.feed_type === 'comment' ? (
                    <p className='text-primary-foreground bg-slate-950 p-3 rounded-md'>{item.content}</p>
                ) : (
                    <ActivityDetails activity={item} />
                )}
                </FeedItem>
            ))}
        </CardContent>
    </Card>
  );
}
