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

// ---- Watershed segmentation ------------------------------------------------
// HoughCircles above assumes each bar end is a roughly isolated circular
// edge — real bundles pack bar ends tight enough that neighbouring ends
// often touch or overlap in the photo, and that's exactly where Hough
// merges or drops detections (the failure mode a fixed accumulator
// threshold can't tune its way out of, whichever photo it's tuned against).
//
// Watershed instead treats the whole bundle-end blob as one region and
// splits it at the "ridges" between bars using a distance transform: a
// pixel's distance to the nearest background pixel dips right at the point
// two bars meet, even when their edges are fused in the photo, so each bar
// still gets its own peak to seed from. That's a structurally different way
// of handling touching circles than anything already tried this session
// (fixed-fraction tuning, manual calibration, AI estimation) — it doesn't
// replace the circle detector, it's a second opinion to compare against it.
//
// Validated against the same two real photos referenced above (same
// bundle, same true count of 112, very different framing/crop). A first
// pass using a single global (Otsu) threshold to separate the bar-end blob
// from the background performed badly — 84 at best on either photo, falling
// as low as 12 — because a real yard photo's background (dirt, a bright
// yellow rack, sky) isn't a uniform brightness the bar ends cleanly stand
// out from, unlike the plain-background test images the textbook watershed
// coin-counting approach assumes. Switching to a local/adaptive threshold
// (see runWatershedDetection) fixed that: with the settings below it lands
// at 110 and 84 against the true 112 — not exact, but a closer, more
// consistent result than the fixed-fraction Hough settings ever got on the
// same two photos (131 and a 67 that undercounted by 40%).
const WATERSHED_SEED_RADIUS_FRACTION = 0.3; // a pixel seeds its own bar once its distance from the nearest background pixel exceeds this fraction of the calibrated bar radius
const WATERSHED_MIN_AREA_FRACTION = 0.25; // discard fragments smaller than this fraction of one calibrated bar's expected area — noise and edge slivers, not real bars
const WATERSHED_OPEN_KERNEL = 3; // structuring element size for the noise-removal opening pass
const WATERSHED_BG_DILATE_ITER = 3; // how far to grow the "definitely background" region away from the bar blob
const WATERSHED_ADAPTIVE_BLOCK_MULT = 6; // adaptive-threshold neighbourhood size, as a multiple of the calibrated bar radius — wide enough to span a lighting gradient across several bars, narrow enough not to wash out the difference between one bar and its neighbour
const WATERSHED_ADAPTIVE_C = -2; // adaptiveThreshold's constant offset — slightly negative so the local mean itself doesn't get classified as foreground (a real gap between bars stays background even under a fairly flat local gradient)

async function runWatershedDetection(
  bytes: Buffer, mimeType: string, calibratedRadiusFraction: number,
): Promise<{ circles: DetectedCircle[]; width: number; height: number }> {
  if (!(calibratedRadiusFraction > 0)) {
    throw new Error('Drag across one bar end to show its size before running watershed detection.');
  }

  const { data, width, height } = decodeToRgba(bytes, mimeType);
  const cv = await getCv();

  const mat = new cv.Mat(height, width, cv.CV_8UC4);
  mat.data.set(data);

  // Same working-resolution downscale as the Hough path, for the same
  // reason — full upload resolution isn't needed to tell bars apart, and
  // costs real time on a big photo.
  const scale = Math.min(1, DETECTION_MAX_DIM / Math.max(width, height));
  const workW = Math.max(1, Math.round(width * scale));
  const workH = Math.max(1, Math.round(height * scale));
  const resized = scale < 1 ? new cv.Mat() : null;
  if (resized) cv.resize(mat, resized, new cv.Size(workW, workH), 0, 0, cv.INTER_AREA);
  const working = resized ?? mat;

  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const binary = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(WATERSHED_OPEN_KERNEL, WATERSHED_OPEN_KERNEL));
  const opened = new cv.Mat();
  const sureBg = new cv.Mat();
  const dist = new cv.Mat();
  const sureFg = new cv.Mat();
  const sureFg8 = new cv.Mat();
  const unknown = new cv.Mat();
  const markers = new cv.Mat();
  const colorMat = new cv.Mat();
  try {
    cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);
    cv.medianBlur(gray, blurred, BLUR_KERNEL);
    // A single global threshold (Otsu) assumes the whole photo splits
    // cleanly into "bar ends" vs "everything else" at one brightness level
    // — true for a lab photo on a plain background, not for a busy yard
    // photo where the background itself spans a wide brightness range (see
    // the comment above these constants). Thresholding against each pixel's
    // local neighbourhood instead keeps the split meaningful across the
    // photo's own lighting gradient.
    const calibRpxForThreshold = calibratedRadiusFraction * workW;
    let adaptiveBlockSize = Math.round(calibRpxForThreshold * WATERSHED_ADAPTIVE_BLOCK_MULT);
    if (adaptiveBlockSize % 2 === 0) adaptiveBlockSize += 1; // adaptiveThreshold requires an odd block size
    if (adaptiveBlockSize < 11) adaptiveBlockSize = 11;
    cv.adaptiveThreshold(
      blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY,
      adaptiveBlockSize, WATERSHED_ADAPTIVE_C,
    );
    cv.morphologyEx(binary, opened, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 2);
    cv.dilate(opened, sureBg, kernel, new cv.Point(-1, -1), WATERSHED_BG_DILATE_ITER);

    cv.distanceTransform(opened, dist, cv.DIST_L2, 5);
    // Thresholding relative to the calibrated radius (rather than a
    // fraction of this photo's single largest distance value, the usual
    // textbook approach) keeps the seed threshold tied to a known
    // real-world bar size instead of whatever the biggest touching cluster
    // in this particular photo happens to look like.
    const calibR = calibratedRadiusFraction * workW;
    cv.threshold(dist, sureFg, calibR * WATERSHED_SEED_RADIUS_FRACTION, 255, cv.THRESH_BINARY);
    sureFg.convertTo(sureFg8, cv.CV_8U);
    cv.subtract(sureBg, sureFg8, unknown);

    cv.connectedComponents(sureFg8, markers, 8, cv.CV_32S);
    const markerData: Int32Array = markers.data32S;
    const unknownData: Uint8Array = unknown.data;
    for (let i = 0; i < markerData.length; i++) {
      markerData[i] += 1; // connectedComponents' background label 0 becomes 1, so it reads as "known background" rather than "unlabeled" to watershed
      if (unknownData[i] === 255) markerData[i] = 0; // 0 marks the region watershed still has to resolve
    }

    cv.cvtColor(working, colorMat, cv.COLOR_RGBA2RGB);
    cv.watershed(colorMat, markers);

    // watershed's output isn't binary, so connectedComponents can't run on
    // it a second time to get per-bar stats — accumulate centroid and area
    // per label directly from the final markers matrix instead.
    const sums = new Map<number, { sx: number; sy: number; n: number }>();
    for (let y = 0; y < workH; y++) {
      for (let x = 0; x < workW; x++) {
        const label = markerData[y * workW + x];
        if (label <= 1) continue; // 1 = background, -1 = watershed boundary line
        const entry = sums.get(label);
        if (entry) { entry.sx += x; entry.sy += y; entry.n += 1; }
        else sums.set(label, { sx: x, sy: y, n: 1 });
      }
    }

    const expectedArea = Math.PI * calibR * calibR;
    const minArea = expectedArea * WATERSHED_MIN_AREA_FRACTION;
    const circles: DetectedCircle[] = [];
    for (const { sx, sy, n } of sums.values()) {
      if (n < minArea) continue;
      const r = Math.sqrt(n / Math.PI); // area-equivalent radius — watershed regions aren't perfect circles, so this is the closest single number to report
      circles.push({ x: sx / n / workW, y: sy / n / workH, r: r / workW });
    }
    return { circles, width, height };
  } finally {
    mat.delete(); resized?.delete(); gray.delete(); blurred.delete(); binary.delete();
    kernel.delete(); opened.delete(); sureBg.delete(); dist.delete(); sureFg.delete(); sureFg8.delete();
    unknown.delete(); markers.delete(); colorMat.delete();
  }
}

/** Same contract as detectBarCircles, but segments the bundle-end blob with
 * watershed instead of Hough — see the comment above runWatershedDetection
 * for why, and for its unvalidated-against-a-real-photo caveat. Unlike the
 * Hough path, calibratedRadiusFraction is required: watershed's seed
 * threshold and noise filter are both expressed relative to it, and there's
 * no fixed-fraction fallback that would mean anything across differently
 * framed photos (the same problem that motivated calibration in the first
 * place). */
export async function detectBarCirclesWatershed(
  bytes: Buffer, mimeType: string, calibratedRadiusFraction: number,
): Promise<{ circles: DetectedCircle[]; width: number; height: number; error?: string }> {
  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Detection took too long on this photo — try Both/AI estimate, or crop closer to the bundle end and retake it.')), DETECTION_TIMEOUT_MS);
    });
    return await Promise.race([runWatershedDetection(bytes, mimeType, calibratedRadiusFraction), timeout]);
  } catch (err) {
    return { circles: [], width: 0, height: 0, error: err instanceof Error ? err.message : 'Unknown error detecting circles.' };
  }
}
