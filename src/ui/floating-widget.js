/**
 * AuraDark Floating Widget (Viewport-Locked Edition)
 * Guaranteed:
 * 1. Dark dropdown background in BOTH light and dark modes.
 * 2. Soft, clean, non-glaring matte shadow (no harsh glowing halo).
 * 3. Viewport scroll-lock so it NEVER disappears or scrolls away on long pages.
 */

class AuraFloatingWidget {
  constructor(onToggle, onSettingChange) {
    this.onToggle = onToggle;
    this.onSettingChange = onSettingChange;
    this.host = null;
    this.shadow = null;
    this.isExpanded = false;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.currentPos = { x: 24, y: 24 };
    
    this.state = {
      active: true,
      preset: 'charcoal',
      brightness: 100,
      contrast: 100,
      warmth: 0,
      siteEnabled: true
    };

    this.domWatcher = null;
    this.scrollHandler = null;
  }

  mount(initialState = {}) {
    this.state = { ...this.state, ...initialState };

    let existingHost = document.getElementById('auradark-floating-host');
    if (existingHost) {
      this.host = existingHost;
      this.updateScreenPosition();
      return;
    }

    this.host = document.createElement('div');
    this.host.id = 'auradark-floating-host';
    this.applyHostStyles();

    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.render();
    this.setupInteractions();

    const targetParent = document.body || document.documentElement;
    if (targetParent) {
      targetParent.appendChild(this.host);
    }

    this.updateScreenPosition();
    this.ensurePersistence();

    // Viewport-lock listeners: keep widget firmly on visible screen during scroll/resize
    this.scrollHandler = () => this.updateScreenPosition();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.scrollHandler, { passive: true });
  }

  /**
   * Pinned viewport positioning: prevents widget from scrolling off-screen
   * when CSS filters create a new containing block on html/body.
   */
  updateScreenPosition() {
    if (!this.host) return;

    const isFiltered = document.documentElement.hasAttribute('data-auradark-active');
    const maxW = Math.max(160, (window.innerWidth || 1024) - 120);
    const maxH = Math.max(160, (window.innerHeight || 768) - 45);
    
    this.currentPos.x = Math.max(10, Math.min(maxW, this.currentPos.x));
    this.currentPos.y = Math.max(10, Math.min(maxH, this.currentPos.y));

    if (isFiltered) {
      // Anchored to viewport window using scroll offset
      const topPos = window.scrollY + window.innerHeight - this.currentPos.y - (this.host.offsetHeight || 28);
      const leftPos = window.scrollX + window.innerWidth - this.currentPos.x - (this.host.offsetWidth || 90);
      this.host.style.position = 'absolute';
      this.host.style.top = `${topPos}px`;
      this.host.style.left = `${leftPos}px`;
      this.host.style.bottom = 'auto';
      this.host.style.right = 'auto';
    } else {
      // Standard fixed positioning
      this.host.style.position = 'fixed';
      this.host.style.bottom = `${this.currentPos.y}px`;
      this.host.style.right = `${this.currentPos.x}px`;
      this.host.style.top = 'auto';
      this.host.style.left = 'auto';
    }
  }

  applyHostStyles() {
    if (!this.host) return;
    this.host.style.position = 'fixed';
    this.host.style.zIndex = '2147483647';
    this.host.style.bottom = `${this.currentPos.y}px`;
    this.host.style.right = `${this.currentPos.x}px`;
    this.host.style.pointerEvents = 'auto';
    this.host.style.display = 'block';
    this.host.style.visibility = 'visible';
    this.host.style.opacity = '1';
    this.host.style.margin = '0';
    this.host.style.padding = '0';
    this.host.style.border = 'none';
    this.host.style.outline = 'none';
    this.host.style.lineHeight = 'normal';
    this.host.style.isolation = 'isolate';
  }

  ensurePersistence() {
    if (this.domWatcher) return;

    const reattach = () => {
      const targetParent = document.body || document.documentElement;
      if (this.host && !document.contains(this.host) && targetParent) {
        targetParent.appendChild(this.host);
        this.updateScreenPosition();
      }
    };

    this.domWatcher = new MutationObserver(reattach);
    const observeTarget = document.body || document.documentElement;
    if (observeTarget) {
      this.domWatcher.observe(observeTarget, { childList: true, subtree: false });
    }

    window.addEventListener('popstate', reattach);
    document.addEventListener('turbo:render', reattach);
    document.addEventListener('turbo:load', reattach);
    document.addEventListener('pjax:end', reattach);
  }

  updateState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.updateDom();
    this.updateScreenPosition();
  }

  resetPosition() {
    this.currentPos = { x: 24, y: 24 };
    this.updateScreenPosition();
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
        chrome.storage.local.set({ auradark_widget_pos: this.currentPos });
      }
    } catch (_) {}
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          user-select: none;
          -webkit-font-smoothing: antialiased;
        }

        .widget-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        /* Slim Compact Pill: clean matte shadow, no glowing neon */
        .pill {
          display: flex;
          align-items: center;
          gap: 5px;
          height: 27px;
          padding: 0 7px 0 6px;
          background: #14161f;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 9999px;
          /* Subtle, clean matte shadow - NO harsh glow */
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
          cursor: grab;
          transition: transform 0.12s ease, border-color 0.12s ease;
        }

        .pill:hover {
          transform: translateY(-1px);
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.45);
        }

        .pill.dragging {
          cursor: grabbing;
          transform: scale(0.97);
        }

        /* Moon Aura Icon */
        .aura-indicator {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #252838;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }

        .aura-indicator.active {
          background: #4f46e5;
        }

        .aura-indicator svg {
          width: 9.5px;
          height: 9.5px;
          fill: #cbd5e1;
          transition: fill 0.2s ease;
        }

        .aura-indicator.active svg {
          fill: #ffffff;
        }

        /* Compact Text Label */
        .pill-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: #f1f5f9;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        /* Mini Status Badge */
        .pill-badge {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 1px 3.5px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          line-height: 1.2;
        }

        .pill-badge.active {
          background: rgba(99, 102, 241, 0.25);
          color: #a5b4fc;
        }

        /* Dropdown Chevron Button */
        .expand-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          padding: 0;
          margin-left: 1px;
          flex-shrink: 0;
        }

        .expand-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .expand-btn svg {
          width: 9px;
          height: 9px;
          transition: transform 0.2s ease;
        }

        .expand-btn.open svg {
          transform: rotate(180deg);
        }

        /* Quick Settings Panel: Guaranteed DARK background (#14161f) in all modes */
        .flyout-card {
          width: 250px;
          padding: 12px 14px;
          background: #14161f !important;
          color: #f1f5f9 !important;
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
          border-radius: 14px;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.65);
          display: none;
          flex-direction: column;
          gap: 11px;
          animation: flyoutFadeIn 0.15s ease forwards;
        }

        .flyout-card.visible {
          display: flex;
        }

        @keyframes flyoutFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .card-title {
          font-size: 11.5px;
          font-weight: 600;
          color: #f8fafc;
        }

        .mode-tags {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 5px;
        }

        .mode-btn {
          padding: 5px 7px;
          font-size: 10px;
          font-weight: 500;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.12s ease;
          text-align: center;
        }

        .mode-btn:hover {
          background: rgba(255, 255, 255, 0.09);
          color: #ffffff;
        }

        .mode-btn.active {
          background: #4f46e5;
          border-color: #6366f1;
          color: #ffffff;
        }

        .slider-group {
          display: flex;
          flex-direction: column;
          gap: 3.5px;
        }

        .slider-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 500;
        }

        .slider-val {
          color: #e2e8f0;
        }

        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3.5px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.15);
          outline: none;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #818cf8;
          cursor: pointer;
        }

        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }

        .extra-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 5px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .extra-label {
          font-size: 10px;
          color: #cbd5e1;
        }

        .reset-link {
          font-size: 9.5px;
          color: #818cf8;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          text-decoration: underline;
        }

        .reset-link:hover {
          color: #a5b4fc;
        }
      </style>

      <div class="widget-container">
        <!-- Settings Flyout Card -->
        <div class="flyout-card" id="flyoutCard">
          <div class="card-header">
            <span class="card-title">AuraDark Tuning</span>
            <span class="pill-badge ${this.state.active ? 'active' : ''}" id="cardStatusBadge">
              ${this.state.active ? 'Active' : 'Off'}
            </span>
          </div>

          <div class="slider-group">
            <div class="slider-label-row">
              <span>Theme Preset</span>
            </div>
            <div class="mode-tags">
              <button class="mode-btn ${this.state.preset === 'charcoal' ? 'active' : ''}" data-preset="charcoal">Charcoal</button>
              <button class="mode-btn ${this.state.preset === 'oled' ? 'active' : ''}" data-preset="oled">OLED Pitch</button>
              <button class="mode-btn ${this.state.preset === 'mocha' ? 'active' : ''}" data-preset="mocha">Warm Mocha</button>
              <button class="mode-btn ${this.state.preset === 'nord' ? 'active' : ''}" data-preset="nord">Nordic</button>
            </div>
          </div>

          <div class="slider-group">
            <div class="slider-label-row">
              <span>Brightness</span>
              <span class="slider-val" id="valBrightness">${this.state.brightness}%</span>
            </div>
            <input type="range" id="inputBrightness" min="70" max="110" value="${this.state.brightness}" />
          </div>

          <div class="slider-group">
            <div class="slider-label-row">
              <span>Warmth (Sepia)</span>
              <span class="slider-val" id="valWarmth">${this.state.warmth}%</span>
            </div>
            <input type="range" id="inputWarmth" min="0" max="50" value="${this.state.warmth}" />
          </div>

          <div class="slider-group">
            <div class="slider-label-row">
              <span>Contrast</span>
              <span class="slider-val" id="valContrast">${this.state.contrast}%</span>
            </div>
            <input type="range" id="inputContrast" min="80" max="120" value="${this.state.contrast}" />
          </div>

          <div class="extra-row">
            <span class="extra-label">📄 PDF A4: Auto-Dark</span>
            <button class="reset-link" id="resetPosBtn" title="Reset widget position to bottom-right">Reset Position</button>
          </div>
        </div>

        <!-- Ultra-Slim Badge Pill -->
        <div class="pill" id="mainPill" title="Click to toggle, Drag to reposition">
          <div class="aura-indicator ${this.state.active ? 'active' : ''}" id="auraIndicator">
            <svg viewBox="0 0 24 24">
              <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
            </svg>
          </div>
          <div class="pill-label" id="pillLabel">
            <span>AuraDark</span>
            <span class="pill-badge ${this.state.active ? 'active' : ''}" id="pillStatusBadge">
              ${this.state.active ? 'ON' : 'OFF'}
            </span>
          </div>
          <button class="expand-btn" id="expandBtn" title="Tune Settings & Presets">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  setupInteractions() {
    const pill = this.shadow.getElementById('mainPill');
    const expandBtn = this.shadow.getElementById('expandBtn');
    const flyoutCard = this.shadow.getElementById('flyoutCard');
    const resetPosBtn = this.shadow.getElementById('resetPosBtn');

    let isMoved = false;

    // Independent drag detection
    pill.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#expandBtn') || e.target.closest('#flyoutCard')) {
        return;
      }
      this.isDragging = true;
      isMoved = false;
      this.dragStart = { x: e.clientX, y: e.clientY };
    });

    pill.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = this.dragStart.x - e.clientX;
      const dy = this.dragStart.y - e.clientY;

      if (!isMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isMoved = true;
        pill.classList.add('dragging');
        try { pill.setPointerCapture(e.pointerId); } catch (_) {}
      }

      if (isMoved) {
        let newX = this.currentPos.x + dx;
        let newY = this.currentPos.y + dy;

        const maxW = Math.max(160, window.innerWidth - 120);
        const maxH = Math.max(160, window.innerHeight - 45);
        newX = Math.max(10, Math.min(maxW, newX));
        newY = Math.max(10, Math.min(maxH, newY));

        this.currentPos = { x: newX, y: newY };
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.updateScreenPosition();
      }
    });

    pill.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      pill.classList.remove('dragging');
      try { pill.releasePointerCapture(e.pointerId); } catch (_) {}

      if (!isMoved && !e.target.closest('#expandBtn') && !e.target.closest('#flyoutCard')) {
        this.toggle();
      }

      if (isMoved) {
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
            chrome.storage.local.set({ auradark_widget_pos: this.currentPos });
          }
        } catch (_) {}
      }
    });

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.isExpanded = !this.isExpanded;
      flyoutCard.classList.toggle('visible', this.isExpanded);
      expandBtn.classList.toggle('open', this.isExpanded);
    });

    if (resetPosBtn) {
      resetPosBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetPosition();
      });
    }

    this.shadow.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.target.getAttribute('data-preset');
        this.shadow.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.state.preset = preset;
        this.notifyChange({ preset });
      });
    });

    const bSlider = this.shadow.getElementById('inputBrightness');
    const wSlider = this.shadow.getElementById('inputWarmth');
    const cSlider = this.shadow.getElementById('inputContrast');

    bSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.shadow.getElementById('valBrightness').textContent = `${val}%`;
      this.state.brightness = val;
      this.notifyChange({ brightness: val });
    });

    wSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.shadow.getElementById('valWarmth').textContent = `${val}%`;
      this.state.warmth = val;
      this.notifyChange({ warmth: val });
    });

    cSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.shadow.getElementById('valContrast').textContent = `${val}%`;
      this.state.contrast = val;
      this.notifyChange({ contrast: val });
    });
  }

  toggle() {
    this.state.active = !this.state.active;
    this.updateDom();
    this.updateScreenPosition();
    if (this.onToggle) {
      this.onToggle(this.state.active);
    }
  }

  notifyChange(changedProps) {
    if (this.onSettingChange) {
      this.onSettingChange(changedProps);
    }
  }

  updateDom() {
    if (!this.shadow) return;
    const indicator = this.shadow.getElementById('auraIndicator');
    const badge = this.shadow.getElementById('pillStatusBadge');
    const cardBadge = this.shadow.getElementById('cardStatusBadge');

    if (indicator) indicator.classList.toggle('active', this.state.active);
    if (badge) {
      badge.classList.toggle('active', this.state.active);
      badge.textContent = this.state.active ? 'ON' : 'OFF';
    }
    if (cardBadge) {
      cardBadge.classList.toggle('active', this.state.active);
      cardBadge.textContent = this.state.active ? 'Active' : 'Off';
    }
  }
}

// Expose globally
window.AuraFloatingWidget = AuraFloatingWidget;
