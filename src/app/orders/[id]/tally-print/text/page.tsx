import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildTallyLines } from '@/lib/tallyTicket';
import { PrintActions } from '@/components/PrintActions';

/**
 * Same tally as /api/orders/[id]/tally-text, but as a page with a Print
 * button instead of a file you have to download and reopen elsewhere —
 * click Print, pick the tally printer in the OS dialog, done in one step.
 *
 * A browser can't send bytes straight to a printer silently (no web page
 * can, for anyone — it's a deliberate sandboxing restriction, not
 * something this app is choosing not to do), so this still goes through
 * the same OS print pipeline the garbled HTML version did. It only comes
 * out right if the printer's Windows/Mac queue is set to a raw or
 * text-only driver rather than one expecting graphics — worth checking if
 * this still doesn't print cleanly. The .txt download's raw file-copy
 * route (see that file's comment) is the one way to bypass that pipeline
 * entirely.
 */
export default async function TallyPrintTextPage({ params }: { params: { id: string } }) {
  await requirePermission('production.view');
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: { customer: true, barMarks: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!order) notFound();

  const lines = buildTallyLines(order);

  return (
    <div className="bg-white min-h-screen">
      <style>{'@page { margin: 0; } body { margin: 0; }'}</style>
      <PrintActions maxWidth={700} />

      <div className="print:hidden max-w-[700px] mx-auto px-10 pt-2">
        <Link href={`/orders/${order.id}/tally-print`} className="text-sm font-semibold text-brand-700 hover:underline">← Back to tally print</Link>
      </div>

      {lines.length === 0 ? (
        <p className="text-ink-muted p-10">No bar marks on this order.</p>
      ) : (
        <pre
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '10pt',
            lineHeight: '12pt',
            color: '#000',
            margin: 0,
            padding: 0,
            whiteSpace: 'pre',
          }}
        >
          {lines.join('\n')}
        </pre>
      )}
    </div>
  );
}
