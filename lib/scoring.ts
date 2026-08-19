import type {
  Activity,
  SuitabilityDay,
  SuitabilityLabel,
  WeatherDay,
} from "./types";

type Rule = { when: (day: WeatherDay) => boolean; penalty: number; reason: string };

const WEATHER_NAMES: Record<number, string> = {
  0: "Clear skies",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunderstorms",
  96: "Thunderstorms + hail",
  99: "Thunderstorms + hail",
};

const RULES: Record<Activity, Rule[]> = {
  hiking: [
    { when: (d) => d.precipitationProbability > 40, penalty: 20, reason: "Rain is likely" },
    { when: (d) => d.precipitationAmount > 3, penalty: 15, reason: "Wet trails possible" },
    { when: (d) => d.windSpeed > 30, penalty: 20, reason: "Strong winds" },
    { when: (d) => d.temperatureMax > 32, penalty: 15, reason: "Heat above 32°C" },
    { when: (d) => d.temperatureMin < 4, penalty: 10, reason: "Chilly start" },
    { when: (d) => d.uvIndex > 7, penalty: 10, reason: "High UV exposure" },
    { when: (d) => d.weatherCode >= 95, penalty: 15, reason: "Thunderstorm risk" },
  ],
  running: [
    { when: (d) => d.precipitationProbability > 35, penalty: 15, reason: "Rain is likely" },
    { when: (d) => d.precipitationAmount > 2, penalty: 15, reason: "Wet running conditions" },
    { when: (d) => d.windSpeed > 25, penalty: 15, reason: "Headwinds" },
    { when: (d) => d.temperatureMax > 30, penalty: 15, reason: "Warm for a run" },
    { when: (d) => d.temperatureMin < 2, penalty: 10, reason: "Cold start" },
    { when: (d) => d.uvIndex > 8, penalty: 10, reason: "High UV exposure" },
    { when: (d) => d.weatherCode >= 95, penalty: 15, reason: "Thunderstorm risk" },
  ],
  photography: [
    { when: (d) => d.precipitationProbability > 30, penalty: 20, reason: "Rain may obscure views" },
    { when: (d) => d.precipitationAmount > 2, penalty: 10, reason: "Wet conditions" },
    { when: (d) => d.windSpeed > 30, penalty: 15, reason: "Wind can shake shots" },
    { when: (d) => d.temperatureMax > 35, penalty: 10, reason: "Very warm" },
    { when: (d) => d.temperatureMin < 5, penalty: 10, reason: "Cold start" },
    { when: (d) => d.uvIndex > 9, penalty: 5, reason: "Harsh midday light" },
    { when: (d) => d.weatherCode >= 95, penalty: 15, reason: "Thunderstorm risk" },
  ],
  picnic: [
    { when: (d) => d.precipitationProbability > 25, penalty: 25, reason: "Rain is likely" },
    { when: (d) => d.precipitationAmount > 2, penalty: 15, reason: "Ground may be wet" },
    { when: (d) => d.windSpeed > 20, penalty: 20, reason: "Breezy conditions" },
    { when: (d) => d.temperatureMax > 34, penalty: 15, reason: "Too hot to linger" },
    { when: (d) => d.temperatureMin < 12, penalty: 10, reason: "Cool for a picnic" },
    { when: (d) => d.uvIndex > 8, penalty: 10, reason: "High UV exposure" },
    { when: (d) => d.weatherCode >= 95, penalty: 15, reason: "Thunderstorm risk" },
  ],
};

export function weatherLabel(code: number): string {
  return WEATHER_NAMES[code] ?? "Mixed conditions";
}

export function suitabilityLabel(score: number): SuitabilityLabel {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

export function scoreDay(day: WeatherDay, activity: Activity): SuitabilityDay {
  const matched = RULES[activity].filter((rule) => rule.when(day));
  const score = Math.max(0, Math.min(100, 100 - matched.reduce((sum, rule) => sum + rule.penalty, 0)));
  const reasons = matched.map((rule) => rule.reason);
  const label = suitabilityLabel(score);
  const summary = `${weatherLabel(day.weatherCode)} · ${Math.round(day.temperatureMin)}–${Math.round(day.temperatureMax)}°C`;

  return { ...day, score, label, summary, reasons };
}

export function scoreDays(days: WeatherDay[], activity: Activity): SuitabilityDay[] {
  return days.map((day) => scoreDay(day, activity));
}

export function pickBestDay(days: SuitabilityDay[]): SuitabilityDay {
  if (!days.length) throw new Error("Cannot pick a best day from an empty forecast");
  return days.reduce((best, day) => (day.score > best.score ? day : best), days[0]);
}
