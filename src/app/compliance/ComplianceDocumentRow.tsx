'use client';

import { useState } from 'react';
import { Download, FileText, Pencil } from 'lucide-react';
import { blobFileHref } from '@/lib/blob';
import { Pill } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { archiveComplianceDocument, renameComplianceDocument } from './actions';

export type ComplianceDocumentRowData = {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string;
  categoryLabel: string;
  uploadedByName: string;
  uploadedLabel: string;
};

/** Extension from the file it was originally uploaded as, so a renamed download still opens correctly. */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot);
}

export function ComplianceDocumentRow({ doc, canEdit }: { doc: ComplianceDocumentRowData; canEdit: boolean }) {
  const [renaming, setRenaming] = useState(false);
  const downloadHref = `/api/blob-file?url=${encodeURIComponent(doc.fileUrl)}&download=1&name=${encodeURIComponent(doc.title + extensionOf(doc.fileName))}`;

  return (
    <li className="py-4 flex flex-wrap items-center gap-4">
      <span className="inline-grid place-items-center h-10 w-10 rounded-xl bg-teal-100 text-teal-700 shrink-0">
        <FileText size={18} />
      </span>

      <div className="flex-1 min-w-[200px]">
        {renaming ? (
          <form
            action={async (formData) => {
              await renameComplianceDocument(formData);
              setRenaming(false);
            }}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="id" value={doc.id} />
            <input name="title" defaultValue={doc.title} required autoFocus className="input py-1.5 flex-1 min-w-[160px]" />
            <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
            <button type="button" onClick={() => setRenaming(false)} className="btn-secondary btn-sm">Cancel</button>
          </form>
        ) : (
          <>
            <a href={blobFileHref(doc.fileUrl)} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
              {doc.title}
            </a>
            <p className="text-xs text-ink-faint mt-0.5">{doc.uploadedByName} · {doc.uploadedLabel}</p>
          </>
        )}
      </div>

      {!renaming && (
        <>
          <Pill tone="neutral">{doc.categoryLabel}</Pill>
          <a href={downloadHref} className="btn-secondary btn-sm"><Download size={14} /> Download</a>
          {canEdit && (
            <button type="button" onClick={() => setRenaming(true)} className="btn-secondary btn-sm">
              <Pencil size={14} /> Rename
            </button>
          )}
          {canEdit && (
            <form action={archiveComplianceDocument}>
              <input type="hidden" name="id" value={doc.id} />
              <SubmitButton className="btn-secondary btn-sm" pendingLabel="Archiving…">Archive</SubmitButton>
            </form>
          )}
        </>
      )}
    </li>
  );
}
