import { Download } from 'lucide-react';

export default function Export() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-default">Export</h2>
        <p className="text-sm text-fg-muted mt-1">Generate Archangel-compatible data files</p>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-xl p-8 text-center">
        <Download className="w-8 h-8 text-fg-soft mx-auto mb-3" />
        <p className="text-sm text-fg-muted">No facilities to export yet.</p>
        <p className="text-xs text-fg-soft mt-1">Fetch and process data sources first, then export golden records for Archangel.</p>
      </div>
    </div>
  );
}
