import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { MANUFACTURING_SUBSECTORS } from '@shared/naics';
import {
  ArrowLeft, MapPin, Hash, Building2, Database, Clock,
  Pencil, Save, X, Check,
} from 'lucide-react';

/** Format a date as M/D/YYYY HH:MM:SS AM/PM CST */
function formatCST(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' CST';
}

/** Determine badge style for a source entry */
function getSourceBadge(source: string, sourceRecordId: string | null): { label: string; className: string } {
  const FEDERAL = ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'];
  if (FEDERAL.includes(source)) {
    return { label: 'Federal', className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
  }
  if (source === 'manual') {
    const isHumanEdit = sourceRecordId?.startsWith('openx_edit_');
    if (isHumanEdit) {
      return { label: 'Manual Edit', className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' };
    }
    return { label: 'Automated', className: 'bg-white/5 text-fg-soft border-white/10' };
  }
  return { label: 'Unknown', className: 'bg-white/5 text-fg-soft border-white/10' };
}

/** Display name for a source */
function getSourceDisplayName(source: string, sourceRecordId: string | null): string {
  const FEDERAL = ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'];
  if (FEDERAL.includes(source)) {
    return DATA_SOURCES[source as keyof typeof DATA_SOURCES]?.name ?? source;
  }
  if (source === 'manual') {
    const isHumanEdit = sourceRecordId?.startsWith('openx_edit_');
    return isHumanEdit ? 'Open X' : 'System';
  }
  return source;
}

interface EditState {
  name: string;
  companyName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  primaryNaics: string;
  primaryNaicsDescription: string;
  employeeCount: string;
}

export default function FacilityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: facility, isLoading } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => facilitiesApi.get(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Record<string, unknown>>) => facilitiesApi.update(id!, data as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility', id] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setIsEditing(false);
      setEditState(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  function startEditing() {
    if (!facility) return;
    setEditState({
      name: facility.name || '',
      companyName: facility.companyName || '',
      address: facility.address || '',
      city: facility.city || '',
      state: facility.state || '',
      zip: facility.zip || '',
      primaryNaics: facility.primaryNaics || '',
      primaryNaicsDescription: facility.primaryNaicsDescription || '',
      employeeCount: facility.employeeCount ? String(facility.employeeCount) : '',
    });
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditState(null);
  }

  function handleSave() {
    if (!editState || !facility) return;
    const changes: Record<string, unknown> = {};
    if (editState.name !== (facility.name || '')) changes.name = editState.name;
    if (editState.companyName !== (facility.companyName || '')) changes.companyName = editState.companyName;
    if (editState.address !== (facility.address || '')) changes.address = editState.address;
    if (editState.city !== (facility.city || '')) changes.city = editState.city;
    if (editState.state !== (facility.state || '')) changes.state = editState.state;
    if (editState.zip !== (facility.zip || '')) changes.zip = editState.zip;
    if (editState.primaryNaics !== (facility.primaryNaics || '')) {
      changes.primaryNaics = editState.primaryNaics;
      changes.primaryNaicsDescription = editState.primaryNaicsDescription;
    }
    if (editState.employeeCount !== (facility.employeeCount ? String(facility.employeeCount) : '')) {
      changes.employeeCount = editState.employeeCount ? parseInt(editState.employeeCount) : null;
    }
    if (Object.keys(changes).length === 0) {
      cancelEditing();
      return;
    }
    updateMutation.mutate(changes);
  }

  function updateField(field: keyof EditState, value: string) {
    setEditState(prev => prev ? { ...prev, [field]: value } : null);
  }

  function handleNaicsChange(code: string) {
    const subsector = MANUFACTURING_SUBSECTORS.find(s => code.startsWith(s.code));
    setEditState(prev => prev ? {
      ...prev,
      primaryNaics: code,
      primaryNaicsDescription: subsector?.title || prev.primaryNaicsDescription,
    } : null);
  }

  if (isLoading) {
    return <div className="text-sm text-fg-soft">Loading...</div>;
  }

  if (!facility) {
    return <div className="text-sm text-fg-soft">Factory not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg-default transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Saved as Open X update
            </span>
          )}
          {isEditing ? (
            <>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-fg-muted hover:text-fg-default rounded-lg border border-white/10 hover:border-white/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 rounded-lg transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-fg-muted hover:text-fg-default rounded-lg border border-white/10 hover:border-white/20 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {updateMutation.isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          Failed to save: {(updateMutation.error as Error).message}
        </div>
      )}

      {/* Name + Company */}
      <div>
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editState!.name}
              onChange={e => updateField('name', e.target.value)}
              className="text-xl font-semibold text-fg-default bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 w-full focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              style={{ outline: 'none' }}
              placeholder="Factory name"
            />
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <input
                type="text"
                value={editState!.companyName}
                onChange={e => updateField('companyName', e.target.value)}
                className="text-sm text-fg-muted bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 flex-1 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                style={{ outline: 'none' }}
                placeholder="Company name"
              />
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-fg-default">{facility.name}</h2>
            {facility.companyName && (
              <p className="text-sm text-fg-muted mt-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-500" /> {facility.companyName}
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Location */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
          <h3 className="text-xs font-medium text-fg-soft mb-3 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</h3>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editState!.address}
                onChange={e => updateField('address', e.target.value)}
                placeholder="Street address"
                className="w-full text-sm text-fg-default bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                style={{ outline: 'none' }}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={editState!.city}
                  onChange={e => updateField('city', e.target.value)}
                  placeholder="City"
                  className="text-sm text-fg-default bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  style={{ outline: 'none' }}
                />
                <input
                  type="text"
                  value={editState!.state}
                  onChange={e => updateField('state', e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="ST"
                  maxLength={2}
                  className="text-sm text-fg-default bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  style={{ outline: 'none' }}
                />
                <input
                  type="text"
                  value={editState!.zip}
                  onChange={e => updateField('zip', e.target.value)}
                  placeholder="ZIP"
                  className="text-sm text-fg-default bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  style={{ outline: 'none' }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-sm">
              {facility.address && <p className="text-fg-default">{facility.address}</p>}
              <p className="text-fg-muted">{[facility.city, facility.state, facility.zip].filter(Boolean).join(', ')}</p>
              {facility.latitude && facility.longitude && (
                <p className="text-xs font-mono text-fg-soft">{facility.latitude}, {facility.longitude}</p>
              )}
            </div>
          )}
        </div>

        {/* Classification */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
          <h3 className="text-xs font-medium text-fg-soft mb-3 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Classification</h3>
          {isEditing ? (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-fg-soft uppercase tracking-wider mb-1 block">NAICS Code</label>
                <input
                  type="text"
                  value={editState!.primaryNaics}
                  onChange={e => handleNaicsChange(e.target.value)}
                  placeholder="e.g. 325199"
                  maxLength={6}
                  className="w-full text-sm text-fg-default font-mono bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  style={{ outline: 'none' }}
                />
                {editState!.primaryNaics && (
                  <p className="text-xs text-fg-soft mt-1">
                    {MANUFACTURING_SUBSECTORS.find(s => editState!.primaryNaics.startsWith(s.code))?.title || 'Unknown subsector'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] text-fg-soft uppercase tracking-wider mb-1 block">Description</label>
                <input
                  type="text"
                  value={editState!.primaryNaicsDescription}
                  onChange={e => updateField('primaryNaicsDescription', e.target.value)}
                  placeholder="NAICS description"
                  className="w-full text-sm text-fg-default bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  style={{ outline: 'none' }}
                />
              </div>
              <div>
                <label className="text-[10px] text-fg-soft uppercase tracking-wider mb-1 block">Employee Count</label>
                <input
                  type="number"
                  value={editState!.employeeCount}
                  onChange={e => updateField('employeeCount', e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full text-sm text-fg-default bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  style={{ outline: 'none' }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-sm">
              {facility.primaryNaics && (
                <p className="text-fg-default">
                  <span className="font-mono text-fg-muted">{facility.primaryNaics}</span>{' '}
                  {facility.primaryNaicsDescription}
                </p>
              )}
              {facility.employeeCount && <p className="text-fg-muted">{facility.employeeCount.toLocaleString()} employees</p>}
              <p className="text-fg-muted">Confidence: {facility.confidence}/100</p>
              <p className="text-fg-muted">Sources: {facility.sourceCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sources */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
        <h3 className="text-xs font-medium text-fg-soft mb-3 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" /> Sources
        </h3>
        {facility.facilitySources && facility.facilitySources.length > 0 ? (
          <div className="space-y-3">
            {facility.facilitySources.map((fs, idx) => {
              const sourceInfo = DATA_SOURCES[fs.source];
              const badge = getSourceBadge(fs.source, fs.sourceRecordId);
              const displayName = getSourceDisplayName(fs.source, fs.sourceRecordId);
              const isFederal = ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'].includes(fs.source);
              const isHumanEdit = fs.source === 'manual' && fs.sourceRecordId?.startsWith('openx_edit_');

              return (
                <div key={idx} className="flex items-start gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: sourceInfo?.color ?? (fs.source === 'manual' && !isHumanEdit ? '#6B7280' : sourceInfo?.color ?? '#6B7280') }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg-default">
                        {displayName}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badge.className}`}>
                        {badge.label}
                      </span>
                      {isFederal && fs.sourceRecordId && (
                        <span className="text-xs font-mono text-fg-soft truncate">
                          {fs.sourceRecordId}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {fs.fieldsProvided.length > 0 && (
                        <span className="text-xs text-fg-muted">
                          {isHumanEdit ? 'Updated: ' : ''}{fs.fieldsProvided.join(', ')}
                        </span>
                      )}
                      <span className="text-xs text-fg-soft flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatCST(fs.linkedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {facility.sources.map((source) => {
              const sourceInfo = DATA_SOURCES[source];
              const badge = getSourceBadge(source, null);
              const displayName = getSourceDisplayName(source, null);
              return (
                <div key={source} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sourceInfo?.color ?? '#6B7280' }}
                  />
                  <span className="text-sm text-fg-default">{displayName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <p className="text-xs text-fg-soft flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last updated {formatCST(facility.updatedAt)}
          </p>
        </div>
      </div>

      {/* Edit hint */}
      {!isEditing && (
        <p className="text-xs text-fg-soft text-center">
          Click Edit to correct any data. Changes are tracked as Open X updates for full audit visibility.
        </p>
      )}
    </div>
  );
}
