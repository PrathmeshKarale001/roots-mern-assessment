import { Router } from 'express';
import employeeController from '../controllers/employee.controller.js';
import validate from '../middleware/validate.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from '../validators/employee.validator.js';

const router = Router();

router.get('/', employeeController.getEmployees);
router.post('/', validate(createEmployeeSchema), employeeController.createEmployee);
router.get('/:id', validateObjectId, employeeController.getEmployeeById);
router.put(
  '/:id',
  validateObjectId,
  validate(updateEmployeeSchema),
  employeeController.updateEmployee
);
router.delete('/:id', validateObjectId, employeeController.deleteEmployee);
router.get('/:id/tasks', validateObjectId, employeeController.getEmployeeTasks);

export default router;
