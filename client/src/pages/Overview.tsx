import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { statsApi, pipelineApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { US_STATES } from '@shared/states';
import {
  Database, Factory, Building2, GitCompare, ArrowRight,
  ChevronDown, ChevronUp, CheckCircle2, Loader2, UserCircle,
  LayoutDashboard, MapPin, Boxes, BarChart3,
} from 'lucide-react';

type Tab = 'dashboard' | 'states' | 'industries' | 'coverage';
const INITIAL_STATES_SHOWN = 10;

/** NAICS 3-digit subsector friendly names */
const SUBSECTOR_NAMES: Record<string, string> = {
  '311': 'Food Manufacturing',
  '312': 'Beverage & Tobacco',
  '313': 'Textile Mills',
  '314': 'Textile Product Mills',
  '315': 'Apparel Manufacturing',
  '316': 'Leather & Allied Products',
  '321': 'Wood Products',
  '322': 'Paper Manufacturing',
  '323': 'Printing & Related',
  '324': 'Petroleum & Coal Products',
  '325': 'Chemical Manufacturing',
  '326': 'Plastics & Rubber Products',
  '327': 'Nonmetallic Mineral Products',
  '331': 'Primary Metals',
  '332': 'Fabricated Metal Products',
  '333': 'Machinery Manufacturing',
  '334': 'Computer & Electronics',
  '335': 'Electrical Equipment',
  '336': 'Transportation Equipment',
  '337': 'Furniture & Related Products',
  '339': 'Miscellaneous Manufacturing',
};

/** Sector-level names */

const STATE_NAME_MAP: Record<string, string> = {};
for (const s of US_STATES) STATE_NAME_MAP[s.code] = s.name;

export default function Overview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'dashboard';
  const setTab = (t: Tab) => {
    if (t === 'dashboard') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: t });
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Overview</h2>
        <p className="text-sm text-fg-muted mt-1">US Manufacturing Factory Data Pipeline</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1 w-fit">
        <TabButton icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setTab('dashboard')} />
        <TabButton icon={<MapPin className="w-3.5 h-3.5" />} label="States" active={activeTab === 'states'} onClick={() => setTab('states')} />
        <TabButton icon={<Boxes className="w-3.5 h-3.5" />} label="Industries" active={activeTab === 'industries'} onClick={() => setTab('industries')} />
        <TabButton icon={<BarChart3 className="w-3.5 h-3.5" />} label="Coverage" active={activeTab === 'coverage'} onClick={() => setTab('coverage')} />
      </div>

      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'states' && <StatesTab />}
      {activeTab === 'industries' && <IndustriesTab />}
      {activeTab === 'coverage' && <CoverageTab />}
    </div>
  );
}

/* ─── Tab Button ─── */
function TabButton({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
        ${active
          ? 'bg-white/[0.08] text-fg-default border border-white/10'
          : 'text-fg-soft hover:text-fg-muted hover:bg-white/[0.03]'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Dashboard Tab (original Overview) ─── */
function DashboardTab() {
  const navigate = useNavigate();
  const [showAllStates, setShowAllStates] = useState(false);
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: statsApi.overview,
  });
  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: pipelineApi.status,
    refetchInterval: 3000,
  });

  const visibleStates = showAllStates
    ? (stats?.byState ?? [])
    : (stats?.byState ?? []).slice(0, INITIAL_STATES_SHOWN);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Factory className="w-5 h-5 text-sky-400" />} label="Factories" value={isLoading ? '...' : stats?.totalFacilities.toLocaleString() ?? '0'} onClick={() => navigate('/facilities')} />
        <KpiCard icon={<Building2 className="w-5 h-5 text-amber-500" />} label="Companies" value={isLoading ? '...' : stats?.totalCompanies.toLocaleString() ?? '0'} onClick={() => navigate('/companies')} />
        <KpiCard icon={<Database className="w-5 h-5 text-emerald-400" />} label="Raw Records" value={isLoading ? '...' : stats?.totalRawRecords.toLocaleString() ?? '0'} onClick={() => navigate('/sources')} />
        <KpiCard icon={<GitCompare className="w-5 h-5 text-violet-400" />} label="Pending Reviews" value={isLoading ? '...' : stats?.pendingReviews.toLocaleString() ?? '0'} onClick={() => navigate('/review')} />
      </div>

      {/* Source Status */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-fg-muted">Data Sources</h3>
          <button onClick={() => navigate('/sources')} className="text-xs text-fg-soft hover:text-fg-muted transition-colors flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(DATA_SOURCES).filter(s => s.key !== 'manual').map(source => {
            const recordCount = stats?.bySource[source.key] ?? 0;
            const isSynced = !isLoading && recordCount > 0;
            const isSyncing = pipelineStatus?.running && pipelineStatus.currentSource === source.key;
            return (
              <div key={source.key} onClick={() => navigate('/sources')} className={`group p-4 cursor-pointer bg-white/[0.02] backdrop-blur-sm rounded-xl hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 ${isSyncing ? 'border border-emerald-500/20' : 'border border-white/5'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: source.gradient }} />
                  <span className="text-sm font-medium text-fg-default">{source.name}</span>
                </div>
                <p className="text-xs text-fg-soft line-clamp-2">{source.description}</p>
                {isSyncing ? (
                  <div className="mt-3 space-y-1.5">
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${pipelineStatus?.stageProgress ?? 0}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-fg-soft truncate">{pipelineStatus?.stageLabel ?? 'Starting...'}</span>
                      <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin flex-shrink-0" />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-fg-muted">{isLoading ? '...' : `${recordCount.toLocaleString()} records`}</span>
                    {isSynced ? (
                      <span className="relative group/tip">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">Synced</span>
                      </span>
                    ) : (
                      <span className="relative group/tip">
                        <UserCircle className="w-4 h-4 text-fg-soft" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-fg-default bg-bg-elevated border border-border-subtle rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">Requires human action</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* States preview */}
      {stats?.byState && stats.byState.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-fg-muted">
              {showAllStates ? 'All States' : 'Top States'} by Factory Count
            </h3>
            <span className="text-xs text-fg-soft">{stats.byState.length} states</span>
          </div>
          <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4 space-y-2.5">
            {visibleStates.map(({ state, count }) => {
              const maxCount = stats.byState[0].count;
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={state} onClick={() => navigate(`/states/${state}`)} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors">
                  <span className="text-xs text-fg-muted w-6 font-mono">{state}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: 'rgba(99, 102, 241, 0.35)' }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-fg-default w-16 text-right">{count.toLocaleString()}</span>
                </div>
              );
            })}
            {stats.byState.length > INITIAL_STATES_SHOWN && (
              <button onClick={() => setShowAllStates(!showAllStates)} className="flex items-center gap-1.5 mx-auto pt-2 text-xs text-fg-soft hover:text-fg-muted transition-colors">
                {showAllStates ? <>Show Less <ChevronUp className="w-3 h-3" /></> : <>Show All {stats.byState.length} States <ChevronDown className="w-3 h-3" /></>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── States Tab ─── */
function StatesTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: statsApi.overview,
  });

  const states = (stats?.byState ?? [])
    .map(s => ({ ...s, name: STATE_NAME_MAP[s.state] || s.state }))
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.state.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    });

  const totalFacilities = stats?.totalFacilities ?? 0;
  const maxCount = states[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search states..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 text-sm bg-white/[0.03] border border-white/5 rounded-lg text-fg-default placeholder:text-fg-soft focus:outline-none focus:border-white/10 w-64"
        />
        <span className="text-xs text-fg-soft">{states.length} states</span>
      </div>

      {/* State cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading ? (
          <div className="text-sm text-fg-soft col-span-2">Loading...</div>
        ) : (
          states.map(({ state, name, count }) => {
            const pct = totalFacilities > 0 ? ((count / totalFacilities) * 100).toFixed(1) : '0';
            const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div
                key={state}
                onClick={() => navigate(`/states/${state}`)}
                className="group p-4 bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg-default">{name}</span>
                    <span className="text-xs font-mono text-fg-soft bg-white/5 px-1.5 py-0.5 rounded">{state}</span>
                  </div>
                  <span className="text-lg font-semibold text-fg-default">{count.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                      style={{ width: `${barPct}%`, backgroundColor: 'rgba(99, 102, 241, 0.35)' }}
                    />
                  </div>
                  <span className="text-[10px] text-fg-soft w-12 text-right">{pct}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Industries Tab ─── */
function IndustriesTab() {
  const navigate = useNavigate();
  const [view, setView] = useState<'categories' | 'subsectors' | 'detailed'>('categories');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSubsector, setExpandedSubsector] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'industries'],
    queryFn: statsApi.industries,
  });

  const subsectors = data?.subsectors ?? [];
  const industries = data?.industries ?? [];
  const categories = data?.categories ?? [];
  const maxSubsectorCount = subsectors[0]?.facilityCount ?? 1;
  const maxCategoryCount = categories[0]?.facilityCount ?? 1;

  // Group detailed industries by subsector
  const industriesBySubsector: Record<string, typeof industries> = {};
  for (const ind of industries) {
    const sub = ind.subsector || ind.code?.slice(0, 3);
    if (!industriesBySubsector[sub]) industriesBySubsector[sub] = [];
    industriesBySubsector[sub].push(ind);
  }

  return (
    <div className="space-y-5">
      {/* View toggle — Categories first */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView('categories')}
          className={`text-xs px-2.5 py-1 rounded-md transition-all ${view === 'categories' ? 'bg-white/[0.08] text-fg-default border border-white/10' : 'text-fg-soft hover:text-fg-muted'}`}
        >
          Categories
        </button>
        <button
          onClick={() => setView('subsectors')}
          className={`text-xs px-2.5 py-1 rounded-md transition-all ${view === 'subsectors' ? 'bg-white/[0.08] text-fg-default border border-white/10' : 'text-fg-soft hover:text-fg-muted'}`}
        >
          Subsectors (3-digit)
        </button>
        <button
          onClick={() => setView('detailed')}
          className={`text-xs px-2.5 py-1 rounded-md transition-all ${view === 'detailed' ? 'bg-white/[0.08] text-fg-default border border-white/10' : 'text-fg-soft hover:text-fg-muted'}`}
        >
          All Industries (6-digit)
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-fg-soft">Loading industry data...</div>
      ) : view === 'categories' ? (
        /* Categories view — 11 custom domain groupings */
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl divide-y divide-white/5">
          {categories.map(cat => {
            const isExpanded = expandedCategory === cat.key;
            const barPct = maxCategoryCount > 0 ? (cat.facilityCount / maxCategoryCount) * 100 : 0;
            // Find subsectors within this category
            const catSubsectors = subsectors.filter(sub =>
              cat.subsectors?.includes(sub.subsector)
            );

            return (
              <div key={cat.key}>
                <div
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-fg-default">{cat.label}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: 'rgba(99, 102, 241, 0.35)' }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-fg-default">{cat.facilityCount.toLocaleString()}</div>
                    <div className="text-[10px] text-fg-soft">{cat.companyCount.toLocaleString()} cos</div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-fg-soft transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded: show NAICS subsectors within this category */}
                {isExpanded && catSubsectors.length > 0 && (
                  <div className="bg-white/[0.01] border-t border-white/5 px-4 py-2 space-y-1">
                    {catSubsectors.map(sub => (
                      <div
                        key={sub.subsector}
                        onClick={() => navigate(`/facilities?naics=${sub.subsector}`)}
                        className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <span className="text-[10px] font-mono text-fg-soft w-8">{sub.subsector}</span>
                        <span className="text-xs text-fg-muted flex-1 truncate">
                          {SUBSECTOR_NAMES[sub.subsector] || `Subsector ${sub.subsector}`}
                        </span>
                        <span className="text-xs font-medium text-fg-default">{sub.facilityCount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : view === 'subsectors' ? (
        /* Subsector view — same layout as Categories, no code prefix */
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl divide-y divide-white/5">
          {subsectors.map(sub => {
            const isExpanded = expandedSubsector === sub.subsector;
            const subIndustries = industriesBySubsector[sub.subsector] || [];
            const barPct = maxSubsectorCount > 0 ? (sub.facilityCount / maxSubsectorCount) * 100 : 0;

            return (
              <div key={sub.subsector}>
                <div
                  onClick={() => setExpandedSubsector(isExpanded ? null : sub.subsector)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-fg-default truncate">
                        {SUBSECTOR_NAMES[sub.subsector] || `Subsector ${sub.subsector}`}
                      </span>
                      {sub.topStates.length > 0 && (
                        <span className="text-[10px] text-fg-soft hidden sm:inline">
                          Top: {sub.topStates.slice(0, 3).map(s => s.state).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: 'rgba(99, 102, 241, 0.35)' }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-fg-default">{sub.facilityCount.toLocaleString()}</div>
                    <div className="text-[10px] text-fg-soft">{sub.companyCount.toLocaleString()} cos</div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-fg-soft transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {isExpanded && subIndustries.length > 0 && (
                  <div className="bg-white/[0.01] border-t border-white/5 px-4 py-2 space-y-1">
                    {subIndustries.slice(0, 20).map(ind => (
                      <div
                        key={ind.code}
                        onClick={() => navigate(`/facilities?naics=${ind.code}`)}
                        className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <span className="text-[10px] font-mono text-fg-soft w-14">{ind.code}</span>
                        <span className="text-xs text-fg-muted flex-1 truncate">{ind.description}</span>
                        <span className="text-xs font-medium text-fg-default">{ind.facilityCount.toLocaleString()}</span>
                      </div>
                    ))}
                    {subIndustries.length > 20 && (
                      <div className="text-[10px] text-fg-soft pl-2 py-1">
                        +{subIndustries.length - 20} more industries
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* All Industries view — matches Categories layout, filters out blank codes */
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl divide-y divide-white/5">
          {industries
            .filter(ind => ind.code && ind.code.length >= 4 && ind.description)
            .slice(0, 50)
            .map(ind => {
              const maxIndustryCount = industries[0]?.facilityCount ?? 1;
              const barPct = maxIndustryCount > 0 ? (ind.facilityCount / maxIndustryCount) * 100 : 0;
              return (
                <div
                  key={ind.code}
                  onClick={() => navigate(`/facilities?naics=${ind.code}`)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-fg-default truncate">{ind.description}</span>
                      <span className="text-[10px] font-mono text-fg-soft">{ind.code}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: 'rgba(99, 102, 241, 0.35)' }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-fg-default">{ind.facilityCount.toLocaleString()}</div>
                    <div className="text-[10px] text-fg-soft">{ind.companyCount.toLocaleString()} cos</div>
                  </div>
                </div>
              );
            })}
          {industries.filter(ind => ind.code && ind.code.length >= 4).length > 50 && (
            <div className="text-xs text-fg-soft text-center py-3">
              Showing top 50 of {industries.filter(ind => ind.code && ind.code.length >= 4).length} industry codes
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ─── */
function KpiCard({ icon, label, value, onClick }: {
  icon: React.ReactNode; label: string; value: string; onClick?: () => void; accent?: string;
}) {
  return (
    <div onClick={onClick} className={`p-4 rounded-xl bg-white/[0.02] backdrop-blur-sm border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs text-fg-soft">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-fg-default">{value}</p>
    </div>
  );
}

/* ─── Coverage Tab ─── */
function CoverageTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'coverage'],
    queryFn: statsApi.coverage,
  });

  if (isLoading) return <div className="text-center py-12 text-sm text-fg-soft">Loading coverage data...</div>;
  if (!data || !data.byState.length) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-10 h-10 text-fg-soft mx-auto mb-3" />
        <p className="text-sm text-fg-muted">No Census CBP data available</p>
        <p className="text-xs text-fg-soft mt-1">Sync Census CBP from the Sources page to see coverage analysis</p>
      </div>
    );
  }

  const { summary, byState } = data;
  const coverageColor = summary.overallCoverage >= 80 ? 'text-emerald-400' : summary.overallCoverage >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-muted">
        Comparing Pillar factory records against Census Bureau County Business Patterns (2021) manufacturing establishment counts
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-xs text-fg-soft">Census Establishments</span>
          <p className="text-2xl font-semibold text-fg-default mt-2">{summary.censusEstablishments.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-xs text-fg-soft">Our Facilities</span>
          <p className="text-2xl font-semibold text-fg-default mt-2">{summary.ourFacilities.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-xs text-fg-soft">Overall Coverage</span>
          <p className={`text-2xl font-semibold mt-2 ${coverageColor}`}>{summary.overallCoverage}%</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-xs text-fg-soft">Mfg Employees (Census)</span>
          <p className="text-2xl font-semibold text-fg-default mt-2">{(summary.totalManufacturingEmployees / 1_000_000).toFixed(1)}M</p>
        </div>
      </div>

      {/* State-by-State Coverage */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-medium text-fg-default">Coverage by State</h3>
          <p className="text-xs text-fg-soft mt-0.5">States sorted by Census manufacturing establishment count</p>
        </div>

        <div className="divide-y divide-white/5">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-fg-soft uppercase tracking-wider">
            <div className="col-span-2">State</div>
            <div className="col-span-2 text-right">Census Est.</div>
            <div className="col-span-2 text-right">Our Records</div>
            <div className="col-span-2 text-right">Coverage</div>
            <div className="col-span-2 text-right">Gap</div>
            <div className="col-span-2" />
          </div>

          {byState.map(row => {
            const pct = row.coveragePercent;
            const barColor = pct >= 80 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
            const textColor = pct >= 80 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';

            return (
              <div
                key={row.state}
                onClick={() => navigate(`/states/${row.state}`)}
                className="grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer transition-colors items-center"
              >
                <div className="col-span-2">
                  <span className="text-xs font-medium text-fg-default">{STATE_NAME_MAP[row.state] || row.state}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-xs text-fg-muted">{row.censusEstablishments.toLocaleString()}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-xs text-fg-default">{row.ourFacilities.toLocaleString()}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className={`text-xs font-medium ${textColor}`}>{pct}%</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-xs text-fg-soft">{row.gap > 0 ? `-${row.gap.toLocaleString()}` : '—'}</span>
                </div>
                <div className="col-span-2">
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
