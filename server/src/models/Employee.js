import mongoose from 'mongoose';
import {
  DEPARTMENTS,
  EMPLOYEE_STATUS,
  MAX_ACTIVE_TASKS_PER_EMPLOYEE,
} from '../constants/enums.js';
import { parseUtcCalendarDate } from '../utils/dates.js';

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: {
        values: DEPARTMENTS,
        message: 'Department must be one of Development, Design, QA, HR, or Sales',
      },
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: EMPLOYEE_STATUS,
        message: 'Status must be Active, Inactive, or On Leave',
      },
      default: 'Active',
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining date is required'],
    },
    leaveStart: {
      type: Date,
      default: null,
    },
    leaveEnd: {
      type: Date,
      default: null,
    },
    activeTaskCount: {
      type: Number,
      default: 0,
      min: [0, 'Active task count cannot be negative'],
      max: [
        MAX_ACTIVE_TASKS_PER_EMPLOYEE,
        `Employee cannot hold more than ${MAX_ACTIVE_TASKS_PER_EMPLOYEE} active tasks`,
      ],
    },
    skills: {
      type: [{ type: String, trim: true }],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

employeeSchema.pre('validate', function validateAndNormalizeEmployeeDates(next) {
  try {
    if (this.joiningDate) {
      this.joiningDate = parseUtcCalendarDate(this.joiningDate);
    }

    if (this.status !== 'On Leave') {
      this.leaveStart = null;
      this.leaveEnd = null;
    } else {
      if (!this.leaveStart) {
        this.invalidate('leaveStart', 'leaveStart is required when status is On Leave');
      } else {
        this.leaveStart = parseUtcCalendarDate(this.leaveStart);
      }

      if (!this.leaveEnd) {
        this.invalidate('leaveEnd', 'leaveEnd is required when status is On Leave');
      } else {
        this.leaveEnd = parseUtcCalendarDate(this.leaveEnd);
      }

      if (
        this.leaveStart instanceof Date &&
        this.leaveEnd instanceof Date &&
        this.leaveEnd.getTime() < this.leaveStart.getTime()
      ) {
        this.invalidate('leaveEnd', 'leaveEnd must be on or after leaveStart');
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

employeeSchema.index({ department: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ status: 1, activeTaskCount: 1 });

export const Employee =
  mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

export default Employee;
