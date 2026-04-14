import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourcesApi, pipelineApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { useState } from 'react';
import { CheckCircle2, Loader2, Download, FileText, X } from 'lucide-react';

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

  const envSources = Object.values(DATA_SOURCES).filter(s => s.key === 'epa_echo' || s.key === 'epa_tri');
  const industrySources = Object.values(DATA_SOURCES).filter(s => s.key === 'faa' || s.key === 'nhtsa' || s.key === 'sam_gov' || s.key === 'sec_edgar');
  const statisticalSources = Object.values(DATA_SOURCES).filter(s => s.key === 'census_cbp');
  const v2Sources = Object.values(DATA_SOURCES).filter(s => s.key === 'osha' || s.key === 'usda_fsis');
  const manualSource = DATA_SOURCES.manual;
  const isPipelineRunning = pipelineStatus?.running ?? false;
  const activeSources = ['epa_echo', 'epa_tri', 'faa', 'nhtsa', 'sam_gov', 'sec_edgar', 'census_cbp', 'osha', 'usda_fsis'];

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

      {/* Environmental Sources */}
      <SourceGroup
        title="Environmental & Compliance"

        sources={envSources}
        activeSources={activeSources}
        data={data}
        isLoading={isLoading}
        isPipelineRunning={isPipelineRunning}
        pipelineStatus={pipelineStatus}
        fetchMutation={fetchMutation}
      />

      {/* Industry-Specific Sources */}
      <SourceGroup
        title="Industry & Transportation"

        sources={industrySources}
        activeSources={activeSources}
        data={data}
        isLoading={isLoading}
        isPipelineRunning={isPipelineRunning}
        pipelineStatus={pipelineStatus}
        fetchMutation={fetchMutation}
      />

      {/* Statistical / Economic Sources */}
      <SourceGroup
        title="Statistical & Economic"

        sources={statisticalSources}
        activeSources={activeSources}
        data={data}
        isLoading={isLoading}
        isPipelineRunning={isPipelineRunning}
        pipelineStatus={pipelineStatus}
        fetchMutation={fetchMutation}
      />

      {/* Workforce & Safety Sources */}
      <SourceGroup
        title="Workforce & Safety"

        sources={v2Sources}
        activeSources={activeSources}
        data={data}
        isLoading={isLoading}
        isPipelineRunning={isPipelineRunning}
        pipelineStatus={pipelineStatus}
        fetchMutation={fetchMutation}
      />

      {/* Partner Data */}
      <div>
        <h3 className="text-sm font-medium text-fg-muted mb-2">Partner Data</h3>
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-fg-default">{manualSource.name}</h3>
            <p className="text-xs text-fg-soft mt-0.5">{manualSource.description}</p>
          </div>
          <div className="mt-2 text-xs text-fg-soft">
            {isLoading ? '...' : `${(data?.sources.find(s => s.key === 'manual')?.rawRecordCount ?? 0).toLocaleString()} records`}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Guidance for sources that need manual data files or have known issues */
const SOURCE_HELP: Record<string, string> = {
  faa: 'Place faa_pah.csv in downloads/ folder — export from drs.faa.gov',
  sam_gov: 'Needs SAM_GOV_API_KEY in .env — register at sam.gov/data-services',
  sec_edgar: 'SEC rate-limits requests — retry or wait a few minutes',
  osha: 'Place osha_inspections.csv in downloads/ — from enforcedata.dol.gov',
  usda_fsis: 'Place fsis_directory.csv in downloads/ — from fsis.usda.gov',
  census_cbp: 'Census API can be slow — retry if it times out',
};

/** Reusable source group component */
function SourceGroup({ title, sources, activeSources, data, isLoading, isPipelineRunning, pipelineStatus, fetchMutation }: {
  title: string;
  sources: (typeof DATA_SOURCES)[keyof typeof DATA_SOURCES][];
  activeSources: string[];
  data: { sources: Array<{ key: string; lastRun: import('@shared/types').SourceRun | null; rawRecordCount: number }> } | undefined;
  isLoading: boolean;
  isPipelineRunning: boolean;
  pipelineStatus: { running: boolean; currentSource: string | null; stageProgress: number; stageLabel: string | null; elapsedMs: number | null } | undefined;
  fetchMutation: { mutate: (source: string) => void };
}) {
  const [reportOpen, setReportOpen] = useState<string | null>(null);

  return (
    <div>
      <h3 className="text-sm font-medium text-fg-muted mb-2">{title}</h3>
      <div className="space-y-2">
        {sources.map(source => {
          const info = data?.sources.find(s => s.key === source.key);
          const lastRun = info?.lastRun;
          const recordCount = info?.rawRecordCount ?? 0;
          const isSyncing = isPipelineRunning && pipelineStatus?.currentSource === source.key;
          const isActive = activeSources.includes(source.key);
          const isSynced = recordCount > 0 && lastRun?.status === 'completed';
          const isFailed = lastRun?.status === 'failed' || (lastRun?.status === 'completed' && recordCount === 0 && lastRun.totalFetched === 0);
          const helpText = isFailed ? SOURCE_HELP[source.key] : null;
          const showReport = reportOpen === source.key;

          return (
            <div key={source.key} className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: source.color }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-fg-default">{source.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-fg-soft border border-white/5">Federal</span>
                    </div>
                    <p className="text-xs text-fg-soft mt-0.5">{source.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Last report button */}
                  {lastRun && lastRun.status === 'completed' && lastRun.totalFetched > 0 && (
                    <button
                      onClick={() => setReportOpen(showReport ? null : source.key)}
                      className="relative group/tip p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-fg-soft" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">Last sync report</span>
                    </button>
                  )}
                  {/* Sync status / action */}
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : isActive ? (
                    isSynced ? (
                      <button
                        onClick={() => {
                          if (window.confirm(`Re-sync ${source.name}?`)) {
                            fetchMutation.mutate(source.key);
                          }
                        }}
                        disabled={isPipelineRunning}
                        className="relative group/tip disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">Synced — click to re-sync</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => fetchMutation.mutate(source.key)}
                        disabled={isPipelineRunning}
                        className="relative group/tip disabled:opacity-40"
                      >
                        <Download className="w-4 h-4 text-amber-400" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">Sync now</span>
                      </button>
                    )
                  ) : null}
                </div>
              </div>

              {/* Metadata row — plain gray, no status icons */}
              <div className="mt-2 flex items-center gap-4 text-xs text-fg-soft">
                <span>{isLoading ? '...' : `${recordCount.toLocaleString()} records`}</span>
                {lastRun && (
                  <span>Last synced {formatCST(lastRun.startedAt)}</span>
                )}
                {!lastRun && <span>Never synced</span>}
              </div>

              {/* Help text for sources that need manual data or have issues */}
              {helpText && (
                <p className="mt-2 text-xs text-fg-soft italic">{helpText}</p>
              )}

              {/* Sync report popover */}
              {showReport && lastRun && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-fg-muted">Sync Report — {formatCST(lastRun.startedAt)}</span>
                    <button onClick={() => setReportOpen(null)} className="p-0.5 hover:bg-white/5 rounded">
                      <X className="w-3 h-3 text-fg-soft" />
                    </button>
                  </div>
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
                  {lastRun.durationMs && (
                    <div className="mt-2 text-[10px] text-fg-soft text-center">Completed in {(lastRun.durationMs / 1000).toFixed(1)}s</div>
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
