import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { employeesApi, tasksApi } from '../api/endpoints.js';
import {
  Badge,
  Button,
  Callout,
  CapacityRing,
  ConfirmModal,
  DepartmentBadge,
  EmployeeStatusBadge,
  EmptyState,
  PriorityBadge,
  TableSkeleton,
  TaskStatusSelect,
} from '../components/ui/Primitives.jsx';
import { formatDisplayDate, getInitials } from '../utils/dates.js';
import shared from '../styles/WorkspaceShared.module.css';

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const empQuery = useQuery({
    queryKey: ['employee', id],
    queryFn: ({ signal }) => employeesApi.getById(id, signal),
  });

  const tasksQuery = useQuery({
    queryKey: ['employee-tasks', id],
    queryFn: ({ signal }) => employeesApi.getTasks(id, signal),
  });

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }) => tasksApi.updateStatus(taskId, status),
    onSuccess: (res) => {
      toast.success(`Task moved to ${res.data.status}`);
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employee-tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Status update failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => employeesApi.remove(id),
    onSuccess: () => {
      toast.success('Employee deleted; historical task snapshots preserved.');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/employees');
    },
    onError: (err) => {
      toast.error(err?.message || 'Cannot delete employee');
      setConfirmDelete(false);
    },
  });

  if (empQuery.isLoading) {
    return <TableSkeleton rows={5} />;
  }

  if (empQuery.isError || !empQuery.data?.data) {
    return (
      <Callout tone="error">
        {empQuery.error?.message || 'Employee record could not be found'}
      </Callout>
    );
  }

  const emp = empQuery.data.data;
  const tasks = tasksQuery.data?.data || [];

  return (
    <div>
      <Link to="/employees" className={shared.backLink}>
        <ArrowLeft size={15} />
        Back to Employees
      </Link>

      <section className={shared.detailHero}>
        <div className={shared.heroIdentity}>
          <span className={`${shared.avatar} ${shared.avatarLg}`}>
            {getInitials(emp.fullName)}
          </span>
          <div>
            <span className={shared.monoCode}>{emp.employeeId}</span>
            <h1>{emp.fullName}</h1>
            <div className={shared.heroMetaRow}>
              <DepartmentBadge department={emp.department} />
              <EmployeeStatusBadge status={emp.status} />
              <span className={shared.secondaryText}>{emp.role}</span>
            </div>
          </div>
        </div>

        <div className={shared.heroMetaRow}>
          <CapacityRing count={emp.activeTaskCount} status={emp.status} size={46} />
          {emp.status !== 'Inactive' && emp.activeTaskCount < 3 && (
            <Button
              variant="primary"
              onClick={() =>
                navigate(
                  `/tasks/new?assignee=${emp._id}&department=${encodeURIComponent(
                    emp.department
                  )}`
                )
              }
            >
              <Plus size={15} />
              Assign Task
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => navigate(`/employees/${emp._id}/edit`)}
          >
            <Pencil size={15} />
            Edit
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} />
            Delete
          </Button>
        </div>
      </section>

      {emp.status === 'On Leave' && emp.leaveStart && (
        <div className={shared.heroMetaRow}>
          <Callout tone="warning">
            <strong>Active Leave Window:</strong> {formatDisplayDate(emp.leaveStart)} to{' '}
            {formatDisplayDate(emp.leaveEnd)} (inclusive). Tasks whose start date falls
            inside this window are blocked by the backend, while tasks starting before or
            after leave remain assignable.
          </Callout>
        </div>
      )}

      {emp.status === 'Inactive' && (
        <div className={shared.heroMetaRow}>
          <Callout tone="info">
            This employee is marked <strong>Inactive</strong>. New task assignments are
            rejected by the backend until their status is returned to Active.
          </Callout>
        </div>
      )}

      <div className={shared.detailGrid}>
        <aside className={shared.formSection}>
          <div className={shared.sectionHeader}>
            <h2 className={shared.sectionTitle}>Profile Details</h2>
          </div>

          <div className={shared.infoList}>
            <div className={shared.infoItem}>
              <span className={shared.infoKey}>
                <Mail size={13} /> Email
              </span>
              <span className={shared.infoVal}>{emp.email}</span>
            </div>
            <div className={shared.infoItem}>
              <span className={shared.infoKey}>
                <Phone size={13} /> Phone
              </span>
              <span className={shared.infoVal}>{emp.phone || '—'}</span>
            </div>
            <div className={shared.infoItem}>
              <span className={shared.infoKey}>
                <Calendar size={13} /> Joined
              </span>
              <span className={shared.infoVal}>{formatDisplayDate(emp.joiningDate)}</span>
            </div>
            <div className={shared.infoItem}>
              <span className={shared.infoKey}>Active Capacity</span>
              <span className={shared.infoVal}>{emp.activeTaskCount} / 3 tasks</span>
            </div>
          </div>

          <div className={shared.sectionHeader}>
            <h3 className={shared.sectionTitle}>Skills</h3>
          </div>
          {emp.skills?.length ? (
            <div className={shared.skillChips}>
              {emp.skills.map((skill) => (
                <span key={skill} className={shared.skillChip}>
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <span className={shared.secondaryText}>No skills listed yet.</span>
          )}
        </aside>

        <section className={shared.surfaceCard}>
          <div className={shared.toolbar}>
            <div className={shared.toolbarTop}>
              <div>
                <h2 className={shared.sectionTitle}>
                  Assigned Tasks ({tasks.length})
                </h2>
                <span className={shared.sectionHint}>
                  Update task lifecycle status directly using valid transitions
                </span>
              </div>
              <Link to={`/tasks?assignee=${emp._id}`} className={shared.backLink}>
                Open in Task Explorer →
              </Link>
            </div>
          </div>

          {tasksQuery.isLoading ? (
            <div className={shared.toolbar}>
              <TableSkeleton rows={4} />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No tasks assigned"
              description="This employee has no active or historical tasks yet."
            />
          ) : (
            <div className={shared.tableWrap}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
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
                          <span className={shared.monoCode}>{task.taskId}</span> ·{' '}
                          {task.department}
                        </span>
                      </td>
                      <td>
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td>
                        <span>{formatDisplayDate(task.dueDate)}</span>
                        {task.isOverdue && (
                          <div>
                            <Badge tone="red">{task.daysOverdue}d overdue</Badge>
                          </div>
                        )}
                      </td>
                      <td>
                        <TaskStatusSelect
                          currentStatus={task.status}
                          disabled={statusMutation.isPending}
                          onStatusChange={(nextStatus) =>
                            statusMutation.mutate({
                              taskId: task._id,
                              status: nextStatus,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title={`Delete ${emp.fullName}?`}
        description={
          emp.activeTaskCount > 0
            ? `${emp.fullName} currently has ${emp.activeTaskCount} active task(s). Deletion will be rejected by the backend until those tasks are completed, cancelled, or reassigned.`
            : `Remove ${emp.fullName} from active directory? Any completed or cancelled tasks will permanently retain their employee snapshot.`
        }
        confirmLabel="Delete Employee"
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
