import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { companiesApi } from '@/lib/api';
import { Search, Building2, Factory, X, ShieldCheck, AlertCircle, Ban } from 'lucide-react';
import type { Company } from '@shared/types';
import { getCategoryLabel } from '@shared/naics';

const STATUS_CONFIG = {
  verified: { label: 'Verified', color: 'text-emerald-400', icon: ShieldCheck },
  unverified: { label: 'Needs Review', color: 'text-amber-400', icon: AlertCircle },
  rejected: { label: 'Rejected', color: 'text-red-400', icon: Ban },
} as const;

export default function Companies() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [cursor, setCursor] = useState<string | undefined>();
  const [prevPages, setPrevPages] = useState<Company[]>([]);

  const { data: stats } = useQuery({
    queryKey: ['company-stats'],
    queryFn: () => companiesApi.stats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { search, cursor }],
    queryFn: () => companiesApi.list({
      search: search || undefined,
      cursor,
      limit: 50,
    }),
  });

  const displayItems = [...prevPages, ...(data?.data ?? [])];
  const totalCompanies = stats ? stats.verified + stats.unverified + stats.rejected : 0;

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
          {totalCompanies > 0 ? `${totalCompanies.toLocaleString()} parent companies` : 'Parent companies'} resolved from factory data
        </p>
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
            className="flex-1 text-sm text-fg-default placeholder:text-fg-soft bg-transparent outline-none"
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
          Showing {displayItems.length.toLocaleString()} of {totalCompanies.toLocaleString()} companies
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
          </div>
        ) : (
          displayItems.map((c: Company) => {
            const statusCfg = STATUS_CONFIG[c.status || 'unverified'];
            const StatusIcon = statusCfg.icon;
            let tickerBadge: string | null = null;
            try {
              const nv = c.nameVariants ? (typeof c.nameVariants === 'string' ? JSON.parse(c.nameVariants) : c.nameVariants) : null;
              if (nv?.ticker) tickerBadge = nv.ticker;
            } catch { /* ignore */ }

            return (
              <div
                key={c.id}
                onClick={() => navigate(`/companies/${c.id}`)}
                className="group block p-4 bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-amber-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-fg-default truncate">{c.name}</h3>
                      <span className="relative group/tip flex-shrink-0">
                        <StatusIcon className={`w-3.5 h-3.5 ${statusCfg.color}`} />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">{statusCfg.label}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-fg-muted truncate">{c.sector || getCategoryLabel(null)}</span>
                      {tickerBadge && (
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded flex-shrink-0">
                          {tickerBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-fg-muted flex-shrink-0">
                    <Factory className="w-3.5 h-3.5 text-fg-soft" />
                    {c.facilityCount.toLocaleString()}
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
