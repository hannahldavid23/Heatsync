// HeatSync 3.3.0 — Command Center + Team Display

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
    renderHeatOutlook();
  } catch (error) {
    console.error(error);
    renderWeatherUnavailable(error.message);
    renderHeatOutlookUnavailable(error.message);
    if (showErrors) alert(error.message);
  }
}

function renderWeatherUnavailable(message) {
  document.getElementById("weatherHeatIndex").textContent = "—";
  document.getElementById("weatherRisk").textContent = "SET LOCATION";
  document.getElementById("weatherSource").textContent = message;
  recommendedRotation = null;
  renderPolicyRecommendation();
  renderHeatOutlook();
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


// ================================
// HeatSync 3.1 — Heat Outlook
// ================================
function getPolicyLevel(heatIndex, policy = storeProfile?.heatPolicy) {
  const value = Number(heatIndex);
  if (!Number.isFinite(value) || !Array.isArray(policy)) return null;
  return [...policy]
    .filter(level => value >= Number(level.minHeatIndex))
    .sort((a, b) => Number(b.minHeatIndex) - Number(a.minHeatIndex))[0] || null;
}

function formatOutlookTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric" });
}

function formatCountdown(milliseconds) {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours} hr ${minutes} min`;
  if (hours) return `${hours} hr`;
  return `${minutes} min`;
}

function getForecastAnalysis() {
  const hourly = Array.isArray(currentConditions?.hourly) ? currentConditions.hourly : [];
  const policy = Array.isArray(storeProfile?.heatPolicy) ? [...storeProfile.heatPolicy].sort((a,b) => a.minHeatIndex-b.minHeatIndex) : [];
  if (!hourly.length || !policy.length) return { hourly, policy, changes: [], nextChange: null };

  let priorLevel = getPolicyLevel(currentConditions?.heatIndex, policy);
  const changes = [];
  for (const point of hourly) {
    const level = getPolicyLevel(point.heatIndex, policy);
    const priorMinutes = priorLevel ? Number(priorLevel.rotationMinutes) : null;
    const nextMinutes = level ? Number(level.rotationMinutes) : null;
    if (nextMinutes !== priorMinutes) {
      changes.push({
        time: point.time,
        heatIndex: point.heatIndex,
        rotationMinutes: nextMinutes,
        previousRotationMinutes: priorMinutes,
        threshold: level ? Number(level.minHeatIndex) : null
      });
      priorLevel = level;
    }
  }
  return { hourly, policy, changes, nextChange: changes[0] || null };
}

function renderHeatOutlookUnavailable(message = "Forecast unavailable.") {
  const headline = document.getElementById("outlookHeadline");
  const subtext = document.getElementById("outlookSubtext");
  const svg = document.getElementById("heatOutlookChart");
  if (headline) headline.textContent = "Heat outlook unavailable";
  if (subtext) subtext.textContent = message;
  if (svg) svg.innerHTML = `<text x="380" y="130" text-anchor="middle" class="outlook-axis-label">${escapeOutlookText(message)}</text>`;
}

function escapeOutlookText(value) {
  return String(value ?? "").replace(/[&<>\"']/g, character => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '\"':"&quot;", "'":"&#039;"
  }[character]));
}

function renderHeatOutlook() {
  const headline = document.getElementById("outlookHeadline");
  if (!headline) return;
  const analysis = getForecastAnalysis();
  const hourly = analysis.hourly;
  if (!hourly.length) {
    renderHeatOutlookUnavailable(storeProfile?.latitude ? "Hourly forecast has not loaded yet." : "Set the store location in Settings.");
    return;
  }

  const next = analysis.nextChange;
  const subtext = document.getElementById("outlookSubtext");
  if (next) {
    const action = next.rotationMinutes ? `${next.rotationMinutes}-minute rotations` : "standard rotations";
    headline.textContent = `${next.heatIndex}°F expected around ${formatOutlookTime(next.time)}`;
    subtext.textContent = `Next projected policy change: ${action} · about ${formatCountdown(next.time - Date.now())} away.`;
  } else {
    headline.textContent = "No policy changes expected today";
    const peak = Math.max(...hourly.map(point => Number(point.heatIndex)).filter(Number.isFinite));
    subtext.textContent = Number.isFinite(peak) ? `Projected peak heat index: ${peak}°F.` : "Forecast remains within the current policy level.";
  }

  renderOutlookTrend(hourly);
  renderOutlookPrepareBanner(next);
  renderOutlookChart(hourly, analysis.policy);
  renderOutlookChanges(analysis.changes);
  renderForecastDetails(hourly, analysis.policy);
}

function renderOutlookTrend(hourly) {
  const element = document.getElementById("outlookTrend");
  if (!element) return;
  const current = Number(currentConditions?.heatIndex);
  const next = Number(hourly.find(point => point.time > Date.now())?.heatIndex);
  if (!Number.isFinite(current) || !Number.isFinite(next)) {
    element.textContent = "—";
    element.className = "outlook-trend";
    return;
  }
  const difference = next - current;
  const arrow = difference > 0 ? "↗" : difference < 0 ? "↘" : "→";
  element.textContent = `${arrow} ${difference > 0 ? "+" : ""}${difference}° next hour`;
  element.className = `outlook-trend ${difference > 0 ? "rising" : difference < 0 ? "falling" : "steady"}`;
}

function renderOutlookPrepareBanner(next) {
  const banner = document.getElementById("outlookPrepareBanner");
  if (!banner) return;
  banner.style.display = "none";
  banner.className = "outlook-prepare-banner";
  if (!next) return;
  const minutesUntil = Math.round((next.time - Date.now()) / 60000);
  if (minutesUntil < 0 || minutesUntil > 60) return;
  const action = next.rotationMinutes ? `${next.rotationMinutes}-minute rotations` : "the lower heat-policy level";
  banner.style.display = "block";
  banner.innerHTML = `<strong>${minutesUntil <= 15 ? "⚠ PREPARE NOW" : "⏱ PREPARE"}</strong><br>Forecast suggests ${action} around ${escapeOutlookText(formatOutlookTime(next.time))} (${escapeOutlookText(formatCountdown(next.time - Date.now()))}).`;
  if (minutesUntil <= 15) banner.classList.add("urgent");
}

function renderOutlookChart(hourly, policy) {
  const svg = document.getElementById("heatOutlookChart");
  if (!svg) return;
  const points = hourly.slice(0, 13);
  if (points.length < 2) return renderHeatOutlookUnavailable("Not enough hourly forecast data.");

  const width = 760, height = 260;
  const margin = { left:48, right:28, top:22, bottom:42 };
  const values = points.map(point => Number(point.heatIndex)).filter(Number.isFinite);
  const thresholds = policy.map(level => Number(level.minHeatIndex)).filter(Number.isFinite);
  let minY = Math.floor((Math.min(...values, ...thresholds) - 4) / 5) * 5;
  let maxY = Math.ceil((Math.max(...values, ...thresholds) + 4) / 5) * 5;
  if (maxY - minY < 15) maxY = minY + 15;
  const x = index => margin.left + index * ((width - margin.left - margin.right) / (points.length - 1));
  const y = value => margin.top + (maxY - value) * ((height - margin.top - margin.bottom) / (maxY - minY));
  const linePath = points.map((point,index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.heatIndex).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(points.length-1)},${height-margin.bottom} L${x(0)},${height-margin.bottom} Z`;

  const gridValues = [];
  for (let value=minY; value<=maxY; value+=5) gridValues.push(value);
  const grid = gridValues.map(value => `<line x1="${margin.left}" x2="${width-margin.right}" y1="${y(value)}" y2="${y(value)}" class="outlook-grid-line"/><text x="${margin.left-8}" y="${y(value)+4}" text-anchor="end" class="outlook-axis-label">${value}°</text>`).join("");
  const thresholdLines = policy.filter(level => Number(level.minHeatIndex) >= minY && Number(level.minHeatIndex) <= maxY).map(level => `<line x1="${margin.left}" x2="${width-margin.right}" y1="${y(level.minHeatIndex)}" y2="${y(level.minHeatIndex)}" class="outlook-threshold-line"/><text x="${width-margin.right-4}" y="${y(level.minHeatIndex)-5}" text-anchor="end" class="outlook-threshold-label">${level.minHeatIndex}° → ${level.rotationMinutes} min</text>`).join("");
  const labels = points.map((point,index) => index % 2 === 0 || index === points.length-1 ? `<text x="${x(index)}" y="${height-17}" text-anchor="middle" class="outlook-axis-label">${escapeOutlookText(formatOutlookTime(point.time))}</text>` : "").join("");
  const dots = points.map((point,index) => `<circle cx="${x(index)}" cy="${y(point.heatIndex)}" r="${index===0 ? 6 : 4.5}" class="${index===0 ? "outlook-current-point" : "outlook-point"}"/><text x="${x(index)}" y="${y(point.heatIndex)-10}" text-anchor="middle" class="outlook-value-label">${point.heatIndex}°</text>`).join("");

  svg.innerHTML = `<defs><linearGradient id="heatOutlookAreaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ff6b00" stop-opacity=".42"/><stop offset="100%" stop-color="#ff6b00" stop-opacity=".03"/></linearGradient></defs>${grid}${thresholdLines}<path d="${areaPath}" class="outlook-forecast-area"/><path d="${linePath}" class="outlook-forecast-line"/>${dots}${labels}`;
}

function renderOutlookChanges(changes) {
  const container = document.getElementById("outlookChanges");
  if (!container) return;
  if (!changes.length) {
    container.innerHTML = `<div class="outlook-change-item"><small>Expected changes</small><strong>None for the rest of today</strong></div>`;
    return;
  }
  container.innerHTML = changes.slice(0,4).map(change => `<div class="outlook-change-item"><small>${escapeOutlookText(formatOutlookTime(change.time))} · ${change.heatIndex}°F</small><strong>${change.rotationMinutes ? `Plan for ${change.rotationMinutes}-minute rotations` : "Return to standard policy"}</strong></div>`).join("");
}

function renderForecastDetails(hourly, policy) {
  const container = document.getElementById("forecastDetails");
  if (!container) return;
  let previousMinutes = getPolicyLevel(currentConditions?.heatIndex, policy)?.rotationMinutes ?? null;
  const rows = hourly.slice(0,16).map(point => {
    const level = getPolicyLevel(point.heatIndex, policy);
    const minutes = level?.rotationMinutes ?? null;
    const changed = minutes !== previousMinutes;
    previousMinutes = minutes;
    return `<div class="forecast-hour-row ${changed ? "policy-change" : ""}"><span>${escapeOutlookText(formatOutlookTime(point.time))}</span><span>${point.temperature}°F</span><span>${point.humidity}%</span><strong>${point.heatIndex}° · ${minutes ? `${minutes} min` : "Standard"}</strong></div>`;
  }).join("");
  container.innerHTML = `<div class="forecast-hour-row header"><span>Time</span><span>Temp</span><span>Humidity</span><strong>Heat index · Policy</strong></div>${rows}`;
}

function toggleForecastDetails() {
  const details = document.getElementById("forecastDetails");
  const button = document.getElementById("outlookDetailsButton");
  if (!details || !button) return;
  const opening = details.style.display === "none" || !details.style.display;
  details.style.display = opening ? "block" : "none";
  button.textContent = opening ? "Hide Hourly Forecast" : "View Hourly Forecast";
}
