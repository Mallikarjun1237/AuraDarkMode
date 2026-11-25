/**
 * AuraDark Content Script Coordinator
 * Injected into every page and frame at document_start.
 * Fully guarded with isExtensionValid() to completely eliminate
 * "Extension context invalidated" errors when reloading the extension.
 */

(function () {
  if (window.__AURADARK_INITIALIZED__) return;
  window.__AURADARK_INITIALIZED__ = true;

  // Intercept any orphan context invalidation exceptions during extension reloads
  window.addEventListener('error', (event) => {
    if (event?.message && event.message.includes('Extension context invalidated')) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  /**
   * Safe check for extension runtime validity.
   * Accessing chrome.runtime on an invalidated context throws a C++ V8 error,
   * so this MUST be enclosed in a try-catch.
   */
  function isExtensionValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  // Abort immediately if context is already dead
  if (!isExtensionValid()) return;

  const colorEngine = new window.AuraColorEngine();
  const pdfEngine = new window.AuraPdfEngine();
  let widget = null;
  const isTopFrame = window === window.top;

  const defaultState = {
    auradark_enabled: true,
    auradark_preset: 'charcoal',
    auradark_brightness: 100,
    auradark_contrast: 100,
    auradark_warmth: 0,
    auradark_boost_contrast: false,
    auradark_dyslexic_font: false,
    auradark_pro_unlocked: false,
    auradark_widget_pos: { x: 24, y: 24 },
    auradark_disabled_domains: []
  };

  /**
   * Safe storage writer that prevents any unhandled errors when the extension reloads.
   */
  function safeStorageSet(data, callback) {
    if (!isExtensionValid()) return;
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(data, () => {
          try {
            if (!isExtensionValid()) return;
            if (chrome.runtime.lastError) return;
            if (callback) callback();
          } catch (_) {}
        });
      }
    } catch (_) {}
  }

  function isDomainDisabled(disabledList = []) {
    try {
      const host = window.location.hostname;
      return disabledList.some(domain => host.includes(domain));
    } catch (_) {
      return false;
    }
  }

  function init() {
    if (!isExtensionValid()) return;

    try {
      chrome.storage.local.get(defaultState, (stored) => {
        // Enclose async callback in try-catch to guard against context invalidation mid-flight
        try {
          if (!isExtensionValid() || !stored) return;

          const isSiteDisabled = isDomainDisabled(stored.auradark_disabled_domains);

          const engineSettings = {
            preset: stored.auradark_preset,
            brightness: stored.auradark_brightness,
            contrast: stored.auradark_contrast,
            warmth: stored.auradark_warmth,
            boostContrast: stored.auradark_boost_contrast,
            dyslexicFont: stored.auradark_dyslexic_font,
            siteEnabled: !isSiteDisabled
          };

          // 1. Initialize Color Engine across ALL frames
          colorEngine.init(engineSettings);
          
          const shouldActivate = stored.auradark_enabled && !isSiteDisabled;
          colorEngine.setActive(shouldActivate);

          // 2. Initialize PDF Engine across all frames
          pdfEngine.applyPdfTheme(shouldActivate);

          // 3. Mount Floating Widget ONLY in top frame
          const onDomReady = () => {
            try {
              if (!isTopFrame || !isExtensionValid()) return;
              if (widget) return;

              widget = new window.AuraFloatingWidget(
                // On Toggle
                (active) => {
                  colorEngine.setActive(active);
                  pdfEngine.applyPdfTheme(active);
                  safeStorageSet({ auradark_enabled: active });
                },
                // On Setting Change
                (changed) => {
                  colorEngine.updateSettings(changed);
                  const storageUpdates = {};
                  if (changed.preset) storageUpdates.auradark_preset = changed.preset;
                  if (changed.brightness) storageUpdates.auradark_brightness = changed.brightness;
                  if (changed.contrast) storageUpdates.auradark_contrast = changed.contrast;
                  if (changed.warmth) storageUpdates.auradark_warmth = changed.warmth;
                  if (changed.boostContrast !== undefined) storageUpdates.auradark_boost_contrast = changed.boostContrast;
                  if (changed.dyslexicFont !== undefined) storageUpdates.auradark_dyslexic_font = changed.dyslexicFont;
                  if (changed.proUnlocked !== undefined) storageUpdates.auradark_pro_unlocked = changed.proUnlocked;
                  safeStorageSet(storageUpdates);
                },
                // On Position Change
                (pos) => {
                  safeStorageSet({ auradark_widget_pos: pos });
                }
              );

              widget.currentPos = stored.auradark_widget_pos || { x: 24, y: 24 };
              widget.mount({
                active: shouldActivate,
                preset: stored.auradark_preset,
                brightness: stored.auradark_brightness,
                contrast: stored.auradark_contrast,
                warmth: stored.auradark_warmth,
                boostContrast: stored.auradark_boost_contrast,
                dyslexicFont: stored.auradark_dyslexic_font,
                proUnlocked: stored.auradark_pro_unlocked,
                siteEnabled: !isSiteDisabled
              });
            } catch (_) {}
          };

          if (document.readyState === 'interactive' || document.readyState === 'complete' || document.body) {
            onDomReady();
          } else {
            document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
          }
        } catch (_) {
          // Gracefully handle context invalidation if user reloaded extension
        }
      });
    } catch (_) {}
  }

  // Real-time synchronization via storage changes
  try {
    if (isExtensionValid() && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        try {
          if (!isExtensionValid() || area !== 'local') return;

          if (changes.auradark_enabled) {
            const nextState = changes.auradark_enabled.newValue;
            colorEngine.setActive(nextState);
            pdfEngine.applyPdfTheme(nextState);
            if (widget) {
              widget.updateState({ active: nextState });
            }
          }

          if (changes.auradark_preset || changes.auradark_brightness || changes.auradark_contrast ||
              changes.auradark_warmth || changes.auradark_boost_contrast || changes.auradark_dyslexic_font ||
              changes.auradark_pro_unlocked) {
            const updates = {};
            if (changes.auradark_preset) updates.preset = changes.auradark_preset.newValue;
            if (changes.auradark_brightness) updates.brightness = changes.auradark_brightness.newValue;
            if (changes.auradark_contrast) updates.contrast = changes.auradark_contrast.newValue;
            if (changes.auradark_warmth) updates.warmth = changes.auradark_warmth.newValue;
            if (changes.auradark_boost_contrast) updates.boostContrast = changes.auradark_boost_contrast.newValue;
            if (changes.auradark_dyslexic_font) updates.dyslexicFont = changes.auradark_dyslexic_font.newValue;
            if (changes.auradark_pro_unlocked) updates.proUnlocked = changes.auradark_pro_unlocked.newValue;
            colorEngine.updateSettings(updates);
            if (widget) {
              widget.updateState(updates);
            }
          }
        } catch (_) {}
      });
    }
  } catch (_) {}

  // Listen for direct runtime messages
  try {
    if (isExtensionValid() && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          if (!isExtensionValid()) return false;

          if (message.action === 'toggle-dark-mode') {
            const nextState = message.enabled !== undefined ? message.enabled : !colorEngine.isActive;
            colorEngine.setActive(nextState);
            pdfEngine.applyPdfTheme(nextState);
            if (widget) {
              widget.updateState({ active: nextState });
            }
            safeStorageSet({ auradark_enabled: nextState });
            sendResponse({ success: true, active: nextState });
          } else if (message.action === 'update-settings') {
            colorEngine.updateSettings(message.settings);
            if (widget) {
              widget.updateState(message.settings);
            }
            sendResponse({ success: true });
          } else if (message.action === 'reset-widget-position') {
            if (widget) {
              widget.resetPosition();
            }
            sendResponse({ success: true });
          }
        } catch (_) {}
        return true;
      });
    }
  } catch (_) {}

  // Start immediately
  init();
})();
