import { DATA_SOURCES } from '@shared/types';
import { Tooltip } from './Tooltip';
import { cn } from '@/lib/utils';

interface SourceDotProps {
  sourceKey: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Gradient dot identifying a data source — with tooltip showing source name.
 * Used on facility cards, source pages, and detail views.
 */
export function SourceDot({ sourceKey, size = 'sm', className }: SourceDotProps) {
  const source = DATA_SOURCES[sourceKey as keyof typeof DATA_SOURCES];
  if (!source) return null;
  const px = size === 'md' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  return (
    <Tooltip content={source.name}>
      <span
        className={cn(px, 'rounded-full block flex-shrink-0', className)}
        style={{ background: source.gradient }}
      />
    </Tooltip>
  );
}
