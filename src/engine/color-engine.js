/**
 * AuraDark Color Engine
 * Manages GPU-accelerated perceptual color transformations.
 * Preserves 100% of original hues and media while converting light surfaces into dark surfaces.
 */

class AuraColorEngine {
  constructor() {
    this.isActive = false;
    this.settings = {
      preset: 'charcoal',
      brightness: 100,
      contrast: 100,
      warmth: 0,
      boostContrast: false,
      dyslexicFont: false,
      siteEnabled: true
    };
    
    this.styleElement = null;
  }

  init(savedSettings = {}) {
    this.settings = { ...this.settings, ...savedSettings };
    this.ensureStyleElement();
    this.setupNativeSiteWatcher();
    this.applySettings();
  }

  isWhatsAppWeb() {
    return window.location.hostname.includes('web.whatsapp.com');
  }

  setupNativeSiteWatcher() {
    if (!this.isWhatsAppWeb()) return;

    // Observe body class changes on WhatsApp Web so .dark is synced
    const syncWhatsAppTheme = () => {
      if (this.isActive && this.settings.siteEnabled) {
        if (document.body && !document.body.classList.contains('dark')) {
          document.body.classList.add('dark');
        }
      } else {
        if (document.body && document.body.classList.contains('dark')) {
          document.body.classList.remove('dark');
        }
      }
    };

    if (document.body) {
      syncWhatsAppTheme();
      const obs = new MutationObserver(syncWhatsAppTheme);
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        syncWhatsAppTheme();
        if (document.body) {
          const obs = new MutationObserver(syncWhatsAppTheme);
          obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }
      }, { once: true });
    }
  }

  ensureStyleElement() {
    if (!this.styleElement) {
      this.styleElement = document.getElementById('auradark-engine-styles');
      if (!this.styleElement) {
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'auradark-engine-styles';
        (document.head || document.documentElement).appendChild(this.styleElement);
      }
    }
  }

  /**
   * Applies the perceptual transformation based on user preset and sliders
   */
  applySettings() {
    const root = document.documentElement;
    if (!root) return;

    this.ensureStyleElement();

    // 1. WhatsApp Web native dark mode handling
    if (this.isWhatsAppWeb()) {
      if (this.isActive && this.settings.siteEnabled) {
        document.body?.classList.add('dark');
        document.documentElement?.classList.add('dark');
        root.setAttribute('data-auradark-active', 'true');
        // On WhatsApp Web, use native dark styling without root color inversion
        this.styleElement.textContent = `
          /* WhatsApp Web Native Dark Mode Enhancement */
          body.web.dark {
            background-color: #111b21 !important;
          }
          #auradark-floating-host {
            filter: none !important;
          }
        `;
      } else {
        document.body?.classList.remove('dark');
        document.documentElement?.classList.remove('dark');
        root.removeAttribute('data-auradark-active');
        this.styleElement.textContent = '';
      }
      return;
    }

    if (this.isActive && this.settings.siteEnabled) {
      root.setAttribute('data-auradark-active', 'true');
      root.setAttribute('data-auradark-preset', this.settings.preset);

      let baseInvert = 90;
      let baseContrast = 92;
      let baseBrightness = 96;
      let baseSepia = 0;
      let baseSaturate = 100;
      let baseHueShift = 180;
      let baseGrayscale = 0;
      let bgColor = '#121316';

      if (this.settings.preset === 'oled') {
        baseInvert = 100;
        baseContrast = 105;
        baseBrightness = 98;
        bgColor = '#000000';
      } else if (this.settings.preset === 'mocha') {
        baseInvert = 88;
        baseContrast = 90;
        baseBrightness = 94;
        baseSepia = 28;
        bgColor = '#171412';
      } else if (this.settings.preset === 'nord') {
        baseInvert = 90;
        baseContrast = 94;
        baseBrightness = 96;
        baseSaturate = 115;
        bgColor = '#111822';
      } else if (this.settings.preset === 'cyberpunk') {
        baseInvert = 92;
        baseContrast = 98;
        baseBrightness = 96;
        baseSaturate = 135;
        bgColor = '#0f0c1b';
      } else if (this.settings.preset === 'emerald') {
        baseInvert = 90;
        baseContrast = 93;
        baseBrightness = 94;
        baseHueShift = 160;
        baseSaturate = 105;
        bgColor = '#0b1712';
      } else if (this.settings.preset === 'dracula') {
        baseInvert = 90;
        baseContrast = 95;
        baseBrightness = 96;
        baseHueShift = 195;
        baseSaturate = 112;
        bgColor = '#181324';
      } else if (this.settings.preset === 'e-ink') {
        baseInvert = 90;
        baseContrast = 108;
        baseBrightness = 96;
        baseGrayscale = 100;
        bgColor = '#111111';
      }

      // Accessibility attributes
      if (this.settings.boostContrast) {
        root.setAttribute('data-auradark-boost-contrast', 'true');
      } else {
        root.removeAttribute('data-auradark-boost-contrast');
      }

      if (this.settings.dyslexicFont) {
        root.setAttribute('data-auradark-dyslexic', 'true');
      } else {
        root.removeAttribute('data-auradark-dyslexic');
      }

      // Merge user adjustments
      const userB = (this.settings.brightness / 100);
      const userC = (this.settings.contrast / 100);
      const userW = this.settings.warmth || 0;

      const finalBrightness = Math.round(baseBrightness * userB);
      const finalContrast = Math.round(baseContrast * userC);
      const finalSepia = Math.min(60, baseSepia + userW);

      let filterParts = [
        `invert(${baseInvert}%)`,
        `hue-rotate(${baseHueShift}deg)`,
        `contrast(${finalContrast}%)`,
        `brightness(${finalBrightness}%)`
      ];

      if (baseGrayscale > 0) {
        filterParts.push(`grayscale(${baseGrayscale}%)`);
      }
      if (finalSepia > 0) {
        filterParts.push(`sepia(${finalSepia}%)`);
      }
      if (baseSaturate !== 100) {
        filterParts.push(`saturate(${baseSaturate}%)`);
      }

      const rootFilter = filterParts.join(' ');

      const themeTints = {
        charcoal: { color: 'rgba(30, 41, 59, 0.08)', blend: 'color' },
        oled: { color: 'rgba(0, 0, 0, 0.25)', blend: 'multiply' },
        mocha: { color: 'rgba(194, 149, 103, 0.18)', blend: 'color' },
        nord: { color: 'rgba(56, 189, 248, 0.16)', blend: 'color' },
        cyberpunk: { color: 'rgba(217, 70, 239, 0.22)', blend: 'color' },
        emerald: { color: 'rgba(16, 185, 129, 0.18)', blend: 'color' },
        dracula: { color: 'rgba(168, 85, 247, 0.18)', blend: 'color' },
        'e-ink': { color: 'rgba(255, 255, 255, 0.10)', blend: 'saturation' },
      };

      const activeTint = themeTints[this.settings.preset] || themeTints.charcoal;

      this.styleElement.textContent = `
        html[data-auradark-active="true"] {
          background-color: ${bgColor} !important;
        }

        /* Page inversion applied to body: keeps floating widget rock-solid in true viewport coordinates without scroll flicker */
        html[data-auradark-active="true"] > body {
          filter: ${rootFilter} !important;
          background-color: #ffffff !important;
          min-height: 100vh !important;
        }

        /* Ambient Theme Tint Overlay: Ensures all 8 themes visibly tint dark-mode and light-mode sites */
        html[data-auradark-active="true"]::before {
          content: "" !important;
          position: fixed !important;
          inset: 0 !important;
          pointer-events: none !important;
          z-index: 2147483640 !important;
          background-color: ${activeTint.color} !important;
          mix-blend-mode: ${activeTint.blend} !important;
          transition: background-color 0.2s ease !important;
        }

        /* Protect media from negative inversion */
        html[data-auradark-active="true"] img:not([class*="icon"]):not([src*="icon"]):not([src*=".svg"]):not([data-icon]),
        html[data-auradark-active="true"] video,
        html[data-auradark-active="true"] iframe:not([src*=".pdf"]):not([src*="blob:"]),
        html[data-auradark-active="true"] embed:not([type="application/pdf"]),
        html[data-auradark-active="true"] object:not([type="application/pdf"]),
        html[data-auradark-active="true"] svg image {
          filter: invert(100%) hue-rotate(180deg) !important;
        }

        /* User avatars and thumbnail photos ONLY */
        html[data-auradark-active="true"] [class*="avatar"]:empty,
        html[data-auradark-active="true"] [class*="profile-photo"]:empty,
        html[data-auradark-active="true"] [class*="user-img"]:empty,
        html[data-auradark-active="true"] [class*="thumbnail"]:empty {
          filter: invert(100%) hue-rotate(180deg) !important;
        }

        /* Guarantee icons and vector symbols invert to crisp white */
        html[data-auradark-active="true"] .google-symbols,
        html[data-auradark-active="true"] .material-icons,
        html[data-auradark-active="true"] .material-symbols-outlined,
        html[data-auradark-active="true"] [class*="material-symbols"],
        html[data-auradark-active="true"] [class*="google-material"],
        html[data-auradark-active="true"] mat-icon,
        html[data-auradark-active="true"] [data-icon],
        html[data-auradark-active="true"] i[class*="fa-"],
        html[data-auradark-active="true"] i[class*="icon"],
        html[data-auradark-active="true"] span[class*="icon"],
        html[data-auradark-active="true"] div[class*="icon"]:empty {
          filter: none !important;
        }

        /* Graphic/game canvases ONLY - exclude PDF and document reader canvases */
        html[data-auradark-active="true"] canvas:not([data-auradark-doc-canvas="true"]):not(.pdfViewer canvas):not([class*="pdf"] canvas):not([class*="document"] canvas):not([class*="reader"] canvas):not([class*="viewer"] canvas) {
          filter: invert(100%) hue-rotate(180deg) !important;
        }

        /* Wispr Flow floating widget: Stays rock-solid in fixed coordinates without double-inversion */
        #auradark-floating-host {
          position: fixed !important;
          filter: none !important;
          z-index: 2147483647 !important;
        }
      `;
    } else {
      root.removeAttribute('data-auradark-active');
      root.removeAttribute('data-auradark-preset');
      if (this.styleElement) {
        this.styleElement.textContent = '';
      }
    }
  }

  setActive(active) {
    this.isActive = active;
    this.applySettings();
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.applySettings();
  }
}

// Expose globally
window.AuraColorEngine = AuraColorEngine;
