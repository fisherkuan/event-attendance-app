// Event Attendance App - Main JavaScript File

// Configuration
const API_BASE_URL = window.location.origin;

// State management
let currentEvents = [];
let currentEventForRsvp = null;

// DOM Elements
const calendarContainer = document.getElementById('calendar-container');
const calendarPlaceholder = document.getElementById('calendar-placeholder');
const eventsList = document.getElementById('events-list');
const rsvpModal = document.getElementById('rsvp-modal');
const rsvpForm = document.getElementById('rsvp-form');
const attendanceSummary = document.getElementById('attendance-summary');

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    console.log('Initializing Event Attendance App...');
    
    // Set up calendar integration placeholder
    setupCalendarPlaceholder();
    
    // Load events
    loadEvents();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load attendance summary
    loadAttendanceSummary();
}

function setupCalendarPlaceholder() {
    // This function will be updated when the Google Calendar link is provided
    const placeholder = document.getElementById('calendar-placeholder');
    placeholder.innerHTML = `
        <div class="calendar-setup">
            <h3>Google Calendar Integration</h3>
            <p>To display your Google Calendar events:</p>
            <ol>
                <li>Go to your Google Calendar</li>
                <li>Find the calendar you want to embed</li>
                <li>Click on the three dots next to the calendar name</li>
                <li>Select "Settings and sharing"</li>
                <li>Scroll down to "Integrate calendar" section</li>
                <li>Copy the "Public URL" or "Embed code"</li>
                <li>Provide this link to complete the integration</li>
            </ol>
            <div class="calendar-form">
                <input type="text" id="calendar-url" placeholder="Paste your Google Calendar public URL here" />
                <button onclick="embedCalendar()">Embed Calendar</button>
            </div>
        </div>
    `;
}

function embedCalendar() {
    const calendarUrl = document.getElementById('calendar-url').value.trim();
    
    if (!calendarUrl) {
        alert('Please enter a valid Google Calendar URL');
        return;
    }
    
    // Extract calendar ID from various Google Calendar URL formats
    let embedUrl = '';
    
    if (calendarUrl.includes('calendar.google.com')) {
        // Handle different URL formats
        if (calendarUrl.includes('embed')) {
            embedUrl = calendarUrl;
        } else if (calendarUrl.includes('calendar/')) {
            // Extract calendar ID and create embed URL
            const match = calendarUrl.match(/calendar\/([^\/]+)/);
            if (match) {
                const calendarId = match[1];
                embedUrl = `https://calendar.google.com/calendar/embed?src=${calendarId}&ctz=America/New_York`;
            }
        }
    }
    
    if (embedUrl) {
        calendarPlaceholder.innerHTML = `
            <iframe src="${embedUrl}" 
                    style="border: 0" 
                    width="800" 
                    height="600" 
                    frameborder="0" 
                    scrolling="no">
            </iframe>
        `;
        
        // Also try to extract events from the calendar
        extractCalendarEvents(calendarUrl);
    } else {
        alert('Invalid Google Calendar URL. Please check the URL and try again.');
    }
}

function extractCalendarEvents(calendarUrl) {
    // For now, we'll create sample events
    // In a real implementation, you would use the Google Calendar API
    currentEvents = [
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
    
    displayEvents();
}

function loadEvents() {
    // Load events from the server
    fetch(`${API_BASE_URL}/api/events`)
        .then(response => response.json())
        .then(events => {
            currentEvents = events;
            displayEvents();
        })
        .catch(error => {
            console.error('Error loading events:', error);
            // Show sample events for demonstration
            extractCalendarEvents('');
        });
}

function displayEvents() {
    if (currentEvents.length === 0) {
        eventsList.innerHTML = '<p>No events available for RSVP at this time.</p>';
        return;
    }
    
    const eventsHtml = currentEvents.map(event => {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="event-card" data-event-id="${event.id}">
                <h3>${event.title}</h3>
                <p class="event-date">${formattedDate}</p>
                <p class="event-description">${event.description}</p>
                ${event.location ? `<p class="event-location">📍 ${event.location}</p>` : ''}
                <button class="rsvp-btn" onclick="openRsvpModal('${event.id}')">RSVP</button>
            </div>
        `;
    }).join('');
    
    eventsList.innerHTML = eventsHtml;
}

function openRsvpModal(eventId) {
    const event = currentEvents.find(e => e.id === eventId);
    if (!event) return;
    
    currentEventForRsvp = event;
    
    // Populate modal with event details
    document.getElementById('modal-event-title').textContent = event.title;
    document.getElementById('modal-event-date').textContent = new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('modal-event-description').textContent = event.description;
    document.getElementById('event-id').value = event.id;
    
    // Show modal
    rsvpModal.classList.remove('hidden');
}

function closeRsvpModal() {
    rsvpModal.classList.add('hidden');
    rsvpForm.reset();
    currentEventForRsvp = null;
}

function setupEventListeners() {
    // RSVP form submission
    rsvpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        submitRsvp();
    });
    
    // Anonymous checkbox handler
    document.getElementById('anonymous').addEventListener('change', function(e) {
        const nameField = document.getElementById('attendee-name');
        if (e.target.checked) {
            nameField.disabled = true;
            nameField.value = '';
        } else {
            nameField.disabled = false;
        }
    });
    
    // Close modal when clicking outside
    rsvpModal.addEventListener('click', function(e) {
        if (e.target === rsvpModal) {
            closeRsvpModal();
        }
    });
}

function submitRsvp() {
    const formData = new FormData(rsvpForm);
    const rsvpData = {
        eventId: formData.get('eventId'),
        attendance: formData.get('attendance'),
        attendeeName: formData.get('anonymous') ? 'Anonymous' : (formData.get('attendeeName') || 'Anonymous'),
        isAnonymous: formData.get('anonymous') === 'on',
        comments: formData.get('comments'),
        timestamp: new Date().toISOString()
    };
    
    // Submit RSVP to server
    fetch(`${API_BASE_URL}/api/rsvp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(rsvpData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            alert('RSVP submitted successfully!');
            closeRsvpModal();
            loadAttendanceSummary(); // Refresh attendance summary
        } else {
            alert('Error submitting RSVP: ' + result.message);
        }
    })
    .catch(error => {
        console.error('Error submitting RSVP:', error);
        alert('Error submitting RSVP. Please try again.');
    });
}

function loadAttendanceSummary() {
    fetch(`${API_BASE_URL}/api/attendance-summary`)
        .then(response => response.json())
        .then(data => {
            displayAttendanceSummary(data);
        })
        .catch(error => {
            console.error('Error loading attendance summary:', error);
            attendanceSummary.innerHTML = '<p>Unable to load attendance summary.</p>';
        });
}

function displayAttendanceSummary(data) {
    if (!data || data.length === 0) {
        attendanceSummary.innerHTML = '<p>No RSVP data available yet.</p>';
        return;
    }
    
    const summaryHtml = data.map(eventSummary => {
        const event = currentEvents.find(e => e.id === eventSummary.eventId);
        const eventTitle = event ? event.title : `Event ${eventSummary.eventId}`;
        
        return `
            <div class="event-summary">
                <h3>${eventTitle}</h3>
                <div class="attendance-stats">
                    <div class="stat">
                        <span class="count">${eventSummary.attending}</span>
                        <span class="label">Attending</span>
                    </div>
                    <div class="stat">
                        <span class="count">${eventSummary.notAttending}</span>
                        <span class="label">Not Attending</span>
                    </div>
                    <div class="stat">
                        <span class="count">${eventSummary.maybe}</span>
                        <span class="label">Maybe</span>
                    </div>
                    <div class="stat">
                        <span class="count">${eventSummary.total}</span>
                        <span class="label">Total RSVPs</span>
                    </div>
                </div>
                ${eventSummary.attendees && eventSummary.attendees.length > 0 ? `
                    <div class="attendee-list">
                        <h4>Attendees:</h4>
                        <ul>
                            ${eventSummary.attendees.map(attendee => 
                                `<li>${attendee.name} - ${attendee.status}</li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    attendanceSummary.innerHTML = summaryHtml;
}

// Facebook SSO placeholder functions
function initializeFacebookSDK() {
    // Placeholder for Facebook SDK initialization
    console.log('Facebook SSO will be implemented in the future');
}

function facebookLogin() {
    // Placeholder for Facebook login
    alert('Facebook SSO integration is coming soon!');
}

// Export functions for potential use by other modules
window.EventAttendanceApp = {
    embedCalendar,
    openRsvpModal,
    closeRsvpModal,
    submitRsvp,
    facebookLogin
};