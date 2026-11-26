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
  const toggleAutoWarmth = document.getElementById('toggleAutoWarmth');
  const nightWarmthBadge = document.getElementById('nightWarmthBadge');
  const nightWarmthScheduleText = document.getElementById('nightWarmthScheduleText');

  function updateNightScheduleBadge(isAutoWarmthEnabled) {
    if (!nightWarmthBadge || !nightWarmthScheduleText) return;
    const now = new Date();
    const currentHour = now.getHours() + (now.getMinutes() / 60);
    const isNight = currentHour >= 20 || currentHour < 7;
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (!isAutoWarmthEnabled) {
      nightWarmthBadge.textContent = 'OFF';
      nightWarmthBadge.style.background = 'rgba(255, 255, 255, 0.08)';
      nightWarmthBadge.style.color = '#94a3b8';
      nightWarmthScheduleText.textContent = `Live at ${timeStr} • Disabled (Toggle to run 8 PM – 7 AM)`;
      return;
    }

    if (isNight) {
      nightWarmthBadge.textContent = '● ACTIVE (NIGHT)';
      nightWarmthBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      nightWarmthBadge.style.color = '#34d399';
      nightWarmthScheduleText.textContent = `Live at ${timeStr} • +25% warmth active till 7:00 AM`;
    } else {
      nightWarmthBadge.textContent = '○ SCHEDULED';
      nightWarmthBadge.style.background = 'rgba(99, 102, 241, 0.2)';
      nightWarmthBadge.style.color = '#a5b4fc';
      nightWarmthScheduleText.textContent = `Live at ${timeStr} • Starts automatically at 8:00 PM`;
    }
  }

  const scopePerSiteBtn = document.getElementById('scopePerSiteBtn');
  const scopeGlobalBtn = document.getElementById('scopeGlobalBtn');
  const scopeDesc = document.getElementById('scopeDesc');
  const headerProBadge = document.getElementById('headerProBadge');

  const licenseSection = document.getElementById('licenseSection');
  const btnEnterKey = document.getElementById('btnEnterKey');
  const keyInputRow = document.getElementById('keyInputRow');
  const licenseKeyInput = document.getElementById('licenseKeyInput');
  const btnActivateKey = document.getElementById('btnActivateKey');
  const licenseStatusText = document.getElementById('licenseStatusText');

  let currentScopeMode = 'per_site';
  let siteStates = {};
  let sitePresets = {};

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

  function updateScopeUI(mode) {
    currentScopeMode = mode;
    if (mode === 'per_site') {
      scopePerSiteBtn?.classList.add('active');
      scopeGlobalBtn?.classList.remove('active');
      if (scopePerSiteBtn) { scopePerSiteBtn.style.background = '#4f46e5'; scopePerSiteBtn.style.color = '#ffffff'; }
      if (scopeGlobalBtn) { scopeGlobalBtn.style.background = 'transparent'; scopeGlobalBtn.style.color = '#94a3b8'; }
      if (scopeDesc) scopeDesc.textContent = 'Apply to this site only';
      
      const siteEnabled = siteStates[currentHostname] !== undefined ? siteStates[currentHostname] : masterToggle.checked;
      masterToggle.checked = siteEnabled;
      updateStatusText(siteEnabled);
    } else {
      scopeGlobalBtn?.classList.add('active');
      scopePerSiteBtn?.classList.remove('active');
      if (scopeGlobalBtn) { scopeGlobalBtn.style.background = '#4f46e5'; scopeGlobalBtn.style.color = '#ffffff'; }
      if (scopePerSiteBtn) { scopePerSiteBtn.style.background = 'transparent'; scopePerSiteBtn.style.color = '#94a3b8'; }
      if (scopeDesc) scopeDesc.textContent = 'Apply to all tabs globally';
    }
  }

  function saveSettingUpdate(changed) {
    if (currentScopeMode === 'per_site' && currentHostname) {
      if (!sitePresets[currentHostname]) sitePresets[currentHostname] = {};
      Object.assign(sitePresets[currentHostname], changed);
      chrome.storage.local.set({ auradark_site_presets: sitePresets });
    } else {
      const updates = {};
      if (changed.preset) updates.auradark_preset = changed.preset;
      if (changed.brightness !== undefined) updates.auradark_brightness = changed.brightness;
      if (changed.contrast !== undefined) updates.auradark_contrast = changed.contrast;
      if (changed.warmth !== undefined) updates.auradark_warmth = changed.warmth;
      chrome.storage.local.set(updates);
    }
    sendTabUpdate('update-settings', { settings: changed });
  }

  // Load storage state
  chrome.storage.local.get([
    'auradark_enabled',
    'auradark_scope_mode',
    'auradark_site_states',
    'auradark_site_presets',
    'auradark_preset',
    'auradark_brightness',
    'auradark_contrast',
    'auradark_warmth',
    'auradark_auto_warmth',
    'auradark_boost_contrast',
    'auradark_dyslexic_font',
    'auradark_pro_unlocked',
    'auradark_disabled_domains'
  ], (stored) => {
    currentScopeMode = stored.auradark_scope_mode || 'per_site';
    siteStates = stored.auradark_site_states || {};
    sitePresets = stored.auradark_site_presets || {};

    let isEnabled = stored.auradark_enabled !== false;
    if (currentScopeMode === 'per_site' && currentHostname) {
      if (siteStates[currentHostname] !== undefined) {
        isEnabled = Boolean(siteStates[currentHostname]);
      }
    }

    masterToggle.checked = isEnabled;
    updateStatusText(isEnabled);
    updateScopeUI(currentScopeMode);

    disabledDomains = stored.auradark_disabled_domains || [];
    updateSiteButtonState();

    // Check if current site has custom preset and slider values
    const currentSiteConfig = (currentScopeMode === 'per_site' && sitePresets[currentHostname])
      ? sitePresets[currentHostname]
      : {};

    const activePreset = currentSiteConfig.preset || stored.auradark_preset || 'charcoal';
    setActivePreset(activePreset);

    // Sliders
    const b = currentSiteConfig.brightness !== undefined ? currentSiteConfig.brightness : (stored.auradark_brightness || 100);
    const w = currentSiteConfig.warmth !== undefined ? currentSiteConfig.warmth : (stored.auradark_warmth || 0);
    const c = currentSiteConfig.contrast !== undefined ? currentSiteConfig.contrast : (stored.auradark_contrast || 100);

    bSlider.value = b;
    bVal.textContent = `${b}%`;

    wSlider.value = w;
    wVal.textContent = `${w}%`;

    cSlider.value = c;
    cVal.textContent = `${c}%`;

    // Accessibility & Features
    if (toggleBoost) toggleBoost.checked = Boolean(stored.auradark_boost_contrast);
    if (toggleDyslexic) toggleDyslexic.checked = Boolean(stored.auradark_dyslexic_font);
    if (toggleAutoWarmth) {
      const isAutoWarmth = Boolean(stored.auradark_auto_warmth);
      toggleAutoWarmth.checked = isAutoWarmth;
      updateNightScheduleBadge(isAutoWarmth);
    }

    // License: If user is Pro, completely hide the license card!
    const isPro = Boolean(stored.auradark_pro_unlocked);
    if (licenseSection) {
      licenseSection.style.display = isPro ? 'none' : 'block';
    }
    if (headerProBadge) {
      headerProBadge.style.display = isPro ? 'inline-block' : 'none';
    }
  });

  function updateStatusText(active) {
    masterStatusText.textContent = active ? 'Active • Dark theme enabled' : 'Active • Light theme enabled';
    masterStatusText.style.color = active ? '#818cf8' : '#38bdf8';
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

  // Scope Buttons event
  if (scopePerSiteBtn) {
    scopePerSiteBtn.addEventListener('click', () => {
      updateScopeUI('per_site');
      chrome.storage.local.set({ auradark_scope_mode: 'per_site' });
      sendTabUpdate('update-settings', { scopeMode: 'per_site' });
    });
  }

  if (scopeGlobalBtn) {
    scopeGlobalBtn.addEventListener('click', () => {
      updateScopeUI('global');
      chrome.storage.local.set({ auradark_scope_mode: 'global' });
      sendTabUpdate('update-settings', { scopeMode: 'global' });
    });
  }

  // Master Toggle event (respects per-site vs global scope)
  masterToggle.addEventListener('change', () => {
    const isEnabled = masterToggle.checked;
    updateStatusText(isEnabled);

    if (currentScopeMode === 'per_site' && currentHostname) {
      siteStates[currentHostname] = isEnabled;
      chrome.storage.local.set({ auradark_site_states: siteStates });
      sendTabUpdate('toggle-dark-mode', { enabled: isEnabled, site: currentHostname, scope: 'per_site' });
    } else {
      chrome.storage.local.set({ auradark_enabled: isEnabled });
      sendTabUpdate('toggle-dark-mode', { enabled: isEnabled, scope: 'global' });
    }
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
      saveSettingUpdate({ preset });
    });
  });

  // Brightness
  bSlider.addEventListener('input', () => {
    const val = parseInt(bSlider.value, 10);
    bVal.textContent = `${val}%`;
    saveSettingUpdate({ brightness: val });
  });

  // Warmth
  wSlider.addEventListener('input', () => {
    const val = parseInt(wSlider.value, 10);
    wVal.textContent = `${val}%`;
    saveSettingUpdate({ warmth: val });
  });

  // Contrast
  cSlider.addEventListener('input', () => {
    const val = parseInt(cSlider.value, 10);
    cVal.textContent = `${val}%`;
    saveSettingUpdate({ contrast: val });
  });

  // Feature 3: Auto Night Warmth
  if (toggleAutoWarmth) {
    toggleAutoWarmth.addEventListener('change', () => {
      const active = toggleAutoWarmth.checked;
      updateNightScheduleBadge(active);
      chrome.storage.local.set({ auradark_auto_warmth: active });
      sendTabUpdate('update-settings', { settings: { autoWarmth: active } });
    });
  }

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
        if (licenseSection) {
          licenseSection.style.display = 'none';
        }
        if (headerProBadge) {
          headerProBadge.style.display = 'inline-block';
        }
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
