import type { LocationResult, LocationSuggestion, WeatherDay, WeatherHour } from "./types";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export class WeatherProviderError extends Error {
  code: "LOCATION_NOT_FOUND" | "LOCATION_AMBIGUOUS" | "UPSTREAM_ERROR" | "FORECAST_UNAVAILABLE";

  constructor(code: WeatherProviderError["code"], message: string) {
    super(message);
    this.name = "WeatherProviderError";
    this.code = code;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new WeatherProviderError("UPSTREAM_ERROR", `Weather service returned ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error instanceof WeatherProviderError) throw error;
    throw new WeatherProviderError("UPSTREAM_ERROR", "Weather service did not respond in time");
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchLocations(query: string, count = 6): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({ name: query, count: String(count), language: "en", format: "json" });
  const data = (await fetchJson(`${GEO_URL}?${params}`)) as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).flatMap((result) => {
    if (typeof result.latitude !== "number" || typeof result.longitude !== "number" || typeof result.name !== "string") return [];
    return [{
      id: typeof result.id === "number" ? result.id : undefined,
      name: result.name,
      country: String(result.country ?? ""),
      countryCode: typeof result.country_code === "string" ? result.country_code : undefined,
      admin1: typeof result.admin1 === "string" ? result.admin1 : undefined,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: typeof result.timezone === "string" ? result.timezone : undefined,
    }];
  });
}

export async function geocodeLocation(query: string): Promise<LocationResult> {
  const results = await searchLocations(query, 5);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const exactMatches = results.filter((result) => result.name.trim().toLocaleLowerCase() === normalizedQuery);
  if (exactMatches.length > 1) {
    throw new WeatherProviderError("LOCATION_AMBIGUOUS", `“${query}” matches several places. Try adding a state or country.`);
  }
  const result = exactMatches[0] ?? results[0];
  if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") {
    throw new WeatherProviderError("LOCATION_NOT_FOUND", `We couldn't find a forecast for “${query}”. Try a nearby city.`);
  }
  return {
    id: result.id,
    name: String(result.name),
    country: String(result.country ?? ""),
    countryCode: result.countryCode,
    admin1: typeof result.admin1 === "string" ? result.admin1 : undefined,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: typeof result.timezone === "string" ? result.timezone : undefined,
  };
}

export async function getForecast(location: LocationResult, startDate: string, endDate: string): Promise<WeatherDay[]> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "uv_index_max",
      "weather_code",
      "sunrise",
      "sunset",
    ].join(","),
    hourly: "temperature_2m,precipitation_probability,wind_speed_10m,uv_index,weather_code",
  });
  const data = (await fetchJson(`${FORECAST_URL}?${params}`)) as {
    daily?: Record<string, unknown>;
    hourly?: Record<string, unknown>;
  };
  const daily = data.daily;
  if (!daily || !Array.isArray(daily.time)) {
    throw new WeatherProviderError("FORECAST_UNAVAILABLE", "No forecast was available for this location and date range.");
  }
  const fields = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "precipitation_sum",
    "wind_speed_10m_max",
    "uv_index_max",
    "weather_code",
  ];
  const length = daily.time.length;
  const valid = fields.every((field) => Array.isArray(daily[field]) && (daily[field] as unknown[]).length >= length);
  if (!valid) throw new WeatherProviderError("FORECAST_UNAVAILABLE", "The forecast response was incomplete. Please try again.");

  const hourly = data.hourly;
  const hoursByDate = new Map<string, WeatherHour[]>();
  const hourlyFields = ["time", "temperature_2m", "precipitation_probability", "wind_speed_10m", "uv_index", "weather_code"];
  const hourlyLength = hourly && Array.isArray(hourly.time) ? hourly.time.length : 0;
  const hasHourly = Boolean(hourly && hourlyLength && hourlyFields.every((field) => Array.isArray(hourly[field]) && (hourly[field] as unknown[]).length >= hourlyLength));
  if (hasHourly && hourly) {
    for (let index = 0; index < hourlyLength; index += 1) {
      const time = String((hourly.time as unknown[])[index]);
      const hour: WeatherHour = {
        time,
        temperature: Number((hourly.temperature_2m as unknown[])[index] ?? 0),
        precipitationProbability: Number((hourly.precipitation_probability as unknown[])[index] ?? 0),
        windSpeed: Number((hourly.wind_speed_10m as unknown[])[index] ?? 0),
        uvIndex: Number((hourly.uv_index as unknown[])[index] ?? 0),
        weatherCode: Number((hourly.weather_code as unknown[])[index] ?? 0),
      };
      const date = time.slice(0, 10);
      hoursByDate.set(date, [...(hoursByDate.get(date) ?? []), hour]);
    }
  }

  return daily.time.map((date, index) => ({
    date: String(date),
    temperatureMax: Number((daily.temperature_2m_max as unknown[])[index]),
    temperatureMin: Number((daily.temperature_2m_min as unknown[])[index]),
    precipitationProbability: Number((daily.precipitation_probability_max as unknown[])[index] ?? 0),
    precipitationAmount: Number((daily.precipitation_sum as unknown[])[index] ?? 0),
    windSpeed: Number((daily.wind_speed_10m_max as unknown[])[index] ?? 0),
    uvIndex: Number((daily.uv_index_max as unknown[])[index] ?? 0),
    weatherCode: Number((daily.weather_code as unknown[])[index] ?? 0),
    sunrise: Array.isArray(daily.sunrise) ? String((daily.sunrise as unknown[])[index] ?? "") : undefined,
    sunset: Array.isArray(daily.sunset) ? String((daily.sunset as unknown[])[index] ?? "") : undefined,
    hours: hoursByDate.get(String(date)),
  }));
}
