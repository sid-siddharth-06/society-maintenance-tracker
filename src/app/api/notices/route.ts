import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '../../../lib/api-handler';
import { requireAuth, requireRole } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { Role } from '../../../generated/prisma/client';
import { createNoticeSchema } from '../../../modules/notices/validations';
import { ValidationError } from '../../../lib/errors';
import { sendImportantNoticeEmail } from '../../../lib/email';

// POST /api/notices - Admin only
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await requireRole(Role.ADMIN); // Strictly ADMIN only

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON payload');
  }

  // Parse payload strictly
  const data = createNoticeSchema.parse(body);

  const notice = await prisma.notice.create({
    data: {
      title: data.title,
      content: data.content,
      isImportant: data.isImportant,
      authorId: user.id, // Strictly derived from session, NOT client
    },
    // We can include the author for returning
    include: {
      author: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (notice.isImportant) {
    try {
      const residents = await prisma.user.findMany({
        where: { role: Role.RESIDENT },
        select: { email: true },
      });
      
      const residentEmails = residents.map((r) => r.email).filter(Boolean);
      
      if (residentEmails.length > 0) {
        await sendImportantNoticeEmail(residentEmails, {
          id: notice.id,
          title: notice.title,
          content: notice.content,
          createdAt: notice.createdAt,
          authorName: notice.author.name,
        });
      }
    } catch (error) {
      console.error('Email failure boundary: isolated error in important notice broadcast:', error);
    }
  }

  return apiSuccess(notice, 201);
});

// GET /api/notices - Authenticated users
export const GET = apiHandler(async () => {
  await requireAuth(); // Residents and Admins

  const notices = await prisma.notice.findMany({
    orderBy: [
      { isImportant: 'desc' }, // Important notices first
      { createdAt: 'desc' },   // Newest first
      { id: 'asc' },           // Deterministic tie-breaker
    ],
    include: {
      author: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return apiSuccess(notices);
});
