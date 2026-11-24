/**
 * AuraDark PDF & Document Engine
 * Specialized dark mode handler for embedded and standalone PDFs,
 * WhatsApp Web document previews, PDF.js, and A4 canvas viewers.
 * Turns blinding white A4 sheets into comfortable dark slate paper with crisp white text.
 */

class AuraPdfEngine {
  constructor() {
    this.isPdf = false;
    this.active = false;
    this.observer = null;
    this.mode = 'slate';
  }

  /**
   * Detects if current page is a direct or embedded PDF
   */
  detectPdf() {
    const isPdfContentType = document.contentType === 'application/pdf';
    const isPdfUrl = window.location.pathname.toLowerCase().endsWith('.pdf');
    const hasPdfEmbed = !!document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]');
    const hasPdfCanvas = !!document.querySelector('.pdfViewer, [data-page-number], canvas.page, div[data-animate-media-viewer="true"]');

    this.isPdf = isPdfContentType || isPdfUrl || hasPdfEmbed || hasPdfCanvas;
    return this.isPdf;
  }

  /**
   * Scans and tags document canvases (A4 sheets) so they invert cleanly into dark mode
   */
  scanAndTagDocCanvases() {
    if (!this.active) return;

    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      // Check if already tagged
      if (canvas.hasAttribute('data-auradark-doc-canvas')) return;

      const w = canvas.width || canvas.offsetWidth;
      const h = canvas.height || canvas.offsetHeight;
      const ratio = h / (w || 1);

      // Check context: WhatsApp modal, PDF.js, document viewer, or A4 ratio (1.15 to 1.7)
      const isInsideDocViewer = !!canvas.closest(
        '[data-animate-media-viewer="true"], [role="dialog"], .media-viewer, [class*="media-viewer"], ' +
        '[title*=".pdf"], [aria-label*="PDF"], [aria-label*="Document"], ' +
        '.pdfViewer, .page, .canvasWrapper, [data-page-number], .react-pdf__Page__canvas, ' +
        '[class*="pdf"], [class*="document"], [class*="reader"]'
      );

      const isA4Ratio = w > 180 && h > 240 && ratio >= 1.15 && ratio <= 1.75;

      if (isInsideDocViewer || isA4Ratio) {
        canvas.setAttribute('data-auradark-doc-canvas', 'true');
        canvas.style.setProperty('filter', 'none', 'important');
        canvas.style.setProperty('background-color', '#16181d', 'important');

        // Style the parent container if it's a paper wrapper
        const parent = canvas.parentElement;
        if (parent && !parent.hasAttribute('data-auradark-doc-parent')) {
          parent.setAttribute('data-auradark-doc-parent', 'true');
          parent.style.setProperty('background-color', '#16181d', 'important');
        }
      }
    });
  }

  /**
   * Starts a mutation observer to catch dynamically opened PDF previews (like in WhatsApp Web)
   */
  startObserver() {
    if (this.observer || !document.body) return;
    let timer = null;

    this.observer = new MutationObserver((mutations) => {
      let hasNewNodes = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }
      if (hasNewNodes && this.active) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.scanAndTagDocCanvases();
        }, 80);
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stopObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Applies or removes PDF dark styling
   */
  applyPdfTheme(active) {
    this.active = active;

    if (!active) {
      this.stopObserver();
      // Reset tagged canvases
      document.querySelectorAll('[data-auradark-doc-canvas]').forEach(c => {
        c.removeAttribute('data-auradark-doc-canvas');
        c.style.removeProperty('filter');
        c.style.removeProperty('background-color');
      });
      document.querySelectorAll('[data-auradark-doc-parent]').forEach(p => {
        p.removeAttribute('data-auradark-doc-parent');
        p.style.removeProperty('background-color');
      });
      return;
    }

    // Run scan immediately and start watching for dynamic document opens
    this.scanAndTagDocCanvases();
    this.startObserver();
  }
}

// Expose globally
window.AuraPdfEngine = AuraPdfEngine;
