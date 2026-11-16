import Employee from '../models/Employee.js';
import Task from '../models/Task.js';
import { ACTIVE_TASK_STATUSES, MAX_ACTIVE_TASKS_PER_EMPLOYEE } from '../constants/enums.js';
import ApiError from '../utils/ApiError.js';
import { parseUtcCalendarDate } from '../utils/dates.js';
import { enrichTaskListWithOverdue } from '../utils/overdue.js';
import {
  buildEmployeeFilterQuery,
  buildEmployeeSortSpec,
  buildPaginationMeta,
  parsePagination,
} from '../utils/queryBuilder.js';

export async function listEmployees(queryParams = {}) {
  const filter = buildEmployeeFilterQuery(queryParams);
  const sortSpec = buildEmployeeSortSpec(queryParams);
  const { page, limit, skip } = parsePagination(queryParams);

  const findQuery = Employee.find(filter).sort(sortSpec).skip(skip).limit(limit);
  if (queryParams.sortBy === 'fullName') {
    findQuery.collation({ locale: 'en', strength: 2 });
  }

  const [items, total] = await Promise.all([
    findQuery,
    Employee.countDocuments(filter),
  ]);

  return {
    items,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function listEmployeeOptions() {
  const employees = await Employee.find({})
    .select(
      'employeeId fullName email department role status activeTaskCount leaveStart leaveEnd'
    )
    .sort({ status: 1, fullName: 1 })
    .collation({ locale: 'en', strength: 2 })
    .lean();

  return employees.map((emp) => ({
    ...emp,
    maxCapacity: MAX_ACTIVE_TASKS_PER_EMPLOYEE,
    availableSlots: Math.max(0, MAX_ACTIVE_TASKS_PER_EMPLOYEE - (emp.activeTaskCount || 0)),
  }));
}

export async function getEmployeeById(id) {
  const employee = await Employee.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }
  return employee;
}

export async function createEmployee(data) {
  const normalizedId = data.employeeId.trim().toUpperCase();
  const normalizedEmail = data.email.trim().toLowerCase();

  const existing = await Employee.findOne({
    $or: [{ employeeId: normalizedId }, { email: normalizedEmail }],
  });

  if (existing) {
    if (existing.employeeId === normalizedId) {
      throw ApiError.conflict(`Employee ID '${normalizedId}' already exists`);
    }
    throw ApiError.conflict(`Employee email '${normalizedEmail}' already exists`);
  }

  const isOnLeave = data.status === 'On Leave';
  const payload = {
    employeeId: normalizedId,
    fullName: data.fullName.trim(),
    email: normalizedEmail,
    phone: data.phone ? data.phone.trim() : '',
    department: data.department,
    role: data.role.trim(),
    status: data.status || 'Active',
    joiningDate: parseUtcCalendarDate(data.joiningDate),
    leaveStart: isOnLeave && data.leaveStart ? parseUtcCalendarDate(data.leaveStart) : null,
    leaveEnd: isOnLeave && data.leaveEnd ? parseUtcCalendarDate(data.leaveEnd) : null,
    skills: Array.isArray(data.skills) ? data.skills : [],
  };

  return Employee.create(payload);
}

export async function updateEmployee(id, data) {
  const employee = await Employee.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  const conflictClauses = [];
  if (data.employeeId !== undefined) {
    const nextId = data.employeeId.trim().toUpperCase();
    if (nextId !== employee.employeeId) {
      conflictClauses.push({ employeeId: nextId });
    }
  }
  if (data.email !== undefined) {
    const nextEmail = data.email.trim().toLowerCase();
    if (nextEmail !== employee.email) {
      conflictClauses.push({ email: nextEmail });
    }
  }

  if (conflictClauses.length > 0) {
    const conflictingEmployee = await Employee.findOne({
      _id: { $ne: employee._id },
      $or: conflictClauses,
    });
    if (conflictingEmployee) {
      throw ApiError.conflict('Employee ID or email already exists');
    }
  }

  const prevSnapshotValues = {
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department,
    role: employee.role,
  };

  if (data.employeeId !== undefined) {
    employee.employeeId = data.employeeId.trim().toUpperCase();
  }
  if (data.fullName !== undefined) {
    employee.fullName = data.fullName.trim();
  }
  if (data.email !== undefined) {
    employee.email = data.email.trim().toLowerCase();
  }
  if (data.phone !== undefined) {
    employee.phone = data.phone.trim();
  }
  if (data.department !== undefined) {
    employee.department = data.department;
  }
  if (data.role !== undefined) {
    employee.role = data.role.trim();
  }
  if (data.joiningDate !== undefined) {
    employee.joiningDate = parseUtcCalendarDate(data.joiningDate);
  }
  if (data.skills !== undefined) {
    employee.skills = data.skills;
  }

  const effectiveStatus = data.status !== undefined ? data.status : employee.status;
  employee.status = effectiveStatus;

  if (effectiveStatus === 'On Leave') {
    const effectiveLeaveStart =
      data.leaveStart !== undefined
        ? data.leaveStart
          ? parseUtcCalendarDate(data.leaveStart)
          : null
        : employee.leaveStart;
    const effectiveLeaveEnd =
      data.leaveEnd !== undefined
        ? data.leaveEnd
          ? parseUtcCalendarDate(data.leaveEnd)
          : null
        : employee.leaveEnd;

    if (!effectiveLeaveStart || !effectiveLeaveEnd) {
      throw ApiError.badRequest('leaveStart and leaveEnd are required when status is On Leave');
    }
    if (effectiveLeaveEnd.getTime() < effectiveLeaveStart.getTime()) {
      throw ApiError.badRequest('leaveEnd must be on or after leaveStart');
    }

    employee.leaveStart = effectiveLeaveStart;
    employee.leaveEnd = effectiveLeaveEnd;
  } else {
    employee.leaveStart = null;
    employee.leaveEnd = null;
  }

  await employee.save();

  const snapshotChanged =
    prevSnapshotValues.employeeId !== employee.employeeId ||
    prevSnapshotValues.fullName !== employee.fullName ||
    prevSnapshotValues.email !== employee.email ||
    prevSnapshotValues.department !== employee.department ||
    prevSnapshotValues.role !== employee.role;

  if (snapshotChanged) {
    await Task.updateMany(
      { assignee: employee._id },
      {
        $set: {
          'assigneeSnapshot.employeeId': employee.employeeId,
          'assigneeSnapshot.fullName': employee.fullName,
          'assigneeSnapshot.email': employee.email,
          'assigneeSnapshot.department': employee.department,
          'assigneeSnapshot.role': employee.role,
        },
      }
    );
  }

  return employee;
}

export async function deleteEmployee(id) {
  const employee = await Employee.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  const activeTasksCount = await Task.countDocuments({
    assignee: id,
    status: { $in: ACTIVE_TASK_STATUSES },
  });

  if (activeTasksCount > 0 || employee.activeTaskCount > 0) {
    throw ApiError.badRequest('Cannot delete employee with active tasks (Todo or In Progress)');
  }

  await Employee.findByIdAndDelete(id);

  await Task.updateMany(
    { assignee: id },
    {
      $set: {
        assignee: null,
        'assigneeSnapshot.isDeleted': true,
      },
    }
  );

  return employee;
}

export async function getEmployeeTasks(id) {
  const employee = await Employee.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  const tasks = await Task.find({ assignee: id }).sort({ dueDate: 1, createdAt: -1 });
  return enrichTaskListWithOverdue(tasks);
}

export const employeeService = {
  listEmployees,
  listEmployeeOptions,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeTasks,
};

export default employeeService;
