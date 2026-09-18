import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { isPrivateBlobUrl } from '@/lib/blob';

/**
 * Streams a private Blob file back to a signed-in, permitted user. Plain
 * link: opens inline (whatever disposition it was uploaded with). Add
 * `download=1` to force a Save As instead — `name` lets the caller give it
 * a friendlier filename than whatever it was uploaded as (e.g. the
 * document's current title after a rename, not its original file name).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(can(user, 'compliance.view') || can(user, 'production.view') || can(user, 'stock.view') || can(user, 'hs.view'))) {
    return new NextResponse('Not authorized', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url || !isPrivateBlobUrl(url)) return new NextResponse('Not found', { status: 404 });

  const result = await get(url, { access: 'private' });
  if (!result || result.statusCode !== 200) return new NextResponse('Not found', { status: 404 });

  let disposition = result.blob.contentDisposition;
  if (searchParams.get('download') === '1') {
    const name = searchParams.get('name');
    const safeName = (name || 'download').replace(/[/\\?%*:|"<>]/g, '-');
    disposition = `attachment; filename="${safeName}"`;
  }

  return new NextResponse(result.stream, {
    headers: {
      'content-type': result.blob.contentType,
      'content-disposition': disposition,
    },
  });
}
