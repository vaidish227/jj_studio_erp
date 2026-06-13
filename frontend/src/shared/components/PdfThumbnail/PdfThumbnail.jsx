import { useEffect, useState } from 'react';
import loadPdfjs from '../../utils/loadPdfjs';

// Rendered-page cache so each file is rasterised at most once per session.
const dataUrlCache = new Map(); // url -> Promise<dataUrl>

const renderFirstPage = (url, targetWidth) => {
  if (dataUrlCache.has(url)) return dataUrlCache.get(url);
  const promise = (async () => {
    const pdfjs = await loadPdfjs();
    const pdf = await pdfjs.getDocument({ url }).promise;
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = (targetWidth * (window.devicePixelRatio || 1)) / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      return canvas.toDataURL();
    } finally {
      pdf.destroy();
    }
  })();
  dataUrlCache.set(url, promise);
  promise.catch(() => dataUrlCache.delete(url));
  return promise;
};

/**
 * First page of a PDF rasterised to an <img> — a clean thumbnail with none of
 * the browser PDF-viewer chrome (which iframes can't hide cross-browser).
 * Renders `fallback` until the page is ready, and permanently if the PDF
 * cannot be fetched or rendered (e.g. a storage host without CORS headers).
 */
const PdfThumbnail = ({ url, alt = '', width = 480, className = '', fallback = null }) => {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    renderFirstPage(url, width)
      .then((d) => { if (!cancelled) setDataUrl(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url, width]);

  if (!dataUrl) return fallback;
  return <img src={dataUrl} alt={alt} className={className} />;
};

export default PdfThumbnail;
