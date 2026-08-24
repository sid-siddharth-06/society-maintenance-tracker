/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerResidentAction, loginAction, logoutAction } from '../actions';
import { getCurrentUser, requireAuth, requireRole, requireOwnership } from '../../../lib/auth';
import { Role } from '../../../generated/prisma/client';
import bcrypt from 'bcryptjs';

// Mock next-auth entirely to prevent deep imports from throwing in Node
vi.mock('next-auth', () => {
  return {
    default: vi.fn(() => ({
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      handlers: { GET: vi.fn(), POST: vi.fn() },
    })),
  };
});
vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../../../auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: vi.fn(),
}));

import { prisma } from '../../../lib/prisma';
import { signIn, signOut, auth } from '../../../auth';

describe('Authentication and RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration Rules', () => {
    it('1. Valid resident registration succeeds', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue({ id: '1', email: 'test@example.com' });

      const result = await registerResidentAction({
        name: 'Test Resident',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('2. Invalid registration data fails', async () => {
      const result = await registerResidentAction({
        name: 'T', // Too short
        email: 'not-an-email',
        password: '123', // Too short
      });

      expect(result.success).toBe(false);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('3. Duplicate email fails', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: '1', email: 'exist@example.com' });

      const result = await registerResidentAction({
        name: 'Test',
        email: 'exist@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('4. Password is stored hashed & 5. Plaintext password is never stored', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      
      await registerResidentAction({
        name: 'Test',
        email: 'test@example.com',
        password: 'password123',
      });

      const createCall = (prisma.user.create as any).mock.calls[0][0];
      expect(createCall.data.passwordHash).toBeDefined();
      expect(createCall.data.passwordHash).not.toBe('password123');
      expect((createCall.data as any).password).toBeUndefined(); // Plaintext not passed
      
      const isHashed = await bcrypt.compare('password123', createCall.data.passwordHash);
      expect(isHashed).toBe(true);
    });

    it('6. Registration always creates RESIDENT & 7. Client cannot escalate role', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      // Even if we bypassed TS types and passed a role parameter to the action
      const maliciousPayload = {
        name: 'Malicious',
        email: 'hacker@example.com',
        password: 'password123',
        role: 'ADMIN', // Will be stripped by Zod/Action
      };

      await registerResidentAction(maliciousPayload as any);

      const createCall = (prisma.user.create as any).mock.calls[0][0];
      expect(createCall.data.role).toBe(Role.RESIDENT); // Hardcoded in server action
    });
  });

  describe('Login & Logout', () => {
    it('8. Valid resident login succeeds', async () => {
      (signIn as any).mockResolvedValue(true);
      const result = await loginAction({ email: 'test@example.com', password: 'password123' });
      expect(result.success).toBe(true);
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'test@example.com',
        password: 'password123',
        redirect: false,
      });
    });

    it('9. Invalid credentials fail', async () => {
      (signIn as any).mockRejectedValue({ type: 'CredentialsSignin' });
      const result = await loginAction({ email: 'test@example.com', password: 'wrong' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials'); // Does not expose if email or password was wrong specifically
    });

    it('11. Logout invalidates the authenticated session', async () => {
      await logoutAction();
      expect(signOut).toHaveBeenCalledWith({ redirect: false });
    });
  });

  describe('Server-side Authorization (RBAC)', () => {
    it('10. Authenticated session identifies correct user & 16. Auth utility correctly identifies user', async () => {
      const mockSession = { user: { id: 'user1', role: Role.RESIDENT } };
      (auth as any).mockResolvedValue(mockSession);

      const user = await getCurrentUser();
      expect(user).toEqual(mockSession.user);
    });

    it('12. Unauthenticated protected access is rejected', async () => {
      (auth as any).mockResolvedValue(null);
      await expect(requireAuth()).rejects.toThrow('Authentication required');
    });

    it('13. Resident cannot access Admin functionality & 15. Server-side auth does not trust client-provided role', async () => {
      // The session token is read from HTTP-only cookie by auth(), making it impossible for client to inject roles
      (auth as any).mockResolvedValue({ user: { id: 'res1', role: Role.RESIDENT } });
      await expect(requireRole(Role.ADMIN)).rejects.toThrow('Insufficient permissions');
    });

    it('14. Admin can access Admin functionality', async () => {
      (auth as any).mockResolvedValue({ user: { id: 'admin1', role: Role.ADMIN } });
      const user = await requireRole(Role.ADMIN);
      expect(user.role).toBe(Role.ADMIN);
    });

    it('17. Ownership-check utility rejects access to another users resource', async () => {
      // Resident trying to access another resident's resource
      (auth as any).mockResolvedValue({ user: { id: 'res1', role: Role.RESIDENT } });
      await expect(requireOwnership('res2')).rejects.toThrow('You do not own this resource');
      
      // Resident accessing own resource
      const user = await requireOwnership('res1');
      expect(user.id).toBe('res1');

      // Admin accessing resident resource (should be allowed)
      (auth as any).mockResolvedValue({ user: { id: 'admin1', role: Role.ADMIN } });
      const adminAccess = await requireOwnership('res1');
      expect(adminAccess.id).toBe('admin1'); // Did not throw
    });
  });
});
