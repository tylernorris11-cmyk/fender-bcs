import 'server-only';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export type DetectedCircle = { x: number; y: number; r: number }; // all 0–1, normalized by width (r too, so it never distorts into an ellipse)

// Starting points only — real tuning needs real yard photos (lighting,
// bar-end contrast, how tightly the bundle is packed). Proven against a
// synthetic test image in dev; see the Bar Counter plan's verification
// section for what's still deferred.
const DP = 1;
const PARAM1 = 50; // Canny high threshold
const PARAM2 = 15; // accumulator threshold — lower finds more circles, incl. more false positives
const MIN_DIST_FRACTION = 0.03; // min gap between circle centers, as a fraction of the smaller image dimension
const MIN_RADIUS_FRACTION = 0.01;
const MAX_RADIUS_FRACTION = 0.08;

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

export async function detectBarCircles(
  bytes: Buffer, mimeType: string,
): Promise<{ circles: DetectedCircle[]; width: number; height: number; error?: string }> {
  try {
    const { data, width, height } = decodeToRgba(bytes, mimeType);
    const cv = await getCv();

    const mat = new cv.Mat(height, width, cv.CV_8UC4);
    mat.data.set(data);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const detected = new cv.Mat();
    try {
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
      cv.medianBlur(gray, blurred, 5);

      const minDim = Math.min(width, height);
      cv.HoughCircles(
        blurred, detected, cv.HOUGH_GRADIENT,
        DP,
        Math.max(1, Math.round(minDim * MIN_DIST_FRACTION)),
        PARAM1,
        PARAM2,
        Math.max(1, Math.round(minDim * MIN_RADIUS_FRACTION)),
        Math.max(2, Math.round(minDim * MAX_RADIUS_FRACTION)),
      );

      const circles: DetectedCircle[] = [];
      for (let i = 0; i < detected.cols; i++) {
        const x = detected.data32F[i * 3];
        const y = detected.data32F[i * 3 + 1];
        const r = detected.data32F[i * 3 + 2];
        circles.push({ x: x / width, y: y / height, r: r / width });
      }
      return { circles, width, height };
    } finally {
      mat.delete(); gray.delete(); blurred.delete(); detected.delete();
    }
  } catch (err) {
    return { circles: [], width: 0, height: 0, error: err instanceof Error ? err.message : 'Unknown error detecting circles.' };
  }
}
