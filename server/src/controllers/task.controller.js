import taskService from '../services/task.service.js';
import csvService from '../services/csv.service.js';

export async function getTasks(req, res) {
  const { items, pagination } = await taskService.listTasks(
    req.validated?.query ?? req.query
  );
  res.status(200).json({
    success: true,
    count: items.length,
    data: items,
    pagination,
  });
}

export async function exportTasksCsv(req, res) {
  await csvService.streamTasksCsv(req.validated?.query ?? req.query, res);
}

export async function getTaskById(req, res) {
  const task = await taskService.getTaskById(req.params.id);
  res.status(200).json({
    success: true,
    data: task,
  });
}

export async function createTask(req, res) {
  const task = await taskService.createTask(req.validated.body);
  res.status(201).json({
    success: true,
    data: task,
  });
}

export async function updateTask(req, res) {
  const task = await taskService.updateTask(req.params.id, req.validated.body);
  res.status(200).json({
    success: true,
    data: task,
  });
}

export async function deleteTask(req, res) {
  await taskService.deleteTask(req.params.id);
  res.status(200).json({
    success: true,
    message: 'Task deleted successfully',
  });
}

export async function updateTaskStatus(req, res) {
  const task = await taskService.updateTaskStatus(req.params.id, req.validated.body.status);
  res.status(200).json({
    success: true,
    data: task,
  });
}

export const taskController = {
  getTasks,
  exportTasksCsv,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
};

export default taskController;
