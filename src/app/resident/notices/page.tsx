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

export default function ResidentNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const res = await fetch('/api/notices');
        const data = await res.json();
        if (data.success) {
          setNotices(data.data);
        } else {
          setError(data.error?.message || 'Failed to fetch notices');
        }
      } catch {
        setError('An error occurred while fetching notices');
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotices();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-bold text-gray-900">Notice Board</h1>
        <p className="mt-2 text-sm text-gray-500">
          Stay updated with the latest announcements from the society administration.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8">
          <p className="text-gray-500 text-lg animate-pulse">Loading notices...</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">No notices posted yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={`p-6 rounded-lg shadow-sm border-l-4 transition-shadow hover:shadow-md ${
                notice.isImportant 
                  ? 'bg-red-50/50 border-red-500 ring-1 ring-red-100' 
                  : 'bg-white border-blue-500 ring-1 ring-gray-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                    {notice.title}
                    {notice.isImportant && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 uppercase tracking-wide">
                        Important
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <span className="font-medium text-gray-700">{notice.author.name}</span>
                    <span>&bull;</span>
                    <time dateTime={notice.createdAt}>
                      {new Date(notice.createdAt).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  </p>
                </div>
              </div>
              <div className="mt-5 text-gray-700 whitespace-pre-wrap leading-relaxed">
                {notice.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
