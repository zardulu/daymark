# Daymark

Daymark recommends the best day for an outdoor activity over a seven-day window. It resolves a place with Open-Meteo Geocoding, retrieves the forecast server-side, and applies a deterministic scoring model for hiking, running, photography, or a picnic.

## Run locally

Requirements: Node.js 18.17+ and npm. No API key or environment variables are required.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To run the production build:

```bash
npm test
npm run build
npm start
```

## Architecture

- `app/page.tsx` and `components/suitability-app.tsx` provide the client-side form and result view.
- `app/api/suitability/route.ts` is a Node.js route handler. It validates the request, calls the provider, and returns the app-owned response shape.
- `lib/weather.ts` contains the time-bounded Open-Meteo geocoding and forecast adapters. Provider response details never reach the browser.
- `lib/scoring.ts` contains the pure, testable scoring model.

The app has no database, authentication, LLM, or separate backend service. Forecast responses are not cached in v1.

## API

`POST /api/suitability`

Request:

```json
{
  "location": "Portland",
  "activity": "hiking",
  "startDate": "2026-08-20",
  "endDate": "2026-08-26"
}
```

`activity` must be `hiking`, `running`, `photography`, or `picnic`. Dates use `YYYY-MM-DD`; the inclusive range may contain at most seven days.

Success responses include the normalized location, selected activity, requested range, a `bestDay`, and a `days` array. Every day contains the normalized weather fields, a 0–100 `score`, a `label` (`Excellent`, `Good`, `Fair`, or `Poor`), a short forecast `summary`, and concise `reasons` explaining any deductions.

Errors use a stable body and a useful HTTP status:

```json
{
  "error": {
    "code": "RANGE_TOO_LONG",
    "message": "Choose a date range of seven days or fewer."
  }
}
```

No-result locations return `LOCATION_NOT_FOUND`; duplicate exact city names return `LOCATION_AMBIGUOUS` with a prompt to add a state or country.

## Scoring

Every day starts at 100. Activity-specific rules subtract points for precipitation probability and amount, wind, temperature extremes, UV, and thunderstorm weather codes. The thresholds are intentionally visible in `lib/scoring.ts`; a tie is resolved in favor of the earliest day. A score of 80+ is Excellent, 60–79 Good, 40–59 Fair, and below 40 Poor. This is an advisory planning aid, not a safety guarantee.

## Deploy to Vercel

Import the repository into Vercel, keep the framework preset as **Next.js**, and deploy with the default build settings. There are no environment variables to add. The API route runs in the Node.js runtime so provider calls remain server-side. Vercel preview deployments are useful for checking the mobile and error states before promoting production.

## Data source

Forecast and geocoding data are provided by [Open-Meteo](https://open-meteo.com/). Review its terms and attribution requirements before operating a high-volume public deployment.
