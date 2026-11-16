import Task from '../models/Task.js';
import Counter from '../models/Counter.js';
import { PRIORITY_RANKS } from '../constants/enums.js';
import ApiError from '../utils/ApiError.js';
import { parseUtcCalendarDate } from '../utils/dates.js';

const ASSIGNEE_POPULATE_FIELDS =
  'employeeId fullName email department role status activeTaskCount';

export async function listTasks(queryParams = {}) {
  const filter = {};
  if (queryParams.department) {
    filter.department = queryParams.department;
  }
  if (queryParams.status) {
    filter.status = queryParams.status;
  }
  if (queryParams.priority) {
    filter.priority = queryParams.priority;
  }
  return Task.find(filter)
    .populate('assignee', ASSIGNEE_POPULATE_FIELDS)
    .sort({ createdAt: -1 });
}

export async function getTaskById(id) {
  const task = await Task.findById(id).populate('assignee', ASSIGNEE_POPULATE_FIELDS);
  if (!task) {
    throw ApiError.notFound('Task not found');
  }
  return task;
}

export async function createTask(data) {
  const startDate = parseUtcCalendarDate(data.startDate);
  const dueDate = parseUtcCalendarDate(data.dueDate);

  if (dueDate.getTime() < startDate.getTime()) {
    throw ApiError.badRequest('dueDate must be on or after startDate');
  }

  const seq = await Counter.getNextSequence('taskId');
  const taskId = `TSK-${String(seq).padStart(4, '0')}`;
  const priority = data.priority || 'Medium';

  return Task.create({
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
    assignee: data.assignee || null,
  });
}

export async function updateTask(id, data) {
  const task = await Task.findById(id);
  if (!task) {
    throw ApiError.notFound('Task not found');
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
  if (data.assignee !== undefined) {
    task.assignee = data.assignee || null;
  }

  await task.save();
  return task;
}

export async function updateTaskStatus(id, newStatus) {
  const task = await Task.findById(id);
  if (!task) {
    throw ApiError.notFound('Task not found');
  }
  task.status = newStatus;
  if (newStatus === 'Completed') {
    task.completedDate = new Date();
  }
  await task.save();
  return task;
}

export async function deleteTask(id) {
  const deletedTask = await Task.findByIdAndDelete(id);
  if (!deletedTask) {
    throw ApiError.notFound('Task not found');
  }
  return deletedTask;
}

export const taskService = {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
};

export default taskService;
