import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import Employee from '../src/models/Employee.js';
import Task from '../src/models/Task.js';
import Counter from '../src/models/Counter.js';

process.env.NODE_ENV = 'test';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { bufferCommands: false });
  await Promise.all([Employee.createIndexes(), Task.createIndexes()]);
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

describe('Employee API & Domain Rules (/api/employees)', () => {
  it('returns 200 on /api/health and structured 404s for unknown routes and malformed ObjectIds', async () => {
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.success).toBe(true);
    expect(healthRes.body.status).toBe('ok');

    const unknownRes = await request(app).get('/api/unknown-endpoint');
    expect(unknownRes.status).toBe(404);
    expect(unknownRes.body.success).toBe(false);

    const invalidIdRes = await request(app).get('/api/employees/not-a-valid-id');
    expect(invalidIdRes.status).toBe(404);
    expect(invalidIdRes.body.success).toBe(false);

    const missingIdRes = await request(app).get('/api/employees/507f1f77bcf86cd799439011');
    expect(missingIdRes.status).toBe(404);
    expect(missingIdRes.body.message).toContain('Employee not found');
  });

  it('accepts all 5 allowed departments and rejects unauthorized departments with 400 (RULE-01)', async () => {
    const allowedDepartments = ['Development', 'Design', 'QA', 'HR', 'Sales'];

    for (let i = 0; i < allowedDepartments.length; i += 1) {
      const dept = allowedDepartments[i];
      const res = await request(app)
        .post('/api/employees')
        .send({
          employeeId: `emp-00${i + 1}`,
          fullName: `Employee ${dept}`,
          email: `emp${i + 1}@roots.com`,
          department: dept,
          role: `${dept} Specialist`,
          joiningDate: '2026-01-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.department).toBe(dept);
      expect(res.body.data.employeeId).toBe(`EMP-00${i + 1}`);
    }

    for (const invalidDept of ['Finance', 'Engineering', 'Marketing']) {
      const badRes = await request(app)
        .post('/api/employees')
        .send({
          employeeId: `EMP-BAD-${invalidDept}`,
          fullName: 'Invalid Dept User',
          email: `bad-${invalidDept.toLowerCase()}@roots.com`,
          department: invalidDept,
          role: 'Analyst',
          joiningDate: '2026-01-15',
        });

      expect(badRes.status).toBe(400);
      expect(badRes.body.success).toBe(false);
    }
  });

  it('enforces unique employeeId and case-insensitive unique email with 409 Conflict (API-01)', async () => {
    const first = await request(app).post('/api/employees').send({
      employeeId: 'emp-100',
      fullName: 'Alice Sharma',
      email: 'Alice@Roots.com',
      department: 'Development',
      role: 'Senior Backend Engineer',
      joiningDate: '2025-11-01',
    });

    expect(first.status).toBe(201);
    expect(first.body.data.employeeId).toBe('EMP-100');
    expect(first.body.data.email).toBe('alice@roots.com');

    const dupIdRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-100',
      fullName: 'Another Person',
      email: 'another@roots.com',
      department: 'QA',
      role: 'QA Engineer',
      joiningDate: '2025-12-01',
    });
    expect(dupIdRes.status).toBe(409);

    const dupEmailRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-101',
      fullName: 'Alice Clone',
      email: 'alice@roots.com',
      department: 'Design',
      role: 'Product Designer',
      joiningDate: '2025-12-01',
    });
    expect(dupEmailRes.status).toBe(409);
  });

  it('validates On Leave date ordering and clears leave dates when returning to Active (RULE-03)', async () => {
    const missingDatesRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-201',
      fullName: 'Leave Missing Dates',
      email: 'leave1@roots.com',
      department: 'HR',
      role: 'HR Coordinator',
      status: 'On Leave',
      joiningDate: '2025-05-10',
    });
    expect(missingDatesRes.status).toBe(400);

    const invertedDatesRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-202',
      fullName: 'Leave Inverted Dates',
      email: 'leave2@roots.com',
      department: 'HR',
      role: 'HR Coordinator',
      status: 'On Leave',
      joiningDate: '2025-05-10',
      leaveStart: '2026-06-20',
      leaveEnd: '2026-06-10',
    });
    expect(invertedDatesRes.status).toBe(400);

    const validLeaveRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-203',
      fullName: 'Rohan Verma',
      email: 'rohan@roots.com',
      department: 'Sales',
      role: 'Account Executive',
      status: 'On Leave',
      joiningDate: '2025-05-10',
      leaveStart: '2026-06-10',
      leaveEnd: '2026-06-20',
    });
    expect(validLeaveRes.status).toBe(201);
    expect(validLeaveRes.body.data.leaveStart).toBe('2026-06-10T00:00:00.000Z');
    expect(validLeaveRes.body.data.leaveEnd).toBe('2026-06-20T00:00:00.000Z');

    const backToActiveRes = await request(app)
      .put(`/api/employees/${validLeaveRes.body.data._id}`)
      .send({ status: 'Active' });

    expect(backToActiveRes.status).toBe(200);
    expect(backToActiveRes.body.data.status).toBe('Active');
    expect(backToActiveRes.body.data.leaveStart).toBeNull();
    expect(backToActiveRes.body.data.leaveEnd).toBeNull();
  });

  it('synchronizes assigneeSnapshot onto assigned tasks when employee profile fields are edited (API-01)', async () => {
    const empRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-301',
      fullName: 'Priya Nair',
      email: 'priya@roots.com',
      department: 'Design',
      role: 'UI Designer',
      joiningDate: '2025-08-01',
    });
    const empId = empRes.body.data._id;

    const taskRes = await request(app).post('/api/tasks').send({
      title: 'Design system token audit',
      department: 'Design',
      priority: 'High',
      startDate: '2026-06-01',
      dueDate: '2026-06-10',
      assignee: empId,
    });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.data._id;

    // Partial update: change fullName and role without resending email or department
    const updateEmpRes = await request(app)
      .put(`/api/employees/${empId}`)
      .send({
        fullName: 'Priya Nair-Menon',
        role: 'Lead Product Designer',
      });
    expect(updateEmpRes.status).toBe(200);

    const fetchedTaskRes = await request(app).get(`/api/tasks/${taskId}`);
    expect(fetchedTaskRes.status).toBe(200);
    expect(fetchedTaskRes.body.data.assigneeSnapshot).toEqual({
      employeeId: 'EMP-301',
      fullName: 'Priya Nair-Menon',
      email: 'priya@roots.com',
      department: 'Design',
      role: 'Lead Product Designer',
      isDeleted: false,
    });
  });

  it('blocks deleting an employee holding active tasks with 400 and preserves assigneeSnapshot after completion & deletion (RULE-09)', async () => {
    const empRes = await request(app).post('/api/employees').send({
      employeeId: 'EMP-401',
      fullName: 'Kabir Mehta',
      email: 'kabir@roots.com',
      department: 'QA',
      role: 'Automation Lead',
      joiningDate: '2025-03-12',
    });
    const empId = empRes.body.data._id;

    const taskRes = await request(app).post('/api/tasks').send({
      title: 'Build regression suite',
      department: 'QA',
      priority: 'Critical',
      startDate: '2026-06-01',
      dueDate: '2026-06-07',
      assignee: empId,
    });
    expect(taskRes.status).toBe(201);
    const taskMongoId = taskRes.body.data._id;

    // Blocked while task is Todo
    const blockedTodoDelete = await request(app).delete(`/api/employees/${empId}`);
    expect(blockedTodoDelete.status).toBe(400);
    expect(blockedTodoDelete.body.message).toContain('Cannot delete employee with active tasks');

    // Transition Todo -> In Progress: still blocked
    const inProgressRes = await request(app)
      .put(`/api/tasks/${taskMongoId}/status`)
      .send({ status: 'In Progress' });
    expect(inProgressRes.status).toBe(200);

    const blockedInProgressDelete = await request(app).delete(`/api/employees/${empId}`);
    expect(blockedInProgressDelete.status).toBe(400);

    // Transition In Progress -> Completed: slot released, deletion now allowed
    const completedRes = await request(app)
      .put(`/api/tasks/${taskMongoId}/status`)
      .send({ status: 'Completed' });
    expect(completedRes.status).toBe(200);

    const deleteRes = await request(app).delete(`/api/employees/${empId}`);
    expect(deleteRes.status).toBe(200);

    // Historical task retains full assigneeSnapshot with isDeleted: true and assignee: null
    const historicalTaskRes = await request(app).get(`/api/tasks/${taskMongoId}`);
    expect(historicalTaskRes.status).toBe(200);
    expect(historicalTaskRes.body.data.assignee).toBeNull();
    expect(historicalTaskRes.body.data.assigneeSnapshot).toEqual({
      employeeId: 'EMP-401',
      fullName: 'Kabir Mehta',
      email: 'kabir@roots.com',
      department: 'QA',
      role: 'Automation Lead',
      isDeleted: true,
    });
  });
});
