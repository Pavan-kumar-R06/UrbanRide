# UrbanRide — Smart Urban Mobility & Carpool Platform (React edition)

The original UI is unchanged — the same stylesheet (`client/src/styles.css`), markup and class names — but the
frontend is now a **React 18 + Vite** app, and the platform has ten new mobility features.

```
urbanride/
├── client/                    React frontend (Vite)
│   └── src/
│       ├── styles.css         ORIGINAL stylesheet, copied verbatim
│       ├── additions.css      tiny additions for new modules
│       ├── App.jsx            shell, sidebar, routing between views
│       ├── state/AppContext   all app state, actions, polling (replaces old global state + render())
│       ├── lib/               city graph & routing, api client, formatters
│       ├── components/        Map, AuthPage, Icons, shared feature widgets (Passport, DNA, Reliability, Share…)
│       └── pages/user, admin  one component per page; pages/Track.jsx = public live-tracking link
├── models/                    Mongoose models (+ WalletTxn, Network, Disruption, TripShare, Journey, DemandSignal…)
├── services/                  business logic: wallet, matching, reliability, DNA, analytics, traffic, networks…
├── routes/                    Express routers (+ wallet, networks, disruptions, shares, journeys, passport, analytics)
├── api/[...path].js           Vercel serverless entry
└── server.js                  Express app; serves client/dist
```

## Run it

Prereqs: Node 18+, MongoDB. Copy `.env.example` to `.env` and fill `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

```bash
npm install
npm run build        # installs + builds the React client into client/dist
npm start            # http://localhost:5000
```
Frontend development with hot reload: run `npm start` in one terminal and `npm run dev:client` in another (http://localhost:5173, `/api` is proxied).
Vercel: `vercel.json` is configured to build the client and rewrite SPA routes.

## What was added

| # | Feature | Where |
|---|---|---|
| 1 | React conversion | `client/` |
| 2 | **Vehicle ecosystem** 🚗🏍️🛵 — vehicle type at sign-up/registration, per-type seat limits (bike/scooter = 1), per-type default rate, search filter, type-aware map marker | `services/vehicles.js`, Offer/Find pages |
| 3 | **Demand & supply heatmap** — passenger searches + bookings vs. seats offered, per hub / road / hour; underserved corridors, peak corridors, searches with no match | Admin → Demand heatmap, `services/analytics.js` |
| 4 | **Route disruption & alternatives** — admin closes a road (or auto-scan of congestion); affected bookings are flagged, passengers get alternative rides / multi-vehicle journeys / driver detours; same when a driver cancels | Admin → Disruptions, `services/alternatives.js` |
| 5 | **Corporate / college networks** — private communities; every join request is approved by an admin (e-mail-domain and invite-code checks are shown to the admin as hints); members-only rides are hidden from and unbookable by outsiders (enforced server-side) | Networks pages, `routes/networks.js` |
| 6 | **Ride Reliability Score** (0–100) from punctuality, cancellation rate, completed rides, booking acceptance and ride history; missing signals are skipped, not penalised | `services/reliability.js` |
| 7 | **Mobility Wallet** — ledger of top-ups, holds, payments, earnings, refunds, credits, cancellation fees/compensation; admin chooses charge **at ride start** (hold → released on completion) or **at ride end** | `services/wallet.js`, Wallet pages |
| 8 | **Analytics** — route demand, vehicle utilisation and cancellation patterns now live on the main Analytics page, together with the money/ledger summary | Admin → Analytics |
| 9 | **Share live tracking** — revocable read-only link (`/track/<token>`), no login for the viewer; one tap opens WhatsApp/SMS straight to the saved number; the page switches to “Ride completed” and stops updating when the trip ends; trusted contacts for one-tap sharing | `routes/shares.js`, `pages/Track.jsx` |
| 10 | **Ride transformation** — one continuous journey across vehicles (e.g. bike → car at Koramangala); all legs booked together (rolled back if one fails), automatic hand-over notifications | Find page, `routes/journeys.js` |
| 11 | **Journey DNA** — 10-gene fingerprint (distance, time, route complexity, passengers, vehicle, stops, weather, transfers, cost, reliability) with a stable ID | `services/dna.js` |
| 12 | **Vehicle Passport** — digital passport per vehicle: owner verification, age, completed trips, rating, maintenance, verification validity | Profile, "Vehicle Passport" buttons |

## Things to know

- **Wallet top-ups are simulated** (no payment gateway). New users get a ₹500 demo welcome credit (edit `WELCOME_CREDIT` in `routes/auth.js`).
- **Fares are now computed on the server** from the ride's rate and distance; the browser's fare value is ignored.
- **Traffic**: uses TomTom if `TOMTOM_API_KEY` is set; otherwise a time-of-day simulation, clearly labelled in the admin UI. **Weather** (Journey DNA) comes from Open-Meteo (no key), falling back to "Clear" offline.
- The city is still the original 11-hub Bengaluru graph; "live map" means the existing cartographic SVG map, not tiles.
- The old offline/localStorage mode is gone: the React app is always backed by the API/MongoDB.
- Existing database documents keep working; new fields have defaults (old rides count as 🚗 cars).
- Ride status changes are now validated (e.g. a completed ride cannot be re-opened).

## Testing performed

Backend: 70 end-to-end HTTP checks (vehicles, transfers, wallet holds/refunds/fees, networks, disruptions, sharing, passport, reliability, DNA, analytics, auth) against a MongoDB-compatible server. Frontend: every page for user, driver and admin rendered and exercised in jsdom with zero React errors, including the multi-vehicle booking flow and the public tracking page. It has **not** been checked visually in a real browser/phone — please click through once.

## Update 2 — changes

- Network join requests are **always approved by an admin** (no auto-verification).
- Live-tracking links: drivers cannot share; the public page ends with a “Ride completed / cancelled” banner and stops polling; WhatsApp/SMS buttons open the chat with the contact's number and the message pre-filled (WhatsApp cannot be sent automatically without the WhatsApp Business API — the user taps Send once).
- Removed pages: **Notifications** (alerts now appear as short toasts), **Wallet ledger** (its figures and the charge-timing switch moved to Analytics), **Advanced analytics** (Route demand, Vehicle utilisation and Cancellation patterns moved to Analytics).
- Analytics: removed Highest Demand corridors, Booking Conversion, Recent Trip Routes map. Heatmap: removed Underserved corridors and Peak-demand corridors.
- Vehicle maintenance: **Active** (no charge) / **Service due** (driver pays a wallet fee — car ₹500, bike ₹250, scooter ₹200, see `services/vehicles.js` — then continues) / **Inactive** (driver requests reactivation, admin approves). Publishing is blocked server-side unless Active.
- Vehicle emoji replaced by line icons (`Veh` in `components/Icons.jsx`).
- Fixed the stray “0” on the login page (`{0 && …}` renders “0” in React).
- Every list shows at most the 10 most recent items.
