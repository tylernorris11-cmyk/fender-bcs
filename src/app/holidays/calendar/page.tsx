import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';

/** Merged into Planning's calendar — see src/app/planning/page.tsx. Kept as
 * a redirect so existing bookmarks/links still work. */
export default async function HolidayCalendarPage({ searchParams }: { searchParams: { date?: string } }) {
  await requirePermission('holidays.view');
  const params = new URLSearchParams({ view: 'month' });
  if (searchParams.date) params.set('date', searchParams.date);
  redirect(`/planning?${params.toString()}`);
}
