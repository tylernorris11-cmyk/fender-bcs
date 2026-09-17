import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { buildCalibrationLines } from '@/lib/tallyCalibration';

/** Raw .txt version of /orders/tally-calibration, for copying straight to the printer's queue. Master Administrator only. */
export async function GET() {
  const user = await requireUser();
  if (user.role !== 'MASTER_ADMIN') return new NextResponse('Not authorized', { status: 403 });
  const text = buildCalibrationLines().join('\r\n') + '\r\n';

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=us-ascii',
      'Content-Disposition': 'attachment; filename="tally-calibration.txt"',
    },
  });
}
