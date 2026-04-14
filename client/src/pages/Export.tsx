import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportApi, statsApi } from '../lib/api';
import { Download, FileDown, Check, Clock, AlertCircle, Factory, Building2, MapPin, BarChart3 } from 'lucide-react';
import { US_STATES } from '@shared/states';
import { INDUSTRY_CATEGORIES } from '@shared/naics';
import SearchableSelect from '@/components/ui/SearchableSelect';

type ExportType = 'factory' | 'company';

interface ExportFilters {
  states: string[];
  naicsPrefix: string;
  minConfidence: number;
  // Company export specific
  minFacilities: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Export() {
  const queryClient = useQueryClient();
  const [exportType, setExportType] = useState<ExportType>('factory');

  const [filters, setFilters] = useState<ExportFilters>({
    states: [],
    naicsPrefix: '',
    minConfidence: 0,
    minFacilities: 1,
  });

  // Factory exports always require company + coordinates
  const previewParams = {
    states: filters.states.join(',') || undefined,
    naicsPrefix: filters.naicsPrefix || undefined,
    minConfidence: filters.minConfidence > 0 ? filters.minConfidence : undefined,
    hasCompany: true,
    hasCoordinates: true,
  };

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['export', 'preview', exportType, previewParams, filters.minFacilities],
    queryFn: () => exportApi.preview(previewParams),
    staleTime: 30_000,
  });

  const { data: history } = useQuery({
    queryKey: ['export', 'history'],
    queryFn: () => exportApi.history(),
  });

  const { data: overview } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsApi.overview(),
    staleTime: 60_000,
  });

  const generateMutation = useMutation({
    mutationFn: () => exportApi.generate({
      exportType,
      states: filters.states.length > 0 ? filters.states : undefined,
      naicsPrefix: filters.naicsPrefix || undefined,
      minConfidence: filters.minConfidence > 0 ? filters.minConfidence : undefined,
      hasCompany: true,
      hasCoordinates: true,
      ...(exportType === 'company' && filters.minFacilities > 1 ? { minFacilities: filters.minFacilities } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export', 'history'] });
    },
  });

  const hasActiveFilters = filters.states.length > 0 || filters.naicsPrefix || filters.minConfidence > 0 || filters.minFacilities > 1;

  const clearFilters = () => {
    setFilters({ states: [], naicsPrefix: '', minConfidence: 0, minFacilities: 1 });
  };

  const previewCount = exportType === 'factory'
    ? (preview?.facilityCount ?? 0)
    : (preview?.companyCount ?? 0);

  const totalCount = exportType === 'factory'
    ? (overview?.totalFacilities ?? 1)
    : (overview?.totalCompanies ?? 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Export</h2>
        <p className="text-sm text-fg-muted mt-1">Generate CSV files for Archangel import</p>
      </div>

      {/* Export Type Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-xl p-1 w-fit">
        <button
          onClick={() => setExportType('factory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            exportType === 'factory' ? 'bg-white/10 text-fg-default' : 'text-fg-soft hover:text-fg-muted hover:bg-white/[0.03]'
          }`}
        >
          <Factory className="w-4 h-4" />
          Factory
        </button>
        <button
          onClick={() => setExportType('company')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            exportType === 'company' ? 'bg-white/10 text-fg-default' : 'text-fg-soft hover:text-fg-muted hover:bg-white/[0.03]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Company
        </button>
      </div>

      {/* Filters — reuses same SearchableSelect components as Factories page */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-fg-default">Filters</span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-fg-muted hover:text-fg-default transition-colors">
              Clear all
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <SearchableSelect
            options={US_STATES.map(s => ({ value: s.code, label: s.name }))}
            value={filters.states[0] || ''}
            onChange={v => setFilters(f => ({ ...f, states: v ? [v] : [] }))}
            placeholder="Filter by state..."
            icon={<MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
            accentColor="indigo"
          />

          <SearchableSelect
            options={INDUSTRY_CATEGORIES.map(c => ({ value: c.naicsPrefixes[0], label: c.label }))}
            value={filters.naicsPrefix}
            onChange={v => setFilters(f => ({ ...f, naicsPrefix: v }))}
            placeholder="Filter by category..."
            icon={<Factory className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
            accentColor="indigo"
          />

          <select
            value={filters.minConfidence}
            onChange={(e) => setFilters(f => ({ ...f, minConfidence: Number(e.target.value) }))}
            className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-fg-default min-w-[150px]"
            style={{ colorScheme: 'dark' }}
          >
            <option value="0">Any confidence</option>
            <option value="50">50+ (Complete)</option>
            <option value="70">70+ (High)</option>
            <option value="90">90+ (Very High)</option>
            <option value="100">100 (Perfect)</option>
          </select>

          {exportType === 'company' && (
            <select
              value={filters.minFacilities}
              onChange={(e) => setFilters(f => ({ ...f, minFacilities: Number(e.target.value) }))}
              className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-fg-default min-w-[150px]"
            style={{ colorScheme: 'dark' }}
            >
              <option value="1">Any size</option>
              <option value="5">5+ factories</option>
              <option value="10">10+ factories</option>
              <option value="15">15+ factories</option>
              <option value="25">25+ factories</option>
            </select>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            {filters.states.map(s => (
              <span key={s} className="px-2 py-0.5 bg-white/5 text-fg-muted text-xs rounded flex items-center gap-1 border border-white/10">
                {s}
                <button onClick={() => setFilters(f => ({ ...f, states: f.states.filter(x => x !== s) }))} className="hover:text-fg-default">&times;</button>
              </span>
            ))}
            {filters.naicsPrefix && (
              <span className="px-2 py-0.5 bg-white/5 text-fg-muted text-xs rounded flex items-center gap-1 border border-white/10">
                {INDUSTRY_CATEGORIES.find(c => c.naicsPrefixes[0] === filters.naicsPrefix)?.label || filters.naicsPrefix}
                <button onClick={() => setFilters(f => ({ ...f, naicsPrefix: '' }))} className="hover:text-fg-default">&times;</button>
              </span>
            )}
            {filters.minConfidence > 0 && (
              <span className="px-2 py-0.5 bg-white/5 text-fg-muted text-xs rounded flex items-center gap-1 border border-white/10">
                {filters.minConfidence}+ confidence
                <button onClick={() => setFilters(f => ({ ...f, minConfidence: 0 }))} className="hover:text-fg-default">&times;</button>
              </span>
            )}
            {filters.minFacilities > 1 && (
              <span className="px-2 py-0.5 bg-white/5 text-fg-muted text-xs rounded flex items-center gap-1 border border-white/10">
                {filters.minFacilities}+ factories
                <button onClick={() => setFilters(f => ({ ...f, minFacilities: 1 }))} className="hover:text-fg-default">&times;</button>
              </span>
            )}
          </div>
        )}

        <p className="text-[10px] text-fg-soft">
          {exportType === 'factory'
            ? 'Only facilities with a linked company and coordinates are exportable.'
            : 'Only verified companies with at least one factory that has coordinates.'}
        </p>
      </div>

      {/* Preview */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-fg-default">Export Preview</span>
          {previewLoading && <span className="text-xs text-fg-soft animate-pulse">Counting...</span>}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-bg-inset rounded-lg p-3 text-center">
            <Factory className="w-4 h-4 text-fg-soft mx-auto mb-1" />
            <div className="text-lg font-semibold text-fg-default">
              {preview ? preview.facilityCount.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-fg-muted">Factories</div>
          </div>
          <div className="bg-bg-inset rounded-lg p-3 text-center">
            <Building2 className="w-4 h-4 text-fg-soft mx-auto mb-1" />
            <div className="text-lg font-semibold text-fg-default">
              {preview ? preview.companyCount.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-fg-muted">Companies</div>
          </div>
          <div className="bg-bg-inset rounded-lg p-3 text-center">
            <MapPin className="w-4 h-4 text-fg-soft mx-auto mb-1" />
            <div className="text-lg font-semibold text-fg-default">
              {preview ? preview.stateCount : '—'}
            </div>
            <div className="text-xs text-fg-muted">States</div>
          </div>
        </div>

        {overview && preview && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-fg-muted mb-1">
              <span>Coverage of total database</span>
              <span>{Math.round((previewCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-bg-inset rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (previewCount / totalCount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || previewCount === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-bg-inset disabled:text-fg-soft text-white font-medium rounded-lg py-2.5 px-4 text-sm transition-colors"
        >
          {generateMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Generate {exportType === 'factory' ? 'Factory' : 'Company'} CSV
              {previewCount > 0 && (
                <span className="text-indigo-200 text-xs">({previewCount.toLocaleString()} records)</span>
              )}
            </>
          )}
        </button>

        {generateMutation.isSuccess && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-300">
              Export generated!{' '}
              {generateMutation.data?.filePath && (
                <a href={exportApi.downloadUrl(generateMutation.data.filePath)} className="underline hover:text-emerald-200" download>
                  Download CSV
                </a>
              )}
            </div>
          </div>
        )}

        {generateMutation.isError && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-sm text-red-300">
              Export failed: {(generateMutation.error as Error).message}
            </div>
          </div>
        )}
      </div>

      {/* Export History */}
      {history && history.exports.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
          <h3 className="text-sm font-medium text-fg-default mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-fg-soft" />
            Export History
          </h3>
          <div className="space-y-2">
            {history.exports.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between py-2 px-3 bg-bg-inset rounded-lg">
                <div className="flex items-center gap-3">
                  <FileDown className="w-4 h-4 text-fg-soft" />
                  <div>
                    <div className="text-sm text-fg-default">
                      {exp.facilityCount > 0 ? `${exp.facilityCount.toLocaleString()} factories` : `${exp.companyCount.toLocaleString()} companies`}
                    </div>
                    <div className="text-xs text-fg-muted">
                      {formatDate(exp.createdAt)}
                      {exp.fileSize && ` · ${formatBytes(exp.fileSize)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {exp.status === 'completed' && exp.filePath && (
                    <a href={exportApi.downloadUrl(exp.filePath)} download className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                      <Download className="w-3 h-3" /> Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Format Info */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
        <h3 className="text-sm font-medium text-fg-default mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-fg-soft" />
          {exportType === 'factory' ? 'Factory CSV Format' : 'Company CSV Format'}
        </h3>
        {exportType === 'factory' ? (
          <>
            <div className="text-xs text-fg-muted space-y-1 font-mono">
              <p>company_name, facility_name, address, city, state, zip,</p>
              <p>latitude, longitude, naics_code, naics_description,</p>
              <p>employee_count, source_count, confidence, epa_registry_id</p>
            </div>
            <p className="text-xs text-fg-soft mt-3">
              Archangel-compatible format. Only facilities with company, address, and coordinates are included.
            </p>
          </>
        ) : (
          <>
            <div className="text-xs text-fg-muted space-y-1 font-mono">
              <p>company_name, sector, facility_count, states,</p>
              <p>naics_codes, status</p>
            </div>
            <p className="text-xs text-fg-soft mt-3">
              One row per company with aggregated data. Sorted by facility count descending.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
