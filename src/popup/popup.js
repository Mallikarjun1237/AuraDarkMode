/**
 * AuraDark Popup Controller
 * Connects UI controls to chrome.storage and sends live updates to the active tab.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const masterToggle = document.getElementById('masterToggle');
  const masterStatusText = document.getElementById('masterStatusText');
  const siteToggleBtn = document.getElementById('siteToggleBtn');
  const currentDomainEl = document.getElementById('currentDomain');
  
  const bSlider = document.getElementById('inputBrightness');
  const wSlider = document.getElementById('inputWarmth');
  const cSlider = document.getElementById('inputContrast');

  const bVal = document.getElementById('valBrightness');
  const wVal = document.getElementById('valWarmth');
  const cVal = document.getElementById('valContrast');

  const presetButtons = document.querySelectorAll('.preset-btn');

  let currentTab = null;
  let currentHostname = '';
  let disabledDomains = [];

  // Query active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    if (currentTab?.url) {
      try {
        const urlObj = new URL(currentTab.url);
        currentHostname = urlObj.hostname;
        currentDomainEl.textContent = currentHostname || 'Local / Internal';
      } catch (_) {
        currentDomainEl.textContent = 'Special Page';
      }
    }
  } catch (err) {
    console.error('Tab query failed', err);
  }

  const toggleBoost = document.getElementById('toggleBoostContrast');
  const toggleDyslexic = document.getElementById('toggleDyslexicFont');

  const btnEnterKey = document.getElementById('btnEnterKey');
  const keyInputRow = document.getElementById('keyInputRow');
  const licenseKeyInput = document.getElementById('licenseKeyInput');
  const btnActivateKey = document.getElementById('btnActivateKey');
  const licenseStatusText = document.getElementById('licenseStatusText');

  function validateKey(raw) {
    if (!raw || typeof raw !== 'string') return false;
    const clean = raw.trim().toUpperCase();
    if (['AURA-PRO-2026', 'AURA-STUDENT-2026', 'AURA-LIFETIME-PRO'].includes(clean)) return true;
    const parts = clean.split('-');
    if (parts.length !== 4 || parts[0] !== 'AURA') return false;
    let sum = 0;
    for (const ch of (parts[1] + parts[2])) {
      sum += ch.charCodeAt(0);
    }
    const expected = (sum % 899 + 100).toString();
    return parts[3] === expected;
  }

  // Load storage state
  chrome.storage.local.get([
    'auradark_enabled',
    'auradark_preset',
    'auradark_brightness',
    'auradark_contrast',
    'auradark_warmth',
    'auradark_boost_contrast',
    'auradark_dyslexic_font',
    'auradark_pro_unlocked',
    'auradark_disabled_domains'
  ], (stored) => {
    const isEnabled = stored.auradark_enabled !== false;
    masterToggle.checked = isEnabled;
    updateStatusText(isEnabled);

    disabledDomains = stored.auradark_disabled_domains || [];
    updateSiteButtonState();

    // Presets
    const activePreset = stored.auradark_preset || 'charcoal';
    setActivePreset(activePreset);

    // Sliders
    const b = stored.auradark_brightness || 100;
    const w = stored.auradark_warmth || 0;
    const c = stored.auradark_contrast || 100;

    bSlider.value = b;
    bVal.textContent = `${b}%`;

    wSlider.value = w;
    wVal.textContent = `${w}%`;

    cSlider.value = c;
    cVal.textContent = `${c}%`;

    // Accessibility
    if (toggleBoost) toggleBoost.checked = Boolean(stored.auradark_boost_contrast);
    if (toggleDyslexic) toggleDyslexic.checked = Boolean(stored.auradark_dyslexic_font);

    // License
    const isPro = Boolean(stored.auradark_pro_unlocked);
    if (licenseStatusText) {
      licenseStatusText.textContent = isPro ? 'Unlocked (Pro Lifetime)' : 'Free Tier (Unlock Pro: ₹50 / $1)';
      licenseStatusText.style.color = isPro ? '#4ade80' : '#94a3b8';
    }
    if (btnEnterKey && isPro) {
      btnEnterKey.textContent = 'Active ✓';
      btnEnterKey.style.borderColor = '#22c55e';
      btnEnterKey.style.color = '#4ade80';
    }
  });

  function updateStatusText(active) {
    masterStatusText.textContent = active ? 'Smart semantic theme active' : 'Dark mode paused';
    masterStatusText.style.color = active ? '#818cf8' : '#94a3b8';
  }

  function updateSiteButtonState() {
    if (!currentHostname) {
      siteToggleBtn.disabled = true;
      siteToggleBtn.textContent = 'N/A';
      return;
    }
    const isExcluded = disabledDomains.includes(currentHostname);
    if (isExcluded) {
      siteToggleBtn.textContent = 'Disabled';
      siteToggleBtn.classList.add('disabled');
    } else {
      siteToggleBtn.textContent = 'Enabled';
      siteToggleBtn.classList.remove('disabled');
    }
  }

  function setActivePreset(presetName) {
    presetButtons.forEach(btn => {
      if (btn.getAttribute('data-preset') === presetName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function sendTabUpdate(action, payload) {
    if (currentTab?.id) {
      chrome.tabs.sendMessage(currentTab.id, { action, ...payload }).catch(() => {});
    }
  }

  // Master Toggle event
  masterToggle.addEventListener('change', () => {
    const isEnabled = masterToggle.checked;
    updateStatusText(isEnabled);
    chrome.storage.local.set({ auradark_enabled: isEnabled });
    sendTabUpdate('toggle-dark-mode', { enabled: isEnabled });
  });

  // Site Toggle event
  siteToggleBtn.addEventListener('click', () => {
    if (!currentHostname) return;
    const idx = disabledDomains.indexOf(currentHostname);
    if (idx > -1) {
      disabledDomains.splice(idx, 1);
    } else {
      disabledDomains.push(currentHostname);
    }
    chrome.storage.local.set({ auradark_disabled_domains: disabledDomains }, () => {
      updateSiteButtonState();
      // Reload tab to cleanly update site state
      if (currentTab?.id) {
        chrome.tabs.reload(currentTab.id);
      }
    });
  });

  // Preset Buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      setActivePreset(preset);
      chrome.storage.local.set({ auradark_preset: preset });
      sendTabUpdate('update-settings', { settings: { preset } });
    });
  });

  // Brightness
  bSlider.addEventListener('input', () => {
    const val = parseInt(bSlider.value, 10);
    bVal.textContent = `${val}%`;
    chrome.storage.local.set({ auradark_brightness: val });
    sendTabUpdate('update-settings', { settings: { brightness: val } });
  });

  // Warmth
  wSlider.addEventListener('input', () => {
    const val = parseInt(wSlider.value, 10);
    wVal.textContent = `${val}%`;
    chrome.storage.local.set({ auradark_warmth: val });
    sendTabUpdate('update-settings', { settings: { warmth: val } });
  });

  // Contrast
  cSlider.addEventListener('input', () => {
    const val = parseInt(cSlider.value, 10);
    cVal.textContent = `${val}%`;
    chrome.storage.local.set({ auradark_contrast: val });
    sendTabUpdate('update-settings', { settings: { contrast: val } });
  });

  // Accessibility Toggles
  if (toggleBoost) {
    toggleBoost.addEventListener('change', () => {
      const active = toggleBoost.checked;
      chrome.storage.local.set({ auradark_boost_contrast: active });
      sendTabUpdate('update-settings', { settings: { boostContrast: active } });
    });
  }

  if (toggleDyslexic) {
    toggleDyslexic.addEventListener('change', () => {
      const active = toggleDyslexic.checked;
      chrome.storage.local.set({ auradark_dyslexic_font: active });
      sendTabUpdate('update-settings', { settings: { dyslexicFont: active } });
    });
  }

  // License Key Activation
  if (btnEnterKey && keyInputRow) {
    btnEnterKey.addEventListener('click', () => {
      const isVisible = keyInputRow.style.display === 'flex';
      keyInputRow.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible && licenseKeyInput) {
        licenseKeyInput.focus();
      }
    });
  }

  if (btnActivateKey && licenseKeyInput) {
    btnActivateKey.addEventListener('click', () => {
      const key = licenseKeyInput.value.trim();
      if (validateKey(key)) {
        chrome.storage.local.set({ auradark_pro_unlocked: true });
        sendTabUpdate('update-settings', { settings: { proUnlocked: true } });
        if (licenseStatusText) {
          licenseStatusText.textContent = 'Unlocked (Pro Lifetime)';
          licenseStatusText.style.color = '#4ade80';
        }
        btnEnterKey.textContent = 'Active ✓';
        btnEnterKey.style.borderColor = '#22c55e';
        btnEnterKey.style.color = '#4ade80';
        keyInputRow.style.display = 'none';
        alert('🎉 AuraDark Pro successfully activated! All 8 themes and features unlocked.');
      } else {
        alert('❌ Invalid license key. Please check your key or contact support.');
      }
    });
  }

  // Reset Widget Position
  const resetWidgetBtn = document.getElementById('resetWidgetBtn');
  if (resetWidgetBtn) {
    resetWidgetBtn.addEventListener('click', () => {
      chrome.storage.local.set({ auradark_widget_pos: { x: 24, y: 24 } }, () => {
        sendTabUpdate('reset-widget-position', {});
        resetWidgetBtn.textContent = 'Reset Done!';
        setTimeout(() => { resetWidgetBtn.textContent = 'Reset Widget'; }, 1500);
      });
    });
  }
});
