# fitbit-heartrate-retrieval

Retrieve heart rate and health data from Fitbit and Google Fit APIs and export it as TSV.

## Overview

This collection of Node.js scripts handles OAuth 2.0 authentication and data retrieval for both the Fitbit Web API and the Google Fit REST API. It fetches intraday heart rate data and exports it to tab-separated files with optional timezone adjustment.

## Prerequisites

- Node.js 18+

No additional npm packages are required; the scripts use Node's built-in `https` module.

## Configuration

Create a `.env` file in this directory (never commit it) with your API credentials:

```
FITBIT_CLIENT_ID=...
FITBIT_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Scripts

### Fitbit

| Script | Description |
|--------|-------------|
| `fitbit-auth.mjs` | OAuth 2.0 flow — opens browser, receives auth code, exchanges for access token |
| `fitbit-profile.mjs` | Retrieves the authenticated user's profile |
| `fitbit-heartrate-intraday.mjs` | Fetches intraday heart rate for a specific date; prints min/max/average |
| `fitbit-to-tsv.mjs` | Exports Fitbit heart rate data to TSV |
| `fitbit-to-tsv-adjusted.mjs` | Same as above but with timezone adjustment |

### Google Fit

| Script | Description |
|--------|-------------|
| `google-fit-auth.mjs` | OAuth 2.0 authentication for Google Fit |
| `google-fit-check.mjs` | Verifies API connectivity |
| `google-fit-heartrate.mjs` | Retrieves heart rate data from Google Fit |

## Usage

1. Run the auth script to obtain an access token:

   ```sh
   node fitbit-auth.mjs
   ```

2. Fetch intraday heart rate for a date:

   ```sh
   node fitbit-heartrate-intraday.mjs
   ```

3. Export to TSV:

   ```sh
   node fitbit-to-tsv.mjs
   ```
