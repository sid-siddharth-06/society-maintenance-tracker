import { PrismaClient, Role, ComplaintStatus, ComplaintPriority } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Start seeding...');

  // 1. System Config (Overdue Threshold in Days)
  await prisma.systemConfig.upsert({
    where: { key: 'OVERDUE_THRESHOLD_DAYS' },
    update: {},
    create: {
      key: 'OVERDUE_THRESHOLD_DAYS',
      value: '3', // 3 days
      description: 'Number of days before an open complaint is considered overdue',
    },
  });

  // 2. Users (Admin + 2 Residents)
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@example.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const resident1 = await prisma.user.upsert({
    where: { email: 'resident1@example.com' },
    update: {},
    create: {
      name: 'Resident One',
      email: 'resident1@example.com',
      passwordHash,
      role: Role.RESIDENT,
    },
  });

  const resident2 = await prisma.user.upsert({
    where: { email: 'resident2@example.com' },
    update: {},
    create: {
      name: 'Resident Two',
      email: 'resident2@example.com',
      passwordHash,
      role: Role.RESIDENT,
    },
  });

  // 3. Notices
  await prisma.notice.create({
    data: {
      title: 'Water Supply Maintenance',
      content: 'Water supply will be disrupted tomorrow from 10 AM to 2 PM.',
      isImportant: true,
      authorId: admin.id,
    }
  });

  await prisma.notice.create({
    data: {
      title: 'Monthly Society Meeting',
      content: 'The monthly meeting will be held this Sunday at the clubhouse.',
      isImportant: false,
      authorId: admin.id,
    }
  });

  // 4. Complaints

  // A. Overdue Complaint (Created 5 days ago, still OPEN)
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  await prisma.complaint.create({
    data: {
      title: 'Leaking pipe in corridor',
      category: 'PLUMBING',
      description: 'The main pipe on the 4th floor is leaking heavily.',
      status: ComplaintStatus.OPEN,
      priority: ComplaintPriority.HIGH,
      residentId: resident1.id,
      createdAt: fiveDaysAgo,
    }
  });

  // B. In Progress Complaint with History
  const complaintInProgress = await prisma.complaint.create({
    data: {
      title: 'Lift button not working',
      category: 'ELECTRICAL',
      description: 'The down button on the 2nd floor lift is unresponsive.',
      status: ComplaintStatus.IN_PROGRESS,
      priority: ComplaintPriority.MEDIUM,
      residentId: resident2.id,
    }
  });

  await prisma.complaintHistory.create({
    data: {
      previousStatus: ComplaintStatus.OPEN,
      newStatus: ComplaintStatus.IN_PROGRESS,
      actorId: admin.id,
      complaintId: complaintInProgress.id,
      note: 'Technician has been called and is looking into it.',
    }
  });

  // C. Resolved Complaint with Full History
  const complaintResolved = await prisma.complaint.create({
    data: {
      title: 'Garbage not collected',
      category: 'MAINTENANCE',
      description: 'Garbage hasn\'t been collected for two days.',
      status: ComplaintStatus.RESOLVED,
      priority: ComplaintPriority.LOW,
      residentId: resident1.id,
    }
  });

  await prisma.complaintHistory.createMany({
    data: [
      {
        previousStatus: ComplaintStatus.OPEN,
        newStatus: ComplaintStatus.IN_PROGRESS,
        actorId: admin.id,
        complaintId: complaintResolved.id,
        note: 'Assigned to cleaning staff.',
      },
      {
        previousStatus: ComplaintStatus.IN_PROGRESS,
        newStatus: ComplaintStatus.RESOLVED,
        actorId: admin.id,
        complaintId: complaintResolved.id,
        note: 'Garbage cleared. Routine adjusted.',
      }
    ]
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
