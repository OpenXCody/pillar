import { cn } from '@/lib/utils';

interface BarChartRowProps {
  label: string;
  value: number;
  maxValue: number;
  subtitle?: string;
  secondaryValue?: string;
  onClick?: () => void;
  barColor?: string;
  className?: string;
}

/**
 * Horizontal bar chart row — used across industries, states, companies, etc.
 * Consistent thin bar with label on left, count on right.
 */
export function BarChartRow({
  label,
  value,
  maxValue,
  subtitle,
  secondaryValue,
  onClick,
  barColor = 'rgba(99, 102, 241, 0.35)',
  className,
}: BarChartRowProps) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 transition-colors',
        onClick && 'cursor-pointer hover:bg-white/[0.02]',
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-fg-default truncate">{label}</span>
          {subtitle && <span className="text-[10px] text-fg-soft flex-shrink-0">{subtitle}</span>}
        </div>
        <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-fg-default">{value.toLocaleString()}</div>
        {secondaryValue && <div className="text-[10px] text-fg-soft">{secondaryValue}</div>}
      </div>
    </div>
  );
}
