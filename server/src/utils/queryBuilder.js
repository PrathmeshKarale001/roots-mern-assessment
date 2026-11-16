import { getTodayUtcCalendarDate, parseUtcCalendarDate } from './dates.js';
import { buildOverdueMongoFilter } from './overdue.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parsePagination(queryParams = {}) {
  const pageRaw = Number.parseInt(queryParams.page ?? '1', 10);
  const limitRaw = Number.parseInt(queryParams.limit ?? '10', 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const limit =
    Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(limitRaw, 100) : 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginationMeta(total, page, limit) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function buildEmployeeFilterQuery(queryParams = {}) {
  const clauses = [];

  if (queryParams.search && String(queryParams.search).trim()) {
    const regex = new RegExp(escapeRegex(String(queryParams.search).trim()), 'i');
    clauses.push({
      $or: [
        { fullName: regex },
        { email: regex },
        { employeeId: regex },
        { role: regex },
      ],
    });
  }

  if (queryParams.department) {
    clauses.push({ department: queryParams.department });
  }

  if (queryParams.status) {
    clauses.push({ status: queryParams.status });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

export function buildEmployeeSortSpec(queryParams = {}) {
  const sortBy = queryParams.sortBy || 'createdAt';
  const dir = queryParams.sortOrder === 'asc' ? 1 : -1;

  switch (sortBy) {
    case 'fullName':
      return { fullName: dir, _id: 1 };
    case 'joiningDate':
      return { joiningDate: dir, _id: 1 };
    case 'activeTaskCount':
      return { activeTaskCount: dir, fullName: 1, _id: 1 };
    case 'employeeId':
      return { employeeId: dir, _id: 1 };
    case 'createdAt':
    default:
      return { createdAt: dir, _id: dir };
  }
}

export function buildTaskFilterQuery(queryParams = {}, todayUtc = getTodayUtcCalendarDate()) {
  const clauses = [];

  if (queryParams.search && String(queryParams.search).trim()) {
    const regex = new RegExp(escapeRegex(String(queryParams.search).trim()), 'i');
    clauses.push({
      $or: [
        { title: regex },
        { taskId: regex },
        { 'assigneeSnapshot.fullName': regex },
        { 'assigneeSnapshot.employeeId': regex },
      ],
    });
  }

  if (queryParams.department) {
    clauses.push({ department: queryParams.department });
  }

  if (queryParams.priority) {
    clauses.push({ priority: queryParams.priority });
  }

  if (queryParams.status) {
    clauses.push({ status: queryParams.status });
  }

  if (queryParams.assignee) {
    if (queryParams.assignee === 'unassigned') {
      clauses.push({ assignee: null, 'assigneeSnapshot.isDeleted': { $ne: true } });
    } else {
      clauses.push({ assignee: queryParams.assignee });
    }
  }

  if (queryParams.overdue === 'true' || queryParams.overdue === true) {
    clauses.push(buildOverdueMongoFilter(todayUtc));
  } else if (queryParams.overdue === 'false' || queryParams.overdue === false) {
    clauses.push({ $nor: [buildOverdueMongoFilter(todayUtc)] });
  }

  if (queryParams.dueDate) {
    const exactDue = parseUtcCalendarDate(queryParams.dueDate);
    clauses.push({ dueDate: exactDue });
  }

  if (queryParams.dueFrom || queryParams.dueTo) {
    const range = {};
    if (queryParams.dueFrom) {
      range.$gte = parseUtcCalendarDate(queryParams.dueFrom);
    }
    if (queryParams.dueTo) {
      range.$lte = parseUtcCalendarDate(queryParams.dueTo);
    }
    clauses.push({ dueDate: range });
  }

  if (queryParams.duePreset) {
    if (queryParams.duePreset === 'overdue') {
      clauses.push(buildOverdueMongoFilter(todayUtc));
    } else if (queryParams.duePreset === 'today') {
      clauses.push({ dueDate: todayUtc });
    } else if (queryParams.duePreset === 'this_week' || queryParams.duePreset === 'upcoming_7d') {
      const weekAhead = new Date(todayUtc.getTime() + 7 * MS_PER_DAY);
      clauses.push({ dueDate: { $gte: todayUtc, $lte: weekAhead } });
    }
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

export function buildTaskSortSpec(queryParams = {}) {
  const sortBy = queryParams.sortBy || 'createdAt';
  const defaultOrder = sortBy === 'dueDate' || sortBy === 'title' ? 'asc' : 'desc';
  const order = queryParams.sortOrder || defaultOrder;
  const dir = order === 'asc' ? 1 : -1;

  switch (sortBy) {
    case 'priority':
      return { priorityRank: dir, dueDate: 1, _id: 1 };
    case 'dueDate':
      return { dueDate: dir, priorityRank: -1, _id: 1 };
    case 'title':
      return { title: dir, _id: 1 };
    case 'createdAt':
    default:
      return { createdAt: dir, _id: dir };
  }
}
