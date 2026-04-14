import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { companiesApi } from '@/lib/api';
import { Search, Building2, Factory, X } from 'lucide-react';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return String(n);
}

export default function Companies() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { search, cursor }],
    queryFn: () => companiesApi.list({
      search: search || undefined,
      cursor,
      limit: 50,
    }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Companies</h2>
        <p className="text-sm text-fg-muted mt-1">Parent companies resolved from factory data</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-bg-surface/95 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2.5 flex-1 min-w-[280px] max-w-lg">
          <Search className="w-4 h-4 text-fg-soft" />
          <input
            type="text"
            placeholder="Search companies..."
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
      </div>

      {/* Results count */}
      {data && (
        <p className="text-xs text-fg-soft">
          Showing {data.data.length} companies{data.nextCursor ? '+' : ''}
        </p>
      )}

      {/* Company cards */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-fg-soft">Loading...</div>
        ) : !data?.data.length ? (
          <div className="text-center py-12">
            <Building2 className="w-10 h-10 text-fg-soft mx-auto mb-3" />
            <p className="text-sm text-fg-muted">No companies found</p>
            <p className="text-xs text-fg-soft mt-1">Companies are resolved from factory data during pipeline runs.</p>
          </div>
        ) : (
          data.data.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`/facilities?company=${encodeURIComponent(c.name)}`)}
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
                  <h3 className="text-sm font-medium text-fg-default truncate">{c.name}</h3>
                  <p className="text-xs text-fg-muted mt-1 truncate">{c.sector || 'Manufacturing'}</p>
                </div>

                {/* Facility count */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Factory className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs text-fg-muted">{formatCount(c.facilityCount)}</span>
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
