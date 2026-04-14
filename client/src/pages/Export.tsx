import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportApi, statsApi } from '../lib/api';
import { Download, FileDown, Filter, Check, Clock, AlertCircle, Package, Building2, MapPin, BarChart3 } from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','PR',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const NAICS_SECTORS = [
  { code: '311', label: 'Food Manufacturing' },
  { code: '312', label: 'Beverage & Tobacco' },
  { code: '313', label: 'Textile Mills' },
  { code: '314', label: 'Textile Products' },
  { code: '315', label: 'Apparel' },
  { code: '316', label: 'Leather' },
  { code: '321', label: 'Wood Products' },
  { code: '322', label: 'Paper' },
  { code: '323', label: 'Printing' },
  { code: '324', label: 'Petroleum & Coal' },
  { code: '325', label: 'Chemicals' },
  { code: '326', label: 'Plastics & Rubber' },
  { code: '327', label: 'Nonmetallic Minerals' },
  { code: '331', label: 'Primary Metals' },
  { code: '332', label: 'Fabricated Metals' },
  { code: '333', label: 'Machinery' },
  { code: '334', label: 'Electronics' },
  { code: '335', label: 'Electrical Equipment' },
  { code: '336', label: 'Transportation Equipment' },
  { code: '337', label: 'Furniture' },
  { code: '339', label: 'Miscellaneous' },
];

interface ExportFilters {
  states: string[];
  naicsPrefix: string;
  minSources: number;
  minConfidence: number;
  hasCompany: boolean;
  hasCoordinates: boolean;
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

  const [filters, setFilters] = useState<ExportFilters>({
    states: [],
    naicsPrefix: '',
    minSources: 1,
    minConfidence: 0,
    hasCompany: false,
    hasCoordinates: false,
  });

  const [showStates, setShowStates] = useState(false);

  // Build query params for preview
  const previewParams = {
    states: filters.states.join(',') || undefined,
    naicsPrefix: filters.naicsPrefix || undefined,
    minSources: filters.minSources > 1 ? filters.minSources : undefined,
    minConfidence: filters.minConfidence > 0 ? filters.minConfidence : undefined,
    hasCompany: filters.hasCompany || undefined,
    hasCoordinates: filters.hasCoordinates || undefined,
  };

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['export', 'preview', previewParams],
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
      states: filters.states.length > 0 ? filters.states : undefined,
      naicsPrefix: filters.naicsPrefix || undefined,
      minSources: filters.minSources > 1 ? filters.minSources : undefined,
      minConfidence: filters.minConfidence > 0 ? filters.minConfidence : undefined,
      hasCompany: filters.hasCompany || undefined,
      hasCoordinates: filters.hasCoordinates || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export', 'history'] });
    },
  });

  const hasActiveFilters = filters.states.length > 0 || filters.naicsPrefix || filters.minSources > 1 || filters.minConfidence > 0 || filters.hasCompany || filters.hasCoordinates;

  const toggleState = useCallback((state: string) => {
    setFilters(f => ({
      ...f,
      states: f.states.includes(state) ? f.states.filter(s => s !== state) : [...f.states, state],
    }));
  }, []);

  const clearFilters = () => {
    setFilters({
      states: [],
      naicsPrefix: '',
      minSources: 1,
      minConfidence: 0,
      hasCompany: false,
      hasCoordinates: false,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Export</h2>
        <p className="text-sm text-fg-muted mt-1">Generate CSV files for Archangel import</p>
      </div>

      {/* Filters */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-fg-soft" />
            <span className="text-sm font-medium text-fg-default">Filters</span>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-fg-muted hover:text-fg-default transition-colors">
              Clear all
            </button>
          )}
        </div>

        {/* States filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-fg-muted uppercase tracking-wider">States</label>
            <button
              onClick={() => setShowStates(!showStates)}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              {showStates ? 'Hide' : filters.states.length > 0 ? `${filters.states.length} selected` : 'Select states'}
            </button>
          </div>
          {filters.states.length > 0 && !showStates && (
            <div className="flex flex-wrap gap-1">
              {filters.states.map(s => (
                <button
                  key={s}
                  onClick={() => toggleState(s)}
                  className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded hover:bg-indigo-500/30"
                >
                  {s} &times;
                </button>
              ))}
            </div>
          )}
          {showStates && (
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {US_STATES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleState(s)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    filters.states.includes(s)
                      ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50'
                      : 'bg-bg-inset text-fg-muted hover:bg-bg-surface hover:text-fg-default'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* NAICS filter */}
        <div>
          <label className="text-xs text-fg-muted uppercase tracking-wider block mb-2">Industry (NAICS)</label>
          <select
            value={filters.naicsPrefix}
            onChange={(e) => setFilters(f => ({ ...f, naicsPrefix: e.target.value }))}
            className="w-full bg-bg-inset border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-fg-default"
          >
            <option value="">All Manufacturing (31-33)</option>
            {NAICS_SECTORS.map(s => (
              <option key={s.code} value={s.code}>{s.code} — {s.label}</option>
            ))}
          </select>
        </div>

        {/* Quality filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider block mb-2">Min Sources</label>
            <select
              value={filters.minSources}
              onChange={(e) => setFilters(f => ({ ...f, minSources: Number(e.target.value) }))}
              className="w-full bg-bg-inset border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-fg-default"
            >
              <option value="1">Any (1+)</option>
              <option value="2">2+ sources</option>
              <option value="3">3+ sources</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider block mb-2">Min Confidence</label>
            <select
              value={filters.minConfidence}
              onChange={(e) => setFilters(f => ({ ...f, minConfidence: Number(e.target.value) }))}
              className="w-full bg-bg-inset border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-fg-default"
            >
              <option value="0">Any</option>
              <option value="30">30+</option>
              <option value="50">50+</option>
              <option value="70">70+ (High)</option>
              <option value="90">90+ (Very High)</option>
            </select>
          </div>
        </div>

        {/* Boolean filters */}
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasCompany}
              onChange={(e) => setFilters(f => ({ ...f, hasCompany: e.target.checked }))}
              className="rounded bg-bg-inset border-border-subtle text-indigo-500"
            />
            Has company
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasCoordinates}
              onChange={(e) => setFilters(f => ({ ...f, hasCoordinates: e.target.checked }))}
              className="rounded bg-bg-inset border-border-subtle text-indigo-500"
            />
            Has coordinates
          </label>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-fg-default">Export Preview</span>
          {previewLoading && <span className="text-xs text-fg-soft animate-pulse">Counting...</span>}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-bg-inset rounded-lg p-3 text-center">
            <Package className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <div className="text-lg font-semibold text-fg-default">
              {preview ? preview.facilityCount.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-fg-muted">Facilities</div>
          </div>
          <div className="bg-bg-inset rounded-lg p-3 text-center">
            <Building2 className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <div className="text-lg font-semibold text-fg-default">
              {preview ? preview.companyCount.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-fg-muted">Companies</div>
          </div>
          <div className="bg-bg-inset rounded-lg p-3 text-center">
            <MapPin className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
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
              <span>{Math.round((preview.facilityCount / overview.totalFacilities) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-bg-inset rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (preview.facilityCount / overview.totalFacilities) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || !preview || preview.facilityCount === 0}
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
              Generate CSV Export
              {preview && preview.facilityCount > 0 && (
                <span className="text-indigo-200 text-xs">({preview.facilityCount.toLocaleString()} records)</span>
              )}
            </>
          )}
        </button>

        {generateMutation.isSuccess && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-300">
              Export generated successfully!{' '}
              {generateMutation.data?.filePath && (
                <a
                  href={exportApi.downloadUrl(generateMutation.data.filePath)}
                  className="underline hover:text-emerald-200"
                  download
                >
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
              <div
                key={exp.id}
                className="flex items-center justify-between py-2 px-3 bg-bg-inset rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileDown className="w-4 h-4 text-fg-soft" />
                  <div>
                    <div className="text-sm text-fg-default">
                      {exp.facilityCount.toLocaleString()} facilities
                      {exp.companyCount > 0 && ` / ${exp.companyCount.toLocaleString()} companies`}
                    </div>
                    <div className="text-xs text-fg-muted">
                      {formatDate(exp.createdAt)}
                      {exp.fileSize && ` · ${formatBytes(exp.fileSize)}`}
                      {exp.filters && Object.keys(exp.filters).length > 0 && (
                        <span className="ml-1 text-fg-soft">
                          (filtered)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {exp.status === 'completed' && exp.filePath && (
                    <a
                      href={exportApi.downloadUrl(exp.filePath)}
                      download
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    exp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    exp.status === 'generating' ? 'bg-amber-500/10 text-amber-400' :
                    exp.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-bg-surface text-fg-muted'
                  }`}>
                    {exp.status}
                  </span>
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
          CSV Format
        </h3>
        <div className="text-xs text-fg-muted space-y-1 font-mono">
          <p>company_name, facility_name, address, city, state, zip,</p>
          <p>latitude, longitude, naics_code, naics_description,</p>
          <p>employee_count, source_count, confidence, epa_registry_id</p>
        </div>
        <p className="text-xs text-fg-soft mt-3">
          Compatible with Archangel's bulk import format. Facilities are sorted by state, city, then name.
        </p>
      </div>
    </div>
  );
}
