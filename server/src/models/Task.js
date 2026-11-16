import mongoose from 'mongoose';
import {
  DEPARTMENTS,
  PRIORITY_RANKS,
  TASK_PRIORITY,
  TASK_STATUS,
} from '../constants/enums.js';
import { parseUtcCalendarDate } from '../utils/dates.js';

const assigneeSnapshotSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      default: null,
    },
    fullName: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
    },
    department: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: [true, 'Task ID is required'],
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: {
        values: DEPARTMENTS,
        message: 'Department must be one of Development, Design, QA, HR, or Sales',
      },
    },
    priority: {
      type: String,
      required: true,
      enum: {
        values: TASK_PRIORITY,
        message: 'Priority must be Low, Medium, High, or Critical',
      },
      default: 'Medium',
    },
    priorityRank: {
      type: Number,
      default: 2,
      min: 1,
      max: 4,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: TASK_STATUS,
        message: 'Status must be Todo, In Progress, Completed, or Cancelled',
      },
      default: 'Todo',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    completedDate: {
      type: Date,
      default: null,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    assigneeSnapshot: {
      type: assigneeSnapshotSchema,
      default: () => ({
        employeeId: null,
        fullName: null,
        email: null,
        department: null,
        role: null,
        isDeleted: false,
      }),
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.pre('validate', function normalizeAndRankTask(next) {
  try {
    if (this.startDate) {
      this.startDate = parseUtcCalendarDate(this.startDate);
    }
    if (this.dueDate) {
      this.dueDate = parseUtcCalendarDate(this.dueDate);
    }
    if (
      this.startDate instanceof Date &&
      this.dueDate instanceof Date &&
      this.dueDate.getTime() < this.startDate.getTime()
    ) {
      this.invalidate('dueDate', 'dueDate must be on or after startDate');
    }
    this.priorityRank = PRIORITY_RANKS[this.priority] || 2;
    next();
  } catch (err) {
    next(err);
  }
});

taskSchema.index({ assignee: 1 });
taskSchema.index({ department: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priorityRank: -1 });
taskSchema.index({ dueDate: 1 });

export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

export default Task;
