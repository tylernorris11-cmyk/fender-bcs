/**
 * Resizes an image file in the browser before it's ever sent anywhere — a
 * phone photo can be 5–10MB, and nothing in this app needs it bigger than a
 * couple of hundred KB to be useful as evidence of a problem.
 */
export function resizeImageToDataUrl(file: File, maxDim = 1400, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not supported in this browser.'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/**
 * Same idea as resizeImageToDataUrl, but resolves a File/Blob (for a real
 * FormData upload) rather than a data-URL string, and defaults to a higher
 * resolution — Hough circle detection needs individual bar-ends to stay
 * visually distinguishable even when a bundle photo holds hundreds of them.
 * Always re-encodes as JPEG regardless of the source format, so server-side
 * detection only ever has to decode one image type.
 */
export function resizeImageToFile(file: File, maxDim = 2200, quality = 0.9): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not supported in this browser.'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Could not process that photo.'));
        resolve(new File([blob], 'bundle.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}
