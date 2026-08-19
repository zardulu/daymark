"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Activity, ErrorResponse, SuitabilityReport } from "@/lib/types";

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

export default function SuitabilityApp() {
  const today = useMemo(() => new Date(), []);
  const [location, setLocation] = useState("");
  const [activity, setActivity] = useState<Activity>("hiking");
  const [startDate, setStartDate] = useState(isoDate(today));
  const [endDate, setEndDate] = useState(isoDate(new Date(today.getTime() + 6 * 86_400_000)));
  const [report, setReport] = useState<SuitabilityReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/suitability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location, activity, startDate, endDate }),
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
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Try Portland, Kyoto, or Cape Town" required minLength={2} maxLength={120} />
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

      {report && !loading && <Results report={report} />}

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
        <div className="best-copy"><p className="best-kicker">BEST DAY FOR {meta.label.toUpperCase()}</p><p className="best-date">{formatDate(report.bestDay.date, { weekday: "long", month: "long", day: "numeric" })}</p><p className="best-summary">{report.bestDay.summary}</p><div className="reason-list">{(report.bestDay.reasons.length ? report.bestDay.reasons : ["A balanced forecast", "Comfortable conditions"]).map((reason) => <span key={reason}>+ {reason}</span>)}</div></div>
        <div className="score-lockup"><span className="score-number">{report.bestDay.score}</span><span className="score-denom">/ 100</span><span className={`score-label ${report.bestDay.label.toLowerCase()}`}>{report.bestDay.label}</span></div>
      </div>
      <div className="comparison-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> DAILY COMPARISON</p><h3>How the rest of the window looks</h3></div><p className="comparison-note">Scored for {meta.label.toLowerCase()}<br />Updated just now</p></div>
      <div className="day-list">{report.days.map((day, index) => <DayRow key={day.date} day={day} best={day.date === report.bestDay.date} index={index} />)}</div>
      <p className="method-note" id="method">Each score is a transparent blend of rain risk, temperature, wind, UV, and weather code thresholds tuned for {meta.label.toLowerCase()}. <a href="#method">How it works ↗</a></p>
    </section>
  );
}

function DayRow({ day, best, index }: { day: SuitabilityReport["days"][number]; best: boolean; index: number }) {
  return <article className={`day-row ${best ? "is-best" : ""}`} style={{ "--row-index": index } as React.CSSProperties}><div className="day-date"><span>{formatDate(day.date, { weekday: "short" })}</span><strong>{formatDate(day.date, { month: "short", day: "numeric" })}</strong>{best && <b>BEST</b>}</div><div className="day-weather"><span className="weather-glyph">{day.weatherCode >= 60 ? "◒" : day.weatherCode >= 2 ? "◌" : "☼"}</span><span>{day.summary}</span></div><div className="day-detail"><span>Rain {Math.round(day.precipitationProbability)}%</span><span>Wind {Math.round(day.windSpeed)} km/h</span><span>UV {Math.round(day.uvIndex)}</span></div><div className="day-score"><strong>{day.score}</strong><span className={day.label.toLowerCase()}>{day.label}</span></div></article>;
}
