import { describe, expect, it } from "vitest";
import { pickBestDay, scoreDay, scoreDays, suggestBestTime, suitabilityLabel } from "@/lib/scoring";
import type { WeatherDay } from "@/lib/types";

const clearDay: WeatherDay = {
  date: "2026-08-20",
  temperatureMax: 22,
  temperatureMin: 13,
  precipitationProbability: 5,
  precipitationAmount: 0,
  windSpeed: 10,
  uvIndex: 4,
  weatherCode: 0,
};

describe("suitability scoring", () => {
  it("gives a calm day a strong score for every activity", () => {
    for (const activity of ["hiking", "running", "photography", "picnic"] as const) {
      expect(scoreDay(clearDay, activity).score).toBeGreaterThanOrEqual(85);
      expect(["Excellent", "Good"]).toContain(scoreDay(clearDay, activity).label);
    }
  });

  it("reserves a perfect score for near-ideal conditions", () => {
    const nearIdeal = { ...clearDay, temperatureMax: 20, temperatureMin: 12, windSpeed: 3, uvIndex: 3, weatherCode: 1 };
    expect(scoreDay(nearIdeal, "hiking").score).toBe(100);
    expect(scoreDay(clearDay, "running").score).toBeLessThan(100);
  });

  it("penalizes stacked picnic risks and never goes below zero", () => {
    const difficult = { ...clearDay, precipitationProbability: 90, precipitationAmount: 20, windSpeed: 50, temperatureMax: 38, temperatureMin: 5, uvIndex: 11, weatherCode: 95 };
    const scored = scoreDay(difficult, "picnic");
    expect(scored.score).toBe(0);
    expect(scored.reasons).toEqual(expect.arrayContaining(["Rain risk during daylight", "Breezy picnic conditions", "Thunderstorm risk"]));
    expect(scored.label).toBe("Poor");
  });

  it("weights the same breeze differently by activity", () => {
    const breezy = { ...clearDay, windSpeed: 23 };
    expect(scoreDay(breezy, "picnic").score).toBeLessThan(scoreDay(breezy, "running").score);
    expect(scoreDay(breezy, "picnic").reasons).toContain("Breezy picnic conditions");
  });

  it("does not treat drizzle as a perfect picnic day", () => {
    const drizzle = { ...clearDay, weatherCode: 55 };
    const scored = scoreDay(drizzle, "picnic");
    expect(scored.score).toBeLessThan(90);
    expect(scored.reasons).toContain("Drizzle will dampen plans");
  });

  it("uses the earliest day when scores tie", () => {
    const days = scoreDays([clearDay, { ...clearDay, date: "2026-08-21" }], "hiking");
    expect(pickBestDay(days).date).toBe("2026-08-20");
  });

  it("uses gradual deductions instead of a wind threshold cliff", () => {
    const calmer = scoreDay({ ...clearDay, windSpeed: 18 }, "running");
    const windier = scoreDay({ ...clearDay, windSpeed: 19 }, "running");
    expect(windier.score).toBeLessThanOrEqual(calmer.score);
    expect(calmer.score - windier.score).toBeLessThanOrEqual(2);
  });

  it("favours a dry daylight window over rain later in the day", () => {
    const hours = [
      { time: "2026-08-20T07:00", temperature: 14, precipitationProbability: 0, windSpeed: 5, uvIndex: 1, weatherCode: 2 },
      { time: "2026-08-20T08:00", temperature: 16, precipitationProbability: 0, windSpeed: 5, uvIndex: 2, weatherCode: 2 },
      { time: "2026-08-20T15:00", temperature: 22, precipitationProbability: 95, windSpeed: 18, uvIndex: 7, weatherCode: 63 },
      { time: "2026-08-20T16:00", temperature: 23, precipitationProbability: 95, windSpeed: 18, uvIndex: 6, weatherCode: 63 },
    ];
    const scored = scoreDay({ ...clearDay, precipitationProbability: 95, precipitationAmount: 5, weatherCode: 63, hours }, "running");
    expect(scored.bestTime).toMatchObject({ label: "7 AM–9 AM" });
    expect(scored.score).toBeGreaterThan(scored.bestTime!.score - 20);
  });

  it("applies a small confidence adjustment to later forecast days", () => {
    const days = scoreDays(Array.from({ length: 7 }, (_, index) => ({ ...clearDay, date: `2026-08-${20 + index}` })), "hiking");
    expect(days[0].score).toBeGreaterThan(days[6].score);
    expect(days[6].reasons).toContain("Longer-range forecast");
  });

  it("suggests the strongest two-hour window from hourly conditions", () => {
    const hours = [
      { time: "2026-08-20T08:00", temperature: 17, precipitationProbability: 0, windSpeed: 8, uvIndex: 2, weatherCode: 0 },
      { time: "2026-08-20T09:00", temperature: 19, precipitationProbability: 0, windSpeed: 8, uvIndex: 3, weatherCode: 0 },
      { time: "2026-08-20T10:00", temperature: 22, precipitationProbability: 80, windSpeed: 8, uvIndex: 4, weatherCode: 63 },
    ];
    expect(suggestBestTime(hours, "picnic")).toMatchObject({ label: "8 AM–10 AM" });
    expect(scoreDay({ ...clearDay, hours }, "picnic").bestTime?.label).toBe("8 AM–10 AM");
  });

  it("maps score bands to clear labels", () => {
    expect(suitabilityLabel(90)).toBe("Excellent");
    expect(suitabilityLabel(70)).toBe("Good");
    expect(suitabilityLabel(45)).toBe("Fair");
    expect(suitabilityLabel(44)).toBe("Poor");
  });
});
