import { NextResponse } from "next/server";
import { searchLocations, WeatherProviderError } from "@/lib/weather";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ locations: [] });
  if (query.length > 120) return NextResponse.json({ error: { code: "INVALID_QUERY", message: "Search terms must be 120 characters or fewer." } }, { status: 400 });

  try {
    return NextResponse.json({ locations: await searchLocations(query) });
  } catch (error) {
    if (error instanceof WeatherProviderError) {
      return NextResponse.json({ error: { code: "UPSTREAM_ERROR", message: "Location search is temporarily unavailable." } }, { status: 502 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "We couldn't search locations right now." } }, { status: 500 });
  }
}
