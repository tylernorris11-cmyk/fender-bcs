/**
 * Training content is a list of lines (TrainingModule.content). Plain lines
 * are bullet points, which is all most modules use. A longer document like
 * the yard induction marks its lines up with a short prefix so it can be
 * laid out in sections, still edited as plain text in Manage training:
 *
 *   ## Section title | subtitle
 *   ### Group heading
 *   ! Callout title | callout text
 *   + Chip (a short item shown as a tag, e.g. a piece of PPE)
 *   x Something you must never do
 *   1. A numbered rule
 *   = Label | value (left blank, it reads "Ask your supervisor")
 *   [] A declaration point the person must tick to complete it
 *   > A plain paragraph
 *   * Small print
 *
 * Anything else is a bullet point.
 */

export type TrainingBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'callout'; title: string; body: string }
  | { kind: 'chips'; items: string[] }
  | { kind: 'never'; items: string[] }
  | { kind: 'numbered'; items: { n: number; text: string }[] }
  | { kind: 'details'; items: { label: string; value: string }[] }
  | { kind: 'text'; text: string }
  | { kind: 'note'; text: string };

export type TrainingSection = { title: string; subtitle: string; blocks: TrainingBlock[] };
/** `declarationSection` is the section the [] points sit in (null: after the last one), and
 * `declarationAt` how many of that section's blocks come before them. */
export type ParsedTraining = {
  intro: TrainingBlock[];
  sections: TrainingSection[];
  declarations: string[];
  declarationSection: number | null;
  declarationAt: number;
};

/** Content laid out in sections, rather than a plain list of points. */
export const isStructuredTraining = (lines: string[]) => lines.some((l) => l.trim().startsWith('## '));

/** The points someone must tick before they can complete the module. */
export const declarationsIn = (lines: string[]) =>
  lines.map((l) => l.trim()).filter((l) => l.startsWith('[] ')).map((l) => l.slice(3).trim()).filter(Boolean);

const pair = (s: string) => {
  const i = s.indexOf('|');
  return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
};

export function parseTrainingContent(lines: string[]): ParsedTraining {
  const intro: TrainingBlock[] = [];
  const sections: TrainingSection[] = [];
  const declarations: string[] = [];
  let declarationSection: number | null = null;
  let declarationAt = 0;
  const target = () => (sections.length ? sections[sections.length - 1].blocks : intro);

  // Consecutive items of the same list kind join into one block.
  function pushItem<K extends 'bullets' | 'chips' | 'never'>(kind: K, item: string) {
    const blocks = target();
    const last = blocks[blocks.length - 1];
    if (last?.kind === kind) (last as { items: string[] }).items.push(item);
    else blocks.push({ kind, items: [item] } as TrainingBlock);
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      const [title, subtitle] = pair(line.slice(3));
      sections.push({ title, subtitle, blocks: [] });
    } else if (line.startsWith('### ')) {
      target().push({ kind: 'heading', text: line.slice(4).trim() });
    } else if (line.startsWith('! ')) {
      const [title, body] = pair(line.slice(2));
      target().push({ kind: 'callout', title, body });
    } else if (line.startsWith('+ ')) {
      pushItem('chips', line.slice(2).trim());
    } else if (/^x\s/i.test(line)) {
      pushItem('never', line.slice(2).trim());
    } else if (/^\d+\.\s/.test(line)) {
      const n = Number(line.match(/^\d+/)![0]);
      const text = line.replace(/^\d+\.\s+/, '');
      const blocks = target();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'numbered') last.items.push({ n, text });
      else blocks.push({ kind: 'numbered', items: [{ n, text }] });
    } else if (line.startsWith('= ')) {
      const [label, value] = pair(line.slice(2));
      const blocks = target();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'details') last.items.push({ label, value });
      else blocks.push({ kind: 'details', items: [{ label, value }] });
    } else if (line.startsWith('[] ')) {
      declarations.push(line.slice(3).trim());
      if (declarationSection == null && sections.length) {
        declarationSection = sections.length - 1;
        declarationAt = sections[declarationSection].blocks.length;
      }
    } else if (line.startsWith('> ')) {
      target().push({ kind: 'text', text: line.slice(2).trim() });
    } else if (line.startsWith('* ')) {
      target().push({ kind: 'note', text: line.slice(2).trim() });
    } else {
      pushItem('bullets', line.replace(/^-\s+/, ''));
    }
  }
  return { intro, sections, declarations, declarationSection, declarationAt };
}
