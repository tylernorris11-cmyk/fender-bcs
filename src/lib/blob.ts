/**
 * Mill certs are internal compliance documents, so uploads go to a private
 * Vercel Blob store rather than a public one — the blob URL alone can't be
 * fetched without the store's token. Anywhere a stored fileUrl is linked in
 * the UI, route it through /api/blob-file instead of using it directly.
 * Manually-pasted external links (Google Drive etc.) are untouched.
 */
export const isPrivateBlobUrl = (url: string) => url.includes('.private.blob.vercel-storage.com/');

export const blobFileHref = (url: string) =>
  isPrivateBlobUrl(url) ? `/api/blob-file?url=${encodeURIComponent(url)}` : url;
