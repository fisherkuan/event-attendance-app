# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Planning Documents

When creating implementation plans, improvement analyses, or deployment guides:
- Store all planning documents in `.plans/` directory (git-ignored)
- Use descriptive filenames: `FEATURE_NAME_plan.md`, `IMPROVEMENT_analysis.md`, etc.
- Reference this directory when looking for existing plans or creating new ones

## Development Commands

### Running the Application
```bash
npm install                 # Install dependencies
npm start                   # Start production server (node server/app.js)
npm run dev                 # Start development server with auto-reload (nodemon)
```

The server runs on `http://localhost:3000` by default (configurable via PORT env var).

### Database
- PostgreSQL is used for production (connection via `DATABASE_URL` env var)
- Database schema is auto-initialized on server startup via `initializeDatabase()` in server/app.js
- Tables: `events`, `rsvps`, `donations`
- Schema migrations are idempotent and run automatically on startup

### Testing
No test suite is currently configured. The package.json test script exits with error code 1.

## Architecture Overview

### Application Flow
This is an event RSVP management system with Google Calendar integration and Stripe donation support.

**Core data flow:**
1. Google Calendar events are fetched from configured calendar(s) via iCal feed
2. Events are synced to PostgreSQL (upserted on each fetch if autoFetch is enabled)
3. Users RSVP to events; RSVPs are stored in database
4. WebSocket broadcasts real-time attendance updates to all connected clients
5. Admin pages allow event and donation management

### Server Architecture (server/app.js)
Single-file Express server (~840 lines) that handles:
- **WebSocket Server**: Real-time attendance updates via `broadcast()` function
- **Calendar Sync**: `fetchCalendarEvents()` fetches and parses iCal format from Google Calendar
- **Event Management**: CRUD operations for events with attendance tracking
- **RSVP System**: Add/remove attendance with capacity limits
- **Donation System**: Tracks donations with Stripe integration
- **Database**: PostgreSQL via `pg` Pool with auto-schema initialization

**Key patterns:**
- Calendar events have source field to track which calendar they came from
- Attendance limits can be set in calendar event description with "limit: N" text
- WebSocket broadcasts attendance changes to all clients for real-time updates
- Stripe checkout sessions are created server-side for donations

### Frontend Architecture (public/)
Vanilla JavaScript with no build step.

**Structure:**
- `index.html` + `app.js` - Main event listing and RSVP interface
- `admin.html` + `admin.js` - Event management interface
- `admin-donations.html` + `js/admin-donations.js` - Donation management
- `donations.html` + `js/donation.js` - Public donation submission page
- `faq.html` + `js/faq.js` - FAQ page
- `styles.css` - Global styles (~1000 lines)
- `sw.js` - Service worker for PWA support

**Client-side features:**
- WebSocket connection for real-time attendance updates
- Event cards with RSVP buttons (add/remove attendance)
- Google Calendar iframe embedding (multiple calendars supported)
- Admin pages for creating/editing events and managing donations

### Configuration (config/app.json)
Central configuration file with:
- `calendars[]` - Array of Google Calendar embed URLs with enable/disable flags
- `events.autoFetch` - Whether to sync calendar events automatically
- `events.defaultTimeRange` - Default filter ("future", "past", "all")
- `rsvp` - RSVP behavior settings
- `stripe.donationPriceId` - Stripe price ID for donations
- `stripe.donationProgress` - Current/goal for donation progress bar
- `joinGroupUrl` - Link to external group (displayed in UI)

## Key Implementation Details

### Google Calendar Integration
- Calendars are configured in `config/app.json` with embed URLs
- Server extracts calendar ID from URL and fetches iCal feed
- Custom iCal parser handles line folding (RFC 5545), HTML entities, and text sanitization
- Events are uniquely identified by `cal-{UID}` where UID comes from iCal
- Attendance limits can be specified in event description with "limit: N" format
- Stale events (removed from calendar) are automatically deleted from database

### RSVP System
- Actions: "add" (RSVP yes) or "remove" (cancel RSVP)
- Attendee name is required for both actions
- Capacity checking: if attendance_limit is set, prevents RSVPs when full
- Real-time updates via WebSocket broadcast after each RSVP action
- Only "yes" attendance status is currently tracked

### WebSocket Real-Time Updates
WebSocket server runs on same HTTP server as Express. Broadcast messages:
- `attendance_update` - Sent when RSVP is added/removed (includes eventId, attendingCount, attendees)
- `event_update` - Sent when event is updated via admin API

Clients connect via WebSocket and listen for these messages to update UI without refresh.

### Environment Variables
Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string (format: postgresql://user:password@host:port/database)
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe public key (served to client via /api/stripe-key)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to "production" to enable SSL for PostgreSQL

## Coding Conventions

### Style
- 4-space indentation
- Semicolons required
- `const`/`let` (no `var`)
- camelCase for variables and functions
- kebab-case for filenames

### Organization
- Server logic in `server/app.js` (monolithic currently)
- Client scripts in `public/` (HTML) and `public/js/` (modular JS)
- Configuration in `config/app.json`
- Static assets (icons, manifest) in `public/icons/`

### Database Patterns
- Use parameterized queries ($1, $2, etc.) to prevent SQL injection
- Release client connections in `finally` blocks
- Transactions for multi-step operations (BEGIN/COMMIT)
- Schema changes use idempotent migrations with error suppression for existing columns

## API Endpoints

### Core Endpoints
- `GET /api/events` - List all events (query param: `timeRange=future|past|all`)
- `GET /api/events/:id` - Get specific event
- `POST /api/events` - Create event (admin)
- `PUT /api/events/:id` - Update event (admin)
- `DELETE /api/events/:id` - Delete event (admin)
- `POST /api/rsvp` - Submit RSVP (body: `{eventId, action: "add"|"remove", attendeeName}`)

### Donation Endpoints
- `GET /api/donations` - Get donations with balance (query param: `limit`)
- `POST /api/donations` - Create donation entry (body: `{amount, description, donator, entry_date}`)
- `GET /api/donation-progress` - Get current/goal for progress bar
- `POST /api/create-donation-checkout-session` - Create Stripe checkout session

### Configuration
- `GET /api/config` - Get app configuration (calendars, settings)
- `GET /api/stripe-key` - Get Stripe publishable key
- `GET /api/health` - Health check

## Deployment Notes

- Designed for Heroku-style deployment (Procfile present)
- PostgreSQL required in production (DATABASE_URL must be set)
- Stripe keys required for donation functionality
- Static files served from `public/` directory
- WebSocket requires HTTP server support (not just Express)
- SSL automatically enabled for PostgreSQL when NODE_ENV=production
