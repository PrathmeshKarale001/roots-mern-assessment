import Employee from '../models/Employee.js';
import Task from '../models/Task.js';
import {
  DEPARTMENTS,
  EMPLOYEE_STATUS,
  MAX_ACTIVE_TASKS_PER_EMPLOYEE,
  PRIORITY_RANKS,
  STATUS_TRANSITIONS,
  TASK_PRIORITY,
  TASK_STATUS,
  TERMINAL_TASK_STATUSES,
} from '../constants/enums.js';
import { getTodayUtcCalendarDate } from '../utils/dates.js';
import { buildOverdueMongoFilter, enrichTaskListWithOverdue } from '../utils/overdue.js';

export async function getDashboardSummary() {
  const todayUtc = getTodayUtcCalendarDate();
  const overdueFilter = buildOverdueMongoFilter(todayUtc);

  const [employeeFacetResult, taskFacetResult, workloadDocs, overdueDocs, recentDocs] =
    await Promise.all([
      Employee.aggregate([
        {
          $facet: {
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byDepartment: [
              {
                $group: {
                  _id: '$department',
                  total: { $sum: 1 },
                  active: {
                    $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] },
                  },
                  onLeave: {
                    $sum: { $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0] },
                  },
                  activeTasks: { $sum: '$activeTaskCount' },
                },
              },
            ],
          },
        },
      ]),
      Task.aggregate([
        {
          $facet: {
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
            byDepartment: [
              {
                $group: {
                  _id: '$department',
                  total: { $sum: 1 },
                  completed: {
                    $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
                  },
                  active: {
                    $sum: {
                      $cond: [{ $in: ['$status', ['Todo', 'In Progress']] }, 1, 0],
                    },
                  },
                  overdue: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $lt: ['$dueDate', todayUtc] },
                            { $not: [{ $in: ['$status', TERMINAL_TASK_STATUSES] }] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            overdueCount: [{ $match: overdueFilter }, { $count: 'count' }],
          },
        },
      ]),
      Employee.find({})
        .select(
          'employeeId fullName email department role status activeTaskCount leaveStart leaveEnd'
        )
        .sort({ activeTaskCount: -1, fullName: 1 })
        .collation({ locale: 'en', strength: 2 })
        .lean(),
      Task.find(overdueFilter)
        .populate('assignee', 'employeeId fullName department role status')
        .sort({ dueDate: 1, priorityRank: -1, _id: 1 })
        .limit(10)
        .lean(),
      Task.find({})
        .populate('assignee', 'employeeId fullName department role status')
        .sort({ createdAt: -1, _id: -1 })
        .limit(6)
        .lean(),
    ]);

  const empFacet = employeeFacetResult[0] || { byStatus: [], byDepartment: [] };
  const empStatusMap = Object.fromEntries(
    empFacet.byStatus.map((r) => [r._id, r.count])
  );
  const empDeptMap = Object.fromEntries(
    empFacet.byDepartment.map((r) => [r._id, r])
  );

  const employeesSummary = {
    total: EMPLOYEE_STATUS.reduce((acc, s) => acc + (empStatusMap[s] || 0), 0),
    active: empStatusMap.Active || 0,
    onLeave: empStatusMap['On Leave'] || 0,
    inactive: empStatusMap.Inactive || 0,
    byDepartment: DEPARTMENTS.map((dept) => ({
      department: dept,
      total: empDeptMap[dept]?.total || 0,
      active: empDeptMap[dept]?.active || 0,
      onLeave: empDeptMap[dept]?.onLeave || 0,
      activeTasks: empDeptMap[dept]?.activeTasks || 0,
    })),
  };

  const tFacet = taskFacetResult[0] || {
    byStatus: [],
    byPriority: [],
    byDepartment: [],
    overdueCount: [],
  };
  const taskStatusMap = Object.fromEntries(
    tFacet.byStatus.map((r) => [r._id, r.count])
  );
  const taskPriorityMap = Object.fromEntries(
    tFacet.byPriority.map((r) => [r._id, r.count])
  );
  const taskDeptMap = Object.fromEntries(
    tFacet.byDepartment.map((r) => [r._id, r])
  );

  const totalTasks = TASK_STATUS.reduce((acc, s) => acc + (taskStatusMap[s] || 0), 0);
  const todoTasks = taskStatusMap.Todo || 0;
  const inProgressTasks = taskStatusMap['In Progress'] || 0;
  const completedTasks = taskStatusMap.Completed || 0;
  const cancelledTasks = taskStatusMap.Cancelled || 0;
  const overdueTasksCount = tFacet.overdueCount[0]?.count || 0;
  const nonCancelledTotal = totalTasks - cancelledTasks;
  const completionRate =
    nonCancelledTotal > 0 ? Math.round((completedTasks / nonCancelledTotal) * 100) : 0;

  const tasksSummary = {
    total: totalTasks,
    todo: todoTasks,
    inProgress: inProgressTasks,
    completed: completedTasks,
    cancelled: cancelledTasks,
    active: todoTasks + inProgressTasks,
    overdue: overdueTasksCount,
    completionRate,
    byStatus: TASK_STATUS.map((status) => ({
      status,
      count: taskStatusMap[status] || 0,
    })),
    byPriority: TASK_PRIORITY.map((priority) => ({
      priority,
      rank: PRIORITY_RANKS[priority],
      count: taskPriorityMap[priority] || 0,
    })),
    byDepartment: DEPARTMENTS.map((dept) => ({
      department: dept,
      total: taskDeptMap[dept]?.total || 0,
      completed: taskDeptMap[dept]?.completed || 0,
      active: taskDeptMap[dept]?.active || 0,
      overdue: taskDeptMap[dept]?.overdue || 0,
    })),
  };

  const workload = workloadDocs.map((emp) => ({
    ...emp,
    maxCapacity: MAX_ACTIVE_TASKS_PER_EMPLOYEE,
    availableSlots: Math.max(
      0,
      MAX_ACTIVE_TASKS_PER_EMPLOYEE - (emp.activeTaskCount || 0)
    ),
    utilizationPct: Math.round(
      ((emp.activeTaskCount || 0) / MAX_ACTIVE_TASKS_PER_EMPLOYEE) * 100
    ),
  }));

  return {
    employees: employeesSummary,
    tasks: tasksSummary,
    workload,
    overdueTasks: enrichTaskListWithOverdue(overdueDocs, todayUtc),
    recentTasks: enrichTaskListWithOverdue(recentDocs, todayUtc),
    generatedAt: new Date().toISOString(),
  };
}

export function getSystemMeta() {
  return {
    departments: DEPARTMENTS,
    employeeStatuses: EMPLOYEE_STATUS,
    taskStatuses: TASK_STATUS,
    priorities: TASK_PRIORITY,
    priorityRanks: PRIORITY_RANKS,
    validTransitions: STATUS_TRANSITIONS,
    maxActiveTasks: MAX_ACTIVE_TASKS_PER_EMPLOYEE,
  };
}

export default {
  getDashboardSummary,
  getSystemMeta,
};
