import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourcesApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { Play, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function Sources() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: sourcesApi.list,
  });

  const fetchMutation = useMutation({
    mutationFn: (source: string) => sourcesApi.fetch(source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Data Sources</h2>
        <p className="text-sm text-fg-muted mt-1">Federal facility databases powering the pipeline</p>
      </div>

      <div className="space-y-4">
        {Object.values(DATA_SOURCES).filter(s => s.key !== 'manual').map(source => {
          const info = data?.sources.find(s => s.key === source.key);
          const lastRun = info?.lastRun;
          const isFetching = fetchMutation.isPending && fetchMutation.variables === source.key;

          return (
            <div key={source.key} className="bg-bg-surface border border-border-subtle rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: source.color }} />
                  <div className="min-w-0">
                    <h3 className="text-base font-medium text-fg-default">{source.name}</h3>
                    <p className="text-xs text-fg-soft mt-0.5">{source.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => fetchMutation.mutate(source.key)}
                  disabled={isFetching}
                  className="flex items-center justify-center gap-2 w-[110px] flex-shrink-0 px-3 py-1.5 bg-bg-elevated border border-border-subtle rounded-full text-xs font-medium text-fg-default hover:bg-bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {isFetching ? 'Fetching...' : 'Fetch Now'}
                </button>
              </div>

              <div className="mt-4 flex items-center gap-6 text-xs text-fg-muted">
                <span>{isLoading ? '...' : `${(info?.rawRecordCount ?? 0).toLocaleString()} records`}</span>
                {lastRun && (
                  <>
                    <span className="flex items-center gap-1">
                      {lastRun.status === 'completed' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ) : lastRun.status === 'failed' ? (
                        <XCircle className="w-3 h-3 text-red-500" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      Last run: {new Date(lastRun.startedAt).toLocaleDateString()}
                    </span>
                    {lastRun.durationMs && (
                      <span>{(lastRun.durationMs / 1000).toFixed(1)}s</span>
                    )}
                  </>
                )}
                {!lastRun && <span className="text-fg-soft">Never synced</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
