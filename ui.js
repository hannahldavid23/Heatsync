function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function loadPositionsUI(positions) {
  const container = document.getElementById("positions");
  if (!container) return;
  container.innerHTML = "";

  positions.forEach(position => {
    const id = safeId(position);
    const card = document.createElement("div");
    card.className = "setup-position-card";
    card.innerHTML = `
      <h3>${escapeHtml(position)}</h3>
      <label for="${id}-outside">Outside employee</label>
      <input id="${id}-outside" placeholder="Name">
      <label for="${id}-inside">Inside partner</label>
      <input id="${id}-inside" placeholder="Name">
    `;
    container.appendChild(card);
  });
}

function showDashboard() {
  ["setupCard", "teamSetup"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const button = document.querySelector(".start-button");
  if (button) button.style.display = "none";
  const waiting = document.getElementById("displayWaiting");
  if (waiting) waiting.style.display = "none";
  const dashboard = document.getElementById("dashboard");
  if (dashboard) dashboard.style.display = "block";
}

function showSetupScreen() {
  const dashboard = document.getElementById("dashboard");
  if (dashboard) dashboard.style.display = "none";
  ["setupCard", "teamSetup"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  });
  const button = document.querySelector(".start-button");
  if (button) button.style.display = "block";
}

function updateDashboardHeader(minutes) {
  const dashRotation = document.getElementById("dashboardRotation");
  if (dashRotation) dashRotation.innerText = `Current Rotation: ${minutes} Minutes`;
  const rotationNumber = document.getElementById("rotationNumber");
  if (rotationNumber) rotationNumber.innerText = minutes;
}

function clearDashboard() {
  const container = document.getElementById("dashboardPositions");
  if (container) container.innerHTML = "";
}
