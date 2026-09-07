export type StatutoryCheck =
  | 'MOT' | 'Road tax' | 'Safety inspection' | 'PUWER inspection' | 'LOLER exam' | 'Service' | 'Measurement calibration';

type LatestCheckLike = { result: 'PASS' | 'FAIL'; items: { critical: boolean; ok: boolean; resolved: boolean }[] } | null | undefined;

/**
 * An asset is out of service when its most recent check flagged a critical
 * item that's still unresolved — an older FAIL doesn't count once a newer
 * check has run (that check itself would have been blocked from being
 * logged in the first place unless the critical issue was resolved first,
 * so a newer check existing at all means the asset was back in service when
 * it was run).
 */
export function isOutOfService(latestCheck: LatestCheckLike): boolean {
  if (!latestCheck || latestCheck.result !== 'FAIL') return false;
  return latestCheck.items.some((i) => i.critical && !i.ok && !i.resolved);
}

/**
 * How many days ahead of a statutory date to start flagging it as due. An
 * HGV failing its annual test is off the road far longer than a pickup
 * would be, so it needs a longer runway to sort a retest; a periodic safety
 * inspection is booked at short notice, so a week's warning is enough.
 * Everything else keeps the original three-week heads-up.
 */
export function alertWindowDays(check: StatutoryCheck, category: string): number {
  if (check === 'Safety inspection') return 7;
  if (check === 'MOT') {
    if (category === 'HGV') return 90;
    if (category === 'Pickup') return 14;
  }
  return 21;
}
