/**
 * A printable ruler for lining up the real pre-printed tally stock — the
 * photographed FenderBcs Group / DURA-ID label roll has its own boxes
 * (JOB No., CUSTOMER, BMK, QUANTITY, LENGTH, DIAMETER, SHAPE CODE, A, B, C,
 * D, E/R, DESTINATION, WEIGHT) in positions this app never had a way to
 * measure — the reference PDF turned out to be a different layout. Rather
 * than guess from a photo, print this on the same stock: the top two rows
 * give an exact column ruler (read the tens digit then the units digit
 * stacked for any column), and every line below is numbered so a box's
 * position can be read directly as "line 7, column 23" and reported back.
 */
const WIDTH = 100;
const NUMBERED_LINES = 24; // generous for an 18-line ticket, so anything running onto the next one is visible too

export function buildCalibrationLines(): string[] {
  let tens = '';
  let units = '';
  for (let i = 0; i < WIDTH; i++) {
    tens += i % 10 === 0 ? String(Math.floor(i / 10) % 10) : ' ';
    units += String(i % 10);
  }

  const lines = [tens, units];
  for (let n = 1; n <= NUMBERED_LINES; n++) {
    lines.push(String(n).padStart(2, '0'));
  }
  return lines;
}
