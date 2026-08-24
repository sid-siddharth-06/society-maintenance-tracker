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
      <div className="mb-4">
        <Link href="/resident/complaints" className="text-blue-600 hover:underline">
          &larr; Back to Complaints
        </Link>
      </div>
      
      <div className="bg-white border rounded shadow p-6 mb-8">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold">{complaint.category}</h1>
          <span className="px-3 py-1 bg-gray-100 rounded-full">{complaint.status}</span>
        </div>
        
        <div className="text-gray-500 text-sm mb-6">
          Filed on {new Date(complaint.createdAt).toLocaleDateString()}
        </div>
        
        <div>
          <h2 className="font-semibold mb-2">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{complaint.description}</p>
        
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

      <div>
        <h2 className="text-xl font-bold mb-4">Status History</h2>
        {history.length === 0 ? (
          <p className="text-gray-500">No status updates yet.</p>
        ) : (
          <div className="space-y-4">
            {history.map((h) => (
              <div key={h.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="font-semibold">{h.previousStatus} &rarr; {h.newStatus}</div>
                <div className="text-sm text-gray-500">{new Date(h.timestamp).toLocaleString()}</div>
                {h.note && <div className="mt-2">{h.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
