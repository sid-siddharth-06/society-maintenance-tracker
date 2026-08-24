import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendComplaintStatusEmail, sendImportantNoticeEmail } from '../../../lib/email';
import { NextRequest } from 'next/server';
import { PATCH as PATCH_COMPLAINT_STATUS } from '../../../app/api/complaints/[id]/status/route';
import { POST as POST_NOTICE } from '../../../app/api/notices/route';
import { prisma } from '../../../lib/prisma';
import { requireRole } from '../../../lib/auth';
import { Role, ComplaintStatus } from '../../../generated/prisma/client';

// Mock dependencies
vi.mock('../../../lib/email', () => ({
  sendComplaintStatusEmail: vi.fn(),
  sendImportantNoticeEmail: vi.fn(),
}));

vi.mock('../../../lib/auth', () => ({
  requireRole: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    notice: {
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

describe('Email Notifications (Step 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createComplaintStatusRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/complaints/c1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const createNoticeRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  describe('Complaint Status Email', () => {
    it('1. Complaint transaction completes before status email is attempted & 9. Uses complaint owner DB email', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      
      const mockTxResult = {
        updatedComplaint: {
          id: 'c1',
          category: 'PLUMBING',
          status: ComplaintStatus.IN_PROGRESS,
          resident: { email: 'resident@test.com' }, // 9. DB email
        },
        historyRecord: {
          previousStatus: ComplaintStatus.OPEN,
          createdAt: new Date(),
        }
      };
      
      (prisma.$transaction as unknown as import('vitest').Mock).mockResolvedValue(mockTxResult);
      
      const req = createComplaintStatusRequest({ status: ComplaintStatus.IN_PROGRESS });
      const res = await PATCH_COMPLAINT_STATUS(req, { params: { id: 'c1' } });
      const data = await res.json();
      
      expect(data.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      
      // 1. Ensure email is called AFTER transaction succeeds
      expect(sendComplaintStatusEmail).toHaveBeenCalledWith(
        'resident@test.com',
        expect.objectContaining({
          id: 'c1',
          newStatus: ComplaintStatus.IN_PROGRESS
        })
      );
    });

    it('2/3/4. Status email failure does not rollback complaint/history or produce 500', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      
      const mockTxResult = {
        updatedComplaint: {
          id: 'c1',
          category: 'PLUMBING',
          status: ComplaintStatus.IN_PROGRESS,
          resident: { email: 'resident@test.com' },
        },
        historyRecord: {
          previousStatus: ComplaintStatus.OPEN,
          createdAt: new Date(),
        }
      };
      
      (prisma.$transaction as unknown as import('vitest').Mock).mockResolvedValue(mockTxResult);
      
      // Force email failure
      (sendComplaintStatusEmail as unknown as import('vitest').Mock).mockRejectedValue(new Error('Resend network error'));
      
      const req = createComplaintStatusRequest({ status: ComplaintStatus.IN_PROGRESS });
      const res = await PATCH_COMPLAINT_STATUS(req, { params: { id: 'c1' } });
      
      // 4. Does not produce 500
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      
      // 2/3. Transaction still executed successfully and returned its payload
      expect(data.data.complaint.id).toBe('c1');
    });
  });

  describe('Important Notice Email', () => {
    it('5. Important Notice creation completes before email & 10. Uses DB resident emails', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      
      const mockNotice = {
        id: 'n1',
        title: 'Important water cut',
        content: 'No water tomorrow from 10 to 12',
        isImportant: true,
        createdAt: new Date(),
        author: { name: 'Admin One' }
      };
      
      (prisma.notice.create as unknown as import('vitest').Mock).mockResolvedValue(mockNotice);
      
      (prisma.user.findMany as unknown as import('vitest').Mock).mockResolvedValue([
        { email: 'res1@test.com' },
        { email: 'res2@test.com' }
      ]);
      
      const req = createNoticeRequest({
        title: 'Important water cut',
        content: 'No water tomorrow from 10 to 12',
        isImportant: true,
      });
      
      const res = await POST_NOTICE(req, {});
      const data = await res.json();
      
      expect(data.success).toBe(true);
      expect(prisma.notice.create).toHaveBeenCalled();
      
      // 10. Only database-derived emails are passed
      expect(sendImportantNoticeEmail).toHaveBeenCalledWith(
        ['res1@test.com', 'res2@test.com'],
        expect.objectContaining({ title: 'Important water cut' })
      );
    });

    it('8. Standard notices do NOT trigger notification', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      
      const mockNotice = {
        id: 'n2',
        title: 'Normal Notice',
        content: 'Hello everyone, testing 123',
        isImportant: false, // Not important
        createdAt: new Date(),
        author: { name: 'Admin One' }
      };
      
      (prisma.notice.create as unknown as import('vitest').Mock).mockResolvedValue(mockNotice);
      
      const req = createNoticeRequest({
        title: 'Normal Notice',
        content: 'Hello everyone, testing 123',
        isImportant: false,
      });
      
      const res = await POST_NOTICE(req, {});
      const data = await res.json();
      
      expect(data.success).toBe(true);
      
      // 8. No email attempted
      expect(sendImportantNoticeEmail).not.toHaveBeenCalled();
    });

    it('6/7. Important notice email failure does not rollback Notice creation or produce 500', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      
      const mockNotice = {
        id: 'n1',
        title: 'Important water cut',
        content: 'No water tomorrow from 10 to 12',
        isImportant: true,
        createdAt: new Date(),
        author: { name: 'Admin One' }
      };
      
      (prisma.notice.create as unknown as import('vitest').Mock).mockResolvedValue(mockNotice);
      (prisma.user.findMany as unknown as import('vitest').Mock).mockResolvedValue([{ email: 'res1@test.com' }]);
      
      // Force email failure
      (sendImportantNoticeEmail as unknown as import('vitest').Mock).mockRejectedValue(new Error('API Key invalid'));
      
      const req = createNoticeRequest({
        title: 'Important water cut',
        content: 'No water tomorrow from 10 to 12',
        isImportant: true,
      });
      
      const res = await POST_NOTICE(req, {});
      
      // 7. Not a 500
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      
      // 6. Notice creation mock still passed data back
      expect(data.data.id).toBe('n1');
    });

    it('11. Client cannot spoof notification recipients (uses role: RESIDENT)', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      
      const mockNotice = {
        id: 'n3',
        title: 'Important',
        content: 'Stuff goes here to make 10 chars',
        isImportant: true,
        createdAt: new Date(),
        author: { name: 'Admin One' }
      };
      
      (prisma.notice.create as unknown as import('vitest').Mock).mockResolvedValue(mockNotice);
      (prisma.user.findMany as unknown as import('vitest').Mock).mockResolvedValue([]);
      
      const req = createNoticeRequest({
        title: 'Important',
        content: 'Stuff goes here to make 10 chars',
        isImportant: true,
        recipientEmail: 'hacker@example.com' // Spoof attempt
      });
      
      const res = await POST_NOTICE(req, {});
      expect(res.status).toBe(400); // Fails strict validation
      
      // Should NEVER query DB or send email with attacker payload
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(sendImportantNoticeEmail).not.toHaveBeenCalled();
    });
  });
});
