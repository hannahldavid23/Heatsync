// HeatSync v3.0 — Weather Intelligence

window.HeatSyncWeather = (() => {
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

  async function searchLocation(query) {
    const value = String(query || "").trim();
    if (value.length < 2) throw new Error("Enter a city, state, or ZIP code.");
    const url = `${GEOCODING_URL}?name=${encodeURIComponent(value)}&count=5&language=en&format=json&countryCode=US`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not search for that location.");
    const data = await response.json();
    const result = data.results?.[0];
    if (!result) throw new Error("No matching location was found.");
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone || "auto",
      label: [result.name, result.admin1, result.postcodes?.[0]].filter(Boolean).join(", ")
    };
  }

  async function fetchCurrent(location) {
    if (!Number.isFinite(Number(location?.latitude)) || !Number.isFinite(Number(location?.longitude))) {
      throw new Error("Store weather location has not been configured.");
    }
    const params = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,uv_index",
      temperature_unit: "fahrenheit",
      timezone: "auto"
    });
    const response = await fetch(`${FORECAST_URL}?${params}`);
    if (!response.ok) throw new Error("Weather service is unavailable.");
    const data = await response.json();
    const current = data.current || {};
    const temperature = Number(current.temperature_2m);
    const humidity = Number(current.relative_humidity_2m);
    return {
      temperature,
      humidity,
      apparentTemperature: Number(current.apparent_temperature),
      uvIndex: Number(current.uv_index),
      weatherCode: Number(current.weather_code),
      heatIndex: calculateHeatIndex(temperature, humidity),
      observedAt: current.time || new Date().toISOString(),
      fetchedAt: Date.now()
    };
  }

  // National Weather Service Rothfusz regression with standard adjustments.
  function calculateHeatIndex(tempF, humidity) {
    const T = Number(tempF);
    const RH = Number(humidity);
    if (!Number.isFinite(T) || !Number.isFinite(RH)) return null;

    let simple = 0.5 * (T + 61 + ((T - 68) * 1.2) + (RH * 0.094));
    simple = (simple + T) / 2;
    if (simple < 80) return Math.round(simple);

    let hi = -42.379 + (2.04901523 * T) + (10.14333127 * RH)
      - (0.22475541 * T * RH) - (0.00683783 * T * T)
      - (0.05481717 * RH * RH) + (0.00122874 * T * T * RH)
      + (0.00085282 * T * RH * RH) - (0.00000199 * T * T * RH * RH);

    if (RH < 13 && T >= 80 && T <= 112) {
      hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    } else if (RH > 85 && T >= 80 && T <= 87) {
      hi += ((RH - 85) / 10) * ((87 - T) / 5);
    }
    return Math.round(hi);
  }

  function riskForHeatIndex(value) {
    const hi = Number(value);
    if (!Number.isFinite(hi)) return { label: "Unavailable", className: "risk-neutral" };
    if (hi < 80) return { label: "Below Caution", className: "risk-low" };
    if (hi <= 90) return { label: "Caution", className: "risk-caution" };
    if (hi <= 103) return { label: "Extreme Caution", className: "risk-warning" };
    if (hi <= 124) return { label: "Danger", className: "risk-danger" };
    return { label: "Extreme Danger", className: "risk-extreme" };
  }

  function recommendationForPolicy(heatIndex, levels, fallbackMinutes) {
    const hi = Number(heatIndex);
    const rules = Array.isArray(levels) ? levels
      .map(rule => ({ minHeatIndex: Number(rule.minHeatIndex), rotationMinutes: Number(rule.rotationMinutes) }))
      .filter(rule => Number.isFinite(rule.minHeatIndex) && Number.isFinite(rule.rotationMinutes) && rule.rotationMinutes > 0)
      .sort((a, b) => b.minHeatIndex - a.minHeatIndex) : [];
    return rules.find(rule => hi >= rule.minHeatIndex)?.rotationMinutes || Number(fallbackMinutes) || 45;
  }

  function iconForCode(code) {
    if ([0].includes(code)) return "☀️";
    if ([1, 2].includes(code)) return "🌤️";
    if ([3].includes(code)) return "☁️";
    if ([45, 48].includes(code)) return "🌫️";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
    if ([95, 96, 99].includes(code)) return "⛈️";
    return "🌡️";
  }

  return { searchLocation, fetchCurrent, calculateHeatIndex, riskForHeatIndex, recommendationForPolicy, iconForCode };
})();
