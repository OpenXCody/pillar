import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const SIDE_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <span className={cn('relative group/tip', className)}>
      {children}
      <span className={cn(
        'absolute px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap',
        'opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-20',
        SIDE_CLASSES[side],
      )}>
        {content}
      </span>
    </span>
  );
}
