import 'server-only';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export type DetectedCircle = { x: number; y: number; r: number }; // all 0–1, normalized by width (r too, so it never distorts into an ellipse)

// Fallback only, used when the worker's own bar-size calibration (see
// below) isn't available for some reason. Tuned against one real yard photo
// with a genuine, verified ground-truth count (112, via a dedicated
// object-counting app). That tuning turned out to be specific to how that
// one photo happened to be framed — a second, more tightly cropped photo of
// the exact same bundle (same true count, 112) came out at 17 with these
// same numbers, because the bars occupy a very different fraction of the
// frame once the crop changes. A fixed size-fraction assumption can't
// account for that, which is why calibration exists at all now.
const DP = 1;
const BLUR_KERNEL = 7; // a touch more smoothing to suppress rust/dirt texture noise
const PARAM1 = 50; // Canny high threshold
const PARAM2 = 27; // accumulator threshold — higher is stricter
const MIN_DIST_FRACTION = 0.04; // min gap between circle centers, as a fraction of the smaller image dimension
const MIN_RADIUS_FRACTION = 0.014;
const MAX_RADIUS_FRACTION = 0.065;

// Used instead of the fixed fractions above whenever the worker has dragged
// across one bar end to show its size. Validated against two real photos of
// the same bundle (same true count, very different framing/crop): with the
// actual bar radius as the input, this combination lands at 131 and 67
// respectively against a true count of 112 on each — not exact, but in the
// right ballpark on both, unlike any single fixed-fraction setting tried
// (which ranged from a 2x overcount to an 85% undercount depending which
// photo). Bars naturally vary somewhat in apparent size even within one
// photo (real diameter variation, perspective, imperfect edges), so the
// search band is deliberately wide around the calibrated point rather than
// tight — a tight band around the same center undercounted badly in testing.
const CALIB_PARAM2 = 26;
const CALIB_MIN_RADIUS_MULT = 0.3;
const CALIB_MAX_RADIUS_MULT = 1.75;
const CALIB_MIN_DIST_MULT = 1.2;

// HoughCircles' cost blows up with edge count × radius search range — fine
// on a clean synthetic test image, but a real yard photo (rust texture,
// hundreds of tightly packed ends, dirt) has vastly more edge pixels and
// can hang for minutes at full upload resolution (confirmed against a real
// photo: a 2200px-wide bundle-end photo never returned inside several
// minutes). Hough only needs enough resolution to tell circles apart, not
// upload resolution, so run it on a smaller working copy — circle
// coordinates come out already normalized (0–1), so no rescaling back up
// is needed.
const DETECTION_MAX_DIM = 1000;
// Absolute backstop in case some other photo is still slow even at that
// size — fail with a clear error instead of hanging the request forever.
const DETECTION_TIMEOUT_MS = 20_000;

let cvReady: Promise<typeof import('@techstark/opencv-js')> | null = null;

/** opencv.js's WASM runtime takes a moment to initialize — cache the ready
 * promise at module scope so a warm serverless instance only pays for it once. */
async function getCv() {
  if (!cvReady) {
    cvReady = (async () => {
      const cvModule = await import('@techstark/opencv-js');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cv = ((cvModule as { default?: unknown }).default ?? cvModule) as any;
      // The package's own export is itself a promise that resolves once the
      // WASM runtime is ready — await it before checking readiness, or the
      // fallback below waits on the wrong object and never resolves.
      if (cv && typeof cv.then === 'function') cv = await cv;
      if (typeof cv.getBuildInformation !== 'function') {
        await new Promise<void>((resolve) => { cv.onRuntimeInitialized = resolve; });
      }
      return cv;
    })();
  }
  return cvReady;
}

function decodeToRgba(bytes: Buffer, mimeType: string): { data: Uint8Array; width: number; height: number } {
  if (mimeType === 'image/jpeg') {
    const decoded = jpeg.decode(bytes, { useTArray: true });
    return { data: decoded.data, width: decoded.width, height: decoded.height };
  }
  if (mimeType === 'image/png') {
    const png = PNG.sync.read(bytes);
    return { data: png.data, width: png.width, height: png.height };
  }
  throw new Error(`Unsupported image type for detection: ${mimeType}. Upload a JPEG or PNG.`);
}

async function runDetection(
  bytes: Buffer, mimeType: string, calibratedRadiusFraction?: number,
): Promise<{ circles: DetectedCircle[]; width: number; height: number }> {
  const { data, width, height } = decodeToRgba(bytes, mimeType);
  const cv = await getCv();

  const mat = new cv.Mat(height, width, cv.CV_8UC4);
  mat.data.set(data);

  // Downscale the working copy for Hough — see DETECTION_MAX_DIM's comment.
  // Coordinates come out already normalized against whatever size Hough
  // actually ran on, so this needs no rescaling back to the original.
  const scale = Math.min(1, DETECTION_MAX_DIM / Math.max(width, height));
  const workW = Math.max(1, Math.round(width * scale));
  const workH = Math.max(1, Math.round(height * scale));
  const resized = scale < 1 ? new cv.Mat() : null;
  if (resized) cv.resize(mat, resized, new cv.Size(workW, workH), 0, 0, cv.INTER_AREA);
  const working = resized ?? mat;

  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const detected = new cv.Mat();
  try {
    cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);
    cv.medianBlur(gray, blurred, BLUR_KERNEL);

    const minDim = Math.min(workW, workH);
    if (calibratedRadiusFraction && calibratedRadiusFraction > 0) {
      const calibR = calibratedRadiusFraction * workW;
      const minR = Math.max(1, Math.round(calibR * CALIB_MIN_RADIUS_MULT));
      const maxR = Math.max(minR + 1, Math.round(calibR * CALIB_MAX_RADIUS_MULT));
      cv.HoughCircles(
        blurred, detected, cv.HOUGH_GRADIENT,
        DP, Math.max(1, Math.round(calibR * CALIB_MIN_DIST_MULT)), PARAM1, CALIB_PARAM2, minR, maxR,
      );
    } else {
      cv.HoughCircles(
        blurred, detected, cv.HOUGH_GRADIENT,
        DP,
        Math.max(1, Math.round(minDim * MIN_DIST_FRACTION)),
        PARAM1,
        PARAM2,
        Math.max(1, Math.round(minDim * MIN_RADIUS_FRACTION)),
        Math.max(2, Math.round(minDim * MAX_RADIUS_FRACTION)),
      );
    }

    const circles: DetectedCircle[] = [];
    for (let i = 0; i < detected.cols; i++) {
      const x = detected.data32F[i * 3];
      const y = detected.data32F[i * 3 + 1];
      const r = detected.data32F[i * 3 + 2];
      circles.push({ x: x / workW, y: y / workH, r: r / workW });
    }
    return { circles, width, height };
  } finally {
    mat.delete(); resized?.delete(); gray.delete(); blurred.delete(); detected.delete();
  }
}

/** calibratedRadiusFraction, when given, is the radius the worker indicated
 * by dragging across one bar end, as a fraction of the photo's own width —
 * same normalization as a DetectedCircle's own x/y/r. Falls back to the
 * fixed-fraction defaults above if omitted. */
export async function detectBarCircles(
  bytes: Buffer, mimeType: string, calibratedRadiusFraction?: number,
): Promise<{ circles: DetectedCircle[]; width: number; height: number; error?: string }> {
  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Detection took too long on this photo — try Both/AI estimate, or crop closer to the bundle end and retake it.')), DETECTION_TIMEOUT_MS);
    });
    return await Promise.race([runDetection(bytes, mimeType, calibratedRadiusFraction), timeout]);
  } catch (err) {
    return { circles: [], width: 0, height: 0, error: err instanceof Error ? err.message : 'Unknown error detecting circles.' };
  }
}
