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
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

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
};

export type SuitabilityDay = WeatherDay & {
  score: number;
  label: SuitabilityLabel;
  summary: string;
  reasons: string[];
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
