'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COMPLAINT_CATEGORIES, ComplaintCategory } from '../../../../modules/complaints/constants';

export default function NewComplaintPage() {
  const router = useRouter();
  const [category, setCategory] = useState<ComplaintCategory>(COMPLAINT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description);
      if (photo) {
        formData.append('photo', photo);
      }

      const res = await fetch('/api/complaints', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create complaint');
      }

      router.push('/resident/complaints');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">File a New Complaint</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
            className="w-full border rounded p-2"
          >
            {COMPLAINT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            rows={4}
            className="w-full border rounded p-2"
            placeholder="Describe the issue in detail..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Photo (Optional)</label>
          <input 
            type="file"
            accept="image/jpeg, image/png, image/webp"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            className="w-full border rounded p-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-1">Supported formats: JPEG, PNG, WebP. Maximum size: 5MB.</p>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Complaint'}
        </button>
      </form>
    </div>
  );
}
