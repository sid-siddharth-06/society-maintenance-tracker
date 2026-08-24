import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError } from './errors';

import { NextRequest } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppRouteHandler = (req: NextRequest, context: any) => Promise<NextResponse> | NextResponse;

export function apiHandler(handler: AppRouteHandler): AppRouteHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, context: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error('[API Error]:', error); // Safe server-side logging

      // Handle custom ApiError instances
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: error.statusCode }
        );
      }

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input provided',
              details: error.issues, // Exposing Zod details is safe and useful for clients
            },
          },
          { status: 400 }
        );
      }

      // Handle unexpected generic errors safely
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        { status: 500 }
      );
    }
  };
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}
