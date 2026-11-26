/**
 * AuraDark PDF & Document Engine
 * Specialized dark mode handler for embedded and standalone PDFs,
 * WhatsApp Web document previews, PDF.js, and A4 canvas viewers.
 * Converts blinding white A4 sheets into comfortable dark slate paper with crisp white text.
 */

class AuraPdfEngine {
  constructor() {
    this.isPdf = false;
    this.active = false;
    this.observer = null;
    this.pollTimer = null;
    this.resizeObserver = null;
  }

  /**
   * Detects if current page is a direct or embedded PDF or contains an open document viewer
   */
  detectPdf() {
    const isPdfContentType = document.contentType === 'application/pdf';
    const isPdfUrl = window.location.pathname.toLowerCase().endsWith('.pdf');
    const hasPdfEmbed = !!document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]');
    const hasPdfCanvas = !!document.querySelector(
      '.pdfViewer, [data-page-number], canvas.page, div[data-animate-media-viewer="true"], [aria-label*="Document"], [title*=".pdf"]'
    );

    this.isPdf = isPdfContentType || isPdfUrl || hasPdfEmbed || hasPdfCanvas;
    return this.isPdf;
  }

  /**
   * Scans and tags document canvases (A4 sheets) so they invert cleanly into dark mode
   */
  scanAndTagDocCanvases() {
    if (!this.active) return;

    const canvases = document.querySelectorAll('canvas');
    const mode = document.documentElement.getAttribute('data-auradark-mode');
    const isNativeDarkOrWhatsApp = mode === 'native-dark' || window.location.hostname.includes('web.whatsapp.com');

    canvases.forEach(canvas => {
      const w = canvas.width || canvas.offsetWidth;
      const h = canvas.height || canvas.offsetHeight;
      const ratio = h / (w || 1);

      // Check context: WhatsApp modal, PDF.js, Google Docs, document viewer, or A4 ratio (1.05 to 2.2)
      const isInsideDocViewer = !!canvas.closest(
        '[data-animate-media-viewer="true"], [role="dialog"], [role="region"], .media-viewer, [class*="media-viewer"], ' +
        '[title*=".pdf"], [aria-label*="PDF"], [aria-label*="Document"], ' +
        '.pdfViewer, .page, .canvasWrapper, [data-page-number], .react-pdf__Page__canvas, ' +
        '.kix-canvas-tile-content, .kix-page-paginated, [class*="kix-page"], ' +
        '[class*="pdf"], [class*="document"], [class*="reader"], [class*="viewer"]'
      );

      const isA4Ratio = w > 160 && h > 200 && ratio >= 1.05 && ratio <= 2.2;
      const isWhatsAppViewer = window.location.hostname.includes('web.whatsapp.com') && w > 150 && h > 150;

      if (isInsideDocViewer || isA4Ratio || isWhatsAppViewer) {
        canvas.setAttribute('data-auradark-doc-canvas', 'true');

        if (isNativeDarkOrWhatsApp) {
          // Native dark mode does not invert body: explicitly invert the white sheet into dark slate
          canvas.style.setProperty('filter', 'invert(90%) hue-rotate(180deg) contrast(105%) brightness(95%)', 'important');
        } else {
          // Body is already inverted: inherit body inversion
          canvas.style.setProperty('filter', 'none', 'important');
        }
        canvas.style.setProperty('background-color', '#16181d', 'important');

        // Style parent container (sheet background & margins)
        const parent = canvas.parentElement;
        if (parent) {
          parent.setAttribute('data-auradark-doc-parent', 'true');
          parent.style.setProperty('background-color', '#16181d', 'important');
        }

        // Setup resize observer for dynamic PDF renders
        if (window.ResizeObserver && !canvas.__auradark_observed) {
          canvas.__auradark_observed = true;
          if (!this.resizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
              if (this.active) this.scanAndTagDocCanvases();
            });
          }
          this.resizeObserver.observe(canvas);
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
        }, 50);
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });

    // Periodic check for dynamic PDF.js infinite scroll pages (pages 2, 3, etc.)
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        if (this.active) {
          this.scanAndTagDocCanvases();
        }
      }, 500);
    }
  }

  stopObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Applies or removes PDF dark styling
   */
  applyPdfTheme(active) {
    this.active = active;

    if (!active) {
      this.stopObserver();
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
