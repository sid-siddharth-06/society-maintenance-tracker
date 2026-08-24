import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized() {
      return true; // Middleware isn't our security boundary. Authorization happens server-side in actions/routes.
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
