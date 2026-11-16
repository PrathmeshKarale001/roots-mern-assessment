/**
 * Formats a server ISO/UTC date string as a crisp human-readable UTC calendar date
 * (e.g. "16 Nov 2026") without local timezone shift.
 */
export function formatDisplayDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Extracts YYYY-MM-DD in UTC for <input type="date" /> controls.
 */
export function toDateInputValue(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/**
 * Returns today's local YYYY-MM-DD for default form fields.
 */
export function getTodayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDateInsideWindow(dateStr, startStr, endStr) {
  if (!dateStr || !startStr || !endStr) return false;
  const d = toDateInputValue(dateStr);
  const s = toDateInputValue(startStr);
  const e = toDateInputValue(endStr);
  return d >= s && d <= e;
}

export function getInitials(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
