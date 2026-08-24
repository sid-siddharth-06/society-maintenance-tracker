import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '../../../../../lib/api-handler';
import { requireRole } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { updateComplaintStatusSchema } from '../../../../../modules/complaints/validations';
import { Role, ComplaintStatus } from '../../../../../generated/prisma/client';
import { NotFoundError, ConflictError } from '../../../../../lib/errors';
import { sendComplaintStatusEmail } from '../../../../../lib/email';

export const PATCH = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) => {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  // 1 & 2. Authenticate and enforce ADMIN role
  const user = await requireRole(Role.ADMIN);

  // Parse and validate the new status payload
  const body = await req.json();
  const data = updateComplaintStatusSchema.parse(body);

  // 4 & 5. Atomic Transaction: Verify current state, validate transition, update, and log history.
  const result = await prisma.$transaction(async (tx) => {
    // Read current complaint strictly inside the transaction to prevent race conditions
    const complaint = await tx.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundError('Complaint not found');
    }

    const currentState = complaint.status;
    const targetState = data.status;

    // Validate the exact state machine transitions
    if (currentState === ComplaintStatus.RESOLVED) {
      throw new ConflictError('Complaint is already resolved and permanently closed.');
    }

    if (currentState === ComplaintStatus.OPEN && targetState !== ComplaintStatus.IN_PROGRESS) {
      throw new ConflictError('Invalid transition: OPEN complaints can only move to IN_PROGRESS.');
    }

    if (currentState === ComplaintStatus.IN_PROGRESS && targetState !== ComplaintStatus.RESOLVED) {
      throw new ConflictError('Invalid transition: IN_PROGRESS complaints can only move to RESOLVED.');
    }

    // Perform the status update
    const updatedComplaint = await tx.complaint.update({
      where: { id },
      data: { status: targetState },
      include: { resident: { select: { email: true } } },
    });

    // Immutably insert the history record
    const historyRecord = await tx.complaintHistory.create({
      data: {
        complaintId: id,
        previousStatus: currentState,
        newStatus: targetState,
        actorId: user.id, // Derived securely from session
        note: data.note || null,
        // timestamp defaults to now() in schema
      },
    });

    return { updatedComplaint, historyRecord };
  });

  // Attempt email delivery with failure isolation
  if (result.updatedComplaint.resident?.email) {
    try {
      await sendComplaintStatusEmail(result.updatedComplaint.resident.email, {
        id: result.updatedComplaint.id,
        category: result.updatedComplaint.category,
        oldStatus: result.historyRecord.previousStatus,
        newStatus: result.updatedComplaint.status,
        adminNote: result.historyRecord.note || undefined,
        updatedAt: result.historyRecord.timestamp,
      });
    } catch (error) {
      console.error('Email failure boundary: isolated error in complaint status update:', error);
    }
  }

  return apiSuccess({
    complaint: result.updatedComplaint,
    history: result.historyRecord,
  });
});
