/**
 * AuraDark Color Engine
 * Universal Smart Theme Coordinator:
 * - Detects whether any website in the browser is natively dark or light.
 * - If site is natively light & user wants dark: Transforms to dark with custom presets.
 * - If site is natively dark & user wants dark: Preserves native dark mode (no double inversion, white text & logos stay white).
 * - If site is natively dark & user wants light: Inverts native dark to clean light mode (dark text on light paper).
 * - If site is natively light & user wants light: Preserves native light mode (pure black text on white paper).
 * - Eye Comfort Warmth Shield: Hardware-accelerated amber blue-light attenuation working across ALL modes (Light, Dark, PDFs).
 * - Real-Time Clock Tracker: Continuously checks system local time (+5:30 IST / user timezone) for 8:00 PM – 7:00 AM Night Shift.
 */

class AuraColorEngine {
  constructor() {
    this.isActive = true;
    this.settings = {
      preset: 'charcoal',
      brightness: 100,
      contrast: 100,
      warmth: 0,
      autoWarmth: false,
      boostContrast: false,
      dyslexicFont: false,
      siteEnabled: true
    };
    
    this.styleElement = null;
    this.themeObserver = null;
    this.clockTimer = null;
    this.warmthElement = null;
    this.currentMode = null; // 'light-to-dark', 'native-dark', 'dark-to-light', 'native-light'
  }

  init(savedSettings = {}) {
    this.settings = { ...this.settings, ...savedSettings };
    this.ensureStyleElement();
    this.setupThemeWatcher();
    this.setupClockWatcher();
    this.applySettings();
  }

  /**
   * Universal Native Theme Detector
   * Evaluates computed luminance and theme indicators across ANY website in the browser.
   */
  detectNativeTheme() {
    try {
      const root = document.documentElement;
      const body = document.body;
      if (!root && !body) return 'light';

      // 1. Explicit dark scheme on html or body
      if (root.getAttribute('data-theme') === 'dark' || 
          root.getAttribute('data-color-mode') === 'dark' ||
          root.hasAttribute('dark') ||
          root.classList.contains('dark') || 
          root.classList.contains('dark-theme') ||
          root.classList.contains('theme-dark') ||
          (body && (body.classList.contains('dark') || body.classList.contains('dark-theme')))) {
        return 'dark';
      }

      // Helper: calculates relative perceived luminance from rgb/rgba string
      const parseLuminance = (colorStr) => {
        if (!colorStr || colorStr === 'transparent' || colorStr.includes('rgba(0, 0, 0, 0)')) return null;
        const match = colorStr.match(/\d+/g);
        if (match && match.length >= 3) {
          const [r, g, b] = match.map(Number);
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        }
        return null;
      };

      // 2. Computed background color on body
      if (body) {
        const bodyLum = parseLuminance(window.getComputedStyle(body).backgroundColor);
        if (bodyLum !== null) {
          return bodyLum < 0.42 ? 'dark' : 'light';
        }
      }

      // 3. Computed background color on html root
      const rootLum = parseLuminance(window.getComputedStyle(root).backgroundColor);
      if (rootLum !== null) {
        return rootLum < 0.42 ? 'dark' : 'light';
      }

      // 4. Sample primary container background if body/html are transparent
      const container = document.querySelector('main, #app, #root, #searchform, #rcnt, .main');
      if (container) {
        const contLum = parseLuminance(window.getComputedStyle(container).backgroundColor);
        if (contLum !== null) {
          return contLum < 0.42 ? 'dark' : 'light';
        }
      }

      // 5. Computed text color: bright/white text on transparent background indicates dark surface
      if (body) {
        const textLum = parseLuminance(window.getComputedStyle(body).color);
        if (textLum !== null) {
          if (textLum > 0.65) return 'dark';
          if (textLum < 0.35) return 'light';
        }
      }

      // 6. Media query & colorScheme fallback (e.g. system dark mode on Google, YouTube)
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        const cs = window.getComputedStyle(root).colorScheme;
        if (cs && cs.includes('dark')) return 'dark';
      }

      return 'light';
    } catch (_) {
      return 'light';
    }
  }

  /**
   * Real-Time Local Clock Tracker (Accurately calculates local time, e.g. +5:30 IST)
   * Evaluates whether current minute falls in the 8:00 PM (20.00) through 7:00 AM (7.00) night window.
   */
  isNightTime() {
    try {
      const now = new Date();
      const currentHour = now.getHours() + (now.getMinutes() / 60);
      return currentHour >= 20 || currentHour < 7;
    } catch (_) {
      return false;
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

  ensureWarmthElement() {
    if (!this.warmthElement) {
      this.warmthElement = document.getElementById('auradark-warmth-layer');
      if (!this.warmthElement) {
        this.warmthElement = document.createElement('div');
        this.warmthElement.id = 'auradark-warmth-layer';
        this.warmthElement.style.cssText = `
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          pointer-events: none !important;
          z-index: 2147483645 !important;
          transition: background-color 0.25s ease, opacity 0.25s ease !important;
          display: none;
        `;
        const target = document.documentElement || document.body;
        if (target) target.appendChild(this.warmthElement);
      }
    }
    return this.warmthElement;
  }

  /**
   * Dedicated Eye Comfort Warmth Shield
   * Works across ALL modes (Light Mode, Dark Mode, Native Dark, and PDFs)
   * Attenuates blue light by blending soothing amber tones (#ff9800) over the viewport.
   */
  updateWarmthLayer() {
    const el = this.ensureWarmthElement();
    if (!el) return;

    let effectiveWarmth = this.settings.warmth || 0;
    const isNight = this.isNightTime();

    if (this.settings.autoWarmth && isNight) {
      // Automatic +25% amber shift during night hours (8 PM - 7 AM)
      effectiveWarmth = Math.min(50, effectiveWarmth + 25);
    }

    if (effectiveWarmth > 0 && this.settings.siteEnabled) {
      // Physical blue light attenuation:
      // In light mode: converts blinding white glare to warm reading parchment
      // In dark mode: softens white text and bright highlights
      const alpha = (effectiveWarmth / 50) * 0.24; // up to 0.24 alpha at 50%
      el.style.display = 'block';
      el.style.backgroundColor = `rgba(255, 145, 0, ${alpha.toFixed(3)})`;
      el.style.mixBlendMode = 'multiply';
    } else {
      el.style.display = 'none';
    }
  }

  setupClockWatcher() {
    if (this.clockTimer) return;
    // Live minute-by-minute clock check (updates automatically as time passes 8:00 PM and 7:00 AM)
    this.clockTimer = setInterval(() => {
      this.updateWarmthLayer();
    }, 30000);
  }

  setupThemeWatcher() {
    if (this.themeObserver) return;

    let debounceTimer = null;
    const recheckTheme = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.applySettings();
      }, 100);
    };

    if (window.matchMedia) {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recheckTheme);
      } catch (_) {}
    }

    const target = document.documentElement;
    if (target) {
      this.themeObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'class' || m.attributeName === 'data-theme' || m.attributeName === 'data-color-mode' || m.attributeName === 'dark') {
            recheckTheme();
            break;
          }
        }
      });
      this.themeObserver.observe(target, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-mode', 'dark'] });
    }
  }

  /**
   * Applies the perceptual transformation based on user target choice and native site theme
   */
  applySettings() {
    const root = document.documentElement;
    if (!root) return;

    this.ensureStyleElement();

    const userWantsDark = Boolean(this.isActive && this.settings.siteEnabled);
    const nativeTheme = this.detectNativeTheme();

    // Determine target mode:
    let mode = 'native-light';
    if (userWantsDark) {
      mode = (nativeTheme === 'dark') ? 'native-dark' : 'light-to-dark';
    } else {
      mode = (nativeTheme === 'dark') ? 'dark-to-light' : 'native-light';
    }
    this.currentMode = mode;

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

    // Update dedicated eye comfort warmth layer across all modes (Light & Dark)
    this.updateWarmthLayer();

    // Sliders
    const userB = (this.settings.brightness / 100);
    const userC = (this.settings.contrast / 100);

    if (mode === 'native-dark') {
      // 1. Site is ALREADY DARK & User wants DARK:
      // Preserves native dark mode cleanly. NO double inversion, NO black logo on black background.
      root.setAttribute('data-auradark-active', 'true');
      root.setAttribute('data-auradark-mode', 'native-dark');
      root.removeAttribute('data-auradark-preset');

      const finalBrightness = Math.round(100 * userB);
      const finalContrast = Math.round(100 * userC);

      let filterParts = [];
      if (finalContrast !== 100) filterParts.push(`contrast(${finalContrast}%)`);
      if (finalBrightness !== 100) filterParts.push(`brightness(${finalBrightness}%)`);

      const nativeFilter = filterParts.length > 0 ? filterParts.join(' ') : 'none';

      this.styleElement.textContent = `
        /* AuraDark: Preserving Native Dark Mode (Zero Inversion) */
        html[data-auradark-mode="native-dark"] {
          color-scheme: dark !important;
        }
        html[data-auradark-mode="native-dark"] > body {
          filter: ${nativeFilter} !important;
        }
        #auradark-floating-host {
          position: fixed !important;
          filter: none !important;
          z-index: 2147483647 !important;
        }
      `;
      return;
    }

    if (mode === 'dark-to-light') {
      // 2. Site is NATIVELY DARK & User wants LIGHT:
      // Inverts dark surface to crisp, elegant light mode with dark text on light paper.
      root.setAttribute('data-auradark-active', 'true');
      root.setAttribute('data-auradark-mode', 'dark-to-light');
      root.removeAttribute('data-auradark-preset');

      this.styleElement.textContent = `
        /* AuraDark: Converting Native Dark Page to Clean Light Mode */
        html[data-auradark-mode="dark-to-light"] {
          color-scheme: light !important;
          background-color: #f8fafc !important;
        }
        html[data-auradark-mode="dark-to-light"] > body {
          filter: invert(90%) hue-rotate(180deg) contrast(100%) brightness(98%) !important;
          background-color: #121316 !important;
          min-height: 100vh !important;
        }
        html[data-auradark-mode="dark-to-light"] img,
        html[data-auradark-mode="dark-to-light"] video,
        html[data-auradark-mode="dark-to-light"] svg image {
          filter: invert(100%) hue-rotate(180deg) !important;
        }
        #auradark-floating-host {
          position: fixed !important;
          filter: none !important;
          z-index: 2147483647 !important;
        }
      `;
      return;
    }

    if (mode === 'light-to-dark') {
      // 3. Site is NATIVELY LIGHT & User wants DARK:
      // Applies AuraDark perceptual theme presets.
      root.setAttribute('data-auradark-active', 'true');
      root.setAttribute('data-auradark-mode', 'light-to-dark');
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

      const finalBrightness = Math.round(baseBrightness * userB);
      const finalContrast = Math.round(baseContrast * userC);
      const finalSepia = baseSepia;

      let filterParts = [
        `invert(${baseInvert}%)`,
        `hue-rotate(${baseHueShift}deg)`,
        `contrast(${finalContrast}%)`,
        `brightness(${finalBrightness}%)`
      ];

      if (baseGrayscale > 0) filterParts.push(`grayscale(${baseGrayscale}%)`);
      if (finalSepia > 0) filterParts.push(`sepia(${finalSepia}%)`);
      if (baseSaturate !== 100) filterParts.push(`saturate(${baseSaturate}%)`);

      const rootFilter = filterParts.join(' ');

      this.styleElement.textContent = `
        html[data-auradark-mode="light-to-dark"] {
          color-scheme: dark !important;
          background-color: ${bgColor} !important;
        }
        html[data-auradark-mode="light-to-dark"] > body {
          filter: ${rootFilter} !important;
          background-color: #ffffff !important;
          min-height: 100vh !important;
        }
        #auradark-floating-host {
          position: fixed !important;
          filter: none !important;
          z-index: 2147483647 !important;
        }
      `;
      return;
    }

    // 4. mode === 'native-light':
    // Page is natively light and user wants light:
    root.removeAttribute('data-auradark-active');
    root.removeAttribute('data-auradark-mode');
    root.removeAttribute('data-auradark-preset');
    if (this.styleElement) {
      this.styleElement.textContent = '';
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
