import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { buildCalibrationLines } from '@/lib/tallyCalibration';
import { PRINTER_BOLD_OFF, PRINTER_BOLD_ON, PRINTER_TOP_OF_FORM_OFFSET } from '@/lib/tallyTicket';

/**
 * Raw .txt version of /orders/tally-calibration, for copying straight to the
 * printer's queue. Master Administrator only.
 *
 * Carries the same top-of-form offset as the real tally — so a line Tyler
 * reads as "line 01" on the actual printout corresponds directly to row 0 in
 * tallyTicket.ts, with the printer's own line-eating already cancelled out.
 * Report the numbers exactly as printed; no need to adjust for the skip.
 */
export async function GET() {
  const user = await requireUser();
  if (user.role !== 'MASTER_ADMIN') return new NextResponse('Not authorized', { status: 403 });
  const text = PRINTER_BOLD_ON + PRINTER_TOP_OF_FORM_OFFSET + buildCalibrationLines().join('\r\n') + PRINTER_BOLD_OFF + '\r\n';

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=us-ascii',
      'Content-Disposition': 'attachment; filename="tally-calibration.txt"',
    },
  });
}
