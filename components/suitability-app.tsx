"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Activity, ErrorResponse, LocationSuggestion, SuitabilityReport } from "@/lib/types";

const ACTIVITY_META: Record<Activity, { label: string; icon: string; description: string }> = {
  hiking: { label: "Hiking", icon: "↗", description: "Trails, elevation, and long daylight" },
  running: { label: "Running", icon: "→", description: "A steady route with a comfortable pace" },
  photography: { label: "Photography", icon: "◌", description: "Clear views and expressive light" },
  picnic: { label: "Picnic", icon: "⌁", description: "A relaxed meal in the open air" },
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en", options).format(new Date(`${value}T12:00:00`));
}

function formatTime(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function suggestionLabel(suggestion: LocationSuggestion) {
  return [suggestion.name, suggestion.admin1, suggestion.country].filter(Boolean).join(", ");
}

function suggestionMeta(suggestion: LocationSuggestion) {
  return [suggestion.admin1, suggestion.country].filter(Boolean).join(" · ");
}

export default function SuitabilityApp() {
  const today = useMemo(() => new Date(), []);
  const [location, setLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionListId = "location-suggestions";
  const suggestionRequest = useRef<AbortController | null>(null);
  const [activity, setActivity] = useState<Activity>("hiking");
  const [startDate, setStartDate] = useState(isoDate(today));
  const [endDate, setEndDate] = useState(isoDate(new Date(today.getTime() + 6 * 86_400_000)));
  const [report, setReport] = useState<SuitabilityReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!report) return;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultsRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [report]);

  useEffect(() => {
    const query = location.trim();
    suggestionRequest.current?.abort();
    setActiveSuggestion(-1);
    if (selectedLocation || query.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    suggestionRequest.current = controller;
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await fetch(`/api/locations?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Location search failed");
        const data = (await response.json()) as { locations?: LocationSuggestion[] };
        if (!controller.signal.aborted) {
          setSuggestions(data.locations ?? []);
          setSuggestionsOpen(true);
        }
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSuggestionsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [location, selectedLocation]);

  function chooseSuggestion(suggestion: LocationSuggestion) {
    setSelectedLocation(suggestion);
    setLocation(suggestion.name);
    setSuggestionsOpen(false);
    setSuggestions([]);
    setActiveSuggestion(-1);
  }

  function handleLocationKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen || (!suggestions.length && !suggestionsLoading)) {
      if (event.key === "Escape") setSuggestionsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSuggestionsOpen(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/suitability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location: selectedLocation ? suggestionLabel(selectedLocation) : location, activity, startDate, endDate }),
      });
      const data = (await response.json()) as SuitabilityReport | ErrorResponse;
      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error.message : "Something went wrong. Please try again.");
      } else {
        setReport(data);
      }
    } catch {
      setError("We couldn't reach the forecast service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Daymark home"><span className="wordmark-dot" />daymark</a>
        <span className="header-note">Weather, made useful.</span>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> OUTDOOR PLANNING GUIDE</p>
          <h1>Put a good day<br /><em>on the calendar.</em></h1>
          <p className="intro-lede">Tell us where you’re headed and what you’re doing. Daymark weighs the forecast, then gives you the clearest day to go.</p>
        </div>
        <div className="sun-mark" aria-hidden="true"><span>☼</span></div>
      </section>

      <section className="planner-section" aria-labelledby="planner-title">
        <div className="section-label"><span>01</span><h2 id="planner-title">Set the scene</h2><span className="label-rule" /></div>
        <form className="planner-form" onSubmit={handleSubmit}>
          <label className="field location-field">
            <span>Where are you going?</span>
            <div className="location-control">
              <input
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setSelectedLocation(null);
                }}
                onFocus={() => { if (suggestions.length || suggestionsLoading) setSuggestionsOpen(true); }}
                onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                onKeyDown={handleLocationKeyDown}
                placeholder="Try Portland, Kyoto, or Cape Town"
                required
                minLength={2}
                maxLength={120}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen}
                aria-controls={suggestionListId}
                aria-activedescendant={activeSuggestion >= 0 ? `location-suggestion-${activeSuggestion}` : undefined}
              />
              {suggestionsOpen && <div className="suggestions-menu" id={suggestionListId} role="listbox" aria-label="Location suggestions">
                {suggestionsLoading && <div className="suggestions-status"><span className="mini-spinner" /> Searching places…</div>}
                {!suggestionsLoading && suggestions.length === 0 && <div className="suggestions-status">No matching places yet.</div>}
                {!suggestionsLoading && suggestions.map((suggestion, index) => <button
                  type="button"
                  role="option"
                  aria-selected={index === activeSuggestion}
                  id={`location-suggestion-${index}`}
                  className={`suggestion-item ${index === activeSuggestion ? "is-active" : ""}`}
                  key={`${suggestion.id ?? suggestion.name}-${suggestion.latitude}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion)}
                ><span className="suggestion-name">{suggestion.name}</span><span className="suggestion-meta">{suggestionMeta(suggestion)}</span></button>)}
              </div>}
            </div>
            <small>City or place name</small>
          </label>
          <label className="field">
            <span>What are you doing?</span>
            <select value={activity} onChange={(event) => setActivity(event.target.value as Activity)}>
              {(Object.keys(ACTIVITY_META) as Activity[]).map((key) => <option key={key} value={key}>{ACTIVITY_META[key].label}</option>)}
            </select>
            <small>{ACTIVITY_META[activity].description}</small>
          </label>
          <div className="date-fields">
            <label className="field"><span>From</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /><small>Start date</small></label>
            <label className="field"><span>To</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /><small>Up to 7 days</small></label>
          </div>
          <button className="submit-button" type="submit" disabled={loading}>{loading ? <><span className="spinner" /> Reading the sky…</> : <>Find my best day <span>↗</span></>}</button>
        </form>
        {error && <div className="error-message" role="alert"><span>!</span>{error}</div>}
      </section>

      {loading && <section className="loading-state" aria-live="polite"><div className="loading-orb" /><p>Checking the next few days in {location || "your place"}…</p></section>}

      {report && !loading && <div ref={resultsRef}><Results report={report} /></div>}

      {!report && !loading && !error && <section className="empty-state"><div className="empty-icon">✳</div><div><h2>Your forecast, with a point of view.</h2><p>We’ll compare every day in your window and call out the trade-offs, so you can make plans with confidence.</p></div></section>}

      <footer className="site-footer"><span>DAYMARK / 2026</span><span>Forecast data by <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a></span><span>Advisory, not a guarantee.</span></footer>
    </main>
  );
}

function Results({ report }: { report: SuitabilityReport }) {
  const meta = ACTIVITY_META[report.activity];
  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> YOUR SEVEN-DAY OUTLOOK</p><h2 id="results-title">{report.location.name}<span>{report.location.country ? `, ${report.location.country}` : ""}</span></h2></div><div className="activity-stamp"><span>{meta.icon}</span>{meta.label}</div></div>
      <div className="best-day">
        <div className="best-copy"><p className="best-kicker">BEST DAY FOR {meta.label.toUpperCase()}</p><p className="best-date">{formatDate(report.bestDay.date, { weekday: "long", month: "long", day: "numeric" })}</p><p className="best-summary">{report.bestDay.summary}</p>{report.bestDay.bestTime && <p className="best-time"><span>BEST WINDOW</span>{report.bestDay.bestTime.label}</p>}<div className="reason-list">{report.bestDay.reasons.map((reason) => <span key={reason}>+ {reason}</span>)}</div></div>
        <div className="score-lockup"><span className="score-number">{report.bestDay.score}</span><span className="score-denom">/ 100</span><span className={`score-label ${report.bestDay.label.toLowerCase()}`}>{report.bestDay.label}</span></div>
      </div>
      <div className="comparison-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> DAILY COMPARISON</p><h3>How the rest of the window looks</h3></div><p className="comparison-note">Scored for {meta.label.toLowerCase()}<br />Updated just now</p></div>
      <div className="day-list">{report.days.map((day, index) => <DayRow key={day.date} day={day} best={day.date === report.bestDay.date} index={index} />)}</div>
      <section className="methodology" id="methodology" aria-label="How the score works">
        <p className="eyebrow"><span className="eyebrow-line" /> HOW THE SCORE WORKS</p>
        <p>Daymark scores each date from 0–100. It combines the full daylight forecast (40%) with the strongest two-hour window (60%), then applies activity-specific adjustments for rain timing, sky conditions, temperature, wind, and UV. Penalties are graduated, so mild conditions have a small effect while severe conditions have a larger one. Forecasts farther out receive a small confidence adjustment. Excellent is 90+, Good is 70–89, Fair is 45–69, and Poor is below 45.</p>
        <div className="method-grid">
          <div><strong>Rain &amp; weather codes</strong><span>Daylight rain timing, weather type, drizzle, showers, snow, and thunderstorms.</span></div>
          <div><strong>Comfort</strong><span>Temperature, wind, and UV change the score gradually rather than at one hard cutoff.</span></div>
          <div><strong>Recommendation</strong><span>The highest score wins; ties go to the earliest day. Farther-out forecasts receive a small confidence adjustment.</span></div>
        </div>
      </section>
    </section>
  );
}

function DayRow({ day, best, index }: { day: SuitabilityReport["days"][number]; best: boolean; index: number }) {
  return <article className={`day-row ${best ? "is-best" : ""}`} style={{ "--row-index": index } as React.CSSProperties}><div className="day-date"><span>{formatDate(day.date, { weekday: "short" })}</span><strong>{formatDate(day.date, { month: "short", day: "numeric" })}</strong></div><div className="day-weather"><span className="weather-glyph">{day.weatherCode >= 60 ? "◒" : day.weatherCode >= 2 ? "◌" : "☼"}</span><span className="day-weather-copy"><span>{day.summary}</span>{best && day.bestTime && <small>Best window · {day.bestTime.label}</small>}</span></div><div className="day-detail"><span>Rain {Math.round(day.precipitationProbability)}%</span><span>Wind {Math.round(day.windSpeed)} km/h</span><span>UV {Math.round(day.uvIndex)}</span></div><div className="day-score"><strong>{day.score}</strong><span className={day.label.toLowerCase()}>{day.label}</span></div></article>;
}
