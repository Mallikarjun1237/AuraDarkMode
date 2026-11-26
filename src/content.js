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

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    if (msg.includes('Extension context invalidated')) {
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

  // 0. Zero-Flash Smart Whiteout Shield: Synchronous paint guard before DOM render
  try {
    const shieldHost = window.location.hostname;
    const cachedMode = sessionStorage.getItem('auradark_mode_' + shieldHost);
    if (document.documentElement) {
      if (cachedMode === 'light-to-dark') {
        document.documentElement.style.backgroundColor = '#121316';
        document.documentElement.setAttribute('data-auradark-active', 'true');
        document.documentElement.setAttribute('data-auradark-mode', 'light-to-dark');
      } else if (cachedMode === 'native-dark') {
        document.documentElement.style.colorScheme = 'dark';
        document.documentElement.setAttribute('data-auradark-active', 'true');
        document.documentElement.setAttribute('data-auradark-mode', 'native-dark');
      } else if (cachedMode === 'dark-to-light') {
        document.documentElement.style.backgroundColor = '#f8fafc';
        document.documentElement.setAttribute('data-auradark-active', 'true');
        document.documentElement.setAttribute('data-auradark-mode', 'dark-to-light');
      }
    }
  } catch (_) {}

  // Abort immediately if context is already dead
  if (!isExtensionValid()) return;

  const colorEngine = new window.AuraColorEngine();
  const pdfEngine = new window.AuraPdfEngine();
  let widget = null;
  const isTopFrame = window === window.top;

  const defaultState = {
    auradark_enabled: true,
    auradark_scope_mode: 'per_site',
    auradark_site_states: {},
    auradark_site_presets: {},
    auradark_preset: 'charcoal',
    auradark_brightness: 100,
    auradark_contrast: 100,
    auradark_warmth: 0,
    auradark_auto_warmth: false,
    auradark_boost_contrast: false,
    auradark_dyslexic_font: false,
    auradark_pro_unlocked: false,
    auradark_widget_pos: { x: 24, y: 24 },
    auradark_disabled_domains: []
  };

  /**
   * Safe storage reader that prevents unhandled exceptions when extension reloads.
   */
  function safeStorageGet(keys, callback) {
    if (!isExtensionValid()) return;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, (res) => {
          try {
            if (!isExtensionValid() || chrome.runtime.lastError) return;
            if (callback) callback(res);
          } catch (_) {}
        });
      }
    } catch (_) {}
  }

  /**
   * Safe storage writer that prevents any unhandled errors when the extension reloads.
   */
  function safeStorageSet(data, callback) {
    if (!isExtensionValid()) return;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(data, () => {
          try {
            if (!isExtensionValid() || chrome.runtime.lastError) return;
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

  function evaluateSiteActivation(stored) {
    if (!stored) return false;
    const host = window.location.hostname;
    if (isDomainDisabled(stored.auradark_disabled_domains)) return false;

    const scopeMode = stored.auradark_scope_mode || 'per_site';
    if (scopeMode === 'per_site') {
      const siteStates = stored.auradark_site_states || {};
      if (siteStates[host] !== undefined) {
        return Boolean(siteStates[host]);
      }
    }
    return Boolean(stored.auradark_enabled);
  }

  function init() {
    if (!isExtensionValid()) return;

    safeStorageGet(defaultState, (stored) => {
      try {
        if (!isExtensionValid() || !stored) return;

        const host = window.location.hostname;
        const isSiteDisabled = isDomainDisabled(stored.auradark_disabled_domains);
        const shouldActivate = evaluateSiteActivation(stored);

        // In per-site mode, load site-specific theme preset if present
        const scopeMode = stored.auradark_scope_mode || 'per_site';
        const sitePresets = stored.auradark_site_presets || {};
        const siteConfig = (scopeMode === 'per_site' && sitePresets[host]) ? sitePresets[host] : {};

        const activePreset = siteConfig.preset || stored.auradark_preset;
        const activeBrightness = siteConfig.brightness !== undefined ? siteConfig.brightness : stored.auradark_brightness;
        const activeContrast = siteConfig.contrast !== undefined ? siteConfig.contrast : stored.auradark_contrast;
        const activeWarmth = siteConfig.warmth !== undefined ? siteConfig.warmth : stored.auradark_warmth;

        const engineSettings = {
          preset: activePreset,
          brightness: activeBrightness,
          contrast: activeContrast,
          warmth: activeWarmth,
          autoWarmth: Boolean(stored.auradark_auto_warmth),
          boostContrast: Boolean(stored.auradark_boost_contrast),
          dyslexicFont: Boolean(stored.auradark_dyslexic_font),
          siteEnabled: !isSiteDisabled
        };

        // 1. Initialize Color Engine across ALL frames
        colorEngine.init(engineSettings);
        colorEngine.setActive(shouldActivate);

        // Update synchronous shield cache for 0ms page loads
        try {
          sessionStorage.setItem('auradark_mode_' + host, colorEngine.currentMode || (shouldActivate ? 'light-to-dark' : 'native-light'));
        } catch (_) {}

        // 2. Initialize PDF Engine across all frames
        pdfEngine.applyPdfTheme(shouldActivate);

        // 3. Mount Floating Widget ONLY in top frame
        const onDomReady = () => {
          try {
            if (!isTopFrame || !isExtensionValid()) return;
            if (widget) return;

            widget = new window.AuraFloatingWidget(
              // On Toggle (respects Per-Site vs Global scope)
              (active) => {
                colorEngine.setActive(active);
                pdfEngine.applyPdfTheme(active);

                // Update synchronous shield cache
                try {
                  sessionStorage.setItem('auradark_mode_' + host, colorEngine.currentMode || (active ? 'light-to-dark' : 'native-light'));
                } catch (_) {}

                safeStorageGet(['auradark_scope_mode', 'auradark_site_states'], (s) => {
                  if (!isExtensionValid()) return;
                  const currentScope = s?.auradark_scope_mode || 'per_site';
                  if (currentScope === 'per_site') {
                    const states = s?.auradark_site_states || {};
                    states[host] = active;
                    safeStorageSet({ auradark_site_states: states });
                  } else {
                    safeStorageSet({ auradark_enabled: active });
                  }
                });
              },
              // On Setting Change
              (changed) => {
                colorEngine.updateSettings(changed);

                safeStorageGet(['auradark_scope_mode', 'auradark_site_presets'], (s) => {
                  if (!isExtensionValid()) return;
                  const currentScope = s?.auradark_scope_mode || 'per_site';
                  
                  if (currentScope === 'per_site') {
                    const presets = s?.auradark_site_presets || {};
                    presets[host] = { ...(presets[host] || {}), ...changed };
                    safeStorageSet({ auradark_site_presets: presets });
                  } else {
                    const storageUpdates = {};
                    if (changed.preset) storageUpdates.auradark_preset = changed.preset;
                    if (changed.brightness !== undefined) storageUpdates.auradark_brightness = changed.brightness;
                    if (changed.contrast !== undefined) storageUpdates.auradark_contrast = changed.contrast;
                    if (changed.warmth !== undefined) storageUpdates.auradark_warmth = changed.warmth;
                    if (changed.boostContrast !== undefined) storageUpdates.auradark_boost_contrast = changed.boostContrast;
                    if (changed.dyslexicFont !== undefined) storageUpdates.auradark_dyslexic_font = changed.dyslexicFont;
                    if (changed.proUnlocked !== undefined) storageUpdates.auradark_pro_unlocked = changed.proUnlocked;
                    safeStorageSet(storageUpdates);
                  }
                });
              },
              // On Position Change
              (pos) => {
                safeStorageSet({ auradark_widget_pos: pos });
              }
            );

            widget.currentPos = stored.auradark_widget_pos || { x: 24, y: 24 };
            widget.mount({
              active: shouldActivate,
              preset: activePreset,
              brightness: activeBrightness,
              contrast: activeContrast,
              warmth: activeWarmth,
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
      } catch (_) {}
    });
  }

  // Real-time synchronization via storage changes
  try {
    if (isExtensionValid() && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        try {
          if (!isExtensionValid() || area !== 'local') return;

          const host = window.location.hostname;

          // Per-site state changes
          if (changes.auradark_site_states) {
            const nextStates = changes.auradark_site_states.newValue || {};
            if (nextStates[host] !== undefined) {
              const nextState = Boolean(nextStates[host]);
              try {
                sessionStorage.setItem('auradark_active_site_' + host, nextState ? 'true' : 'false');
              } catch (_) {}
              colorEngine.setActive(nextState);
              pdfEngine.applyPdfTheme(nextState);
              if (widget) widget.updateState({ active: nextState });
            }
          }

          // Per-site preset changes
          if (changes.auradark_site_presets) {
            const nextPresets = changes.auradark_site_presets.newValue || {};
            if (nextPresets[host]) {
              colorEngine.updateSettings(nextPresets[host]);
              if (widget) widget.updateState(nextPresets[host]);
            }
          }

          // Global toggle or scope mode change
          if (changes.auradark_enabled || changes.auradark_scope_mode) {
            safeStorageGet(defaultState, (currentStored) => {
              try {
                if (!isExtensionValid() || !currentStored) return;
                const nextState = evaluateSiteActivation(currentStored);
                try {
                  sessionStorage.setItem('auradark_active_site_' + host, nextState ? 'true' : 'false');
                } catch (_) {}
                colorEngine.setActive(nextState);
                pdfEngine.applyPdfTheme(nextState);
                if (widget) widget.updateState({ active: nextState });
              } catch (_) {}
            });
          }

          if (changes.auradark_preset || changes.auradark_brightness || changes.auradark_contrast ||
              changes.auradark_warmth || changes.auradark_auto_warmth ||
              changes.auradark_boost_contrast || changes.auradark_dyslexic_font || changes.auradark_pro_unlocked) {
            const updates = {};
            if (changes.auradark_preset) updates.preset = changes.auradark_preset.newValue;
            if (changes.auradark_brightness) updates.brightness = changes.auradark_brightness.newValue;
            if (changes.auradark_contrast) updates.contrast = changes.auradark_contrast.newValue;
            if (changes.auradark_warmth) updates.warmth = changes.auradark_warmth.newValue;
            if (changes.auradark_auto_warmth !== undefined) updates.autoWarmth = changes.auradark_auto_warmth.newValue;
            if (changes.auradark_boost_contrast !== undefined) updates.boostContrast = changes.auradark_boost_contrast.newValue;
            if (changes.auradark_dyslexic_font !== undefined) updates.dyslexicFont = changes.auradark_dyslexic_font.newValue;
            if (changes.auradark_pro_unlocked !== undefined) updates.proUnlocked = changes.auradark_pro_unlocked.newValue;
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
            const host = window.location.hostname;
            if (message.scope === 'per_site' && message.site && message.site !== host) {
              return true;
            }
            const nextState = message.enabled !== undefined ? message.enabled : !colorEngine.isActive;
            try {
              sessionStorage.setItem('auradark_active_site_' + host, nextState ? 'true' : 'false');
            } catch (_) {}
            colorEngine.setActive(nextState);
            pdfEngine.applyPdfTheme(nextState);
            if (widget) {
              widget.updateState({ active: nextState });
            }
            try {
              sendResponse({ success: true, active: nextState });
            } catch (_) {}
          } else if (message.action === 'update-settings') {
            colorEngine.updateSettings(message.settings);
            if (widget) {
              widget.updateState(message.settings);
            }
            try {
              sendResponse({ success: true });
            } catch (_) {}
          } else if (message.action === 'reset-widget-position') {
            if (widget) {
              widget.resetPosition();
            }
            try {
              sendResponse({ success: true });
            } catch (_) {}
          }
        } catch (_) {}
        return true;
      });
    }
  } catch (_) {}

  // Start immediately
  init();
})();
