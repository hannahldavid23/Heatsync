// HeatSync 3.0.0 — Command Center foundation

let storeProfile = null;
let currentConditions = null;
let recommendedRotation = null;
let storeSettingsListening = false;

const DEFAULT_HEAT_POLICY = [
  { minHeatIndex: 80, rotationMinutes: 45 },
  { minHeatIndex: 91, rotationMinutes: 30 },
  { minHeatIndex: 101, rotationMinutes: 20 },
  { minHeatIndex: 111, rotationMinutes: 15 }
];

window.addEventListener("heatsync-firebase-ready", () => {
  setTimeout(connectCommandCenterSettings, 0);
});

window.addEventListener("load", () => {
  const originalConnectToStore = window.connectToStore;
  if (typeof originalConnectToStore === "function") {
    window.connectToStore = async function(...args) {
      const result = await originalConnectToStore.apply(this, args);
      connectCommandCenterSettings();
      return result;
    };
  }

  const originalRenderDashboard = window.renderDashboard;
  if (typeof originalRenderDashboard === "function") {
    window.renderDashboard = function(...args) {
      const result = originalRenderDashboard.apply(this, args);
      updateCommandCenterSummary();
      return result;
    };
  }

  const originalUpdateDashboardHeader = window.updateDashboardHeader;
  if (typeof originalUpdateDashboardHeader === "function") {
    window.updateDashboardHeader = function(minutes) {
      originalUpdateDashboardHeader(minutes);
      updateCommandCenterSummary();
    };
  }

  const originalOpenSettings = window.openSettings;
  if (typeof originalOpenSettings === "function") {
    window.openSettings = function() {
      originalOpenSettings();
      populateCommandCenterSettings();
    };
  }

  updateCommandCenterSummary();
});

function connectCommandCenterSettings() {
  if (!deviceConfig?.storeNumber || !firebaseReady || !window.HeatSyncFirebase?.listenToStoreSettings) return;
  if (storeSettingsListening) return;
  storeSettingsListening = true;
  window.HeatSyncFirebase.listenToStoreSettings(deviceConfig.storeNumber, settings => {
    storeProfile = normalizeStoreProfile(settings);
    renderStoreProfile();
    populateCommandCenterSettings();
    refreshStoreWeather(false);
  });
}

function normalizeStoreProfile(settings) {
  const value = settings && typeof settings === "object" ? settings : {};
  return {
    storeName: String(value.storeName || "").trim(),
    locationQuery: String(value.locationQuery || "").trim(),
    locationName: String(value.locationName || "").trim(),
    latitude: Number.isFinite(Number(value.latitude)) ? Number(value.latitude) : null,
    longitude: Number.isFinite(Number(value.longitude)) ? Number(value.longitude) : null,
    manualHeatIndex: Number.isFinite(Number(value.manualHeatIndex)) ? Number(value.manualHeatIndex) : null,
    heatPolicy: Array.isArray(value.heatPolicy) && value.heatPolicy.length ? value.heatPolicy : DEFAULT_HEAT_POLICY
  };
}

function renderStoreProfile() {
  const storeBadge = document.getElementById("storeBadge");
  if (storeBadge && storeProfile?.storeName) {
    storeBadge.textContent = `${storeProfile.storeName} · #${deviceConfig.storeNumber}`;
  }
}

function populateCommandCenterSettings() {
  if (!storeProfile) storeProfile = normalizeStoreProfile(null);
  const managerArea = document.getElementById("managerStoreSettings");
  if (managerArea) managerArea.style.display = isManagerDevice() ? "block" : "none";
  const name = document.getElementById("storeNameSetting");
  const location = document.getElementById("storeLocationSetting");
  const manual = document.getElementById("manualHeatIndexSetting");
  if (name) name.value = storeProfile.storeName;
  if (location) location.value = storeProfile.locationQuery || storeProfile.locationName;
  if (manual) manual.value = storeProfile.manualHeatIndex ?? "";
  renderHeatPolicyRows();
}

function renderHeatPolicyRows() {
  const container = document.getElementById("heatPolicyRows");
  if (!container || !storeProfile) return;
  container.innerHTML = "";
  const levels = [...storeProfile.heatPolicy].sort((a, b) => Number(a.minHeatIndex) - Number(b.minHeatIndex));
  levels.forEach((level, index) => {
    const row = document.createElement("div");
    row.className = "heat-policy-row";
    row.innerHTML = `
      <label>Heat index at least<input class="policy-threshold" type="number" inputmode="numeric" value="${Number(level.minHeatIndex)}"></label>
      <label>Rotation minutes<input class="policy-minutes" type="number" inputmode="numeric" min="5" max="120" value="${Number(level.rotationMinutes)}"></label>
      <button class="policy-remove" onclick="removeHeatPolicyLevel(${index})" aria-label="Remove level">×</button>
    `;
    container.appendChild(row);
  });
}

function readHeatPolicyRows() {
  return [...document.querySelectorAll(".heat-policy-row")]
    .map(row => ({
      minHeatIndex: Math.round(Number(row.querySelector(".policy-threshold")?.value)),
      rotationMinutes: Math.round(Number(row.querySelector(".policy-minutes")?.value))
    }))
    .filter(level => Number.isFinite(level.minHeatIndex) && Number.isFinite(level.rotationMinutes) && level.rotationMinutes >= 5)
    .sort((a, b) => a.minHeatIndex - b.minHeatIndex);
}

function addHeatPolicyLevel() {
  if (!isManagerDevice()) return;
  if (!storeProfile) storeProfile = normalizeStoreProfile(null);
  const current = readHeatPolicyRows();
  const last = current[current.length - 1] || { minHeatIndex: 80, rotationMinutes: 45 };
  storeProfile.heatPolicy = [...current, { minHeatIndex: last.minHeatIndex + 10, rotationMinutes: Math.max(5, last.rotationMinutes - 5) }];
  renderHeatPolicyRows();
}

function removeHeatPolicyLevel(index) {
  if (!isManagerDevice()) return;
  const current = readHeatPolicyRows();
  current.splice(index, 1);
  storeProfile.heatPolicy = current;
  renderHeatPolicyRows();
}

async function saveStoreProfile() {
  if (!isManagerDevice()) return;
  const message = document.getElementById("storeSettingsMessage");
  try {
    const storeName = document.getElementById("storeNameSetting").value.trim();
    const locationQuery = document.getElementById("storeLocationSetting").value.trim();
    if (!locationQuery) throw new Error("Enter a city, state, or ZIP code.");
    message.textContent = "Finding store location…";
    const found = await window.HeatSyncWeather.searchLocation(locationQuery);
    const patch = {
      storeName,
      locationQuery,
      locationName: found.displayName,
      latitude: found.latitude,
      longitude: found.longitude
    };
    await window.HeatSyncFirebase.saveStoreSettings(deviceConfig.storeNumber, patch);
    message.textContent = `Saved: ${found.displayName}`;
  } catch (error) {
    console.error(error);
    message.textContent = error.message;
  }
}

function useCurrentStoreLocation() {
  if (!isManagerDevice()) return;
  const message = document.getElementById("storeSettingsMessage");
  if (!navigator.geolocation) {
    message.textContent = "Location services are not available on this device.";
    return;
  }
  message.textContent = "Requesting iPad location…";
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const patch = {
        storeName: document.getElementById("storeNameSetting").value.trim(),
        locationQuery: "iPad location",
        locationName: "Saved store coordinates",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      await window.HeatSyncFirebase.saveStoreSettings(deviceConfig.storeNumber, patch);
      message.textContent = "Store location saved from this iPad.";
    } catch (error) {
      message.textContent = error.message;
    }
  }, error => {
    message.textContent = error.message || "Location permission was not granted.";
  }, { enableHighAccuracy: true, timeout: 12000 });
}

async function saveHeatPolicy() {
  if (!isManagerDevice()) return;
  const levels = readHeatPolicyRows();
  if (!levels.length) {
    alert("Add at least one heat-policy level.");
    return;
  }
  await window.HeatSyncFirebase.saveStoreSettings(deviceConfig.storeNumber, { heatPolicy: levels });
}

async function saveManualHeatIndex() {
  if (!isManagerDevice()) return;
  const raw = document.getElementById("manualHeatIndexSetting").value.trim();
  const value = raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 180)) {
    alert("Enter a valid heat index, or leave it blank for automatic weather.");
    return;
  }
  await window.HeatSyncFirebase.saveStoreSettings(deviceConfig.storeNumber, { manualHeatIndex: value });
}

async function refreshStoreWeather(showErrors = true) {
  if (!storeProfile?.latitude || !storeProfile?.longitude) {
    renderWeatherUnavailable("Set the store location in Settings.");
    return;
  }
  try {
    document.getElementById("weatherSource").textContent = "Updating conditions…";
    const automatic = await window.HeatSyncWeather.fetchConditions(storeProfile.latitude, storeProfile.longitude);
    currentConditions = automatic;
    if (Number.isFinite(storeProfile.manualHeatIndex)) {
      currentConditions = {
        ...automatic,
        heatIndex: Math.round(storeProfile.manualHeatIndex),
        risk: window.HeatSyncWeather.riskForHeatIndex(storeProfile.manualHeatIndex),
        manual: true
      };
    }
    renderWeatherCard();
  } catch (error) {
    console.error(error);
    renderWeatherUnavailable(error.message);
    if (showErrors) alert(error.message);
  }
}

function renderWeatherUnavailable(message) {
  document.getElementById("weatherHeatIndex").textContent = "—";
  document.getElementById("weatherRisk").textContent = "SET LOCATION";
  document.getElementById("weatherSource").textContent = message;
  recommendedRotation = null;
  renderPolicyRecommendation();
  renderHeatOutlookUnavailable(message);
}

function renderWeatherCard() {
  if (!currentConditions) return;
  document.getElementById("weatherHeatIndex").textContent = currentConditions.heatIndex ?? "—";
  document.getElementById("weatherTemperature").textContent = currentConditions.temperature != null ? `${currentConditions.temperature}°F` : "—";
  document.getElementById("weatherHumidity").textContent = currentConditions.humidity != null ? `${currentConditions.humidity}%` : "—";
  document.getElementById("weatherUv").textContent = currentConditions.uvIndex ?? "—";
  document.getElementById("weatherUpdated").textContent = new Date(currentConditions.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const risk = document.getElementById("weatherRisk");
  risk.textContent = currentConditions.risk.label;
  risk.className = `risk-chip ${currentConditions.risk.className}`;
  document.getElementById("weatherSource").textContent = currentConditions.manual
    ? "Source: Manager entered from OSHA-NIOSH app"
    : `Source: automatic temperature and humidity · ${storeProfile.locationName || "store location"}`;
  recommendedRotation = getRecommendedRotation(currentConditions.heatIndex, storeProfile.heatPolicy);
  renderPolicyRecommendation();
  buildHeatOutlook();
}

function getRecommendedRotation(heatIndex, policy) {
  const value = Number(heatIndex);
  if (!Number.isFinite(value) || !Array.isArray(policy)) return null;
  const matching = [...policy]
    .filter(level => value >= Number(level.minHeatIndex))
    .sort((a, b) => Number(b.minHeatIndex) - Number(a.minHeatIndex))[0];
  return matching ? Number(matching.rotationMinutes) : null;
}

function renderPolicyRecommendation() {
  document.getElementById("policyCurrentRotation").textContent = rotationTime;
  document.getElementById("policyRecommendedRotation").textContent = recommendedRotation ?? "—";
  document.getElementById("policyExplanation").textContent = recommendedRotation
    ? `At a heat index of ${currentConditions?.heatIndex}°F, Store #${deviceConfig?.storeNumber} policy recommends ${recommendedRotation}-minute rotations.`
    : "No store policy level currently applies.";
  const button = document.getElementById("applyPolicyButton");
  button.disabled = !isManagerDevice() || !recommendedRotation || recommendedRotation === rotationTime;
}

function applyWeatherRecommendation() {
  if (!isManagerDevice() || !recommendedRotation) return;
  changeShiftRotation(recommendedRotation);
  renderPolicyRecommendation();
}

function updateCommandCenterSummary() {
  const active = Array.isArray(shiftData) ? shiftData.filter(person => person.status === "active") : [];
  const now = Date.now();
  const dueSoon = active.filter(person => Number(person.switchTime) > now && Number(person.switchTime) - now <= 300000).length;
  const overdue = active.filter(person => Number(person.switchTime) <= now).length;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set("summaryOutside", active.length);
  set("summaryDueSoon", dueSoon);
  set("summaryOverdue", overdue);
  set("summaryRotation", rotationTime);
  set("policyCurrentRotation", rotationTime);
  renderPolicyRecommendation();
}
