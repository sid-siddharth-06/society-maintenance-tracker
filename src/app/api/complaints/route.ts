import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '../../../lib/api-handler';
import { requireAuth, requireRole } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { createComplaintSchema, complaintFilterSchema } from '../../../modules/complaints/validations';
import { Role } from '../../../generated/prisma/client';
import { Prisma } from '../../../generated/prisma/client';
import { getOverdueThresholdDays, isComplaintOverdue } from '../../../lib/sla';
import { uploadComplaintPhoto, deleteComplaintPhoto } from '../../../lib/cloudinary';
import { ValidationError } from '../../../lib/errors';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const POST = apiHandler(async (req: NextRequest) => {
  // 1 & 2. Authenticate and enforce RESIDENT role
  const user = await requireRole(Role.RESIDENT);

  // 3. Parse payload (supports both JSON and multipart/form-data)
  let categoryRaw: unknown;
  let descriptionRaw: unknown;
  let photoRaw: unknown;

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await req.formData();
      categoryRaw = formData.get('category');
      descriptionRaw = formData.get('description');
      photoRaw = formData.get('photo');
    } catch {
      throw new ValidationError('Invalid form data payload');
    }
  } else {
    try {
      const body = await req.json();
      categoryRaw = body.category;
      descriptionRaw = body.description;
      photoRaw = body.photo; // Optional, usually ignored in JSON
    } catch {
      throw new ValidationError('Invalid JSON payload');
    }
  }

  // 4 & 5. Validate core fields
  const data = createComplaintSchema.parse({
    category: categoryRaw,
    description: descriptionRaw,
  });

  // 6. Validate optional photo
  let secureUrl: string | undefined = undefined;
  let publicId: string | undefined = undefined;

  if (photoRaw && photoRaw instanceof File) {
    if (photoRaw.size > MAX_FILE_SIZE) {
      throw new ValidationError('Photo file size must be less than 5MB');
    }
    if (!ALLOWED_MIME_TYPES.includes(photoRaw.type)) {
      throw new ValidationError('Only JPEG, PNG, and WebP images are allowed');
    }

    // 7 & 8. Convert to Buffer and upload to Cloudinary
    const arrayBuffer = await photoRaw.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadComplaintPhoto(buffer);
    secureUrl = uploadResult.secureUrl;
    publicId = uploadResult.publicId;
  }

  try {
    // 9. Create Complaint in PostgreSQL
    const complaint = await prisma.complaint.create({
      data: {
        category: data.category,
        description: data.description,
        residentId: user.id, // Securely derived
        imageUrl: secureUrl || null,
      },
    });

    // 10. Return success
    return apiSuccess(complaint, 201);
  } catch (error) {
    // If Prisma creation fails after a successful Cloudinary upload, do best-effort cleanup
    if (publicId) {
      await deleteComplaintPhoto(publicId);
    }
    throw error;
  }
});

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireAuth();
  
  // Parse search params for admin filtering
  const { searchParams } = new URL(req.url);
  const filterParams = {
    category: searchParams.get('category') || undefined,
    status: searchParams.get('status') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  };

  const filters = complaintFilterSchema.parse(filterParams);

  // Build Prisma where clause securely
  const where: Prisma.ComplaintWhereInput = {};

  if (user.role === Role.RESIDENT) {
    // Resident: Enforce strict ownership, ignore admin filters
    where.residentId = user.id;
  } else if (user.role === Role.ADMIN) {
    // Admin: Can see all, apply requested filters
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const complaints = await prisma.complaint.findMany({
    where,
    // Base deterministic sorting before we apply the dynamic SLA sort
    orderBy: [
      { createdAt: 'desc' },
      { id: 'asc' },
    ],
  });

  const thresholdDays = await getOverdueThresholdDays();
  const now = new Date();

  const mappedComplaints = complaints.map((complaint) => ({
    ...complaint,
    isOverdue: isComplaintOverdue(complaint.createdAt, complaint.status, thresholdDays, now),
  }));

  // Sort: Overdue first, then by createdAt desc (which is mostly preserved by stable sort, but we enforce it explicitly)
  if (user.role === Role.ADMIN) {
    mappedComplaints.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Tie-breaker: createdAt DESC
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      // Final tie-breaker: id ASC
      return a.id.localeCompare(b.id);
    });
  }

  return apiSuccess(mappedComplaints);
});
