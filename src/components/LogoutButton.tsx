'use client';

import { logoutAction } from '../modules/auth/actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await logoutAction();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
    >
      {loading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
