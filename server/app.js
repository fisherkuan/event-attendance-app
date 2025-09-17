const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
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

// Data storage paths
const DATA_DIR = path.join(__dirname, '../data');
const CONFIG_DIR = path.join(__dirname, '../config');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const RSVPS_FILE = path.join(DATA_DIR, 'rsvps.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'app.json');

// Load configuration
let appConfig = {};
try {
    appConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (error) {
    console.error('Error loading config file:', error);
    appConfig = {
        calendar: { url: '', enabled: false },
        events: { autoFetch: false, defaultTimeRange: 'future', refreshInterval: 300000 },
        rsvp: { allowAnonymous: true, requireName: false }
    };
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize data files if they don't exist
function initializeDataFiles() {
    if (!fs.existsSync(EVENTS_FILE)) {
        const sampleEvents = [
            {
                id: '1',
                title: 'Team Meeting',
                date: '2024-01-20T10:00:00Z',
                description: 'Weekly team sync meeting',
                location: 'Conference Room A'
            },
            {
                id: '2',
                title: 'Company All-Hands',
                date: '2024-01-25T14:00:00Z',
                description: 'Quarterly company meeting',
                location: 'Main Auditorium'
            },
            {
                id: '3',
                title: 'Holiday Party',
                date: '2024-01-30T18:00:00Z',
                description: 'Annual company holiday celebration',
                location: 'Event Hall'
            }
        ];
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(sampleEvents, null, 2));
    }

    if (!fs.existsSync(RSVPS_FILE)) {
        fs.writeFileSync(RSVPS_FILE, JSON.stringify([], null, 2));
    }
}

// Helper functions for data operations
function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return [];
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        return false;
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

            if (summaryMatch && dtstartMatch) {
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

                // Create a stable ID based on event data (include date to ensure uniqueness)
                const eventData = `${summaryMatch[1]}-${start}-${end || ''}`;
                // Use a hash-like approach to create unique IDs
                const hash = require('crypto').createHash('md5').update(eventData).digest('hex');
                const eventId = `cal-${hash.substring(0, 12)}`;
                
                events.push({
                    id: eventId,
                    title: summaryMatch[1].replace(/\\n/g, '\n'),
                    date: start,
                    endDate: end,
                    description: descMatch ? descMatch[1].replace(/\\n/g, '\n') : '',
                    location: locMatch ? locMatch[1].replace(/\\n/g, '\n') : '',
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

// Function to filter events by time range
function filterEventsByTimeRange(events, timeRange) {
    const now = new Date();
    
    return events.filter(event => {
        const eventDate = new Date(event.date);
        
        switch (timeRange) {
            case 'future':
                return eventDate > now;
            case 'past':
                return eventDate < now;
            case 'all':
            default:
                return true;
        }
    });
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
    try {
        const timeRange = req.query.timeRange || appConfig.events.defaultTimeRange;
        let events = readJsonFile(EVENTS_FILE);
        const rsvps = readJsonFile(RSVPS_FILE);
        
        // If auto-fetch is enabled, fetch from calendar
        if (appConfig.events.autoFetch) {
            const calendarEvents = await fetchCalendarEvents();
            // Merge calendar events with existing events, avoiding duplicates
            const existingIds = new Set(events.map(e => e.id));
            const newCalendarEvents = calendarEvents.filter(e => !existingIds.has(e.id));
            
            if (newCalendarEvents.length > 0) {
                events = [...events, ...newCalendarEvents];
                // Save the updated events to file
                writeJsonFile(EVENTS_FILE, events);
            }
        }
        
        // Filter by time range
        const filteredEvents = filterEventsByTimeRange(events, timeRange);

        // Aggregate attendance data
        const eventsWithAttendance = filteredEvents.map(event => {
            const eventRsvps = rsvps.filter(rsvp => rsvp.eventId === event.id && rsvp.attendance === 'yes');
            const attendees = eventRsvps.filter(rsvp => !rsvp.isAnonymous).map(rsvp => rsvp.attendeeName);
            const anonymousCount = eventRsvps.filter(rsvp => rsvp.isAnonymous).length;
            
            return {
                ...event,
                attendees,
                anonymousCount,
                attendingCount: eventRsvps.length
            };
        });
        
        res.json(eventsWithAttendance);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get a specific event
app.get('/api/events/:id', (req, res) => {
    try {
        const events = readJsonFile(EVENTS_FILE);
        const event = events.find(e => e.id === req.params.id);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Submit RSVP (simplified +/- button logic)
app.post('/api/rsvp', (req, res) => {
    try {
        const { eventId, action, attendeeName } = req.body; // action: 'add' or 'remove'
        
        // Validation
        if (!eventId || !action) {
            return res.status(400).json({ 
                success: false, 
                message: 'Event ID and action are required' 
            });
        }
        
        if (!['add', 'remove'].includes(action)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid action. Must be "add" or "remove"' 
            });
        }
        
        // Check if event exists
        const events = readJsonFile(EVENTS_FILE);
        const event = events.find(e => e.id === eventId);
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                message: 'Event not found' 
            });
        }
        
        // Read existing RSVPs
        const rsvps = readJsonFile(RSVPS_FILE);
        
        if (action === 'add') {
            // Add new RSVP
            const newRsvp = {
                id: uuidv4(),
                eventId,
                attendance: 'yes', // Always "attending" when adding
                attendeeName: attendeeName || 'Anonymous',
                isAnonymous: !attendeeName,
                timestamp: new Date().toISOString()
            };
            
            rsvps.push(newRsvp);
        } else if (action === 'remove') {
            // Remove RSVP - if name provided, remove specific person, otherwise remove anonymous count
            if (attendeeName) {
                // Remove specific person by name
                const index = rsvps.findIndex(rsvp => 
                    rsvp.eventId === eventId && 
                    rsvp.attendeeName === attendeeName && 
                    rsvp.attendance === 'yes'
                );
                if (index !== -1) {
                    rsvps.splice(index, 1);
                }
            } else {
                // Remove one anonymous attendance
                const anonymousIndex = rsvps.findIndex(rsvp => 
                    rsvp.eventId === eventId && 
                    rsvp.attendeeName === 'Anonymous' && 
                    rsvp.attendance === 'yes'
                );
                if (anonymousIndex !== -1) {
                    rsvps.splice(anonymousIndex, 1);
                }
            }
        }
        
        // Save to file
        if (writeJsonFile(RSVPS_FILE, rsvps)) {
            res.json({ 
                success: true, 
                message: `RSVP ${action === 'add' ? 'added' : 'removed'} successfully`
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to save RSVP' 
            });
        }
        
    } catch (error) {
        console.error('Error submitting RSVP:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});



// Add new event (for future use)
app.post('/api/events', (req, res) => {
    try {
        const { title, date, description, location } = req.body;
        
        if (!title || !date) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title and date are required' 
            });
        }
        
        const events = readJsonFile(EVENTS_FILE);
        
        const newEvent = {
            id: uuidv4(),
            title,
            date,
            description: description || '',
            location: location || ''
        };
        
        events.push(newEvent);
        
        if (writeJsonFile(EVENTS_FILE, events)) {
            res.json({ 
                success: true, 
                message: 'Event created successfully',
                event: newEvent
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to save event' 
            });
        }
        
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

// Initialize data files
initializeDataFiles();

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Event Attendance App server running on http://localhost:${PORT}`);
    console.log(`📊 Data files initialized in: ${DATA_DIR}`);
    console.log('🎉 Ready to accept RSVPs!');
});