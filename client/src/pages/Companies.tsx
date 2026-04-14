import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { companiesApi } from '@/lib/api';
import { Search, Building2, Factory, X, ShieldCheck, AlertCircle, Ban } from 'lucide-react';
import type { CompanyStatus, Company } from '@shared/types';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const STATUS_CONFIG: Record<CompanyStatus, { label: string; color: string; bg: string; border: string; icon: typeof ShieldCheck }> = {
  verified: {
    label: 'Verified',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: ShieldCheck,
  },
  unverified: {
    label: 'Unverified',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: AlertCircle,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: Ban,
  },
};

type TabKey = 'all' | CompanyStatus;

export default function Companies() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<TabKey>('verified');
  // Accumulate pages so "Load More" appends instead of replacing
  const [prevPages, setPrevPages] = useState<Company[]>([]);

  const { data: stats } = useQuery({
    queryKey: ['company-stats'],
    queryFn: () => companiesApi.stats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { search, cursor, status: activeTab }],
    queryFn: () => companiesApi.list({
      search: search || undefined,
      status: activeTab === 'all' ? undefined : activeTab,
      cursor,
      limit: 50,
    }),
  });

  // Combine previously loaded pages with current page
  const displayItems = [...prevPages, ...(data?.data ?? [])];
  const totalCompanies = stats ? stats.verified + stats.unverified + stats.rejected : 0;

  const tabs: { key: TabKey; label: string; count: number | null }[] = [
    { key: 'verified', label: 'Verified', count: stats?.verified ?? null },
    { key: 'unverified', label: 'Needs Review', count: stats?.unverified ?? null },
    { key: 'all', label: 'All', count: totalCompanies || null },
  ];

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    setCursor(undefined);
    setPrevPages([]);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setCursor(undefined);
    setPrevPages([]);
  }

  const handleLoadMore = useCallback(() => {
    if (data?.nextCursor) {
      setPrevPages(displayItems);
      setCursor(data.nextCursor);
    }
  }, [data, displayItems]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Companies</h2>
        <p className="text-sm text-fg-muted mt-1">
          Parent companies resolved from factory data — verified when linked to factories
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.key
                ? 'bg-white/10 text-fg-default'
                : 'text-fg-soft hover:text-fg-muted hover:bg-white/[0.03]'
              }
            `}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`
                text-[11px] px-1.5 py-0.5 rounded-full
                ${activeTab === tab.key ? 'bg-white/10 text-fg-muted' : 'bg-white/5 text-fg-soft'}
              `}>
                {formatCount(tab.count)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-bg-surface/95 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2.5 flex-1 min-w-[280px] max-w-lg">
          <Search className="w-4 h-4 text-fg-soft" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="flex-1 text-sm text-fg-default placeholder:text-fg-soft bg-transparent"
            style={{ outline: 'none', border: 'none' }}
          />
          {search && (
            <button onClick={() => handleSearch('')} className="p-0.5 text-fg-soft hover:text-fg-muted">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {displayItems.length > 0 && (
        <p className="text-xs text-fg-soft">
          Showing {displayItems.length} companies{data?.nextCursor ? '+' : ''}
        </p>
      )}

      {/* Company cards */}
      <div className="space-y-2">
        {isLoading && displayItems.length === 0 ? (
          <div className="text-center py-12 text-sm text-fg-soft">Loading...</div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-10 h-10 text-fg-soft mx-auto mb-3" />
            <p className="text-sm text-fg-muted">No companies found</p>
            <p className="text-xs text-fg-soft mt-1">
              {activeTab === 'unverified'
                ? 'All companies have been reviewed or have factory ties.'
                : 'Companies are resolved from factory data during pipeline runs.'}
            </p>
          </div>
        ) : (
          displayItems.map((c: Company) => {
            const statusCfg = STATUS_CONFIG[c.status || 'unverified'];
            const StatusIcon = statusCfg.icon;
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/companies/${c.id}`)}
                className="
                  group block p-4
                  bg-white/[0.02] backdrop-blur-sm
                  border border-white/5 rounded-xl
                  hover:bg-white/[0.05] hover:border-white/10
                  transition-all duration-200 cursor-pointer
                "
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-amber-500" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-fg-default truncate">{c.name}</h3>
                      {/* Status badge */}
                      <span className={`
                        inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0
                        ${statusCfg.bg} ${statusCfg.border} border ${statusCfg.color}
                      `}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted mt-1 truncate">{c.sector || 'Manufacturing'}</p>
                  </div>

                  {/* Factory count */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Factory className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs text-fg-muted">{formatCount(c.facilityCount)}</span>
                  </div>
                </div>
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
