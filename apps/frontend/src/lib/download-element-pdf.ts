import { toCanvas } from 'html-to-image';

export function getElementCaptureSize(element: HTMLElement) {
  // offset sizes include borders but not a parent's mobile preview scale.
  return {
    width: Math.ceil(Math.max(element.scrollWidth, element.offsetWidth)),
    height: Math.ceil(Math.max(element.scrollHeight, element.offsetHeight)),
  };
}

async function waitForElementAssets(element: HTMLElement) {
  await document.fonts?.ready;

  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
}

export async function downloadElementAsPdf(element: HTMLElement, filename: string) {
  await waitForElementAssets(element);

  const { width, height } = getElementCaptureSize(element);
  const canvas = await toCanvas(element, {
    backgroundColor: '#ffffff',
    cacheBust: true,
    // Preserve QR amount and transfer content when caching embedded images.
    includeQueryParams: true,
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      margin: '0',
      maxWidth: 'none',
      overflow: 'visible',
    },
  });
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
    compress: true,
    hotfixes: ['px_scaling'],
  });

  pdf.addImage(
    canvas.toDataURL('image/jpeg', 0.96),
    'JPEG',
    0,
    0,
    width,
    height,
    undefined,
    'FAST',
  );
  pdf.save(filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`);
}
