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
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const RSVPS_FILE = path.join(DATA_DIR, 'rsvps.json');

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

// API Routes

// Get all events
app.get('/api/events', (req, res) => {
    try {
        const events = readJsonFile(EVENTS_FILE);
        res.json(events);
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

// Submit RSVP
app.post('/api/rsvp', (req, res) => {
    try {
        const { eventId, attendance, attendeeName, isAnonymous, comments } = req.body;
        
        // Validation
        if (!eventId || !attendance) {
            return res.status(400).json({ 
                success: false, 
                message: 'Event ID and attendance status are required' 
            });
        }
        
        if (!['yes', 'no', 'maybe'].includes(attendance)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid attendance status' 
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
        
        // Create new RSVP
        const newRsvp = {
            id: uuidv4(),
            eventId,
            attendance,
            attendeeName: isAnonymous ? 'Anonymous' : (attendeeName || 'Anonymous'),
            isAnonymous: Boolean(isAnonymous),
            comments: comments || '',
            timestamp: new Date().toISOString()
        };
        
        // Add to RSVPs array
        rsvps.push(newRsvp);
        
        // Save to file
        if (writeJsonFile(RSVPS_FILE, rsvps)) {
            res.json({ 
                success: true, 
                message: 'RSVP submitted successfully',
                rsvpId: newRsvp.id
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

// Get attendance summary for all events
app.get('/api/attendance-summary', (req, res) => {
    try {
        const events = readJsonFile(EVENTS_FILE);
        const rsvps = readJsonFile(RSVPS_FILE);
        
        const summary = events.map(event => {
            const eventRsvps = rsvps.filter(rsvp => rsvp.eventId === event.id);
            
            const attending = eventRsvps.filter(rsvp => rsvp.attendance === 'yes').length;
            const notAttending = eventRsvps.filter(rsvp => rsvp.attendance === 'no').length;
            const maybe = eventRsvps.filter(rsvp => rsvp.attendance === 'maybe').length;
            
            const attendees = eventRsvps
                .filter(rsvp => rsvp.attendance === 'yes')
                .map(rsvp => ({
                    name: rsvp.attendeeName,
                    status: rsvp.attendance,
                    isAnonymous: rsvp.isAnonymous,
                    comments: rsvp.comments
                }));
            
            return {
                eventId: event.id,
                eventTitle: event.title,
                attending,
                notAttending,
                maybe,
                total: eventRsvps.length,
                attendees
            };
        });
        
        res.json(summary);
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(500).json({ error: 'Failed to fetch attendance summary' });
    }
});

// Get attendance summary for a specific event
app.get('/api/attendance-summary/:eventId', (req, res) => {
    try {
        const { eventId } = req.params;
        const events = readJsonFile(EVENTS_FILE);
        const rsvps = readJsonFile(RSVPS_FILE);
        
        const event = events.find(e => e.id === eventId);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        const eventRsvps = rsvps.filter(rsvp => rsvp.eventId === eventId);
        
        const attending = eventRsvps.filter(rsvp => rsvp.attendance === 'yes').length;
        const notAttending = eventRsvps.filter(rsvp => rsvp.attendance === 'no').length;
        const maybe = eventRsvps.filter(rsvp => rsvp.attendance === 'maybe').length;
        
        const attendees = eventRsvps.map(rsvp => ({
            name: rsvp.attendeeName,
            status: rsvp.attendance,
            isAnonymous: rsvp.isAnonymous,
            comments: rsvp.comments,
            timestamp: rsvp.timestamp
        }));
        
        const summary = {
            eventId: event.id,
            eventTitle: event.title,
            attending,
            notAttending,
            maybe,
            total: eventRsvps.length,
            attendees
        };
        
        res.json(summary);
    } catch (error) {
        console.error('Error fetching event attendance summary:', error);
        res.status(500).json({ error: 'Failed to fetch event attendance summary' });
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