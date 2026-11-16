import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { employeesApi } from '../api/endpoints.js';
import { DEPARTMENTS } from '../constants/enums.js';
import { useDebounce, useUrlFilters } from '../hooks/useAppHooks.js';
import { PageHeader } from '../components/layout/AppShell.jsx';
import {
  Button,
  Callout,
  CapacityRing,
  ConfirmModal,
  DepartmentBadge,
  EmployeeStatusBadge,
  EmptyState,
  Pagination,
  SegmentedControl,
  TableSkeleton,
} from '../components/ui/Primitives.jsx';
import { formatDisplayDate, getInitials } from '../utils/dates.js';
import shared from '../styles/WorkspaceShared.module.css';

const FILTER_DEFAULTS = {
  search: '',
  department: '',
  status: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: '1',
};

const STATUS_SEGMENTS = [
  { value: '', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'On Leave', label: 'On Leave' },
  { value: 'Inactive', label: 'Inactive' },
];

export default function EmployeesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filters, setFilter, resetAllFilters } = useUrlFilters(FILTER_DEFAULTS);

  const [searchDraft, setSearchDraft] = useState(filters.search);
  const debouncedSearch = useDebounce(searchDraft, 260);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilter({ search: debouncedSearch }, { resetPage: true, replace: true });
    }
  }, [debouncedSearch, filters.search, setFilter]);

  const queryParams = useMemo(
    () => ({
      search: filters.search,
      department: filters.department,
      status: filters.status,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      page: filters.page,
      limit: 8,
    }),
    [filters]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['employees', queryParams],
    queryFn: ({ signal }) => employeesApi.list(queryParams, signal),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => employeesApi.remove(id),
    onSuccess: () => {
      toast.success('Employee deleted. Historical task snapshots preserved.');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Unable to delete employee');
    },
  });

  const employees = data?.data || [];
  const pagination = data?.pagination;
  const hasActiveFilters = Boolean(
    filters.search ||
      filters.department ||
      filters.status ||
      filters.sortBy !== 'createdAt' ||
      filters.sortOrder !== 'desc'
  );

  return (
    <div>
      <PageHeader
        eyebrow="Directory & Capacity"
        title="Employees"
        subtitle="Manage team members across 5 departments, leave windows, and 3-task workload limits."
        actions={
          <Button
            id="btn-add-employee"
            variant="primary"
            onClick={() => navigate('/employees/new')}
          >
            <UserPlus size={15} />
            Add Employee
          </Button>
        }
      />

      {isError && (
        <Callout tone="error">
          {error?.message || 'Could not load employees from server'}
        </Callout>
      )}

      <div className={shared.surfaceCard}>
        <div className={shared.toolbar}>
          <div className={shared.toolbarTop}>
            <div className={shared.searchWrap}>
              <Search size={15} className={shared.searchIcon} />
              <input
                id="employees-search-input"
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search by name, employee ID, email, or role…"
                className={shared.searchInput}
              />
            </div>

            <SegmentedControl
              ariaLabel="Filter employees by status"
              options={STATUS_SEGMENTS}
              value={filters.status}
              onChange={(val) => setFilter({ status: val })}
            />
          </div>

          <div className={shared.toolbarFilters}>
            <select
              id="employees-department-filter"
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
              id="employees-sort-by"
              aria-label="Sort employees by"
              value={`${filters.sortBy}:${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split(':');
                setFilter({ sortBy, sortOrder });
              }}
              className={shared.filterSelect}
            >
              <option value="createdAt:desc">Newest Added</option>
              <option value="fullName:asc">Name (A → Z)</option>
              <option value="activeTaskCount:desc">Workload (High → Low)</option>
              <option value="joiningDate:desc">Joining Date (Newest)</option>
              <option value="joiningDate:asc">Joining Date (Oldest)</option>
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
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No matching employees"
            description={
              hasActiveFilters
                ? 'Try clearing your active search or department filters.'
                : 'Add your first employee to start assigning tasks.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" onClick={resetAllFilters}>
                  Clear Filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/employees/new')}>
                  Add Employee
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
                    <th>Employee</th>
                    <th>Department &amp; Role</th>
                    <th>Status</th>
                    <th>Workload</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp._id}>
                      <td>
                        <div className={shared.personCell}>
                          <span
                            className={`${shared.avatar} ${
                              emp.status === 'Inactive' ? shared.avatarMuted : ''
                            }`.trim()}
                          >
                            {getInitials(emp.fullName)}
                          </span>
                          <div>
                            <Link
                              to={`/employees/${emp._id}`}
                              className={`${shared.primaryText} ${shared.primaryLink}`}
                            >
                              {emp.fullName}
                            </Link>
                            <span className={shared.secondaryText}>
                              <span className={shared.monoCode}>{emp.employeeId}</span> ·{' '}
                              {emp.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <DepartmentBadge department={emp.department} />
                        <span className={shared.secondaryText}>{emp.role}</span>
                      </td>
                      <td>
                        <EmployeeStatusBadge status={emp.status} />
                        {emp.status === 'On Leave' && emp.leaveStart && (
                          <span className={shared.secondaryText}>
                            {formatDisplayDate(emp.leaveStart)} –{' '}
                            {formatDisplayDate(emp.leaveEnd)}
                          </span>
                        )}
                      </td>
                      <td>
                        <CapacityRing
                          count={emp.activeTaskCount}
                          status={emp.status}
                        />
                      </td>
                      <td>{formatDisplayDate(emp.joiningDate)}</td>
                      <td>
                        <div className={shared.rowActions}>
                          <button
                            type="button"
                            className={shared.iconAction}
                            title="View profile"
                            onClick={() => navigate(`/employees/${emp._id}`)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className={shared.iconAction}
                            title="Edit employee"
                            onClick={() => navigate(`/employees/${emp._id}/edit`)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className={shared.iconAction}
                            title="Assign task to employee"
                            onClick={() =>
                              navigate(
                                `/tasks/new?assignee=${emp._id}&department=${encodeURIComponent(
                                  emp.department
                                )}`
                              )
                            }
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            type="button"
                            className={`${shared.iconAction} ${shared.iconActionDanger}`}
                            title="Delete employee"
                            onClick={() => setDeleteTarget(emp)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={shared.mobileCards}>
              {employees.map((emp) => (
                <div key={emp._id} className={shared.mobileCard}>
                  <div className={shared.mobileCardHeader}>
                    <div className={shared.personCell}>
                      <span className={shared.avatar}>{getInitials(emp.fullName)}</span>
                      <div>
                        <Link
                          to={`/employees/${emp._id}`}
                          className={`${shared.primaryText} ${shared.primaryLink}`}
                        >
                          {emp.fullName}
                        </Link>
                        <span className={shared.secondaryText}>
                          {emp.employeeId} · {emp.role}
                        </span>
                      </div>
                    </div>
                    <EmployeeStatusBadge status={emp.status} />
                  </div>

                  <div className={shared.mobileCardMeta}>
                    <DepartmentBadge department={emp.department} />
                    <CapacityRing count={emp.activeTaskCount} status={emp.status} />
                  </div>

                  <div className={shared.mobileCardFooter}>
                    <span className={shared.secondaryText}>
                      Joined {formatDisplayDate(emp.joiningDate)}
                    </span>
                    <div className={shared.rowActions}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/employees/${emp._id}`)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/employees/${emp._id}/edit`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(emp)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
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
        title={`Delete ${deleteTarget?.fullName || 'Employee'}?`}
        description={
          deleteTarget?.activeTaskCount > 0
            ? `Note: ${deleteTarget.fullName} currently holds ${deleteTarget.activeTaskCount} active task(s). The backend enforces a strict guard blocking deletion until active tasks are completed, cancelled, or reassigned.`
            : `This removes ${deleteTarget?.fullName} from active directory listings while preserving their snapshot on historical completed and cancelled tasks.`
        }
        confirmLabel="Delete Employee"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
      />
    </div>
  );
}
