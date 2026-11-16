import Employee from '../models/Employee.js';
import Task from '../models/Task.js';
import Counter from '../models/Counter.js';
import {
  ACTIVE_TASK_STATUSES,
  MAX_ACTIVE_TASKS_PER_EMPLOYEE,
  PRIORITY_RANKS,
  STATUS_TRANSITIONS,
  TERMINAL_TASK_STATUSES,
} from '../constants/enums.js';
import ApiError from '../utils/ApiError.js';
import {
  formatUtcDate,
  getTodayUtcCalendarDate,
  isDateInRangeInclusive,
  parseUtcCalendarDate,
} from '../utils/dates.js';
import {
  enrichTaskListWithOverdue,
  enrichTaskWithOverdue,
} from '../utils/overdue.js';
import {
  buildPaginationMeta,
  buildTaskFilterQuery,
  buildTaskSortSpec,
  parsePagination,
} from '../utils/queryBuilder.js';

const ASSIGNEE_POPULATE_FIELDS =
  'employeeId fullName email phone department role status activeTaskCount leaveStart leaveEnd';

function emptyAssigneeSnapshot() {
  return {
    employeeId: null,
    fullName: null,
    email: null,
    department: null,
    role: null,
    isDeleted: false,
  };
}

function buildAssigneeSnapshot(employee) {
  if (!employee) {
    return emptyAssigneeSnapshot();
  }
  return {
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department,
    role: employee.role,
    isDeleted: false,
  };
}

function applyEditableTaskFields(task, data, effectiveStartDate, effectiveDueDate) {
  if (data.title !== undefined) {
    task.title = data.title.trim();
  }
  if (data.description !== undefined) {
    task.description = data.description.trim();
  }
  if (data.department !== undefined) {
    task.department = data.department;
  }
  if (data.priority !== undefined) {
    task.priority = data.priority;
    task.priorityRank = PRIORITY_RANKS[data.priority] || 2;
  }
  if (data.startDate !== undefined) {
    task.startDate = effectiveStartDate;
  }
  if (data.dueDate !== undefined) {
    task.dueDate = effectiveDueDate;
  }
}

export async function claimEmployeeCapacity(employeeId, startDate) {
  const normalizedStart = parseUtcCalendarDate(startDate);

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw ApiError.notFound('Assigned employee not found');
  }

  if (employee.status === 'Inactive') {
    throw ApiError.badRequest('Cannot assign tasks to an Inactive employee');
  }

  if (employee.status === 'On Leave') {
    const leaveStart = parseUtcCalendarDate(employee.leaveStart);
    const leaveEnd = parseUtcCalendarDate(employee.leaveEnd);
    if (isDateInRangeInclusive(normalizedStart, leaveStart, leaveEnd)) {
      throw ApiError.badRequest(
        `Employee is on leave during the task start date (${formatUtcDate(leaveStart)} to ${formatUtcDate(leaveEnd)})`
      );
    }
  }

  if (employee.activeTaskCount >= MAX_ACTIVE_TASKS_PER_EMPLOYEE) {
    throw ApiError.badRequest(
      'Employee already holds the maximum of 3 active tasks (Todo or In Progress)'
    );
  }

  const updated = await Employee.findOneAndUpdate(
    {
      _id: employeeId,
      activeTaskCount: { $lt: MAX_ACTIVE_TASKS_PER_EMPLOYEE },
      $or: [
        { status: 'Active' },
        {
          status: 'On Leave',
          $or: [
            { leaveStart: { $gt: normalizedStart } },
            { leaveEnd: { $lt: normalizedStart } },
          ],
        },
      ],
    },
    { $inc: { activeTaskCount: 1 } },
    { new: true }
  );

  if (!updated) {
    const latest = await Employee.findById(employeeId);
    if (!latest) {
      throw ApiError.notFound('Assigned employee not found');
    }
    if (latest.status === 'Inactive') {
      throw ApiError.badRequest('Cannot assign tasks to an Inactive employee');
    }
    if (latest.status === 'On Leave') {
      const leaveStart = parseUtcCalendarDate(latest.leaveStart);
      const leaveEnd = parseUtcCalendarDate(latest.leaveEnd);
      if (isDateInRangeInclusive(normalizedStart, leaveStart, leaveEnd)) {
        throw ApiError.badRequest(
          `Employee is on leave during the task start date (${formatUtcDate(leaveStart)} to ${formatUtcDate(leaveEnd)})`
        );
      }
    }
    throw ApiError.badRequest(
      'Employee already holds the maximum of 3 active tasks (Todo or In Progress)'
    );
  }

  return {
    employee: updated,
    snapshot: buildAssigneeSnapshot(updated),
  };
}

export async function releaseEmployeeCapacity(employeeId) {
  if (!employeeId) {
    return;
  }
  await Employee.findOneAndUpdate(
    { _id: employeeId, activeTaskCount: { $gt: 0 } },
    { $inc: { activeTaskCount: -1 } }
  );
}

export async function listTasks(queryParams = {}) {
  const todayUtc = getTodayUtcCalendarDate();
  const filter = buildTaskFilterQuery(queryParams, todayUtc);
  const sortSpec = buildTaskSortSpec(queryParams);
  const { page, limit, skip } = parsePagination(queryParams);

  const findQuery = Task.find(filter)
    .populate('assignee', ASSIGNEE_POPULATE_FIELDS)
    .sort(sortSpec)
    .skip(skip)
    .limit(limit);

  if (queryParams.sortBy === 'title') {
    findQuery.collation({ locale: 'en', strength: 2 });
  }

  const [docs, total] = await Promise.all([
    findQuery,
    Task.countDocuments(filter),
  ]);

  return {
    items: enrichTaskListWithOverdue(docs, todayUtc),
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function getTaskById(id) {
  const task = await Task.findById(id).populate('assignee', ASSIGNEE_POPULATE_FIELDS);
  if (!task) {
    throw ApiError.notFound('Task not found');
  }
  return enrichTaskWithOverdue(task);
}

export async function createTask(data) {
  const startDate = parseUtcCalendarDate(data.startDate);
  const dueDate = parseUtcCalendarDate(data.dueDate);

  if (dueDate.getTime() < startDate.getTime()) {
    throw ApiError.badRequest('dueDate must be on or after startDate');
  }

  const assigneeId = data.assignee || null;
  let assigneeSnapshot = emptyAssigneeSnapshot();

  if (assigneeId) {
    const claimed = await claimEmployeeCapacity(assigneeId, startDate);
    assigneeSnapshot = claimed.snapshot;
  }

  try {
    const seq = await Counter.getNextSequence('taskId');
    const taskId = `TSK-${String(seq).padStart(4, '0')}`;
    const priority = data.priority || 'Medium';

    const task = await Task.create({
      taskId,
      title: data.title.trim(),
      description: data.description !== undefined ? data.description.trim() : '',
      department: data.department,
      priority,
      priorityRank: PRIORITY_RANKS[priority] || 2,
      status: 'Todo',
      startDate,
      dueDate,
      completedDate: null,
      assignee: assigneeId,
      assigneeSnapshot,
    });

    await task.populate('assignee', ASSIGNEE_POPULATE_FIELDS);
    return enrichTaskWithOverdue(task);
  } catch (err) {
    if (assigneeId) {
      await releaseEmployeeCapacity(assigneeId);
    }
    throw err;
  }
}

export async function updateTask(id, data) {
  const task = await Task.findById(id);
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  if (TERMINAL_TASK_STATUSES.includes(task.status)) {
    throw ApiError.badRequest('Completed or Cancelled tasks cannot be edited');
  }

  const effectiveStartDate =
    data.startDate !== undefined
      ? parseUtcCalendarDate(data.startDate)
      : parseUtcCalendarDate(task.startDate);
  const effectiveDueDate =
    data.dueDate !== undefined
      ? parseUtcCalendarDate(data.dueDate)
      : parseUtcCalendarDate(task.dueDate);

  if (effectiveDueDate.getTime() < effectiveStartDate.getTime()) {
    throw ApiError.badRequest('dueDate must be on or after startDate');
  }

  const currentAssigneeId = task.assignee ? String(task.assignee) : null;
  const isAssigneeChanging =
    data.assignee !== undefined &&
    String(data.assignee || '') !== String(currentAssigneeId || '');

  if (isAssigneeChanging) {
    const nextAssigneeId = data.assignee || null;
    let nextSnapshot = emptyAssigneeSnapshot();

    if (nextAssigneeId) {
      const claimed = await claimEmployeeCapacity(nextAssigneeId, effectiveStartDate);
      nextSnapshot = claimed.snapshot;
    }

    try {
      applyEditableTaskFields(task, data, effectiveStartDate, effectiveDueDate);
      task.assignee = nextAssigneeId;
      task.assigneeSnapshot = nextSnapshot;
      await task.save();
    } catch (err) {
      if (nextAssigneeId) {
        await releaseEmployeeCapacity(nextAssigneeId);
      }
      throw err;
    }

    if (currentAssigneeId) {
      await releaseEmployeeCapacity(currentAssigneeId);
    }

    await task.populate('assignee', ASSIGNEE_POPULATE_FIELDS);
    return enrichTaskWithOverdue(task);
  }

  if (currentAssigneeId && data.startDate !== undefined) {
    const employee = await Employee.findById(currentAssigneeId);
    if (employee && employee.status === 'On Leave') {
      const leaveStart = parseUtcCalendarDate(employee.leaveStart);
      const leaveEnd = parseUtcCalendarDate(employee.leaveEnd);
      if (isDateInRangeInclusive(effectiveStartDate, leaveStart, leaveEnd)) {
        throw ApiError.badRequest(
          `Employee is on leave during the task start date (${formatUtcDate(leaveStart)} to ${formatUtcDate(leaveEnd)})`
        );
      }
    }
  }

  applyEditableTaskFields(task, data, effectiveStartDate, effectiveDueDate);
  await task.save();
  await task.populate('assignee', ASSIGNEE_POPULATE_FIELDS);
  return enrichTaskWithOverdue(task);
}

export async function updateTaskStatus(id, newStatus) {
  const task = await Task.findById(id);
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  if (TERMINAL_TASK_STATUSES.includes(task.status)) {
    throw ApiError.badRequest(
      'Completed or Cancelled tasks cannot transition to another status'
    );
  }

  const allowedTransitions = STATUS_TRANSITIONS[task.status] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw ApiError.badRequest(
      `Invalid status transition from ${task.status} to ${newStatus}`
    );
  }

  const updateFields = { status: newStatus };
  if (newStatus === 'Completed') {
    updateFields.completedDate = new Date();
  }

  const updatedTask = await Task.findOneAndUpdate(
    { _id: id, status: task.status },
    { $set: updateFields },
    { new: true }
  ).populate('assignee', ASSIGNEE_POPULATE_FIELDS);

  if (!updatedTask) {
    throw ApiError.conflict('Task status was modified concurrently');
  }

  if (
    ACTIVE_TASK_STATUSES.includes(task.status) &&
    TERMINAL_TASK_STATUSES.includes(newStatus) &&
    task.assignee
  ) {
    await releaseEmployeeCapacity(task.assignee);
  }

  return enrichTaskWithOverdue(updatedTask);
}

export async function deleteTask(id) {
  const deletedTask = await Task.findByIdAndDelete(id);
  if (!deletedTask) {
    throw ApiError.notFound('Task not found');
  }

  if (ACTIVE_TASK_STATUSES.includes(deletedTask.status) && deletedTask.assignee) {
    await releaseEmployeeCapacity(deletedTask.assignee);
  }

  return deletedTask;
}

export const taskService = {
  claimEmployeeCapacity,
  releaseEmployeeCapacity,
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
};

export default taskService;
