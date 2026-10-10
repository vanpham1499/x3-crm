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
        new Promise<void>((resolve, reject) => {
          if (image.complete) {
            if (image.naturalWidth > 0) resolve();
            else reject(new Error('Một ảnh trong tài liệu chưa tải được. Tải lại bản gửi khách.'));
            return;
          }
          const cleanup = () => {
            clearTimeout(timer);
            image.removeEventListener('load', loaded);
            image.removeEventListener('error', failed);
          };
          const loaded = () => {
            cleanup();
            resolve();
          };
          const failed = () => {
            cleanup();
            reject(
              new Error('Không tải đủ ảnh tài liệu. Kiểm tra kết nối rồi mở lại bản gửi khách.'),
            );
          };
          const timer = setTimeout(failed, 15_000);
          image.addEventListener('load', loaded, { once: true });
          image.addEventListener('error', failed, { once: true });
        }),
    ),
  );
}

async function captureElement(element: HTMLElement) {
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
  return { canvas, width, height };
}

export async function createElementDocument(
  element: HTMLElement,
  format: 'pdf' | 'png',
): Promise<Blob> {
  const { canvas, width, height } = await captureElement(element);
  if (format === 'png')
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh tài liệu.'))),
        'image/png',
      ),
    );
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
  return pdf.output('blob');
}

export async function downloadElementAsPdf(element: HTMLElement, filename: string) {
  const blob = await createElementDocument(element, 'pdf');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
