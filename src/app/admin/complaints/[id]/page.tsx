'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function AdminComplaintDetailPage() {
  const params = useParams();
  const id = params.id as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [complaint, setComplaint] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchComplaint = async () => {
      try {
        const res = await fetch(`/api/complaints/${id}`);
        if (!res.ok) throw new Error('Failed to load complaint');
        const data = await res.json();
        setComplaint(data.data);
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchComplaint();
  }, [id]);

  const fetchComplaintStandalone = async () => {
    try {
      const res = await fetch(`/api/complaints/${id}`);
      if (!res.ok) throw new Error('Failed to load complaint');
      const data = await res.json();
      setComplaint(data.data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleUpdateStatus = async (targetStatus: string) => {
    setUpdating(true);
    setError('');
    try {
      const res = await fetch(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error.message || 'Failed to update status');
      
      setNote('');
      fetchComplaintStandalone(); // Refresh data to show new status and history
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    setUpdatingPriority(true);
    setError('');
    try {
      const res = await fetch(`/api/complaints/${id}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Failed to update priority');
      
      fetchComplaintStandalone();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setUpdatingPriority(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!complaint) return <div className="p-8 text-red-600">Complaint not found or error loading.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link href="/admin/complaints" className="text-blue-600 hover:underline">
          &larr; Back to Admin Complaints
        </Link>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      <div className="bg-white border rounded shadow p-6 mb-8">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold">{complaint.category}</h1>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full font-semibold text-xs flex items-center ${
              complaint.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
              complaint.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {complaint.priority}
            </span>
            <span className="px-3 py-1 bg-gray-100 rounded-full font-semibold">{complaint.status}</span>
            {complaint.isOverdue && (
              <span className="px-3 py-1 bg-red-600 text-white rounded-full font-bold flex items-center gap-1">
                ⚠️ OVERDUE
              </span>
            )}
          </div>
        </div>
        <div className="text-gray-500 text-sm mb-6">
          Filed on {new Date(complaint.createdAt).toLocaleDateString()}
        </div>
        <div>
          <h2 className="font-semibold mb-2">Description</h2>
          <p className="whitespace-pre-wrap">{complaint.description}</p>
        </div>
        
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

      {/* Admin Actions based on state machine */}
      <div className="bg-gray-50 border rounded shadow-sm p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">Admin Actions</h2>
        
        {complaint.status === 'RESOLVED' ? (
          <div className="text-green-700 font-medium">This complaint is permanently resolved and closed. Priority updates are disabled.</div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium">Set Priority</label>
              <div className="flex gap-4 items-center">
                <select
                  value={complaint.priority}
                  onChange={(e) => handleUpdatePriority(e.target.value)}
                  disabled={updatingPriority}
                  className="border rounded p-2"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
                {updatingPriority && <span className="text-sm text-gray-500">Updating...</span>}
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium mb-1">Status Update Note (Optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full border rounded p-2"
                placeholder="Reason or update details..."
                disabled={updating}
              />
            </div>
            <div className="flex gap-4">
              {complaint.status === 'OPEN' && (
                <button
                  onClick={() => handleUpdateStatus('IN_PROGRESS')}
                  disabled={updating}
                  className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Move to In Progress'}
                </button>
              )}
              {complaint.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => handleUpdateStatus('RESOLVED')}
                  disabled={updating}
                  className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Resolve Complaint'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Status History</h2>
        {complaint.history?.length === 0 ? (
          <p className="text-gray-500">No status updates yet.</p>
        ) : (
          <div className="space-y-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {complaint.history?.map((h: any) => (
              <div key={h.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded-r shadow-sm">
                <div className="font-semibold">{h.previousStatus} &rarr; {h.newStatus}</div>
                <div className="text-sm text-gray-500">
                  {new Date(h.timestamp).toLocaleString()} by Admin ({h.actorId.slice(0, 8)})
                </div>
                {h.note && <div className="mt-2 text-gray-800">{h.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
