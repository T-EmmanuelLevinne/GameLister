export interface CompressedImageResult {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  mimeType: string;
}

const ALLOWED_INPUT_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/bmp'
]);

const MAX_DIMENSION_PX = 1440;
const TARGET_MAX_BYTES = 380 * 1024; // Aim under 380 KB (hard server limit is 500 KB)
const HARD_MAX_BYTES = 485 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const b64Len = dataUrl.length - commaIdx - 1;
  return Math.floor((b64Len * 3) / 4);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode image file. Please select a valid JPG, PNG, or WebP image.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Compresses an uploaded image in the browser while preserving visual sharpness:
 * - Blocks SVG and non-image formats
 * - Scales down proportionally to max 1440px edge (never upscales)
 * - Encodes to high-efficiency WebP (or JPEG fallback) and steps quality only if needed to stay under 485 KB
 */
export async function compressImageFile(file: File): Promise<CompressedImageResult> {
  const rawType = (file.type || '').toLowerCase().trim();
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (rawType.includes('svg') || ext === 'svg' || ext === 'svgz') {
    throw new Error('SVG files are not permitted for security reasons. Please upload a JPG, PNG, or WebP image.');
  }

  const isAllowedMime = ALLOWED_INPUT_MIMES.has(rawType);
  const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp'].includes(ext);
  if (!isAllowedMime && !isAllowedExt) {
    throw new Error('Unsupported file format. Please choose a JPG, PNG, or WebP image.');
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Selected image is too large (max 20 MB before compression).');
  }

  const img = await loadImageFromFile(file);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  if (!naturalW || !naturalH) {
    throw new Error('Invalid image dimensions.');
  }

  let scale = 1;
  if (naturalW > MAX_DIMENSION_PX || naturalH > MAX_DIMENSION_PX) {
    scale = Math.min(MAX_DIMENSION_PX / naturalW, MAX_DIMENSION_PX / naturalH);
  }

  let targetW = Math.max(1, Math.round(naturalW * scale));
  let targetH = Math.max(1, Math.round(naturalH * scale));

  const renderAt = (w: number, h: number, mime: string, quality: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas context is unavailable.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(mime, quality);
  };

  // Prefer WebP for best quality-to-byte ratio; fall back to JPEG if browser lacks WebP encode support
  let outputMime = 'image/webp';
  let dataUrl = renderAt(targetW, targetH, outputMime, 0.86);
  if (!dataUrl.startsWith('data:image/webp')) {
    outputMime = 'image/jpeg';
    dataUrl = renderAt(targetW, targetH, outputMime, 0.86);
  }

  let compressedBytes = estimateDataUrlBytes(dataUrl);
  const qualities = [0.80, 0.74, 0.68];

  for (const q of qualities) {
    if (compressedBytes <= TARGET_MAX_BYTES) break;
    dataUrl = renderAt(targetW, targetH, outputMime, q);
    compressedBytes = estimateDataUrlBytes(dataUrl);
  }

  // If still above hard cap (very high-detail large image), scale dimensions down slightly
  let resizeAttempts = 0;
  while (compressedBytes > HARD_MAX_BYTES && resizeAttempts < 3) {
    resizeAttempts += 1;
    targetW = Math.max(320, Math.round(targetW * 0.82));
    targetH = Math.max(320, Math.round(targetH * 0.82));
    dataUrl = renderAt(targetW, targetH, outputMime, 0.76);
    compressedBytes = estimateDataUrlBytes(dataUrl);
  }

  if (compressedBytes > 500 * 1024) {
    throw new Error('Could not compress image under 500 KB. Please choose a simpler or smaller image.');
  }

  return {
    dataUrl,
    originalBytes: file.size,
    compressedBytes,
    width: targetW,
    height: targetH,
    mimeType: outputMime
  };
}
