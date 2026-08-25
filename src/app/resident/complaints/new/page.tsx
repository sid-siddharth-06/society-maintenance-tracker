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
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">File a New Complaint</h1>
      
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Category</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
            className="w-full border-gray-300 rounded-lg p-3 border focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-gray-900"
          >
            {COMPLAINT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Description</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            rows={5}
            className="w-full border-gray-300 rounded-lg p-3 border focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-gray-900"
            placeholder="Describe the issue in detail (at least 10 characters)..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Photo Attachment (Optional)</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50">
            <div className="space-y-1 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex text-sm text-gray-600 justify-center">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-1">
                  <span>Upload a file</span>
                  <input 
                    id="file-upload"
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">
                JPEG, PNG, WebP up to 5MB
              </p>
              {photo && (
                <p className="text-sm font-semibold text-green-600 mt-2">
                  Selected: {photo.name}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting Complaint...' : 'Submit Complaint'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
