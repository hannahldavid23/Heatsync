// HeatSync 2.1 — Ignition

const positions = ["Cash 1", "Cash 2", "IPOS 1", "IPOS 2", "IPOS 3", "IPOS 4", "Expo 1", "Expo 2"];

let rotationTime = 45;
let shiftData = [];
let timersPaused = false;
let timerInterval = null;
let announcedSwitches = [];
let deviceConfig = null;
let firebaseReady = false;
let cloudConnected = false;
let applyingCloudUpdate = false;
let brandTapCount = 0;
let brandTapTimer = null;

window.addEventListener("heatsync-firebase-ready", () => {
  firebaseReady = true;
  if (deviceConfig) connectToStore();
});

window.addEventListener("heatsync-cloud-error", event => {
  setConnectionState(false, `Cloud error: ${event.detail}`);
});

window.addEventListener("load", initializeHeatSync);

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
      setTimeout(() => {
        splash.style.display = "none";
        resolve();
      }, 550);
    }, 2200);
  });
}

function normalizeStoreNumber(value) {
  return String(value || "").trim().replace(/\D/g, "");
}

function saveDeviceSetup() {
  const storeNumber = normalizeStoreNumber(document.getElementById("storeNumberInput").value);
  const mode = document.querySelector('input[name="deviceMode"]:checked')?.value;
  const error = document.getElementById("setupError");

  if (storeNumber.length < 3) {
    error.textContent = "Enter the restaurant's store number.";
    return;
  }
  if (!mode) {
    error.textContent = "Choose Manager or Display.";
    return;
  }

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
  if (!firebaseReady || !window.HeatSyncFirebase) {
    setConnectionState(false, "Connecting…");
    return;
  }

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
  } catch (error) {
    console.error(error);
    setConnectionState(false, "Offline backup");
  }
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
  const isManager = deviceConfig?.mode === "manager";
  document.body.classList.toggle("display-mode", !isManager);
  document.getElementById("managerSetupArea").style.display = isManager ? "block" : "none";
  document.getElementById("managerControls").style.display = isManager ? "block" : "none";
  document.getElementById("managerConsoleCard").style.display = isManager ? "block" : "none";

  if (!isManager && shiftData.length === 0) showDisplayWaiting();
  if (isManager && shiftData.length === 0) showSetupScreen();
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
    newShift.push({
      position,
      outside: outside || "None",
      inside: inside || "None",
      status: "scheduled",
      switchTime: null
    });
  });

  if (newShift.length === 0) {
    alert("Add at least one outdoor position before starting the shift.");
    return;
  }

  shiftData = newShift;
  timersPaused = false;
  announcedSwitches = [];
  saveCurrentShift();
  showDashboard();
  renderDashboard();
}

function saveCurrentShift() {
  const payload = { shiftData, rotationTime, timersPaused, savedAt: Date.now() };
  saveShiftData(shiftData, rotationTime, timersPaused);

  if (!applyingCloudUpdate && isManagerDevice() && deviceConfig && firebaseReady) {
    window.HeatSyncFirebase.saveStoreShift(deviceConfig.storeNumber, payload).catch(error => {
      console.error("Cloud save failed:", error);
      setConnectionState(false, "Offline backup");
    });
  }
}

function applyShiftState(data, fromCloud) {
  rotationTime = Number(data.rotationTime) || 45;
  shiftData = Array.isArray(data.shiftData) ? data.shiftData : [];
  timersPaused = Boolean(data.timersPaused);
  saveShiftData(shiftData, rotationTime, timersPaused);
  updateDashboardHeader(rotationTime);
  updatePauseMessage();

  if (shiftData.length > 0) {
    showDashboard();
    renderDashboard();
  } else if (deviceConfig?.mode === "display") {
    showDisplayWaiting();
  } else if (!fromCloud) {
    showSetupScreen();
  }
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
    let statusClass = "green";
    let statusText = "ON TRACK";
    if (seconds <= 300 && seconds > 0) { statusClass = "yellow"; statusText = "DUE SOON"; }
    if (seconds <= 0) { statusClass = "red"; statusText = "OVERDUE"; }

    const totalSeconds = Math.max(rotationTime * 60, 1);
    const remaining = Math.max(seconds, 0);
    const progress = Math.max(0, Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100));

    const card = document.createElement("article");
    card.className = `position-card ${statusClass}`;
    card.style.setProperty("--timer-progress", `${progress * 3.6}deg`);
    card.innerHTML = `
      <div class="position-card-top"><span class="position-name">${escapeHtml(person.position)}</span><span class="status-label">${statusText}</span></div>
      <div class="timer-ring"><div class="timer-ring-inner"><strong>${seconds <= 0 ? formatTime(Math.abs(seconds)) : formatTime(seconds)}</strong><small>${seconds <= 0 ? "PAST DUE" : "REMAINING"}</small></div></div>
      <div class="employee-pair">
        <div><small>OUTSIDE</small><strong>${escapeHtml(person.outside)}</strong></div>
        <span class="swap-arrow">⇄</span>
        <div><small>INSIDE</small><strong>${escapeHtml(person.inside)}</strong></div>
      </div>
      <button onclick="switchConfirm(${index})">I'M BACK</button>
      ${statusClass === "red" ? '<div class="embers" aria-hidden="true"><i></i><i></i><i></i></div>' : ""}
    `;
    container.appendChild(card);
  });

  renderManagerConsole();
  updateAttentionBanner();
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

    card.innerHTML = `
      <div><small>${escapeHtml(person.position)}</small><strong>${escapeHtml(person.outside)} ⇄ ${escapeHtml(person.inside)}</strong></div>
      ${actions}
    `;
    container.appendChild(card);
  });
}

function startNewShift() {
  if (!isManagerDevice()) return;
  if (!confirm("Start a new shift? This clears the current rotation on both iPads.")) return;

  shiftData = [];
  timersPaused = false;
  rotationTime = 45;
  announcedSwitches = [];
  clearShiftData();
  clearDashboard();
  loadPositionsUI(positions);
  updateDashboardHeader(rotationTime);
  showSetupScreen();

  if (deviceConfig && firebaseReady) {
    window.HeatSyncFirebase.clearStoreShift(deviceConfig.storeNumber).catch(console.error);
  }
}

function rotatePosition(index) {
  if (!isManagerDevice()) return;
  const person = shiftData[index];
  if (!person) return;
  [person.outside, person.inside] = [person.inside, person.outside];
  person.switchTime = Date.now() + rotationTime * 60 * 1000;
  person.status = "active";
  announcedSwitches = announcedSwitches.filter(item => item !== person.position);
  saveCurrentShift();
  renderDashboard();
}

function activatePosition(index) {
  if (!isManagerDevice()) return;
  const person = shiftData[index];
  if (!person) return;
  person.status = "active";
  person.switchTime = Date.now() + rotationTime * 60 * 1000;
  saveCurrentShift();
  renderDashboard();
}

function finishPosition(index) {
  if (!isManagerDevice()) return;
  const person = shiftData[index];
  if (!person) return;
  person.status = "finished";
  person.switchTime = null;
  saveCurrentShift();
  renderDashboard();
}

function switchConfirm(index) {
  const person = shiftData[index];
  if (!person || person.status !== "active") return;

  [person.outside, person.inside] = [person.inside, person.outside];
  person.switchTime = Date.now() + rotationTime * 60 * 1000;
  person.status = "active";
  announcedSwitches = announcedSwitches.filter(item => item !== person.position);

  saveTeamReturn();
  renderDashboard();
}

function saveTeamReturn() {
  const payload = { shiftData, rotationTime, timersPaused, savedAt: Date.now() };
  saveShiftData(shiftData, rotationTime, timersPaused);

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
    if (!timersPaused && shiftData.length > 0) {
      checkAlerts();
      renderDashboard();
    }
  }, 1000);
}

function pauseTimers() {
  if (!isManagerDevice() || timersPaused) return;
  const pausedAt = Date.now();
  shiftData.forEach(person => {
    if (person.status === "active" && person.switchTime) person.pausedRemaining = Math.max(0, person.switchTime - pausedAt);
  });
  timersPaused = true;
  saveCurrentShift();
  updatePauseMessage();
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
  timersPaused = false;
  saveCurrentShift();
  updatePauseMessage();
  renderDashboard();
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
      playAlertSound();
      announcedSwitches.push(person.position);
    }
  });
}

function setRotation(minutes) {
  if (!isManagerDevice()) return;
  rotationTime = minutes;
  document.getElementById("rotationDisplay").innerText = `Current Rotation: ${minutes} Minutes`;
  updateDashboardHeader(minutes);
  saveCurrentShift();
}

function changeShiftRotation(minutes) {
  if (!isManagerDevice()) return;
  const oldRotation = rotationTime || minutes;
  rotationTime = minutes;
  shiftData.forEach(person => {
    if (person.status === "active" && person.switchTime) {
      const remaining = person.switchTime - Date.now();
      person.switchTime = Date.now() + remaining * (minutes / oldRotation);
    }
  });
  updateDashboardHeader(minutes);
  saveCurrentShift();
  renderDashboard();
}

function updateAttentionBanner() {
  const banner = document.getElementById("attentionBanner");
  if (!banner) return;
  const active = shiftData.filter(person => person.status === "active");
  const overdue = active.filter(person => person.switchTime <= Date.now());
  const dueSoon = active.filter(person => person.switchTime > Date.now() && person.switchTime - Date.now() <= 300000);

  banner.className = "";
  document.body.classList.remove("dashboard-warm", "dashboard-hot");

  if (overdue.length) {
    banner.classList.add("banner-danger");
    banner.innerHTML = `🚨 ${overdue.length} ROTATION${overdue.length === 1 ? "" : "S"} OVERDUE`;
    document.body.classList.add("dashboard-hot");
  } else if (dueSoon.length) {
    banner.classList.add("banner-warning");
    banner.innerHTML = `⚠️ ${dueSoon.length} ROTATION${dueSoon.length === 1 ? "" : "S"} DUE SOON`;
    document.body.classList.add("dashboard-warm");
  } else {
    banner.classList.add("banner-good");
    banner.innerHTML = active.length ? "✅ ALL ROTATIONS ON TRACK" : "READY TO ACTIVATE POSITIONS";
  }
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function isManagerDevice() {
  return deviceConfig?.mode === "manager";
}

function bindBrandTaps() {
  document.getElementById("brandButton").addEventListener("click", () => {
    brandTapCount += 1;
    clearTimeout(brandTapTimer);
    brandTapTimer = setTimeout(() => brandTapCount = 0, 1800);
    if (brandTapCount >= 5) {
      brandTapCount = 0;
      openSettings();
    }
  });
}

function openSettings() {
  updateDeviceChrome();
  document.getElementById("settingsConnection").textContent = cloudConnected ? "Connected" : "Offline backup";
  document.getElementById("settingsOverlay").style.display = "flex";
}

function closeSettings() {
  document.getElementById("settingsOverlay").style.display = "none";
}

function reconnectHeatSync() {
  closeSettings();
  connectToStore();
}

function changeDeviceSetup() {
  if (!confirm("Change this iPad's store number or device type?")) return;
  clearDeviceConfig();
  deviceConfig = null;
  closeSettings();
  document.getElementById("deviceSetupOverlay").style.display = "flex";
}
function showAboutModal() {
    const settingsOverlay = document.getElementById("settingsOverlay");
    const aboutOverlay = document.getElementById("aboutOverlay");

    if (settingsOverlay) {
        settingsOverlay.style.display = "none";
    }

    if (aboutOverlay) {
        aboutOverlay.style.display = "flex";
    }
}

function closeAboutModal() {
    const settingsOverlay = document.getElementById("settingsOverlay");
    const aboutOverlay = document.getElementById("aboutOverlay");

    if (aboutOverlay) {
        aboutOverlay.style.display = "none";
    }

    if (settingsOverlay) {
        settingsOverlay.style.display = "flex";
    }
}
