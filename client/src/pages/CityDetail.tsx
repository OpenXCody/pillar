import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statesApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import type { DataSource } from '@shared/types';
import {
  ArrowLeft, Factory, Building2, BarChart3, Database, ChevronRight,
} from 'lucide-react';

export default function CityDetail() {
  const { code, city } = useParams<{ code: string; city: string }>();
  const navigate = useNavigate();

  const { data: cityData, isLoading, error } = useQuery({
    queryKey: ['city', code, city],
    queryFn: () => statesApi.cityDetail(code!, city!),
    enabled: !!code && !!city,
  });

  if (isLoading) {
    return <div className="text-sm text-fg-soft">Loading...</div>;
  }

  if (error || !cityData) {
    return (
      <div className="space-y-4 max-w-4xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg-default transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-sm text-fg-soft">City not found.</div>
      </div>
    );
  }

  const maxNaicsCount = cityData.topNaics[0]?.count ?? 1;

  // Sort sources by count descending for display
  const sourceEntries = Object.entries(cityData.bySource)
    .sort(([, a], [, b]) => b - a);
  const maxSourceCount = sourceEntries[0]?.[1] ?? 1;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-fg-soft">
        <Link to="/" className="hover:text-fg-default transition-colors">Overview</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/states/${cityData.stateCode}`} className="hover:text-fg-default transition-colors">{cityData.stateName}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-fg-muted">{cityData.city}</span>
      </nav>

      {/* Header */}
      <div>
        <button onClick={() => navigate(`/states/${cityData.stateCode}`)} className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg-default transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> {cityData.stateName}
        </button>
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-2xl font-semibold text-fg-default">{cityData.city}</h2>
          <span className="text-sm font-mono text-fg-soft bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1">{cityData.stateCode}</span>
        </div>

        {/* KPI badges */}
        <div className="flex items-center gap-4 mt-4">
          <div
            onClick={() => navigate(`/facilities?state=${cityData.stateCode}&search=${encodeURIComponent(cityData.city)}`)}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer"
          >
            <Factory className="w-4 h-4 text-sky-400" />
            <div>
              <p className="text-lg font-semibold text-fg-default">{cityData.totalFacilities.toLocaleString()}</p>
              <p className="text-[10px] text-fg-soft">Factories</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl">
            <Building2 className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-lg font-semibold text-fg-default">{cityData.totalCompanies.toLocaleString()}</p>
              <p className="text-[10px] text-fg-soft">Companies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Industry Breakdown */}
      {cityData.topNaics.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-fg-muted mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Industry Breakdown
          </h3>
          <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4 space-y-2">
            {cityData.topNaics.map((naics) => {
              const pct = maxNaicsCount > 0 ? (naics.count / maxNaicsCount) * 100 : 0;
              const globalPct = cityData.totalFacilities > 0
                ? ((naics.count / cityData.totalFacilities) * 100).toFixed(1)
                : '0';
              return (
                <div
                  key={naics.code ?? 'unknown'}
                  onClick={() => navigate(`/facilities?state=${cityData.stateCode}&naics=${naics.code ?? ''}`)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] rounded-lg px-1 py-0.5 -mx-1 transition-colors group"
                >
                  <span className="text-[11px] font-mono text-fg-muted w-14 flex-shrink-0 group-hover:text-indigo-400 transition-colors">
                    {naics.code ?? '--'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-fg-default truncate">{naics.description ?? 'Unknown'}</span>
                      <span className="text-[10px] text-fg-soft flex-shrink-0">{globalPct}%</span>
                    </div>
                    <div className="h-4 bg-white/[0.03] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                        style={{ width: `${pct}%`, backgroundColor: 'rgba(99, 102, 241, 0.35)' }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-fg-muted w-14 text-right font-mono flex-shrink-0">{naics.count.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Companies */}
        {cityData.topCompanies.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-fg-muted mb-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Top Companies
            </h3>
            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4 space-y-1.5">
              {cityData.topCompanies.map((company) => (
                <div
                  key={company.id}
                  onClick={() => navigate(`/companies/${company.id}`)}
                  className="flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.03] rounded-lg px-2 py-1.5 -mx-1 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="text-sm text-fg-default truncate group-hover:text-amber-400 transition-colors">
                      {company.name}
                    </span>
                  </div>
                  <span className="text-xs text-fg-muted font-mono flex-shrink-0">
                    {company.count.toLocaleString()} {company.count === 1 ? 'facility' : 'facilities'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source Breakdown */}
        {sourceEntries.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-fg-muted mb-3 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Source Breakdown
            </h3>
            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4 space-y-2.5">
              {sourceEntries.map(([sourceKey, sourceCount]) => {
                const sourceInfo = DATA_SOURCES[sourceKey as DataSource];
                const pct = maxSourceCount > 0 ? (sourceCount / maxSourceCount) * 100 : 0;
                return (
                  <div key={sourceKey} className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sourceInfo?.color ?? '#6B7280' }}
                    />
                    <span className="text-xs text-fg-default w-24 flex-shrink-0">
                      {sourceInfo?.name ?? sourceKey}
                    </span>
                    <div className="flex-1 h-4 bg-white/[0.03] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: sourceInfo?.color ?? '#6B7280', opacity: 0.35 }}
                      />
                    </div>
                    <span className="text-xs text-fg-muted font-mono w-16 text-right flex-shrink-0">
                      {sourceCount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Facilities List */}
      {cityData.sampleFacilities.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-fg-muted flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5" /> Facilities
            </h3>
            <Link
              to={`/facilities?state=${cityData.stateCode}&search=${encodeURIComponent(cityData.city)}`}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_auto_80px] gap-3 px-4 py-2.5 border-b border-white/5 text-[10px] text-fg-soft uppercase tracking-wider">
              <span>Factory</span>
              <span>Company</span>
              <span className="w-20 text-center">NAICS</span>
              <span className="text-right">Confidence</span>
            </div>
            {/* Rows */}
            {cityData.sampleFacilities.map((facility) => {
              const confidenceColor = facility.confidence >= 70 ? 'emerald' : facility.confidence >= 40 ? 'amber' : 'red';
              const barColor = {
                emerald: 'bg-emerald-500',
                amber: 'bg-amber-500',
                red: 'bg-red-500',
              }[confidenceColor];
              return (
                <div
                  key={facility.id}
                  onClick={() => navigate(`/facilities/${facility.id}`)}
                  className="grid grid-cols-[1fr_1fr_auto_80px] gap-3 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors group"
                >
                  <span className="text-sm text-fg-default truncate group-hover:text-indigo-400 transition-colors">
                    {facility.name}
                  </span>
                  <span className="text-sm text-fg-muted truncate">
                    {facility.companyName ?? '--'}
                  </span>
                  <span className="text-xs font-mono text-fg-soft w-20 text-center">
                    {facility.primaryNaics ?? '--'}
                  </span>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${facility.confidence}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-fg-soft font-mono w-6 text-right">{facility.confidence}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
