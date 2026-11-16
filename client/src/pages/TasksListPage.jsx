import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  Download,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsvFile } from '../api/client.js';
import { employeesApi, tasksApi } from '../api/endpoints.js';
import {
  DEPARTMENTS,
  TASK_PRIORITIES,
  isTerminalTaskStatus,
} from '../constants/enums.js';
import { useDebounce, useUrlFilters } from '../hooks/useAppHooks.js';
import { PageHeader } from '../components/layout/AppShell.jsx';
import {
  Badge,
  Button,
  Callout,
  ConfirmModal,
  DepartmentBadge,
  EmptyState,
  Pagination,
  PriorityBadge,
  SegmentedControl,
  TableSkeleton,
  TaskStatusSelect,
} from '../components/ui/Primitives.jsx';
import { formatDisplayDate, getInitials } from '../utils/dates.js';
import shared from '../styles/WorkspaceShared.module.css';

const FILTER_DEFAULTS = {
  search: '',
  department: '',
  priority: '',
  status: '',
  duePreset: '',
  dueDate: '',
  assignee: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: '1',
};

const STATUS_SEGMENTS = [
  { value: '', label: 'All' },
  { value: 'Todo', label: 'Todo' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

function renderAssigneeCell(task) {
  const populated =
    task.assignee && typeof task.assignee === 'object' ? task.assignee : null;
  const snap = task.assigneeSnapshot || {};

  if (populated && populated.fullName) {
    return (
      <div className={shared.personCell}>
        <span className={shared.avatar}>{getInitials(populated.fullName)}</span>
        <div>
          <Link
            to={`/employees/${populated._id}`}
            className={`${shared.primaryText} ${shared.primaryLink}`}
          >
            {populated.fullName}
          </Link>
          <span className={shared.secondaryText}>{populated.employeeId}</span>
        </div>
      </div>
    );
  }

  if (snap.fullName) {
    return (
      <div className={shared.personCell}>
        <span className={`${shared.avatar} ${shared.avatarMuted}`}>
          {getInitials(snap.fullName)}
        </span>
        <div>
          <span className={shared.primaryText}>{snap.fullName}</span>
          <span className={shared.secondaryText}>
            {snap.employeeId} · {snap.isDeleted ? 'Former Employee' : snap.role}
          </span>
        </div>
      </div>
    );
  }

  return <span className={shared.secondaryText}>Unassigned</span>;
}

export default function TasksListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filters, setFilter, resetAllFilters } = useUrlFilters(FILTER_DEFAULTS);

  const [searchDraft, setSearchDraft] = useState(filters.search);
  const debouncedSearch = useDebounce(searchDraft, 260);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilter({ search: debouncedSearch }, { resetPage: true, replace: true });
    }
  }, [debouncedSearch, filters.search, setFilter]);

  const sharedFilterParams = useMemo(
    () => ({
      search: filters.search,
      department: filters.department,
      priority: filters.priority,
      status: filters.status,
      duePreset: filters.duePreset,
      dueDate: filters.dueDate,
      assignee: filters.assignee,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    }),
    [filters]
  );

  const paginatedQueryParams = useMemo(
    () => ({
      ...sharedFilterParams,
      page: filters.page,
      limit: 8,
    }),
    [sharedFilterParams, filters.page]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tasks', paginatedQueryParams],
    queryFn: ({ signal }) => tasksApi.list(paginatedQueryParams, signal),
    placeholderData: keepPreviousData,
  });

  const employeeOptionsQuery = useQuery({
    queryKey: ['employee-options'],
    queryFn: ({ signal }) => employeesApi.options(signal),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => tasksApi.updateStatus(id, status),
    onSuccess: (res) => {
      toast.success(`Task ${res.data.taskId} moved to ${res.data.status}`);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-options'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Could not update status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => tasksApi.remove(id),
    onSuccess: () => {
      toast.success('Task deleted and active capacity updated');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-options'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Could not delete task');
    },
  });

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const filename = await downloadCsvFile('/tasks/export.csv', sharedFilterParams);
      toast.success(`Exported matching tasks to ${filename}`);
    } catch (err) {
      toast.error(err?.message || 'CSV export failed');
    } finally {
      setExportingCsv(false);
    }
  };

  const tasks = data?.data || [];
  const pagination = data?.pagination;
  const employeeOptions = employeeOptionsQuery.data?.data || [];

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.department ||
      filters.priority ||
      filters.status ||
      filters.duePreset ||
      filters.dueDate ||
      filters.assignee ||
      filters.sortBy !== 'createdAt' ||
      filters.sortOrder !== 'desc'
  );

  return (
    <div>
      <PageHeader
        eyebrow="Execution & Lifecycle"
        title="Tasks"
        subtitle="Server-filtered task queue with URL-synced state, valid-next-status transitions, and filtered CSV export."
        actions={
          <>
            <Button
              id="btn-export-csv"
              variant="secondary"
              disabled={exportingCsv}
              onClick={handleExportCsv}
            >
              <Download size={15} />
              {exportingCsv ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button
              id="btn-create-task"
              variant="primary"
              onClick={() => navigate('/tasks/new')}
            >
              <Plus size={15} />
              Assign Task
            </Button>
          </>
        }
      />

      {isError && (
        <Callout tone="error">
          {error?.message || 'Failed to load tasks from server'}
        </Callout>
      )}

      <div className={shared.surfaceCard}>
        <div className={shared.toolbar}>
          <div className={shared.toolbarTop}>
            <div className={shared.searchWrap}>
              <Search size={15} className={shared.searchIcon} />
              <input
                id="tasks-search-input"
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search task title, TSK ID, or employee name…"
                className={shared.searchInput}
              />
            </div>

            <SegmentedControl
              ariaLabel="Filter tasks by status"
              options={STATUS_SEGMENTS}
              value={filters.status}
              onChange={(val) => setFilter({ status: val })}
            />
          </div>

          <div className={shared.toolbarFilters}>
            <select
              id="tasks-department-filter"
              aria-label="Filter by department"
              value={filters.department}
              onChange={(e) => setFilter({ department: e.target.value })}
              className={shared.filterSelect}
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              id="tasks-priority-filter"
              aria-label="Filter by priority"
              value={filters.priority}
              onChange={(e) => setFilter({ priority: e.target.value })}
              className={shared.filterSelect}
            >
              <option value="">All Priorities</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              id="tasks-due-preset-filter"
              aria-label="Filter by due window"
              value={filters.duePreset}
              onChange={(e) => setFilter({ duePreset: e.target.value })}
              className={shared.filterSelect}
            >
              <option value="">Any Due Window</option>
              <option value="overdue">Overdue Only</option>
              <option value="today">Due Today</option>
              <option value="this_week">Due Next 7 Days</option>
            </select>

            <input
              id="tasks-due-date-filter"
              type="date"
              aria-label="Exact due date filter"
              value={filters.dueDate}
              onChange={(e) => setFilter({ dueDate: e.target.value })}
              className={shared.dateFilterInput}
            />

            <select
              id="tasks-assignee-filter"
              aria-label="Filter by assignee"
              value={filters.assignee}
              onChange={(e) => setFilter({ assignee: e.target.value })}
              className={shared.filterSelect}
            >
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {employeeOptions.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.fullName} ({emp.employeeId})
                </option>
              ))}
            </select>

            <select
              id="tasks-sort-select"
              aria-label="Sort tasks"
              value={`${filters.sortBy}:${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split(':');
                setFilter({ sortBy, sortOrder });
              }}
              className={shared.filterSelect}
            >
              <option value="createdAt:desc">Created (Newest)</option>
              <option value="createdAt:asc">Created (Oldest)</option>
              <option value="dueDate:asc">Due Date (Soonest)</option>
              <option value="dueDate:desc">Due Date (Latest)</option>
              <option value="priority:desc">Priority (Critical → Low)</option>
              <option value="priority:asc">Priority (Low → Critical)</option>
              <option value="title:asc">Title (A → Z)</option>
              <option value="title:desc">Title (Z → A)</option>
            </select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetAllFilters}>
                <RotateCcw size={13} />
                Reset
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className={shared.toolbar}>
            <TableSkeleton rows={6} />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No matching tasks"
            description={
              hasActiveFilters
                ? 'No tasks match your current URL search and filter criteria.'
                : 'Assign your first task to start tracking delivery.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" onClick={resetAllFilters}>
                  Clear Filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/tasks/new')}>
                  Assign Task
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className={shared.tableWrap}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Assignee</th>
                    <th>Department</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Status Flow</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const locked = isTerminalTaskStatus(task.status);
                    return (
                      <tr
                        key={task._id}
                        className={task.isOverdue ? shared.overdueRow : ''}
                      >
                        <td>
                          <Link
                            to={`/tasks/${task._id}`}
                            className={`${shared.primaryText} ${shared.primaryLink}`}
                          >
                            {task.title}
                          </Link>
                          <span className={shared.secondaryText}>
                            <span className={shared.monoCode}>{task.taskId}</span> ·
                            Starts {formatDisplayDate(task.startDate)}
                          </span>
                        </td>
                        <td>{renderAssigneeCell(task)}</td>
                        <td>
                          <DepartmentBadge department={task.department} />
                        </td>
                        <td>
                          <PriorityBadge priority={task.priority} />
                        </td>
                        <td>
                          <span className={shared.primaryText}>
                            {formatDisplayDate(task.dueDate)}
                          </span>
                          {task.isOverdue && (
                            <Badge tone="red">{task.daysOverdue}d overdue</Badge>
                          )}
                          {task.status === 'Completed' && task.completedDate && (
                            <span className={shared.secondaryText}>
                              Done {formatDisplayDate(task.completedDate)}
                            </span>
                          )}
                        </td>
                        <td>
                          <TaskStatusSelect
                            id={`status-select-${task.taskId}`}
                            currentStatus={task.status}
                            disabled={statusMutation.isPending}
                            onStatusChange={(nextStatus) =>
                              statusMutation.mutate({
                                id: task._id,
                                status: nextStatus,
                              })
                            }
                          />
                        </td>
                        <td>
                          <div className={shared.rowActions}>
                            <button
                              type="button"
                              className={shared.iconAction}
                              title="View task details"
                              onClick={() => navigate(`/tasks/${task._id}`)}
                            >
                              <Eye size={16} />
                            </button>
                            {!locked && (
                              <button
                                type="button"
                                className={shared.iconAction}
                                title="Edit task"
                                onClick={() => navigate(`/tasks/${task._id}/edit`)}
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            <button
                              type="button"
                              className={`${shared.iconAction} ${shared.iconActionDanger}`}
                              title="Delete task"
                              onClick={() => setDeleteTarget(task)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={shared.mobileCards}>
              {tasks.map((task) => {
                const locked = isTerminalTaskStatus(task.status);
                return (
                  <div key={task._id} className={shared.mobileCard}>
                    <div className={shared.mobileCardHeader}>
                      <div>
                        <span className={shared.monoCode}>{task.taskId}</span>
                        <Link
                          to={`/tasks/${task._id}`}
                          className={`${shared.primaryText} ${shared.primaryLink}`}
                        >
                          {task.title}
                        </Link>
                      </div>
                      <PriorityBadge priority={task.priority} />
                    </div>

                    {renderAssigneeCell(task)}

                    <div className={shared.mobileCardMeta}>
                      <DepartmentBadge department={task.department} />
                      <span className={shared.secondaryText}>
                        Due {formatDisplayDate(task.dueDate)}
                      </span>
                      {task.isOverdue && (
                        <Badge tone="red">{task.daysOverdue}d overdue</Badge>
                      )}
                    </div>

                    <div className={shared.mobileCardFooter}>
                      <TaskStatusSelect
                        currentStatus={task.status}
                        disabled={statusMutation.isPending}
                        onStatusChange={(nextStatus) =>
                          statusMutation.mutate({ id: task._id, status: nextStatus })
                        }
                      />
                      <div className={shared.rowActions}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/tasks/${task._id}`)}
                        >
                          View
                        </Button>
                        {!locked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/tasks/${task._id}/edit`)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              pagination={pagination}
              onPageChange={(nextPage) => setFilter({ page: nextPage }, { resetPage: false })}
            />
          </>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.taskId || 'Task'}?`}
        description={`Delete "${deleteTarget?.title}"? If this task is currently Todo or In Progress, its assigned employee's active capacity slot will be released automatically.`}
        confirmLabel="Delete Task"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
      />
    </div>
  );
}
