/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { apiHandler, apiSuccess } from '../api-handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '../errors';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({ data, options })),
  },
}));

describe('apiHandler', () => {
  it('1. Returns success properly using apiSuccess helper', async () => {
    const response = apiSuccess({ hello: 'world' }) as any;
    expect(response.data).toEqual({ success: true, data: { hello: 'world' } });
    expect(response.options.status).toBe(200);
  });

  it('2. Catches custom ApiError instances (e.g. AuthenticationError)', async () => {
    const handler = apiHandler(async () => {
      throw new AuthenticationError();
    });

    const result = await handler({} as any, {}) as any;
    expect(result.data.success).toBe(false);
    expect(result.data.error.code).toBe('UNAUTHENTICATED');
    expect(result.options.status).toBe(401);
  });

  it('3. Catches AuthorizationError with correct 403', async () => {
    const handler = apiHandler(async () => {
      throw new AuthorizationError();
    });

    const result = await handler({} as any, {}) as any;
    expect(result.options.status).toBe(403);
    expect(result.data.error.code).toBe('UNAUTHORIZED');
  });

  it('4. Catches NotFoundError with 404', async () => {
    const handler = apiHandler(async () => {
      throw new NotFoundError();
    });

    const result = await handler({} as any, {}) as any;
    expect(result.options.status).toBe(404);
  });

  it('5. Catches ZodError and translates to 400 VALIDATION_ERROR', async () => {
    const schema = z.object({ name: z.string() });
    
    const handler = apiHandler(async () => {
      schema.parse({}); // Throws ZodError
      return NextResponse.json({});
    });

    const result = await handler({} as any, {}) as any;
    expect(result.options.status).toBe(400);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
    expect(result.data.error.details).toBeDefined(); // Contains path and issues
  });

  it('6. Catches unexpected errors and hides internal details', async () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const handler = apiHandler(async () => {
      throw new Error('Some deep prisma or database internal failure');
    });

    const result = await handler({} as any, {}) as any;
    expect(result.options.status).toBe(500);
    expect(result.data.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(result.data.error.message).toBe('An unexpected error occurred');
    expect(result.data.error.message).not.toContain('prisma');
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
