import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Layers,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';
import { dashboardApi } from '../api/endpoints.js';
import { PageHeader } from '../components/layout/AppShell.jsx';
import {
  Badge,
  BentoSkeleton,
  Button,
  Callout,
  CapacityRing,
  EmployeeStatusBadge,
  EmptyState,
  PriorityBadge,
  TaskStatusBadge,
} from '../components/ui/Primitives.jsx';
import { formatDisplayDate, getInitials } from '../utils/dates.js';
import styles from './DashboardPage.module.css';

function SvgMetricBar({ label, count, total, tone = 'blue' }) {
  const pct = total > 0 ? Math.max(count > 0 ? 3 : 0, Math.round((count / total) * 100)) : 0;
  return (
    <div className={styles.barRow}>
      <div className={styles.barHeader}>
        <span className={styles.barLabel}>{label}</span>
        <span className={styles.barCount}>
          {count} <small>({total > 0 ? Math.round((count / total) * 100) : 0}%)</small>
        </span>
      </div>
      <svg
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        className={styles.barSvg}
        aria-hidden="true"
      >
        <rect x="0" y="0" width="100" height="8" rx="4" className={styles.barBg} />
        {pct > 0 && (
          <rect
            x="0"
            y="0"
            width={pct}
            height="8"
            rx="4"
            className={styles.barFill}
            data-tone={tone}
          />
        )}
      </svg>
    </div>
  );
}

const STATUS_TONES = {
  Todo: 'neutral',
  'In Progress': 'blue',
  Completed: 'green',
  Cancelled: 'red',
};

const PRIORITY_TONES = {
  Critical: 'red',
  High: 'orange',
  Medium: 'teal',
  Low: 'neutral',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => dashboardApi.getSummary(signal),
  });

  const summary = data?.data;

  return (
    <div>
      <PageHeader
        eyebrow="Organization Pulse"
        title="Executive Overview"
        subtitle="Live workforce capacity, task velocity, and SLA health calculated directly on the server."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/employees/new')}>
              <UserPlus size={15} />
              Add Employee
            </Button>
            <Button variant="primary" onClick={() => navigate('/tasks/new')}>
              <Plus size={15} />
              Assign Task
            </Button>
          </>
        }
      />

      {isError && (
        <Callout tone="error">
          Failed to load dashboard metrics: {error?.message || 'Unknown server error'}
        </Callout>
      )}

      <section className={styles.kpiGrid} aria-label="Key metrics">
        {isLoading || !summary ? (
          <BentoSkeleton cards={4} />
        ) : (
          <>
            <Link to="/employees" className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Team Members</span>
                <span className={styles.kpiIconBox} data-tone="blue">
                  <Users size={18} />
                </span>
              </div>
              <div className={styles.kpiValue}>{summary.employees.total}</div>
              <div className={styles.kpiMeta}>
                <strong>{summary.employees.active}</strong> Active ·{' '}
                <strong>{summary.employees.onLeave}</strong> On Leave ·{' '}
                <strong>{summary.employees.inactive}</strong> Inactive
              </div>
            </Link>

            <Link to="/tasks" className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Active Workload</span>
                <span className={styles.kpiIconBox} data-tone="indigo">
                  <Layers size={18} />
                </span>
              </div>
              <div className={styles.kpiValue}>{summary.tasks.active}</div>
              <div className={styles.kpiMeta}>
                <strong>{summary.tasks.todo}</strong> Todo ·{' '}
                <strong>{summary.tasks.inProgress}</strong> In Progress (of{' '}
                {summary.tasks.total} total)
              </div>
            </Link>

            <Link to="/tasks?status=Completed" className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Completion Rate</span>
                <span className={styles.kpiIconBox} data-tone="green">
                  <CheckCircle2 size={18} />
                </span>
              </div>
              <div className={styles.kpiValue}>{summary.tasks.completionRate}%</div>
              <div className={styles.kpiMeta}>
                <strong>{summary.tasks.completed}</strong> Completed ·{' '}
                <strong>{summary.tasks.cancelled}</strong> Cancelled
              </div>
            </Link>

            <Link
              to="/tasks?overdue=true"
              className={`${styles.kpiCard} ${
                summary.tasks.overdue > 0 ? styles.kpiCardUrgent : ''
              }`.trim()}
            >
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Overdue Tasks</span>
                <span className={styles.kpiIconBox} data-tone="red">
                  <AlertTriangle size={18} />
                </span>
              </div>
              <div className={styles.kpiValue}>{summary.tasks.overdue}</div>
              <div className={styles.kpiMeta}>
                {summary.tasks.overdue > 0
                  ? 'Past due date & still open — requires attention'
                  : 'All active tasks are within schedule'}
              </div>
            </Link>
          </>
        )}
      </section>

      {summary && (
        <>
          <section className={styles.bentoGrid}>
            <div className={styles.bentoPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Employee Capacity Rings</h2>
                  <p className={styles.panelSub}>
                    Max 3 active tasks (Todo + In Progress) enforced atomically per employee
                  </p>
                </div>
                <Link to="/employees" className={styles.panelLink}>
                  All people <ArrowRight size={14} />
                </Link>
              </div>

              {summary.workload.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No employees yet"
                  description="Add your first employee to start tracking capacity across departments."
                />
              ) : (
                <div className={styles.workloadList}>
                  {summary.workload.map((emp) => (
                    <Link
                      key={emp._id}
                      to={`/employees/${emp._id}`}
                      className={styles.workloadRow}
                    >
                      <div className={styles.workloadIdentity}>
                        <span className={styles.workloadAvatar}>
                          {getInitials(emp.fullName)}
                        </span>
                        <div>
                          <div className={styles.workloadName}>{emp.fullName}</div>
                          <div className={styles.workloadRole}>
                            <span>{emp.department}</span>
                            <span>·</span>
                            <EmployeeStatusBadge status={emp.status} />
                          </div>
                        </div>
                      </div>
                      <CapacityRing
                        count={emp.activeTaskCount}
                        max={emp.maxCapacity}
                        status={emp.status}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.bentoPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Status, Priority &amp; Department Mix</h2>
                  <p className={styles.panelSub}>Server-aggregated task distribution</p>
                </div>
                <Link to="/tasks" className={styles.panelLink}>
                  Explore tasks <ArrowRight size={14} />
                </Link>
              </div>

              <div className={styles.barGroup}>
                <div className={styles.dividerLabel}>By Lifecycle Status</div>
                {summary.tasks.byStatus.map((row) => (
                  <SvgMetricBar
                    key={row.status}
                    label={row.status}
                    count={row.count}
                    total={summary.tasks.total}
                    tone={STATUS_TONES[row.status] || 'blue'}
                  />
                ))}

                <div className={styles.dividerLabel}>By Priority Importance</div>
                {[...summary.tasks.byPriority]
                  .sort((a, b) => b.rank - a.rank)
                  .map((row) => (
                    <SvgMetricBar
                      key={row.priority}
                      label={row.priority}
                      count={row.count}
                      total={summary.tasks.total}
                      tone={PRIORITY_TONES[row.priority] || 'teal'}
                    />
                  ))}

                <div className={styles.dividerLabel}>By Department</div>
                {summary.tasks.byDepartment.map((dept) => (
                  <SvgMetricBar
                    key={dept.department}
                    label={`${dept.department} (${dept.active} active)`}
                    count={dept.total}
                    total={summary.tasks.total}
                    tone="indigo"
                  />
                ))}
              </div>
            </div>
          </section>

          <section className={styles.bentoGrid}>
            <div className={styles.bentoPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Overdue Spotlight</h2>
                  <p className={styles.panelSub}>
                    Tasks where today is past the due date and status is still open
                  </p>
                </div>
                <Link to="/tasks?overdue=true" className={styles.panelLink}>
                  Filter overdue <ArrowRight size={14} />
                </Link>
              </div>

              {summary.overdueTasks.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Zero overdue tasks"
                  description="Every active task across all 5 departments is currently on schedule."
                />
              ) : (
                <div className={styles.feedList}>
                  {summary.overdueTasks.map((task) => {
                    const assigneeName =
                      task.assignee?.fullName ||
                      task.assigneeSnapshot?.fullName ||
                      'Unassigned';
                    return (
                      <Link
                        key={task._id}
                        to={`/tasks/${task._id}`}
                        className={`${styles.feedItem} ${styles.feedItemOverdue}`}
                      >
                        <div>
                          <div className={styles.feedTitle}>{task.title}</div>
                          <div className={styles.feedMeta}>
                            {task.taskId} · {assigneeName} · Due{' '}
                            {formatDisplayDate(task.dueDate)}
                          </div>
                        </div>
                        <div className={styles.workloadRole}>
                          <PriorityBadge priority={task.priority} />
                          <Badge tone="red">{task.daysOverdue}d overdue</Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.bentoPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Recent Tasks</h2>
                  <p className={styles.panelSub}>Latest assignments across departments</p>
                </div>
                <Link to="/tasks" className={styles.panelLink}>
                  All tasks <ArrowRight size={14} />
                </Link>
              </div>

              {summary.recentTasks.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="No tasks created yet"
                  description="Assign a task to an active employee to get started."
                />
              ) : (
                <div className={styles.feedList}>
                  {summary.recentTasks.map((task) => {
                    const assigneeName =
                      task.assignee?.fullName ||
                      task.assigneeSnapshot?.fullName ||
                      'Unassigned';
                    return (
                      <Link
                        key={task._id}
                        to={`/tasks/${task._id}`}
                        className={styles.feedItem}
                      >
                        <div>
                          <div className={styles.feedTitle}>{task.title}</div>
                          <div className={styles.feedMeta}>
                            {task.taskId} · {assigneeName} · {task.department}
                          </div>
                        </div>
                        <div className={styles.workloadRole}>
                          {task.isOverdue && <Badge tone="red">Overdue</Badge>}
                          <TaskStatusBadge status={task.status} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
