'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { assertPermission, logActivity, requireUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { parseDayInput, workingDaysBetween } from '@/lib/holidays';

export async function requestHoliday(formData: FormData) {
  const user = await assertPermission('holidays.view');

  const startDate = parseDayInput(String(formData.get('startDate') ?? ''));
  const endDate = parseDayInput(String(formData.get('endDate') ?? ''));
  if (!startDate || !endDate) throw new Error('Enter a start and end date.');
  if (endDate < startDate) throw new Error('The end date is before the start date.');

  const workingDays = workingDaysBetween(startDate, endDate);
  if (workingDays === 0) throw new Error('That range is entirely weekends and bank holidays — nothing to book off.');

  const request = await db.holidayRequest.create({
    data: {
      userId: user.id, startDate, endDate, workingDays,
      note: String(formData.get('note') ?? '').trim(),
    },
  });

  await logActivity('HolidayRequest', request.id, 'Requested', `${workingDays} day(s) from ${startDate.toDateString()}`, user.id);

  // Tell every Master Administrator there's something to look at — same
  // pattern as an access request landing in the approval queue.
  const h = headers();
  const link = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}/holidays`;
  const admins = await db.user.findMany({ where: { role: 'MASTER_ADMIN', active: true } });
  await Promise.all(admins.map((a) => sendEmail({
    to: a.email,
    subject: `Holiday request from ${user.name}`,
    text: `${user.name} has asked for ${workingDays} day(s) off, ${startDate.toDateString()} to ${endDate.toDateString()}.\n\nReview it: ${link}`,
  })));

  revalidatePath('/holidays');
  revalidatePath('/planning');
}

export async function cancelHoliday(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('requestId'));
  const request = await db.holidayRequest.findUniqueOrThrow({ where: { id } });

  if (request.userId !== user.id && user.role !== 'MASTER_ADMIN') {
    throw new Error('You can only withdraw your own requests.');
  }
  if (request.status !== 'PENDING') throw new Error('Only a pending request can be withdrawn — ask a Master Administrator to reverse a decided one.');

  await db.holidayRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  await logActivity('HolidayRequest', id, 'Withdrawn', '', user.id);
  revalidatePath('/holidays');
  revalidatePath('/planning');
}

export async function decideHoliday(formData: FormData) {
  const admin = await requireUser();
  if (admin.role !== 'MASTER_ADMIN') throw new Error('Only a Master Administrator can decide a holiday request.');

  const id = String(formData.get('requestId'));
  const decision = String(formData.get('decision'));
  if (decision !== 'APPROVED' && decision !== 'REJECTED') throw new Error('Unknown decision.');
  const decisionNote = String(formData.get('decisionNote') ?? '').trim();
  if (decision === 'REJECTED' && !decisionNote) throw new Error('Give a reason so the person knows why.');

  const request = await db.holidayRequest.findUniqueOrThrow({ where: { id }, include: { user: true } });
  if (request.status !== 'PENDING') throw new Error('This request has already been decided.');

  await db.holidayRequest.update({
    where: { id },
    data: { status: decision, decidedAt: new Date(), decidedById: admin.id, decisionNote },
  });

  await logActivity('HolidayRequest', id, decision === 'APPROVED' ? 'Approved' : 'Rejected', decisionNote, admin.id);

  await sendEmail({
    to: request.user.email,
    subject: decision === 'APPROVED' ? 'Your holiday request was approved' : 'Your holiday request was not approved',
    text: [
      `Hi ${request.user.name},`,
      '',
      `Your request for ${request.workingDays} day(s), ${request.startDate.toDateString()} to ${request.endDate.toDateString()}, was ${decision === 'APPROVED' ? 'approved' : 'not approved'} by ${admin.name}.`,
      decisionNote ? `\nNote: ${decisionNote}` : '',
    ].join('\n'),
  });

  revalidatePath('/holidays');
  revalidatePath('/planning');
}

/**
 * A manual correction to someone's balance for one calendar year — the main
 * use is going live partway through the year, when days already taken (on
 * paper, before this system existed) need to come off. Master Admin only,
 * same as deciding a request — not delegable to a company-scoped Admin.
 */
export async function adjustHolidayBalance(formData: FormData) {
  const admin = await requireUser();
  if (admin.role !== 'MASTER_ADMIN') throw new Error('Only a Master Administrator can add or take away someone’s holiday.');

  const userId = String(formData.get('userId'));
  const year = Number(formData.get('year'));
  const days = Number(formData.get('days'));
  const reason = String(formData.get('reason') ?? '').trim();

  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('Enter a valid year.');
  if (!Number.isInteger(days) || days === 0) throw new Error('Enter a number of days — positive to add, negative to take away.');
  if (!reason) throw new Error('Say why, so it’s on record.');

  await db.user.findUniqueOrThrow({ where: { id: userId } });

  await db.holidayAdjustment.create({ data: { userId, year, days, reason, createdById: admin.id } });
  await logActivity('User', userId, days > 0 ? 'Holiday days added' : 'Holiday days taken away',
    `${days > 0 ? '+' : ''}${days} for ${year} — ${reason}`, admin.id);

  revalidatePath('/holidays');
}
