import { NextResponse } from "next/server";
import { pickBestDay, scoreDays } from "@/lib/scoring";
import { geocodeLocation, getForecast, WeatherProviderError } from "@/lib/weather";
import { ACTIVITIES, type Activity, type ErrorResponse, type SuitabilityRequest } from "@/lib/types";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  const body: ErrorResponse = { error: { code, message } };
  return NextResponse.json(body, { status });
}

const API_FORECAST_DAYS = 16;

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function isActivity(value: unknown): value is Activity {
  return typeof value === "string" && ACTIVITIES.includes(value.toLowerCase() as Activity);
}

function parseRequest(body: unknown): SuitabilityRequest | ErrorResponse {
  if (!body || typeof body !== "object") return { error: { code: "INVALID_BODY", message: "Send a JSON object with location, activity, startDate, and endDate." } };
  const input = body as Record<string, unknown>;
  const location = typeof input.location === "string" ? input.location.trim() : "";
  if (location.length < 2 || location.length > 120) return { error: { code: "INVALID_LOCATION", message: "Enter a city or place name between 2 and 120 characters." } };
  if (!isActivity(input.activity)) return { error: { code: "INVALID_ACTIVITY", message: "Choose hiking, running, photography, or picnic." } };
  if (!isDate(input.startDate) || !isDate(input.endDate)) return { error: { code: "INVALID_DATE", message: "Dates must use the YYYY-MM-DD format." } };
  const start = new Date(`${input.startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${input.endDate}T00:00:00.000Z`).getTime();
  const dayCount = Math.round((end - start) / 86_400_000) + 1;
  if (dayCount < 1) return { error: { code: "INVALID_RANGE", message: "The end date must be on or after the start date." } };
  if (dayCount > 7) return { error: { code: "RANGE_TOO_LONG", message: "Choose a date range of seven days or fewer." } };
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const maxForecastMs = today.getTime() + API_FORECAST_DAYS * 86_400_000;
  if (end >= maxForecastMs) return { error: { code: "DATE_OUT_OF_RANGE", message: "Dates must be within the next 16-day forecast window." } };
  return { location, activity: input.activity.toLowerCase() as Activity, startDate: input.startDate, endDate: input.endDate };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "The request body must be valid JSON.", 400);
  }

  const parsed = parseRequest(body);
  if ("error" in parsed) return errorResponse(parsed.error.code, parsed.error.message, 400);

  try {
    const location = await geocodeLocation(parsed.location);
    const forecast = await getForecast(location, parsed.startDate, parsed.endDate);
    if (!forecast.length) return errorResponse("FORECAST_UNAVAILABLE", "No forecast was available for those dates.", 502);
    const days = scoreDays(forecast, parsed.activity);
    const response = {
      location,
      activity: parsed.activity,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      bestDay: pickBestDay(days),
      days,
      generatedAt: new Date().toISOString(),
      source: "Open-Meteo" as const,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof WeatherProviderError) {
      if (error.code === "LOCATION_NOT_FOUND") return errorResponse(error.code, error.message, 404);
      if (error.code === "LOCATION_AMBIGUOUS") return errorResponse(error.code, error.message, 422);
      return errorResponse(error.code, error.message, 502);
    }
    return errorResponse("INTERNAL_ERROR", "We couldn't build a suitability report right now. Please try again.", 500);
  }
}
