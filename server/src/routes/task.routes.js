import { Router } from 'express';
import taskController from '../controllers/task.controller.js';
import validate from '../middleware/validate.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createTaskSchema,
  exportTasksQuerySchema,
  listTasksQuerySchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../validators/task.validator.js';

const router = Router();

router.get('/', validate({ query: listTasksQuerySchema }), taskController.getTasks);
router.get(
  '/export.csv',
  validate({ query: exportTasksQuerySchema }),
  taskController.exportTasksCsv
);
router.get(
  '/export',
  validate({ query: exportTasksQuerySchema }),
  taskController.exportTasksCsv
);
router.post('/', validate(createTaskSchema), taskController.createTask);
router.get('/:id', validateObjectId, taskController.getTaskById);
router.put('/:id', validateObjectId, validate(updateTaskSchema), taskController.updateTask);
router.delete('/:id', validateObjectId, taskController.deleteTask);
router.put(
  '/:id/status',
  validateObjectId,
  validate(updateTaskStatusSchema),
  taskController.updateTaskStatus
);

export default router;
