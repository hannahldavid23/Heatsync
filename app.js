// HeatSync 3.0 — Command Center

const positions = ["Cash 1", "Cash 2", "IPOS 1", "IPOS 2", "IPOS 3", "IPOS 4", "Expo 1", "Expo 2"];
const DEFAULT_HEAT_POLICY = [
  { minHeatIndex: 80, rotationMinutes: 40 },
  { minHeatIndex: 91, rotationMinutes: 30 },
  { minHeatIndex: 101, rotationMinutes: 20 },
  { minHeatIndex: 111, rotationMinutes: 15 }
];

let rotationTime = 45;
let shiftData = [];
let timersPaused = false;
let timerInterval = null;
let weatherInterval = null;
let announcedSwitches = [];
let deviceConfig = null;
let firebaseReady = false;
let cloudConnected = false;
let applyingCloudUpdate = false;
let brandTapCount = 0;
let brandTapTimer = null;
let storeSettings = createDefaultStoreSettings();
let currentWeather = null;
let recommendedRotation = null;
let shiftStats = createEmptyShiftStats();

window.addEventListener("heatsync-firebase-ready", () => {
  firebaseReady = true;
  if (deviceConfig) connectToStore();
});
window.addEventListener("heatsync-cloud-error", event => setConnectionState(false, `Cloud error: ${event.detail}`));
window.addEventListener("load", initializeHeatSync);

function createDefaultStoreSettings() {
  return {
    storeName: "",
    weatherLocation: null,
    heatPolicy: { enabled: true, levels: DEFAULT_HEAT_POLICY.map(rule => ({ ...rule })) },
    manualHeatIndex: null,
    manualHeatIndexUpdatedAt: null
  };
}

function createEmptyShiftStats() {
  return { startedAt: null, rotationsCompleted: 0, totalOutsideMs: 0, longestOutsideMs: 0, lateRotations: 0 };
}

async function initializeHeatSync() {
  loadPositionsUI(positions);
  startTimerEngine();
  bindBrandTaps();
  deviceConfig = loadDeviceConfig();
  updateDeviceChrome();

  const localData = loadShiftData();
  if (localData) applyShiftState(localData, false);

  await runSplash();
  document.getElementById("mainApp").style.visibility = "visible";

  if (!deviceConfig) {
    document.getElementById("deviceSetupOverlay").style.display = "flex";
  } else {
    applyDeviceMode();
    connectToStore();
  }
}

function runSplash() {
  return new Promise(resolve => {
    const splash = document.getElementById("splashScreen");
    setTimeout(() => splash.classList.add("ignite"), 250);
    setTimeout(() => {
      splash.classList.add("fade-out");
      setTimeout(() => { splash.style.display = "none"; resolve(); }, 550);
    }, 2200);
  });
}

function normalizeStoreNumber(value) { return String(value || "").trim().replace(/\D/g, ""); }

function saveDeviceSetup() {
  const storeNumber = normalizeStoreNumber(document.getElementById("storeNumberInput").value);
  const mode = document.querySelector('input[name="deviceMode"]:checked')?.value;
  const error = document.getElementById("setupError");
  if (storeNumber.length < 3) { error.textContent = "Enter the restaurant's store number."; return; }
  if (!mode) { error.textContent = "Choose Manager or Display."; return; }
  deviceConfig = { storeNumber, mode };
  saveDeviceConfig(deviceConfig);
  error.textContent = "";
  document.getElementById("deviceSetupOverlay").style.display = "none";
  updateDeviceChrome();
  applyDeviceMode();
  connectToStore();
}

async function connectToStore() {
  if (!deviceConfig) return;
  if (!firebaseReady || !window.HeatSyncFirebase) { setConnectionState(false, "Connecting…"); return; }
  try {
    setConnectionState(false, "Connecting…");
    await window.HeatSyncFirebase.signIn();
    window.HeatSyncFirebase.watchConnection(connected => {
      cloudConnected = connected;
      setConnectionState(connected, connected ? "Connected" : "Offline backup");
    });
    window.HeatSyncFirebase.listenToStore(deviceConfig.storeNumber, cloudState => {
      if (cloudState) {
        applyingCloudUpdate = true;
        applyShiftState(cloudState, true);
        applyingCloudUpdate = false;
      } else if (deviceConfig.mode === "display") {
        shiftData = [];
        clearShiftData();
        showDisplayWaiting();
      }
    });
    window.HeatSyncFirebase.listenToStoreSettings(deviceConfig.storeNumber, settings => {
      storeSettings = mergeStoreSettings(settings);
      renderSettingsForm();
      renderWeatherCard();
      refreshWeather();
    });
  } catch (error) {
    console.error(error);
    setConnectionState(false, "Offline backup");
  }
}

function mergeStoreSettings(settings) {
  const defaults = createDefaultStoreSettings();
  return {
    ...defaults,
    ...(settings || {}),
    heatPolicy: {
      ...defaults.heatPolicy,
      ...(settings?.heatPolicy || {}),
      levels: Array.isArray(settings?.heatPolicy?.levels) ? settings.heatPolicy.levels : defaults.heatPolicy.levels
    }
  };
}

function setConnectionState(connected, text) {
  const badge = document.getElementById("connectionBadge");
  const label = document.getElementById("connectionText");
  if (badge) badge.className = `connection-badge ${connected ? "online" : "offline"}`;
  if (label) label.textContent = text;
  const settings = document.getElementById("settingsConnection");
  if (settings) settings.textContent = text;
}

function updateDeviceChrome() {
  const store = deviceConfig?.storeNumber || "—";
  const mode = deviceConfig?.mode || "setup";
  document.getElementById("storeBadge").textContent = `Store #${store}`;
  document.getElementById("deviceBadge").textContent = mode.toUpperCase();
  document.getElementById("settingsStore").textContent = `#${store}`;
  document.getElementById("settingsMode").textContent = mode === "manager" ? "Manager iPad" : mode === "display" ? "Display iPad" : "Not configured";
  document.getElementById("waitingStore").textContent = `Store #${store}`;
}

function applyDeviceMode() {
  const manager = isManagerDevice();
  document.body.classList.toggle("display-mode", !manager);
  document.getElementById("managerSetupArea").style.display = manager ? "block" : "none";
  document.getElementById("managerControls").style.display = manager ? "block" : "none";
  document.getElementById("managerConsoleCard").style.display = manager ? "block" : "none";
  document.getElementById("managerSettingsOnly").style.display = manager ? "block" : "none";
  document.getElementById("applyRecommendationButton").style.display = manager ? "inline-flex" : "none";
  if (!manager && shiftData.length === 0) showDisplayWaiting();
  if (manager && shiftData.length === 0) showSetupScreen();
}

function showDisplayWaiting() {
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("displayWaiting").style.display = "block";
}

function startShift() {
  if (!isManagerDevice()) return;
  const newShift = [];
  positions.forEach(position => {
    const id = safeId(position);
    const outside = document.getElementById(`${id}-outside`)?.value.trim() || "";
    const inside = document.getElementById(`${id}-inside`)?.value.trim() || "";
    if (!outside && !inside) return;
    newShift.push({ position, outside: outside || "None", inside: inside || "None", status: "scheduled", switchTime: null, rotationStartedAt: null });
  });
  if (!newShift.length) { alert("Add at least one outdoor position before starting the shift."); return; }
  shiftData = newShift;
  timersPaused = false;
  announcedSwitches = [];
  shiftStats = createEmptyShiftStats();
  shiftStats.startedAt = Date.now();
  saveCurrentShift();
  showDashboard();
  renderDashboard();
}

function buildShiftPayload() {
  return { shiftData, rotationTime, timersPaused, shiftStats, savedAt: Date.now() };
}

function saveCurrentShift() {
  const payload = buildShiftPayload();
  saveShiftDataExtended(payload);
  if (!applyingCloudUpdate && isManagerDevice() && deviceConfig && firebaseReady) {
    window.HeatSyncFirebase.saveStoreShift(deviceConfig.storeNumber, payload).catch(error => {
      console.error("Cloud save failed:", error);
      setConnectionState(false, "Offline backup");
    });
  }
}

function saveShiftDataExtended(payload) {
  saveShiftData(payload.shiftData, payload.rotationTime, payload.timersPaused);
  localStorage.setItem("HeatSyncShiftStats", JSON.stringify(payload.shiftStats || createEmptyShiftStats()));
}

function applyShiftState(data, fromCloud) {
  rotationTime = Number(data.rotationTime) || 45;
  shiftData = Array.isArray(data.shiftData) ? data.shiftData : [];
  timersPaused = Boolean(data.timersPaused);
  shiftStats = data.shiftStats || loadLocalShiftStats() || createEmptyShiftStats();
  saveShiftDataExtended({ shiftData, rotationTime, timersPaused, shiftStats });
  updateDashboardHeader(rotationTime);
  updatePauseMessage();
  if (shiftData.length) { showDashboard(); renderDashboard(); }
  else if (deviceConfig?.mode === "display") showDisplayWaiting();
  else if (!fromCloud) showSetupScreen();
}

function loadLocalShiftStats() {
  try { return JSON.parse(localStorage.getItem("HeatSyncShiftStats")); } catch { return null; }
}

function renderDashboard() {
  const container = document.getElementById("dashboardPositions");
  if (!container) return;
  container.innerHTML = "";
  const active = shiftData.filter(person => person.status === "active");
  document.getElementById("activeCountPill").textContent = `${active.length} ACTIVE`;

  active.forEach(person => {
    const index = shiftData.indexOf(person);
    const seconds = Math.floor((Number(person.switchTime) - Date.now()) / 1000);
    let statusClass = "green", statusText = "ON TRACK";
    if (seconds <= 300 && seconds > 0) { statusClass = "yellow"; statusText = "DUE SOON"; }
    if (seconds <= 0) { statusClass = "red"; statusText = "OVERDUE"; }
    const totalSeconds = Math.max(rotationTime * 60, 1);
    const progress = Math.max(0, Math.min(100, ((totalSeconds - Math.max(seconds, 0)) / totalSeconds) * 100));
    const card = document.createElement("article");
    card.className = `position-card ${statusClass}`;
    card.style.setProperty("--timer-progress", `${progress * 3.6}deg`);
    card.innerHTML = `
      <div class="position-card-top"><span class="position-name">${escapeHtml(person.position)}</span><span class="status-label">${statusText}</span></div>
      <div class="timer-ring"><div class="timer-ring-inner"><strong>${formatTime(Math.abs(seconds))}</strong><small>${seconds <= 0 ? "PAST DUE" : "REMAINING"}</small></div></div>
      <div class="employee-pair"><div><small>OUTSIDE</small><strong>${escapeHtml(person.outside)}</strong></div><span class="swap-arrow">⇄</span><div><small>INSIDE</small><strong>${escapeHtml(person.inside)}</strong></div></div>
      <button class="team-return-button" onclick="switchConfirm(${index})">✓ I'M BACK</button>
      ${statusClass === "red" ? '<div class="embers" aria-hidden="true"><i></i><i></i><i></i></div>' : ""}`;
    container.appendChild(card);
  });
  renderManagerConsole();
  updateAttentionBanner();
  updateCommandStats();
  renderWeatherCard();
}

function renderManagerConsole() {
  const container = document.getElementById("managerPositions");
  if (!container || !isManagerDevice()) return;
  container.innerHTML = "";
  shiftData.forEach((person, index) => {
    const card = document.createElement("div");
    card.className = "manager-position-card";
    let actions = "";
    if (person.status === "scheduled") actions = `<button onclick="activatePosition(${index})">ACTIVATE</button>`;
    if (person.status === "active") actions = `<div class="manager-actions"><button onclick="rotatePosition(${index})">ROTATE NOW</button><button onclick="finishPosition(${index})">END</button></div>`;
    if (person.status === "finished") actions = `<p class="finished-label">FINISHED</p>`;
    card.innerHTML = `<div><small>${escapeHtml(person.position)}</small><strong>${escapeHtml(person.outside)} ⇄ ${escapeHtml(person.inside)}</strong></div>${actions}`;
    container.appendChild(card);
  });
}

async function startNewShift() {
  if (!isManagerDevice()) return;
  if (!confirm("Start a new shift? This clears the current rotation on both iPads.")) return;
  const summary = makeShiftSummary();
  if (shiftStats.startedAt && deviceConfig && firebaseReady) {
    window.HeatSyncFirebase.saveShiftSummary(deviceConfig.storeNumber, summary).catch(console.error);
  }
  showShiftSummary(summary);
  shiftData = [];
  timersPaused = false;
  rotationTime = 45;
  announcedSwitches = [];
  shiftStats = createEmptyShiftStats();
  clearShiftData();
  localStorage.removeItem("HeatSyncShiftStats");
  clearDashboard();
  loadPositionsUI(positions);
  updateDashboardHeader(rotationTime);
  showSetupScreen();
  if (deviceConfig && firebaseReady) window.HeatSyncFirebase.clearStoreShift(deviceConfig.storeNumber).catch(console.error);
}

function recordCompletedRotation(person) {
  const started = Number(person.rotationStartedAt);
  if (!Number.isFinite(started)) return;
  const duration = Math.max(0, Date.now() - started);
  shiftStats.rotationsCompleted += 1;
  shiftStats.totalOutsideMs += duration;
  shiftStats.longestOutsideMs = Math.max(shiftStats.longestOutsideMs, duration);
  if (Number(person.switchTime) < Date.now()) shiftStats.lateRotations += 1;
}

function rotatePosition(index) {
  if (!isManagerDevice()) return;
  const person = shiftData[index];
  if (!person) return;
  recordCompletedRotation(person);
  [person.outside, person.inside] = [person.inside, person.outside];
  person.rotationStartedAt = Date.now();
  person.switchTime = Date.now() + rotationTime * 60 * 1000;
  person.status = "active";
  announcedSwitches = announcedSwitches.filter(item => item !== person.position);
  saveCurrentShift(); renderDashboard();
}

function activatePosition(index) {
  if (!isManagerDevice()) return;
  const person = shiftData[index];
  if (!person) return;
  person.status = "active";
  person.rotationStartedAt = Date.now();
  person.switchTime = Date.now() + rotationTime * 60 * 1000;
  saveCurrentShift(); renderDashboard();
}

function finishPosition(index) {
  if (!isManagerDevice()) return;
  const person = shiftData[index];
  if (!person) return;
  recordCompletedRotation(person);
  person.status = "finished";
  person.switchTime = null;
  person.rotationStartedAt = null;
  saveCurrentShift(); renderDashboard();
}

function switchConfirm(index) {
  const person = shiftData[index];
  if (!person || person.status !== "active") return;
  recordCompletedRotation(person);
  [person.outside, person.inside] = [person.inside, person.outside];
  person.rotationStartedAt = Date.now();
  person.switchTime = Date.now() + rotationTime * 60 * 1000;
  announcedSwitches = announcedSwitches.filter(item => item !== person.position);
  saveTeamReturn(); renderDashboard();
}

function saveTeamReturn() {
  const payload = buildShiftPayload();
  saveShiftDataExtended(payload);
  if (!applyingCloudUpdate && deviceConfig && firebaseReady && window.HeatSyncFirebase) {
    window.HeatSyncFirebase.saveStoreShift(deviceConfig.storeNumber, payload).catch(error => {
      console.error("Team return cloud save failed:", error);
      setConnectionState(false, "Offline backup");
    });
  }
}

function startTimerEngine() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!timersPaused && shiftData.length) { checkAlerts(); renderDashboard(); }
  }, 1000);
}

function pauseTimers() {
  if (!isManagerDevice() || timersPaused) return;
  const pausedAt = Date.now();
  shiftData.forEach(person => {
    if (person.status === "active" && person.switchTime) person.pausedRemaining = Math.max(0, person.switchTime - pausedAt);
  });
  timersPaused = true; saveCurrentShift(); updatePauseMessage();
}

function resumeTimers() {
  if (!isManagerDevice() || !timersPaused) return;
  const now = Date.now();
  shiftData.forEach(person => {
    if (person.status === "active" && Number.isFinite(person.pausedRemaining)) {
      person.switchTime = now + person.pausedRemaining;
      delete person.pausedRemaining;
    }
  });
  timersPaused = false; saveCurrentShift(); updatePauseMessage(); renderDashboard();
}

function updatePauseMessage() {
  const msg = document.getElementById("pauseMessage");
  if (msg) msg.innerText = timersPaused ? "⏸ HEATSYNC PAUSED" : "🔥 HEATSYNC ACTIVE";
}

function checkAlerts() {
  if (!isManagerDevice()) return;
  shiftData.forEach(person => {
    if (person.status !== "active") return;
    const seconds = Math.floor((person.switchTime - Date.now()) / 1000);
    if (seconds <= 0 && !announcedSwitches.includes(person.position)) {
      speakSwitch(`${person.outside}, it's time to switch with ${person.inside} at ${person.position}`);
      playAlertSound(); announcedSwitches.push(person.position);
    }
  });
}

function setRotation(minutes) {
  if (!isManagerDevice()) return;
  rotationTime = Number(minutes);
  document.getElementById("rotationDisplay").innerText = `Current Rotation: ${rotationTime} Minutes`;
  updateDashboardHeader(rotationTime); saveCurrentShift(); updateCommandStats();
}

function changeShiftRotation(minutes) {
  if (!isManagerDevice()) return;
  const value = Number(minutes);
  const oldRotation = rotationTime || value;
  rotationTime = value;
  shiftData.forEach(person => {
    if (person.status === "active" && person.switchTime) {
      const remaining = person.switchTime - Date.now();
      person.switchTime = Date.now() + remaining * (value / oldRotation);
      person.rotationStartedAt = Date.now() - Math.max(0, value * 60000 - Math.max(0, person.switchTime - Date.now()));
    }
  });
  updateDashboardHeader(value); saveCurrentShift(); renderDashboard();
}

function updateAttentionBanner() {
  const banner = document.getElementById("attentionBanner");
  if (!banner) return;
  const active = shiftData.filter(person => person.status === "active");
  const overdue = active.filter(person => person.switchTime <= Date.now());
  const dueSoon = active.filter(person => person.switchTime > Date.now() && person.switchTime - Date.now() <= 300000);
  banner.className = "";
  document.body.classList.remove("dashboard-warm", "dashboard-hot");
  if (overdue.length) { banner.classList.add("banner-danger"); banner.innerHTML = `🚨 ${overdue.length} ROTATION${overdue.length === 1 ? "" : "S"} OVERDUE`; document.body.classList.add("dashboard-hot"); }
  else if (dueSoon.length) { banner.classList.add("banner-warning"); banner.innerHTML = `⚠️ ${dueSoon.length} ROTATION${dueSoon.length === 1 ? "" : "S"} DUE SOON`; document.body.classList.add("dashboard-warm"); }
  else { banner.classList.add("banner-good"); banner.innerHTML = active.length ? "✅ ALL ROTATIONS ON TRACK" : "READY TO ACTIVATE POSITIONS"; }
}

function updateCommandStats() {
  const active = shiftData.filter(person => person.status === "active");
  const now = Date.now();
  const due = active.filter(person => person.switchTime > now && person.switchTime - now <= 300000).length;
  const overdue = active.filter(person => person.switchTime <= now).length;
  setText("outsideStat", active.length);
  setText("dueSoonStat", due);
  setText("overdueStat", overdue);
  setText("rotationStat", rotationTime);
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function formatMinutes(ms) { return `${Math.round((Number(ms) || 0) / 60000)}m`; }
function isManagerDevice() { return deviceConfig?.mode === "manager"; }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

function bindBrandTaps() {
  document.getElementById("brandButton").addEventListener("click", () => {
    brandTapCount += 1;
    clearTimeout(brandTapTimer);
    brandTapTimer = setTimeout(() => brandTapCount = 0, 1800);
    if (brandTapCount >= 5) { brandTapCount = 0; openSettings(); }
  });
}

function openSettings() {
  updateDeviceChrome();
  document.getElementById("settingsConnection").textContent = cloudConnected ? "Connected" : "Offline backup";
  renderSettingsForm();
  document.getElementById("settingsOverlay").style.display = "flex";
}
function closeSettings() { document.getElementById("settingsOverlay").style.display = "none"; }
function reconnectHeatSync() { closeSettings(); connectToStore(); }
function changeDeviceSetup() {
  if (!confirm("Change this iPad's store number or device type?")) return;
  clearDeviceConfig(); deviceConfig = null; closeSettings(); document.getElementById("deviceSetupOverlay").style.display = "flex";
}

function renderSettingsForm() {
  setText("savedLocationText", storeSettings.weatherLocation?.label ? `Saved: ${storeSettings.weatherLocation.label}` : "No store weather location saved.");
  const name = document.getElementById("storeNameSetting"); if (name) name.value = storeSettings.storeName || "";
  const manual = document.getElementById("manualHeatIndexInput"); if (manual) manual.value = storeSettings.manualHeatIndex ?? "";
  const rows = document.getElementById("heatPolicyRows");
  if (rows) {
    rows.innerHTML = "";
    (storeSettings.heatPolicy?.levels || DEFAULT_HEAT_POLICY).sort((a,b)=>a.minHeatIndex-b.minHeatIndex).forEach(rule => addHeatPolicyRow(rule));
  }
}

function addHeatPolicyRow(rule = { minHeatIndex: "", rotationMinutes: "" }) {
  const container = document.getElementById("heatPolicyRows");
  if (!container) return;
  const row = document.createElement("div");
  row.className = "heat-policy-row";
  row.innerHTML = `<label>Heat index<input class="policy-heat" type="number" inputmode="numeric" value="${escapeHtml(rule.minHeatIndex)}"></label><span>→</span><label>Rotation<input class="policy-minutes" type="number" inputmode="numeric" value="${escapeHtml(rule.rotationMinutes)}"></label><button class="remove-rule-button" onclick="this.parentElement.remove()" aria-label="Remove rule">×</button>`;
  container.appendChild(row);
}

async function saveStoreProfile() {
  if (!isManagerDevice()) return;
  storeSettings.storeName = document.getElementById("storeNameSetting").value.trim();
  await saveStoreSettingsCloud();
  alert("Store profile saved.");
}

async function searchAndSaveStoreLocation() {
  if (!isManagerDevice()) return;
  const query = document.getElementById("weatherLocationSearch").value;
  setText("savedLocationText", "Searching…");
  try {
    storeSettings.weatherLocation = await HeatSyncWeather.searchLocation(query);
    await saveStoreSettingsCloud();
    renderSettingsForm();
    refreshWeather(true);
  } catch (error) { setText("savedLocationText", error.message); }
}

function useCurrentStoreLocation() {
  if (!isManagerDevice()) return;
  if (!navigator.geolocation) { setText("savedLocationText", "Location is not supported on this device."); return; }
  setText("savedLocationText", "Requesting location…");
  navigator.geolocation.getCurrentPosition(async position => {
    storeSettings.weatherLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timezone: "auto",
      label: storeSettings.storeName || `Store #${deviceConfig.storeNumber}`
    };
    await saveStoreSettingsCloud(); renderSettingsForm(); refreshWeather(true);
  }, error => setText("savedLocationText", `Location failed: ${error.message}`), { enableHighAccuracy: true, timeout: 15000 });
}

async function saveHeatPolicy() {
  if (!isManagerDevice()) return;
  const rows = [...document.querySelectorAll(".heat-policy-row")];
  const levels = rows.map(row => ({
    minHeatIndex: Number(row.querySelector(".policy-heat").value),
    rotationMinutes: Number(row.querySelector(".policy-minutes").value)
  })).filter(rule => Number.isFinite(rule.minHeatIndex) && Number.isFinite(rule.rotationMinutes) && rule.rotationMinutes > 0);
  if (!levels.length) { alert("Add at least one valid heat policy level."); return; }
  storeSettings.heatPolicy = { enabled: true, levels: levels.sort((a,b)=>a.minHeatIndex-b.minHeatIndex) };
  await saveStoreSettingsCloud(); renderWeatherCard(); alert("Heat policy saved for this store.");
}

async function saveManualHeatIndex() {
  if (!isManagerDevice()) return;
  const value = Number(document.getElementById("manualHeatIndexInput").value);
  if (!Number.isFinite(value)) { alert("Enter the heat index from the OSHA-NIOSH app."); return; }
  storeSettings.manualHeatIndex = value;
  storeSettings.manualHeatIndexUpdatedAt = Date.now();
  await saveStoreSettingsCloud(); renderWeatherCard();
}
async function clearManualHeatIndex() {
  if (!isManagerDevice()) return;
  storeSettings.manualHeatIndex = null;
  storeSettings.manualHeatIndexUpdatedAt = null;
  await saveStoreSettingsCloud(); document.getElementById("manualHeatIndexInput").value = ""; renderWeatherCard();
}

async function saveStoreSettingsCloud() {
  if (!deviceConfig || !firebaseReady) return;
  await window.HeatSyncFirebase.saveStoreSettings(deviceConfig.storeNumber, storeSettings);
}

async function refreshWeather(force = false) {
  if (!storeSettings.weatherLocation || !window.HeatSyncWeather) { renderWeatherCard(); return; }
  if (!force && currentWeather && Date.now() - currentWeather.fetchedAt < 10 * 60 * 1000) return;
  try {
    currentWeather = await HeatSyncWeather.fetchCurrent(storeSettings.weatherLocation);
    renderWeatherCard();
    clearInterval(weatherInterval);
    weatherInterval = setInterval(() => refreshWeather(true), 10 * 60 * 1000);
  } catch (error) {
    console.error(error); setText("weatherSourceLabel", error.message);
  }
}

function effectiveHeatIndex() {
  return Number.isFinite(Number(storeSettings.manualHeatIndex)) ? Number(storeSettings.manualHeatIndex) : currentWeather?.heatIndex;
}

function renderWeatherCard() {
  if (!window.HeatSyncWeather) return;
  const hi = effectiveHeatIndex();
  const risk = HeatSyncWeather.riskForHeatIndex(hi);
  recommendedRotation = Number.isFinite(Number(hi))
    ? HeatSyncWeather.recommendationForPolicy(hi, storeSettings.heatPolicy?.levels, rotationTime)
    : null;
  setText("weatherLocationLabel", storeSettings.weatherLocation?.label || "Store location needed");
  setText("heatIndexValue", Number.isFinite(Number(hi)) ? `${Math.round(hi)}°` : "—°");
  setText("temperatureValue", Number.isFinite(currentWeather?.temperature) ? `${Math.round(currentWeather.temperature)}°` : "—°");
  setText("humidityValue", Number.isFinite(currentWeather?.humidity) ? `${Math.round(currentWeather.humidity)}%` : "—%");
  setText("uvValue", Number.isFinite(currentWeather?.uvIndex) ? currentWeather.uvIndex.toFixed(1) : "—");
  setText("weatherUpdatedValue", currentWeather?.fetchedAt ? new Date(currentWeather.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—");
  setText("recommendedRotationValue", recommendedRotation ?? "—");
  setText("weatherIcon", HeatSyncWeather.iconForCode(currentWeather?.weatherCode));
  setText("weatherSourceLabel", Number.isFinite(Number(storeSettings.manualHeatIndex)) ? "Manager entered from OSHA-NIOSH app" : "Automatic heat index from temperature and humidity");
  const badge = document.getElementById("heatRiskBadge");
  if (badge) { badge.textContent = risk.label; badge.className = `heat-risk-badge ${risk.className}`; }
  const apply = document.getElementById("applyRecommendationButton");
  if (apply) apply.disabled = !recommendedRotation || recommendedRotation === rotationTime;
}

function applyWeatherRecommendation() {
  if (!isManagerDevice() || !recommendedRotation) return;
  if (!confirm(`Apply the store policy recommendation of ${recommendedRotation} minutes to this shift?`)) return;
  changeShiftRotation(recommendedRotation);
}

function makeShiftSummary() {
  const completed = shiftStats.rotationsCompleted || 0;
  return {
    storeNumber: deviceConfig?.storeNumber || "",
    startedAt: shiftStats.startedAt,
    endedAt: Date.now(),
    rotationsCompleted: completed,
    averageOutsideMs: completed ? Math.round(shiftStats.totalOutsideMs / completed) : 0,
    longestOutsideMs: shiftStats.longestOutsideMs || 0,
    lateRotations: shiftStats.lateRotations || 0
  };
}
function showShiftSummary(summary) {
  setText("summaryRotations", summary.rotationsCompleted);
  setText("summaryAverage", formatMinutes(summary.averageOutsideMs));
  setText("summaryLongest", formatMinutes(summary.longestOutsideMs));
  setText("summaryLate", summary.lateRotations);
  document.getElementById("shiftSummaryOverlay").style.display = "flex";
}
function closeShiftSummary() { document.getElementById("shiftSummaryOverlay").style.display = "none"; }
