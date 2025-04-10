"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminPageHeader({ 
  title, 
  description, 
  actionLabel, 
  actionIcon, 
  onAction, 
  actionDisabled,
  backLink,
  backIcon
}) {
  return (
    <div className="flex flex-col pb-6 mb-6 border-b border-gray-200">
      {backLink && (
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={backLink}>
              {backIcon && <span className="mr-2">{backIcon}</span>}
              Back
            </Link>
          </Button>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
        
        {actionLabel && onAction && (
          <Button 
            className="mt-4 sm:mt-0"
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionIcon && <span className="mr-2">{actionIcon}</span>}
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
