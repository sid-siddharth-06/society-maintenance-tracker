import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '../../../../../lib/api-handler';
import { requireRole } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { updateComplaintPrioritySchema } from '../../../../../modules/complaints/validations';
import { Role, ComplaintStatus } from '../../../../../generated/prisma/client';
import { NotFoundError, ConflictError } from '../../../../../lib/errors';

export const PATCH = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) => {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  // 1. Authenticate and enforce ADMIN role
  await requireRole(Role.ADMIN);

  // 2. Parse and strictly validate the payload
  const body = await req.json();
  const data = updateComplaintPrioritySchema.parse(body);

  // 3. Find the complaint
  const complaint = await prisma.complaint.findUnique({
    where: { id },
  });

  if (!complaint) {
    throw new NotFoundError('Complaint not found');
  }

  // 4. Protect RESOLVED complaints from priority changes
  if (complaint.status === ComplaintStatus.RESOLVED) {
    throw new ConflictError('Complaint is already resolved and permanently closed.');
  }

  // 5. Update strictly only the priority
  const updatedComplaint = await prisma.complaint.update({
    where: { id },
    data: { priority: data.priority },
  });

  return apiSuccess({
    complaint: updatedComplaint,
  });
});
