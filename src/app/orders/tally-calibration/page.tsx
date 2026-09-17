import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { buildCalibrationLines } from '@/lib/tallyCalibration';
import { PrintActions } from '@/components/PrintActions';

/**
 * Print this onto the real tally stock (same printer, same stationery) to
 * read off exactly where each pre-printed box sits — see tallyCalibration.ts
 * for how to use it. Not tied to an order; it's a one-off measuring tool.
 * Master Administrator only, not gated by a regular permission.
 */
export default async function TallyCalibrationPage() {
  const user = await requireUser();
  if (user.role !== 'MASTER_ADMIN') redirect('/no-access?needed=Master%20Administrator');
  const lines = buildCalibrationLines();

  return (
    <div className="bg-white min-h-screen">
      <style>{'@page { margin: 0; } body { margin: 0; }'}</style>
      <PrintActions maxWidth={700} />

      <div className="print:hidden max-w-[700px] mx-auto px-10 pt-2 text-sm text-ink-muted">
        Print this on the real tally stock, then for each box on the form note the line number (down the left) and
        column number (top ruler — read the tens digit above the units digit) where it starts. Send those back and
        the real layout can be built from them.
      </div>

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
    </div>
  );
}
