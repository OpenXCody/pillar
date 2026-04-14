import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { facilitiesApi } from '@/lib/api';
import { DATA_SOURCES } from '@shared/types';
import { ArrowLeft, MapPin, Hash, Building2, Database, Clock } from 'lucide-react';

export default function FacilityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: facility, isLoading } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => facilitiesApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="text-sm text-fg-soft">Loading...</div>;
  }

  if (!facility) {
    return <div className="text-sm text-fg-soft">Factory not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg-default transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h2 className="text-xl font-semibold text-fg-default">{facility.name}</h2>
        {facility.companyName && (
          <p className="text-sm text-fg-muted mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> {facility.companyName}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Location */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
          <h3 className="text-xs font-medium text-fg-soft mb-3 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</h3>
          <div className="space-y-1.5 text-sm">
            {facility.address && <p className="text-fg-default">{facility.address}</p>}
            <p className="text-fg-muted">{[facility.city, facility.state, facility.zip].filter(Boolean).join(', ')}</p>
            {facility.latitude && facility.longitude && (
              <p className="text-xs font-mono text-fg-soft">{facility.latitude}, {facility.longitude}</p>
            )}
          </div>
        </div>

        {/* Classification */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
          <h3 className="text-xs font-medium text-fg-soft mb-3 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Classification</h3>
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
              return (
                <div key={idx} className="flex items-start gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: sourceInfo?.color ?? '#6B7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg-default">
                        {sourceInfo?.name ?? fs.source}
                      </span>
                      {fs.sourceRecordId && (
                        <span className="text-xs font-mono text-fg-soft truncate">
                          {fs.sourceRecordId}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {fs.fieldsProvided.length > 0 && (
                        <span className="text-xs text-fg-muted">
                          {fs.fieldsProvided.join(', ')}
                        </span>
                      )}
                      <span className="text-xs text-fg-soft flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Linked {new Date(fs.linkedAt).toLocaleDateString()}
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
              return (
                <div key={source} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sourceInfo?.color ?? '#6B7280' }}
                  />
                  <span className="text-sm text-fg-default">
                    {sourceInfo?.name ?? source}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <p className="text-xs text-fg-soft flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last updated {new Date(facility.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
