import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Employee from '../src/models/Employee.js';
import Task from '../src/models/Task.js';
import Counter from '../src/models/Counter.js';
import { PRIORITY_RANKS } from '../src/constants/enums.js';
import { getTodayUtcCalendarDate, parseUtcCalendarDate } from '../src/utils/dates.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function shiftDays(baseUtc, deltaDays) {
  return new Date(baseUtc.getTime() + deltaDays * MS_PER_DAY);
}

async function seed() {
  await connectDB();
  const today = getTodayUtcCalendarDate();

  await Promise.all([
    Employee.deleteMany({}),
    Task.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  const rawEmployees = [
    {
      employeeId: 'EMP-1001',
      fullName: 'Aarav Mehta',
      email: 'aarav.mehta@rootsmedia.in',
      phone: '+91 98201 44110',
      department: 'Development',
      role: 'Staff Full-Stack Engineer',
      status: 'Active',
      joiningDate: parseUtcCalendarDate('2024-02-12'),
      skills: ['Node.js', 'React', 'MongoDB', 'TypeScript', 'Architecture'],
    },
    {
      employeeId: 'EMP-1002',
      fullName: 'Ananya Iyer',
      email: 'ananya.iyer@rootsmedia.in',
      phone: '+91 98192 55320',
      department: 'Design',
      role: 'Principal Product Designer',
      status: 'Active',
      joiningDate: parseUtcCalendarDate('2024-05-03'),
      skills: ['Design Systems', 'Figma', 'Prototyping', 'Motion'],
    },
    {
      employeeId: 'EMP-1003',
      fullName: 'Rohan Deshmukh',
      email: 'rohan.deshmukh@rootsmedia.in',
      phone: '+91 97654 22890',
      department: 'QA',
      role: 'Lead Quality Engineer',
      status: 'Active',
      joiningDate: parseUtcCalendarDate('2024-08-19'),
      skills: ['Playwright', 'Supertest', 'API Automation', 'CI/CD'],
    },
    {
      employeeId: 'EMP-1004',
      fullName: 'Meera Nair',
      email: 'meera.nair@rootsmedia.in',
      phone: '+91 98450 71234',
      department: 'HR',
      role: 'People Operations Partner',
      status: 'Active',
      joiningDate: parseUtcCalendarDate('2023-11-10'),
      skills: ['Onboarding', 'Policy Design', 'Talent Ops', 'Compliance'],
    },
    {
      employeeId: 'EMP-1005',
      fullName: 'Kabir Malhotra',
      email: 'kabir.malhotra@rootsmedia.in',
      phone: '+91 98111 63400',
      department: 'Sales',
      role: 'Enterprise Account Director',
      status: 'Active',
      joiningDate: parseUtcCalendarDate('2024-01-22'),
      skills: ['Enterprise SaaS', 'Negotiation', 'CRM', 'Forecasting'],
    },
    {
      employeeId: 'EMP-1006',
      fullName: 'Diya Kulkarni',
      email: 'diya.kulkarni@rootsmedia.in',
      phone: '+91 99208 31092',
      department: 'Development',
      role: 'Backend Platform Engineer',
      status: 'Active',
      joiningDate: parseUtcCalendarDate('2025-01-15'),
      skills: ['Express', 'Mongoose', 'Redis', 'Observability'],
    },
    {
      employeeId: 'EMP-1007',
      fullName: 'Siddharth Rao',
      email: 'siddharth.rao@rootsmedia.in',
      phone: '+91 98860 11845',
      department: 'Design',
      role: 'Brand & Visual Designer',
      status: 'On Leave',
      joiningDate: parseUtcCalendarDate('2024-09-02'),
      leaveStart: shiftDays(today, -2),
      leaveEnd: shiftDays(today, 5),
      skills: ['Brand Identity', 'Typography', 'Illustration'],
    },
    {
      employeeId: 'EMP-1008',
      fullName: 'Neha Verma',
      email: 'neha.verma@rootsmedia.in',
      phone: '+91 98712 90431',
      department: 'QA',
      role: 'Performance Test Specialist',
      status: 'Active',
      joiningDate: parseUtcCalendarDate('2025-03-10'),
      skills: ['k6', 'Load Testing', 'Security Audits'],
    },
    {
      employeeId: 'EMP-1009',
      fullName: 'Vikram Joshi',
      email: 'vikram.joshi@rootsmedia.in',
      phone: '+91 98230 88512',
      department: 'Sales',
      role: 'Growth Partnerships Lead',
      status: 'Inactive',
      joiningDate: parseUtcCalendarDate('2023-07-01'),
      skills: ['Channel Sales', 'Lead Gen', 'Pitch Decks'],
    },
    {
      employeeId: 'EMP-1010',
      fullName: 'Priya Chatterjee',
      email: 'priya.chatterjee@rootsmedia.in',
      phone: '+91 98301 55219',
      department: 'HR',
      role: 'Talent Acquisition Lead',
      status: 'Active',
      joiningDate: parseUtcCalendarDate('2025-02-03'),
      skills: ['Technical Recruiting', 'Employer Branding', 'Compensation'],
    },
  ];

  const employees = await Employee.insertMany(rawEmployees);
  const byEmpId = Object.fromEntries(employees.map((e) => [e.employeeId, e]));

  function snapOf(emp) {
    return {
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      email: emp.email,
      department: emp.department,
      role: emp.role,
      isDeleted: false,
    };
  }

  // Aarav (EMP-1001): 3 active tasks (3/3 FULL capacity, 1 overdue)
  // Ananya (EMP-1002): 2 active tasks (2/3, 1 overdue) + 1 completed
  // Rohan (EMP-1003): 2 active tasks (2/3) + 1 cancelled
  // Meera (EMP-1004): 1 active task (1/3) + 1 completed
  // Kabir (EMP-1005): 1 active task (1/3, overdue)
  // Diya (EMP-1006): 1 active task (1/3)
  // Neha (EMP-1008): 0 active tasks (0/3 available)
  // Priya (EMP-1010): 0 active tasks (0/3 available) + 1 completed
  // Plus 1 historical Completed task belonging to a deleted Former Employee (EMP-0999)
  const taskSpecs = [
    {
      title: 'Harden atomic MongoDB capacity reservation under burst traffic',
      description:
        'Ensure concurrent task assignments cannot exceed 3 active tasks per employee on standalone MongoDB.',
      emp: byEmpId['EMP-1001'],
      department: 'Development',
      priority: 'Critical',
      status: 'In Progress',
      startDate: shiftDays(today, -8),
      dueDate: shiftDays(today, -2), // OVERDUE
    },
    {
      title: 'Implement RFC-4180 filter-synced streaming CSV export',
      description:
        'Stream filtered tasks directly from Mongoose cursor with UTF-8 BOM and formula-injection guards.',
      emp: byEmpId['EMP-1001'],
      department: 'Development',
      priority: 'High',
      status: 'In Progress',
      startDate: shiftDays(today, -3),
      dueDate: shiftDays(today, 3),
    },
    {
      title: 'Configure dual Vercel serverless rewrites for API and SPA',
      description:
        'Verify serverless cold-start connection reuse and client history fallback routing.',
      emp: byEmpId['EMP-1001'],
      department: 'Development',
      priority: 'Medium',
      status: 'Todo',
      startDate: shiftDays(today, 0),
      dueDate: shiftDays(today, 6),
    },
    {
      title: 'Craft Apple Sequoia frosted sidebar and semantic dark-mode tokens',
      description:
        'Define surface elevation, hairline borders, and SF Pro typographic scale in tokens.css.',
      emp: byEmpId['EMP-1002'],
      department: 'Design',
      priority: 'Critical',
      status: 'In Progress',
      startDate: shiftDays(today, -7),
      dueDate: shiftDays(today, -1), // OVERDUE
    },
    {
      title: 'Design radial Activity-ring employee capacity gauges',
      description:
        'Build pure SVG 0/3 to 3/3 workload rings without inline DOM styles.',
      emp: byEmpId['EMP-1002'],
      department: 'Design',
      priority: 'High',
      status: 'Todo',
      startDate: shiftDays(today, -1),
      dueDate: shiftDays(today, 4),
    },
    {
      title: 'Finalize mobile iOS bottom tab bar interaction ergonomics',
      description:
        'Audit 44pt tap targets and responsive card transitions below 768px.',
      emp: byEmpId['EMP-1002'],
      department: 'Design',
      priority: 'Medium',
      status: 'Completed',
      startDate: shiftDays(today, -14),
      dueDate: shiftDays(today, -6),
      completedDate: shiftDays(today, -7),
    },
    {
      title: 'Write inclusive leave-window boundary regression suite',
      description:
        'Cover day-before, exact leaveStart, mid-leave, exact leaveEnd, and day-after assignment rules.',
      emp: byEmpId['EMP-1003'],
      department: 'QA',
      priority: 'High',
      status: 'In Progress',
      startDate: shiftDays(today, -4),
      dueDate: shiftDays(today, 2),
    },
    {
      title: 'Verify URL query-string state persistence across browser refresh',
      description:
        'Validate search, department, status, priority, sort, and page parameters restore cleanly.',
      emp: byEmpId['EMP-1003'],
      department: 'QA',
      priority: 'Medium',
      status: 'Todo',
      startDate: shiftDays(today, 1),
      dueDate: shiftDays(today, 8),
    },
    {
      title: 'Legacy Selenium smoke script migration',
      description:
        'Superseded by native Vitest + Supertest integration suite.',
      emp: byEmpId['EMP-1003'],
      department: 'QA',
      priority: 'Low',
      status: 'Cancelled',
      startDate: shiftDays(today, -12),
      dueDate: shiftDays(today, -5),
    },
    {
      title: 'Roll out Q4 annual leave calendar guidelines across departments',
      description:
        'Publish updated leave-notice SLA and cross-team handoff checklist.',
      emp: byEmpId['EMP-1004'],
      department: 'HR',
      priority: 'Medium',
      status: 'In Progress',
      startDate: shiftDays(today, -3),
      dueDate: shiftDays(today, 5),
    },
    {
      title: 'Complete Q3 engineering onboarding handbook refresh',
      description:
        'Updated Day-1 laptop setup and engineering mentorship pairing docs.',
      emp: byEmpId['EMP-1004'],
      department: 'HR',
      priority: 'Low',
      status: 'Completed',
      startDate: shiftDays(today, -20),
      dueDate: shiftDays(today, -10),
      completedDate: shiftDays(today, -11),
    },
    {
      title: 'Prepare Roots Media Q4 enterprise retainer renewal deck',
      description:
        'Compile campaign attribution ROI metrics for top 5 retainer accounts.',
      emp: byEmpId['EMP-1005'],
      department: 'Sales',
      priority: 'Critical',
      status: 'Todo',
      startDate: shiftDays(today, -9),
      dueDate: shiftDays(today, -3), // OVERDUE
    },
    {
      title: 'Optimize $facet dashboard aggregation pipeline indexes',
      description:
        'Ensure sub-15ms p95 aggregation latency across status, priority, and department facets.',
      emp: byEmpId['EMP-1006'],
      department: 'Development',
      priority: 'High',
      status: 'Todo',
      startDate: shiftDays(today, 0),
      dueDate: shiftDays(today, 7),
    },
    {
      title: 'Shortlist MERN developer technical assessment finalists',
      description:
        'Coordinate panel reviews with Engineering and Product Design leads.',
      emp: byEmpId['EMP-1010'],
      department: 'HR',
      priority: 'High',
      status: 'Completed',
      startDate: shiftDays(today, -10),
      dueDate: shiftDays(today, -4),
      completedDate: shiftDays(today, -4),
    },
    {
      title: 'Audit historical task snapshot retention for offboarded staff',
      description:
        'Historical record demonstrating preserved employee details after employee deletion.',
      emp: null,
      formerSnapshot: {
        employeeId: 'EMP-0999',
        fullName: 'Arjun Kapoor',
        email: 'arjun.kapoor@rootsmedia.in',
        department: 'Development',
        role: 'Senior Backend Engineer',
        isDeleted: true,
      },
      department: 'Development',
      priority: 'Medium',
      status: 'Completed',
      startDate: shiftDays(today, -25),
      dueDate: shiftDays(today, -18),
      completedDate: shiftDays(today, -19),
    },
  ];

  const taskDocs = taskSpecs.map((spec, idx) => {
    const seq = idx + 1;
    return {
      taskId: `TSK-${String(seq).padStart(4, '0')}`,
      title: spec.title,
      description: spec.description,
      department: spec.department,
      priority: spec.priority,
      priorityRank: PRIORITY_RANKS[spec.priority],
      status: spec.status,
      startDate: spec.startDate,
      dueDate: spec.dueDate,
      completedDate: spec.completedDate || null,
      assignee: spec.emp ? spec.emp._id : null,
      assigneeSnapshot: spec.emp ? snapOf(spec.emp) : spec.formerSnapshot,
    };
  });

  await Task.insertMany(taskDocs);
  await Counter.create({ _id: 'taskId', seq: taskDocs.length });

  // Reconcile activeTaskCount strictly from inserted Todo / In Progress tasks
  for (const emp of employees) {
    const activeCount = taskDocs.filter(
      (t) =>
        t.assignee &&
        String(t.assignee) === String(emp._id) &&
        (t.status === 'Todo' || t.status === 'In Progress')
    ).length;
    await Employee.updateOne(
      { _id: emp._id },
      { $set: { activeTaskCount: activeCount } }
    );
  }

  console.log(
    `✓ Seeded ${employees.length} employees across 5 departments and ${taskDocs.length} tasks (Counter seq=${taskDocs.length}).`
  );
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
