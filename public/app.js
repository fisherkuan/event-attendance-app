// Event Attendance App - Main JavaScript File

// Configuration
const API_BASE_URL = window.location.origin;

// State management
let currentEvents = [];
let currentEventForRsvp = null;
let appConfig = {};

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
    
    // Load configuration first
    loadConfig().then(() => {
        // Set up calendar integration
        setupCalendar();
        
        // Load events
        loadEvents();
        
        // Set up event listeners
        setupEventListeners();
        
        
    });
}

// Load configuration from server
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/config`);
        appConfig = await response.json();
    } catch (error) {
        console.error('Error loading configuration:', error);
        appConfig = {
            calendar: { url: '', enabled: false },
            events: { autoFetch: false, defaultTimeRange: 'future' },
            rsvp: { requireName: true }
        };
    }
}

// Set up calendar based on configuration
function setupCalendar() {
    const placeholder = document.getElementById('calendar-placeholder');
    
    if (appConfig.calendar.enabled && appConfig.calendar.url) {
        placeholder.innerHTML = `
            <iframe src="${appConfig.calendar.url}" 
                    style="border: 0" 
                    width="100%" 
                    height="600" 
                    frameborder="0" 
                    scrolling="no">
            </iframe>
        `;
    } else {
        placeholder.innerHTML = `
            <div class="calendar-setup">
                <h3>Calendar Integration</h3>
                <p>Calendar integration is not configured. Please update the configuration file to enable calendar display.</p>
            </div>
        `;
    }
}



function loadEvents() {
    const timeRange = document.getElementById('time-range')?.value || appConfig.events?.defaultTimeRange || 'future';
    
    // Load events from the server with time range filter
    fetch(`${API_BASE_URL}/api/events?timeRange=${timeRange}`)
        .then(response => response.json())
        .then(events => {
            currentEvents = events;
            displayEvents();
        })
        .catch(error => {
            console.error('Error loading events:', error);
            eventsList.innerHTML = '<p>Error loading events. Please try again later.</p>';
        });
}

function displayEvents() {
    if (currentEvents.length === 0) {
        eventsList.innerHTML = '<p>No events available for RSVP at this time.</p>';
        return;
    }
    
    const now = new Date();
    const eventsHtml = currentEvents.map(event => {
        const eventDate = new Date(event.date);
        const isPastEvent = eventDate < now;
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let attendanceInfo = '';
        if (event.attendees && event.attendees.length > 0) {
            attendanceInfo = event.attendees.join(', ');
        }

        const isFull = event.attendance_limit !== null && event.attendingCount >= event.attendance_limit;

        let attendanceText = `${event.attendingCount} Attending`;
        if (event.attendance_limit !== null) {
            attendanceText += ` / ${event.attendance_limit}`;
        }

        // Show different buttons based on whether it's a past or future event
        const rsvpButtons = isPastEvent
            ? '<div class="rsvp-disabled">Past Event - RSVP Closed</div>'
            : `
                <div class="event-rsvp-buttons">
                    <button class="rsvp-add-btn-small ${isFull ? 'rsvp-full-btn' : ''}" onclick="submitRsvpDirect('${event.id}', 'add')" ${isFull ? 'disabled' : ''}>
                        <span class="icon">${isFull ? 'Full' : '＋'}</span>
                    </button>
                    <button class="rsvp-remove-btn-small" onclick="submitRsvpDirect('${event.id}', 'remove')" ${event.attendingCount === 0 ? 'disabled' : ''}>
                        <span class="icon">－</span>
                    </button>
                </div>
            `;
        
        return `
            <div class="event-card" data-event-id="${event.id}">
                <h3>${event.title}</h3>
                <p class="event-date">${formattedDate}</p>
                <p class="event-description">${event.description}</p>
                ${event.location ? `<p class="event-location">📍 ${event.location}</p>` : ''}
                <div class="event-footer">
                    <div class="attendance-info" title="${attendanceInfo}">
                        <span>${attendanceText}</span>
                    </div>
                    ${rsvpButtons}
                </div>
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
    
    // Show modal
    rsvpModal.classList.remove('hidden');
}

function closeRsvpModal() {
    rsvpModal.classList.add('hidden');
    document.getElementById('attendee-name').value = '';
    currentEventForRsvp = null;
}

function openRemoveRsvpModal(eventId) {
    const event = currentEvents.find(e => e.id === eventId);
    if (!event) return;

    currentEventForRsvp = event;

    document.getElementById('remove-modal-event-title').textContent = event.title;
    document.getElementById('remove-modal-event-date').textContent = new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const attendeeSelector = document.getElementById('attendee-to-remove');
    attendeeSelector.innerHTML = '';

    event.attendees.forEach(attendee => {
        const option = document.createElement('option');
        option.value = attendee;
        option.textContent = attendee;
        attendeeSelector.appendChild(option);
    });

    

    document.getElementById('remove-rsvp-modal').classList.remove('hidden');
}

function closeRemoveRsvpModal() {
    document.getElementById('remove-rsvp-modal').classList.add('hidden');
    currentEventForRsvp = null;
}

function submitRemoveRsvp() {
    if (!currentEventForRsvp) {
        alert('No event selected for RSVP');
        return;
    }

    const attendeeName = document.getElementById('attendee-to-remove').value;
    const rsvpData = {
        eventId: currentEventForRsvp.id,
        action: 'remove',
        attendeeName: attendeeName
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
            alert(result.message);
            closeRemoveRsvpModal();
            loadEvents(); // Refresh events list
        } else {
            alert('Error: ' + result.message);
        }
    })
    .catch(error => {
        console.error('Error submitting RSVP:', error);
        alert('Error submitting RSVP. Please try again.');
    });
}

function setupEventListeners() {
    // Close modal when clicking outside
    rsvpModal.addEventListener('click', function(e) {
        if (e.target === rsvpModal) {
            closeRsvpModal();
        }
    });

    // Refresh button
    const refreshBtn = document.getElementById('refresh-events-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadEvents();
        });
    }
}

function submitRsvpDirect(eventId, action, attendeeName) {
    const event = currentEvents.find(e => e.id === eventId);
    if (!event) {
        alert('Event not found');
        return;
    }

    // Check if it's a past event
    const eventDate = new Date(event.date);
    const now = new Date();
    if (eventDate < now) {
        alert('Cannot RSVP for past events');
        return;
    }

    if (action === 'remove') {
        openRemoveRsvpModal(eventId);
        return;
    }

    if (action === 'add') {
        openRsvpModal(eventId);
        return;
    }
}

function submitRsvp(action) {
    if (!currentEventForRsvp) {
        alert('No event selected for RSVP');
        return;
    }
    
    const attendeeName = document.getElementById('attendee-name').value.trim();
    if (!attendeeName) {
        alert('Please enter your name.');
        return;
    }
    const rsvpData = {
        eventId: currentEventForRsvp.id,
        action: action,
        attendeeName: attendeeName
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
            alert(result.message);
            closeRsvpModal();
            loadEvents(); // Refresh events list
        } else {
            alert('Error: ' + result.message);
        }
    })
    .catch(error => {
        console.error('Error submitting RSVP:', error);
        alert('Error submitting RSVP. Please try again.');
    });
}





// Export functions for potential use by other modules
window.EventAttendanceApp = {
    openRsvpModal,
    closeRsvpModal,
    submitRsvp,
    submitRsvpDirect
};

// Feedback Modal Logic
const feedbackModal = document.getElementById("feedback-modal");
const feedbackBtn = document.getElementById("feedback-btn");
const closeFeedbackBtn = document.getElementById("close-feedback-modal-btn");

if (feedbackBtn) {
    feedbackBtn.onclick = function() {
      feedbackModal.classList.remove("hidden");
    }
}

if (closeFeedbackBtn) {
    closeFeedbackBtn.onclick = function() {
      feedbackModal.classList.add("hidden");
    }
}

// Close feedback modal when clicking outside
if (feedbackModal) {
    feedbackModal.addEventListener('click', function(e) {
        if (e.target === feedbackModal) {
            feedbackModal.classList.add("hidden");
        }
    });
}

// Join Contributor Modal Logic
const joinContributorModal = document.getElementById("join-contributor-modal");
const joinContributorLink = document.getElementById("join-contributor-link");
const closeJoinContributorBtn = document.getElementById("close-join-contributor-modal-btn");

if (joinContributorLink) {
    joinContributorLink.onclick = function(e) {
      e.preventDefault();
      joinContributorModal.classList.remove("hidden");
    }
}

if (closeJoinContributorBtn) {
    closeJoinContributorBtn.onclick = function() {
      joinContributorModal.classList.add("hidden");
    }
}

// Close join contributor modal when clicking outside
if (joinContributorModal) {
    joinContributorModal.addEventListener('click', function(e) {
        if (e.target === joinContributorModal) {
            joinContributorModal.classList.add("hidden");
        }
    });
}