import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '../../../../../lib/api-handler';
import { requireRole } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { Role } from '../../../../../generated/prisma/client';
import { updateOverdueThresholdSchema } from '../../../../../modules/complaints/validations';
import { getOverdueThresholdDays } from '../../../../../lib/sla';

const CONFIG_KEY = 'OVERDUE_THRESHOLD_DAYS';

export const GET = apiHandler(async () => {
  await requireRole(Role.ADMIN);

  const thresholdDays = await getOverdueThresholdDays();

  return apiSuccess({
    thresholdDays,
  });
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  await requireRole(Role.ADMIN);

  const body = await req.json();
  const data = updateOverdueThresholdSchema.parse(body);

  const updatedConfig = await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value: data.thresholdDays.toString() },
    create: {
      key: CONFIG_KEY,
      value: data.thresholdDays.toString(),
      description: 'The number of days before an active complaint is considered overdue',
    },
  });

  return apiSuccess({
    thresholdDays: parseInt(updatedConfig.value, 10),
  });
});
