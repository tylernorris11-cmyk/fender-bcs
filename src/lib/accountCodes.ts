/**
 * Exchequer account codes: up to 6 letters and numbers, e.g. FARN01. Typed
 * everywhere instead of a name, so they're kept short and upper case.
 */
export function readAccountCode(raw: FormDataEntryValue | null): string {
  const code = String(raw ?? '').trim().toUpperCase();
  if (code && !/^[A-Z0-9]{1,6}$/.test(code)) {
    throw new Error('Account codes are up to 6 letters and numbers, with no spaces, like FARN01.');
  }
  return code;
}

/**
 * The code Exchequer would usually suggest: the first four letters of the
 * name and the next free two-digit number, e.g. Farnell → FARN01.
 */
export async function suggestAccountCode(name: string, isTaken: (code: string) => Promise<boolean>): Promise<string> {
  const stem = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  for (let n = 1; n <= 99; n++) {
    const candidate = `${stem}${String(n).padStart(2, '0')}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`Every ${stem} code up to ${stem}99 is taken. Type one in instead.`);
}
