import { requireRole } from '../../../lib/auth';
import { Role } from '../../../generated/prisma/client';
import { prisma } from '../../../lib/prisma';
import Link from 'next/link';

export default async function ResidentComplaintsPage() {
  const user = await requireRole(Role.RESIDENT);
  
  const complaints = await prisma.complaint.findMany({
    where: { residentId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Complaints</h1>
        <Link href="/resident/complaints/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          New Complaint
        </Link>
      </div>

      <div className="space-y-4">
        {complaints.length === 0 ? (
          <p>No complaints filed yet.</p>
        ) : (
          complaints.map((c) => (
            <div key={c.id} className="border p-4 rounded shadow-sm">
              <div className="flex justify-between">
                <span className="font-semibold">{c.category}</span>
                <span className="px-2 py-1 bg-gray-100 rounded text-sm">{c.status}</span>
              </div>
              <p className="mt-2 text-gray-600 truncate">{c.description}</p>
              <div className="mt-4">
                <Link href={`/resident/complaints/${c.id}`} className="text-blue-500 hover:underline">
                  View Details
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
