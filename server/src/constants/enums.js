export const DEPARTMENTS = ['Development', 'Design', 'QA', 'HR', 'Sales'];

export const EMPLOYEE_STATUS = ['Active', 'Inactive', 'On Leave'];

export const TASK_STATUS = ['Todo', 'In Progress', 'Completed', 'Cancelled'];

export const ACTIVE_TASK_STATUSES = ['Todo', 'In Progress'];

export const TERMINAL_TASK_STATUSES = ['Completed', 'Cancelled'];

export const TASK_PRIORITY = ['Low', 'Medium', 'High', 'Critical'];

export const PRIORITY_RANKS = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export const MAX_ACTIVE_TASKS_PER_EMPLOYEE = 3;

export const STATUS_TRANSITIONS = {
  Todo: ['In Progress', 'Cancelled'],
  'In Progress': ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};
