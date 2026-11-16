const RAW_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export class ApiClientError extends Error {
  constructor(message, status, details = []) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

export function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value).trim());
    }
  });
  const encoded = searchParams.toString();
  return encoded ? `?${encoded}` : '';
}

export async function apiRequest(path, { method = 'GET', body, params, signal } = {}) {
  const url = `${API_BASE_URL}${path}${buildQueryString(params)}`;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Request failed with status ${response.status}`;
    const details = payload?.error?.details || payload?.errors || [];
    throw new ApiClientError(message, response.status, details);
  }

  return payload;
}

export async function downloadCsvFile(path, params = {}, fallbackFilename = 'tasks-export.csv') {
  const url = `${API_BASE_URL}${path}${buildQueryString(params)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/csv' },
  });

  if (!response.ok) {
    let message = 'Failed to export CSV';
    try {
      const errJson = await response.json();
      message = errJson?.error?.message || errJson?.message || message;
    } catch {
      // ignore non-json body
    }
    throw new ApiClientError(message, response.status);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = filenameMatch?.[1] || fallbackFilename;

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
  return filename;
}
