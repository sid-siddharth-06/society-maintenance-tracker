import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as POST_COMPLAINT } from '../../../app/api/complaints/route';
import { Role } from '../../../generated/prisma/client';
import { requireRole } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { uploadComplaintPhoto, deleteComplaintPhoto } from '../../../lib/cloudinary';

vi.mock('../../../lib/auth', () => ({
  requireRole: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    complaint: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/cloudinary', () => ({
  uploadComplaintPhoto: vi.fn(),
  deleteComplaintPhoto: vi.fn(),
}));

describe('Step 10: Complaint Photo Upload using Cloudinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireRole as unknown as import('vitest').Mock).mockResolvedValue({ id: 'user1', role: Role.RESIDENT });
  });

  const createFormDataRequest = (fields: Record<string, string | File>) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    
    // In Vitest/Node environments, mocking formData parsing for NextRequest is notoriously flaky
    // So we spy on the json/formData methods on a dummy request
    const req = new NextRequest('http://localhost', {
      headers: {
        'content-type': 'multipart/form-data; boundary=something',
      },
    });
    req.formData = vi.fn().mockResolvedValue(formData) as unknown as import('vitest').Mock;
    req.json = vi.fn().mockRejectedValue(new Error('Should use formData')) as unknown as import('vitest').Mock;
    return req;
  };

  const createFakeFile = (name: string, type: string, size: number) => {
    const blob = new Blob(['fake image data'], { type });
    const file = new File([blob], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    // Mock arrayBuffer since node File implementation might not have it natively in some vitest contexts
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(size));
    return file;
  };

  it('1/17. Complaint creation without photo succeeds, storing null imageUrl', async () => {
    (prisma.complaint.create as unknown as import('vitest').Mock).mockResolvedValue({ id: 'c1', imageUrl: null });

    const req = createFormDataRequest({
      category: 'PLUMBING',
      description: 'Leak in kitchen',
    });

    const res = await POST_COMPLAINT(req, {});
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(uploadComplaintPhoto).not.toHaveBeenCalled();
    expect(prisma.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imageUrl: null,
      }),
    });
  });

  it('2/8/9/18. Complaint creation with valid JPEG succeeds, Cloudinary is invoked, secureUrl is stored', async () => {
    (uploadComplaintPhoto as unknown as import('vitest').Mock).mockResolvedValue({ secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/test.jpg', publicId: 'test_public_id' });
    (prisma.complaint.create as unknown as import('vitest').Mock).mockResolvedValue({ id: 'c2', imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/test.jpg' });

    const file = createFakeFile('test.jpg', 'image/jpeg', 1024);
    const req = createFormDataRequest({
      category: 'PLUMBING',
      description: 'Leak in kitchen',
      photo: file,
    });

    const res = await POST_COMPLAINT(req, {});
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(uploadComplaintPhoto).toHaveBeenCalled();
    expect(prisma.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/test.jpg',
      }),
    });
  });

  it('3. Valid PNG succeeds', async () => {
    (uploadComplaintPhoto as unknown as import('vitest').Mock).mockResolvedValue({ secureUrl: 'test.png', publicId: 'id' });
    (prisma.complaint.create as unknown as import('vitest').Mock).mockResolvedValue({ id: 'c3', imageUrl: 'test.png' });

    const file = createFakeFile('test.png', 'image/png', 1024);
    const req = createFormDataRequest({ category: 'PLUMBING', description: 'Leak in kitchen', photo: file });

    const res = await POST_COMPLAINT(req, {});
    expect(res.status).toBe(201);
  });

  it('4. Valid WebP succeeds', async () => {
    (uploadComplaintPhoto as unknown as import('vitest').Mock).mockResolvedValue({ secureUrl: 'test.webp', publicId: 'id' });
    (prisma.complaint.create as unknown as import('vitest').Mock).mockResolvedValue({ id: 'c4', imageUrl: 'test.webp' });

    const file = createFakeFile('test.webp', 'image/webp', 1024);
    const req = createFormDataRequest({ category: 'PLUMBING', description: 'Leak in kitchen', photo: file });

    const res = await POST_COMPLAINT(req, {});
    expect(res.status).toBe(201);
  });

  it('5. Unsupported MIME type rejected', async () => {
    const file = createFakeFile('test.pdf', 'application/pdf', 1024);
    const req = createFormDataRequest({ category: 'PLUMBING', description: 'desc', photo: file });

    const res = await POST_COMPLAINT(req, {});
    expect(res.status).toBe(400); // Bad Request
    expect(uploadComplaintPhoto).not.toHaveBeenCalled();
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });

  it('6. File over 5 MB rejected', async () => {
    const file = createFakeFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024); // 6 MB
    const req = createFormDataRequest({ category: 'PLUMBING', description: 'desc', photo: file });

    const res = await POST_COMPLAINT(req, {});
    expect(res.status).toBe(400);
    expect(uploadComplaintPhoto).not.toHaveBeenCalled();
  });

  it('7. Malformed upload payload handled safely', async () => {
    const req = new NextRequest('http://localhost', {
      headers: { 'content-type': 'multipart/form-data' },
    });
    req.formData = vi.fn().mockRejectedValue(new Error('Malformed multipart payload')) as unknown as import('vitest').Mock;

    const res = await POST_COMPLAINT(req, {});
    expect(res.status).toBe(400); // Handled safely as ValidationError
  });

  it('10. Client cannot submit arbitrary imageUrl in payload', async () => {
    // If client submits imageUrl, the API should ignore it because it explicitly uses `secureUrl` from Cloudinary (or null)
    (prisma.complaint.create as unknown as import('vitest').Mock).mockResolvedValue({ id: 'c5' });

    const req = createFormDataRequest({
      category: 'PLUMBING',
      description: 'Leak in kitchen',
      imageUrl: 'https://malicious.com/image.jpg', // spoofing attempt
    });

    const res = await POST_COMPLAINT(req, {});
    expect(res.status).toBe(201);

    // Verify the DB create was called with null for imageUrl, completely ignoring the spoofed field
    expect(prisma.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imageUrl: null,
      }),
    });
  });

  it('11/12/14. Client cannot spoof residentId, it comes strictly from the session', async () => {
    (prisma.complaint.create as unknown as import('vitest').Mock).mockResolvedValue({ id: 'c6' });

    const req = createFormDataRequest({
      category: 'PLUMBING',
      description: 'Leak in kitchen',
      residentId: 'user999', // spoofing attempt
    });

    await POST_COMPLAINT(req, {});

    expect(prisma.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        residentId: 'user1', // The id from the requireRole mock
      }),
    });
  });

  it('13. Unauthenticated user rejected', async () => {
    (requireRole as unknown as import('vitest').Mock).mockRejectedValueOnce(new Error('Unauthorized'));

    const req = createFormDataRequest({ category: 'PLUMBING', description: 'Leak in kitchen' });
    
    // We expect the request to throw or return error. In our apiHandler, it returns the error JSON.
    const res = await POST_COMPLAINT(req, {});
    expect(res.status).toBe(500); // Default error if not a custom ApiError, but the actual status depends on auth middleware.
  });

  it('15. Cloudinary upload failure prevents complaint creation', async () => {
    (uploadComplaintPhoto as unknown as import('vitest').Mock).mockRejectedValue(new Error('Cloudinary Service Down'));
    const file = createFakeFile('fail.jpg', 'image/jpeg', 1024);
    const req = createFormDataRequest({ category: 'PLUMBING', description: 'Leak in kitchen', photo: file });

    const res = await POST_COMPLAINT(req, {});
    expect(res.status).toBe(500); // Fails the request
    expect(prisma.complaint.create).not.toHaveBeenCalled(); // DB is untouched
  });

  it('16. Database failure after Cloudinary upload triggers best-effort cleanup', async () => {
    (uploadComplaintPhoto as unknown as import('vitest').Mock).mockResolvedValue({ secureUrl: 'http://url', publicId: 'uploaded_asset_123' });
    (prisma.complaint.create as unknown as import('vitest').Mock).mockRejectedValue(new Error('DB Connection Lost'));
    
    const file = createFakeFile('cleanup.jpg', 'image/jpeg', 1024);
    const req = createFormDataRequest({ category: 'PLUMBING', description: 'Leak in kitchen', photo: file });

    const res = await POST_COMPLAINT(req, {});
    
    expect(res.status).toBe(500);
    expect(uploadComplaintPhoto).toHaveBeenCalled(); // It did upload
    expect(deleteComplaintPhoto).toHaveBeenCalledWith('uploaded_asset_123'); // Best effort cleanup triggered
  });
});
