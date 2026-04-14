import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { statsApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { Database, Factory, Building2, GitCompare, Play, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

const INITIAL_STATES_SHOWN = 10;

export default function Overview() {
  const navigate = useNavigate();
  const [showAllStates, setShowAllStates] = useState(false);
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: statsApi.overview,
  });

  const visibleStates = showAllStates
    ? (stats?.byState ?? [])
    : (stats?.byState ?? []).slice(0, INITIAL_STATES_SHOWN);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Overview</h2>
        <p className="text-sm text-fg-muted mt-1">US Manufacturing Factory Data Pipeline</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Factory className="w-5 h-5 text-sky-400" />}
          label="Factories"
          value={isLoading ? '...' : stats?.totalFacilities.toLocaleString() ?? '0'}
          onClick={() => navigate('/facilities')}
          accent="sky"
        />
        <KpiCard
          icon={<Building2 className="w-5 h-5 text-amber-500" />}
          label="Companies"
          value={isLoading ? '...' : stats?.totalCompanies.toLocaleString() ?? '0'}
          onClick={() => navigate('/companies')}
          accent="amber"
        />
        <KpiCard
          icon={<Database className="w-5 h-5 text-emerald-400" />}
          label="Raw Records"
          value={isLoading ? '...' : stats?.totalRawRecords.toLocaleString() ?? '0'}
          onClick={() => navigate('/sources')}
          accent="emerald"
        />
        <KpiCard
          icon={<GitCompare className="w-5 h-5 text-violet-400" />}
          label="Pending Reviews"
          value={isLoading ? '...' : stats?.pendingReviews.toLocaleString() ?? '0'}
          onClick={() => navigate('/review')}
          accent="violet"
        />
      </div>

      {/* Source Status */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-fg-muted">Data Sources</h3>
          <button onClick={() => navigate('/sources')} className="text-xs text-fg-soft hover:text-fg-muted transition-colors flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(DATA_SOURCES).filter(s => s.key !== 'manual').map(source => (
            <div
              key={source.key}
              className="
                group p-4
                bg-white/[0.02] backdrop-blur-sm
                border border-white/5 rounded-xl
                hover:bg-white/[0.05] hover:border-white/10
                transition-all duration-200
              "
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: source.color }} />
                <span className="text-sm font-medium text-fg-default">{source.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Federal</span>
                {(source.key === 'osha' || source.key === 'usda_fsis') && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-fg-soft border border-white/10">V2</span>
                )}
              </div>
              <p className="text-xs text-fg-soft line-clamp-2">{source.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-fg-muted">
                  {isLoading ? '...' : `${(stats?.bySource[source.key] ?? 0).toLocaleString()} records`}
                </span>
                {(source.key === 'epa_echo' || source.key === 'epa_tri') && (
                  <button
                    onClick={() => navigate('/sources')}
                    className="flex items-center gap-1 text-xs text-fg-soft hover:text-fg-muted transition-colors"
                  >
                    <Play className="w-3 h-3" /> Fetch
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* States */}
      {stats?.byState && stats.byState.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-fg-muted">
              {showAllStates ? 'All States' : 'Top States'} by Factory Count
            </h3>
            <span className="text-xs text-fg-soft">
              {stats.byState.length} states
            </span>
          </div>
          <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4 space-y-2.5">
            {visibleStates.map(({ state, count }) => {
              const maxCount = stats.byState[0].count;
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div
                  key={state}
                  onClick={() => navigate(`/facilities?state=${state}`)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] rounded-lg px-1 py-0.5 -mx-1 transition-colors group"
                >
                  <span className="text-xs text-fg-muted w-6 font-mono group-hover:text-indigo-400 transition-colors">{state}</span>
                  <div className="flex-1 h-5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                      style={{ width: `${pct}%`, backgroundColor: 'rgba(99, 102, 241, 0.3)' }}
                    />
                  </div>
                  <span className="text-xs text-fg-muted w-16 text-right font-mono">{count.toLocaleString()}</span>
                </div>
              );
            })}

            {/* Show more/less toggle */}
            {stats.byState.length > INITIAL_STATES_SHOWN && (
              <button
                onClick={() => setShowAllStates(!showAllStates)}
                className="flex items-center gap-1.5 mx-auto pt-2 text-xs text-fg-soft hover:text-fg-muted transition-colors"
              >
                {showAllStates ? (
                  <>Show Less <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Show All {stats.byState.length} States <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, onClick, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
  accent: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-xl
        bg-white/[0.02] backdrop-blur-sm
        border border-white/5
        hover:bg-white/[0.05] hover:border-white/10
        transition-all duration-200
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs text-fg-soft">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-fg-default">{value}</p>
    </div>
  );
}
