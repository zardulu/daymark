import type {
  Activity,
  BestTimeSuggestion,
  SuitabilityDay,
  SuitabilityLabel,
  WeatherDay,
  WeatherHour,
} from "./types";

type WeatherGroup = "clear" | "partlyCloudy" | "overcast" | "fog" | "drizzle" | "rain" | "snow" | "storm";

type ActivityProfile = {
  temperature: { idealMin: number; idealMax: number; lowLimit: number; highLimit: number; maxPenalty: number };
  wind: { comfortable: number; difficult: number; maxPenalty: number; reason: string };
  rain: { maxPenalty: number; amountTolerance: number; heavyAmount: number; amountMaxPenalty: number };
  uv: { comfortable: number; difficult: number; maxPenalty: number };
  weather: Record<WeatherGroup, { penalty: number; reason: string }>;
};

type ScoreEvaluation = {
  score: number;
  penalty: number;
  reasons: string[];
};

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

const PROFILES: Record<Activity, ActivityProfile> = {
  hiking: {
    temperature: { idealMin: 10, idealMax: 24, lowLimit: -2, highLimit: 38, maxPenalty: 18 },
    wind: { comfortable: 8, difficult: 38, maxPenalty: 18, reason: "Breezy trail conditions" },
    rain: { maxPenalty: 22, amountTolerance: 0.5, heavyAmount: 12, amountMaxPenalty: 10 },
    uv: { comfortable: 6, difficult: 11, maxPenalty: 10 },
    weather: {
      clear: { penalty: 0, reason: "" }, partlyCloudy: { penalty: 0, reason: "" }, overcast: { penalty: 2, reason: "Overcast skies" },
      fog: { penalty: 6, reason: "Reduced visibility" }, drizzle: { penalty: 9, reason: "Drizzle risk" }, rain: { penalty: 16, reason: "Wet trail conditions" },
      snow: { penalty: 12, reason: "Snowy trail conditions" }, storm: { penalty: 35, reason: "Thunderstorm risk" },
    },
  },
  running: {
    temperature: { idealMin: 6, idealMax: 18, lowLimit: -5, highLimit: 33, maxPenalty: 18 },
    wind: { comfortable: 6, difficult: 40, maxPenalty: 15, reason: "Breezy running conditions" },
    rain: { maxPenalty: 20, amountTolerance: 0.25, heavyAmount: 10, amountMaxPenalty: 9 },
    uv: { comfortable: 6, difficult: 11, maxPenalty: 9 },
    weather: {
      clear: { penalty: 1, reason: "Open-sky exposure" }, partlyCloudy: { penalty: 0, reason: "" }, overcast: { penalty: 0.5, reason: "Overcast skies" },
      fog: { penalty: 5, reason: "Reduced visibility" }, drizzle: { penalty: 8, reason: "Drizzle risk" }, rain: { penalty: 15, reason: "Wet running conditions" },
      snow: { penalty: 14, reason: "Snowy running conditions" }, storm: { penalty: 35, reason: "Thunderstorm risk" },
    },
  },
  photography: {
    temperature: { idealMin: 8, idealMax: 26, lowLimit: -3, highLimit: 38, maxPenalty: 14 },
    wind: { comfortable: 5, difficult: 35, maxPenalty: 16, reason: "Wind can shake shots" },
    rain: { maxPenalty: 24, amountTolerance: 0.25, heavyAmount: 10, amountMaxPenalty: 10 },
    uv: { comfortable: 7, difficult: 12, maxPenalty: 6 },
    weather: {
      clear: { penalty: 2, reason: "Harsh clear light" }, partlyCloudy: { penalty: 0, reason: "" }, overcast: { penalty: 3, reason: "Flat overcast light" },
      fog: { penalty: 4, reason: "Reduced visibility" }, drizzle: { penalty: 8, reason: "Drizzle may soften views" }, rain: { penalty: 16, reason: "Rain may obscure views" },
      snow: { penalty: 7, reason: "Snow may limit access" }, storm: { penalty: 25, reason: "Thunderstorm risk" },
    },
  },
  picnic: {
    temperature: { idealMin: 18, idealMax: 27, lowLimit: 6, highLimit: 37, maxPenalty: 20 },
    wind: { comfortable: 4, difficult: 32, maxPenalty: 22, reason: "Breezy picnic conditions" },
    rain: { maxPenalty: 32, amountTolerance: 0.1, heavyAmount: 8, amountMaxPenalty: 12 },
    uv: { comfortable: 5, difficult: 11, maxPenalty: 12 },
    weather: {
      clear: { penalty: 0, reason: "" }, partlyCloudy: { penalty: 1, reason: "Variable cloud cover" }, overcast: { penalty: 4, reason: "Overcast skies" },
      fog: { penalty: 7, reason: "Damp, low-visibility conditions" }, drizzle: { penalty: 18, reason: "Drizzle will dampen plans" }, rain: { penalty: 26, reason: "Rain will disrupt a picnic" },
      snow: { penalty: 28, reason: "Snowy conditions" }, storm: { penalty: 40, reason: "Thunderstorm risk" },
    },
  },
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function graduatedPenalty(value: number, comfortable: number, difficult: number, maxPenalty: number) {
  if (value <= comfortable) return 0;
  const ratio = clamp((value - comfortable) / (difficult - comfortable), 0, 1);
  return maxPenalty * Math.pow(ratio, 1.15);
}

function weatherGroup(code: number): WeatherGroup {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 51 && code <= 55) return "drizzle";
  if (code === 45 || code === 48) return "fog";
  if (code === 3) return "overcast";
  if (code === 1 || code === 2) return "partlyCloudy";
  return "clear";
}

function daylightHours(hours: WeatherHour[], sunrise?: string, sunset?: string) {
  const sunriseHour = sunrise ? Number(sunrise.slice(11, 13)) : 6;
  const sunsetHour = sunset ? Number(sunset.slice(11, 13)) : 19;
  return hours.filter((hour) => {
    const value = Number(hour.time.slice(11, 13));
    return value >= Math.max(6, sunriseHour) && value <= Math.min(19, sunsetHour);
  });
}

function wetnessForWeather(code: number) {
  switch (weatherGroup(code)) {
    case "storm": return 1;
    case "rain": return 0.8;
    case "snow": return 0.65;
    case "drizzle": return 0.45;
    default: return 0;
  }
}

function daylightRainExposure(day: WeatherDay) {
  const hours = day.hours ? daylightHours(day.hours, day.sunrise, day.sunset) : [];
  if (!hours.length) return clamp(day.precipitationProbability / 100, 0, 1);

  const risks = hours.map((hour) => Math.max(hour.precipitationProbability / 100, wetnessForWeather(hour.weatherCode)));
  const averageRisk = risks.reduce((sum, risk) => sum + risk, 0) / risks.length;
  const peakRisk = Math.max(...risks);
  return clamp((averageRisk * 0.75) + (peakRisk * 0.25), 0, 1);
}

function temperaturePenalty(day: WeatherDay, profile: ActivityProfile) {
  const { idealMin, idealMax, lowLimit, highLimit, maxPenalty } = profile.temperature;
  const cold = graduatedPenalty(idealMin - day.temperatureMin, 0, idealMin - lowLimit, maxPenalty);
  const heat = graduatedPenalty(day.temperatureMax - idealMax, 0, highLimit - idealMax, maxPenalty);
  return { cold, heat, penalty: Math.min(maxPenalty * 1.5, cold + heat) };
}

function evaluateConditions(day: WeatherDay, activity: Activity): ScoreEvaluation {
  const profile = PROFILES[activity];
  const deductions: Array<{ penalty: number; reason: string }> = [];
  const temperature = temperaturePenalty(day, profile);
  const weather = profile.weather[weatherGroup(day.weatherCode)];
  const wind = graduatedPenalty(day.windSpeed, profile.wind.comfortable, profile.wind.difficult, profile.wind.maxPenalty);
  const rainRisk = daylightRainExposure(day) * 100;
  const amountWeight = day.hours?.length ? 0.25 : 1;
  const rain = Math.min(
    profile.rain.maxPenalty,
    graduatedPenalty(rainRisk, 3, 85, profile.rain.maxPenalty)
      + (graduatedPenalty(day.precipitationAmount, profile.rain.amountTolerance, profile.rain.heavyAmount, profile.rain.amountMaxPenalty) * amountWeight),
  );
  const uv = graduatedPenalty(day.uvIndex, profile.uv.comfortable, profile.uv.difficult, profile.uv.maxPenalty);

  if (weather.penalty) deductions.push({ penalty: weather.penalty, reason: weather.reason });
  if (temperature.cold >= 0.75) deductions.push({ penalty: temperature.cold, reason: temperature.cold >= 7 ? "Cold temperatures" : "A cool start" });
  if (temperature.heat >= 0.75) deductions.push({ penalty: temperature.heat, reason: temperature.heat >= 7 ? "Hot temperatures" : "Warmer temperatures" });
  if (wind >= 0.75) deductions.push({ penalty: wind, reason: profile.wind.reason });
  if (rain >= 0.75) deductions.push({ penalty: rain, reason: rainRisk >= 25 ? "Rain risk during daylight" : "Some rain uncertainty" });
  if (uv >= 0.75) deductions.push({ penalty: uv, reason: uv >= 5 ? "High UV exposure" : "Elevated UV" });

  const penalty = weather.penalty + temperature.penalty + wind + rain + uv;
  return {
    score: Math.round(clamp(100 - penalty)),
    penalty,
    reasons: deductions.sort((left, right) => right.penalty - left.penalty).map((deduction) => deduction.reason),
  };
}

export function weatherLabel(code: number): string {
  return WEATHER_NAMES[code] ?? "Mixed conditions";
}

export function suitabilityLabel(score: number): SuitabilityLabel {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 45) return "Fair";
  return "Poor";
}

function scoreHour(hour: WeatherHour, activity: Activity) {
  return evaluateConditions({
    date: hour.time.slice(0, 10),
    temperatureMax: hour.temperature,
    temperatureMin: hour.temperature,
    precipitationProbability: hour.precipitationProbability,
    precipitationAmount: 0,
    windSpeed: hour.windSpeed,
    uvIndex: hour.uvIndex,
    weatherCode: hour.weatherCode,
  }, activity);
}

function hourLabel(hour: number) {
  const normalized = hour % 24;
  const display = normalized % 12 || 12;
  return `${display} ${normalized >= 12 ? "PM" : "AM"}`;
}

export function suggestBestTime(hours: WeatherHour[], activity: Activity, sunrise?: string, sunset?: string): BestTimeSuggestion | undefined {
  const daylight = daylightHours(hours, sunrise, sunset);
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
  return {
    start: best.start.time,
    end: best.end.time,
    label: `${hourLabel(best.startHour)}–${hourLabel(best.endHour + 1)}`,
    score: best.score,
    reason: best.reasons[0] ?? "Best balance of conditions",
  };
}

function positiveReasons(day: WeatherDay) {
  const reasons: string[] = [];
  if (day.precipitationProbability <= 10 && day.precipitationAmount <= 0.5) reasons.push("Low rain risk");
  if (day.windSpeed <= 12) reasons.push("Light wind");
  if (day.temperatureMin >= 10 && day.temperatureMax <= 28) reasons.push("Comfortable temperatures");
  return reasons.length ? reasons : ["No major weather penalties"];
}

export function scoreDay(day: WeatherDay, activity: Activity): SuitabilityDay {
  const dayScore = evaluateConditions(day, activity);
  const bestTime = day.hours ? suggestBestTime(day.hours, activity, day.sunrise, day.sunset) : undefined;
  const score = bestTime
    ? Math.round((dayScore.score * 0.4) + (bestTime.score * 0.6))
    : dayScore.score;
  const reasons = dayScore.reasons.length ? dayScore.reasons : positiveReasons(day);
  const label = suitabilityLabel(score);
  const summary = `${weatherLabel(day.weatherCode)} · ${Math.round(day.temperatureMin)}–${Math.round(day.temperatureMax)}°C`;

  return { ...day, score, label, summary, reasons, bestTime };
}

function forecastConfidencePenalty(index: number) {
  return Math.min(4, Math.round(index * 0.65));
}

export function scoreDays(days: WeatherDay[], activity: Activity): SuitabilityDay[] {
  return days.map((day, index) => {
    const scored = scoreDay(day, activity);
    const confidencePenalty = forecastConfidencePenalty(index);
    if (!confidencePenalty) return scored;
    const reasons = confidencePenalty >= 2
      ? [...scored.reasons, "Longer-range forecast"]
      : scored.reasons;
    const score = Math.max(0, scored.score - confidencePenalty);
    return { ...scored, score, label: suitabilityLabel(score), reasons };
  });
}

export function pickBestDay(days: SuitabilityDay[]): SuitabilityDay {
  if (!days.length) throw new Error("Cannot pick a best day from an empty forecast");
  return days.reduce((best, day) => (day.score > best.score ? day : best), days[0]);
}
