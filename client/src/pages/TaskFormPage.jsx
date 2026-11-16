import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { employeesApi, tasksApi } from '../api/endpoints.js';
import {
  DEPARTMENTS,
  MAX_ACTIVE_TASKS,
  TASK_PRIORITIES,
  isTerminalTaskStatus,
} from '../constants/enums.js';
import { PageHeader } from '../components/layout/AppShell.jsx';
import { Button, Callout, TableSkeleton } from '../components/ui/Primitives.jsx';
import {
  formatDisplayDate,
  getTodayInputValue,
  isDateInsideWindow,
  toDateInputValue,
} from '../utils/dates.js';
import shared from '../styles/WorkspaceShared.module.css';

const taskFormSchema = z
  .object({
    title: z.string().trim().min(3, 'Task title must be at least 3 characters'),
    description: z.string().trim().optional().default(''),
    department: z.enum(DEPARTMENTS, {
      errorMap: () => ({ message: 'Select a valid department' }),
    }),
    priority: z.enum(TASK_PRIORITIES, {
      errorMap: () => ({ message: 'Select a valid priority' }),
    }),
    assignee: z.string().trim().min(1, 'Please select an employee to assign this task'),
    startDate: z.string().trim().min(1, 'Start date is required'),
    dueDate: z.string().trim().min(1, 'Due date is required'),
  })
  .superRefine((vals, ctx) => {
    if (vals.startDate && vals.dueDate && vals.dueDate < vals.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDate'],
        message: 'Due date cannot be earlier than start date',
      });
    }
  });

export default function TaskFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState('');

  const prefillAssignee = searchParams.get('assignee') || '';
  const prefillDepartment = DEPARTMENTS.includes(searchParams.get('department'))
    ? searchParams.get('department')
    : 'Development';

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      department: prefillDepartment,
      priority: 'Medium',
      assignee: prefillAssignee,
      startDate: getTodayInputValue(),
      dueDate: getTodayInputValue(),
    },
  });

  const watchedAssignee = watch('assignee');
  const watchedStartDate = watch('startDate');

  const optionsQuery = useQuery({
    queryKey: ['employee-options'],
    queryFn: ({ signal }) => employeesApi.options(signal),
  });

  const taskQuery = useQuery({
    queryKey: ['task', id],
    queryFn: ({ signal }) => tasksApi.getById(id, signal),
    enabled: isEdit,
  });

  const currentTask = taskQuery.data?.data;

  useEffect(() => {
    if (currentTask) {
      const currentAssigneeId =
        currentTask.assignee && typeof currentTask.assignee === 'object'
          ? currentTask.assignee._id
          : currentTask.assignee || '';
      reset({
        title: currentTask.title || '',
        description: currentTask.description || '',
        department: currentTask.department || 'Development',
        priority: currentTask.priority || 'Medium',
        assignee: currentAssigneeId,
        startDate: toDateInputValue(currentTask.startDate),
        dueDate: toDateInputValue(currentTask.dueDate),
      });
    }
  }, [currentTask, reset]);

  const employeeOptions = optionsQuery.data?.data || [];
  const selectedEmployee = useMemo(
    () => employeeOptions.find((emp) => emp._id === watchedAssignee),
    [employeeOptions, watchedAssignee]
  );

  const currentAssigneeId =
    currentTask?.assignee && typeof currentTask.assignee === 'object'
      ? currentTask.assignee._id
      : currentTask?.assignee || '';

  const eligibilityWarning = useMemo(() => {
    if (!selectedEmployee) return null;
    if (selectedEmployee.status === 'Inactive') {
      return `${selectedEmployee.fullName} is Inactive — backend business rules reject assigning tasks to Inactive employees.`;
    }
    if (
      selectedEmployee.status === 'On Leave' &&
      isDateInsideWindow(
        watchedStartDate,
        selectedEmployee.leaveStart,
        selectedEmployee.leaveEnd
      )
    ) {
      return `${selectedEmployee.fullName} is On Leave from ${formatDisplayDate(
        selectedEmployee.leaveStart
      )} to ${formatDisplayDate(
        selectedEmployee.leaveEnd
      )} (inclusive). Starting a task inside this window will be rejected by the backend.`;
    }
    const alreadyAssignedToThisTask = isEdit && selectedEmployee._id === currentAssigneeId;
    if (
      !alreadyAssignedToThisTask &&
      selectedEmployee.activeTaskCount >= MAX_ACTIVE_TASKS
    ) {
      return `${selectedEmployee.fullName} already holds ${selectedEmployee.activeTaskCount}/3 active tasks — backend capacity limit will reject a 4th active task.`;
    }
    return null;
  }, [selectedEmployee, watchedStartDate, isEdit, currentAssigneeId]);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? tasksApi.update(id, payload) : tasksApi.create(payload),
    onSuccess: (res) => {
      const saved = res?.data;
      toast.success(
        isEdit
          ? `Task ${saved.taskId} updated`
          : `Task ${saved.taskId} assigned in Todo status`
      );
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-options'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/tasks/${saved._id}`);
    },
    onError: (err) => {
      const msg = err?.message || 'Unable to save task';
      setServerError(msg);
      toast.error(msg);
      if (Array.isArray(err?.details)) {
        err.details.forEach((d) => {
          if (d.field && d.field !== 'root') {
            setError(d.field, { type: 'server', message: d.message });
          }
        });
      }
    },
  });

  const onSubmit = (values) => {
    setServerError('');
    saveMutation.mutate({
      title: values.title.trim(),
      description: values.description?.trim() || '',
      department: values.department,
      priority: values.priority,
      assignee: values.assignee,
      startDate: values.startDate,
      dueDate: values.dueDate,
    });
  };

  if (isEdit && taskQuery.isLoading) {
    return <TableSkeleton rows={6} />;
  }

  if (isEdit && taskQuery.isError) {
    return (
      <Callout tone="error">
        {taskQuery.error?.message || 'Task could not be loaded'}
      </Callout>
    );
  }

  const isLocked = isEdit && currentTask && isTerminalTaskStatus(currentTask.status);

  return (
    <div>
      <Link to="/tasks" className={shared.backLink}>
        <ArrowLeft size={15} />
        Back to Tasks
      </Link>

      <PageHeader
        eyebrow={isEdit ? `Edit ${currentTask?.taskId || 'Task'}` : 'Task Assignment'}
        title={isEdit ? 'Edit Task' : 'Assign New Task'}
        subtitle="New tasks start as Todo. Status transitions and Completed Date are managed exclusively by the backend."
      />

      {isLocked ? (
        <Callout tone="warning">
          This task is <strong>{currentTask.status}</strong> and permanently locked per
          business rules. Completed and Cancelled tasks cannot be edited.{' '}
          <Link to={`/tasks/${currentTask._id}`} className={shared.backLink}>
            Return to Task Details →
          </Link>
        </Callout>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className={shared.formLayout} noValidate>
          {serverError && <Callout tone="error">{serverError}</Callout>}
          {eligibilityWarning && !serverError && (
            <Callout tone="warning">{eligibilityWarning}</Callout>
          )}

          <section className={shared.formSection}>
            <div className={shared.sectionHeader}>
              <h2 className={shared.sectionTitle}>Task Scope</h2>
              <p className={shared.sectionHint}>
                Task ID is auto-generated sequentially (e.g. TSK-0016) upon creation.
              </p>
            </div>

            <div className={shared.fieldGrid}>
              <div className={`${shared.field} ${shared.fieldFull}`}>
                <label htmlFor="task-title" className={shared.label}>
                  Task Title
                </label>
                <input
                  id="task-title"
                  placeholder="e.g. Audit Q4 API latency across enterprise endpoints"
                  className={shared.input}
                  {...register('title')}
                />
                {errors.title && (
                  <span className={shared.fieldError}>{errors.title.message}</span>
                )}
              </div>

              <div className={`${shared.field} ${shared.fieldFull}`}>
                <label htmlFor="task-desc" className={shared.label}>
                  Description <span className={shared.optionalTag}>(optional)</span>
                </label>
                <textarea
                  id="task-desc"
                  placeholder="Acceptance criteria, context, and deliverables…"
                  className={shared.textarea}
                  {...register('description')}
                />
              </div>

              <div className={shared.field}>
                <label htmlFor="task-department" className={shared.label}>
                  Department
                </label>
                <select
                  id="task-department"
                  className={shared.select}
                  {...register('department')}
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {errors.department && (
                  <span className={shared.fieldError}>{errors.department.message}</span>
                )}
              </div>

              <div className={shared.field}>
                <label htmlFor="task-priority" className={shared.label}>
                  Priority
                </label>
                <select
                  id="task-priority"
                  className={shared.select}
                  {...register('priority')}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {errors.priority && (
                  <span className={shared.fieldError}>{errors.priority.message}</span>
                )}
              </div>
            </div>
          </section>

          <section className={shared.formSection}>
            <div className={shared.sectionHeader}>
              <h2 className={shared.sectionTitle}>Assignee &amp; Schedule</h2>
              <p className={shared.sectionHint}>
                Active employees can hold at most 3 active tasks. Due date must be on or after start date.
              </p>
            </div>

            <div className={shared.fieldGrid}>
              <div className={`${shared.field} ${shared.fieldFull}`}>
                <label htmlFor="task-assignee" className={shared.label}>
                  Assigned Employee
                </label>
                <select
                  id="task-assignee"
                  className={shared.select}
                  {...register('assignee')}
                >
                  <option value="">Select an employee…</option>
                  {employeeOptions.map((emp) => {
                    const leaveTag =
                      emp.status === 'On Leave' && emp.leaveStart
                        ? ` · Leave ${formatDisplayDate(emp.leaveStart)}–${formatDisplayDate(
                            emp.leaveEnd
                          )}`
                        : '';
                    return (
                      <option key={emp._id} value={emp._id}>
                        {emp.fullName} ({emp.employeeId}) — {emp.department} · {emp.status} ·{' '}
                        {emp.activeTaskCount}/3 active{leaveTag}
                      </option>
                    );
                  })}
                </select>
                {errors.assignee && (
                  <span className={shared.fieldError}>{errors.assignee.message}</span>
                )}
              </div>

              <div className={shared.field}>
                <label htmlFor="task-start-date" className={shared.label}>
                  Start Date
                </label>
                <input
                  id="task-start-date"
                  type="date"
                  className={shared.input}
                  {...register('startDate')}
                />
                {errors.startDate && (
                  <span className={shared.fieldError}>{errors.startDate.message}</span>
                )}
              </div>

              <div className={shared.field}>
                <label htmlFor="task-due-date" className={shared.label}>
                  Due Date
                </label>
                <input
                  id="task-due-date"
                  type="date"
                  className={shared.input}
                  {...register('dueDate')}
                />
                {errors.dueDate && (
                  <span className={shared.fieldError}>{errors.dueDate.message}</span>
                )}
              </div>
            </div>
          </section>

          <div className={shared.formFooter}>
            <Button variant="secondary" onClick={() => navigate('/tasks')}>
              Cancel
            </Button>
            <Button
              id="btn-submit-task"
              type="submit"
              variant="primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? 'Saving…'
                : isEdit
                  ? 'Save Task Changes'
                  : 'Assign Task'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
