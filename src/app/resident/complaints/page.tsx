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
        <h1 className="text-3xl font-bold text-gray-900">My Complaints</h1>
        <Link href="/resident/complaints/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          New Complaint
        </Link>
      </div>

      <div className="space-y-4">
        {complaints.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No complaints filed yet.</p>
          </div>
        ) : (
          complaints.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {c.category}
                  </span>
                  <p className="mt-3 text-gray-900 font-medium truncate">{c.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {c.status}
                  </span>
                  {c.priority !== 'LOW' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {c.priority}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center border-t border-gray-100 pt-4">
                <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                <Link href={`/resident/complaints/${c.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  View Details &rarr;
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
