'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';

export default function CommentForm({ taskId, onCommentAdded }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    const promise = fetch(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to post comment.' }));
        throw new Error(errorData.error);
      }
      return res.json();
    });

    toast.promise(promise, {
      loading: 'Posting comment...',
      success: (newComment) => {
        setContent('');
        if (onCommentAdded) {
          onCommentAdded(newComment);
        }
        return 'Comment posted!';
      },
      error: (err) => err.message || 'Failed to post comment.',
    });

    try {
      await promise;
    } catch (e) {
      // Handled by toast.promise
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        placeholder="Add a comment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isSubmitting}
        rows={3}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !content.trim()}>
          {isSubmitting ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </form>
  );
}
