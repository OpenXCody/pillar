import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { facilitiesApi } from '@/lib/api';
import { Search, Factory, Building2, MapPin, ChevronRight, X } from 'lucide-react';
import { US_STATES } from '@shared/states';
import { INDUSTRY_CATEGORIES } from '@shared/naics';
import type { Facility } from '@shared/types';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { SourceDot } from './Sources';

export default function Facilities() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial filters from URL params (e.g., ?company=Boeing&state=TX)
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') || '');
  const [naicsFilter, setNaicsFilter] = useState(searchParams.get('naics') || '');
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('company') || '');
  const [cursor, setCursor] = useState<string | undefined>();
  const [prevPages, setPrevPages] = useState<Facility[]>([]);

  const hasFilters = !!(search || stateFilter || naicsFilter || companyFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['facilities', { search, state: stateFilter, naics: naicsFilter, company: companyFilter, cursor }],
    queryFn: () => facilitiesApi.list({
      search: search || undefined,
      state: stateFilter || undefined,
      naics: naicsFilter || undefined,
      company: companyFilter || undefined,
      cursor,
      limit: 50,
    }),
  });

  // Fetch total count when filters are active
  const { data: countData } = useQuery({
    queryKey: ['facilities-count', { search, state: stateFilter, naics: naicsFilter, company: companyFilter }],
    queryFn: () => facilitiesApi.count({
      search: search || undefined,
      state: stateFilter || undefined,
      naics: naicsFilter || undefined,
      company: companyFilter || undefined,
    }),
    enabled: hasFilters,
  });

  const displayItems = [...prevPages, ...(data?.data ?? [])];
  const activeFilters = [stateFilter, naicsFilter, companyFilter].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearch(''); setStateFilter(''); setNaicsFilter(''); setCompanyFilter('');
    setCursor(undefined);
    setPrevPages([]);
    setSearchParams({});
  };

  function setFilter(key: string, value: string) {
    setCursor(undefined);
    setPrevPages([]);
    if (key === 'state') setStateFilter(value);
    else if (key === 'naics') setNaicsFilter(value);
    else if (key === 'company') { setCompanyFilter(value); if (!value) setSearchParams({}); }
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
        <h2 className="text-xl font-semibold text-fg-default">Factories</h2>
        <p className="text-sm text-fg-muted mt-1">US manufacturing facilities with location, company, coordinates, and industry classification</p>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-bg-surface/95 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2.5 flex-1 min-w-[280px] max-w-lg">
          <Search className="w-4 h-4 text-fg-soft" />
          <input
            type="text"
            placeholder="Search factories..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCursor(undefined); setPrevPages([]); }}
            className="flex-1 text-sm text-fg-default placeholder:text-fg-soft bg-transparent"
            style={{ outline: 'none', border: 'none' }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setCursor(undefined); setPrevPages([]); }} className="p-0.5 text-fg-soft hover:text-fg-muted">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <SearchableSelect
          options={US_STATES.map(s => ({ value: s.code, label: s.name }))}
          value={stateFilter}
          onChange={v => setFilter('state', v)}
          placeholder="Filter by state..."
          icon={<MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
          accentColor="indigo"
        />

        <SearchableSelect
          options={INDUSTRY_CATEGORIES.map(c => ({ value: c.key, label: c.label }))}
          value={naicsFilter}
          onChange={v => setFilter('naics', v)}
          placeholder="Filter by category..."
          icon={<Factory className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
          accentColor="indigo"
        />
      </div>

      {/* Company filter chip + clear all */}
      {(companyFilter || activeFilters > 1) && (
        <div className="flex items-center gap-2 flex-wrap">
          {companyFilter && (
            <FilterChip
              icon={<Building2 className="w-3 h-3 text-amber-500" />}
              label={companyFilter}
              color="amber"
              onRemove={() => setFilter('company', '')}
            />
          )}
          {activeFilters > 1 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-fg-muted hover:text-fg-default transition-colors"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
      )}

      {/* Results count with total */}
      {displayItems.length > 0 && (
        <p className="text-xs text-fg-soft">
          Showing {displayItems.length.toLocaleString()}
          {hasFilters && countData ? ` of ${countData.count.toLocaleString()}` : ''}
          {' '}factories{data?.nextCursor && !countData ? '+' : ''}
        </p>
      )}

      {/* Facility cards */}
      <div className="space-y-2">
        {isLoading && displayItems.length === 0 ? (
          <div className="text-center py-12 text-sm text-fg-soft">Loading...</div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-12">
            <Factory className="w-10 h-10 text-fg-soft mx-auto mb-3" />
            <p className="text-sm text-fg-muted">No factories found</p>
            <p className="text-xs text-fg-soft mt-1">Run a source fetch to populate data, or adjust your filters.</p>
          </div>
        ) : (
          displayItems.map((f: Facility) => (
            <div
              key={f.id}
              onClick={() => navigate(`/facilities/${f.id}`)}
              className="
                group block p-4
                bg-white/[0.02] backdrop-blur-sm
                border border-white/5 rounded-xl
                hover:bg-white/[0.05] hover:border-white/10
                transition-all duration-200 cursor-pointer
              "
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-sky-400/10 border border-sky-400/20 flex items-center justify-center flex-shrink-0">
                  <Factory className="w-4 h-4 text-sky-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-fg-default truncate">{f.name}</h3>
                    <ChevronRight className="w-4 h-4 text-fg-soft opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {f.companyName && (
                      <span
                        className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg-default transition-colors"
                        onClick={(e) => {
                          if (f.companyId) {
                            e.stopPropagation();
                            navigate(`/companies/${f.companyId}`);
                          }
                        }}
                        role={f.companyId ? 'link' : undefined}
                      >
                        <Building2 className="w-3 h-3 text-fg-soft" />
                        {f.companyName}
                      </span>
                    )}
                    {(f.city || f.state) && (
                      <span className="flex items-center gap-1 text-xs text-fg-muted">
                        <MapPin className="w-3 h-3 text-fg-soft" />
                        {[f.city, f.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: gradient source dots + confidence */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Source dots with tooltips */}
                  <div className="flex items-center gap-1">
                    {(f.sources || []).map((src: string) => (
                      <SourceDot key={src} sourceKey={src} />
                    ))}
                  </div>

                  {/* Confidence with tooltip */}
                  <span className="relative group/tip">
                    <span className={`text-xs font-mono ${f.confidence >= 70 ? 'text-fg-muted' : f.confidence >= 40 ? 'text-amber-400/70' : 'text-fg-soft'}`}>
                      {f.confidence}
                    </span>
                    <span className="absolute bottom-full right-0 mb-1.5 px-2 py-1.5 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">
                      Confidence: {f.confidence >= 70 ? 'High' : f.confidence >= 40 ? 'Medium' : 'Low'} ({f.confidence}/100)<br />
                      {f.sourceCount} source{f.sourceCount !== 1 ? 's' : ''} · {f.latitude ? 'Has coords' : 'No coords'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))
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

function FilterChip({ icon, label, color, onRemove }: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onRemove: () => void;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  };

  return (
    <div className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 ${colorMap[color] || colorMap.indigo}`}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
      <button onClick={onRemove} className="p-0.5 opacity-60 hover:opacity-100">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
