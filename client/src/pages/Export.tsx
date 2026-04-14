import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportApi, statsApi, companiesApi } from '../lib/api';
import { Download, FileDown, Check, Clock, AlertCircle, Factory, Building2, MapPin, BarChart3, Search } from 'lucide-react';
import { US_STATES } from '@shared/states';
import { INDUSTRY_CATEGORIES } from '@shared/naics';
import SearchableSelect from '@/components/ui/SearchableSelect';

type ExportType = 'factory' | 'company';

interface ExportFilters {
  states: string[];
  naicsPrefix: string;
  minConfidence: number;
  minFacilities: number;
  companies: string[];
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
    companies: [],
  });

  // Factory exports always require company + coordinates
  const previewParams = {
    states: filters.states.join(',') || undefined,
    naicsPrefix: filters.naicsPrefix || undefined,
    minConfidence: filters.minConfidence > 0 ? filters.minConfidence : undefined,
    hasCompany: true,
    hasCoordinates: true,
    minFacilities: exportType === 'company' && filters.minFacilities > 1 ? filters.minFacilities : undefined,
    companies: filters.companies.length > 0 ? filters.companies.join(',') : undefined,
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
      minFacilities: exportType === 'company' && filters.minFacilities > 1 ? filters.minFacilities : undefined,
      companies: filters.companies.length > 0 ? filters.companies : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export', 'history'] });
    },
  });

  const hasActiveFilters = filters.states.length > 0 || filters.naicsPrefix || filters.minConfidence > 0 || filters.minFacilities > 1 || filters.companies.length > 0;

  const clearFilters = () => {
    setFilters({ states: [], naicsPrefix: '', minConfidence: 0, minFacilities: 1, companies: [] });
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
            placeholder="State"
            icon={<MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
            accentColor="indigo"
          />

          <SearchableSelect
            options={INDUSTRY_CATEGORIES.map(c => ({ value: c.naicsPrefixes[0], label: c.label }))}
            value={filters.naicsPrefix}
            onChange={v => setFilters(f => ({ ...f, naicsPrefix: v }))}
            placeholder="Category"
            icon={<Factory className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
            accentColor="indigo"
          />

          <SearchableSelect
            options={[
              { value: '50', label: '50+ (Complete)' },
              { value: '70', label: '70+ (High)' },
              { value: '90', label: '90+ (Very High)' },
              { value: '100', label: '100 (Perfect)' },
            ]}
            value={filters.minConfidence > 0 ? String(filters.minConfidence) : ''}
            onChange={v => setFilters(f => ({ ...f, minConfidence: v ? Number(v) : 0 }))}
            placeholder="Confidence"
            icon={<BarChart3 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
            accentColor="indigo"
          />

          {exportType === 'company' && (
            <SearchableSelect
              options={[
                { value: '5', label: '5+ factories' },
                { value: '10', label: '10+ factories' },
                { value: '15', label: '15+ factories' },
                { value: '25', label: '25+ factories' },
              ]}
              value={filters.minFacilities > 1 ? String(filters.minFacilities) : ''}
              onChange={v => setFilters(f => ({ ...f, minFacilities: v ? Number(v) : 1 }))}
              placeholder="Size"
              icon={<Building2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
              accentColor="indigo"
            />
          )}
        </div>

        {/* Company autocomplete search */}
        <CompanyAutocomplete
          selected={filters.companies}
          onAdd={name => setFilters(f => ({ ...f, companies: [...f.companies, name] }))}
          onRemove={name => setFilters(f => ({ ...f, companies: f.companies.filter(x => x !== name) }))}
        />

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
            {filters.companies.map(c => (
              <span key={c} className="px-2 py-0.5 bg-white/5 text-fg-muted text-xs rounded flex items-center gap-1 border border-white/10">
                {c}
                <button onClick={() => setFilters(f => ({ ...f, companies: f.companies.filter(x => x !== c) }))} className="hover:text-fg-default">&times;</button>
              </span>
            ))}
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

        {exportType === 'factory' ? (
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
        ) : (
          <div className="mb-5">
            <div className="bg-bg-inset rounded-lg p-4 text-center">
              <Building2 className="w-5 h-5 text-fg-soft mx-auto mb-1" />
              <div className="text-2xl font-semibold text-fg-default">
                {preview ? preview.companyCount.toLocaleString() : '—'}
              </div>
              <div className="text-xs text-fg-muted">Companies</div>
            </div>
          </div>
        )}

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

/** Autocomplete company search with factory count badges */
function CompanyAutocomplete({ selected, onAdd }: {
  selected: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['company-search', query],
    queryFn: () => companiesApi.list({ search: query, limit: 10 }),
    enabled: query.length >= 2,
    staleTime: 10_000,
  });

  const results = (data?.data ?? []).filter(c => !selected.includes(c.name));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2.5">
        <Search className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
        <input
          type="text"
          placeholder={selected.length > 0 ? 'Add another company...' : 'Search companies...'}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="flex-1 text-sm text-fg-default placeholder:text-fg-soft bg-transparent outline-none"
        />
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-elevated border border-border-subtle rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto py-1">
          {results.map(company => (
            <button
              key={company.id}
              onClick={() => {
                onAdd(company.name);
                setQuery('');
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-fg-default truncate">{company.name}</div>
                <div className="text-[10px] text-fg-soft">{company.sector || 'Manufacturing'}</div>
              </div>
              <div className="flex items-center gap-1 text-xs text-fg-soft flex-shrink-0">
                <Factory className="w-3 h-3" />
                {company.facilityCount}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
