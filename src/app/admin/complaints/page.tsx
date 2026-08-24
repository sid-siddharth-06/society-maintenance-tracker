import { requireRole } from '../../../lib/auth';
import { Role, Prisma, ComplaintStatus } from '../../../generated/prisma/client';
import { prisma } from '../../../lib/prisma';
import Link from 'next/link';
import { SlaConfigPanel } from './sla-config-panel';

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole(Role.ADMIN);
  const resolvedParams = await searchParams;

  const category = typeof resolvedParams.category === 'string' ? resolvedParams.category : undefined;
  const status = typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined;
  // Simplistic date filtering for demo purposes
  const date = typeof resolvedParams.date === 'string' ? resolvedParams.date : undefined;

  const where: Prisma.ComplaintWhereInput = {};
  if (category) where.category = category;
  if (status) where.status = { equals: status as ComplaintStatus };
  if (date) {
    // Simple exact date start to end of day UTC
    where.createdAt = {
      gte: new Date(`${date}T00:00:00.000Z`),
      lt: new Date(`${date}T23:59:59.999Z`),
    };
  }

  const complaints = await prisma.complaint.findMany({
    where,
    orderBy: [
      { createdAt: 'desc' },
      { id: 'asc' }
    ],
    include: {
      resident: {
        select: { name: true, email: true },
      },
    },
  });

  const { getOverdueThresholdDays, isComplaintOverdue } = await import('../../../lib/sla');
  const thresholdDays = await getOverdueThresholdDays();
  const now = new Date();

  const mappedComplaints = complaints.map(c => ({
    ...c,
    isOverdue: isComplaintOverdue(c.createdAt, c.status, thresholdDays, now)
  }));

  mappedComplaints.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <SlaConfigPanel initialThreshold={thresholdDays} />

      {/* Simple Filter Form triggering a standard GET request */}
      <form className="flex gap-4 mb-8 p-4 bg-gray-50 border rounded items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select name="category" defaultValue={category || ''} className="border p-2 rounded">
            <option value="">All</option>
            <option value="PLUMBING">Plumbing</option>
            <option value="ELECTRICAL">Electrical</option>
            <option value="CARPENTRY">Carpentry</option>
            <option value="HOUSEKEEPING">Housekeeping</option>
            <option value="SECURITY">Security</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select name="status" defaultValue={status || ''} className="border p-2 rounded">
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input type="date" name="date" defaultValue={date || ''} className="border p-2 rounded" />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Filter</button>
        <Link href="/admin/complaints" className="px-4 py-2 text-blue-600 hover:underline">Clear</Link>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">ID</th>
              <th className="p-3">Resident</th>
              <th className="p-3">Category</th>
              <th className="p-3">Status</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mappedComplaints.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="p-3 text-sm text-gray-500">{c.id.slice(0, 8)}</td>
                <td className="p-3">
                  <div>{c.resident.name}</div>
                  <div className="text-sm text-gray-500">{c.resident.email}</div>
                </td>
                <td className="p-3">{c.category}</td>
                <td className="p-3">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{c.status}</span>
                    {c.isOverdue && (
                      <span className="px-2 py-1 bg-red-600 text-white font-bold rounded text-xs flex items-center gap-1">
                        ⚠️ OVERDUE
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    c.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                    c.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {c.priority}
                  </span>
                </td>
                <td className="p-3">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <Link href={`/admin/complaints/${c.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {complaints.length === 0 && (
          <div className="text-center p-8 text-gray-500">No complaints found.</div>
        )}
      </div>
    </div>
  );
}
