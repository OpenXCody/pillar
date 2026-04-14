import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { GitCompare, Check, X, MapPin, Hash, ChevronDown, ChevronUp } from 'lucide-react';

type TabStatus = 'pending' | 'confirmed' | 'rejected';

interface ReviewRecord {
  id: string;
  source: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  naics: string | null;
  registryId: string | null;
}

interface ReviewCandidate {
  id: string;
  recordAId: string;
  recordBId: string;
  matchType: string;
  status: string;
  confidenceScore: number;
  scoreBreakdown: {
    nameScore: number;
    geoScore: number;
    addressScore: number;
    naicsScore: number;
  } | null;
  recordA: ReviewRecord | null;
  recordB: ReviewRecord | null;
}

export default function Review() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [cursor, setCursor] = useState<string | undefined>();
  const [allItems, setAllItems] = useState<ReviewCandidate[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: stats } = useQuery({
    queryKey: ['review', 'stats'],
    queryFn: reviewApi.stats,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['review', 'list', activeTab, cursor],
    queryFn: () => reviewApi.list({ status: activeTab, cursor, limit: 20 }),
  });

  // Accumulate pages for infinite scroll
  const displayItems: ReviewCandidate[] = cursor
    ? [...allItems, ...((data?.data as unknown as ReviewCandidate[]) ?? [])]
    : ((data?.data as unknown as ReviewCandidate[]) ?? []);

  const confirmMutation = useMutation({
    mutationFn: (id: string) => reviewApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => reviewApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] });
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'confirm' | 'reject' }) =>
      reviewApi.batch(ids, action),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['review'] });
    },
  });

  function handleTabChange(tab: TabStatus) {
    setActiveTab(tab);
    setCursor(undefined);
    setAllItems([]);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleLoadMore() {
    if (data?.nextCursor) {
      setAllItems(displayItems);
      setCursor(data.nextCursor);
    }
  }

  const tabCounts: Record<TabStatus, number> = {
    pending: stats?.pending ?? 0,
    confirmed: stats?.confirmed ?? 0,
    rejected: stats?.rejected ?? 0,
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Review Queue</h2>
        <p className="text-sm text-fg-muted mt-1">Potential duplicate factories requiring manual review</p>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-xl p-1">
        {(['pending', 'confirmed', 'rejected'] as TabStatus[]).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab
                ? 'bg-white/10 text-fg-default'
                : 'text-fg-soft hover:text-fg-muted hover:bg-white/[0.03]'
              }
            `}
          >
            {tab === 'pending' ? 'Pending' : tab === 'confirmed' ? 'Confirmed' : 'Rejected'}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-white/10 text-fg-muted' : 'bg-white/5 text-fg-soft'}`}>
              {tabCounts[tab].toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 bg-bg-surface/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-fg-default">{selectedIds.size} selected</span>
          <button
            onClick={() => {
              const pendingIds = displayItems.filter(c => c.status === 'pending').map(c => c.id);
              setSelectedIds(new Set(pendingIds));
            }}
            className="text-xs text-fg-muted hover:text-fg-default transition-colors"
          >Select all visible</button>
          <div className="flex-1" />
          <button
            onClick={() => batchMutation.mutate({ ids: [...selectedIds], action: 'confirm' })}
            disabled={batchMutation.isPending}
            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >Confirm All</button>
          <button
            onClick={() => batchMutation.mutate({ ids: [...selectedIds], action: 'reject' })}
            disabled={batchMutation.isPending}
            className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >Reject All</button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-fg-soft hover:text-fg-muted transition-colors"
          >Clear</button>
        </div>
      )}

      {/* Candidates */}
      <div className="space-y-3">
        {isLoading && displayItems.length === 0 ? (
          <div className="text-center py-12 text-sm text-fg-soft">Loading...</div>
        ) : displayItems.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 text-center">
            <GitCompare className="w-8 h-8 text-fg-soft mx-auto mb-3" />
            <p className="text-sm text-fg-muted">
              {activeTab === 'pending' ? 'No pending matches to review.' : `No ${activeTab} matches.`}
            </p>
          </div>
        ) : (
          displayItems.map((candidate: ReviewCandidate) => {
            const isExpanded = expandedId === candidate.id;
            const a = candidate.recordA;
            const b = candidate.recordB;
            const breakdown = candidate.scoreBreakdown;

            return (
              <div
                key={candidate.id}
                className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden"
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                >
                  {activeTab === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(candidate.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(candidate.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 flex-shrink-0 cursor-pointer accent-indigo-500"
                    />
                  )}
                  <GitCompare className="w-4 h-4 text-fg-soft flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg-default truncate">
                        {a?.name || 'Unknown'} &harr; {b?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-fg-soft">
                      <span>{a?.state || '??'}</span>
                      <span className="capitalize">{candidate.matchType.replace('_', ' ')}</span>
                      {a?.source && b?.source && (
                        <span>
                          {DATA_SOURCES[a.source as keyof typeof DATA_SOURCES]?.name || a.source}
                          {' vs '}
                          {DATA_SOURCES[b.source as keyof typeof DATA_SOURCES]?.name || b.source}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <span className={`text-sm font-bold ${
                        candidate.confidenceScore >= 80 ? 'text-emerald-400' :
                        candidate.confidenceScore >= 60 ? 'text-amber-400' : 'text-fg-muted'
                      }`}>
                        {candidate.confidenceScore}
                      </span>
                      <span className="text-[10px] text-fg-soft ml-0.5">%</span>
                    </div>

                    {/* Actions for pending */}
                    {candidate.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); confirmMutation.mutate(candidate.id); }}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title="Confirm match"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); rejectMutation.mutate(candidate.id); }}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Reject match"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {isExpanded ? <ChevronUp className="w-4 h-4 text-fg-soft" /> : <ChevronDown className="w-4 h-4 text-fg-soft" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-4">
                    {/* Score breakdown */}
                    {breakdown && (
                      <div className="flex items-center gap-4 mb-4">
                        <ScoreBar label="Name" score={breakdown.nameScore} weight={35} />
                        <ScoreBar label="Geo" score={breakdown.geoScore} weight={30} />
                        <ScoreBar label="Address" score={breakdown.addressScore} weight={20} />
                        <ScoreBar label="NAICS" score={breakdown.naicsScore} weight={15} />
                      </div>
                    )}

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <RecordCard record={a} label="Record A" />
                      <RecordCard record={b} label="Record B" />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Load more */}
      {data?.nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-fg-muted hover:text-fg-default hover:bg-white/10 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-fg-soft">{label} ({weight}%)</span>
        <span className="text-[10px] text-fg-muted">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            backgroundColor: score >= 70 ? '#34D399' : score >= 40 ? '#FBBF24' : '#6B7280',
          }}
        />
      </div>
    </div>
  );
}

function RecordCard({ record, label }: { record: ReviewRecord | null; label: string }) {
  if (!record) return <div className="text-xs text-fg-soft">Record not found</div>;
  const sourceInfo = DATA_SOURCES[record.source as keyof typeof DATA_SOURCES];

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sourceInfo?.color || '#888' }} />
        <span className="text-[10px] text-fg-soft font-medium">{sourceInfo?.name || record.source}</span>
        <span className="text-[10px] text-fg-soft ml-auto">{label}</span>
      </div>
      <p className="text-sm font-medium text-fg-default truncate">{record.name || 'Unknown'}</p>
      <div className="space-y-1 text-xs text-fg-muted">
        {record.address && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-indigo-400 flex-shrink-0" />
            <span className="truncate">{[record.address, record.city, record.state, record.zip].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {record.naics && (
          <div className="flex items-center gap-1">
            <Hash className="w-3 h-3 flex-shrink-0" />
            <span>{record.naics}</span>
          </div>
        )}
        {record.registryId && (
          <div className="text-[10px] text-fg-soft">Registry: {record.registryId}</div>
        )}
      </div>
    </div>
  );
}
