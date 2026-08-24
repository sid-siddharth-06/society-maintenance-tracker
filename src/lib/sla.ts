import { prisma } from './prisma';
import { ComplaintStatus } from '../generated/prisma/client';
import { InternalServerError } from './errors';

const CONFIG_KEY = 'OVERDUE_THRESHOLD_DAYS';

/**
 * Retrieves the overdue threshold in days from the database.
 * The database is the single source of truth.
 * Throws a server error if the configuration is missing, rather than falling back.
 */
export async function getOverdueThresholdDays(): Promise<number> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: CONFIG_KEY },
  });

  if (!config) {
    throw new InternalServerError(`Critical configuration missing: ${CONFIG_KEY}`);
  }

  const threshold = parseInt(config.value, 10);
  if (isNaN(threshold) || threshold < 1) {
    throw new InternalServerError(`Invalid configuration for ${CONFIG_KEY}: ${config.value}`);
  }

  return threshold;
}

/**
 * Determines if a complaint is overdue based on strict rules:
 * - RESOLVED complaints are NEVER overdue.
 * - deadline = createdAt + thresholdDays
 * - isOverdue = now > deadline
 */
export function isComplaintOverdue(
  createdAt: Date,
  status: ComplaintStatus,
  thresholdDays: number,
  now: Date = new Date()
): boolean {
  if (status === ComplaintStatus.RESOLVED) {
    return false;
  }

  const deadline = new Date(createdAt.getTime());
  deadline.setDate(deadline.getDate() + thresholdDays);

  return now.getTime() > deadline.getTime();
}
