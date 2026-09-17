import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { buildCalibrationLines } from '@/lib/tallyCalibration';
import { PRINTER_BOLD_OFF, PRINTER_BOLD_ON } from '@/lib/tallyTicket';

/** Raw .txt version of /orders/tally-calibration, for copying straight to the printer's queue. Master Administrator only. */
export async function GET() {
  const user = await requireUser();
  if (user.role !== 'MASTER_ADMIN') return new NextResponse('Not authorized', { status: 403 });
  const text = PRINTER_BOLD_ON + buildCalibrationLines().join('\r\n') + PRINTER_BOLD_OFF + '\r\n';

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=us-ascii',
      'Content-Disposition': 'attachment; filename="tally-calibration.txt"',
    },
  });
}
