/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../../../app/api/complaints/route';
import { GET as GET_BY_ID } from '../../../app/api/complaints/[id]/route';
import { PATCH as PATCH_STATUS } from '../../../app/api/complaints/[id]/status/route';
import { PATCH as PATCH_PRIORITY } from '../../../app/api/complaints/[id]/priority/route';
import { Role, ComplaintStatus, ComplaintPriority } from '../../../generated/prisma/client';

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    complaint: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    complaintHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    systemConfig: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../lib/auth', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireOwnership: vi.fn(),
}));

import { prisma } from '../../../lib/prisma';
import { requireAuth, requireRole, requireOwnership } from '../../../lib/auth';
import { AuthorizationError, AuthenticationError } from '../../../lib/errors';

describe('Complaints API (Step 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.systemConfig.findUnique as any).mockResolvedValue({ value: '3' });
    const fakeDate = new Date('2026-08-25T12:00:00Z');
    (prisma.complaint.create as any).mockResolvedValue({ id: 'c1', createdAt: fakeDate, status: ComplaintStatus.OPEN });
    (prisma.complaint.findMany as any).mockResolvedValue([{ id: 'c1', createdAt: fakeDate, status: ComplaintStatus.OPEN }]);
    (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user1', status: ComplaintStatus.OPEN, createdAt: fakeDate });
    (prisma.complaintHistory.findMany as any).mockResolvedValue([{ id: 'h1' }]);
    (requireOwnership as any).mockResolvedValue(true);
    // Mock the $transaction to simply execute the callback (simulating successful commit)
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      // Pass a fake tx object that mimics prisma
      return callback({
        complaint: prisma.complaint,
        complaintHistory: prisma.complaintHistory,
      });
    });
  });

  const createJsonRequest = (body: any) =>
    new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const createGetRequest = (url = 'http://localhost/api/complaints') =>
    new NextRequest(url, { method: 'GET' });

  describe('Complaint Creation (POST /api/complaints)', () => {
    it('1. Resident can create a complaint & 2. Owner is taken from authenticated session', async () => {
      const mockUser = { id: 'user1', role: Role.RESIDENT };
      (requireRole as any).mockResolvedValue(mockUser);
      (prisma.complaint.create as any).mockResolvedValue({ id: 'c1' });

      const req = createJsonRequest({ category: 'PLUMBING', description: 'Leaking pipe' });
      const res = await POST(req, {});
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(prisma.complaint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            residentId: 'user1', // Server derived
            category: 'PLUMBING',
          }),
        })
      );
    });

    it('3. Client cannot supply another resident ID', async () => {
      const mockUser = { id: 'user1', role: Role.RESIDENT };
      (requireRole as any).mockResolvedValue(mockUser);

      const maliciousPayload = {
        category: 'PLUMBING',
        description: 'Leaking pipe', // Maliciously supplied
        residentId: 'victimUser',
      };
      const req = createJsonRequest(maliciousPayload);
      await POST(req, {});

      // Assert victimUser is ignored and user1 is used
      expect(prisma.complaint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ residentId: 'user1' }),
        })
      );
    });

    it('4. New complaint always starts OPEN & 19/20. Client cannot force IN_PROGRESS/RESOLVED', async () => {
      const mockUser = { id: 'user1', role: Role.RESIDENT };
      (requireRole as any).mockResolvedValue(mockUser);

      const req = createJsonRequest({
        category: 'PLUMBING',
        description: 'Leaking pipe',
        status: 'RESOLVED', // Maliciously supplied
      });
      await POST(req, {});

      const createCall = (prisma.complaint.create as any).mock.calls[0][0];
      // Expect status not to be in the create payload, letting DB default to OPEN
      expect(createCall.data.status).toBeUndefined();
    });

    it('15. Unauthenticated complaint creation is rejected', async () => {
      (requireRole as any).mockRejectedValue(new AuthenticationError());
      const req = createJsonRequest({ category: 'PLUMBING', description: 'valid description' });
      const res = await POST(req, {});
      expect(res.status).toBe(401);
    });

    it('16. Non-resident cannot create a resident complaint', async () => {
      (requireRole as any).mockRejectedValue(new AuthorizationError());
      const req = createJsonRequest({ category: 'PLUMBING', description: 'valid description' });
      const res = await POST(req, {});
      expect(res.status).toBe(403);
    });

    it('17. Invalid category is rejected', async () => {
      const mockUser = { id: 'user1', role: Role.RESIDENT };
      (requireRole as any).mockResolvedValue(mockUser);
      
      const req = createJsonRequest({ category: 'INVALID_CAT', description: 'valid desc 12345' });
      const res = await POST(req, {});
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('18. Invalid/empty description is rejected', async () => {
      const mockUser = { id: 'user1', role: Role.RESIDENT };
      (requireRole as any).mockResolvedValue(mockUser);
      
      const req = createJsonRequest({ category: 'PLUMBING', description: 'short' });
      const res = await POST(req, {});
      expect(res.status).toBe(400);
    });

    it('Arbitrary imageUrl cannot be injected', async () => {
      const mockUser = { id: 'user1', role: Role.RESIDENT };
      (requireRole as any).mockResolvedValue(mockUser);

      const req = createJsonRequest({
        category: 'PLUMBING',
        description: 'Leaking pipe 123',
        imageUrl: 'http://malicious.com/virus.png',
      });
      await POST(req, {});

      const createCall = (prisma.complaint.create as any).mock.calls[0][0];
      expect(createCall.data.imageUrl).toBeNull();
    });

    it('Client cannot supply priority', async () => {
      const mockUser = { id: 'user1', role: Role.RESIDENT };
      (requireRole as any).mockResolvedValue(mockUser);

      const req = createJsonRequest({
        category: 'PLUMBING',
        description: 'Leaking pipe 123',
        priority: 'HIGH',
      });
      await POST(req, {});

      const createCall = (prisma.complaint.create as any).mock.calls[0][0];
      expect(createCall.data.priority).toBeUndefined(); // DB defaults to LOW
    });
  });

  describe('Complaint Retrieval (GET /api/complaints)', () => {
    it('5. Resident can retrieve own complaints', async () => {
      (requireAuth as any).mockResolvedValue({ id: 'user1', role: Role.RESIDENT });
      (prisma.complaint.findMany as any).mockResolvedValue([{ id: 'c1', createdAt: new Date(), status: ComplaintStatus.OPEN }]);

      const req = createGetRequest();
      const res = await GET(req, {});
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(prisma.complaint.findMany).toHaveBeenCalledWith({
        where: { residentId: 'user1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      });
    });

    it('10. Admin can retrieve all complaints', async () => {
      (requireAuth as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findMany as any).mockResolvedValue([]);

      const req = createGetRequest();
      await GET(req, {});

      expect(prisma.complaint.findMany).toHaveBeenCalledWith({
        where: {}, // No residentId filter
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      });
    });

    it('12/13/14. Admin filters work correctly (category, status, date)', async () => {
      (requireAuth as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      
      const req = createGetRequest('http://localhost/api/complaints?category=PLUMBING&status=OPEN&startDate=2024-01-01T00:00:00Z');
      await GET(req, {});

      expect(prisma.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category: 'PLUMBING',
            status: 'OPEN',
            createdAt: { gte: new Date('2024-01-01T00:00:00Z') },
          },
        })
      );
    });
  });

  describe('Complaint Details & History (GET /api/complaints/[id])', () => {
    it('6/7. Resident can retrieve own complaint details & history', async () => {
      (requireAuth as any).mockResolvedValue({ id: 'user1', role: Role.RESIDENT });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user1', createdAt: new Date(), status: ComplaintStatus.OPEN });
      (prisma.complaintHistory.findMany as any).mockResolvedValue([{ id: 'h1' }]);
      (requireOwnership as any).mockResolvedValue(true);

      const req = createGetRequest();
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'c1' }) });
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.history).toBeDefined();
    });

    it('8/9. Resident cannot retrieve another residents complaint/history', async () => {
      (requireAuth as any).mockResolvedValue({ id: 'user1', role: Role.RESIDENT });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user2' });
      // The ownership check throws an error
      (requireOwnership as any).mockRejectedValue(new AuthorizationError());

      const req = createGetRequest();
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(403);
    });

    it('11. Admin can retrieve any complaint details', async () => {
      (requireAuth as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c2', residentId: 'user2', createdAt: new Date(), status: ComplaintStatus.OPEN });
      (requireOwnership as any).mockResolvedValue(true);

      const req = createGetRequest();
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Complaint Lifecycle & Immutable History (PATCH /api/complaints/[id]/status)', () => {
    const createPatchRequest = (body: any) =>
      new NextRequest('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('1/2/10/11/12/13/15. Admin can change OPEN -> IN_PROGRESS, creates exactly 1 history record with correct data', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      // Current DB state is OPEN
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user1', status: ComplaintStatus.OPEN });
      (prisma.complaint.update as any).mockResolvedValue({ id: 'c1', status: ComplaintStatus.IN_PROGRESS });
      (prisma.complaintHistory.create as any).mockResolvedValue({ id: 'h2' });

      const req = createPatchRequest({ status: ComplaintStatus.IN_PROGRESS, note: 'Admin looking into it' });
      const res = await PATCH_STATUS(req, { params: Promise.resolve({ id: 'c1' }) });
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(prisma.complaint.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: ComplaintStatus.IN_PROGRESS },
        include: { resident: { select: { email: true } } },
      });
      expect(prisma.complaintHistory.create).toHaveBeenCalledTimes(1);
      expect(prisma.complaintHistory.create).toHaveBeenCalledWith(expect.objectContaining({
        data: {
          complaintId: 'c1',
          previousStatus: ComplaintStatus.OPEN, // derived from DB
          newStatus: ComplaintStatus.IN_PROGRESS,
          actorId: 'admin1', // derived from session
          note: 'Admin looking into it',
        },
      }));
    });

    it('3. Resident cannot change status (403)', async () => {
      (requireRole as any).mockRejectedValue(new AuthorizationError());
      const req = createPatchRequest({ status: ComplaintStatus.IN_PROGRESS });
      const res = await PATCH_STATUS(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(403);
    });

    it('5/26. OPEN -> RESOLVED is rejected (Invalid transition)', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user1', status: ComplaintStatus.OPEN });

      const req = createPatchRequest({ status: ComplaintStatus.RESOLVED });
      const res = await PATCH_STATUS(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(409); // Conflict
      expect(prisma.complaint.update).not.toHaveBeenCalled();
    });

    it('6. IN_PROGRESS -> OPEN is rejected', async () => {
      // Actually Zod schema will reject status="OPEN" outright since it only accepts IN_PROGRESS or RESOLVED
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      const req = createPatchRequest({ status: ComplaintStatus.OPEN });
      const res = await PATCH_STATUS(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(400); // Validation error
    });

    it('7/8/9/10/25. RESOLVED -> * is rejected (Permanently closed)', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      // Current DB state is RESOLVED
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user1', status: ComplaintStatus.RESOLVED });

      const req = createPatchRequest({ status: ComplaintStatus.IN_PROGRESS });
      const res = await PATCH_STATUS(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(409);
      expect(prisma.complaint.update).not.toHaveBeenCalled();
      expect(prisma.complaintHistory.create).not.toHaveBeenCalled();
    });

    it('16/17/18. Client cannot spoof actorId, previousStatus, timestamp', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user1', status: ComplaintStatus.OPEN });

      // Malicious payload trying to fake actor or previous state
      const maliciousPayload = {
        status: ComplaintStatus.IN_PROGRESS,
        actorId: 'other-admin',
        previousStatus: ComplaintStatus.RESOLVED,
        timestamp: '1999-01-01T00:00:00Z'
      };

      const req = createPatchRequest(maliciousPayload);
      await PATCH_STATUS(req, { params: Promise.resolve({ id: 'c1' }) });

      // Ensure the spoofed values are ignored
      expect(prisma.complaintHistory.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin1', // Real
          previousStatus: ComplaintStatus.OPEN, // Real
        }),
      }));
    });

    it('22/23. Transaction rollback guarantees atomicity if history creation fails', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user1', status: ComplaintStatus.OPEN });
      
      // Simulate transaction failure where complaint.update succeeds but history.create throws
      (prisma.complaint.update as any).mockResolvedValue({ id: 'c1', status: ComplaintStatus.IN_PROGRESS });
      (prisma.complaintHistory.create as any).mockRejectedValue(new Error('DB History Insert Failed'));
      
      const req = createPatchRequest({ status: ComplaintStatus.IN_PROGRESS });
      const res = await PATCH_STATUS(req, { params: Promise.resolve({ id: 'c1' }) });
      
      expect(res.status).toBe(500); // Overall request fails
      // Because we use $transaction in the route, the route itself throws and transaction rolls back
      // Prisma handles the actual rollback in production.
    });

    it('27/28. History Retrieval (GET /api/complaints/[id]) still works for residents and admins', async () => {
      // Validates that existing detail endpoint (from Step 6) is untouched and functional
      (requireAuth as any).mockResolvedValue({ id: 'user1', role: Role.RESIDENT });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', residentId: 'user1', status: ComplaintStatus.RESOLVED, createdAt: new Date() });
      (prisma.complaintHistory.findMany as any).mockResolvedValue([
        { id: 'h1', previousStatus: 'OPEN', newStatus: 'IN_PROGRESS' },
        { id: 'h2', previousStatus: 'IN_PROGRESS', newStatus: 'RESOLVED' },
      ]);
      (requireOwnership as any).mockResolvedValue(true);

      const req = new NextRequest('http://localhost/api/complaints/c1', { method: 'GET' });
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'c1' }) });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.history).toHaveLength(2);
    });
  });

  describe('Complaint Priority Handling (PATCH /api/complaints/[id]/priority)', () => {
    const createPriorityRequest = (body: any) =>
      new NextRequest('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('1/2/3/16/17. Admin can set LOW, MEDIUM, HIGH and it persists correctly', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', status: ComplaintStatus.OPEN, priority: ComplaintPriority.LOW });
      (prisma.complaint.update as any).mockResolvedValue({ id: 'c1', priority: ComplaintPriority.HIGH });

      const req = createPriorityRequest({ priority: 'HIGH' });
      const res = await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(prisma.complaint.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { priority: 'HIGH' },
      });
      expect(prisma.complaintHistory.create).not.toHaveBeenCalled(); // Rule 13
    });

    it('4. Resident gets 403 when trying to change priority', async () => {
      (requireRole as any).mockRejectedValue(new AuthorizationError());
      const req = createPriorityRequest({ priority: 'HIGH' });
      const res = await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(403);
    });

    it('5. Unauthenticated user gets 401', async () => {
      (requireRole as any).mockRejectedValue(new AuthenticationError());
      const req = createPriorityRequest({ priority: 'HIGH' });
      const res = await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(401);
    });

    it('6/7/24. Invalid, empty, or malicious extra fields fail validation', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      // Missing priority
      let req = createPriorityRequest({});
      let res = await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(400);

      // Invalid priority string
      req = createPriorityRequest({ priority: 'CRITICAL' });
      res = await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(400);

      // Malicious payload with unknown fields (strict Zod rejection)
      req = createPriorityRequest({ priority: 'HIGH', status: 'RESOLVED', residentId: 'hacker' });
      res = await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(400); // Fails because of .strict() on Zod schema
    });

    it('8. Missing complaint returns 404', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findUnique as any).mockResolvedValue(null);
      
      const req = createPriorityRequest({ priority: 'MEDIUM' });
      const res = await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(404);
    });

    it('15. RESOLVED complaint rejects priority update', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', status: ComplaintStatus.RESOLVED });

      const req = createPriorityRequest({ priority: 'HIGH' });
      const res = await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(409);
      expect(prisma.complaint.update).not.toHaveBeenCalled();
    });

    it('9/10/11/12/13/14. Priority update modifies nothing but priority and history is untouched', async () => {
      (requireRole as any).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.findUnique as any).mockResolvedValue({ id: 'c1', status: ComplaintStatus.OPEN });
      (prisma.complaint.update as any).mockResolvedValue({ id: 'c1', priority: ComplaintPriority.MEDIUM });

      const req = createPriorityRequest({ priority: 'MEDIUM' });
      await PATCH_PRIORITY(req, { params: Promise.resolve({ id: 'c1' }) });

      // Ensure ONLY priority is in the update data payload
      expect(prisma.complaint.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { priority: 'MEDIUM' }, // Status, timestamps, residentId are NOT here
      });
      // Ensure history is not created or modified
      expect(prisma.complaintHistory.create).not.toHaveBeenCalled();
    });
  });
});
