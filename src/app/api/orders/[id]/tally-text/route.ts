import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildTallyLines, PRINTER_BOLD_OFF, PRINTER_BOLD_ON } from '@/lib/tallyTicket';

/**
 * A raw .txt download of the tally — the most reliable option for an impact
 * printer whose Windows/Mac driver mangles a graphical print job (an Epson
 * FX-890IIN did): copying this file straight to the printer's raw queue —
 * e.g. on Windows, `copy /b "file.txt" \\PC\PrinterShareName` — sends
 * exactly these bytes with no GDI/graphics translation at all. See
 * /orders/[id]/tally-print/text for a one-click "Print" version instead,
 * which is more convenient but still goes through the OS print dialog.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  await requirePermission('production.view');
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: { customer: true, barMarks: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!order) notFound();

  const text = PRINTER_BOLD_ON + buildTallyLines(order).join('\r\n') + PRINTER_BOLD_OFF + '\r\n';

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=us-ascii',
      'Content-Disposition': `attachment; filename="${order.number}-tally.txt"`,
    },
  });
}
