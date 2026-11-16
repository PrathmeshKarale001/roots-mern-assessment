import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Lock } from 'lucide-react';
import {
  MAX_ACTIVE_TASKS,
  VALID_STATUS_TRANSITIONS,
} from '../../constants/enums.js';
import styles from './Primitives.module.css';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  onClick,
  id,
  title,
}) {
  const variantClass = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    tinted: styles.btnTinted,
    danger: styles.btnDanger,
    ghost: styles.btnGhost,
  }[variant] || styles.btnPrimary;

  const sizeClass =
    size === 'sm' ? styles.btnSm : size === 'lg' ? styles.btnLg : '';

  return (
    <button
      id={id}
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.btn} ${variantClass} ${sizeClass}`.trim()}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', dot = false }) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {dot && <span className={styles.badgeDot} />}
      {children}
    </span>
  );
}

export function EmployeeStatusBadge({ status }) {
  const toneMap = {
    Active: 'green',
    'On Leave': 'orange',
    Inactive: 'neutral',
  };
  return (
    <Badge tone={toneMap[status] || 'neutral'} dot>
      {status}
    </Badge>
  );
}

export function TaskStatusBadge({ status }) {
  const toneMap = {
    Todo: 'neutral',
    'In Progress': 'blue',
    Completed: 'green',
    Cancelled: 'red',
  };
  return (
    <Badge tone={toneMap[status] || 'neutral'} dot>
      {status}
    </Badge>
  );
}

export function PriorityBadge({ priority }) {
  const toneMap = {
    Low: 'neutral',
    Medium: 'teal',
    High: 'orange',
    Critical: 'red',
  };
  return <Badge tone={toneMap[priority] || 'neutral'}>{priority}</Badge>;
}

export function DepartmentBadge({ department }) {
  const toneMap = {
    Development: 'indigo',
    Design: 'teal',
    QA: 'orange',
    HR: 'green',
    Sales: 'blue',
  };
  return <Badge tone={toneMap[department] || 'neutral'}>{department}</Badge>;
}

export function SegmentedControl({ options = [], value, onChange, ariaLabel }) {
  return (
    <div className={styles.segmented} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = String(opt.value) === String(value);
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`${styles.segmentBtn} ${active ? styles.segmentBtnActive : ''}`.trim()}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pure SVG Apple Watch Activity-ring style capacity gauge (0/3 .. 3/3) — zero inline styles.
 */
export function CapacityRing({
  count = 0,
  max = MAX_ACTIVE_TASKS,
  status = 'Active',
  size = 34,
  showLabel = true,
}) {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(max, Number(count) || 0));
  const ratio = max > 0 ? clamped / max : 0;
  const dashOffset = circumference * (1 - ratio);

  let tone = 'green';
  if (status === 'Inactive') {
    tone = 'muted';
  } else if (clamped >= max) {
    tone = 'red';
  } else if (clamped === max - 1) {
    tone = 'orange';
  } else if (clamped > 0) {
    tone = 'blue';
  }

  return (
    <div className={styles.ringWrap} title={`${clamped} of ${max} active tasks`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.ringSvg}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={styles.ringTrack}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference.toFixed(2)}
          strokeDashoffset={dashOffset.toFixed(2)}
          className={styles.ringProgress}
          data-tone={tone}
        />
      </svg>
      {showLabel && (
        <div>
          <span className={styles.ringLabel}>
            {clamped}/{max}
          </span>{' '}
          <span className={styles.ringSub}>active</span>
        </div>
      )}
    </div>
  );
}

/**
 * Dropdown offering ONLY valid next task statuses per backend state machine.
 * Renders a locked badge for Completed / Cancelled tasks.
 */
export function TaskStatusSelect({
  currentStatus,
  onStatusChange,
  disabled = false,
  id,
}) {
  const nextStatuses = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  if (nextStatuses.length === 0) {
    return (
      <span className={styles.statusSelectWrap} title="Terminal status — locked">
        <TaskStatusBadge status={currentStatus} />
        <Lock size={13} />
      </span>
    );
  }

  return (
    <select
      id={id}
      aria-label={`Change task status from ${currentStatus}`}
      value={currentStatus}
      disabled={disabled}
      data-status={currentStatus}
      className={styles.statusSelect}
      onChange={(e) => {
        const chosen = e.target.value;
        if (chosen && chosen !== currentStatus) {
          onStatusChange(chosen);
        }
      }}
    >
      <option value={currentStatus}>{currentStatus}</option>
      {nextStatuses.map((next) => (
        <option key={next} value={next}>
          Move to {next}
        </option>
      ))}
    </select>
  );
}

export function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, limit, total, totalPages, hasPrevPage, hasNextPage } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p += 1) {
    pages.push(p);
  }

  return (
    <div className={styles.pagination}>
      <span className={styles.pageSummary}>
        Showing <strong>{start}</strong>–<strong>{end}</strong> of{' '}
        <strong>{total}</strong>
      </span>
      <div className={styles.pageControls}>
        <button
          type="button"
          className={styles.pagePill}
          disabled={!hasPrevPage}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`${styles.pagePill} ${p === page ? styles.pagePillActive : ''}`.trim()}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className={styles.pagePill}
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className={styles.modalSheet}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.modalTitle}>{title}</h3>
        <p className={styles.modalDesc}>{description}</p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className={styles.emptyBox}>
      <div className={styles.emptyIcon}>
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h3 className={styles.emptyTitle}>{title}</h3>
      {description && <p className={styles.emptyDesc}>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

export function Callout({ tone = 'info', children }) {
  return (
    <div className={styles.callout} data-tone={tone} role="alert">
      <AlertCircle size={17} strokeWidth={2} />
      <div>{children}</div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
      ))}
    </div>
  );
}

export function BentoSkeleton({ cards = 4 }) {
  return (
    <>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />
      ))}
    </>
  );
}
