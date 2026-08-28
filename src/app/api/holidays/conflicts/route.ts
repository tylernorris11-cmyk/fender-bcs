import { NextResponse } from 'next/server';
import { assertPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { parseDayInput } from '@/lib/holidays';

/**
 * Who else is already off across the requested range — checked live as
 * someone picks dates, and again server-side when a Master Admin reviews
 * the request. Shared calendar, so this is every active user, not just
 * people in the requester's own company.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await assertPermission('holidays.view');
  } catch {
    return new NextResponse('Not authorized', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = parseDayInput(searchParams.get('start') ?? '');
  const end = parseDayInput(searchParams.get('end') ?? '');
  if (!start || !end || end < start) return NextResponse.json({ conflicts: [] });

  const overlapping = await db.holidayRequest.findMany({
    where: {
      userId: { not: user.id },
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: { user: { select: { name: true, colour: true } } },
    orderBy: { startDate: 'asc' },
  });

  return NextResponse.json({
    conflicts: overlapping.map((r) => ({
      name: r.user.name,
      colour: r.user.colour,
      status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
    })),
  });
}
