import Image from 'next/image';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { COMPANY_LABEL, getActiveCompany } from '@/lib/company';
import { isStructuredTraining, parseTrainingContent, type TrainingBlock } from '@/lib/trainingContent';
import { PrintActions } from '@/components/PrintActions';

const Line = ({ label }: { label: string }) => (
  <div>
    <div className="border-b border-black/40 h-8" />
    <p className="text-[11px] text-black/60 mt-1">{label}</p>
  </div>
);

function PrintBlock({ block }: { block: TrainingBlock }) {
  switch (block.kind) {
    case 'heading':
      return <h4 className="font-bold text-[12px] mt-3 mb-1">{block.text}</h4>;
    case 'bullets':
      return <ul className="list-disc pl-5 space-y-0.5">{block.items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
    case 'callout':
      return (
        <div className="border-l-4 border-black/60 bg-black/[0.04] px-3 py-2 my-2 break-inside-avoid">
          <p className="font-bold uppercase tracking-wide text-[11px]">{block.title}</p>
          {block.body && <p>{block.body}</p>}
        </div>
      );
    case 'chips':
      return <p>{block.items.join('  •  ')}</p>;
    case 'never':
      return <ul className="grid grid-cols-2 gap-x-6">{block.items.map((t, i) => <li key={i}>✕ {t}</li>)}</ul>;
    case 'numbered':
      return (
        <ol className="grid grid-cols-2 gap-x-6 gap-y-1">
          {block.items.map((r) => <li key={r.n}><span className="font-bold tabular-nums">{String(r.n).padStart(2, '0')}</span>  {r.text}</li>)}
        </ol>
      );
    case 'details':
      return (
        <table className="w-full my-1">
          <tbody>
            {block.items.map((d, i) => (
              <tr key={i} className="border-b border-black/20">
                <td className="py-2 pr-4 w-60 text-black/60 align-bottom">{d.label}</td>
                <td className="py-2 align-bottom">{d.value || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'text':
      return <p>{block.text}</p>;
    case 'note':
      return <p className="text-[11px] text-black/60">{block.text}</p>;
  }
}

/** A paper copy of a training module. The yard induction prints like the controlled induction document, ready to sign. */
export default async function TrainingPrint({ params }: { params: { id: string } }) {
  const user = await requirePermission('hs.view');
  const company = getActiveCompany(user);
  const m = await db.trainingModule.findUnique({ where: { id: params.id } });
  if (!m || !m.active || (m.company && !user.companies.includes(m.company))) notFound();
  const isFender = company === 'FENDER';
  const parsed = isStructuredTraining(m.content) ? parseTrainingContent(m.content) : null;

  const declaration = parsed && parsed.declarations.length > 0 && (
    <div className="my-2 space-y-1">
      {parsed.declarations.map((d, i) => <p key={i}><span className="inline-block w-4 h-4 border border-black/60 mr-2 align-[-3px]" />{d}</p>)}
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      <PrintActions maxWidth={950} />
      <div className="p-10 max-w-[950px] mx-auto text-[12.5px] leading-snug text-black">
        <div className="flex justify-between items-start border-b-2 pb-4 mb-6" style={{ borderColor: isFender ? 'rgb(13,74,66)' : 'rgb(230,126,34)' }}>
          {isFender ? (
            <Image src="/fender-logo.png" alt="Fender" width={170} height={119} priority className="w-[170px] h-auto" />
          ) : (
            <span className="inline-block bg-[rgb(23,20,15)] rounded-md px-3 py-2">
              <Image src="/bcs-logo.png" alt="BCS Products" width={140} height={113} priority className="w-[140px] h-auto" />
            </span>
          )}
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-black/60">Health &amp; safety{parsed ? ' · controlled induction document' : ''}</p>
            <h1 className="text-xl font-bold">{m.title}</h1>
          </div>
        </div>

        {m.summary && <p className="mb-4">{m.summary}</p>}

        {parsed ? (
          <>
            <div className="grid grid-cols-3 gap-8 mb-6">
              <div>
                <div className="border-b border-black/40 h-8 flex items-end pb-1">{COMPANY_LABEL[company]}</div>
                <p className="text-[11px] text-black/60 mt-1">Company / site</p>
              </div>
              <Line label="Inductee name" />
              <Line label="Induction date" />
            </div>
            {parsed.intro.map((b, i) => <PrintBlock key={i} block={b} />)}
            {parsed.sections.map((s, i) => {
              const here = parsed.declarationSection === i;
              const before = here ? s.blocks.slice(0, parsed.declarationAt) : s.blocks;
              const after = here ? s.blocks.slice(parsed.declarationAt) : [];
              return (
                <section key={i} className={`mt-6 ${here ? 'break-before-page' : ''}`}>
                  <h2 className="text-base font-bold border-b border-black/30 pb-1 mb-2 break-after-avoid">
                    <span className="tabular-nums mr-2">{String(i + 1).padStart(2, '0')}</span>{s.title}
                  </h2>
                  {s.subtitle && <p className="italic text-black/70 mb-2">{s.subtitle}</p>}
                  {before.map((b, j) => <PrintBlock key={j} block={b} />)}
                  {here && declaration}
                  {after.map((b, j) => <PrintBlock key={`a${j}`} block={b} />)}
                </section>
              );
            })}
            {parsed.declarationSection == null && declaration}
          </>
        ) : (
          <ul className="list-disc pl-5 space-y-1">{m.content.map((l, i) => <li key={i}>{l}</li>)}</ul>
        )}

        <div className="mt-10 break-inside-avoid">
          <h3 className="font-bold uppercase tracking-wide text-[11px] mb-2">Sign-off</h3>
          <div className="grid grid-cols-2 gap-x-10 gap-y-6">
            <Line label="Inductee name" />
            <Line label="Inductee signature / date" />
            <Line label="Induction delivered by" />
            <Line label="Trainer signature / date" />
          </div>
        </div>
      </div>
    </div>
  );
}
