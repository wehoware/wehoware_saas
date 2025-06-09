import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area'; // Use ScrollArea for long logs

const TaskActivityLog = ({ activities = [] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full pr-4"> {/* Adjust height as needed */}
          <div className="space-y-4">
            {activities.length > 0 ? (
              [...activities].reverse().map((activity) => ( // Show newest first
                <div key={activity.id} className="flex items-center text-sm">
                  <span className="text-muted-foreground w-28 flex-shrink-0">
                     {activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <span className="ml-2">{activity.text}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-center text-muted-foreground">No activity recorded yet.</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TaskActivityLog;
