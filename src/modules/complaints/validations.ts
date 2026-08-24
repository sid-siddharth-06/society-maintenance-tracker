import { z } from 'zod';
import { COMPLAINT_CATEGORIES } from './constants';
import { ComplaintStatus, ComplaintPriority } from '../../generated/prisma/client';

export const createComplaintSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES, {
    message: 'Invalid category',
  }),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
});

export const complaintFilterSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES).optional(),
  status: z.nativeEnum(ComplaintStatus).optional(),
  startDate: z.string().datetime().optional(), // Enforces strict ISO 8601
  endDate: z.string().datetime().optional(),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum([ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED], {
    message: 'Invalid status transition target',
  }),
  note: z.string().trim().max(1000).optional(),
});

export const updateComplaintPrioritySchema = z.object({
  priority: z.enum([ComplaintPriority.LOW, ComplaintPriority.MEDIUM, ComplaintPriority.HIGH], {
    message: 'Invalid priority',
  }),
}).strict();

export const updateOverdueThresholdSchema = z.object({
  thresholdDays: z.number().int().min(1, 'Threshold must be at least 1 day'),
}).strict();

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type ComplaintFilterInput = z.infer<typeof complaintFilterSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type UpdateComplaintPriorityInput = z.infer<typeof updateComplaintPrioritySchema>;
export type UpdateOverdueThresholdInput = z.infer<typeof updateOverdueThresholdSchema>;
