# UrbanRide — Smart Urban Mobility & Carpool Web Application

A full-stack, real-world urban mobility platform with a monochrome minimalist design, crisp cartographic dark transit map, real-time telemetry simulation, MongoDB Atlas/Local integration, direct user-to-user chat, and an administrative governance dashboard.

---

## Project Architecture & File Structure

```
urbanride/
├── api/
│   └── [...path].js          # Vercel serverless API entry point
├── assets/
│   ├── css/styles.css        # Application styles
│   └── js/
│       ├── app.js            # Browser app startup and rendering
│       ├── components/       # Auth page, icons, navigation, map, ride card
│       ├── data/             # City route graph and routing algorithms
│       ├── routes/           # User and admin page renderers
│       ├── services/         # Authentication, account, admin, ride logic
│       └── state/            # App data, state, and local persistence
├── models/                   # Mongoose data models
├── routes/                   # Express API routers: auth, users, rides, status
├── .env.example              # Local environment variable template
├── .gitignore                # Excludes secrets and generated files
├── index.html                # Application markup
├── package.json              # Dependencies and local/deploy commands
├── server.js                 # Express setup and local server entry point
└── vercel.json               # Vercel function configuration
```

---

## Environment Setup & Local Development

### Prerequisites
- **Node.js**: v18+ (verified with `v22.17.1`)
- **MongoDB**: Local MongoDB Service running on `mongodb://127.0.0.1:27017`

If you do not already have a local environment file, create one from the template. Set `MONGO_URI` to your MongoDB connection string. Keep real credentials in `.env`; do not commit them. Local development can use the built-in development-only JWT secret; production must set `JWT_SECRET` to a random secret at least 32 characters long.

```powershell
Copy-Item .env.example .env
npm install
```

For local MongoDB, the template URI works when the MongoDB service is running locally. For Atlas, replace it with the Atlas connection string and a database user with appropriate access.

Generate a production JWT secret with:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start the local Express server:
```powershell
npm start
```
The server listens at `http://localhost:5000` by default. Set `PORT` in `.env` to override it.

Other project commands:
```powershell
npm run dev
npm run vercel:dev
npm run vercel:deploy
npm run vercel:deploy:production
```

## Deploying to Vercel

The frontend is served as static files. `api/[...path].js` exposes the existing Express API as a Vercel function, and `vercel.json` configures that function. Vercel CLI commands are npm scripts because `vercel.json` is configuration, not a shell-command file.

1. Push the project to a Git provider and import it into Vercel, or run `npm run vercel:dev` locally to test with Vercel's development server.
2. Add `MONGO_URI` and a newly generated `JWT_SECRET` in the Vercel project's Environment Variables. Use a reachable MongoDB Atlas URI; the local `127.0.0.1` example only works on your own machine.
3. Deploy a preview with `npm run vercel:deploy`, or deploy to production with `npm run vercel:deploy:production`.

The equivalent direct CLI commands are `npx vercel dev`, `npx vercel`, and `npx vercel --prod`. Run `npx vercel login` once before deploying from the CLI.

Passwords are bcrypt-hashed before storage. Existing plaintext passwords are upgraded to bcrypt hashes at database connection; protected ride, booking, and user APIs require a signed JWT.

---

## Development Demo Accounts

These accounts are seeded only outside production. Production databases are not initialized with known demo credentials. To grant an administrator role, register the account first, then promote it through a trusted MongoDB admin workflow.

| Role | Email | Password | Access / Capabilities |
| :--- | :--- | :--- | :--- |
| **Commuter / Driver** | `aarav@demo.com` | `demo123` | Find rides, book seats, track live GPS, chat |
| **Verified Driver** | `meera@demo.com` | `demo123` | Offer rides, manage passenger requests, publish routes |
| **Platform Administrator**| `admin@urbanmobility.com` | `admin123` | Dynamic Analytics KPI cards, User accounts, Vehicle verification queue |

---

## 🔍 Code Analysis & Function Breakdown

### 1. Authentication & 2-Role System (`assets/js/services/auth.js`, `assets/js/services/accounts.js`, `assets/js/components/auth-page.js`)
- **`login()`**: Validates credentials against MongoDB `/api/auth/login`. Automatically directs Admins to the Analytics Dashboard (`V.ana`) and commuters to Find Rides (`V.find`). If Admin logs in, it triggers `syncAdminData()`.
- **`register()`**: Supports optional vehicle details (`#av`). Creates a new account in MongoDB `/api/auth/register`. If a vehicle is provided, it automatically queues it into `vq` with status `pending` for Admin verification.
- **`authV()`**: Pure black & white centered auth card with dynamic car background, toggling between User and Admin logins.

### 2. Real-World Cartographic Map Engine (`assets/js/data/city-graph.js`, `assets/js/components/map.js`)
- **`mapSvg(o={})`**: Custom high-performance SVG vector rendering engine.
  - **No Blurry Shades**: Eliminates blurry radial gradients and repeating pattern tiles.
  - **Dark Cartographic Canvas**: Crisp dark slate `#0c131d` base.
  - **Real Water Bodies**: Bellandur Lake, Ulsoor Lake, Hebbal Lake, Sankey Tank rendered in clean slate-blue (`#1e3a5f`) with sharp borders.
  - **City Reserves & Parks**: Cubbon Park and Lalbagh Botanical Gardens in clean deep forest emerald (`#133e2b`).
  - **Outer Ring Road (ORR)**: Dual-casing highway loop (`#1e293b` casing, `#334155` inner).
  - **Namma Metro Rail**: Crisp Purple Line (`#8b5cf6`) and Green Line (`#10b981`) with dashed centerlines and MG Road interchange.
  - **Active Route**: Solid cyan line (`#0284c7`) with animated dash (`#38bdf8`), without fuzzy glow filters.
  - **City Hubs (`hubNode`)**: Sharp white ring nodes with dark centers and collision-free label positioning (Whitefield anchored to the left, MG Road elevated above pins).
  - **Map Pins (`pin`)**: Crisp emerald green `P` (Pickup) and crimson red `D` (Dropoff) pins.

### 3. Vehicle Verification & Admin Management (`assets/js/services/admin-users.js`, `assets/js/routes/admin-pages.js`)
- **`setCar(u, c)`**: Attaches vehicle details to user profile with status `pending` and queues it into `vq`.
- **`addCar()`**: Allows existing users to register a vehicle from Profile or Offer Ride.
- **`syncAdminData()`**: Fetches all users and vehicle registrations from MongoDB `/api/users`, syncing local memory with MongoDB database records (such as newly registered users).
- **`V.ver()`**: Admin verification panel listing all pending vehicle registration requests with owner full names, car models, and one-click **Approve** / **Reject** buttons.
- **`vset(i, s)`**: Admin action handler that approves or rejects a vehicle, updates user permissions, and sends an in-app notification.
- **`V.users()`**: Complete administrative users table displaying avatar, full user name, email, vehicle registration details with verification badge, account status, and block/unblock controls.

### 4. Direct Commuter Chat (`assets/js/services/rides.js`, `assets/js/routes/user-pages.js`)
- **`send(t)`**: Direct user-to-user messaging function.
  - **Automated bot replies removed**: No fake timer-generated messages. Only messages explicitly typed and sent by real users are recorded and displayed.
- **`threads()`**: Filters ride-specific conversation channels for confirmed drivers and passengers.
- **`V.chat()`**: Responsive messaging UI with message history, timestamps, and route headers.

### 5. Trip Completion & 1–5 Star Rating System (`assets/js/services/rides.js`, `assets/js/routes/user-pages.js`)
- **`step(id)`**: Driver trip lifecycle manager: `scheduled` ➔ `boarding` ➔ `active` ➔ `completed`.
  - When trip completes, it notifies all confirmed passengers: `🎉 Trip Completed! Please rate your driver.`
- **`setInterval()` (Telemetry simulation)**: Advances active trips along coordinate paths. Upon reaching 100% progress, sets status to `completed` and notifies passengers.
- **`V.bookings()`**:
  - Displays distinct `🎉 Ride Completed` banner for finished trips.
  - Interactive **1 to 5 Star Rating** buttons for passengers.
  - Once rated, locks the rating and displays confirmation: `✓ Rated 5 ★ / 5`.
- **`rateRide(bid, rid, stars)`**: Saves passenger rating to booking, updates driver average rating in user accounts, and posts notification log.

### 6. Backend API Routes (`routes/`)
- `GET /api/status`: Checks database connection status and returns MongoDB readyState.
- `POST /api/auth/register`: Creates new user document in MongoDB with hashed credentials and optional pending vehicle.
- `POST /api/auth/login`: Authenticates users and enforces role-based access control (Admin vs User).
- `GET /api/users`: Returns registered users list (excluding password hashes) for Admin inspection.
- `PUT /api/users/:id`: Updates user status or vehicle verification in MongoDB.
- `GET /api/rides`: Lists all published rides.
- `POST /api/rides`: Persists a new ride into MongoDB.
- `PUT /api/rides/:id`: Persists ride status, seat count, and progress updates.
- `GET /api/bookings`: Lists user bookings.
- `POST /api/bookings`: Creates a seat reservation in MongoDB.
- `PUT /api/bookings/:id`: Persists booking status and passenger rating updates.
