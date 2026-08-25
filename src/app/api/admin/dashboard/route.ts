import { apiHandler, apiSuccess } from '../../../../lib/api-handler';
import { requireRole } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { Role, ComplaintStatus } from '../../../../generated/prisma/client';
import { getOverdueThresholdDays } from '../../../../lib/sla';
import { COMPLAINT_CATEGORIES } from '../../../../modules/complaints/constants';

export const GET = apiHandler(async () => {
  // 1. Authorize: Admin only
  await requireRole(Role.ADMIN);

  // 2. Fetch aggregations
  const statusGroup = await prisma.complaint.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const categoryGroup = await prisma.complaint.groupBy({
    by: ['category'],
    _count: { _all: true },
  });

  // 3. Overdue calculation mathematically identical to SLA formula:
  // now > createdAt + thresholdDays => createdAt < now - thresholdDays
  const thresholdDays = await getOverdueThresholdDays();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

  const overdueCount = await prisma.complaint.count({
    where: {
      status: { not: ComplaintStatus.RESOLVED }, // RESOLVED never overdue
      createdAt: { lt: cutoffDate },
    },
  });

  // 4. Format status counts
  const statusCounts = {
    [ComplaintStatus.OPEN]: 0,
    [ComplaintStatus.IN_PROGRESS]: 0,
    [ComplaintStatus.RESOLVED]: 0,
  };

  for (const group of statusGroup) {
    statusCounts[group.status] = group._count._all;
  }

  // 5. Format category counts using the single source of truth
  const categoryCounts: Record<string, number> = {};
  for (const cat of COMPLAINT_CATEGORIES) {
    categoryCounts[cat] = 0;
  }

  for (const group of categoryGroup) {
    // Only map known categories just in case
    if ((COMPLAINT_CATEGORIES as readonly string[]).includes(group.category)) {
      categoryCounts[group.category] = group._count._all;
    } else {
      // If there are legacy categories, we might track them as 'OTHER' or dynamically
      categoryCounts[group.category] = group._count._all;
    }
  }

  return apiSuccess({
    statusCounts,
    categoryCounts,
    overdueCount,
  });
});
