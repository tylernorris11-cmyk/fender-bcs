import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { isPrivateBlobUrl } from '@/lib/blob';

/** Streams a private Blob file back to a signed-in, permitted user. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(can(user, 'compliance.view') || can(user, 'production.view'))) {
    return new NextResponse('Not authorized', { status: 403 });
  }

  const url = new URL(request.url).searchParams.get('url');
  if (!url || !isPrivateBlobUrl(url)) return new NextResponse('Not found', { status: 404 });

  const result = await get(url, { access: 'private' });
  if (!result || result.statusCode !== 200) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      'content-type': result.blob.contentType,
      'content-disposition': result.blob.contentDisposition,
    },
  });
}
