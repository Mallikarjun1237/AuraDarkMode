/**
 * AuraDark Background Service Worker
 * Manages extension state, keyboard shortcuts, and badge indicator.
 */

const DEFAULT_SETTINGS = {
  auradark_enabled: true,
  auradark_preset: 'charcoal',
  auradark_brightness: 100,
  auradark_contrast: 100,
  auradark_warmth: 0,
  auradark_widget_pos: { x: 24, y: 24 },
  auradark_disabled_domains: []
};

// Set default configuration on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(null, (items) => {
    const initialized = { ...DEFAULT_SETTINGS, ...items };
    chrome.storage.local.set(initialized, () => {
      updateBadge(initialized.auradark_enabled);
    });
  });
});

// Update toolbar action badge
function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Listen for keyboard command (Alt+Shift+D)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-dark-mode') {
    chrome.storage.local.get(['auradark_enabled'], (res) => {
      const nextState = !res.auradark_enabled;
      chrome.storage.local.set({ auradark_enabled: nextState });
      updateBadge(nextState);

      // Notify active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-dark-mode' }).catch(() => {});
        }
      });
    });
  }
});

// Sync badge when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.auradark_enabled) {
    updateBadge(changes.auradark_enabled.newValue);
  }
});
