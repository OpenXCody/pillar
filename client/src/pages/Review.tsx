import { useQuery } from '@tanstack/react-query';
import { reviewApi } from '@/lib/api';
import { GitCompare } from 'lucide-react';

export default function Review() {
  const { data: stats } = useQuery({
    queryKey: ['review', 'stats'],
    queryFn: reviewApi.stats,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Review Queue</h2>
        <p className="text-sm text-fg-muted mt-1">Potential duplicate facilities requiring manual review</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="px-3 py-1 bg-bg-surface border border-border-subtle rounded-full text-xs text-fg-muted">
          Pending: {stats?.pending ?? 0}
        </span>
        <span className="px-3 py-1 bg-bg-surface border border-border-subtle rounded-full text-xs text-fg-muted">
          Confirmed: {stats?.confirmed ?? 0}
        </span>
        <span className="px-3 py-1 bg-bg-surface border border-border-subtle rounded-full text-xs text-fg-muted">
          Rejected: {stats?.rejected ?? 0}
        </span>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-xl p-8 text-center">
        <GitCompare className="w-8 h-8 text-fg-soft mx-auto mb-3" />
        <p className="text-sm text-fg-muted">No match candidates to review yet.</p>
        <p className="text-xs text-fg-soft mt-1">Run the matching pipeline after fetching data from sources.</p>
      </div>
    </div>
  );
}
