'use client';

import { useState, useEffect } from 'react';

interface Notice {
  id: string;
  title: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
  author: {
    name: string;
    email: string;
  };
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/notices');
        const data = await res.json();
        if (data.success) {
          setNotices(data.data);
        } else {
          setError(data.error?.message || 'Failed to fetch notices');
        }
      } catch {
        setError('An error occurred');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          isImportant,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Reset form
        setTitle('');
        setContent('');
        setIsImportant(false);
        // Refresh notices directly instead of calling a function that triggers ESLint
        const res2 = await fetch('/api/notices');
        const data2 = await res2.json();
        if (data2.success) setNotices(data2.data);
      } else {
        setError(data.error?.message || 'Failed to create notice');
      }
    } catch {
      setError('An error occurred while creating notice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Manage Notice Board</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Create Notice Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Post a New Notice</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              minLength={3}
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              minLength={10}
              maxLength={5000}
            ></textarea>
          </div>

          <div className="flex items-center">
            <input
              id="isImportant"
              type="checkbox"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isImportant" className="ml-2 block text-sm text-gray-900">
              Mark as Important (Pins to top)
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Posting...' : 'Post Notice'}
          </button>
        </form>
      </div>

      {/* Existing Notices List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Existing Notices</h2>
        {loading ? (
          <p>Loading notices...</p>
        ) : notices.length === 0 ? (
          <p className="text-gray-500">No notices posted yet.</p>
        ) : (
          <div className="space-y-4">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className={`p-6 rounded-lg shadow border-l-4 ${
                  notice.isImportant ? 'bg-red-50 border-red-500' : 'bg-white border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold flex items-center">
                      {notice.title}
                      {notice.isImportant && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Important
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Posted by {notice.author.name} on {new Date(notice.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-gray-700 whitespace-pre-wrap">
                  {notice.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
