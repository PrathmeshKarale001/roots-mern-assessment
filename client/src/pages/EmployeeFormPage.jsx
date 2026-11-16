import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { employeesApi } from '../api/endpoints.js';
import { DEPARTMENTS, EMPLOYEE_STATUSES } from '../constants/enums.js';
import { PageHeader } from '../components/layout/AppShell.jsx';
import { Button, Callout, TableSkeleton } from '../components/ui/Primitives.jsx';
import { getTodayInputValue, toDateInputValue } from '../utils/dates.js';
import shared from '../styles/WorkspaceShared.module.css';

const employeeFormSchema = z
  .object({
    employeeId: z.string().trim().min(1, 'Employee ID is required'),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .min(7, 'Phone number is required (min 7 digits)')
      .regex(/^[+]?[\d\s\-().]{7,20}$/, 'Enter a valid phone number'),
    department: z.enum(DEPARTMENTS, {
      errorMap: () => ({ message: 'Select a valid department' }),
    }),
    role: z.string().trim().min(2, 'Role title is required'),
    joiningDate: z.string().trim().min(1, 'Joining date is required'),
    status: z.enum(EMPLOYEE_STATUSES),
    leaveStart: z.string().optional(),
    leaveEnd: z.string().optional(),
  })
  .superRefine((vals, ctx) => {
    if (vals.status === 'On Leave') {
      if (!vals.leaveStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['leaveStart'],
          message: 'Leave start date is required when status is On Leave',
        });
      }
      if (!vals.leaveEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['leaveEnd'],
          message: 'Leave end date is required when status is On Leave',
        });
      }
      if (vals.leaveStart && vals.leaveEnd && vals.leaveEnd < vals.leaveStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['leaveEnd'],
          message: 'Leave end date cannot be earlier than leave start date',
        });
      }
    }
  });

export default function EmployeeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employeeId: '',
      fullName: '',
      email: '',
      phone: '',
      department: 'Development',
      role: '',
      joiningDate: getTodayInputValue(),
      status: 'Active',
      leaveStart: '',
      leaveEnd: '',
    },
  });

  const watchedStatus = watch('status');

  const employeeQuery = useQuery({
    queryKey: ['employee', id],
    queryFn: ({ signal }) => employeesApi.getById(id, signal),
    enabled: isEdit,
  });

  useEffect(() => {
    if (employeeQuery.data?.data) {
      const emp = employeeQuery.data.data;
      reset({
        employeeId: emp.employeeId || '',
        fullName: emp.fullName || '',
        email: emp.email || '',
        phone: emp.phone || '',
        department: emp.department || 'Development',
        role: emp.role || '',
        joiningDate: toDateInputValue(emp.joiningDate),
        status: emp.status || 'Active',
        leaveStart: toDateInputValue(emp.leaveStart),
        leaveEnd: toDateInputValue(emp.leaveEnd),
      });
      setSkills(Array.isArray(emp.skills) ? emp.skills : []);
    }
  }, [employeeQuery.data, reset]);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? employeesApi.update(id, payload) : employeesApi.create(payload),
    onSuccess: (res) => {
      const saved = res?.data;
      toast.success(
        isEdit
          ? `${saved.fullName}'s profile updated`
          : `${saved.fullName} added to Roots Workspace`
      );
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/employees/${saved._id}`);
    },
    onError: (err) => {
      const msg = err?.message || 'Failed to save employee';
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

  const addSkillFromInput = () => {
    const cleaned = skillInput.trim().replace(/,+$/, '').trim();
    if (!cleaned) return;
    if (!skills.some((s) => s.toLowerCase() === cleaned.toLowerCase())) {
      setSkills((prev) => [...prev, cleaned]);
    }
    setSkillInput('');
  };

  const onSubmit = (values) => {
    setServerError('');
    const pendingSkill = skillInput.trim().replace(/,+$/, '').trim();
    const mergedSkills =
      pendingSkill && !skills.includes(pendingSkill)
        ? [...skills, pendingSkill]
        : skills;

    const payload = {
      employeeId: values.employeeId.trim().toUpperCase(),
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      department: values.department,
      role: values.role.trim(),
      joiningDate: values.joiningDate,
      status: values.status,
      leaveStart: values.status === 'On Leave' ? values.leaveStart : null,
      leaveEnd: values.status === 'On Leave' ? values.leaveEnd : null,
      skills: mergedSkills,
    };

    saveMutation.mutate(payload);
  };

  if (isEdit && employeeQuery.isLoading) {
    return <TableSkeleton rows={6} />;
  }

  if (isEdit && employeeQuery.isError) {
    return (
      <Callout tone="error">
        {employeeQuery.error?.message || 'Employee not found'}
      </Callout>
    );
  }

  return (
    <div>
      <Link to="/employees" className={shared.backLink}>
        <ArrowLeft size={15} />
        Back to Employees
      </Link>

      <PageHeader
        eyebrow={isEdit ? 'Edit Directory Profile' : 'New Team Member'}
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        subtitle="Unique Employee ID and normalized email are enforced on the server (HTTP 409 on conflict)."
      />

      <form onSubmit={handleSubmit(onSubmit)} className={shared.formLayout} noValidate>
        {serverError && <Callout tone="error">{serverError}</Callout>}

        <section className={shared.formSection}>
          <div className={shared.sectionHeader}>
            <h2 className={shared.sectionTitle}>Identity &amp; Contact</h2>
            <p className={shared.sectionHint}>
              Employee ID is normalized to uppercase; email is normalized to lowercase.
            </p>
          </div>

          <div className={shared.fieldGrid}>
            <div className={shared.field}>
              <label htmlFor="emp-id" className={shared.label}>
                Employee ID
              </label>
              <input
                id="emp-id"
                placeholder="EMP-1011"
                className={shared.input}
                {...register('employeeId')}
              />
              {errors.employeeId && (
                <span className={shared.fieldError}>{errors.employeeId.message}</span>
              )}
            </div>

            <div className={shared.field}>
              <label htmlFor="emp-name" className={shared.label}>
                Full Name
              </label>
              <input
                id="emp-name"
                placeholder="e.g.Kavya Sharma"
                className={shared.input}
                {...register('fullName')}
              />
              {errors.fullName && (
                <span className={shared.fieldError}>{errors.fullName.message}</span>
              )}
            </div>

            <div className={shared.field}>
              <label htmlFor="emp-email" className={shared.label}>
                Work Email
              </label>
              <input
                id="emp-email"
                type="email"
                placeholder="kavya.sharma@rootsmedia.in"
                className={shared.input}
                {...register('email')}
              />
              {errors.email && (
                <span className={shared.fieldError}>{errors.email.message}</span>
              )}
            </div>

            <div className={shared.field}>
              <label htmlFor="emp-phone" className={shared.label}>
                Phone Number
              </label>
              <input
                id="emp-phone"
                type="tel"
                placeholder="+91 98201 12345"
                className={shared.input}
                {...register('phone')}
              />
              {errors.phone && (
                <span className={shared.fieldError}>{errors.phone.message}</span>
              )}
            </div>
          </div>
        </section>

        <section className={shared.formSection}>
          <div className={shared.sectionHeader}>
            <h2 className={shared.sectionTitle}>Organization &amp; Availability</h2>
            <p className={shared.sectionHint}>
              Leave dates are required when status is On Leave and block overlapping task start dates.
            </p>
          </div>

          <div className={shared.fieldGrid}>
            <div className={shared.field}>
              <label htmlFor="emp-department" className={shared.label}>
                Department
              </label>
              <select
                id="emp-department"
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
              <label htmlFor="emp-role" className={shared.label}>
                Role Title
              </label>
              <input
                id="emp-role"
                placeholder="Senior Frontend Engineer"
                className={shared.input}
                {...register('role')}
              />
              {errors.role && (
                <span className={shared.fieldError}>{errors.role.message}</span>
              )}
            </div>

            <div className={shared.field}>
              <label htmlFor="emp-joining" className={shared.label}>
                Joining Date
              </label>
              <input
                id="emp-joining"
                type="date"
                className={shared.input}
                {...register('joiningDate')}
              />
              {errors.joiningDate && (
                <span className={shared.fieldError}>{errors.joiningDate.message}</span>
              )}
            </div>

            <div className={shared.field}>
              <label htmlFor="emp-status" className={shared.label}>
                Employment Status
              </label>
              <select id="emp-status" className={shared.select} {...register('status')}>
                {EMPLOYEE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {watchedStatus === 'On Leave' && (
              <>
                <div className={shared.field}>
                  <label htmlFor="emp-leave-start" className={shared.label}>
                    Leave Start Date (Inclusive)
                  </label>
                  <input
                    id="emp-leave-start"
                    type="date"
                    className={shared.input}
                    {...register('leaveStart')}
                  />
                  {errors.leaveStart && (
                    <span className={shared.fieldError}>{errors.leaveStart.message}</span>
                  )}
                </div>

                <div className={shared.field}>
                  <label htmlFor="emp-leave-end" className={shared.label}>
                    Leave End Date (Inclusive)
                  </label>
                  <input
                    id="emp-leave-end"
                    type="date"
                    className={shared.input}
                    {...register('leaveEnd')}
                  />
                  {errors.leaveEnd && (
                    <span className={shared.fieldError}>{errors.leaveEnd.message}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section className={shared.formSection}>
          <div className={shared.sectionHeader}>
            <h2 className={shared.sectionTitle}>Skills &amp; Capabilities</h2>
            <p className={shared.sectionHint}>
              Type a skill and press Enter or comma to add tags.
            </p>
          </div>

          <div className={shared.field}>
            <label htmlFor="emp-skills-input" className={shared.label}>
              Skills <span className={shared.optionalTag}>(optional)</span>
            </label>
            <input
              id="emp-skills-input"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addSkillFromInput();
                }
              }}
              onBlur={addSkillFromInput}
              placeholder="React, Node.js, MongoDB…"
              className={shared.input}
            />
            {skills.length > 0 && (
              <div className={shared.skillChips}>
                {skills.map((skill) => (
                  <span key={skill} className={shared.skillChip}>
                    {skill}
                    <button
                      type="button"
                      className={shared.skillRemoveBtn}
                      aria-label={`Remove ${skill}`}
                      onClick={() =>
                        setSkills((prev) => prev.filter((item) => item !== skill))
                      }
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className={shared.formFooter}>
          <Button variant="secondary" onClick={() => navigate('/employees')}>
            Cancel
          </Button>
          <Button
            id="btn-submit-employee"
            type="submit"
            variant="primary"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? 'Saving…'
              : isEdit
                ? 'Save Changes'
                : 'Create Employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}
