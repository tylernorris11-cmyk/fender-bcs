import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { TrainingBlock } from '@/lib/trainingContent';

/** One block of sectioned training content (see lib/trainingContent), in the app's style. */
export function TrainingBlockView({ block }: { block: TrainingBlock }) {
  switch (block.kind) {
    case 'heading':
      return <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint pt-2">{block.text}</h3>;
    case 'bullets':
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => {
            const never = /^never\b/i.test(item);
            return (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                {never
                  ? <XCircle size={17} className="text-signal shrink-0 mt-0.5" aria-hidden />
                  : <CheckCircle2 size={17} className="text-brand shrink-0 mt-0.5" aria-hidden />}
                <span>{item}</span>
              </li>
            );
          })}
        </ul>
      );
    case 'callout':
      return (
        <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
            <AlertTriangle size={14} aria-hidden /> {block.title}
          </p>
          {block.body && <p className="text-sm text-amber-950 mt-1 leading-relaxed">{block.body}</p>}
        </div>
      );
    case 'chips':
      return (
        <ul className="flex flex-wrap gap-2">
          {block.items.map((item, i) => (
            <li key={i} className="rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-sm font-medium">{item}</li>
          ))}
        </ul>
      );
    case 'never':
      return (
        <ul className="grid gap-2 sm:grid-cols-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-signal/5 px-3 py-2 text-sm font-medium text-signal">
              <XCircle size={17} className="shrink-0 mt-0.5" aria-hidden /> <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'numbered':
      return (
        <ol className="grid gap-2 sm:grid-cols-2">
          {block.items.map((item) => (
            <li key={item.n} className="flex items-center gap-3 rounded-xl border border-hairline px-3 py-2.5">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-forest text-white text-sm font-bold tabular-nums shrink-0">
                {String(item.n).padStart(2, '0')}
              </span>
              <span className="text-sm font-medium">{item.text}</span>
            </li>
          ))}
        </ol>
      );
    case 'details':
      return (
        <dl className="rounded-xl border border-hairline divide-y divide-hairline">
          {block.items.map((item, i) => (
            <div key={i} className="grid sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 px-4 py-2.5 text-sm">
              <dt className="text-ink-muted">{item.label}</dt>
              <dd className="font-medium">{item.value || <span className="italic font-normal text-ink-faint">Ask your supervisor</span>}</dd>
            </div>
          ))}
        </dl>
      );
    case 'text':
      return <p className="text-sm text-ink-muted leading-relaxed">{block.text}</p>;
    case 'note':
      return <p className="text-xs text-ink-faint">{block.text}</p>;
  }
}
