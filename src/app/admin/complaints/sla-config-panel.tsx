'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SlaConfigPanel({ initialThreshold }: { initialThreshold: number }) {
  const [editingThreshold, setEditingThreshold] = useState(String(initialThreshold));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSaveThreshold = async () => {
    const val = parseInt(editingThreshold, 10);
    if (isNaN(val) || val < 1) return alert('Threshold must be at least 1 day');
    
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config/overdue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholdDays: val }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh the current route to fetch new server component data
        router.refresh();
      } else {
        alert(data.error?.message || 'Failed to update threshold');
      }
    } catch {
      alert('Error updating threshold');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border rounded shadow p-4 mb-8 flex items-center gap-4">
      <h2 className="font-bold text-gray-700">SLA Configuration</h2>
      <div className="flex items-center gap-2">
        <label className="text-sm">Overdue Threshold (Days):</label>
        <input
          type="number"
          min="1"
          value={editingThreshold}
          onChange={(e) => setEditingThreshold(e.target.value)}
          className="border rounded px-2 py-1 w-20 text-sm"
          disabled={saving}
        />
        <button
          onClick={handleSaveThreshold}
          disabled={saving || parseInt(editingThreshold, 10) === initialThreshold}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
