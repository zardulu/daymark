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
  it("gives a calm day a high score for every activity", () => {
    for (const activity of ["hiking", "running", "photography", "picnic"] as const) {
      expect(scoreDay(clearDay, activity).score).toBe(100);
      expect(scoreDay(clearDay, activity).label).toBe("Excellent");
    }
  });

  it("penalizes stacked picnic risks and never goes below zero", () => {
    const difficult = { ...clearDay, precipitationProbability: 90, precipitationAmount: 20, windSpeed: 50, temperatureMax: 38, temperatureMin: 5, uvIndex: 11, weatherCode: 95 };
    const scored = scoreDay(difficult, "picnic");
    expect(scored.score).toBe(0);
    expect(scored.reasons).toEqual(expect.arrayContaining(["Rain is likely", "Breezy conditions", "Thunderstorm risk"]));
    expect(scored.label).toBe("Poor");
  });

  it("applies activity-specific thresholds", () => {
    const breezy = { ...clearDay, windSpeed: 23 };
    expect(scoreDay(breezy, "picnic").score).toBe(80);
    expect(scoreDay(breezy, "running").score).toBe(98);
  });

  it("does not treat drizzle as a perfect picnic day", () => {
    const drizzle = { ...clearDay, weatherCode: 55 };
    const scored = scoreDay(drizzle, "picnic");
    expect(scored.score).toBe(80);
    expect(scored.reasons).toContain("Drizzle will dampen plans");
  });

  it("uses the earliest day when scores tie", () => {
    const days = scoreDays([clearDay, { ...clearDay, date: "2026-08-21" }], "hiking");
    expect(pickBestDay(days).date).toBe("2026-08-20");
  });

  it("suggests the strongest two-hour window from hourly conditions", () => {
    const hours = [
      { time: "2026-08-20T08:00", temperature: 17, precipitationProbability: 0, windSpeed: 8, uvIndex: 2, weatherCode: 0 },
      { time: "2026-08-20T09:00", temperature: 19, precipitationProbability: 0, windSpeed: 8, uvIndex: 3, weatherCode: 0 },
      { time: "2026-08-20T10:00", temperature: 22, precipitationProbability: 80, windSpeed: 8, uvIndex: 4, weatherCode: 63 },
    ];
    expect(suggestBestTime(hours, "picnic")).toMatchObject({ label: "8 AM–10 AM", score: 100 });
    expect(scoreDay({ ...clearDay, hours }, "picnic").bestTime?.label).toBe("8 AM–10 AM");
  });

  it("maps score bands to clear labels", () => {
    expect(suitabilityLabel(80)).toBe("Excellent");
    expect(suitabilityLabel(60)).toBe("Good");
    expect(suitabilityLabel(40)).toBe("Fair");
    expect(suitabilityLabel(39)).toBe("Poor");
  });
});
