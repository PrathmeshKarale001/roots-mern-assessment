import taskService from '../services/task.service.js';

export async function getTasks(req, res) {
  const list = await taskService.listTasks(req.validated?.query ?? req.query);
  res.status(200).json({
    success: true,
    count: list.length,
    data: list,
  });
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
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
};

export default taskController;
