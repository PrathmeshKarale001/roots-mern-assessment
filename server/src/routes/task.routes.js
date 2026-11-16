import { Router } from 'express';
import taskController from '../controllers/task.controller.js';
import validate from '../middleware/validate.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../validators/task.validator.js';

const router = Router();

router.get('/', taskController.getTasks);
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
