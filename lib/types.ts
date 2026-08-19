export const ACTIVITIES = ["hiking", "running", "photography", "picnic"] as const;

export type Activity = (typeof ACTIVITIES)[number];

export type SuitabilityLabel = "Excellent" | "Good" | "Fair" | "Poor";

export type SuitabilityRequest = {
  location: string;
  activity: Activity;
  startDate: string;
  endDate: string;
};

export type LocationResult = {
  id?: number;
  name: string;
  country: string;
  countryCode?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type LocationSuggestion = LocationResult;

export type WeatherDay = {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  precipitationAmount: number;
  windSpeed: number;
  uvIndex: number;
  weatherCode: number;
  sunrise?: string;
  sunset?: string;
  hours?: WeatherHour[];
};

export type WeatherHour = {
  time: string;
  temperature: number;
  precipitationProbability: number;
  windSpeed: number;
  uvIndex: number;
  weatherCode: number;
};

export type BestTimeSuggestion = {
  start: string;
  end: string;
  label: string;
  score: number;
  reason: string;
};

export type SuitabilityDay = WeatherDay & {
  score: number;
  label: SuitabilityLabel;
  summary: string;
  reasons: string[];
  bestTime?: BestTimeSuggestion;
};

export type SuitabilityReport = {
  location: LocationResult;
  activity: Activity;
  startDate: string;
  endDate: string;
  bestDay: SuitabilityDay;
  days: SuitabilityDay[];
  generatedAt: string;
  source: "Open-Meteo";
};

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
