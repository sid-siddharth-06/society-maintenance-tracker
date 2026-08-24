/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { signIn, signOut } from '../../auth';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './validations';
import { Role } from '../../generated/prisma/client';

export async function registerResidentAction(data: RegisterInput) {
  try {
    const validatedData = registerSchema.parse(data);
    const { name, email, password } = validatedData;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: 'User with this email already exists' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Hardcode RESIDENT role to prevent escalation
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: Role.RESIDENT,
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Registration failed' };
  }
}

export async function loginAction(data: LoginInput) {
  try {
    const validatedData = loginSchema.parse(data);
    
    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });
    
    return { success: true };
  } catch (error: any) {
    if (error?.type === 'CredentialsSignin') {
      return { success: false, error: 'Invalid credentials' };
    }
    return { success: false, error: 'Login failed' };
  }
}

export async function logoutAction() {
  await signOut({ redirect: false });
  return { success: true };
}
