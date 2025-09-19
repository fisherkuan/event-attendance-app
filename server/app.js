const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

const isProduction = process.env.NODE_ENV === 'production';

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Load configuration
let appConfig = {};
try {
    appConfig = require('../config/app.json');
} catch (error) {
    console.error('Error loading config file:', error);
    appConfig = {
        calendar: { url: '', enabled: false },
        events: { autoFetch: false, defaultTimeRange: 'future', refreshInterval: 300000 },
        rsvp: { allowAnonymous: false, requireName: true }
    };
}

// Initialize database schema
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS events (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                date TIMESTAMPTZ NOT NULL,
                description TEXT,
                location VARCHAR(255),
                source VARCHAR(255),
                endDate TIMESTAMPTZ,
                attendance_limit INTEGER
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS rsvps (
                id VARCHAR(255) PRIMARY KEY,
                event_id VARCHAR(255) REFERENCES events(id) ON DELETE CASCADE,
                attendee_name VARCHAR(255) NOT NULL,
                attendance VARCHAR(255) NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL
            );
        `);
        console.log('Database schema initialized.');
    } catch (error) {
        console.error('Error initializing database schema:', error);
    } finally {
        client.release();
    }
}

// Function to fetch events from Google Calendar
async function fetchCalendarEvents() {
    if (!appConfig.calendar.enabled || !appConfig.calendar.url) {
        return [];
    }

    try {
        // Extract calendar ID from the URL
        let calendarId = null;
        const calendarUrl = appConfig.calendar.url;
        
        if (calendarUrl.includes('src=')) {
            // Typical embed URL: ...src=calendarId...
            const match = calendarUrl.match(/src=([^&]+)/);
            if (match) calendarId = decodeURIComponent(match[1]);
        } else if (calendarUrl.includes('calendar.google.com/calendar/ical/')) {
            // Direct iCal link
            const match = calendarUrl.match(/ical\/([^\/]+)\//);
            if (match) calendarId = decodeURIComponent(match[1]);
        } else {
            // Try to extract from other formats
            const match = calendarUrl.match(/calendar\/([^\/?&]+)/);
            if (match) calendarId = decodeURIComponent(match[1]);
        }

        if (!calendarId) {
            console.warn('Could not extract calendar ID from URL');
            return [];
        }

        // Construct the public iCal feed URL
        const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;

        const response = await fetch(icalUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const icsText = await response.text();
        
        // Parse the iCal data (very basic parser for VEVENTs)
        const events = [];
        const veventBlocks = icsText.split('BEGIN:VEVENT').slice(1);
        
        for (const block of veventBlocks) {
            const summaryMatch = block.match(/SUMMARY:(.*)/);
            const dtstartMatch = block.match(/DTSTART(?:;[^:]+)?:([0-9T]+)/);
            const dtendMatch = block.match(/DTEND(?:;[^:]+)?:([0-9T]+)/);
            const descMatch = block.match(/DESCRIPTION:(.*)/);
            const locMatch = block.match(/LOCATION:(.*)/);
            const uidMatch = block.match(/UID:(.*)/);

            if (summaryMatch && dtstartMatch && uidMatch) {
                // Convert date string to ISO
                let start = dtstartMatch[1];
                
                if (start.length === 8) {
                    // Format: YYYYMMDD
                    start = `${start.slice(0,4)}-${start.slice(4,6)}-${start.slice(6,8)}T00:00:00Z`;
                } else if (start.length === 15 && start.endsWith('Z')) {
                    // Format: YYYYMMDDTHHMMSSZ
                    start = `${start.slice(0,4)}-${start.slice(4,6)}-${start.slice(6,8)}T${start.slice(9,11)}:${start.slice(11,13)}:${start.slice(13,15)}Z`;
                } else if (start.length === 15 && start.includes('T')) {
                    // Format: YYYYMMDDTHHMMSS (without Z)
                    start = `${start.slice(0,4)}-${start.slice(4,6)}-${start.slice(6,8)}T${start.slice(9,11)}:${start.slice(11,13)}:${start.slice(13,15)}Z`;
                } else {
                    continue; // Skip this event if we can't parse the date
                }

                let end = dtendMatch ? dtendMatch[1] : null;
                if (end) {
                    if (end.length === 8) {
                        end = `${end.slice(0,4)}-${end.slice(4,6)}-${end.slice(6,8)}T00:00:00Z`;
                    } else if (end.length === 15 && end.endsWith('Z')) {
                        end = `${end.slice(0,4)}-${end.slice(4,6)}-${end.slice(6,8)}T${end.slice(9,11)}:${end.slice(11,13)}:${end.slice(13,15)}Z`;
                    } else if (end.length === 15 && end.includes('T')) {
                        end = `${end.slice(0,4)}-${end.slice(4,6)}-${end.slice(6,8)}T${end.slice(9,11)}:${end.slice(11,13)}:${end.slice(13,15)}Z`;
                    }
                }

                // Use the UID as the stable event ID
                const eventId = `cal-${uidMatch[1]}`.trim();
                
                events.push({
                    id: eventId,
                    title: summaryMatch[1].replace(/\n/g, '\n').trim(),
                    date: start,
                    endDate: end,
                    description: descMatch ? descMatch[1].replace(/\n/g, '\n').trim() : '',
                    location: locMatch ? locMatch[1].replace(/\n/g, '\n').trim() : '',
                    source: 'calendar'
                });
            }
        }

        return events;
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return [];
    }
}


// API Routes

// Get configuration
app.get('/api/config', (req, res) => {
    try {
        res.json(appConfig);
    } catch (error) {
        console.error('Error fetching config:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
});

// Get all events
app.get('/api/events', async (req, res) => {
    const client = await pool.connect();
    try {
        const timeRange = req.query.timeRange || appConfig.events.defaultTimeRange;

        if (appConfig.events.autoFetch) {
            const calendarEvents = await fetchCalendarEvents();
            const calendarEventIds = new Set(calendarEvents.map(e => e.id));

            await client.query('BEGIN');

            // Sync calendar events
            if (calendarEvents.length > 0) {
                for (const event of calendarEvents) {
                    await client.query(
                        `INSERT INTO events (id, title, date, endDate, description, location, source)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (id) DO UPDATE SET
                            title = $2,
                            date = $3,
                            endDate = $4,
                            description = $5,
                            location = $6,
                            source = $7`,
                        [event.id, event.title, event.date, event.endDate, event.description, event.location, event.source]
                    );
                }
            }

            // Remove deleted calendar events
            const dbEventsResult = await client.query(`SELECT id FROM events WHERE source = 'calendar'`);
            const dbEventIds = dbEventsResult.rows.map(row => row.id);

            const staleEventIds = dbEventIds.filter(id => !calendarEventIds.has(id));

            if (staleEventIds.length > 0) {
                await client.query(`DELETE FROM events WHERE id = ANY($1::varchar[])`, [staleEventIds]);
            }

            await client.query('COMMIT');
        }

        let timeRangeFilter = '';
        const now = new Date();
        switch (timeRange) {
            case 'future':
                timeRangeFilter = 'WHERE date > NOW()';
                break;
            case 'past':
                timeRangeFilter = 'WHERE date < NOW()';
                break;
            case 'all':
            default:
                timeRangeFilter = '';
                break;
        }

        const eventsResult = await client.query(`SELECT * FROM events ${timeRangeFilter} ORDER BY date`);
        const rsvpsResult = await client.query('SELECT * FROM rsvps');

        const eventsWithAttendance = eventsResult.rows.map(event => {
            const eventRsvps = rsvpsResult.rows.filter(rsvp => rsvp.event_id === event.id && rsvp.attendance === 'yes');
            const attendees = eventRsvps.map(rsvp => rsvp.attendee_name);
            return {
                ...event,
                attendees,
                attendingCount: eventRsvps.length
            };
        });

        res.json(eventsWithAttendance);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    } finally {
        client.release();
    }
});

// Get a specific event
app.get('/api/events/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const result = await client.query('SELECT * FROM events WHERE id = $1', [id]);
        const event = result.rows[0];

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    } finally {
        client.release();
    }
});

// Submit RSVP
app.post('/api/rsvp', async (req, res) => {
    const client = await pool.connect();
    try {
        const { eventId, action, attendeeName } = req.body;

        if (!eventId || !action) {
            return res.status(400).json({ success: false, message: 'Event ID and action are required' });
        }

        if (!['add', 'remove'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action. Must be "add" or "remove"' });
        }

        const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = eventResult.rows[0];

        if (action === 'add') {
            if (event.attendance_limit !== null) {
                const rsvpsResult = await client.query('SELECT COUNT(*) FROM rsvps WHERE event_id = $1 AND attendance = $2', [eventId, 'yes']);
                const attendingCount = parseInt(rsvpsResult.rows[0].count, 10);
                if (attendingCount >= event.attendance_limit) {
                    return res.status(400).json({ success: false, message: 'Event is full' });
                }
            }

            if (!attendeeName) {
                return res.status(400).json({ success: false, message: 'Attendee name is required' });
            }
            const newRsvp = {
                id: uuidv4(),
                eventId,
                attendance: 'yes',
                attendeeName,
                timestamp: new Date()
            };
            await client.query(
                'INSERT INTO rsvps (id, event_id, attendee_name, attendance, timestamp) VALUES ($1, $2, $3, $4, $5)',
                [newRsvp.id, newRsvp.eventId, newRsvp.attendeeName, newRsvp.attendance, newRsvp.timestamp]
            );
        } else if (action === 'remove') {
            if (!attendeeName) {
                return res.status(400).json({ success: false, message: 'Attendee name is required to remove an RSVP' });
            }
            await client.query(
                'DELETE FROM rsvps WHERE id IN (SELECT id FROM rsvps WHERE event_id = $1 AND attendee_name = $2 AND attendance = $3 LIMIT 1)',
                [eventId, attendeeName, 'yes']
            );
        }

        res.json({ success: true, message: `RSVP ${action === 'add' ? 'added' : 'removed'} successfully` });
    } catch (error) {
        console.error('Error submitting RSVP:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Add new event
app.post('/api/events', async (req, res) => {
    const client = await pool.connect();
    try {
        const { title, date, description, location, attendanceLimit } = req.body;

        if (!title || !date) {
            return res.status(400).json({ success: false, message: 'Title and date are required' });
        }

        const newEvent = {
            id: uuidv4(),
            title,
            date,
            description: description || '',
            location: location || '',
            attendanceLimit: attendanceLimit || null
        };

        await client.query(
            'INSERT INTO events (id, title, date, description, location, attendance_limit) VALUES ($1, $2, $3, $4, $5, $6)',
            [newEvent.id, newEvent.title, newEvent.date, newEvent.description, newEvent.location, newEvent.attendanceLimit]
        );

        res.json({ success: true, message: 'Event created successfully', event: newEvent });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Update an event
app.put('/api/events/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { title, date, description, location, attendanceLimit } = req.body;

        if (!title || !date) {
            return res.status(400).json({ success: false, message: 'Title and date are required' });
        }

        await client.query(
            `UPDATE events 
             SET title = $1, date = $2, description = $3, location = $4, attendance_limit = $5
             WHERE id = $6`,
            [title, date, description, location, attendanceLimit, id]
        );

        res.json({ success: true, message: 'Event updated successfully' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Delete an event
app.delete('/api/events/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('DELETE FROM events WHERE id = $1', [id]);
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Serve the main application for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Initialize database and start server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Event Attendance App server running on http://localhost:${PORT}`);
        console.log('🎉 Ready to accept RSVPs!');
    });
});
