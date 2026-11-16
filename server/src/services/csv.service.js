import Task from '../models/Task.js';
import { formatUtcDate, getTodayUtcCalendarDate } from '../utils/dates.js';
import { computeTaskOverdueFields } from '../utils/overdue.js';
import { buildTaskFilterQuery, buildTaskSortSpec } from '../utils/queryBuilder.js';
import { serializeCsvRow, UTF8_BOM } from '../utils/csv.js';

export const TASK_CSV_HEADERS = [
  'Task ID',
  'Title',
  'Description',
  'Assigned Employee',
  'Employee ID',
  'Employee Status',
  'Department',
  'Priority',
  'Status',
  'Overdue',
  'Days Overdue',
  'Start Date',
  'Due Date',
  'Completed Date',
  'Created Date',
];

function resolveEmployeeDisplay(task) {
  const snap = task.assigneeSnapshot || {};
  const populated =
    task.assignee && typeof task.assignee === 'object' ? task.assignee : null;

  if (populated && populated.fullName) {
    return {
      name: populated.fullName,
      employeeId: populated.employeeId || snap.employeeId || '',
      empStatus: populated.status || 'Active',
    };
  }

  if (snap.fullName) {
    return {
      name: snap.isDeleted ? `${snap.fullName} (Former Employee)` : snap.fullName,
      employeeId: snap.employeeId || '',
      empStatus: snap.isDeleted ? 'Former Employee' : 'Active',
    };
  }

  return {
    name: 'Unassigned',
    employeeId: '',
    empStatus: 'Unassigned',
  };
}

/**
 * Streams all tasks matching the query filter & sort (ignoring pagination) as RFC-4180 CSV.
 */
export async function streamTasksCsv(queryParams = {}, res) {
  const todayUtc = getTodayUtcCalendarDate();
  const filter = buildTaskFilterQuery(queryParams, todayUtc);
  const sortSpec = buildTaskSortSpec(queryParams);
  const filenameDate = formatUtcDate(todayUtc);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="roots-tasks-${filenameDate}.csv"`
  );

  res.write(UTF8_BOM);
  res.write(serializeCsvRow(TASK_CSV_HEADERS));

  const query = Task.find(filter)
    .populate('assignee', 'employeeId fullName email department role status')
    .sort(sortSpec)
    .lean();

  if (queryParams.sortBy === 'title') {
    query.collation({ locale: 'en', strength: 2 });
  }

  const cursor = query.cursor();

  for await (const task of cursor) {
    const { isOverdue, daysOverdue } = computeTaskOverdueFields(task, todayUtc);
    const emp = resolveEmployeeDisplay(task);

    const row = serializeCsvRow([
      { value: task.taskId },
      { value: task.title, sanitize: true },
      { value: task.description || '', sanitize: true },
      { value: emp.name, sanitize: true },
      { value: emp.employeeId, sanitize: true },
      { value: emp.empStatus },
      { value: task.department },
      { value: task.priority },
      { value: task.status },
      { value: isOverdue ? 'Yes' : 'No' },
      { value: isOverdue ? daysOverdue : 0 },
      { value: formatUtcDate(task.startDate) || '' },
      { value: formatUtcDate(task.dueDate) || '' },
      { value: task.completedDate ? formatUtcDate(task.completedDate) : '' },
      { value: task.createdAt ? formatUtcDate(task.createdAt) : '' },
    ]);

    res.write(row);
  }

  res.end();
}

export default { streamTasksCsv };
