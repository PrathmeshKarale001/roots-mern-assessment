import ApiError from './ApiError.js';
import { config } from '../config/env.js';

const YYYY_MM_DD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_PREFIX_REGEX = /^(\d{4})-(\d{2})-(\d{2})T/;

/**
 * Checks whether a value can be parsed into a valid calendar date without rollover.
 */
export function isValidDateInput(val) {
  try {
    const parsed = parseUtcCalendarDate(val);
    return parsed instanceof Date && !Number.isNaN(parsed.getTime());
  } catch {
    return false;
  }
}

/**
 * Normalizes a YYYY-MM-DD string, ISO timestamp string, or Date object
 * to UTC midnight (YYYY-MM-DDT00:00:00.000Z) without local timezone drift.
 */
export function parseUtcCalendarDate(val) {
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) {
      throw ApiError.badRequest('Invalid Date instance provided');
    }
    return new Date(
      Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate(), 0, 0, 0, 0)
    );
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const ymdMatch = YYYY_MM_DD_REGEX.exec(trimmed) || ISO_DATE_PREFIX_REGEX.exec(trimmed);

    if (ymdMatch) {
      const year = Number(ymdMatch[1]);
      const month = Number(ymdMatch[2]);
      const day = Number(ymdMatch[3]);

      const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      if (
        utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() !== month - 1 ||
        utcDate.getUTCDate() !== day
      ) {
        throw ApiError.badRequest(`Invalid calendar date: ${val}`);
      }

      if (ISO_DATE_PREFIX_REGEX.test(trimmed)) {
        const fullParsed = new Date(trimmed);
        if (Number.isNaN(fullParsed.getTime())) {
          throw ApiError.badRequest(`Invalid ISO date string: ${val}`);
        }
        return new Date(
          Date.UTC(
            fullParsed.getUTCFullYear(),
            fullParsed.getUTCMonth(),
            fullParsed.getUTCDate(),
            0,
            0,
            0,
            0
          )
        );
      }

      return utcDate;
    }
  }

  throw ApiError.badRequest(`Invalid date format (expected YYYY-MM-DD): ${String(val)}`);
}

/**
 * Formats a Date or date string as YYYY-MM-DD in UTC.
 */
export function formatUtcDate(date) {
  if (date === null || date === undefined) {
    return null;
  }
  const normalized = parseUtcCalendarDate(date);
  return normalized.toISOString().slice(0, 10);
}

/**
 * Returns true if d1 and d2 represent the exact same UTC calendar day.
 */
export function isSameCalendarDay(d1, d2) {
  return parseUtcCalendarDate(d1).getTime() === parseUtcCalendarDate(d2).getTime();
}

/**
 * Returns true if d1 is strictly before d2 in UTC calendar days.
 */
export function isBeforeCalendarDay(d1, d2) {
  return parseUtcCalendarDate(d1).getTime() < parseUtcCalendarDate(d2).getTime();
}

/**
 * Returns true if date falls within [start, end] inclusive in UTC calendar days.
 */
export function isDateInRangeInclusive(date, start, end) {
  const targetTime = parseUtcCalendarDate(date).getTime();
  const startTime = parseUtcCalendarDate(start).getTime();
  const endTime = parseUtcCalendarDate(end).getTime();
  return targetTime >= startTime && targetTime <= endTime;
}

/**
 * Returns today's calendar date in the configured application timezone normalized to UTC midnight.
 */
export function getTodayUtcCalendarDate(timeZone = config.appTimezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const ymd = formatter.format(new Date());
  return parseUtcCalendarDate(ymd);
}
