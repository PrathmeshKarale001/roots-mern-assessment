export const DEPARTMENTS = ['Development', 'Design', 'QA', 'HR', 'Sales'];

export const EMPLOYEE_STATUSES = ['Active', 'Inactive', 'On Leave'];

export const TASK_STATUSES = ['Todo', 'In Progress', 'Completed', 'Cancelled'];

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const MAX_ACTIVE_TASKS = 3;

export const VALID_STATUS_TRANSITIONS = {
  Todo: ['In Progress', 'Cancelled'],
  'In Progress': ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

export function isTerminalTaskStatus(status) {
  return status === 'Completed' || status === 'Cancelled';
}
