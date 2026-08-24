import { z } from 'zod';

export const createNoticeSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title is too long'),
  content: z.string().trim().min(10, 'Content must be at least 10 characters').max(5000, 'Content is too long'),
  isImportant: z.boolean().default(false),
}).strict(); // Reject any extra fields
