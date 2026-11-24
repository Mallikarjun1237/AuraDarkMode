/**
 * AuraDark Content Script Coordinator
 * Injected into every page and frame at document_start.
 * Safely guards all chrome.* APIs and synchronizes storage changes in real-time.
 */

(function () {
  if (window.__AURADARK_INITIALIZED__) return;
  window.__AURADARK_INITIALIZED__ = true;

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
    auradark_widget_pos: { x: 24, y: 24 },
    auradark_disabled_domains: []
  };

  function safeStorageSet(data, callback) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            // Silently ignore context invalidation
          } else if (callback) {
            callback();
          }
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
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id || !chrome.storage) {
        return;
      }

      chrome.storage.local.get(defaultState, (stored) => {
        if (chrome.runtime.lastError || !stored) return;

        const isSiteDisabled = isDomainDisabled(stored.auradark_disabled_domains);

        const engineSettings = {
          preset: stored.auradark_preset,
          brightness: stored.auradark_brightness,
          contrast: stored.auradark_contrast,
          warmth: stored.auradark_warmth,
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
          if (!isTopFrame) return;
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
              safeStorageSet(storageUpdates);
            }
          );

          widget.currentPos = stored.auradark_widget_pos || { x: 24, y: 24 };
          widget.mount({
            active: shouldActivate,
            preset: stored.auradark_preset,
            brightness: stored.auradark_brightness,
            contrast: stored.auradark_contrast,
            warmth: stored.auradark_warmth,
            siteEnabled: !isSiteDisabled
          });
        };

        if (document.readyState === 'interactive' || document.readyState === 'complete' || document.body) {
          onDomReady();
        } else {
          document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
        }
      });
    } catch (_) {}
  }

  // Real-time synchronization via storage changes
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        try {
          if (area !== 'local' || !chrome.runtime?.id) return;

          if (changes.auradark_enabled) {
            const nextState = changes.auradark_enabled.newValue;
            colorEngine.setActive(nextState);
            pdfEngine.applyPdfTheme(nextState);
            if (widget) {
              widget.updateState({ active: nextState });
            }
          }

          if (changes.auradark_preset || changes.auradark_brightness || changes.auradark_contrast || changes.auradark_warmth) {
            const updates = {};
            if (changes.auradark_preset) updates.preset = changes.auradark_preset.newValue;
            if (changes.auradark_brightness) updates.brightness = changes.auradark_brightness.newValue;
            if (changes.auradark_contrast) updates.contrast = changes.auradark_contrast.newValue;
            if (changes.auradark_warmth) updates.warmth = changes.auradark_warmth.newValue;
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
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          if (!chrome.runtime?.id) return false;

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
