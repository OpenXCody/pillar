import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  onClick?: () => void;
  className?: string;
}

/**
 * KPI / stats card — used on dashboards and detail pages.
 * Icon + label on top, large value below.
 */
export function StatsCard({ icon, label, value, onClick, className }: StatsCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/5',
        'hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {icon && (
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className="text-xs text-fg-soft">{label}</span>
        </div>
      )}
      {!icon && <span className="text-xs text-fg-soft mb-3 block">{label}</span>}
      <p className="text-2xl font-semibold text-fg-default">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
