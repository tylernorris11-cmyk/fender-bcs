'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser, logActivity } from '@/lib/auth';
import { getActiveCompany } from '@/lib/company';
import { sendEmail } from '@/lib/email';

const TO_EMAIL = process.env.BUG_REPORT_TO_EMAIL || 'tyler@fendersteel.co.uk';

export async function reportBug(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Your session has expired. Sign in again.');

  const description = String(formData.get('description') ?? '').trim();
  if (!description) throw new Error('Describe what happened before sending.');
  const page = String(formData.get('page') ?? '').trim();
  const company = getActiveCompany(user);

  const report = await db.bugReport.create({
    data: { description, page, company, userId: user.id, userName: user.name, userEmail: user.email },
  });

  // The report is already saved regardless of what happens next, so a slow
  // or misconfigured mail provider never loses what was typed.
  const { sent } = await sendEmail({
    to: TO_EMAIL,
    subject: `Bug report — ${user.name}`,
    text: [
      `Reported by: ${user.name} (${user.email})`,
      `Page: ${page || 'not given'}`,
      `Company view: ${company}`,
      `When: ${report.createdAt.toISOString()}`,
      '',
      description,
    ].join('\n'),
  });
  if (sent) await db.bugReport.update({ where: { id: report.id }, data: { emailSent: true } });

  await logActivity('BugReport', report.id, 'Reported', description.slice(0, 120), user.id);
  revalidatePath('/setup/bugs');
  redirect('/report-bug?sent=1');
}
