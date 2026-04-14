import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  X,
  Factory,
  Building2,
  Database,
  GitCompare,
  MapPin,
  Clock,
  Layers,
  Loader2,
} from 'lucide-react';
import { facilitiesApi, companiesApi } from '@/lib/api';
import { INDUSTRY_CATEGORIES } from '@shared/naics';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

type SearchEntityType = 'facilities' | 'companies' | 'categories';

interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  name: string;
  subtitle: string | null;
  meta: string | null;
}

const ENTITY_CONFIG: Record<
  SearchEntityType,
  { icon: React.ElementType; label: string; iconClass: string }
> = {
  facilities: {
    icon: Factory,
    label: 'Factory',
    iconClass: 'text-sky-400',
  },
  companies: {
    icon: Building2,
    label: 'Company',
    iconClass: 'text-amber-500',
  },
  categories: {
    icon: Layers,
    label: 'Category',
    iconClass: 'text-indigo-400',
  },
};

const QUICK_LINKS = [
  { label: 'Browse all factories', path: '/facilities', icon: Factory, iconClass: 'text-sky-400' },
  { label: 'Browse companies', path: '/companies', icon: Building2, iconClass: 'text-amber-500' },
  { label: 'View data sources', path: '/sources', icon: Database, iconClass: 'text-emerald-400' },
  { label: 'Review duplicates', path: '/review', icon: GitCompare, iconClass: 'text-violet-400' },
];

const RECENT_SEARCHES_KEY = 'pillar_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)); } catch { setRecentSearches([]); }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search facilities
  const { data: facilityResults, isLoading: facilitiesLoading } = useQuery({
    queryKey: ['search', 'facilities', debouncedQuery],
    queryFn: () => facilitiesApi.list({ search: debouncedQuery, limit: 8 }),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30000,
  });

  // Search companies
  const { data: companyResults, isLoading: companiesLoading } = useQuery({
    queryKey: ['search', 'companies', debouncedQuery],
    queryFn: () => companiesApi.list({ search: debouncedQuery, limit: 5 }),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30000,
  });

  const isLoading = facilitiesLoading || companiesLoading;

  // Match industry categories client-side (instant, no API call)
  const categoryMatches = useMemo(() => {
    if (debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    return INDUSTRY_CATEGORIES.filter(c =>
      c.label.toLowerCase().includes(q) || c.key.includes(q)
    ).slice(0, 3);
  }, [debouncedQuery]);

  const flatResults = useMemo((): SearchResultItem[] => {
    const items: SearchResultItem[] = [];

    // Categories first (instant match)
    for (const cat of categoryMatches) {
      items.push({
        id: `cat_${cat.key}`,
        type: 'categories',
        name: cat.label,
        subtitle: `${cat.naicsPrefixes.length} NAICS groups`,
        meta: null,
      });
    }

    // Companies next (fewer, higher signal)
    if (companyResults?.data) {
      for (const c of companyResults.data) {
        items.push({
          id: c.id,
          type: 'companies',
          name: c.name,
          subtitle: c.sector || 'Manufacturing',
          meta: `${c.facilityCount} ${c.facilityCount === 1 ? 'factory' : 'factories'}`,
        });
      }
    }

    // Then facilities
    if (facilityResults?.data) {
      for (const f of facilityResults.data) {
        items.push({
          id: f.id,
          type: 'facilities',
          name: f.name,
          subtitle: f.companyName || null,
          meta: [f.city, f.state].filter(Boolean).join(', ') || null,
        });
      }
    }

    return items;
  }, [facilityResults, companyResults, categoryMatches]);

  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== searchQuery);
      const updated = [searchQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((searchQuery: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== searchQuery);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    setRecentSearches([]);
  }, []);

  const navigateToResult = useCallback((item: SearchResultItem) => {
    saveRecentSearch(query);
    onClose();
    if (item.type === 'categories') {
      const catKey = item.id.replace('cat_', '');
      navigate(`/facilities?naics=${catKey}`);
    } else if (item.type === 'companies') {
      navigate(`/companies/${item.id}`);
    } else {
      navigate(`/facilities/${item.id}`);
    }
  }, [navigate, onClose, query, saveRecentSearch]);

  const navigateToQuickLink = useCallback((path: string) => {
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) navigateToResult(flatResults[selectedIndex]);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatResults, selectedIndex, onClose, navigateToResult]);

  useEffect(() => { setSelectedIndex(0); }, [facilityResults, companyResults]);

  if (!isOpen) return null;

  const hasQuery = debouncedQuery.length >= 1;
  const hasResults = flatResults.length > 0;
  const showNoResults = hasQuery && !isLoading && !hasResults;

  // Group results by type for section headers
  const categoryCount = flatResults.filter(r => r.type === 'categories').length;
  const companyCount = flatResults.filter(r => r.type === 'companies').length;
  const facilityCount = flatResults.filter(r => r.type === 'facilities').length;

  let resultIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-[600px]">
        <div
          className="overflow-hidden rounded-xl bg-bg-surface/95 backdrop-blur-xl border border-white/10 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <Search className="w-5 h-5 text-fg-soft flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search factories and companies..."
              className="flex-1 bg-transparent text-fg-default placeholder:text-fg-soft text-base"
              style={{ outline: 'none', border: 'none', boxShadow: 'none', WebkitAppearance: 'none' }}
            />
            {isLoading && <Loader2 className="w-4 h-4 text-fg-soft animate-spin" />}
            {query && !isLoading && (
              <button onClick={() => setQuery('')} className="p-1 text-fg-soft hover:text-fg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 text-xs text-fg-soft border border-white/10">
              esc
            </kbd>
          </div>

          {/* Content */}
          <div className="max-h-[50vh] overflow-y-auto">
            {/* Recent searches */}
            {!hasQuery && recentSearches.length > 0 && (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-fg-soft uppercase tracking-wider">Recent Searches</h4>
                  <button onClick={clearRecentSearches} className="text-xs text-fg-soft hover:text-fg-muted transition-colors">Clear all</button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map(search => (
                    <div key={search} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer group" onClick={() => setQuery(search)}>
                      <Clock className="w-4 h-4 text-fg-soft" />
                      <span className="flex-1 text-sm text-fg-muted">{search}</span>
                      <button onClick={e => { e.stopPropagation(); removeRecentSearch(search); }} className="p-1 opacity-0 group-hover:opacity-100 text-fg-soft hover:text-fg-muted transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            {!hasQuery && (
              <div className="px-4 py-3 border-t border-white/5">
                <h4 className="text-xs font-medium text-fg-soft uppercase tracking-wider mb-2">Quick Links</h4>
                <div className="space-y-1">
                  {QUICK_LINKS.map(link => {
                    const Icon = link.icon;
                    return (
                      <div key={link.path} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => navigateToQuickLink(link.path)}>
                        <Icon className={`w-4 h-4 ${link.iconClass}`} />
                        <span className="text-sm text-fg-muted">{link.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Results */}
            {hasQuery && hasResults && (
              <div className="py-2">
                {/* Categories section */}
                {categoryCount > 0 && (
                  <div className="px-4 py-2">
                    <h4 className="text-xs font-medium text-fg-soft uppercase tracking-wider mb-2">
                      Categories <span className="ml-1 text-fg-soft/50">{categoryCount}</span>
                    </h4>
                    <div className="space-y-1">
                      {flatResults.filter(r => r.type === 'categories').map((item) => {
                        const idx = resultIndex++;
                        const isSelected = idx === selectedIndex;
                        const config = ENTITY_CONFIG[item.type];
                        const Icon = config.icon;
                        return (
                          <div
                            key={`cat-${item.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            onClick={() => navigateToResult(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${config.iconClass}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-fg-default">{item.name}</p>
                              {item.subtitle && <p className="text-xs text-fg-soft">{item.subtitle}</p>}
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {config.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Companies section */}
                {companyCount > 0 && (
                  <div className="px-4 py-2">
                    <h4 className="text-xs font-medium text-fg-soft uppercase tracking-wider mb-2">
                      Companies <span className="ml-1 text-fg-soft/50">{companyCount}</span>
                    </h4>
                    <div className="space-y-1">
                      {flatResults.filter(r => r.type === 'companies').map((item) => {
                        const idx = resultIndex++;
                        const isSelected = idx === selectedIndex;
                        const config = ENTITY_CONFIG[item.type];
                        const Icon = config.icon;
                        return (
                          <div
                            key={`c-${item.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            onClick={() => navigateToResult(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${config.iconClass}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-fg-default truncate">{item.name}</p>
                              {item.subtitle && <p className="text-xs text-fg-soft truncate">{item.subtitle}</p>}
                            </div>
                            {item.meta && <span className="text-xs text-fg-soft flex-shrink-0">{item.meta}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20`}>
                              {config.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Factories section */}
                {facilityCount > 0 && (
                  <div className="px-4 py-2">
                    <h4 className="text-xs font-medium text-fg-soft uppercase tracking-wider mb-2">
                      Factories <span className="ml-1 text-fg-soft/50">{facilityCount}</span>
                    </h4>
                    <div className="space-y-1">
                      {flatResults.filter(r => r.type === 'facilities').map((item) => {
                        const idx = resultIndex++;
                        const isSelected = idx === selectedIndex;
                        const config = ENTITY_CONFIG[item.type];
                        const Icon = config.icon;
                        return (
                          <div
                            key={`f-${item.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            onClick={() => navigateToResult(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${config.iconClass}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-fg-default truncate">{item.name}</p>
                              {item.subtitle && <p className="text-xs text-fg-soft truncate">{item.subtitle}</p>}
                            </div>
                            {item.meta && (
                              <span className="text-xs text-fg-soft flex-shrink-0 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />{item.meta}
                              </span>
                            )}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              {config.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {showNoResults && (
              <div className="px-4 py-8 text-center">
                <Layers className="w-12 h-12 text-fg-soft mx-auto mb-3" />
                <h4 className="text-fg-muted font-medium mb-1">No results for "{debouncedQuery}"</h4>
                <p className="text-sm text-fg-soft mb-4">Try checking your spelling or using different terms</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_LINKS.slice(0, 2).map(link => (
                    <button key={link.path} onClick={() => navigateToQuickLink(link.path)} className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-fg-muted hover:bg-white/10 transition-colors">
                      {link.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {hasQuery && isLoading && !hasResults && (
              <div className="px-4 py-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-fg-soft animate-spin" />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-xs text-fg-soft">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10"><span className="text-[10px]">&#8593;&#8595;</span></kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10"><span className="text-[10px]">&#9166;</span></kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
