import Link from 'next/link';
import type { OrderStage, ProductionProcess } from '@prisma/client';
import { AlertTriangle, ArrowRight, CheckCircle2, Factory, Scissors, Weight } from 'lucide-react';
import { shortDate, tonnes } from '@/lib/format';
import { MACHINE, MACHINES, machinesFor } from '@/lib/productionSplit';
import { Empty, Pill, SortSelect } from '@/components/ui';
import { IconStat } from '@/components/IconStat';
import { SubmitButton } from '@/components/SubmitButton';
import { UrlModal } from '@/components/UrlModal';
import { startOrderProduction } from './actions';

/**
 * Fender's production board: every approved order, split by machine using
 * its bending schedule (see lib/productionSplit.ts). Click an order for its
 * pop-up, then pick the Cutter, Bending or the Stema to start — or carry on
 * with — that machine's share of the job.
 */

type Mark = { id: string; diaMm: number; shapeCode: string; bars: number; weightKg: unknown; status: string; qcChecks: { pass: boolean }[] };
type BoardOrder = {
  id: string; number: string; stage: OrderStage; deliveryDate: Date | null; town: string;
  customer: { name: string };
  barMarks: Mark[];
  productionJobs: { process: ProductionProcess; userId: string; user: { name: string } }[];
};
type Share = { marks: number; bars: number; kg: number; done: number; ready: number };

const STAGE: Partial<Record<OrderStage, { label: string; tone: 'warn' | 'info' | 'good' }>> = {
  APPROVED: { label: 'Approved for production', tone: 'warn' },
  IN_PRODUCTION: { label: 'In production', tone: 'info' },
  READY_FOR_DELIVERY: { label: 'Ready for delivery', tone: 'good' },
};

/** Each machine's share of an order: bar marks, bars and weight, how many are done, and (for bending) how many are cut and waiting. */
function sharesFor(order: BoardOrder, done: Map<string, Set<ProductionProcess>>) {
  const shares = Object.fromEntries(MACHINES.map((p) => [p, { marks: 0, bars: 0, kg: 0, done: 0, ready: 0 }])) as Record<ProductionProcess, Share>;
  for (const b of order.barMarks) {
    const through = done.get(b.id);
    for (const p of machinesFor(b)) {
      const s = shares[p];
      s.marks += 1; s.bars += b.bars; s.kg += Number(b.weightKg);
      if (through?.has(p)) s.done += 1;
      else if (p === 'BENDING' && through?.has('CUTTING')) s.ready += 1;
    }
  }
  return shares;
}

/** "Lee, Colin" — whoever has a sheet open on that machine for the order. */
const whoOn = (order: BoardOrder, p: ProductionProcess) =>
  [...new Set(order.productionJobs.filter((j) => j.process === p).map((j) => j.user.name.split(/\s+/)[0]))]
    .map((n) => (n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n)).join(', ');

export function FenderBoard({
  orders, done, viewerId, canStart, startId, sort,
}: {
  orders: BoardOrder[];
  done: Map<string, Set<ProductionProcess>>;
  viewerId: string;
  canStart: boolean;
  startId?: string;
  sort?: string;
}) {
  const withMarks = orders.filter((o) => o.barMarks.length > 0);
  const barsToCut = withMarks.reduce((s, o) => s + o.barMarks.filter((b) => b.status === 'Scheduled').reduce((n, b) => n + b.bars, 0), 0);
  const failed = withMarks.reduce((s, o) => s + o.barMarks.filter((b) => b.qcChecks.some((c) => !c.pass)).length, 0);
  const tonnesOut = withMarks.reduce((s, o) => s + o.barMarks.reduce((n, b) => n + Number(b.weightKg), 0), 0);
  const sortQuery = sort ? `sort=${encodeURIComponent(sort)}` : '';
  const hrefFor = (id?: string) => `/production${id ? `?start=${id}${sortQuery ? `&${sortQuery}` : ''}` : sortQuery ? `?${sortQuery}` : ''}`;
  const picked = orders.find((o) => o.id === startId);

  return (
    <>
      <h2 className="text-lg font-bold mt-8 mb-3">In the yard</h2>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <IconStat icon={Factory} tone="info" value={withMarks.length} label="Cut & bent orders" sub="Approved or in the yard" />
        <IconStat icon={Scissors} tone="violet" value={barsToCut.toLocaleString('en-GB')} label="Bars still to cut" sub="Across those orders" />
        <IconStat icon={Weight} tone="good" value={tonnes(tonnesOut)} label="Tonnage in progress" sub="On those orders" />
        <IconStat
          icon={AlertTriangle} tone={failed ? 'bad' : 'good'} href="/production/checks"
          value={failed} label="Marks out of tolerance" sub={failed ? 'Need an NCR' : 'All checks passing'}
        />
      </div>

      <div id="jobs-for-production" className="flex flex-wrap items-end justify-between gap-3 mb-4 scroll-mt-4">
        <div>
          <h2 className="text-lg font-bold">Jobs for production</h2>
          <p className="text-sm text-ink-muted">Tap a job to start it on the Cutter, Bending or the Stema.</p>
        </div>
        <form className="flex gap-2">
          <SortSelect
            value={sort}
            options={[
              { value: 'delivery', label: 'Delivery soonest' },
              { value: 'number', label: 'Order A-Z' },
              { value: 'customer', label: 'Customer A-Z' },
            ]}
          />
          <button className="btn-secondary btn-sm">Apply</button>
        </form>
      </div>

      {orders.length === 0 ? <Empty title="Nothing approved for production yet." /> : (
        <div className="space-y-6">
          {(['APPROVED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY'] as const).map((stage) => {
            const group = orders.filter((o) => o.stage === stage);
            if (group.length === 0) return null;
            return (
              <section key={stage}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted mb-2">{STAGE[stage]!.label} · {group.length}</h3>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                  {group.map((o) => <OrderCard key={o.id} order={o} shares={sharesFor(o, done)} href={hrefFor(o.id)} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {picked && (
        <StartModal order={picked} shares={sharesFor(picked, done)} viewerId={viewerId} canStart={canStart} closeHref={hrefFor()} />
      )}
    </>
  );
}

function OrderCard({ order, shares, href }: { order: BoardOrder; shares: Record<ProductionProcess, Share>; href: string }) {
  const stage = STAGE[order.stage];
  const kg = order.barMarks.reduce((s, b) => s + Number(b.weightKg), 0);
  const machines = MACHINES.filter((p) => shares[p].marks > 0);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{order.number}</p>
          <p className="text-sm text-ink-muted truncate">{order.customer.name}</p>
        </div>
        {stage && <Pill tone={stage.tone}>{stage.label}</Pill>}
      </div>
      <p className="text-xs text-ink-muted">
        Delivery {shortDate(order.deliveryDate)}{order.barMarks.length > 0 && <> · {order.barMarks.length} bar marks · {tonnes(kg)}</>}
      </p>
      {machines.length === 0 ? (
        <p className="text-sm text-ink-muted">Stock items only — nothing to cut or bend.</p>
      ) : (
        <div className="space-y-2">
          {machines.map((p) => {
            const s = shares[p];
            const on = whoOn(order, p);
            return (
              <div key={p}>
                <div className="flex justify-between gap-2 text-xs">
                  <span className="font-semibold">{MACHINE[p].name}{on && <span className="font-normal text-ink-muted"> · {on} on it</span>}</span>
                  <span className="tabular-nums text-ink-muted">{s.done}/{s.marks}</span>
                </div>
                <div className="h-1.5 rounded-full bg-hairline overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(s.done / s.marks) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
  return machines.length === 0 ? (
    <Link href={`/orders/${order.id}`} className="card min-w-0 p-4 sm:p-5 flex flex-col gap-3 hover:shadow-pop transition-shadow">{body}</Link>
  ) : (
    <Link href={href} scroll={false} className="card min-w-0 p-4 sm:p-5 flex flex-col gap-3 hover:shadow-pop transition-shadow">{body}</Link>
  );
}

function StartModal({
  order, shares, viewerId, canStart, closeHref,
}: { order: BoardOrder; shares: Record<ProductionProcess, Share>; viewerId: string; canStart: boolean; closeHref: string }) {
  const stage = STAGE[order.stage];
  return (
    <UrlModal
      closeHref={closeHref}
      title={(
        <>
          <p className="text-2xl font-bold">{order.number}</p>
          <p className="text-ink-muted">{order.customer.name} · delivery {shortDate(order.deliveryDate)}</p>
          {stage && <div className="mt-2"><Pill tone={stage.tone}>{stage.label}</Pill></div>}
        </>
      )}
    >
      <p className="font-semibold mb-3">Start production on</p>
      <div className="space-y-3">
        {MACHINES.map((p) => {
          const s = shares[p];
          const m = MACHINE[p];
          const finished = s.marks > 0 && s.done === s.marks;
          const mine = order.productionJobs.some((j) => j.process === p && j.userId === viewerId);
          const on = whoOn(order, p);
          const open = canStart && s.marks > 0 && !finished && (order.stage === 'APPROVED' || order.stage === 'IN_PRODUCTION');
          return (
            <div key={p} className={`rounded-2xl border-2 p-4 flex flex-wrap items-center gap-4 ${open ? 'border-hairline' : 'border-hairline bg-canvas opacity-75'}`}>
              <div className="flex-1 min-w-[200px]">
                <p className="text-lg font-bold">{m.name} <span className="text-sm font-semibold text-ink-muted">· {m.sizes}</span></p>
                <p className="text-sm text-ink-muted">{m.does}</p>
                {s.marks === 0 ? (
                  <p className="text-sm mt-1.5">Nothing on this job for the {m.name}.</p>
                ) : (
                  <p className="text-sm mt-1.5">
                    <strong>{s.marks}</strong> bar marks · {s.bars.toLocaleString('en-GB')} bars · {tonnes(s.kg)} · <strong>{s.done}</strong> done
                    {p === 'BENDING' && s.ready > 0 && <> · <strong>{s.ready}</strong> cut and ready to bend</>}
                  </p>
                )}
                {on && <p className="text-sm text-brand-700 font-semibold mt-1">{on} on it</p>}
              </div>
              {finished ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest"><CheckCircle2 size={18} /> All {m.done}</span>
              ) : open && (
                <form action={startOrderProduction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="process" value={p} />
                  <SubmitButton className="btn-primary" pendingLabel="Opening…">
                    {mine ? 'Carry on' : m.start} <ArrowRight size={16} />
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-hairline">
        <a href={`/orders/${order.id}/tally-print`} className="btn-secondary btn-sm">Tally tickets</a>
        <a href={`/orders/${order.id}/bending-ticket`} className="btn-secondary btn-sm">Bending ticket</a>
        <Link href={`/production/checks?order=${order.id}`} className="btn-secondary btn-sm">Record checks</Link>
        <Link href={`/orders/${order.id}`} className="btn-secondary btn-sm">Open order</Link>
      </div>
    </UrlModal>
  );
}
