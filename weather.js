// HeatSync 3.0 Weather Intelligence
// Uses store coordinates, current temperature and humidity, then calculates
// the National Weather Service heat index screening value.

window.HeatSyncWeather = (() => {
  function round(value) {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  function calculateHeatIndex(tempF, humidity) {
    const T = Number(tempF);
    const R = Number(humidity);
    if (!Number.isFinite(T) || !Number.isFinite(R)) return null;

    // NWS simple approximation before the full regression.
    let hi = 0.5 * (T + 61 + ((T - 68) * 1.2) + (R * 0.094));
    hi = (hi + T) / 2;
    if (hi < 80) return round(T);

    hi = -42.379
      + 2.04901523 * T
      + 10.14333127 * R
      - 0.22475541 * T * R
      - 0.00683783 * T * T
      - 0.05481717 * R * R
      + 0.00122874 * T * T * R
      + 0.00085282 * T * R * R
      - 0.00000199 * T * T * R * R;

    if (R < 13 && T >= 80 && T <= 112) {
      hi -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    } else if (R > 85 && T >= 80 && T <= 87) {
      hi += ((R - 85) / 10) * ((87 - T) / 5);
    }
    return round(hi);
  }

  function riskForHeatIndex(heatIndex) {
    const value = Number(heatIndex);
    if (!Number.isFinite(value)) return { label: "UNKNOWN", className: "risk-unknown" };
    if (value < 91) return { label: "LOWER", className: "risk-lower" };
    if (value < 103) return { label: "MODERATE", className: "risk-moderate" };
    if (value < 115) return { label: "HIGH", className: "risk-high" };
    return { label: "VERY HIGH", className: "risk-very-high" };
  }

  async function searchLocation(query) {
    const value = String(query || "").trim();
    if (!value) throw new Error("Enter a city, state, or ZIP code.");
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Location search failed.");
    const data = await response.json();
    const result = data.results?.[0];
    if (!result) throw new Error("No matching location was found.");
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      displayName: [result.name, result.admin1, result.country_code].filter(Boolean).join(", "),
      timezone: result.timezone || "auto"
    };
  }

  async function fetchConditions(latitude, longitude) {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      throw new Error("Store coordinates are missing.");
    }
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,relative_humidity_2m,weather_code",
      daily: "uv_index_max",
      temperature_unit: "fahrenheit",
      timezone: "auto",
      forecast_days: "1"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error("Weather service did not respond.");
    const data = await response.json();
    const temperature = Number(data.current?.temperature_2m);
    const humidity = Number(data.current?.relative_humidity_2m);
    const heatIndex = calculateHeatIndex(temperature, humidity);
    return {
      temperature: round(temperature),
      humidity: round(humidity),
      uvIndex: Number.isFinite(Number(data.daily?.uv_index_max?.[0])) ? Math.round(Number(data.daily.uv_index_max[0]) * 10) / 10 : null,
      heatIndex,
      risk: riskForHeatIndex(heatIndex),
      fetchedAt: Date.now()
    };
  }

  return { calculateHeatIndex, riskForHeatIndex, searchLocation, fetchConditions };
})();
