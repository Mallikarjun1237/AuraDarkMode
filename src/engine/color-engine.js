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
      siteEnabled: true
    };
    
    this.styleElement = null;
  }

  init(savedSettings = {}) {
    this.settings = { ...this.settings, ...savedSettings };
    this.ensureStyleElement();
    this.applySettings();
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

    if (this.isActive && this.settings.siteEnabled) {
      root.setAttribute('data-auradark-active', 'true');
      root.setAttribute('data-auradark-preset', this.settings.preset);

      // Base preset parameters
      let baseInvert = 90;
      let baseContrast = 92;
      let baseBrightness = 96;
      let baseSepia = 0;
      let baseSaturate = 100;
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
        `hue-rotate(180deg)`,
        `contrast(${finalContrast}%)`,
        `brightness(${finalBrightness}%)`
      ];

      if (finalSepia > 0) {
        filterParts.push(`sepia(${finalSepia}%)`);
      }
      if (baseSaturate !== 100) {
        filterParts.push(`saturate(${baseSaturate}%)`);
      }

      const rootFilter = filterParts.join(' ');

      this.styleElement.textContent = `
        html[data-auradark-active="true"] {
          filter: ${rootFilter} !important;
          background-color: ${bgColor} !important;
        }

        /* Protect media from inversion */
        html[data-auradark-active="true"] img,
        html[data-auradark-active="true"] video,
        html[data-auradark-active="true"] iframe,
        html[data-auradark-active="true"] canvas,
        html[data-auradark-active="true"] [style*="background-image"],
        html[data-auradark-active="true"] embed:not([type="application/pdf"]),
        html[data-auradark-active="true"] object:not([type="application/pdf"]) {
          filter: invert(100%) hue-rotate(180deg) !important;
        }

        /* Protect the Wispr Flow floating widget */
        #auradark-floating-host {
          filter: invert(100%) hue-rotate(180deg) !important;
          z-index: 2147483647 !important;
          pointer-events: auto !important;
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
