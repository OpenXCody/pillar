import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Empty state placeholder — shown when a list has no results.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      <div className="text-fg-soft mx-auto mb-3 w-fit">{icon}</div>
      <p className="text-sm text-fg-muted">{title}</p>
      {description && <p className="text-xs text-fg-soft mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
