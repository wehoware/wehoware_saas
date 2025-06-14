import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const TaskActivityLog = ({ activities = [] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full pr-4"> {/* Adjust height as needed */}
          <div className="relative pl-6">
            {/* Vertical timeline bar */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
            
            <div className="space-y-6">
              {activities.length > 0 ? (
                activities.map((activity) => ( // Render newest first (no reverse)
                  <div key={activity.id} className="relative flex gap-4">
                    {/* Dot on the timeline */}
                    <div className="absolute left-[-1.625rem] top-1.5 h-4 w-4 rounded-full bg-primary border-4 border-background"></div>
                    
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={activity.user?.avatar_url || ''} alt={(activity.user?.first_name || '')} />
                      <AvatarFallback>{activity.user?.first_name?.charAt(0)?.toUpperCase() || 'S'}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{(activity.user?.first_name || '') + ' ' + (activity.user?.last_name || '')}</span> {activity.text.split(' ').slice(1).join(' ')} {/* Show text without the user's name at the start */}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {activity.created_at ? new Date(activity.created_at).toLocaleString() : ''}
                      </time>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center text-muted-foreground">No activity recorded yet.</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TaskActivityLog;
