import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/locations/route";
import { POST } from "@/app/api/suitability/route";

function response(data: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(data) });
}

const forecast = {
  daily: {
    time: ["2026-08-20", "2026-08-21"],
    temperature_2m_max: [24, 22],
    temperature_2m_min: [14, 13],
    precipitation_probability_max: [10, 55],
    precipitation_sum: [0, 5],
    wind_speed_10m_max: [11, 12],
    uv_index_max: [5, 4],
    weather_code: [0, 63],
    sunrise: ["2026-08-20T05:00", "2026-08-21T05:01"],
    sunset: ["2026-08-20T19:00", "2026-08-21T18:59"],
  },
};

describe("GET /api/locations", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns normalized location suggestions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(response({ results: [
      { id: 1, name: "Portland", country: "United States", country_code: "US", admin1: "Oregon", latitude: 45.5, longitude: -122.6, timezone: "America/Los_Angeles" },
    ] })));
    const result = await GET(new Request("http://localhost/api/locations?q=por"));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ locations: [expect.objectContaining({ name: "Portland", admin1: "Oregon", countryCode: "US" })] });
  });

  it("does not call the provider for a too-short query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await GET(new Request("http://localhost/api/locations?q=p"));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ locations: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a stable error when the geocoder fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(response({}, false, 503)));
    const result = await GET(new Request("http://localhost/api/locations?q=par"));
    expect(result.status).toBe(502);
    expect((await result.json()).error.code).toBe("UPSTREAM_ERROR");
  });
});

describe("POST /api/suitability", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns a normalized report for a valid request", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockReturnValueOnce(response({ results: [{ name: "Portland", country: "United States", latitude: 45.5, longitude: -122.6 }] }))
      .mockReturnValueOnce(response(forecast)));
    const result = await POST(new Request("http://localhost/api/suitability", { method: "POST", body: JSON.stringify({ location: "Portland", activity: "hiking", startDate: "2026-08-20", endDate: "2026-08-21" }) }));
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.location).toMatchObject({ name: "Portland", latitude: 45.5 });
    expect(body.bestDay.date).toBe("2026-08-20");
    expect(body.days).toHaveLength(2);
    expect(body.days[0]).toHaveProperty("reasons");
  });

  it("rejects malformed dates and ranges longer than seven days", async () => {
    const malformed = await POST(new Request("http://localhost/api/suitability", { method: "POST", body: JSON.stringify({ location: "Paris", activity: "running", startDate: "tomorrow", endDate: "2026-08-20" }) }));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("INVALID_DATE");
    const tooLong = await POST(new Request("http://localhost/api/suitability", { method: "POST", body: JSON.stringify({ location: "Paris", activity: "running", startDate: "2026-08-20", endDate: "2026-08-27" }) }));
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error.code).toBe("RANGE_TOO_LONG");
  });

  it("rejects unsupported activities", async () => {
    const result = await POST(new Request("http://localhost/api/suitability", { method: "POST", body: JSON.stringify({ location: "Paris", activity: "swimming", startDate: "2026-08-20", endDate: "2026-08-21" }) }));
    expect(result.status).toBe(400);
    expect((await result.json()).error.code).toBe("INVALID_ACTIVITY");
  });

  it("returns useful errors for no-result locations and upstream failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(response({ results: [] })));
    const noLocation = await POST(new Request("http://localhost/api/suitability", { method: "POST", body: JSON.stringify({ location: "Nowherezz", activity: "hiking", startDate: "2026-08-20", endDate: "2026-08-21" }) }));
    expect(noLocation.status).toBe(404);
    expect((await noLocation.json()).error.code).toBe("LOCATION_NOT_FOUND");

    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(response({}, false, 503)));
    const upstream = await POST(new Request("http://localhost/api/suitability", { method: "POST", body: JSON.stringify({ location: "Paris", activity: "hiking", startDate: "2026-08-20", endDate: "2026-08-21" }) }));
    expect(upstream.status).toBe(502);
    expect((await upstream.json()).error.code).toBe("UPSTREAM_ERROR");
  });

  it("asks for more detail when a city name has duplicate exact matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(response({ results: [
      { name: "Springfield", country: "United States", latitude: 39.8, longitude: -89.6 },
      { name: "Springfield", country: "United States", latitude: 44.0, longitude: -72.6 },
    ] })));
    const result = await POST(new Request("http://localhost/api/suitability", { method: "POST", body: JSON.stringify({ location: "Springfield", activity: "picnic", startDate: "2026-08-20", endDate: "2026-08-21" }) }));
    expect(result.status).toBe(422);
    expect((await result.json()).error.code).toBe("LOCATION_AMBIGUOUS");
  });
});
