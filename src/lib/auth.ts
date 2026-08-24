import { auth } from '../auth';
import { Role } from '../generated/prisma/client';
import { AuthenticationError, AuthorizationError } from './errors';

export const getCurrentUser = async () => {
  const session = await auth();
  return session?.user || null;
};

export const requireAuth = async () => {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthenticationError();
  }
  return user;
};

export const requireRole = async (role: Role) => {
  const user = await requireAuth();
  if (user.role !== role) {
    throw new AuthorizationError();
  }
  return user;
};

export const requireOwnership = async (targetUserId: string) => {
  const user = await requireAuth();
  if (user.role !== Role.ADMIN && user.id !== targetUserId) {
    throw new AuthorizationError('You do not own this resource');
  }
  return user;
};
