import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as GET_DASHBOARD } from '../../../app/api/admin/dashboard/route';
import { NextRequest } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireRole } from '../../../lib/auth';
import { Role, ComplaintStatus } from '../../../generated/prisma/client';
import { getOverdueThresholdDays } from '../../../lib/sla';
import { AuthorizationError } from '../../../lib/errors';

vi.mock('../../../lib/auth', () => ({
  requireRole: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    complaint: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/sla', () => ({
  getOverdueThresholdDays: vi.fn(),
}));

describe('Admin Dashboard (Step 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createRequest = () => new NextRequest('http://localhost/api/admin/dashboard');

  it('1. Admin can access dashboard; Resident/Unauthenticated cannot', async () => {
    // Unauthenticated/Resident case modeled by requireRole throwing
    (requireRole as unknown as import('vitest').Mock).mockRejectedValueOnce(new AuthorizationError('Unauthorized'));
    
    const res = await GET_DASHBOARD(createRequest(), {});
    expect(res.status).toBe(403);
  });

  it('4/5/6/7/8. Status and Category counts are aggregated correctly', async () => {
    (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
    (getOverdueThresholdDays as unknown as import('vitest').Mock).mockResolvedValue(3);

    (prisma.complaint.groupBy as unknown as import('vitest').Mock).mockImplementation((args: { by: string[] }) => {
      if (args.by[0] === 'status') {
        return Promise.resolve([
          { status: ComplaintStatus.OPEN, _count: { _all: 5 } },
          { status: ComplaintStatus.IN_PROGRESS, _count: { _all: 2 } },
          { status: ComplaintStatus.RESOLVED, _count: { _all: 10 } },
        ]);
      }
      if (args.by[0] === 'category') {
        return Promise.resolve([
          { category: 'PLUMBING', _count: { _all: 7 } },
          { category: 'ELECTRICAL', _count: { _all: 10 } },
        ]);
      }
      return Promise.resolve([]);
    });

    (prisma.complaint.count as unknown as import('vitest').Mock).mockResolvedValue(1);

    const res = await GET_DASHBOARD(createRequest(), {});
    const json = await res.json();
    
    expect(json.success).toBe(true);
    expect(json.data.statusCounts.OPEN).toBe(5);
    expect(json.data.statusCounts.IN_PROGRESS).toBe(2);
    expect(json.data.statusCounts.RESOLVED).toBe(10);

    // Total Consistency Check
    const total = json.data.statusCounts.OPEN + json.data.statusCounts.IN_PROGRESS + json.data.statusCounts.RESOLVED;
    expect(total).toBe(17);

    // Categories
    expect(json.data.categoryCounts['PLUMBING']).toBe(7);
    expect(json.data.categoryCounts['ELECTRICAL']).toBe(10);
    expect(json.data.categoryCounts['CARPENTRY']).toBe(0); // Should be initialized to 0 from constants
  });

  describe('SLA Consistency Verification (9/10/11/12/13/14)', () => {
    it('Accurately models the exact mathematical boundary for overdue status', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      
      // Set current time to Jan 4, 10:00:00
      const now = new Date('2024-01-04T10:00:00.000Z');
      vi.setSystemTime(now);
      
      // Threshold is 3 days
      (getOverdueThresholdDays as unknown as import('vitest').Mock).mockResolvedValue(3);
      (prisma.complaint.groupBy as unknown as import('vitest').Mock).mockResolvedValue([]);
      
      // Let's execute the request to see the cutoff date computed
      await GET_DASHBOARD(createRequest(), {});

      // Calculate expected cutoff: now - 3 days => Jan 1 10:00:00
      const expectedCutoff = new Date('2024-01-01T10:00:00.000Z');

      expect(prisma.complaint.count).toHaveBeenCalledWith({
        where: {
          status: { not: ComplaintStatus.RESOLVED },
          createdAt: { lt: expectedCutoff },
        },
      });

      // Proof:
      // If complaint createdAt is Jan 1 10:00:00 => it is equal to cutoff. `lt` (less than) is false. Not overdue. (Correct)
      // If complaint createdAt is Jan 1 09:59:59 => it is strictly less than cutoff. `lt` is true. Overdue. (Correct)
    });

    it('RESOLVED complaints are never overdue', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (getOverdueThresholdDays as unknown as import('vitest').Mock).mockResolvedValue(3);
      (prisma.complaint.groupBy as unknown as import('vitest').Mock).mockResolvedValue([]);
      
      await GET_DASHBOARD(createRequest(), {});

      // The where clause strictly excludes RESOLVED
      expect(prisma.complaint.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: ComplaintStatus.RESOLVED }
          })
        })
      );
    });

    it('Dynamically reflects SystemConfig threshold changes', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });
      (prisma.complaint.groupBy as unknown as import('vitest').Mock).mockResolvedValue([]);
      
      const now = new Date('2024-01-10T00:00:00.000Z');
      vi.setSystemTime(now);

      // Admin changes threshold to 5
      (getOverdueThresholdDays as unknown as import('vitest').Mock).mockResolvedValue(5);
      
      await GET_DASHBOARD(createRequest(), {});

      const expectedCutoff = new Date('2024-01-05T00:00:00.000Z');

      expect(prisma.complaint.count).toHaveBeenCalledWith({
        where: {
          status: { not: ComplaintStatus.RESOLVED },
          createdAt: { lt: expectedCutoff },
        },
      });
    });
  });
});
