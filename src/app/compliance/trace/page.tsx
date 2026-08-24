import Link from 'next/link';
import { Search } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAlerts } from '@/lib/alerts';
import { getActiveCompany } from '@/lib/company';
import { clock, shortDate } from '@/lib/format';
import { NAV, Shell } from '@/components/Shell';
import { Empty, PageHeader, Pill, Table } from '@/components/ui';

/**
 * Traceability both ways. Give it a cast number and it shows where the steel
 * came from and every order it went out on. Give it an order number and it
 * shows the casts on that delivery. This is the screen the auditor drives.
 */
export default async function TracePage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requirePermission('compliance.view');
  const alerts = await getAlerts(user);
  const q = (searchParams.q ?? '').trim();
  const company = getActiveCompany(user);

  if (company !== 'FENDER') {
    return (
      <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/trace" alerts={alerts.length}>
        <PageHeader title="Trace a batch" />
        <div className="banner-warn">
          Compliance is a Fender Steel thing — BCS Products is not CARES-approved and none of this applies to it.
        </div>
      </Shell>
    );
  }

  const batches = q
    ? await db.batch.findMany({
        where: {
          company,
          OR: [
            { heatNumber: { contains: q, mode: 'insensitive' } },
            { certNumber: { contains: q, mode: 'insensitive' } },
            { orderLines: { some: { order: { number: { contains: q, mode: 'insensitive' } } } } },
          ],
        },
        include: {
          product: true,
          supplier: true,
          orderLines: { include: { order: { include: { customer: true } } } },
          movements: { include: { user: true }, orderBy: { at: 'desc' } },
          ncrs: true,
        },
        take: 20,
      })
    : [];

  const untraceable = await db.batch.findMany({
    where: { company, millCertUrl: '', status: { in: ['Available', 'Quarantined'] } },
    include: { product: true, supplier: true },
  });

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance/trace" alerts={alerts.length}>
      <PageHeader title="Trace a batch" blurb="Follow any cast number back to the mill and forward to every site it went to." />

      <form className="card card-pad mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input name="q" defaultValue={q} className="input pl-10" aria-label="Cast number, certificate number or order number"
                 placeholder="Cast number, certificate number or order number — e.g. H260503 or FS-26-05306" />
        </div>
        <button className="btn-primary">Trace</button>
      </form>

      {q && batches.length === 0 && (
        <Empty title={`Nothing on file for “${q}”. Check the cast number on the tag or the mill certificate.`} />
      )}

      {batches.map((b) => (
        <section key={b.id} className="card card-pad mb-6">
          <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold">Cast {b.heatNumber}</h2>
              <p className="text-ink-muted">{b.product.name} · {b.product.standard}</p>
            </div>
            <div className="flex gap-2">
              <Pill tone={b.status === 'Available' ? 'good' : b.status === 'Quarantined' ? 'bad' : 'neutral'}>{b.status}</Pill>
              {b.millCertUrl
                ? <a href={b.millCertUrl} className="btn-secondary btn-sm">Mill certificate</a>
                : <Pill tone="bad">No mill certificate</Pill>}
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <div>
              <h3 className="font-bold mb-2">Back to the mill</h3>
              <dl className="text-sm space-y-1.5">
                <div className="flex justify-between"><dt className="text-ink-muted">Supplier</dt><dd className="font-semibold">{b.supplier.name}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Certificate</dt><dd className="font-semibold">{b.certNumber || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Received</dt><dd className="font-semibold">{shortDate(b.receivedAt)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Delivery note</dt><dd className="font-semibold">{b.deliveryNote || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Received / remaining</dt><dd className="font-semibold tabular-nums">{Number(b.qtyReceived).toFixed(3)} / {Number(b.qtyRemaining).toFixed(3)}</dd></div>
              </dl>
            </div>

            <div>
              <h3 className="font-bold mb-2">Forward to site</h3>
              {b.orderLines.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing issued from this cast yet.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {b.orderLines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3">
                      <Link href={`/orders/${l.order.id}`} className="text-brand-700 font-semibold hover:underline">{l.order.number}</Link>
                      <span className="text-ink-muted flex-1">{l.order.customer.name} · {l.order.town}</span>
                      <span className="tabular-nums">{Number(l.qty).toFixed(3)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {b.ncrs.length > 0 && (
            <div className="banner-warn mb-5">
              <span>
                {b.ncrs.length} non-conformance{b.ncrs.length === 1 ? '' : 's'} against this cast:{' '}
                {b.ncrs.map((n) => n.ref).join(', ')}
              </span>
            </div>
          )}

          <h3 className="font-bold mb-2">Movement history</h3>
          <Table head={<>
            <th className="th">When</th><th className="th">Movement</th><th className="th text-right">Qty</th>
            <th className="th">Reference</th><th className="th">By</th>
          </>}>
            {b.movements.map((m) => (
              <tr key={m.id} className="row">
                <td className="td text-ink-muted whitespace-nowrap">{shortDate(m.at)} {clock(m.at)}</td>
                <td className="td">{m.type.replace('_', ' ').toLowerCase()}</td>
                <td className="td text-right tabular-nums">{Number(m.qty).toFixed(3)}</td>
                <td className="td text-ink-muted">{m.reference || m.reason || '—'}</td>
                <td className="td text-ink-muted">{m.user?.name ?? '—'}</td>
              </tr>
            ))}
          </Table>
        </section>
      ))}

      {untraceable.length > 0 && (
        <section className="card card-pad">
          <h2 className="text-lg font-bold mb-1">Batches with a broken trail</h2>
          <p className="text-sm text-ink-muted mb-4">Live stock with no mill certificate attached. Chase the paperwork or quarantine the steel.</p>
          <ul className="text-sm space-y-2">
            {untraceable.map((b) => (
              <li key={b.id} className="flex flex-wrap gap-3 items-center">
                <Pill tone="bad">{b.heatNumber}</Pill>
                <span>{b.product.name}</span>
                <span className="text-ink-muted">{b.supplier.name} · received {shortDate(b.receivedAt)}</span>
                <Link href={`/stock/${b.productId}`} className="ml-auto text-brand-700 hover:underline">Open batch</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
