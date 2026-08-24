'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardData {
  statusCounts: {
    OPEN: number;
    IN_PROGRESS: number;
    RESOLVED: number;
  };
  categoryCounts: Record<string, number>;
  overdueCount: number;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch('/api/admin/dashboard');
        const json = await res.json();
        
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error?.message || 'Failed to load dashboard');
        }
      } catch {
        setError('Network error loading dashboard');
      } finally {
        setLoading(false);
      }
    }
    
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-64 bg-gray-200 rounded mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 text-red-600 p-4 rounded-md shadow-sm border border-red-100">
          <h2 className="font-bold mb-2">Dashboard Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const totalComplaints = data.statusCounts.OPEN + data.statusCounts.IN_PROGRESS + data.statusCounts.RESOLVED;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of society maintenance operations.</p>
        </div>
        <div className="flex space-x-4">
          <Link href="/admin/complaints" className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            Manage Complaints
          </Link>
          <Link href="/admin/notices" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            Notice Board
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Complaints</h3>
          <p className="text-4xl font-bold text-gray-900 mt-2">{totalComplaints}</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Open</h3>
          <p className="text-4xl font-bold text-blue-600 mt-2">{data.statusCounts.OPEN}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">In Progress</h3>
          <p className="text-4xl font-bold text-amber-500 mt-2">{data.statusCounts.IN_PROGRESS}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Resolved</h3>
          <p className="text-4xl font-bold text-emerald-600 mt-2">{data.statusCounts.RESOLVED}</p>
        </div>

        {/* OVERDUE CARD - Visually Distinct */}
        <div className="bg-red-50 p-6 rounded-xl shadow-sm border-2 border-red-200 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
            ACTION REQUIRED
          </div>
          <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider flex items-center">
            <span aria-hidden="true" className="mr-2">⚠️</span> Overdue
          </h3>
          <p className="text-5xl font-black text-red-700 mt-2">{data.overdueCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-semibold text-gray-800">Status Breakdown</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-32 text-sm font-medium text-gray-600">Open</div>
                <div className="flex-1 ml-4 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${totalComplaints > 0 ? (data.statusCounts.OPEN / totalComplaints) * 100 : 0}%` }}
                  ></div>
                </div>
                <div className="w-12 text-right text-sm font-bold text-gray-800 ml-4">{data.statusCounts.OPEN}</div>
              </div>

              <div className="flex items-center">
                <div className="w-32 text-sm font-medium text-gray-600">In Progress</div>
                <div className="flex-1 ml-4 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${totalComplaints > 0 ? (data.statusCounts.IN_PROGRESS / totalComplaints) * 100 : 0}%` }}
                  ></div>
                </div>
                <div className="w-12 text-right text-sm font-bold text-gray-800 ml-4">{data.statusCounts.IN_PROGRESS}</div>
              </div>

              <div className="flex items-center">
                <div className="w-32 text-sm font-medium text-gray-600">Resolved</div>
                <div className="flex-1 ml-4 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${totalComplaints > 0 ? (data.statusCounts.RESOLVED / totalComplaints) * 100 : 0}%` }}
                  ></div>
                </div>
                <div className="w-12 text-right text-sm font-bold text-gray-800 ml-4">{data.statusCounts.RESOLVED}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-semibold text-gray-800">Category Breakdown</h2>
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(data.categoryCounts)
                  .sort(([, countA], [, countB]) => countB - countA)
                  .map(([category, count]) => (
                    <tr key={category} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        {category}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                        {count}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
