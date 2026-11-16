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

async function createSampleEmployee(overrides = {}) {
  const uniqueSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const res = await request(app)
    .post('/api/employees')
    .send({
      employeeId: `EMP-${uniqueSuffix}`,
      fullName: 'Sample Employee',
      email: `emp-${uniqueSuffix.toLowerCase()}@roots.com`,
      department: 'Development',
      role: 'Full Stack Developer',
      status: 'Active',
      joiningDate: '2025-06-01',
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Task API & Business Rules Engine (/api/tasks)', () => {
  it('auto-generates sequential TSK-0001 and TSK-0002 IDs with default Todo status and priorityRank (API-02)', async () => {
    const t1 = await request(app).post('/api/tasks').send({
      title: 'First task',
      department: 'Development',
      priority: 'Critical',
      startDate: '2026-06-01',
      dueDate: '2026-06-05',
    });
    const t2 = await request(app).post('/api/tasks').send({
      title: 'Second task',
      department: 'Design',
      priority: 'Low',
      startDate: '2026-06-02',
      dueDate: '2026-06-06',
    });

    expect(t1.status).toBe(201);
    expect(t1.body.data.taskId).toBe('TSK-0001');
    expect(t1.body.data.status).toBe('Todo');
    expect(t1.body.data.completedDate).toBeNull();
    expect(t1.body.data.priorityRank).toBe(4);

    expect(t2.status).toBe(201);
    expect(t2.body.data.taskId).toBe('TSK-0002');
    expect(t2.body.data.status).toBe('Todo');
    expect(t2.body.data.priorityRank).toBe(1);
  });

  it('strictly rejects client-supplied status or completedDate on POST and PUT /api/tasks/:id with 400 (RULE-04, RULE-06)', async () => {
    const createWithStatus = await request(app).post('/api/tasks').send({
      title: 'Tampered status',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-05',
      status: 'Completed',
    });
    expect(createWithStatus.status).toBe(400);
    expect(createWithStatus.body.message).toContain('Task status cannot be set on creation');

    const createWithCompletedDate = await request(app).post('/api/tasks').send({
      title: 'Tampered completedDate',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-05',
      completedDate: '2026-06-03',
    });
    expect(createWithCompletedDate.status).toBe(400);
    expect(createWithCompletedDate.body.message).toContain('completedDate cannot be supplied');

    const validTask = await request(app).post('/api/tasks').send({
      title: 'Clean task',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-05',
    });
    expect(validTask.status).toBe(201);
    const id = validTask.body.data._id;

    const updateWithStatus = await request(app)
      .put(`/api/tasks/${id}`)
      .send({ status: 'In Progress' });
    expect(updateWithStatus.status).toBe(400);
    expect(updateWithStatus.body.message).toContain('PUT /api/tasks/:id/status');

    const updateWithCompletedDate = await request(app)
      .put(`/api/tasks/${id}`)
      .send({ completedDate: '2026-06-04' });
    expect(updateWithCompletedDate.status).toBe(400);
    expect(updateWithCompletedDate.body.message).toContain('completedDate cannot be updated');
  });

  it('rejects dueDate earlier than startDate on both create and partial update with 400 (RULE-03)', async () => {
    const badCreate = await request(app).post('/api/tasks').send({
      title: 'Inverted dates',
      department: 'QA',
      startDate: '2026-06-15',
      dueDate: '2026-06-10',
    });
    expect(badCreate.status).toBe(400);
    expect(badCreate.body.message).toContain('dueDate must be on or after startDate');

    const validCreate = await request(app).post('/api/tasks').send({
      title: 'Valid dates',
      department: 'QA',
      startDate: '2026-06-15',
      dueDate: '2026-06-20',
    });
    expect(validCreate.status).toBe(201);

    // Partial update setting dueDate earlier than persisted startDate (2026-06-15)
    const badPartialUpdate = await request(app)
      .put(`/api/tasks/${validCreate.body.data._id}`)
      .send({ dueDate: '2026-06-12' });
    expect(badPartialUpdate.status).toBe(400);
    expect(badPartialUpdate.body.message).toContain('dueDate must be on or after startDate');
  });

  it('rejects assigning or reassigning tasks to Inactive employees with 400 (RULE-02)', async () => {
    const inactiveEmp = await createSampleEmployee({
      employeeId: 'EMP-INACT',
      email: 'inactive@roots.com',
      status: 'Inactive',
    });

    const createRes = await request(app).post('/api/tasks').send({
      title: 'Assign to inactive',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-10',
      assignee: inactiveEmp._id,
    });
    expect(createRes.status).toBe(400);
    expect(createRes.body.message).toContain('Cannot assign tasks to an Inactive employee');

    const activeEmp = await createSampleEmployee({
      employeeId: 'EMP-ACT',
      email: 'active@roots.com',
      status: 'Active',
    });
    const validTask = await request(app).post('/api/tasks').send({
      title: 'Assigned to active first',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-10',
      assignee: activeEmp._id,
    });
    expect(validTask.status).toBe(201);

    const reassignRes = await request(app)
      .put(`/api/tasks/${validTask.body.data._id}`)
      .send({ assignee: inactiveEmp._id });
    expect(reassignRes.status).toBe(400);
    expect(reassignRes.body.message).toContain('Cannot assign tasks to an Inactive employee');

    // Original active employee still holds 1 active task
    const refreshedActive = await Employee.findById(activeEmp._id);
    expect(refreshedActive.activeTaskCount).toBe(1);
  });

  it('enforces inclusive On Leave window across all 5 boundary dates (2026-06-10 to 2026-06-20) (RULE-02)', async () => {
    const onLeaveEmp = await createSampleEmployee({
      employeeId: 'EMP-LEAVE',
      email: 'onleave@roots.com',
      status: 'On Leave',
      leaveStart: '2026-06-10',
      leaveEnd: '2026-06-20',
    });

    // 1. Day before leaveStart (2026-06-09) -> 201 Allowed
    const beforeRes = await request(app).post('/api/tasks').send({
      title: 'Before leave window',
      department: 'Development',
      startDate: '2026-06-09',
      dueDate: '2026-06-25',
      assignee: onLeaveEmp._id,
    });
    expect(beforeRes.status).toBe(201);

    // 2. Exact leaveStart (2026-06-10) -> 400 Blocked
    const startBoundaryRes = await request(app).post('/api/tasks').send({
      title: 'On leaveStart boundary',
      department: 'Development',
      startDate: '2026-06-10',
      dueDate: '2026-06-25',
      assignee: onLeaveEmp._id,
    });
    expect(startBoundaryRes.status).toBe(400);
    expect(startBoundaryRes.body.message).toContain(
      'Employee is on leave during the task start date (2026-06-10 to 2026-06-20)'
    );

    // 3. Middle of leave (2026-06-15) -> 400 Blocked
    const middleRes = await request(app).post('/api/tasks').send({
      title: 'Middle of leave window',
      department: 'Development',
      startDate: '2026-06-15',
      dueDate: '2026-06-25',
      assignee: onLeaveEmp._id,
    });
    expect(middleRes.status).toBe(400);

    // 4. Exact leaveEnd (2026-06-20) -> 400 Blocked
    const endBoundaryRes = await request(app).post('/api/tasks').send({
      title: 'On leaveEnd boundary',
      department: 'Development',
      startDate: '2026-06-20',
      dueDate: '2026-06-25',
      assignee: onLeaveEmp._id,
    });
    expect(endBoundaryRes.status).toBe(400);

    // 5. Day after leaveEnd (2026-06-21) -> 201 Allowed
    const afterRes = await request(app).post('/api/tasks').send({
      title: 'After leave window',
      department: 'Development',
      startDate: '2026-06-21',
      dueDate: '2026-06-28',
      assignee: onLeaveEmp._id,
    });
    expect(afterRes.status).toBe(201);

    // Editing startDate of an allowed task into the leave window on the same assignee -> 400 Blocked
    const moveIntoLeaveRes = await request(app)
      .put(`/api/tasks/${beforeRes.body.data._id}`)
      .send({ startDate: '2026-06-14' });
    expect(moveIntoLeaveRes.status).toBe(400);

    const refreshed = await Employee.findById(onLeaveEmp._id);
    expect(refreshed.activeTaskCount).toBe(2);
  });

  it('enforces 3-active-task capacity limit sequentially and under concurrent Promise.all bursts (RULE-07)', async () => {
    const emp = await createSampleEmployee({
      employeeId: 'EMP-CAP',
      email: 'capacity@roots.com',
    });

    // Assign 3 active tasks sequentially -> all 3 succeed with 201
    const createdTasks = [];
    for (let i = 1; i <= 3; i += 1) {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: `Active Task ${i}`,
          department: 'Development',
          startDate: '2026-06-01',
          dueDate: '2026-06-15',
          assignee: emp._id,
        });
      expect(res.status).toBe(201);
      createdTasks.push(res.body.data);
    }

    let empDoc = await Employee.findById(emp._id);
    expect(empDoc.activeTaskCount).toBe(3);

    // 4th sequential task -> rejected with 400
    const fourthSeqRes = await request(app).post('/api/tasks').send({
      title: 'Sequential 4th Task',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-15',
      assignee: emp._id,
    });
    expect(fourthSeqRes.status).toBe(400);
    expect(fourthSeqRes.body.message).toContain(
      'Employee already holds the maximum of 3 active tasks'
    );

    // Release 1 slot by deleting the 3rd active task -> employee is now at 2/3 active tasks
    const deleteThirdRes = await request(app).delete(`/api/tasks/${createdTasks[2]._id}`);
    expect(deleteThirdRes.status).toBe(200);

    empDoc = await Employee.findById(emp._id);
    expect(empDoc.activeTaskCount).toBe(2);

    // Fire 2 simultaneous task assignments via Promise.all at 2/3 capacity
    const [raceResA, raceResB] = await Promise.all([
      request(app).post('/api/tasks').send({
        title: 'Concurrent Race Task A',
        department: 'Development',
        startDate: '2026-06-01',
        dueDate: '2026-06-15',
        assignee: emp._id,
      }),
      request(app).post('/api/tasks').send({
        title: 'Concurrent Race Task B',
        department: 'Development',
        startDate: '2026-06-01',
        dueDate: '2026-06-15',
        assignee: emp._id,
      }),
    ]);

    const statuses = [raceResA.status, raceResB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 400]);

    const finalEmpDoc = await Employee.findById(emp._id);
    expect(finalEmpDoc.activeTaskCount).toBe(3);

    const activeTasksInDb = await Task.countDocuments({
      assignee: emp._id,
      status: { $in: ['Todo', 'In Progress'] },
    });
    expect(activeTasksInDb).toBe(3);
  });

  it('transfers capacity cleanly on reassignment (A -> B -> null) and releases slot upon completion (RULE-07)', async () => {
    const empA = await createSampleEmployee({ employeeId: 'EMP-A', email: 'a@roots.com' });
    const empB = await createSampleEmployee({ employeeId: 'EMP-B', email: 'b@roots.com' });

    // Fill empA to 3/3 active tasks
    const tasksA = [];
    for (let i = 1; i <= 3; i += 1) {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: `Task A-${i}`,
          department: 'Development',
          startDate: '2026-06-01',
          dueDate: '2026-06-10',
          assignee: empA._id,
        });
      expect(res.status).toBe(201);
      tasksA.push(res.body.data);
    }

    // Reassign Task A-1 from empA -> empB
    const reassignRes = await request(app)
      .put(`/api/tasks/${tasksA[0]._id}`)
      .send({ assignee: empB._id });
    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.data.assigneeSnapshot.employeeId).toBe('EMP-B');

    expect((await Employee.findById(empA._id)).activeTaskCount).toBe(2);
    expect((await Employee.findById(empB._id)).activeTaskCount).toBe(1);

    // Complete Task A-2 on empA (Todo -> In Progress -> Completed): releases another slot on empA (2 -> 1)
    await request(app)
      .put(`/api/tasks/${tasksA[1]._id}/status`)
      .send({ status: 'In Progress' })
      .expect(200);
    await request(app)
      .put(`/api/tasks/${tasksA[1]._id}/status`)
      .send({ status: 'Completed' })
      .expect(200);

    expect((await Employee.findById(empA._id)).activeTaskCount).toBe(1);

    // Subsequent new task assignment to empA succeeds cleanly
    const newTaskForA = await request(app).post('/api/tasks').send({
      title: 'Fresh task after slot release',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-10',
      assignee: empA._id,
    });
    expect(newTaskForA.status).toBe(201);
    expect((await Employee.findById(empA._id)).activeTaskCount).toBe(2);

    // Unassign task from empB -> null: releases empB's slot (1 -> 0)
    const unassignRes = await request(app)
      .put(`/api/tasks/${tasksA[0]._id}`)
      .send({ assignee: null });
    expect(unassignRes.status).toBe(200);
    expect(unassignRes.body.data.assignee).toBeNull();
    expect((await Employee.findById(empB._id)).activeTaskCount).toBe(0);
  });

  it('enforces the status transition state machine, stamps server completedDate, and locks terminal tasks from edits (RULE-04, RULE-05, RULE-06)', async () => {
    const emp = await createSampleEmployee({
      employeeId: 'EMP-SM',
      email: 'statemachine@roots.com',
    });

    // Flow 1: Todo -> Completed directly is illegal (400); Todo -> In Progress -> Completed succeeds
    const task1Res = await request(app).post('/api/tasks').send({
      title: 'State machine task 1',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-10',
      assignee: emp._id,
    });
    const task1Id = task1Res.body.data._id;

    const skipRes = await request(app)
      .put(`/api/tasks/${task1Id}/status`)
      .send({ status: 'Completed' });
    expect(skipRes.status).toBe(400);
    expect(skipRes.body.message).toContain('Invalid status transition from Todo to Completed');

    const toInProgressRes = await request(app)
      .put(`/api/tasks/${task1Id}/status`)
      .send({ status: 'In Progress' });
    expect(toInProgressRes.status).toBe(200);
    expect(toInProgressRes.body.data.status).toBe('In Progress');
    expect(toInProgressRes.body.data.completedDate).toBeNull();

    // Backward transition In Progress -> Todo is illegal (400)
    const backwardRes = await request(app)
      .put(`/api/tasks/${task1Id}/status`)
      .send({ status: 'Todo' });
    expect(backwardRes.status).toBe(400);

    const beforeCompleteMs = Date.now();
    const toCompletedRes = await request(app)
      .put(`/api/tasks/${task1Id}/status`)
      .send({ status: 'Completed' });
    const afterCompleteMs = Date.now();

    expect(toCompletedRes.status).toBe(200);
    expect(toCompletedRes.body.data.status).toBe('Completed');
    expect(toCompletedRes.body.data.completedDate).toBeTruthy();

    const stampedMs = new Date(toCompletedRes.body.data.completedDate).getTime();
    expect(stampedMs).toBeGreaterThanOrEqual(beforeCompleteMs - 1000);
    expect(stampedMs).toBeLessThanOrEqual(afterCompleteMs + 5000);

    // Terminal transitions from Completed are blocked (400)
    for (const nextStatus of ['Todo', 'In Progress', 'Cancelled', 'Completed']) {
      const fromCompleted = await request(app)
        .put(`/api/tasks/${task1Id}/status`)
        .send({ status: nextStatus });
      expect(fromCompleted.status).toBe(400);
    }

    // Editing a Completed task via PUT /api/tasks/:id is permanently locked (400)
    const editCompletedRes = await request(app)
      .put(`/api/tasks/${task1Id}`)
      .send({ title: 'Attempt to edit completed task' });
    expect(editCompletedRes.status).toBe(400);
    expect(editCompletedRes.body.message).toContain(
      'Completed or Cancelled tasks cannot be edited'
    );

    // Flow 2: Todo -> Cancelled succeeds, releases slot, and locks edits & transitions
    const task2Res = await request(app).post('/api/tasks').send({
      title: 'State machine task 2 (Todo -> Cancelled)',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-10',
      assignee: emp._id,
    });
    const task2Id = task2Res.body.data._id;

    const cancelFromTodo = await request(app)
      .put(`/api/tasks/${task2Id}/status`)
      .send({ status: 'Cancelled' });
    expect(cancelFromTodo.status).toBe(200);
    expect(cancelFromTodo.body.data.status).toBe('Cancelled');
    expect((await Employee.findById(emp._id)).activeTaskCount).toBe(0);

    const reopenCancelled = await request(app)
      .put(`/api/tasks/${task2Id}/status`)
      .send({ status: 'In Progress' });
    expect(reopenCancelled.status).toBe(400);

    const editCancelled = await request(app)
      .put(`/api/tasks/${task2Id}`)
      .send({ priority: 'Low' });
    expect(editCancelled.status).toBe(400);
    expect(editCancelled.body.message).toContain(
      'Completed or Cancelled tasks cannot be edited'
    );

    // Flow 3: In Progress -> Cancelled succeeds and releases slot
    const task3Res = await request(app).post('/api/tasks').send({
      title: 'State machine task 3 (In Progress -> Cancelled)',
      department: 'Development',
      startDate: '2026-06-01',
      dueDate: '2026-06-10',
      assignee: emp._id,
    });
    const task3Id = task3Res.body.data._id;

    await request(app)
      .put(`/api/tasks/${task3Id}/status`)
      .send({ status: 'In Progress' })
      .expect(200);

    const cancelFromInProgress = await request(app)
      .put(`/api/tasks/${task3Id}/status`)
      .send({ status: 'Cancelled' });
    expect(cancelFromInProgress.status).toBe(200);
    expect(cancelFromInProgress.body.data.status).toBe('Cancelled');
    expect((await Employee.findById(emp._id)).activeTaskCount).toBe(0);
  });
});
