import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAlerts } from '@/lib/alerts';

/**
 * What the bell menu shows when it's opened. Fetched on demand rather than
 * baked into every page: working the alerts out means a couple of dozen
 * queries, and most page loads never open the menu. getAlerts already
 * limits the list to what this person is allowed to see.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Not signed in', { status: 401 });

  const alerts = await getAlerts(user);
  return NextResponse.json(
    { alerts: alerts.map(({ id, severity, title, detail, href }) => ({ id, severity, title, detail, href })) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
