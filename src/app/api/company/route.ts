import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { COMPANY_COOKIE } from '@/lib/company';
import type { Company } from '@prisma/client';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const formData = await request.formData();
  const target = String(formData.get('company') ?? '') as Company;
  const back = String(formData.get('back') ?? '/');

  // Never trust the request alone — only set the cookie if this user
  // actually has this company in their own access list.
  if (user && user.companies.includes(target)) {
    cookies().set(COMPANY_COOKIE, target, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return NextResponse.redirect(new URL(back, request.url), { status: 303 });
}
