import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import Employee from '../src/models/Employee.js';
import Task from '../src/models/Task.js';
import Counter from '../src/models/Counter.js';
import { formatUtcDate, getTodayUtcCalendarDate } from '../src/utils/dates.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function ymdOffset(days) {
  const base = getTodayUtcCalendarDate();
  return formatUtcDate(new Date(base.getTime() + days * MS_PER_DAY));
}

describe('Phase 2: Server Query Engine, Overdue Consistency, Dashboard & CSV Export', () => {
  let mongoServer;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      Employee.deleteMany({}),
      Task.deleteMany({}),
      Counter.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  async function seedScenario() {
    const devEmpRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-201',
      fullName: 'Zoya Khan',
      email: 'zoya@roots.io',
      phone: '+91 98200 11111',
      department: 'Development',
      role: 'Lead Engineer',
      joiningDate: '2024-03-01',
      status: 'Active',
      skills: ['Node.js', 'React'],
    });
    const designEmpRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-202',
      fullName: 'Karan Gill',
      email: 'karan@roots.io',
      phone: '+91 98200 22222',
      department: 'Design',
      role: 'UI Designer',
      joiningDate: '2024-06-01',
      status: 'Active',
      skills: ['Figma'],
    });

    const zoya = devEmpRes.body.data;
    const karan = designEmpRes.body.data;

    // Task 1: Overdue Critical Development task assigned to Zoya
    const t1 = await request(app).post('/api/tasks').send({
      title: 'Fix C++ native addon memory leak',
      description: '=SUM(1,2) formula test, with "quotes" and commas',
      department: 'Development',
      priority: 'Critical',
      startDate: ymdOffset(-10),
      dueDate: ymdOffset(-3),
      assignee: zoya._id,
    });

    // Task 2: Future Low Development task assigned to Zoya
    const t2 = await request(app).post('/api/tasks').send({
      title: 'Alpha docs polish',
      description: 'Update onboarding notes',
      department: 'Development',
      priority: 'Low',
      startDate: ymdOffset(-1),
      dueDate: ymdOffset(5),
      assignee: zoya._id,
    });

    // Task 3: Due TODAY High Design task assigned to Karan (NOT overdue!)
    const t3 = await request(app).post('/api/tasks').send({
      title: 'Beta hero illustration',
      description: 'Due today boundary check',
      department: 'Design',
      priority: 'High',
      startDate: ymdOffset(-2),
      dueDate: ymdOffset(0),
      assignee: karan._id,
    });

    // Task 4: Past due Completed task on Karan -> transition Todo -> In Progress -> Completed (NOT overdue!)
    const t4Create = await request(app).post('/api/tasks').send({
      title: 'Completed past-due banner',
      description: 'Should not be marked overdue once Completed',
      department: 'Design',
      priority: 'Medium',
      startDate: ymdOffset(-12),
      dueDate: ymdOffset(-4),
      assignee: karan._id,
    });
    await request(app)
      .put(`/api/tasks/${t4Create.body.data._id}/status`)
      .send({ status: 'In Progress' });
    const t4 = await request(app)
      .put(`/api/tasks/${t4Create.body.data._id}/status`)
      .send({ status: 'Completed' });

    return {
      zoya,
      karan,
      t1: t1.body.data,
      t2: t2.body.data,
      t3: t3.body.data,
      t4: t4.body.data,
    };
  }

  it('supports combined search (title + regex characters + employee name), filters, importance priority sort, and pagination', async () => {
    await seedScenario();

    // Regex-safe search for "C++"
    const searchTitleRes = await request(app).get('/api/tasks?search=C%2B%2B');
    expect(searchTitleRes.status).toBe(200);
    expect(searchTitleRes.body.data).toHaveLength(1);
    expect(searchTitleRes.body.data[0].title).toContain('C++');

    // Search by assigned employee name ("Zoya")
    const searchEmpRes = await request(app).get('/api/tasks?search=Zoya');
    expect(searchEmpRes.status).toBe(200);
    expect(searchEmpRes.body.data).toHaveLength(2);

    // Sort by priority importance desc: Critical -> High -> Medium -> Low
    const sortedRes = await request(app).get('/api/tasks?sortBy=priority&sortOrder=desc');
    expect(sortedRes.status).toBe(200);
    expect(sortedRes.body.data.map((t) => t.priority)).toEqual([
      'Critical',
      'High',
      'Medium',
      'Low',
    ]);

    // Pagination metadata check (limit=2, page=2)
    const pagedRes = await request(app).get(
      '/api/tasks?sortBy=priority&sortOrder=desc&limit=2&page=2'
    );
    expect(pagedRes.status).toBe(200);
    expect(pagedRes.body.data).toHaveLength(2);
    expect(pagedRes.body.pagination).toMatchObject({
      page: 2,
      limit: 2,
      total: 4,
      totalPages: 2,
      hasPrevPage: true,
      hasNextPage: false,
    });
  });

  it('computes overdue consistently across Task List, Task Detail, Dashboard, and CSV Export', async () => {
    const { t1, t3, t4 } = await seedScenario();

    // 1. List overdue=true -> only t1 (t3 is due today, t4 is Completed)
    const listOverdue = await request(app).get('/api/tasks?overdue=true');
    expect(listOverdue.status).toBe(200);
    expect(listOverdue.body.data).toHaveLength(1);
    expect(listOverdue.body.data[0]._id).toBe(t1._id);
    expect(listOverdue.body.data[0].isOverdue).toBe(true);
    expect(listOverdue.body.data[0].daysOverdue).toBe(3);

    // 2. Detail view checks
    const detailT3 = await request(app).get(`/api/tasks/${t3._id}`);
    expect(detailT3.body.data.isOverdue).toBe(false);

    const detailT4 = await request(app).get(`/api/tasks/${t4._id}`);
    expect(detailT4.body.data.isOverdue).toBe(false);

    // 3. Dashboard summary counts & workload
    const dashRes = await request(app).get('/api/dashboard');
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.employees).toMatchObject({
      total: 2,
      active: 2,
      onLeave: 0,
      inactive: 0,
    });
    expect(dashRes.body.data.tasks).toMatchObject({
      total: 4,
      todo: 3,
      inProgress: 0,
      completed: 1,
      cancelled: 0,
      overdue: 1,
    });
    expect(dashRes.body.data.overdueTasks).toHaveLength(1);
    expect(dashRes.body.data.overdueTasks[0]._id).toBe(t1._id);
    expect(dashRes.body.data.workload[0].activeTaskCount).toBe(2);

    // 4. CSV Export streams all matching filtered tasks (ignoring page=1&limit=1) + neutralizes formula + preserves former employee
    const csvAllDev = await request(app).get(
      '/api/tasks/export.csv?department=Development&page=1&limit=1'
    );
    expect(csvAllDev.status).toBe(200);
    expect(csvAllDev.headers['content-type']).toContain('text/csv');
    expect(csvAllDev.headers['content-disposition']).toContain('attachment; filename="roots-tasks-');
    expect(csvAllDev.text.startsWith('\uFEFF')).toBe(true);
    expect(csvAllDev.text).toContain('Fix C++ native addon memory leak');
    expect(csvAllDev.text).toContain('Alpha docs polish'); // proves pagination ignored on export!
    expect(csvAllDev.text).toContain("'=SUM(1,2)"); // formula neutralized!
  });

  it('preserves deleted employee details in CSV export and exposes /api/meta and /api/employees/options', async () => {
    const { karan, t3 } = await seedScenario();

    // Cancel Karan's only active task t3 so Karan can be deleted while keeping Completed t4
    await request(app).put(`/api/tasks/${t3._id}/status`).send({ status: 'Cancelled' });
    const delRes = await request(app).delete(`/api/employees/${karan._id}`);
    expect(delRes.status).toBe(200);

    const csvDesign = await request(app).get('/api/tasks/export.csv?department=Design');
    expect(csvDesign.status).toBe(200);
    expect(csvDesign.text).toContain('Karan Gill (Former Employee)');
    expect(csvDesign.text).toContain('EMP-202');

    const optionsRes = await request(app).get('/api/employees/options');
    expect(optionsRes.status).toBe(200);
    expect(optionsRes.body.data).toHaveLength(1);

    const metaRes = await request(app).get('/api/meta');
    expect(metaRes.status).toBe(200);
    expect(metaRes.body.data.departments).toHaveLength(5);
    expect(metaRes.body.data.maxActiveTasks).toBe(3);
  });
});
