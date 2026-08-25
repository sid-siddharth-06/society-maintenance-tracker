import { requireRole } from '../../../../lib/auth';
import { Role } from '../../../../generated/prisma/client';
import { prisma } from '../../../../lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await requireRole(Role.RESIDENT);
  
  // We use direct Prisma query in Server Components for simplicity, maintaining ownership check
  const complaint = await prisma.complaint.findUnique({
    where: { id: resolvedParams.id },
  });

  if (!complaint || complaint.residentId !== user.id) {
    notFound();
  }

  const history = await prisma.complaintHistory.findMany({
    where: { complaintId: resolvedParams.id },
    orderBy: { timestamp: 'desc' },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/resident/complaints" className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
          &larr; Back to Complaints
        </Link>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-2">
              {complaint.category}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Complaint Details</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              {complaint.status}
            </span>
            {complaint.priority !== 'LOW' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {complaint.priority}
              </span>
            )}
          </div>
        </div>
        
        <div className="text-gray-500 text-sm mb-6 pb-6 border-b border-gray-100">
          Filed on {new Date(complaint.createdAt).toLocaleDateString()} at {new Date(complaint.createdAt).toLocaleTimeString()}
        </div>
        
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Description</h2>
          <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{complaint.description}</p>
        
        {complaint.imageUrl && (
          <div className="mt-6 border rounded-lg p-2 bg-gray-50 max-w-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Attached Photo</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={complaint.imageUrl} 
              alt="Complaint Attachment" 
              className="w-full h-auto rounded shadow-sm"
              loading="lazy"
            />
          </div>
        )}
      </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Status History</h2>
        {history.length === 0 ? (
          <p className="text-gray-500">No status updates yet.</p>
        ) : (
          <div className="space-y-6">
            {history.map((h) => (
              <div key={h.id} className="relative pl-6 pb-6 border-l-2 border-gray-200 last:border-0 last:pb-0">
                <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 border-2 border-white"></div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                  <div className="font-medium text-gray-900">
                    Status changed to <span className="font-bold">{h.newStatus}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(h.timestamp).toLocaleString()}
                  </div>
                </div>
                {h.note && (
                  <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100">
                    <span className="font-semibold text-gray-500 block mb-1">Admin Note:</span>
                    {h.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
