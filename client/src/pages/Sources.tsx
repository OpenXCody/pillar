import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourcesApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { RefreshCw, Clock, CheckCircle2, XCircle, Loader2, Shield } from 'lucide-react';

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

  const federalSources = Object.values(DATA_SOURCES).filter(s => s.key !== 'manual');
  const manualSource = DATA_SOURCES.manual;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Data Sources</h2>
        <p className="text-sm text-fg-muted mt-1">Federal and partner datasets powering the pipeline</p>
      </div>

      {/* Federal Sources */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-medium text-fg-muted">Federal Databases</h3>
        </div>
        <div className="space-y-4">
          {federalSources.map(source => {
            const info = data?.sources.find(s => s.key === source.key);
            const lastRun = info?.lastRun;
            const isFetching = fetchMutation.isPending && fetchMutation.variables === source.key;
            const isV2 = source.key === 'osha' || source.key === 'usda_fsis';
            const isActive = source.key === 'epa_echo' || source.key === 'epa_tri';

            return (
              <div key={source.key} className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: source.color }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-medium text-fg-default">{source.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Federal</span>
                        {isV2 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-fg-soft border border-white/10">V2</span>
                        )}
                      </div>
                      <p className="text-xs text-fg-soft mt-0.5">{source.description}</p>
                    </div>
                  </div>
                  {isActive ? (
                    <button
                      onClick={() => fetchMutation.mutate(source.key)}
                      disabled={isFetching}
                      className="flex items-center justify-center gap-2 w-[120px] flex-shrink-0 px-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-full text-xs font-medium text-fg-default hover:bg-white/[0.08] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {isFetching ? 'Verifying...' : 'Re-Verify'}
                    </button>
                  ) : (
                    <span className="flex-shrink-0 px-3 py-1.5 text-xs text-fg-soft border border-white/5 rounded-full">
                      Coming Soon
                    </span>
                  )}
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
                  {!lastRun && !isV2 && <span className="text-fg-soft">Never synced</span>}
                  {isV2 && <span className="text-fg-soft">Not yet integrated</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Partner / Manual Sources */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: manualSource.color + '22' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: manualSource.color }} />
          </div>
          <h3 className="text-sm font-medium text-fg-muted">Partner & Research Data</h3>
        </div>
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: manualSource.color }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium text-fg-default">{manualSource.name}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">Partner</span>
                </div>
                <p className="text-xs text-fg-soft mt-0.5">{manualSource.description}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-6 text-xs text-fg-muted">
            <span>{isLoading ? '...' : `${(data?.sources.find(s => s.key === 'manual')?.rawRecordCount ?? 0).toLocaleString()} records`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
