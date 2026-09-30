import 'server-only';
import { put } from '@vercel/blob';

const PDF_AND_IMAGES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const WORD = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

/** The file a form posted under `field`, or null when none was chosen. */
export function postedFile(formData: FormData, field: string): File | null {
  const file = formData.get(field);
  return file instanceof File && file.size > 0 ? file : null;
}

/**
 * Stores bytes in the private Blob store. The random suffix keeps the
 * address unguessable, since /api/blob-file serves whatever address it's given.
 */
async function storeBytes(bytes: Buffer, name: string, contentType: string, folder: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('File storage is not set up yet — add BLOB_READ_WRITE_TOKEN before uploading.');
  const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '-');
  const blob = await put(`hs/${folder}/${safeName}`, bytes, { access: 'private', addRandomSuffix: true, contentType });
  return { url: blob.url, name };
}

/** An uploaded H&S file: a signed risk assessment or a certificate. */
export async function storeHsFile(file: File, folder: string, { allowWord = false } = {}) {
  const allowed = allowWord ? [...PDF_AND_IMAGES, ...WORD] : PDF_AND_IMAGES;
  if (!allowed.includes(file.type)) {
    throw new Error(allowWord ? 'Only PDF, Word or photo files can be uploaded.' : 'Only PDF or photo files can be uploaded.');
  }
  return storeBytes(Buffer.from(await file.arrayBuffer()), file.name, file.type, folder);
}

/** The photos a form posted as JPEG data URLs, already resized on the phone. */
export function postedPhotoData(formData: FormData, field = 'photoData'): string[] {
  return formData.getAll(field).map(String).filter((s) => s.startsWith('data:image/jpeg;base64,'));
}

export async function storeHsPhoto(dataUrl: string, folder: string, name: string) {
  const bytes = Buffer.from(dataUrl.slice('data:image/jpeg;base64,'.length), 'base64');
  if (bytes.length === 0) throw new Error('A photo could not be read. Try adding it again.');
  return storeBytes(bytes, name, 'image/jpeg', folder);
}
