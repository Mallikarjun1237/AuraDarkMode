# 🌙 AuraDark — Smart Semantic Dark Mode & PDF Reader

> A professional, eye-comfort dark mode extension for Chrome, Edge, and Brave. Features a sleek, draggable **Wispr Flow floating pill widget** on every webpage and PDF.

Unlike standard "camera negative / invert" tools that flip everything into an ugly, blinding X-ray, **AuraDark utilizes perceptual color science**:
* **Preserves Hues**: Blue buttons stay blue, green badges stay green, brand colors remain intact.
* **Calibrates Surfaces**: White page backgrounds map to soft, deep charcoal (`#121316`) or pitch black (`#000000`).
* **Protects Media**: Photographs, diagrams, video streams, and signatures remain 100% natural and unaltered.
* **Specialized PDF Reading Engine**: Eliminates blinding white PDF pages while keeping document stamps, signatures, and figures clear.
* **Wispr Flow Floating Widget**: A glassmorphic, draggable floating pill always at your fingertips.

---

## 🚀 Quick Setup (Load Unpacked into Chrome or Edge)

You can load and use AuraDark immediately in less than 60 seconds:

1. Open your browser and navigate to:
   * **Chrome / Brave**: `chrome://extensions`
   * **Microsoft Edge**: `edge://extensions`
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. Click the **"Load unpacked"** button in the top-left toolbar.
4. In the folder picker dialog, select this directory:
   ```
   C:\Users\malli\Desktop\project\darkmode
   ```
5. **Done!** The AuraDark icon will appear in your browser toolbar, and the sleek floating pill widget will now appear on all websites and documents.

---

## 🧪 Testing Immediately

To test the engine right now:
1. Open Chrome/Edge.
2. Press `Ctrl + O` (Open File) and select `test-demo.html` inside `C:\Users\malli\Desktop\project\darkmode\test-demo.html`.
3. You will see:
   * The floating glassmorphic pill widget at the bottom-right corner.
   * Clicking the pill instantly toggles dark mode smoothly.
   * Dragging the pill repositions it anywhere on screen.
   * Clicking the arrow expands the **AuraDark Tuning Panel** (Theme Presets, Warmth, Brightness, Contrast).
   * Notice that the sample beach photo, the blue action button, and the green/amber badges remain vibrant and completely natural!

---

## 🎨 Theme Presets

AuraDark comes with 4 handcrafted color profiles:

| Preset | Description | Ideal For |
| :--- | :--- | :--- |
| **Deep Charcoal** (Default) | Soft, modern slate (`#121316`) with elevated surfaces | Everyday browsing, official government sites |
| **OLED Pitch Black** | Deep true black (`#000000`) | Maximum battery savings on OLED / AMOLED screens |
| **Warm Mocha** | Cozy sepia/amber undertones | Night reading, research papers, long study sessions |
| **Nordic Slate** | Cool blue-gray palette | Developer documentation and technical dashboards |

---

## 🎛️ Key Features & Shortcuts

* **PDF & A4 Sheet Dark Mode**: Automatically converts white PDF canvases (such as in WhatsApp Web document previews, Google Drive, and PDF.js) and Chrome's internal PDF viewer into comfortable dark slate paper with crisp white text.
* **To Enable for Local Offline PDFs in Chrome**: Open `chrome://extensions`, click **Details** on AuraDark, and toggle **"Allow access to file URLs"** to ON.
* **Keyboard Shortcut**: Press `Alt + Shift + D` at any time to toggle Dark Mode instantly on any tab.
* **Reset Widget Position**: Click "Reset Widget" in the popup panel or on the floating flyout if you ever move the widget off-screen or switch monitors.
* **Per-Site Exclusion**: Click the extension icon in the toolbar to disable dark mode on specific websites if needed.
* **Warmth Slider (Blue-Light Filter)**: Adjust sepia warmth between 0% and 50% for late-night eye strain relief.
* **Zero-Flash Injection**: Styles are registered at `document_start`, eliminating white flashbangs when navigating between pages.

---

## 📁 Project Structure

```
darkmode/
├── manifest.json              # Chrome Manifest V3 configuration
├── test-demo.html             # Interactive testing playground
├── README.md                  # Documentation and guide
├── icons/                     # Sleek glowing moon icons (16, 32, 48, 128px)
└── src/
    ├── content.js             # Content coordinator injected at document_start
    ├── background/
    │   └── background.js      # Service worker for shortcuts & badge state
    ├── engine/
    │   ├── color-engine.js    # Perceptual HSL/OKLCH color remapping engine
    │   └── pdf-engine.js      # SVG matrix filter & PDF canvas reader
    ├── styles/
    │   └── dynamic-base.css   # Semantic dark mode stylesheet variables
    ├── ui/
    │   └── floating-widget.js # Wispr Flow style draggable floating pill (Shadow DOM)
    └── popup/
        ├── popup.html         # Browser toolbar control panel
        ├── popup.css          # Glassmorphic UI styling
        └── popup.js           # Live popup settings synchronizer
```
