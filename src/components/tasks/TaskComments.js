import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const TaskComments = ({ comments = [], onAddComment }) => {
  const [newComment, setNewComment] = useState('');

  const handleSubmitComment = () => {
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment(''); // Clear textarea after submit
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Section */} 
        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <Button onClick={handleSubmitComment} disabled={!newComment.trim()} size="sm">
            Add Comment
          </Button>
        </div>

        <Separator />

        {/* Existing Comments */} 
        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarImage src={comment.user?.avatar_url || ''} alt={(comment.user?.first_name || '') + ' ' + (comment.user?.last_name || '') || '?'} />
                  <AvatarFallback>{comment.user?.first_name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-sm font-medium">{(comment.user?.first_name || '') + ' ' + (comment.user?.last_name || '') || 'Unknown User'}</span>
                    <span className="text-xs text-muted-foreground">
                      {comment.timestamp ? new Date(comment.timestamp).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
                    {comment.text}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-center text-muted-foreground">No comments yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskComments;
