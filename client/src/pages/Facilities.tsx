import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { facilitiesApi } from '@/lib/api';
import { Search, Factory, Building2, MapPin, ChevronRight, Hash, X } from 'lucide-react';
import { US_STATES } from '@shared/states';
import { MANUFACTURING_SUBSECTORS } from '@shared/naics';
import { DATA_SOURCES } from '@shared/types';

export default function Facilities() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial filters from URL params (e.g., ?company=Boeing)
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') || '');
  const [naicsFilter, setNaicsFilter] = useState(searchParams.get('naics') || '');
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('company') || '');
  const [cursor, setCursor] = useState<string | undefined>();

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

  const activeFilters = [stateFilter, naicsFilter, companyFilter].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearch(''); setStateFilter(''); setNaicsFilter(''); setCompanyFilter('');
    setCursor(undefined);
    setSearchParams({});
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Factories</h2>
        <p className="text-sm text-fg-muted mt-1">Golden records — deduplicated US manufacturing factories</p>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-bg-surface/95 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2.5 flex-1 min-w-[280px] max-w-lg">
          <Search className="w-4 h-4 text-fg-soft" />
          <input
            type="text"
            placeholder="Search factories or companies..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCursor(undefined); }}
            className="flex-1 text-sm text-fg-default placeholder:text-fg-soft bg-transparent"
            style={{ outline: 'none', border: 'none' }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setCursor(undefined); }} className="p-0.5 text-fg-soft hover:text-fg-muted">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={stateFilter}
          onChange={e => { setStateFilter(e.target.value); setCursor(undefined); }}
          className="bg-bg-surface border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-fg-default appearance-none cursor-pointer"
        >
          <option value="">All States</option>
          {US_STATES.map(s => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>

        <select
          value={naicsFilter}
          onChange={e => { setNaicsFilter(e.target.value); setCursor(undefined); }}
          className="bg-bg-surface border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-fg-default appearance-none cursor-pointer"
        >
          <option value="">All Industries</option>
          {MANUFACTURING_SUBSECTORS.map(s => (
            <option key={s.code} value={s.code}>{s.code} - {s.title}</option>
          ))}
        </select>

        {companyFilter && (
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Building2 className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-amber-400 font-medium">{companyFilter}</span>
            <button
              onClick={() => { setCompanyFilter(''); setCursor(undefined); setSearchParams({}); }}
              className="p-0.5 text-amber-500/60 hover:text-amber-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {activeFilters > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-fg-muted hover:text-fg-default transition-colors"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      {data && (
        <p className="text-xs text-fg-soft">
          Showing {data.data.length} factories{data.nextCursor ? '+' : ''}
        </p>
      )}

      {/* Facility cards */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-fg-soft">Loading...</div>
        ) : !data?.data.length ? (
          <div className="text-center py-12">
            <Factory className="w-10 h-10 text-fg-soft mx-auto mb-3" />
            <p className="text-sm text-fg-muted">No factories found</p>
            <p className="text-xs text-fg-soft mt-1">Run a source fetch to populate data, or adjust your filters.</p>
          </div>
        ) : (
          data.data.map(f => (
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
                      <span className="flex items-center gap-1 text-xs text-fg-muted">
                        <Building2 className="w-3 h-3 text-amber-500" />
                        {f.companyName}
                      </span>
                    )}
                    {(f.city || f.state) && (
                      <span className="flex items-center gap-1 text-xs text-fg-muted">
                        <MapPin className="w-3 h-3 text-indigo-500" />
                        {[f.city, f.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {f.primaryNaics && (
                      <span className="flex items-center gap-1 text-xs text-fg-soft">
                        <Hash className="w-3 h-3" />
                        {f.primaryNaics}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Source count badge */}
                  <div className="flex items-center gap-1">
                    {(f.sources || []).map((src: string) => {
                      const sourceInfo = DATA_SOURCES[src as keyof typeof DATA_SOURCES];
                      return sourceInfo ? (
                        <div
                          key={src}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: sourceInfo.color }}
                          title={sourceInfo.name}
                        />
                      ) : null;
                    })}
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-10 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${f.confidence}%`,
                          backgroundColor: f.confidence >= 70 ? '#34D399' : f.confidence >= 40 ? '#FBBF24' : '#6B7280',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-fg-soft w-5">{f.confidence}</span>
                  </div>
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
            onClick={() => setCursor(data.nextCursor!)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-fg-muted hover:text-fg-default hover:bg-white/10 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
