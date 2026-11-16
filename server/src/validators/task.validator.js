import { z } from 'zod';
import { DEPARTMENTS, TASK_PRIORITY, TASK_STATUS } from '../constants/enums.js';
import { isValidDateInput, parseUtcCalendarDate } from '../utils/dates.js';
import { isValidObjectId } from '../middleware/validateObjectId.js';

const calendarDateSchema = z
  .string({
    required_error: 'Date is required',
    invalid_type_error: 'Date must be a string in YYYY-MM-DD format',
  })
  .trim()
  .min(1, 'Date is required')
  .refine(isValidDateInput, {
    message: 'Invalid calendar date format (expected YYYY-MM-DD)',
  });

const objectIdStringSchema = z
  .string({
    invalid_type_error: 'Assignee must be a valid ObjectId string or null',
  })
  .trim()
  .refine(isValidObjectId, {
    message: 'Invalid assignee ObjectId format',
  });

const optionalNullableAssigneeSchema = z.preprocess(
  (val) => (val === '' ? null : val),
  z.union([objectIdStringSchema, z.null()]).optional()
);

function checkDateOrdering(startDateVal, dueDateVal, ctx) {
  if (
    startDateVal &&
    dueDateVal &&
    isValidDateInput(startDateVal) &&
    isValidDateInput(dueDateVal)
  ) {
    const start = parseUtcCalendarDate(startDateVal);
    const due = parseUtcCalendarDate(dueDateVal);
    if (due.getTime() < start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDate'],
        message: 'dueDate must be on or after startDate',
      });
    }
  }
}

export const createTaskSchema = z
  .object({
    title: z
      .string({ required_error: 'Task title is required' })
      .trim()
      .min(1, 'Task title is required'),
    description: z.string().trim().optional().default(''),
    department: z.enum(DEPARTMENTS, {
      errorMap: () => ({
        message: `Department must be one of: ${DEPARTMENTS.join(', ')}`,
      }),
    }),
    priority: z
      .enum(TASK_PRIORITY, {
        errorMap: () => ({
          message: `Priority must be one of: ${TASK_PRIORITY.join(', ')}`,
        }),
      })
      .default('Medium'),
    startDate: calendarDateSchema,
    dueDate: calendarDateSchema,
    assignee: optionalNullableAssigneeSchema,
    status: z.unknown().optional(),
    completedDate: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'Task status cannot be set on creation (defaults to Todo)',
      });
    }

    if (data.completedDate !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedDate'],
        message: 'completedDate cannot be supplied by client',
      });
    }

    checkDateOrdering(data.startDate, data.dueDate, ctx);
  })
  .transform(({ status: _status, completedDate: _completedDate, ...clean }) => clean);

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Task title cannot be empty').optional(),
    description: z.string().trim().optional(),
    department: z
      .enum(DEPARTMENTS, {
        errorMap: () => ({
          message: `Department must be one of: ${DEPARTMENTS.join(', ')}`,
        }),
      })
      .optional(),
    priority: z
      .enum(TASK_PRIORITY, {
        errorMap: () => ({
          message: `Priority must be one of: ${TASK_PRIORITY.join(', ')}`,
        }),
      })
      .optional(),
    startDate: calendarDateSchema.optional(),
    dueDate: calendarDateSchema.optional(),
    assignee: optionalNullableAssigneeSchema,
    status: z.unknown().optional(),
    completedDate: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'Task status cannot be updated via this endpoint; use PUT /api/tasks/:id/status',
      });
    }

    if (data.completedDate !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedDate'],
        message: 'completedDate cannot be updated by client',
      });
    }

    if (data.startDate !== undefined && data.dueDate !== undefined) {
      checkDateOrdering(data.startDate, data.dueDate, ctx);
    }
  })
  .transform(({ status: _status, completedDate: _completedDate, ...clean }) => clean);

export const updateTaskStatusSchema = z
  .object({
    status: z.enum(TASK_STATUS, {
      errorMap: () => ({
        message: `Status must be one of: ${TASK_STATUS.join(', ')}`,
      }),
    }),
  })
  .strict();
