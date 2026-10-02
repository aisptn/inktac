import { detectImageProfile } from "./iccParser.js";
import { SAMPLE_IMAGES } from "./sampleImages.js";
let sourceImage = null;
let sourceImageData = null;
let fileName = "";
let hasCmykProfile = false;
let currentMode = "cmyk";
let analysis = null;
let isDebugOpen = false;
let cardOpacity = 0.55;
let opacityExpression = "0.55";
let cardBlur = 12;
let cardRadius = 12;
let currentTextTransform = "none";
const DEFAULT_ACCENT = "#06B6D4";
let accentColor = DEFAULT_ACCENT;
const ACCENT_PRESETS = [
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Sky", hex: "#0284C7" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Slate", hex: "#64748B" }
];
function evaluateMathExpression(expr) {
  if (!expr || typeof expr !== "string") return null;
  let clean = expr.trim();
  if (!clean) return null;
  clean = clean.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  clean = clean.replace(/π/g, "pi");
  const tokens = [];
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/\d/.test(ch) || ch === "." && i + 1 < clean.length && /\d/.test(clean[i + 1])) {
      let numStr = "";
      while (i < clean.length && /[\d.]/.test(clean[i])) {
        numStr += clean[i];
        i++;
      }
      tokens.push(numStr);
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let idStr = "";
      while (i < clean.length && /[a-zA-Z0-9_]/.test(clean[i])) {
        idStr += clean[i];
        i++;
      }
      tokens.push(idStr.toLowerCase());
      continue;
    }
    if (ch === "*" && i + 1 < clean.length && clean[i + 1] === "*") {
      tokens.push("^");
      i += 2;
      continue;
    }
    if (["+", "-", "*", "/", "%", "^", "(", ")", ","].includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    return null;
  }
  if (tokens.length === 0) return null;
  let tokenIdx = 0;
  function peek() {
    return tokens[tokenIdx];
  }
  function consume(expected) {
    const t = tokens[tokenIdx++];
    if (expected && t !== expected) {
      throw new Error(`Expected ${expected} but got ${t}`);
    }
    return t;
  }
  function parseExpression() {
    let result = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      if (op === "+") result += right;
      else result -= right;
    }
    return result;
  }
  function parseTerm() {
    let result = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = consume();
      const right = parseFactor();
      if (op === "*") {
        result *= right;
      } else if (op === "/") {
        if (right === 0) throw new Error("Division by zero");
        result /= right;
      } else if (op === "%") {
        result %= right;
      }
    }
    return result;
  }
  function parseFactor() {
    let result = parseUnary();
    if (peek() === "^") {
      consume();
      const right = parseFactor();
      result = Math.pow(result, right);
    }
    return result;
  }
  function parseUnary() {
    if (peek() === "+") {
      consume();
      return parseUnary();
    }
    if (peek() === "-") {
      consume();
      return -parseUnary();
    }
    return parsePrimary();
  }
  function parsePrimary() {
    const token = peek();
    if (!token) throw new Error("Unexpected end of input");
    if (token === "(") {
      consume("(");
      const val = parseExpression();
      consume(")");
      return val;
    }
    if (/^\d+(\.\d+)?$|^\.\d+$/.test(token)) {
      consume();
      return parseFloat(token);
    }
    if (token === "pi") {
      consume();
      return Math.PI;
    }
    if (token === "e") {
      consume();
      return Math.E;
    }
    if (token === "phi") {
      consume();
      return 1.618033988749895;
    }
    if (token === "tau") {
      consume();
      return Math.PI * 2;
    }
    const fnName = token;
    consume();
    if (peek() === "(") {
      consume("(");
      const args = [];
      if (peek() !== ")") {
        args.push(parseExpression());
        while (peek() === ",") {
          consume(",");
          args.push(parseExpression());
        }
      }
      consume(")");
      switch (fnName) {
        case "sqrt":
          return Math.sqrt(args[0]);
        case "cbrt":
          return Math.cbrt(args[0]);
        case "sin":
          return Math.sin(args[0]);
        case "cos":
          return Math.cos(args[0]);
        case "tan":
          return Math.tan(args[0]);
        case "abs":
          return Math.abs(args[0]);
        case "round":
          return Math.round(args[0]);
        case "floor":
          return Math.floor(args[0]);
        case "ceil":
          return Math.ceil(args[0]);
        case "log":
        case "ln":
          return Math.log(args[0]);
        case "exp":
          return Math.exp(args[0]);
        case "min":
          return Math.min(...args);
        case "max":
          return Math.max(...args);
        case "pow":
          return Math.pow(args[0], args[1]);
        default:
          throw new Error(`Unknown function: ${fnName}`);
      }
    }
    throw new Error(`Unexpected token: ${token}`);
  }
  try {
    const rawVal = parseExpression();
    if (tokenIdx < tokens.length) {
      return null;
    }
    if (typeof rawVal !== "number" || isNaN(rawVal) || !isFinite(rawVal)) {
      return null;
    }
    let normalized = rawVal;
    if (normalized > 1 && normalized <= 100 && !expr.includes("/")) {
      normalized = normalized / 100;
    }
    normalized = Math.max(0, Math.min(1, normalized));
    return { value: rawVal, normalized };
  } catch {
    return null;
  }
}
function checkDebugUrl() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    for (const key of ["debug", "debugMode", "dev"]) {
      if (urlParams.has(key)) {
        const val = (urlParams.get(key) ?? "").toLowerCase();
        if (val === "" || val === "true" || val === "1" || val === "yes" || val === "on") {
          return true;
        }
      }
    }
    const hash = window.location.hash.toLowerCase();
    if (hash === "#debug" || hash.includes("debug=true") || hash.includes("debug=1")) {
      return true;
    }
  } catch {
  }
  return false;
}
function restoreDebugSettingsFromStorage() {
  if (!checkDebugUrl()) {
    return;
  }
  try {
    const savedAccent = localStorage.getItem("inktac_debug_accent") || localStorage.getItem("spectratac_debug_accent");
    if (savedAccent && /^#[0-9A-Fa-f]{6}$/.test(savedAccent)) {
      accentColor = savedAccent.toUpperCase();
    }
    const savedOpacity = localStorage.getItem("inktac_debug_opacity") || localStorage.getItem("spectratac_debug_opacity");
    if (savedOpacity !== null) {
      const parsed = evaluateMathExpression(savedOpacity);
      if (parsed) {
        cardOpacity = parsed.normalized;
        opacityExpression = savedOpacity;
      } else {
        const num = Number(savedOpacity);
        if (!isNaN(num)) {
          cardOpacity = num > 1 ? Math.min(1, num / 100) : Math.max(0, Math.min(1, num));
          opacityExpression = cardOpacity.toString();
        }
      }
    }
    const savedBlur = localStorage.getItem("inktac_debug_blur") || localStorage.getItem("spectratac_debug_blur");
    if (savedBlur !== null) cardBlur = Math.max(0, Math.min(30, Number(savedBlur)));
    const savedRadius = localStorage.getItem("inktac_debug_radius") || localStorage.getItem("spectratac_debug_radius");
    if (savedRadius !== null) cardRadius = Math.max(0, Math.min(32, Number(savedRadius)));
    const savedTransform = localStorage.getItem("inktac_debug_text_transform") || localStorage.getItem("spectratac_debug_text_transform");
    if (savedTransform && ["none", "lowercase", "uppercase", "capitalize", "small-caps"].includes(savedTransform)) {
      currentTextTransform = savedTransform;
    }
  } catch (e) {
  }
}
restoreDebugSettingsFromStorage();
const bgContainer = document.getElementById("bg-container");
const bgImg = document.getElementById("bg-img");
const fileInput = document.getElementById("file-input");
const btnBrand = document.getElementById("btn-brand");
const btnToggleDebug = document.getElementById("btn-toggle-debug");
const headerActiveActions = document.getElementById("header-active-actions");
const btnPickAnother = document.getElementById("btn-pick-another");
const btnClear = document.getElementById("btn-clear");
const debugPanel = document.getElementById("debug-panel");
const btnDebugReset = document.getElementById("btn-debug-reset");
const btnDebugClose = document.getElementById("btn-debug-close");
const labelDebugAccent = document.getElementById("label-debug-accent");
const pickerAccent = document.getElementById("picker-accent");
const previewAccentSwatch = document.getElementById("preview-accent-swatch");
const inputAccentHex = document.getElementById("input-accent-hex");
const btnEyedropper = document.getElementById("btn-eyedropper");
const accentPresetsContainer = document.getElementById("accent-presets");
const inputOpacityMath = document.getElementById("input-opacity-math");
const badgeOpacityEval = document.getElementById("badge-opacity-eval");
const labelDebugOpacityVal = document.getElementById("label-debug-opacity-val");
const opacityChips = document.querySelectorAll(".btn-opacity-chip");
const sliderOpacity = document.getElementById("slider-opacity");
const sliderBlur = document.getElementById("slider-blur");
const sliderRadius = document.getElementById("slider-radius");
const labelDebugOpacity = document.getElementById("label-debug-opacity");
const labelDebugBlur = document.getElementById("label-debug-blur");
const labelDebugRadius = document.getElementById("label-debug-radius");
const labelDebugTransform = document.getElementById("label-debug-transform");
const btnTextTransformList = document.querySelectorAll(".btn-text-transform");
const errorBanner = document.getElementById("error-banner");
const errorText = document.getElementById("error-text");
const emptyState = document.getElementById("empty-state");
const dropzone = document.getElementById("dropzone");
const btnPickImage = document.getElementById("btn-pick-image");
const btnSampleCmyk = document.getElementById("btn-sample-cmyk");
const btnSampleRgb = document.getElementById("btn-sample-rgb");
const resultsState = document.getElementById("results-state");
const thumbImg = document.getElementById("thumb-img");
const metaFilename = document.getElementById("meta-filename");
const metaDims = document.getElementById("meta-dims");
const metaProfile = document.getElementById("meta-profile");
const btnModeRgba = document.getElementById("btn-mode-rgba");
const btnModeCmyk = document.getElementById("btn-mode-cmyk");
const heroTitle = document.getElementById("hero-title");
const heroVal = document.getElementById("hero-val");
const heroScale = document.getElementById("hero-scale");
const heroProgressFill = document.getElementById("hero-progress-fill");
const heroPixels = document.getElementById("hero-pixels");
const channelFormula = document.getElementById("channel-formula");
const channelsGrid = document.getElementById("channels-grid");
function parseHexColor(hexInput) {
  let clean = hexInput.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return {
    hex: `#${clean.toUpperCase()}`,
    rgb: { r, g, b }
  };
}
function calculateColorContrast(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const textContrast = luminance > 0.42 ? "#0f172a" : "#ffffff";
  const factor = luminance > 0.4 ? 0.86 : 1.18;
  const hr = Math.min(255, Math.max(0, Math.round(r * factor)));
  const hg = Math.min(255, Math.max(0, Math.round(g * factor)));
  const hb = Math.min(255, Math.max(0, Math.round(b * factor)));
  const hoverHex = `#${hr.toString(16).padStart(2, "0")}${hg.toString(16).padStart(2, "0")}${hb.toString(16).padStart(2, "0")}`.toUpperCase();
  return { textContrast, hoverHex };
}
function updatePresetIndicators(currentHex) {
  const normalized = currentHex.toUpperCase();
  const presetButtons = accentPresetsContainer.querySelectorAll("[data-preset-hex]");
  presetButtons.forEach((btn) => {
    const btnHex = btn.dataset.presetHex?.toUpperCase();
    if (btnHex === normalized) {
      btn.classList.add("ring-2", "ring-cyan-500", "dark:ring-white", "scale-115", "shadow-md", "z-10");
      btn.classList.remove("opacity-70");
    } else {
      btn.classList.remove("ring-2", "ring-cyan-500", "dark:ring-white", "scale-115", "shadow-md", "z-10");
      btn.classList.add("opacity-70");
    }
  });
}
function applyDebugProperties() {
  document.documentElement.style.setProperty("--card-opacity", cardOpacity.toString());
  document.documentElement.style.setProperty("--card-blur", `${cardBlur}px`);
  document.documentElement.style.setProperty("--card-radius", `${cardRadius}px`);
  const glassCards = document.querySelectorAll(".card-glass");
  glassCards.forEach((el) => {
    el.style.setProperty("-webkit-backdrop-filter", `blur(${cardBlur}px)`);
    el.style.setProperty("backdrop-filter", `blur(${cardBlur}px)`);
  });
  const parsed = parseHexColor(accentColor) || parseHexColor(DEFAULT_ACCENT);
  const { textContrast, hoverHex } = calculateColorContrast(parsed.rgb.r, parsed.rgb.g, parsed.rgb.b);
  document.documentElement.style.setProperty("--accent-color", parsed.hex);
  document.documentElement.style.setProperty("--accent-rgb", `${parsed.rgb.r}, ${parsed.rgb.g}, ${parsed.rgb.b}`);
  document.documentElement.style.setProperty("--accent-contrast", textContrast);
  document.documentElement.style.setProperty("--accent-hover", hoverHex);
  sliderOpacity.value = Math.round(cardOpacity * 1e3).toString();
  sliderBlur.value = cardBlur.toString();
  sliderRadius.value = cardRadius.toString();
  const pct = (cardOpacity * 100).toFixed(cardOpacity * 100 % 1 === 0 ? 0 : 1);
  labelDebugOpacity.textContent = `${pct}%`;
  labelDebugOpacityVal.textContent = cardOpacity.toFixed(2);
  if (document.activeElement !== inputOpacityMath) {
    inputOpacityMath.value = opacityExpression;
  }
  badgeOpacityEval.textContent = `= ${cardOpacity.toFixed(2)}`;
  badgeOpacityEval.className = "px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold";
  inputOpacityMath.classList.remove("border-rose-400", "dark:border-rose-500");
  labelDebugBlur.textContent = `${cardBlur}px`;
  labelDebugRadius.textContent = `${cardRadius}px`;
  labelDebugAccent.textContent = parsed.hex;
  pickerAccent.value = parsed.hex;
  previewAccentSwatch.style.backgroundColor = parsed.hex;
  if (document.activeElement !== inputAccentHex) {
    inputAccentHex.value = parsed.hex.replace("#", "");
  }
  updatePresetIndicators(parsed.hex);
  document.documentElement.dataset.textTransform = currentTextTransform;
  if (labelDebugTransform) {
    labelDebugTransform.textContent = currentTextTransform === "none" ? "Default" : currentTextTransform;
  }
  btnTextTransformList.forEach((btn) => {
    const mode = btn.dataset.textTransform;
    if (mode === currentTextTransform) {
      btn.className = "btn-text-transform inner-radius flex-1 min-w-[50px] py-1 px-1.5 text-center font-semibold transition-all cursor-pointer bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-xs";
    } else {
      btn.className = "btn-text-transform inner-radius flex-1 min-w-[50px] py-1 px-1.5 text-center font-semibold transition-all cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
    }
  });
  if (isDebugOpen) {
    btnToggleDebug.style.backgroundColor = parsed.hex;
    btnToggleDebug.style.color = textContrast;
    btnToggleDebug.style.borderColor = parsed.hex;
    btnToggleDebug.classList.add("shadow-xs");
  } else {
    btnToggleDebug.style.backgroundColor = "";
    btnToggleDebug.style.color = "";
    btnToggleDebug.style.borderColor = "";
    btnToggleDebug.classList.remove("shadow-xs");
  }
  if (analysis && currentMode === "rgb") {
    heroProgressFill.style.background = `linear-gradient(to right, ${parsed.hex}, ${hoverHex})`;
  }
  if (checkDebugUrl()) {
    try {
      localStorage.setItem("inktac_debug_accent", parsed.hex);
      localStorage.setItem("inktac_debug_opacity", opacityExpression);
      localStorage.setItem("inktac_debug_blur", cardBlur.toString());
      localStorage.setItem("inktac_debug_radius", cardRadius.toString());
      localStorage.setItem("inktac_debug_text_transform", currentTextTransform);
    } catch (e) {
    }
  }
}
function setAccentColor(hex) {
  const parsed = parseHexColor(hex);
  if (parsed) {
    accentColor = parsed.hex;
    applyDebugProperties();
  }
}
function initPresets() {
  accentPresetsContainer.innerHTML = "";
  ACCENT_PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = `${preset.name} (${preset.hex})`;
    btn.dataset.presetHex = preset.hex;
    btn.className = "strict-radius w-full aspect-square transition-all duration-150 cursor-pointer shadow-xs hover:scale-115 hover:opacity-100 focus:outline-none";
    btn.style.backgroundColor = preset.hex;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setAccentColor(preset.hex);
    });
    accentPresetsContainer.appendChild(btn);
  });
}
function computeImageMetrics(imageData, mode) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return { totalPixels: 0, width: 0, height: 0, avgCombined: 0, channels: {} };
  }
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let aSum = 0;
  let cSum = 0;
  let mSum = 0;
  let ySum = 0;
  let kSum = 0;
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];
    if (mode === "cmyk") {
      const normR = r / 255;
      const normG = g / 255;
      const normB = b / 255;
      const k = 1 - Math.max(normR, normG, normB);
      if (k >= 0.999) {
        kSum += 100;
      } else {
        const c = (1 - normR - k) / (1 - k) * 100;
        const m = (1 - normG - k) / (1 - k) * 100;
        const yCol = (1 - normB - k) / (1 - k) * 100;
        cSum += Math.max(0, Math.min(100, c));
        mSum += Math.max(0, Math.min(100, m));
        ySum += Math.max(0, Math.min(100, yCol));
        kSum += k * 100;
      }
    } else {
      rSum += r / 255 * 100;
      gSum += g / 255 * 100;
      bSum += b / 255 * 100;
      aSum += a / 255 * 100;
    }
  }
  if (mode === "cmyk") {
    const avgC = cSum / totalPixels;
    const avgM = mSum / totalPixels;
    const avgY = ySum / totalPixels;
    const avgK = kSum / totalPixels;
    const avgCombined = avgC + avgM + avgY + avgK;
    return {
      totalPixels,
      width,
      height,
      avgCombined,
      channels: { c: avgC, m: avgM, y: avgY, k: avgK }
    };
  } else {
    const avgR = rSum / totalPixels;
    const avgG = gSum / totalPixels;
    const avgB = bSum / totalPixels;
    const avgA = aSum / totalPixels;
    const avgCombined = (avgR + avgG + avgB) / 3;
    return {
      totalPixels,
      width,
      height,
      avgCombined,
      channels: { r: avgR, g: avgG, b: avgB, a: avgA }
    };
  }
}
function renderUI() {
  if (!sourceImageData || !analysis) {
    bgContainer.classList.add("hidden");
    headerActiveActions.classList.add("hidden");
    headerActiveActions.classList.remove("flex");
    emptyState.classList.remove("hidden");
    resultsState.classList.add("hidden");
    resultsState.classList.remove("flex");
    return;
  }
  bgContainer.classList.remove("hidden");
  bgImg.src = sourceImage || "";
  headerActiveActions.classList.remove("hidden");
  headerActiveActions.classList.add("flex");
  emptyState.classList.add("hidden");
  resultsState.classList.remove("hidden");
  resultsState.classList.add("flex");
  thumbImg.src = sourceImage || "";
  metaFilename.textContent = fileName;
  metaDims.textContent = `${analysis.width} \xD7 ${analysis.height} px`;
  if (hasCmykProfile) {
    metaProfile.innerHTML = `
      <svg class="w-3.5 h-3.5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span class="text-amber-800 dark:text-amber-300 font-bold">CMYK Profile</span>
    `;
  } else {
    metaProfile.innerHTML = `<span class="font-semibold text-slate-800 dark:text-slate-200">RGB Profile</span>`;
  }
  if (currentMode === "cmyk") {
    btnModeCmyk.className = "inner-radius px-3 py-1.5 sm:py-1 transition-colors text-center whitespace-nowrap font-bold bg-white/90 dark:bg-amber-500/30 text-amber-900 dark:text-amber-200 shadow-xs";
    btnModeRgba.className = "inner-radius px-3 py-1.5 sm:py-1 transition-colors text-center whitespace-nowrap font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white";
  } else {
    btnModeRgba.className = "inner-radius px-3 py-1.5 sm:py-1 transition-colors text-center whitespace-nowrap font-bold bg-white/90 dark:bg-accent-subtle text-accent shadow-xs";
    btnModeCmyk.className = "inner-radius px-3 py-1.5 sm:py-1 transition-colors text-center whitespace-nowrap font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white";
  }
  const maxScale = currentMode === "cmyk" ? 400 : 100;
  heroTitle.textContent = currentMode === "cmyk" ? "Average Combined TAC" : "Average Combined RGBA";
  heroVal.textContent = analysis.avgCombined.toFixed(2);
  heroScale.textContent = `/ ${maxScale}%`;
  heroPixels.textContent = `Summed across ${analysis.totalPixels.toLocaleString()} total image pixels`;
  heroProgressFill.style.width = `${Math.min(100, analysis.avgCombined / maxScale * 100)}%`;
  if (currentMode === "cmyk") {
    heroProgressFill.className = "strict-radius h-full transition-all duration-300 bg-gradient-to-r from-amber-500 to-rose-500";
    heroProgressFill.style.background = "";
  } else {
    heroProgressFill.className = "strict-radius h-full transition-all duration-300";
    heroProgressFill.style.background = `linear-gradient(to right, var(--accent-color), var(--accent-hover))`;
  }
  channelFormula.textContent = currentMode === "cmyk" ? "C + M + Y + K = Combined TAC" : "(R + G + B) / 3 = Combined \xB7 Alpha = Opacity";
  const channelItems = currentMode === "cmyk" ? [
    { label: "Cyan (C)", val: analysis.channels.c ?? 0, color: "bg-cyan-500 dark:bg-cyan-400", textColor: "text-cyan-800 dark:text-cyan-300" },
    { label: "Magenta (M)", val: analysis.channels.m ?? 0, color: "bg-pink-500 dark:bg-pink-400", textColor: "text-pink-800 dark:text-pink-300" },
    { label: "Yellow (Y)", val: analysis.channels.y ?? 0, color: "bg-amber-400 dark:bg-yellow-400", textColor: "text-amber-800 dark:text-yellow-300" },
    { label: "Key / Black (K)", val: analysis.channels.k ?? 0, color: "bg-slate-800 dark:bg-slate-200", textColor: "text-slate-900 dark:text-slate-100" }
  ] : [
    { label: "Red (R)", val: analysis.channels.r ?? 0, color: "bg-red-500 dark:bg-red-400", textColor: "text-red-800 dark:text-red-300" },
    { label: "Green (G)", val: analysis.channels.g ?? 0, color: "bg-emerald-500 dark:bg-emerald-400", textColor: "text-emerald-800 dark:text-emerald-300" },
    { label: "Blue (B)", val: analysis.channels.b ?? 0, color: "bg-blue-500 dark:bg-blue-400", textColor: "text-blue-800 dark:text-blue-300" },
    { label: "Alpha (A)", val: analysis.channels.a ?? 100, color: "bg-indigo-500 dark:bg-indigo-400", textColor: "text-indigo-800 dark:text-indigo-300" }
  ];
  channelsGrid.innerHTML = "";
  channelItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "subcard-glass p-2 sm:p-2.5 border border-white/40 dark:border-white/10 flex flex-col justify-center space-y-1 sm:space-y-1.5 shadow-xs";
    card.innerHTML = `
      <div class="flex items-center justify-between text-xs font-mono">
        <span class="text-slate-700 dark:text-slate-300 font-semibold text-[11px] sm:text-xs">
          ${item.label}
        </span>
        <span class="font-bold ${item.textColor} text-xs sm:text-sm">
          ${item.val.toFixed(2)}%
        </span>
      </div>
      <div class="strict-radius w-full h-2 bg-black/10 dark:bg-black/50 overflow-hidden">
        <div
          class="strict-radius h-full ${item.color} transition-all duration-300"
          style="width: ${Math.min(100, Math.max(0, item.val))}%;"
        ></div>
      </div>
    `;
    channelsGrid.appendChild(card);
  });
}
function showError(msg) {
  if (msg) {
    errorText.textContent = msg;
    errorBanner.classList.remove("hidden");
    errorBanner.classList.add("flex");
  } else {
    errorBanner.classList.add("hidden");
    errorBanner.classList.remove("flex");
  }
}
function processImage(img, name, isCmyk, imageSrc) {
  const offscreen = document.createElement("canvas");
  offscreen.width = img.naturalWidth || img.width;
  offscreen.height = img.naturalHeight || img.height;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const initialMode = isCmyk ? "cmyk" : "rgb";
  const result = computeImageMetrics(imgData, initialMode);
  let persistentSrc = imageSrc || img.src;
  if (!persistentSrc || persistentSrc.startsWith("blob:")) {
    try {
      persistentSrc = offscreen.toDataURL("image/jpeg", 0.92);
    } catch {
      persistentSrc = img.src;
    }
  }
  sourceImage = persistentSrc;
  sourceImageData = imgData;
  fileName = name;
  hasCmykProfile = isCmyk;
  currentMode = initialMode;
  analysis = result;
  showError(null);
  renderUI();
}
async function handleRawFile(file) {
  if (!file.type.startsWith("image/") && !file.name.match(/\.(jpg|jpeg|png|tiff|tif|webp)$/i)) {
    showError("Please upload a supported image file (JPEG, PNG, TIFF, or WebP).");
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    const detected = await detectImageProfile(buffer, file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      const img = new Image();
      img.onload = () => {
        processImage(img, file.name, detected.hasCmykProfile, dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  } catch (err) {
    showError("Failed to read image file. Please try another image.");
    console.error(err);
  }
}
function handleClear() {
  sourceImage = null;
  sourceImageData = null;
  fileName = "";
  analysis = null;
  showError(null);
  fileInput.value = "";
  renderUI();
}
function handleModeSwitch(newMode) {
  if (!sourceImageData || newMode === currentMode) return;
  currentMode = newMode;
  analysis = computeImageMetrics(sourceImageData, newMode);
  renderUI();
}
function loadSample(sampleId) {
  const sample = SAMPLE_IMAGES.find((s) => s.id === sampleId);
  if (!sample) return;
  const { dataUrl, profileInfo, fileName: sName } = sample.generate();
  const img = new Image();
  img.onload = () => {
    processImage(img, sName, profileInfo.hasCmykProfile, dataUrl);
  };
  img.src = dataUrl;
}
btnBrand.addEventListener("click", handleClear);
btnClear.addEventListener("click", handleClear);
btnPickAnother.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("click", () => fileInput.click());
btnPickImage.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});
fileInput.addEventListener("change", (e) => {
  const target = e.target;
  if (target.files && target.files[0]) {
    handleRawFile(target.files[0]);
  }
});
btnModeRgba.addEventListener("click", () => handleModeSwitch("rgb"));
btnModeCmyk.addEventListener("click", () => handleModeSwitch("cmyk"));
btnSampleCmyk.addEventListener("click", () => loadSample("cmyk-target"));
btnSampleRgb.addEventListener("click", () => loadSample("rgb-spectrum"));
window.addEventListener("dragover", (e) => {
  e.preventDefault();
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleRawFile(e.dataTransfer.files[0]);
  }
});
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("border-accent", "scale-[1.01]");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("border-accent", "scale-[1.01]");
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("border-accent", "scale-[1.01]");
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleRawFile(e.dataTransfer.files[0]);
  }
});
window.addEventListener("paste", (e) => {
  if (e.clipboardData && e.clipboardData.files && e.clipboardData.files[0]) {
    handleRawFile(e.clipboardData.files[0]);
  }
});
btnToggleDebug.addEventListener("click", () => {
  isDebugOpen = !isDebugOpen;
  if (isDebugOpen) {
    debugPanel.classList.remove("hidden");
  } else {
    debugPanel.classList.add("hidden");
  }
  applyDebugProperties();
});
btnDebugClose.addEventListener("click", () => {
  isDebugOpen = false;
  debugPanel.classList.add("hidden");
  applyDebugProperties();
});
btnDebugReset.addEventListener("click", () => {
  cardOpacity = 0.55;
  opacityExpression = "0.55";
  cardBlur = 12;
  cardRadius = 12;
  accentColor = DEFAULT_ACCENT;
  currentTextTransform = "none";
  applyDebugProperties();
  if (analysis) renderUI();
});
pickerAccent.addEventListener("input", (e) => {
  setAccentColor(e.target.value);
});
pickerAccent.addEventListener("change", (e) => {
  setAccentColor(e.target.value);
});
inputAccentHex.addEventListener("input", (e) => {
  const val = e.target.value.trim();
  const parsed = parseHexColor(val);
  if (parsed) {
    accentColor = parsed.hex;
    applyDebugProperties();
  }
});
inputAccentHex.addEventListener("blur", () => {
  const parsed = parseHexColor(accentColor) || parseHexColor(DEFAULT_ACCENT);
  inputAccentHex.value = parsed.hex.replace("#", "");
});
btnTextTransformList.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const mode = btn.dataset.textTransform;
    if (mode) {
      currentTextTransform = mode;
      applyDebugProperties();
    }
  });
});
if (typeof window !== "undefined" && "EyeDropper" in window) {
  btnEyedropper.addEventListener("click", async () => {
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      if (result && result.sRGBHex) {
        setAccentColor(result.sRGBHex);
      }
    } catch {
    }
  });
} else {
  btnEyedropper.title = "EyeDropper API not supported in this browser (use the palette or hex input)";
  btnEyedropper.classList.add("opacity-40", "cursor-not-allowed");
}
function handleMathOpacityInput(expr, isFinal = false) {
  opacityExpression = expr;
  const evalResult = evaluateMathExpression(expr);
  if (evalResult) {
    cardOpacity = evalResult.normalized;
    badgeOpacityEval.textContent = `= ${evalResult.normalized.toFixed(2)}`;
    badgeOpacityEval.className = "px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold";
    inputOpacityMath.classList.remove("border-rose-400", "dark:border-rose-500");
    document.documentElement.style.setProperty("--card-opacity", cardOpacity.toString());
    sliderOpacity.value = Math.round(cardOpacity * 1e3).toString();
    const pct = (cardOpacity * 100).toFixed(cardOpacity * 100 % 1 === 0 ? 0 : 1);
    labelDebugOpacity.textContent = `${pct}%`;
    labelDebugOpacityVal.textContent = cardOpacity.toFixed(2);
    if (checkDebugUrl()) {
      try {
        localStorage.setItem("inktac_debug_opacity", isFinal ? expr : cardOpacity.toString());
      } catch {
      }
    }
  } else {
    badgeOpacityEval.textContent = "= ...";
    badgeOpacityEval.className = "px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold";
    if (isFinal && expr.trim() !== "") {
      inputOpacityMath.classList.add("border-rose-400", "dark:border-rose-500");
    }
  }
}
inputOpacityMath.addEventListener("input", (e) => {
  handleMathOpacityInput(e.target.value, false);
});
inputOpacityMath.addEventListener("change", (e) => {
  handleMathOpacityInput(e.target.value, true);
});
inputOpacityMath.addEventListener("blur", (e) => {
  const val = e.target.value;
  const evalResult = evaluateMathExpression(val);
  if (!evalResult) {
    inputOpacityMath.value = opacityExpression;
    applyDebugProperties();
  }
});
sliderOpacity.addEventListener("input", (e) => {
  const val = Number(e.target.value);
  cardOpacity = val / 1e3;
  const rounded = Number(cardOpacity.toFixed(3));
  opacityExpression = rounded.toString();
  inputOpacityMath.value = opacityExpression;
  applyDebugProperties();
});
opacityChips.forEach((chip) => {
  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    const preset = chip.dataset.opacityPreset;
    if (preset) {
      inputOpacityMath.value = preset;
      handleMathOpacityInput(preset, true);
    }
  });
});
sliderBlur.addEventListener("input", (e) => {
  cardBlur = Number(e.target.value);
  applyDebugProperties();
});
sliderRadius.addEventListener("input", (e) => {
  cardRadius = Number(e.target.value);
  applyDebugProperties();
});
function updateDebugButtonVisibility() {
  const isEnabled = checkDebugUrl();
  if (isEnabled) {
    btnToggleDebug.classList.remove("hidden");
    btnToggleDebug.classList.add("flex");
    restoreDebugSettingsFromStorage();
    applyDebugProperties();
  } else {
    btnToggleDebug.classList.add("hidden");
    btnToggleDebug.classList.remove("flex");
    if (isDebugOpen) {
      isDebugOpen = false;
      debugPanel.classList.add("hidden");
    }
    cardOpacity = 0.55;
    opacityExpression = "0.55";
    cardBlur = 12;
    cardRadius = 12;
    accentColor = DEFAULT_ACCENT;
    currentTextTransform = "none";
    applyDebugProperties();
  }
}
window.addEventListener("hashchange", updateDebugButtonVisibility);
window.addEventListener("popstate", updateDebugButtonVisibility);
window.addEventListener("keydown", (e) => {
  if (e.shiftKey && e.altKey && (e.key === "D" || e.key === "d")) {
    e.preventDefault();
    const isCurrentlyHidden = btnToggleDebug.classList.contains("hidden");
    if (isCurrentlyHidden) {
      btnToggleDebug.classList.remove("hidden");
      btnToggleDebug.classList.add("flex");
      btnToggleDebug.click();
    } else {
      btnToggleDebug.click();
    }
  }
});
initPresets();
applyDebugProperties();
updateDebugButtonVisibility();
renderUI();
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
themeMedia.addEventListener("change", (e) => {
  if (e.matches) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
});
