import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '../../../../lib/api-handler';
import { requireAuth, requireOwnership } from '../../../../lib/auth';
import { NotFoundError } from '../../../../lib/errors';
import { prisma } from '../../../../lib/prisma';
import { Role } from '../../../../generated/prisma/client';
import { getOverdueThresholdDays, isComplaintOverdue } from '../../../../lib/sla';

export const GET = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) => {
  // Await params since Next.js 15+ route handlers use async params
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const user = await requireAuth();

  // Fetch complaint (without history first to check existence and ownership)
  const complaint = await prisma.complaint.findUnique({
    where: { id },
  });

  if (!complaint) {
    throw new NotFoundError('Complaint not found');
  }

  // Enforce ownership: Admin passes automatically, Resident must own the complaint
  if (user.role === Role.RESIDENT) {
    await requireOwnership(complaint.residentId);
  }

  // Fetch history separately or together. Since we already fetched the complaint, we can just fetch history now.
  const history = await prisma.complaintHistory.findMany({
    where: { complaintId: id },
    orderBy: { timestamp: 'desc' }, // Deterministic chronological ordering for retrieval
  });

  const thresholdDays = await getOverdueThresholdDays();
  const now = new Date();

  return apiSuccess({
    ...complaint,
    isOverdue: isComplaintOverdue(complaint.createdAt, complaint.status, thresholdDays, now),
    history,
  });
});
