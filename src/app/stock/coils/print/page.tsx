import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { PrintActions } from '@/components/PrintActions';

/**
 * A page of tear-off tickets — one per newly-allocated coil number, big
 * enough to read from a few feet away and write nothing else on. Printed,
 * cut apart, and tied or taped to a coil at the gate as it comes off the
 * lorry, well before anyone's entered its grade or weight.
 */
export default async function CoilTicketsPage({ searchParams }: { searchParams: { refs?: string } }) {
  await requirePermission('stock.goodsIn');
  const refs = (searchParams.refs ?? '').split(',').map((r) => r.trim()).filter(Boolean);

  return (
    <div className="bg-white min-h-screen">
      <PrintActions maxWidth={800} />

      <div className="print:hidden max-w-[800px] mx-auto px-10 pt-2">
        <Link href="/stock/coils" className="text-sm font-semibold text-brand-700 hover:underline">← Back to coils</Link>
      </div>

      <div className="p-10 max-w-[800px] mx-auto">
        {refs.length === 0 ? (
          <p className="text-ink-muted">No numbers to print.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:gap-3 print:grid-cols-2">
            {refs.map((ref) => (
              <div
                key={ref}
                className="border-2 border-dashed border-hairline rounded-xl p-6 text-center print:border-black print:rounded-none print:break-inside-avoid"
              >
                <p className="text-xs uppercase tracking-widest text-ink-faint mb-2">BCS Products — Coil</p>
                <p className="text-5xl font-black tracking-wider">{ref}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
