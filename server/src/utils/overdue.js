import { TERMINAL_TASK_STATUSES } from '../constants/enums.js';
import { getTodayUtcCalendarDate, parseUtcCalendarDate } from './dates.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * MongoDB query predicate matching overdue tasks:
 * today > dueDate (i.e. dueDate < todayUtc) AND status NOT in Completed / Cancelled.
 */
export function buildOverdueMongoFilter(todayUtc = getTodayUtcCalendarDate()) {
  return {
    dueDate: { $lt: todayUtc },
    status: { $nin: TERMINAL_TASK_STATUSES },
  };
}

/**
 * Computes { isOverdue, daysOverdue } for a task object or Mongoose document.
 */
export function computeTaskOverdueFields(task, todayUtc = getTodayUtcCalendarDate()) {
  if (!task || !task.dueDate || TERMINAL_TASK_STATUSES.includes(task.status)) {
    return { isOverdue: false, daysOverdue: 0 };
  }
  const dueUtc = parseUtcCalendarDate(task.dueDate);
  const diffMs = todayUtc.getTime() - dueUtc.getTime();
  if (diffMs <= 0) {
    return { isOverdue: false, daysOverdue: 0 };
  }
  return {
    isOverdue: true,
    daysOverdue: Math.round(diffMs / MS_PER_DAY),
  };
}

/**
 * Converts a Mongoose document or plain object into an overdue-enriched plain object.
 */
export function enrichTaskWithOverdue(task, todayUtc = getTodayUtcCalendarDate()) {
  if (!task) return null;
  const plain = typeof task.toObject === 'function' ? task.toObject() : { ...task };
  const { isOverdue, daysOverdue } = computeTaskOverdueFields(plain, todayUtc);
  return {
    ...plain,
    isOverdue,
    daysOverdue,
  };
}

export function enrichTaskListWithOverdue(tasks = [], todayUtc = getTodayUtcCalendarDate()) {
  return tasks.map((task) => enrichTaskWithOverdue(task, todayUtc));
}
