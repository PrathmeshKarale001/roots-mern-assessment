import { z } from 'zod';
import { DEPARTMENTS, EMPLOYEE_STATUS } from '../constants/enums.js';
import { isValidDateInput, parseUtcCalendarDate } from '../utils/dates.js';

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

const optionalNullableCalendarDateSchema = z.preprocess(
  (val) => (val === '' ? null : val),
  z.union([calendarDateSchema, z.null()]).optional()
);

function validateLeaveWindow(data, ctx) {
  if (data.status === 'On Leave') {
    if (!data.leaveStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['leaveStart'],
        message: 'leaveStart is required when status is On Leave',
      });
    }

    if (!data.leaveEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['leaveEnd'],
        message: 'leaveEnd is required when status is On Leave',
      });
    }
  }

  if (
    data.leaveStart &&
    data.leaveEnd &&
    isValidDateInput(data.leaveStart) &&
    isValidDateInput(data.leaveEnd)
  ) {
    const start = parseUtcCalendarDate(data.leaveStart);
    const end = parseUtcCalendarDate(data.leaveEnd);
    if (end.getTime() < start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['leaveEnd'],
        message: 'leaveEnd must be on or after leaveStart',
      });
    }
  }
}

export const createEmployeeSchema = z
  .object({
    employeeId: z
      .string({ required_error: 'employeeId is required' })
      .trim()
      .min(1, 'employeeId is required')
      .transform((val) => val.toUpperCase()),
    fullName: z
      .string({ required_error: 'fullName is required' })
      .trim()
      .min(1, 'fullName is required'),
    email: z
      .string({ required_error: 'email is required' })
      .trim()
      .toLowerCase()
      .email('Invalid email format'),
    department: z.enum(DEPARTMENTS, {
      errorMap: () => ({
        message: `Department must be one of: ${DEPARTMENTS.join(', ')}`,
      }),
    }),
    role: z
      .string({ required_error: 'role is required' })
      .trim()
      .min(1, 'role is required'),
    status: z.enum(EMPLOYEE_STATUS).default('Active'),
    joiningDate: calendarDateSchema,
    leaveStart: optionalNullableCalendarDateSchema,
    leaveEnd: optionalNullableCalendarDateSchema,
    skills: z.array(z.string().trim().min(1)).optional().default([]),
  })
  .superRefine(validateLeaveWindow);

export const updateEmployeeSchema = z
  .object({
    employeeId: z
      .string()
      .trim()
      .min(1, 'employeeId cannot be empty')
      .transform((val) => val.toUpperCase())
      .optional(),
    fullName: z.string().trim().min(1, 'fullName cannot be empty').optional(),
    email: z.string().trim().toLowerCase().email('Invalid email format').optional(),
    department: z
      .enum(DEPARTMENTS, {
        errorMap: () => ({
          message: `Department must be one of: ${DEPARTMENTS.join(', ')}`,
        }),
      })
      .optional(),
    role: z.string().trim().min(1, 'role cannot be empty').optional(),
    status: z.enum(EMPLOYEE_STATUS).optional(),
    joiningDate: calendarDateSchema.optional(),
    leaveStart: optionalNullableCalendarDateSchema,
    leaveEnd: optionalNullableCalendarDateSchema,
    skills: z.array(z.string().trim().min(1)).optional(),
  })
  .superRefine(validateLeaveWindow);
