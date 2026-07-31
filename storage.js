const savedShiftKey = "HeatSyncActiveShift";
const deviceConfigKey = "HeatSyncDeviceConfig";

function saveShiftData(shiftData, rotationTime, timersPaused) {
  const data = {
    rotationTime,
    shiftData,
    timersPaused,
    savedAt: Date.now()
  };
  localStorage.setItem(savedShiftKey, JSON.stringify(data));
}

function loadShiftData() {
  const saved = localStorage.getItem(savedShiftKey);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.log("Could not load saved shift:", error);
    return null;
  }
}

function clearShiftData() {
  localStorage.removeItem(savedShiftKey);
}

function saveDeviceConfig(config) {
  localStorage.setItem(deviceConfigKey, JSON.stringify(config));
}

function loadDeviceConfig() {
  const saved = localStorage.getItem(deviceConfigKey);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.log("Could not load device setup:", error);
    return null;
  }
}

function clearDeviceConfig() {
  localStorage.removeItem(deviceConfigKey);
}
