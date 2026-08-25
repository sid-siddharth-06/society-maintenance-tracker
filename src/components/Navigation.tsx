import Link from 'next/link';
import { auth } from '../auth';
import LogoutButton from './LogoutButton';
import { Role } from '../generated/prisma/client';

export default async function Navigation() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return (
      <nav className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0 flex items-center font-bold text-xl text-blue-600">
                SocietyApp
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                Login
              </Link>
              <Link href="/register" className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors">
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const isAdmin = user.role === Role.ADMIN;
  
  const residentLinks = [
    { name: 'Dashboard', href: '/resident' },
    { name: 'My Complaints', href: '/resident/complaints' },
    { name: 'New Complaint', href: '/resident/complaints/new' },
    { name: 'Notices', href: '/resident/notices' },
  ];

  const adminLinks = [
    { name: 'Dashboard', href: '/admin/dashboard' },
    { name: 'Complaints', href: '/admin/complaints' },
    { name: 'Notices', href: '/admin/notices' },
  ];

  const links = isAdmin ? adminLinks : residentLinks;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href={isAdmin ? "/admin" : "/resident"} className="font-bold text-xl text-blue-600">
                SocietyApp <span className="text-sm font-normal text-gray-500 ml-1">{isAdmin ? 'Admin' : 'Resident'}</span>
              </Link>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:block">
              <span className="text-sm text-gray-700 font-medium mr-4">{user.name}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>
      
      {/* Mobile menu (simplified for now) */}
      <div className="sm:hidden border-t border-gray-100 pb-3 pt-2">
        <div className="space-y-1 px-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
