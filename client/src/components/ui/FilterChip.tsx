import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  icon?: React.ReactNode;
  onRemove: () => void;
  className?: string;
}

/**
 * Removable filter chip — shown when a filter is active.
 */
export function FilterChip({ label, icon, onRemove, className }: FilterChipProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border',
      'bg-white/5 text-fg-muted border-white/10',
      className,
    )}>
      {icon}
      {label}
      <button
        onClick={onRemove}
        className="hover:text-fg-default transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
