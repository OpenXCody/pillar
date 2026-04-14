import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourcesApi, pipelineApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { useState } from 'react';
import { CheckCircle2, Loader2, ChevronDown, UserCircle } from 'lucide-react';

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

/** Sources that need human action (file upload or API key) */
const REQUIRES_HUMAN: Set<string> = new Set(['faa', 'sam_gov', 'osha', 'usda_fsis']);

/** Detailed guidance per source */
const SOURCE_HELP: Record<string, string> = {
  faa: 'Export CSV from drs.faa.gov/browse/DRSP0002 and place as downloads/faa_pah.csv',
  sam_gov: 'Add SAM_GOV_API_KEY to your .env file — register at sam.gov/data-services',
  sec_edgar: 'SEC rate-limits automated requests. Retry in a few minutes.',
  osha: 'Download inspection CSV from enforcedata.dol.gov and place as downloads/osha_inspections.csv',
  usda_fsis: 'Download MPI Directory CSV from fsis.usda.gov and place as downloads/fsis_directory.csv',
  census_cbp: 'Census API can be slow on first load — retry if it times out.',
};

// SourceDot is now in components/ui/SourceDot.tsx
import { SourceDot } from '@/components/ui';

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

  const envSources = Object.values(DATA_SOURCES).filter(s => s.key === 'epa_echo' || s.key === 'epa_tri');
  const industrySources = Object.values(DATA_SOURCES).filter(s => s.key === 'faa' || s.key === 'nhtsa' || s.key === 'sam_gov' || s.key === 'sec_edgar');
  const statisticalSources = Object.values(DATA_SOURCES).filter(s => s.key === 'census_cbp');
  const v2Sources = Object.values(DATA_SOURCES).filter(s => s.key === 'osha' || s.key === 'usda_fsis');
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

      <SourceGroup title="Environmental & Compliance" sources={envSources} data={data} isLoading={isLoading} isPipelineRunning={isPipelineRunning} pipelineStatus={pipelineStatus} fetchMutation={fetchMutation} />
      <SourceGroup title="Industry & Transportation" sources={industrySources} data={data} isLoading={isLoading} isPipelineRunning={isPipelineRunning} pipelineStatus={pipelineStatus} fetchMutation={fetchMutation} />
      <SourceGroup title="Statistical & Economic" sources={statisticalSources} data={data} isLoading={isLoading} isPipelineRunning={isPipelineRunning} pipelineStatus={pipelineStatus} fetchMutation={fetchMutation} />
      <SourceGroup title="Workforce & Safety" sources={v2Sources} data={data} isLoading={isLoading} isPipelineRunning={isPipelineRunning} pipelineStatus={pipelineStatus} fetchMutation={fetchMutation} />

      {/* Partner Data */}
      <div>
        <h3 className="text-sm font-medium text-fg-muted mb-2">Partner Data</h3>
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-3 min-w-0">
            <SourceDot sourceKey="manual" />
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-fg-default">{manualSource.name}</h3>
              <p className="text-xs text-fg-soft mt-0.5">{manualSource.description}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-fg-soft">
            {isLoading ? '...' : `${(data?.sources.find(s => s.key === 'manual')?.rawRecordCount ?? 0).toLocaleString()} records`}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceGroup({ title, sources, data, isLoading, isPipelineRunning, pipelineStatus, fetchMutation }: {
  title: string;
  sources: (typeof DATA_SOURCES)[keyof typeof DATA_SOURCES][];
  data: { sources: Array<{ key: string; lastRun: import('@shared/types').SourceRun | null; rawRecordCount: number }> } | undefined;
  isLoading: boolean;
  isPipelineRunning: boolean;
  pipelineStatus: { running: boolean; currentSource: string | null; stageProgress: number; stageLabel: string | null; elapsedMs: number | null } | undefined;
  fetchMutation: { mutate: (source: string) => void };
}) {
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null);

  return (
    <div>
      <h3 className="text-sm font-medium text-fg-muted mb-2">{title}</h3>
      <div className="space-y-2">
        {sources.map(source => {
          const info = data?.sources.find(s => s.key === source.key);
          const lastRun = info?.lastRun;
          const recordCount = info?.rawRecordCount ?? 0;
          const isSyncing = isPipelineRunning && pipelineStatus?.currentSource === source.key;
          const isSynced = recordCount > 0 && lastRun?.status === 'completed';
          const needsHuman = REQUIRES_HUMAN.has(source.key) && recordCount === 0;
          const hasDetails = lastRun || needsHuman;
          const showDetails = detailsOpen === source.key;

          return (
            <div key={source.key} className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <SourceDot sourceKey={source.key} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-fg-default">{source.name}</h3>
                    <p className="text-xs text-fg-soft mt-0.5">{source.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Status icon */}
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : isSynced ? (
                    <button
                      onClick={() => {
                        if (window.confirm(`Re-sync ${source.name}?`)) fetchMutation.mutate(source.key);
                      }}
                      disabled={isPipelineRunning}
                      className="relative group/tip disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">Synced — click to re-sync</span>
                    </button>
                  ) : needsHuman ? (
                    <span className="relative group/tip">
                      <UserCircle className="w-4 h-4 text-fg-soft" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">Requires human action</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => fetchMutation.mutate(source.key)}
                      disabled={isPipelineRunning}
                      className="relative group/tip disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-4 h-4 text-fg-soft" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">Sync now</span>
                    </button>
                  )}

                  {/* Details toggle */}
                  {hasDetails && (
                    <button
                      onClick={() => setDetailsOpen(showDetails ? null : source.key)}
                      className="p-0.5 hover:bg-white/5 rounded transition-colors"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 text-fg-soft transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Record count */}
              <div className="mt-2 text-xs text-fg-muted">
                {isLoading ? '...' : `${recordCount.toLocaleString()} records`}
              </div>

              {/* Details dropdown */}
              {showDetails && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                  {/* Timestamp */}
                  {lastRun && (
                    <div className="text-xs text-fg-soft">
                      Last synced: {formatCST(lastRun.startedAt)}
                      {lastRun.durationMs ? ` (${(lastRun.durationMs / 1000).toFixed(1)}s)` : ''}
                    </div>
                  )}

                  {/* Sync stats */}
                  {lastRun && lastRun.totalFetched > 0 && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-sm font-semibold text-fg-default">{lastRun.totalFetched.toLocaleString()}</div>
                        <div className="text-[10px] text-fg-soft">Fetched</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-fg-default">{lastRun.newRecords.toLocaleString()}</div>
                        <div className="text-[10px] text-fg-soft">New</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-fg-default">{lastRun.matchesFound.toLocaleString()}</div>
                        <div className="text-[10px] text-fg-soft">Matches</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-fg-default">{lastRun.goldenRecordsCreated.toLocaleString()}</div>
                        <div className="text-[10px] text-fg-soft">Golden</div>
                      </div>
                    </div>
                  )}

                  {/* Help / requirements for human-action sources */}
                  {SOURCE_HELP[source.key] && (
                    <div className="text-xs text-fg-soft bg-white/[0.02] rounded-lg p-3">
                      {SOURCE_HELP[source.key]}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
