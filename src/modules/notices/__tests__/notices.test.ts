import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../../../app/api/notices/route';
import { prisma } from '../../../lib/prisma';
import { requireAuth, requireRole } from '../../../lib/auth';
import { Role } from '../../../generated/prisma/client';
import { AuthorizationError } from '../../../lib/errors';

// Mock dependencies
vi.mock('../../../lib/prisma', () => ({
  prisma: {
    notice: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/auth', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

describe('Notices API (Step 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createJsonRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const createGetRequest = () =>
    new NextRequest('http://localhost/api/notices', { method: 'GET' });

  describe('Notice Creation (POST /api/notices)', () => {
    it('1. Admin can create a notice & 9. Author ID comes from authenticated Admin session', async () => {
      const mockAdmin = { id: 'admin1', role: Role.ADMIN };
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue(mockAdmin);
      (prisma.notice.create as unknown as import('vitest').Mock).mockResolvedValue({ id: 'n1', title: 'Test', content: 'Test content 123' });

      const req = createJsonRequest({
        title: 'Water cut',
        content: 'No water tomorrow from 10 to 12',
        isImportant: true,
      });

      const res = await POST(req, {});
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(requireRole).toHaveBeenCalledWith(Role.ADMIN);
      expect(prisma.notice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Water cut',
            content: 'No water tomorrow from 10 to 12',
            isImportant: true,
            authorId: 'admin1', // Server-derived
          }),
        })
      );
    });

    it('2. Resident cannot create a notice & 3. Unauthenticated user cannot create a notice', async () => {
      (requireRole as unknown as import('vitest').Mock).mockRejectedValue(new AuthorizationError());
      
      const req = createJsonRequest({ title: 'Test', content: 'Content 12345' });
      const res = await POST(req, {});
      expect(res.status).toBe(403);
      expect(prisma.notice.create).not.toHaveBeenCalled();
    });

    it('4. Empty title rejected & 5. Empty content rejected', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });

      const req1 = createJsonRequest({ title: '', content: 'Content 12345' });
      const res1 = await POST(req1, {});
      expect(res1.status).toBe(400);

      const req2 = createJsonRequest({ title: 'Valid Title', content: 'short' });
      const res2 = await POST(req2, {});
      expect(res2.status).toBe(400);
      
      expect(prisma.notice.create).not.toHaveBeenCalled();
    });

    it('6. Invalid payload rejected', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });

      const req = createJsonRequest({ title: 123, content: true }); // wrong types
      const res = await POST(req, {});
      expect(res.status).toBe(400);
      expect(prisma.notice.create).not.toHaveBeenCalled();
    });

    it('7. Unknown/malicious fields rejected & 8. Client cannot spoof authorId', async () => {
      (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'admin1', role: Role.ADMIN });

      const req = createJsonRequest({
        title: 'Valid title',
        content: 'Valid content 12345',
        authorId: 'hacked-admin-id', // Spoof attempt
        id: 'fake-uuid',
        createdAt: new Date().toISOString(),
      });

      const res = await POST(req, {});
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      // Should mention unrecognized keys
      expect(JSON.stringify(data.error.details)).toContain('unrecognized_keys');
      expect(prisma.notice.create).not.toHaveBeenCalled();
    });
  });

  describe('Notice Retrieval (GET /api/notices)', () => {
    it('10. Authenticated Resident can retrieve notices & 11. Admin can retrieve notices', async () => {
      (requireAuth as unknown as import('vitest').Mock).mockResolvedValue({ id: 'user1', role: Role.RESIDENT });
      (prisma.notice.findMany as unknown as import('vitest').Mock).mockResolvedValue([{ id: 'n1', title: 'Test' }]);

      const req = createGetRequest();
      const res = await GET(req, {});
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(requireAuth).toHaveBeenCalled();
    });

    it('12. Important notices appear first, 13. Normal notices appear after, 14. Newest within important, 15. Newest within normal, 16. Deterministic tie-breaker', async () => {
      (requireAuth as unknown as import('vitest').Mock).mockResolvedValue({ id: 'user1', role: Role.RESIDENT });
      (prisma.notice.findMany as unknown as import('vitest').Mock).mockResolvedValue([]);

      const req = createGetRequest();
      await GET(req, {});

      expect(prisma.notice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { isImportant: 'desc' },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
        })
      );
    });
  });
});
