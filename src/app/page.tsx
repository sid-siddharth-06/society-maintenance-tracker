import { auth } from '../auth';
import { redirect } from 'next/navigation';
import { Role } from '../generated/prisma/client';
import Link from 'next/link';

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    if (session.user.role === Role.ADMIN) {
      redirect('/admin/dashboard');
    } else {
      redirect('/resident/complaints');
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 text-center">
      <div className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-6">
          Streamline your <span className="text-blue-600">Society Maintenance</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-xl mx-auto">
          File complaints, track progress, and stay updated with important notices—all in one place.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/login" 
            className="inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/register" 
            className="inline-flex justify-center items-center px-8 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors"
          >
            Create Resident Account
          </Link>
        </div>
      </div>
    </div>
  );
}
