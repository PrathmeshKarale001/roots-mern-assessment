import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Lock,
  Pencil,
  Play,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { tasksApi } from '../api/endpoints.js';
import {
  VALID_STATUS_TRANSITIONS,
  isTerminalTaskStatus,
} from '../constants/enums.js';
import {
  Badge,
  Button,
  Callout,
  CapacityRing,
  ConfirmModal,
  DepartmentBadge,
  EmployeeStatusBadge,
  PriorityBadge,
  TableSkeleton,
  TaskStatusBadge,
} from '../components/ui/Primitives.jsx';
import { formatDisplayDate, getInitials } from '../utils/dates.js';
import shared from '../styles/WorkspaceShared.module.css';
import styles from './TaskDetailPage.module.css';

function getStepState(stepName, currentStatus) {
  if (currentStatus === 'Cancelled') {
    if (stepName === 'Todo') return 'done';
    if (stepName === 'Cancelled') return 'cancelled';
    return 'upcoming';
  }
  const order = ['Todo', 'In Progress', 'Completed'];
  const currIdx = order.indexOf(currentStatus);
  const stepIdx = order.indexOf(stepName);
  if (currentStatus === 'Completed') return 'done';
  if (stepIdx < currIdx) return 'done';
  if (stepIdx === currIdx) return 'current';
  return 'upcoming';
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const taskQuery = useQuery({
    queryKey: ['task', id],
    queryFn: ({ signal }) => tasksApi.getById(id, signal),
  });

  const statusMutation = useMutation({
    mutationFn: (nextStatus) => tasksApi.updateStatus(id, nextStatus),
    onSuccess: (res) => {
      toast.success(`Task transitioned to ${res.data.status}`);
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-options'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Status transition rejected');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.remove(id),
    onSuccess: () => {
      toast.success('Task deleted');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/tasks');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to delete task');
    },
  });

  if (taskQuery.isLoading) {
    return <TableSkeleton rows={5} />;
  }

  if (taskQuery.isError || !taskQuery.data?.data) {
    return (
      <Callout tone="error">
        {taskQuery.error?.message || 'Task record not found'}
      </Callout>
    );
  }

  const task = taskQuery.data.data;
  const locked = isTerminalTaskStatus(task.status);
  const allowedNext = VALID_STATUS_TRANSITIONS[task.status] || [];
  const populatedEmp =
    task.assignee && typeof task.assignee === 'object' ? task.assignee : null;
  const snap = task.assigneeSnapshot || {};

  const thirdStep = task.status === 'Cancelled' ? 'Cancelled' : 'Completed';
  const steps = [
    { key: 'Todo', sub: `Created ${formatDisplayDate(task.createdAt)}` },
    { key: 'In Progress', sub: 'Active execution' },
    {
      key: thirdStep,
      sub:
        task.status === 'Completed' && task.completedDate
          ? `Server stamped ${formatDisplayDate(task.completedDate)}`
          : task.status === 'Cancelled'
            ? 'Closed without completion'
            : 'Stamped by server on completion',
    },
  ];

  return (
    <div>
      <Link to="/tasks" className={shared.backLink}>
        <ArrowLeft size={15} />
        Back to Tasks
      </Link>

      <section className={shared.detailHero}>
        <div>
          <span className={shared.monoCode}>{task.taskId}</span>
          <h1>{task.title}</h1>
          <div className={shared.heroMetaRow}>
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <DepartmentBadge department={task.department} />
            {task.isOverdue && (
              <Badge tone="red">{task.daysOverdue}d Overdue</Badge>
            )}
          </div>
        </div>

        <div className={shared.heroMetaRow}>
          {!locked ? (
            <Button
              variant="secondary"
              onClick={() => navigate(`/tasks/${task._id}/edit`)}
            >
              <Pencil size={15} />
              Edit Task
            </Button>
          ) : (
            <Badge tone="neutral">
              <Lock size={12} /> Editing Locked ({task.status})
            </Badge>
          )}
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} />
            Delete
          </Button>
        </div>
      </section>

      {task.isOverdue && (
        <div className={shared.heroMetaRow}>
          <Callout tone="error">
            <strong>Overdue Alert:</strong> Today is {task.daysOverdue} day(s) past this
            task&apos;s due date ({formatDisplayDate(task.dueDate)}) while the task is still{' '}
            {task.status}.
          </Callout>
        </div>
      )}

      <section className={styles.stepperCard} aria-label="Task lifecycle state machine">
        <div className={styles.stepperTrack}>
          {steps.map((step, index) => {
            const state = getStepState(step.key, task.status);
            return (
              <div key={step.key} className={styles.stepNode} data-state={state}>
                <span className={styles.stepDot}>
                  {state === 'done' ? <Check size={14} /> : index + 1}
                </span>
                <div>
                  <div className={styles.stepLabel}>{step.key}</div>
                  <div className={styles.stepSub}>{step.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.transitionBar}>
          <span className={shared.sectionHint}>
            {locked
              ? `Terminal state reached (${task.status}). No further transitions permitted.`
              : 'Status transitions execute via dedicated PUT /api/tasks/:id/status'}
          </span>

          {allowedNext.length > 0 && (
            <div className={styles.transitionActions}>
              {allowedNext.map((nextStatus) => {
                const isCancel = nextStatus === 'Cancelled';
                return (
                  <Button
                    key={nextStatus}
                    variant={isCancel ? 'danger' : 'primary'}
                    size="sm"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(nextStatus)}
                  >
                    {isCancel ? <XCircle size={14} /> : <Play size={14} />}
                    Mark {nextStatus}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className={shared.detailGrid}>
        <aside className={shared.formSection}>
          <div className={shared.sectionHeader}>
            <h2 className={shared.sectionTitle}>Assigned Employee</h2>
          </div>

          {populatedEmp ? (
            <div className={styles.assigneeCard}>
              <div className={shared.personCell}>
                <span className={shared.avatar}>
                  {getInitials(populatedEmp.fullName)}
                </span>
                <div>
                  <Link
                    to={`/employees/${populatedEmp._id}`}
                    className={`${shared.primaryText} ${shared.primaryLink}`}
                  >
                    {populatedEmp.fullName}
                  </Link>
                  <span className={shared.secondaryText}>
                    {populatedEmp.employeeId} · {populatedEmp.role}
                  </span>
                </div>
              </div>
              <div className={shared.heroMetaRow}>
                <EmployeeStatusBadge status={populatedEmp.status} />
                <CapacityRing
                  count={populatedEmp.activeTaskCount}
                  status={populatedEmp.status}
                  size={30}
                />
              </div>
            </div>
          ) : snap.fullName ? (
            <div className={styles.assigneeCard}>
              <div className={shared.personCell}>
                <span className={`${shared.avatar} ${shared.avatarMuted}`}>
                  {getInitials(snap.fullName)}
                </span>
                <div>
                  <span className={shared.primaryText}>{snap.fullName}</span>
                  <span className={shared.secondaryText}>
                    {snap.employeeId} · {snap.role} ({snap.department})
                  </span>
                </div>
              </div>
              <div className={shared.heroMetaRow}>
                <Badge tone="orange">Former Employee (Deleted)</Badge>
                <span className={shared.secondaryText}>{snap.email}</span>
              </div>
            </div>
          ) : (
            <span className={shared.secondaryText}>Unassigned</span>
          )}

          <div className={shared.sectionHeader}>
            <h3 className={shared.sectionTitle}>Dates &amp; Metadata</h3>
          </div>
          <div className={shared.infoList}>
            <div className={shared.infoItem}>
              <span className={shared.infoKey}>Start Date</span>
              <span className={shared.infoVal}>{formatDisplayDate(task.startDate)}</span>
            </div>
            <div className={shared.infoItem}>
              <span className={shared.infoKey}>Due Date</span>
              <span className={shared.infoVal}>{formatDisplayDate(task.dueDate)}</span>
            </div>
            <div className={shared.infoItem}>
              <span className={shared.infoKey}>Created Date</span>
              <span className={shared.infoVal}>{formatDisplayDate(task.createdAt)}</span>
            </div>
            <div className={shared.infoItem}>
              <span className={shared.infoKey}>Completed Date</span>
              <span className={shared.infoVal}>
                {task.completedDate ? formatDisplayDate(task.completedDate) : '—'}
              </span>
            </div>
          </div>
        </aside>

        <section className={shared.formSection}>
          <div className={shared.sectionHeader}>
            <h2 className={shared.sectionTitle}>Task Specification &amp; Notes</h2>
          </div>
          {task.description ? (
            <p className={styles.descriptionProse}>{task.description}</p>
          ) : (
            <span className={shared.secondaryText}>
              No additional description was provided for this task.
            </span>
          )}
        </section>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title={`Delete ${task.taskId}?`}
        description={`Permanently delete "${task.title}"?`}
        confirmLabel="Delete Task"
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
