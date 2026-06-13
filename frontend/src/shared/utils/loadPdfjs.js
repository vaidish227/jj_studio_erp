// Lazy pdf.js loader shared by PdfThumbnail / PdfViewer. pdfjs-dist is ~400 KB
// minified — load it (and its worker) on demand the first time a PDF actually
// renders, not in the main bundle.
let pdfjsPromise = null;

const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
};

export default loadPdfjs;
