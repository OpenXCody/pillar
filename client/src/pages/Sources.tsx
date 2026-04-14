import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourcesApi, pipelineApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { Clock, CheckCircle2, XCircle, Loader2, Shield, AlertCircle } from 'lucide-react';

function formatCST(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' CST';
}

export default function Sources() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: sourcesApi.list,
  });

  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: pipelineApi.status,
    refetchInterval: 3000,
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
  const isPipelineRunning = pipelineStatus?.running ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Data Sources</h2>
        <p className="text-sm text-fg-muted mt-1">Federal and partner datasets powering the pipeline</p>
      </div>

      {/* Sync in progress banner */}
      {isPipelineRunning && pipelineStatus?.currentSource && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-emerald-400">
              Syncing {DATA_SOURCES[pipelineStatus.currentSource as keyof typeof DATA_SOURCES]?.name ?? pipelineStatus.currentSource}
            </span>
            {pipelineStatus.elapsedMs && (
              <span className="text-xs text-fg-soft ml-auto">
                {Math.round(pipelineStatus.elapsedMs / 1000)}s elapsed
              </span>
            )}
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${pipelineStatus.stageProgress ?? 0}%` }}
            />
          </div>
          {pipelineStatus.stageLabel && (
            <p className="text-xs text-fg-soft mt-1.5">{pipelineStatus.stageLabel}</p>
          )}
        </div>
      )}

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
            const recordCount = info?.rawRecordCount ?? 0;
            const isSyncing = isPipelineRunning && pipelineStatus?.currentSource === source.key;
            const isV2 = source.key === 'osha' || source.key === 'usda_fsis';
            const isActive = source.key === 'epa_echo' || source.key === 'epa_tri';
            const isSynced = recordCount > 0 && lastRun?.status === 'completed';

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
                  {isSyncing ? (
                    <span className="flex items-center gap-2 flex-shrink-0 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-medium text-emerald-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...
                    </span>
                  ) : isActive ? (
                    isSynced ? (
                      <button
                        onClick={() => fetchMutation.mutate(source.key)}
                        disabled={isPipelineRunning}
                        className="flex items-center justify-center gap-2 flex-shrink-0 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Synced
                      </button>
                    ) : (
                      <button
                        onClick={() => fetchMutation.mutate(source.key)}
                        disabled={isPipelineRunning}
                        className="flex items-center justify-center gap-2 flex-shrink-0 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <AlertCircle className="w-3.5 h-3.5" /> Update Ready
                      </button>
                    )
                  ) : (
                    <span className="flex-shrink-0 px-3 py-1.5 text-xs text-fg-soft border border-white/5 rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-6 text-xs text-fg-muted">
                  <span>{isLoading ? '...' : `${recordCount.toLocaleString()} records`}</span>
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
                        Last synced: {formatCST(lastRun.startedAt)}
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
