import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { companiesApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import type { Facility } from '@shared/types';
import {
  ArrowLeft, Building2, Factory, MapPin, Hash, Database,
  ChevronRight, ChevronDown, ChevronUp, ShieldCheck, AlertCircle, Ban,
} from 'lucide-react';

const INITIAL_STATES_SHOWN = 8;
const INITIAL_FACILITIES_SHOWN = 20;

const STATUS_CONFIG = {
  verified: { label: 'Verified', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: ShieldCheck },
  unverified: { label: 'Unverified', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertCircle },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: Ban },
} as const;

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showAllStates, setShowAllStates] = useState(false);
  const [showAllFacilities, setShowAllFacilities] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="text-sm text-fg-soft">Loading...</div>;
  }

  if (!company) {
    return <div className="text-sm text-fg-soft">Company not found.</div>;
  }

  const statusCfg = STATUS_CONFIG[company.status || 'unverified'];
  const StatusIcon = statusCfg.icon;

  // Parse ticker info from nameVariants JSON
  let tickerInfo: { ticker?: string; exchange?: string; cik?: string } | null = null;
  try {
    if (company.nameVariants) {
      const parsed = typeof company.nameVariants === 'string' ? JSON.parse(company.nameVariants) : company.nameVariants;
      if (parsed?.ticker) tickerInfo = parsed;
    }
  } catch { /* ignore parse errors */ }

  const visibleStates = showAllStates
    ? company.stateBreakdown
    : company.stateBreakdown.slice(0, INITIAL_STATES_SHOWN);

  const visibleFacilities = showAllFacilities
    ? company.facilities
    : company.facilities.slice(0, INITIAL_FACILITIES_SHOWN);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg-default transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-fg-default">{company.name}</h2>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${statusCfg.bg} ${statusCfg.border} border ${statusCfg.color}`}>
                <StatusIcon className="w-2.5 h-2.5" />
                {statusCfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-fg-muted">
                <Factory className="w-3 h-3 text-sky-400" />
                {company.facilityCount} {company.facilityCount === 1 ? 'factory' : 'factories'}
              </span>
              {company.sector && (
                <span className="text-xs text-fg-soft">{company.sector}</span>
              )}
              {tickerInfo && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono font-medium text-indigo-400">
                  {tickerInfo.exchange}:{tickerInfo.ticker}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-semibold text-fg-default">{company.facilities.length}</p>
          <p className="text-[10px] text-fg-soft mt-0.5">Linked Factories</p>
        </div>
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-semibold text-fg-default">{company.stateBreakdown.length}</p>
          <p className="text-[10px] text-fg-soft mt-0.5">States</p>
        </div>
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-semibold text-fg-default">{company.sourceBreakdown.length}</p>
          <p className="text-[10px] text-fg-soft mt-0.5">Data Sources</p>
        </div>
      </div>

      {/* Geographic Footprint */}
      {company.stateBreakdown.length > 0 && (
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-medium text-fg-soft mb-3 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Geographic Footprint
          </h3>
          <div className="space-y-2">
            {visibleStates.map(({ state, count }) => {
              const maxCount = company.stateBreakdown[0].count;
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div
                  key={state}
                  onClick={() => navigate(`/facilities?state=${state}&company=${encodeURIComponent(company.name)}`)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] rounded-lg px-1 py-0.5 -mx-1 transition-colors group"
                >
                  <span className="text-xs text-fg-muted w-6 font-mono group-hover:text-indigo-400 transition-colors">{state}</span>
                  <div className="flex-1 h-5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                      style={{ width: `${pct}%`, backgroundColor: 'rgba(99, 102, 241, 0.3)' }}
                    />
                  </div>
                  <span className="text-xs text-fg-muted w-12 text-right font-mono">{count.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          {company.stateBreakdown.length > INITIAL_STATES_SHOWN && (
            <button
              onClick={() => setShowAllStates(!showAllStates)}
              className="flex items-center gap-1.5 mx-auto pt-3 text-xs text-fg-soft hover:text-fg-muted transition-colors"
            >
              {showAllStates ? (
                <>Show Less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show All {company.stateBreakdown.length} States <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* Industry Breakdown */}
      {company.naicsBreakdown.length > 0 && (
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-medium text-fg-soft mb-3 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" /> Industry Breakdown
          </h3>
          <div className="space-y-2">
            {company.naicsBreakdown.map(({ code, description, count }) => {
              const maxCount = company.naicsBreakdown[0].count;
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div
                  key={code}
                  onClick={() => navigate(`/facilities?naics=${code}&company=${encodeURIComponent(company.name)}`)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] rounded-lg px-1 py-0.5 -mx-1 transition-colors group"
                >
                  <span className="text-xs text-fg-muted w-14 font-mono group-hover:text-emerald-400 transition-colors flex-shrink-0">{code}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-5 bg-white/[0.03] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                        style={{ width: `${pct}%`, backgroundColor: 'rgba(16, 185, 129, 0.25)' }}
                      />
                    </div>
                    {description && (
                      <p className="text-[10px] text-fg-soft truncate mt-0.5">{description}</p>
                    )}
                  </div>
                  <span className="text-xs text-fg-muted w-8 text-right font-mono flex-shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Source Breakdown */}
      {company.sourceBreakdown.length > 0 && (
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-medium text-fg-soft mb-3 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Source Coverage
          </h3>
          <div className="space-y-2.5">
            {company.sourceBreakdown.map(({ source, count }) => {
              const sourceInfo = DATA_SOURCES[source as keyof typeof DATA_SOURCES];
              const maxCount = company.sourceBreakdown[0].count;
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={source} className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sourceInfo?.color ?? '#6B7280' }}
                  />
                  <span className="text-xs text-fg-muted w-20 flex-shrink-0">{sourceInfo?.name ?? source}</span>
                  <div className="flex-1 h-4 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: sourceInfo?.color ?? '#6B7280', opacity: 0.35 }}
                    />
                  </div>
                  <span className="text-xs text-fg-muted w-12 text-right font-mono">{count} {count === 1 ? 'site' : 'sites'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Facilities List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-fg-muted">
            Factories ({company.facilities.length})
          </h3>
        </div>
        <div className="space-y-2">
          {visibleFacilities.map((f: Facility) => (
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
                <div className="w-9 h-9 rounded-lg bg-sky-400/10 border border-sky-400/20 flex items-center justify-center flex-shrink-0">
                  <Factory className="w-4 h-4 text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-fg-default truncate">{f.name}</h3>
                    <ChevronRight className="w-4 h-4 text-fg-soft opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
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
                        {f.primaryNaicsDescription && (
                          <span className="text-fg-soft"> {f.primaryNaicsDescription}</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
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
          ))}
        </div>

        {company.facilities.length > INITIAL_FACILITIES_SHOWN && (
          <button
            onClick={() => setShowAllFacilities(!showAllFacilities)}
            className="flex items-center gap-1.5 mx-auto pt-3 text-xs text-fg-soft hover:text-fg-muted transition-colors"
          >
            {showAllFacilities ? (
              <>Show Less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show All {company.facilities.length} Factories <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}

        {company.facilities.length === 0 && (
          <div className="text-center py-8">
            <Factory className="w-8 h-8 text-fg-soft mx-auto mb-2" />
            <p className="text-sm text-fg-muted">No linked factories yet</p>
            <p className="text-xs text-fg-soft mt-1">Factories are linked during pipeline runs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
