import type {
  Activity,
  BestTimeSuggestion,
  SuitabilityDay,
  SuitabilityLabel,
  WeatherDay,
  WeatherHour,
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
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorms",
  96: "Thunderstorms + hail",
  99: "Thunderstorms + hail",
};

const RULES: Record<Activity, Rule[]> = {
  hiking: [
    { when: (d) => d.weatherCode === 3, penalty: 2, reason: "Overcast conditions" },
    { when: (d) => d.precipitationProbability > 10 && d.precipitationProbability <= 40, penalty: 2, reason: "Some rain uncertainty" },
    { when: (d) => d.windSpeed > 12 && d.windSpeed <= 30, penalty: 2, reason: "Moderate wind" },
    { when: (d) => d.weatherCode >= 51 && d.weatherCode <= 55, penalty: 10, reason: "Drizzle risk" },
    { when: (d) => (d.weatherCode >= 61 && d.weatherCode <= 82) || (d.weatherCode >= 85 && d.weatherCode <= 86), penalty: 20, reason: "Wet trail conditions" },
    { when: (d) => d.precipitationProbability > 40, penalty: 20, reason: "Rain is likely" },
    { when: (d) => d.precipitationAmount > 3, penalty: 15, reason: "Wet trails possible" },
    { when: (d) => d.windSpeed > 30, penalty: 20, reason: "Strong winds" },
    { when: (d) => d.temperatureMax > 32, penalty: 15, reason: "Heat above 32°C" },
    { when: (d) => d.temperatureMin < 4, penalty: 10, reason: "Chilly start" },
    { when: (d) => d.uvIndex > 7, penalty: 10, reason: "High UV exposure" },
    { when: (d) => d.weatherCode >= 95, penalty: 15, reason: "Thunderstorm risk" },
  ],
  running: [
    { when: (d) => d.weatherCode === 3, penalty: 2, reason: "Overcast conditions" },
    { when: (d) => d.precipitationProbability > 10 && d.precipitationProbability <= 35, penalty: 2, reason: "Some rain uncertainty" },
    { when: (d) => d.windSpeed > 12 && d.windSpeed <= 25, penalty: 2, reason: "Moderate wind" },
    { when: (d) => d.weatherCode >= 51 && d.weatherCode <= 55, penalty: 10, reason: "Drizzle risk" },
    { when: (d) => (d.weatherCode >= 61 && d.weatherCode <= 82) || (d.weatherCode >= 85 && d.weatherCode <= 86), penalty: 20, reason: "Wet running conditions" },
    { when: (d) => d.precipitationProbability > 35, penalty: 15, reason: "Rain is likely" },
    { when: (d) => d.precipitationAmount > 2, penalty: 15, reason: "Wet running conditions" },
    { when: (d) => d.windSpeed > 25, penalty: 15, reason: "Headwinds" },
    { when: (d) => d.temperatureMax > 30, penalty: 15, reason: "Warm for a run" },
    { when: (d) => d.temperatureMin < 2, penalty: 10, reason: "Cold start" },
    { when: (d) => d.uvIndex > 8, penalty: 10, reason: "High UV exposure" },
    { when: (d) => d.weatherCode >= 95, penalty: 15, reason: "Thunderstorm risk" },
  ],
  photography: [
    { when: (d) => d.weatherCode === 3, penalty: 2, reason: "Overcast conditions" },
    { when: (d) => d.precipitationProbability > 10 && d.precipitationProbability <= 30, penalty: 2, reason: "Some rain uncertainty" },
    { when: (d) => d.windSpeed > 15 && d.windSpeed <= 30, penalty: 2, reason: "Moderate wind" },
    { when: (d) => d.weatherCode >= 51 && d.weatherCode <= 55, penalty: 10, reason: "Drizzle may soften views" },
    { when: (d) => (d.weatherCode >= 61 && d.weatherCode <= 82) || (d.weatherCode >= 85 && d.weatherCode <= 86), penalty: 20, reason: "Rain may obscure views" },
    { when: (d) => d.precipitationProbability > 30, penalty: 20, reason: "Rain may obscure views" },
    { when: (d) => d.precipitationAmount > 2, penalty: 10, reason: "Wet conditions" },
    { when: (d) => d.windSpeed > 30, penalty: 15, reason: "Wind can shake shots" },
    { when: (d) => d.temperatureMax > 35, penalty: 10, reason: "Very warm" },
    { when: (d) => d.temperatureMin < 5, penalty: 10, reason: "Cold start" },
    { when: (d) => d.uvIndex > 9, penalty: 5, reason: "Harsh midday light" },
    { when: (d) => d.weatherCode >= 95, penalty: 15, reason: "Thunderstorm risk" },
  ],
  picnic: [
    { when: (d) => d.weatherCode === 3, penalty: 2, reason: "Overcast conditions" },
    { when: (d) => d.precipitationProbability > 10 && d.precipitationProbability <= 25, penalty: 2, reason: "Some rain uncertainty" },
    { when: (d) => d.windSpeed > 10 && d.windSpeed <= 20, penalty: 2, reason: "Moderate wind" },
    { when: (d) => d.weatherCode >= 51 && d.weatherCode <= 55, penalty: 20, reason: "Drizzle will dampen plans" },
    { when: (d) => (d.weatherCode >= 61 && d.weatherCode <= 82) || (d.weatherCode >= 85 && d.weatherCode <= 86), penalty: 30, reason: "Rain will disrupt a picnic" },
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

function scoreHour(hour: WeatherHour, activity: Activity) {
  const matched = RULES[activity].filter((rule) => rule.when({
    date: hour.time.slice(0, 10),
    temperatureMax: hour.temperature,
    temperatureMin: hour.temperature,
    precipitationProbability: hour.precipitationProbability,
    precipitationAmount: 0,
    windSpeed: hour.windSpeed,
    uvIndex: hour.uvIndex,
    weatherCode: hour.weatherCode,
  }));
  return {
    score: Math.max(0, Math.min(100, 100 - matched.reduce((sum, rule) => sum + rule.penalty, 0))),
    reasons: matched.map((rule) => rule.reason),
  };
}

function hourLabel(hour: number) {
  const normalized = hour % 24;
  const display = normalized % 12 || 12;
  return `${display} ${normalized >= 12 ? "PM" : "AM"}`;
}

export function suggestBestTime(hours: WeatherHour[], activity: Activity, sunrise?: string, sunset?: string): BestTimeSuggestion | undefined {
  const sunriseHour = sunrise ? Number(sunrise.slice(11, 13)) : 6;
  const sunsetHour = sunset ? Number(sunset.slice(11, 13)) : 19;
  const daylight = hours.filter((hour) => {
    const value = Number(hour.time.slice(11, 13));
    return value >= Math.max(6, sunriseHour) && value <= Math.min(19, sunsetHour);
  });
  if (!daylight.length) return undefined;

  const windows = daylight.slice(0, -1).flatMap((start, index) => {
    const end = daylight[index + 1];
    const startHour = Number(start.time.slice(11, 13));
    const endHour = Number(end.time.slice(11, 13));
    if (endHour - startHour !== 1) return [];
    const startScore = scoreHour(start, activity);
    const endScore = scoreHour(end, activity);
    return [{
      start,
      end,
      score: Math.round((startScore.score + endScore.score) / 2),
      reasons: [...startScore.reasons, ...endScore.reasons],
      startHour,
      endHour,
    }];
  });
  const candidates = windows.length ? windows : daylight.map((hour) => {
    const score = scoreHour(hour, activity);
    const startHour = Number(hour.time.slice(11, 13));
    return { start: hour, end: hour, score: score.score, reasons: score.reasons, startHour, endHour: startHour };
  });
  const best = candidates.reduce((current, candidate) => candidate.score > current.score ? candidate : current, candidates[0]);
  const endHour = best.endHour + 1;
  return {
    start: best.start.time,
    end: best.end.time,
    label: `${hourLabel(best.startHour)}–${hourLabel(endHour)}`,
    score: best.score,
    reason: best.reasons[0] ?? "Best balance of conditions",
  };
}

export function scoreDay(day: WeatherDay, activity: Activity): SuitabilityDay {
  const matched = RULES[activity].filter((rule) => rule.when(day));
  const score = Math.max(0, Math.min(100, 100 - matched.reduce((sum, rule) => sum + rule.penalty, 0)));
  const reasons = matched.map((rule) => rule.reason);
  if (!reasons.length) {
    if (day.precipitationProbability <= 10 && day.precipitationAmount === 0) reasons.push("Low rain risk");
    if (day.windSpeed <= 15) reasons.push("Light wind");
    if (day.temperatureMin >= 10 && day.temperatureMax <= 30) reasons.push("Comfortable temperatures");
    if (!reasons.length) reasons.push("No major weather penalties");
  }
  const label = suitabilityLabel(score);
  const summary = `${weatherLabel(day.weatherCode)} · ${Math.round(day.temperatureMin)}–${Math.round(day.temperatureMax)}°C`;
  const bestTime = day.hours ? suggestBestTime(day.hours, activity, day.sunrise, day.sunset) : undefined;

  return { ...day, score, label, summary, reasons, bestTime };
}

export function scoreDays(days: WeatherDay[], activity: Activity): SuitabilityDay[] {
  return days.map((day) => scoreDay(day, activity));
}

export function pickBestDay(days: SuitabilityDay[]): SuitabilityDay {
  if (!days.length) throw new Error("Cannot pick a best day from an empty forecast");
  return days.reduce((best, day) => (day.score > best.score ? day : best), days[0]);
}
