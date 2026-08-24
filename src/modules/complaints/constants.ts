export const COMPLAINT_CATEGORIES = [
  'PLUMBING',
  'ELECTRICAL',
  'CARPENTRY',
  'HOUSEKEEPING',
  'SECURITY',
  'OTHER',
] as const;

export type ComplaintCategory = typeof COMPLAINT_CATEGORIES[number];
