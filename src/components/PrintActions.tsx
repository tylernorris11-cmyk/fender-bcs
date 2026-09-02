'use client';

import { Download, Printer } from 'lucide-react';

/**
 * Both buttons just open the browser's native print dialog — "Download PDF"
 * is really "Save as PDF" from that same dialog, made obvious for anyone who
 * wouldn't otherwise think to look for it. Hidden from the printed page
 * itself via print:hidden, since it's page chrome, not the document.
 */
export function PrintActions({ maxWidth = 900 }: { maxWidth?: number }) {
  return (
    <div className="print:hidden flex justify-end gap-2 mx-auto pt-6 px-10" style={{ maxWidth }}>
      <button type="button" onClick={() => window.print()} className="btn-secondary">
        <Download size={16} /> Download PDF
      </button>
      <button type="button" onClick={() => window.print()} className="btn-primary">
        <Printer size={16} /> Print
      </button>
    </div>
  );
}
