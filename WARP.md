# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Start Development Server
```bash
npm run dev  # Uses nodemon for auto-restart
npm start    # Production mode
```

### Install Dependencies
```bash
npm install  # Install all dependencies
```

### Environment Setup
```bash
cp .env.example .env  # Create environment file
```

### Testing
Currently no tests are implemented. The `npm test` command will show an error message.

## Architecture Overview

### Application Structure
This is a full-stack web application with a **vanilla JavaScript frontend** and **Node.js/Express backend** using **file-based JSON storage**.

**Frontend Architecture:**
- Single-page application (SPA) using vanilla JavaScript
- Modular JavaScript with global `EventAttendanceApp` object
- Event-driven architecture with DOM manipulation
- RESTful API consumption using `fetch()`

**Backend Architecture:**
- Express.js REST API server
- File-based JSON storage in `/data` directory
- Automatic data directory and file initialization
- CORS-enabled for cross-origin requests

**Data Flow:**
1. Frontend loads events via `GET /api/events`
2. User RSVPs are submitted via `POST /api/rsvp`
3. Attendance summaries retrieved via `GET /api/attendance-summary`
4. All data persisted to JSON files (`events.json`, `rsvps.json`)

### Key Components

**Server (`server/app.js`):**
- Express app with JSON body parsing and CORS
- File I/O operations for data persistence
- Event and RSVP management endpoints
- Static file serving for frontend assets

**Frontend (`public/app.js`):**
- Event loading and display
- RSVP modal management
- Google Calendar iframe integration
- Attendance summary visualization

**Data Storage:**
- `data/events.json` - Event definitions with sample data
- `data/rsvps.json` - RSVP responses with attendance status

## API Endpoints

### Events
- `GET /api/events` - Retrieve all events
- `GET /api/events/:id` - Get specific event
- `POST /api/events` - Create new event (title, date required)

### RSVPs
- `POST /api/rsvp` - Submit RSVP (eventId, attendance required)
- `GET /api/attendance-summary` - All event attendance stats
- `GET /api/attendance-summary/:eventId` - Specific event stats

### System
- `GET /api/health` - Health check endpoint
- `GET *` - Serves `index.html` (SPA routing fallback)

## Google Calendar Integration

The app supports embedding public Google Calendar iframes:

1. User provides Google Calendar public URL
2. JavaScript extracts calendar ID and creates embed URL
3. Calendar iframe is dynamically inserted into DOM
4. Sample events are loaded for demonstration

**Integration Function:** `embedCalendar()` in `public/app.js`

## Facebook SSO (Planned Feature)

Facebook SSO integration is prepared but not implemented:

- Configuration documented in `config/facebook-sso.md`
- Frontend placeholder functions exist
- Requires Facebook App setup and additional dependencies
- Environment variables defined in `.env.example`

## File Organization

```
event-attendance-app/
├── server/app.js          # Express.js backend server
├── public/                # Frontend static assets
│   ├── index.html         # Main HTML file
│   ├── app.js            # Frontend JavaScript
│   └── styles.css        # CSS styling
├── data/                 # JSON data storage (auto-created)
│   ├── events.json       # Event definitions
│   └── rsvps.json        # RSVP responses
├── config/               # Configuration documentation
│   └── facebook-sso.md   # Facebook integration guide
├── .env.example          # Environment template
└── package.json          # Dependencies and scripts
```

## Environment Variables

**Required:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode

**Optional (Future Features):**
- `GOOGLE_CALENDAR_API_KEY` - For advanced calendar integration
- `FACEBOOK_APP_ID` - For Facebook SSO
- `FACEBOOK_APP_SECRET` - For Facebook SSO

## Data Models

**Event Object:**
```javascript
{
  id: string,
  title: string,
  date: ISO string,
  description: string,
  location: string
}
```

**RSVP Object:**
```javascript
{
  id: string (UUID),
  eventId: string,
  attendance: "yes"|"no"|"maybe",
  attendeeName: string,
  isAnonymous: boolean,
  comments: string,
  timestamp: ISO string
}
```

## Development Patterns

### Error Handling
- Server uses try-catch blocks with structured error responses
- Client-side uses fetch with `.catch()` handlers
- User-friendly alert messages for errors

### Data Validation
- Server validates required fields before processing
- Attendance status validated against allowed values
- Event existence checked before accepting RSVPs

### File I/O Operations
Helper functions `readJsonFile()` and `writeJsonFile()` provide consistent JSON file operations with error handling.

### Modal Management
RSVP modal uses global state (`currentEventForRsvp`) and DOM manipulation for show/hide functionality.

## Production Considerations

- File-based storage suitable for small to medium traffic
- Consider database migration for production scale
- HTTPS configuration needed for production deployment
- Static file caching can be implemented
- Environment-specific configuration via `.env`