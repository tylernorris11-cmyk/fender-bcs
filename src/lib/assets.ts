export type StatutoryCheck =
  | 'MOT' | 'Road tax' | 'Safety inspection' | 'PUWER inspection' | 'LOLER exam' | 'Service' | 'Measurement calibration';

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
