import employeeService from '../services/employee.service.js';

export async function getEmployees(req, res) {
  const { items, pagination } = await employeeService.listEmployees(
    req.validated?.query ?? req.query
  );
  res.status(200).json({
    success: true,
    count: items.length,
    data: items,
    pagination,
  });
}

export async function getEmployeeOptions(_req, res) {
  const options = await employeeService.listEmployeeOptions();
  res.status(200).json({
    success: true,
    count: options.length,
    data: options,
  });
}

export async function getEmployeeById(req, res) {
  const employee = await employeeService.getEmployeeById(req.params.id);
  res.status(200).json({
    success: true,
    data: employee,
  });
}

export async function createEmployee(req, res) {
  const employee = await employeeService.createEmployee(req.validated.body);
  res.status(201).json({
    success: true,
    data: employee,
  });
}

export async function updateEmployee(req, res) {
  const employee = await employeeService.updateEmployee(req.params.id, req.validated.body);
  res.status(200).json({
    success: true,
    data: employee,
  });
}

export async function deleteEmployee(req, res) {
  await employeeService.deleteEmployee(req.params.id);
  res.status(200).json({
    success: true,
    message: 'Employee deleted successfully',
  });
}

export async function getEmployeeTasks(req, res) {
  const tasks = await employeeService.getEmployeeTasks(req.params.id);
  res.status(200).json({
    success: true,
    count: tasks.length,
    data: tasks,
  });
}

export const employeeController = {
  getEmployees,
  getEmployeeOptions,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeTasks,
};

export default employeeController;
