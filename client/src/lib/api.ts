const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }
  return res.json();
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export const statsApi = {
  overview: () => apiFetch<import('@shared/types').StatsOverview>('/stats/overview'),
};

export const companiesApi = {
  list: (params: { search?: string; status?: string; cursor?: string; limit?: number }) =>
    apiFetch<import('@shared/types').PaginatedResponse<import('@shared/types').Company>>(`/companies${buildQuery(params)}`),
  get: (id: string) => apiFetch<import('@shared/types').CompanyDetail>(`/companies/${id}`),
  stats: () => apiFetch<{ unverified: number; verified: number; rejected: number }>('/companies/stats'),
};

export const facilitiesApi = {
  list: (params: { search?: string; state?: string; naics?: string; company?: string; minSources?: number; cursor?: string; limit?: number }) =>
    apiFetch<import('@shared/types').PaginatedResponse<import('@shared/types').Facility>>(`/facilities${buildQuery(params)}`),
  get: (id: string) => apiFetch<import('@shared/types').FacilityDetail>(`/facilities/${id}`),
};

export const sourcesApi = {
  list: () => apiFetch<{ sources: Array<{ key: string; name: string; lastRun: import('@shared/types').SourceRun | null; rawRecordCount: number }> }>('/sources'),
  runs: (source: string) => apiFetch<{ runs: import('@shared/types').SourceRun[] }>(`/sources/${source}/runs`),
  fetch: (source: string) => apiFetch<import('@shared/types').SourceRun>(`/sources/${source}/fetch`, { method: 'POST' }),
};

export const reviewApi = {
  list: (params: { status?: string; cursor?: string; limit?: number }) =>
    apiFetch<import('@shared/types').PaginatedResponse<import('@shared/types').MatchCandidate>>(`/review${buildQuery(params)}`),
  confirm: (id: string) => apiFetch<void>(`/review/${id}/confirm`, { method: 'POST' }),
  reject: (id: string) => apiFetch<void>(`/review/${id}/reject`, { method: 'POST' }),
  stats: () => apiFetch<{ pending: number; confirmed: number; rejected: number }>('/review/stats'),
};

export const exportApi = {
  generate: (filters: Record<string, unknown>) =>
    apiFetch<import('@shared/types').ExportRecord>('/export/generate', { method: 'POST', body: JSON.stringify(filters) }),
  history: () => apiFetch<{ exports: import('@shared/types').ExportRecord[] }>('/export/history'),
};

export const pipelineApi = {
  run: (source?: string) =>
    apiFetch<{ runId: string }>('/pipeline/run', { method: 'POST', body: JSON.stringify({ source }) }),
  status: () =>
    apiFetch<{ running: boolean; currentStage: string | null; currentSource: string | null }>('/pipeline/status'),
};
