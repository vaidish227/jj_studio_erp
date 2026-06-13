import { useEffect, useState } from 'react';
import loadPdfjs from '../../utils/loadPdfjs';

// Rasterising every page of a huge PDF would hold a lot of memory — cap it.
// Truncation is surfaced in the UI so it never reads as "the whole document".
const MAX_PAGES = 25;

const renderPages = async (url, targetWidth) => {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ url }).promise;
  try {
    const dpr = window.devicePixelRatio || 1;
    const count = Math.min(pdf.numPages, MAX_PAGES);
    const pages = [];
    for (let i = 1; i <= count; i += 1) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (targetWidth * dpr) / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      pages.push(canvas.toDataURL());
    }
    return { pages, numPages: pdf.numPages };
  } finally {
    pdf.destroy();
  }
};

const resultCache = new Map(); // url -> Promise<{pages, numPages}>
const getPages = (url, targetWidth) => {
  if (resultCache.has(url)) return resultCache.get(url);
  const promise = renderPages(url, targetWidth);
  resultCache.set(url, promise);
  promise.catch(() => resultCache.delete(url));
  return promise;
};

/**
 * All pages of a PDF rasterised to stacked <img>s — a clean scrollable preview
 * with none of the browser PDF-viewer chrome (which iframes can't hide
 * cross-browser). Shows `fallback` while rendering and `errorFallback` if the
 * PDF cannot be fetched/rendered (e.g. a storage host without CORS headers).
 */
const PdfViewer = ({ url, alt = '', width = 768, className = '', fallback = null, errorFallback = null }) => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    getPages(url, width)
      .then((r) => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [url, width]);

  if (error) return errorFallback;
  if (!result) return fallback;

  return (
    <div className={className}>
      {result.pages.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`${alt || 'Page'} — page ${i + 1}`}
          className="w-full rounded-lg border border-[var(--border)] bg-white shadow-sm"
        />
      ))}
      {result.numPages > result.pages.length && (
        <p className="text-center text-[11px] text-[var(--text-muted)] py-2">
          Showing the first {result.pages.length} of {result.numPages} pages — open the file in a
          new tab for the full document.
        </p>
      )}
    </div>
  );
};

export default PdfViewer;
