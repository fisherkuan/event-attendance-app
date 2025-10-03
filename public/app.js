// Debounce function
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    
    // Load configuration first
    loadConfig().then(() => {
        // Set up calendar integration
        setupCalendar();
        
        // Populate calendar filter
        populateCalendarFilter();

        // Load events
        loadEvents();
        
        // Set up event listeners
        setupEventListeners();

        // Set up WebSocket connection
        setupWebSocket();
    });
}

// Set up WebSocket connection
function setupWebSocket() {
    const wsProtocol = window.location.protocol === 'https' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connection established');
    };

    ws.onmessage = (message) => {
        try {
            const data = JSON.parse(message.data);
            if (data.type === 'attendance_update') {
                const { eventId, attendingCount, attendees } = data.payload;
                const eventIndex = currentEvents.findIndex(e => e.id === eventId);

                if (eventIndex !== -1) {
                    // Update only attendance-related fields
                    currentEvents[eventIndex].attendingCount = attendingCount;
                    currentEvents[eventIndex].attendees = attendees;
                    displayEvents(); // Re-render the events list
                }
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed. Attempting to reconnect...');
        // Simple reconnect logic
        setTimeout(setupWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Load configuration from server
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/config`);
        appConfig = await response.json();
    } catch (error) {
        console.error('Error loading configuration:', error);
        appConfig = {
            calendars: [],
            events: { autoFetch: false, defaultTimeRange: 'future' },
            rsvp: { requireName: true }
        };
    }
}

// Set up calendar based on configuration
function setupCalendar() {
    const placeholder = document.getElementById('calendar-placeholder');
    const addToCalendarBtn = document.getElementById('add-to-calendar-btn');

    if (appConfig.calendars && appConfig.calendars.length > 0) {
        const updateCalendarView = () => {
            const isMobile = window.innerWidth < 768;
            let baseCalendarUrl = "https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=Europe%2FBrussels&showPrint=0&showTitle=0";
            let srcParams = "";
            let colors = ["%237986cb", "%23b39ddb", "%23f6bf26"]; // Example colors, can be expanded or configured

            appConfig.calendars.forEach((calendarEntry, index) => {
                if (calendarEntry.enabled) {
                    try {
                        const u = new URL(calendarEntry.url);
                        const src = u.searchParams.get('src');
                        if (src) {
                            srcParams += `&src=${src}`;
                            if (colors[index]) {
                                srcParams += `&color=${colors[index]}`;
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing individual calendar URL:', calendarEntry.url, error);
                    }
                }
            });

            let finalCalendarUrl = `${baseCalendarUrl}${srcParams}`;

            if (isMobile) {
                if (!finalCalendarUrl.includes('mode=AGENDA')) {
                    finalCalendarUrl += '&mode=AGENDA';
                }
            } else {
                if (finalCalendarUrl.includes('mode=AGENDA')) {
                    finalCalendarUrl = finalCalendarUrl.replace('mode=AGENDA', 'mode=MONTH');
                } else if (!finalCalendarUrl.includes('mode=MONTH')) {
                    finalCalendarUrl += '&mode=MONTH';
                }
            }

            placeholder.innerHTML = `
                <iframe src="${finalCalendarUrl}" 
                        style="border: 0" 
                        width="100%" 
                        height="600" 
                        frameborder="0" 
                        scrolling="no">
                </iframe>
            `;
        };

        // Initial setup
        updateCalendarView();

        // Update on resize
        window.addEventListener('resize', updateCalendarView);

        const joinGroupLink = document.getElementById('join-group-link');
        if (joinGroupLink && appConfig.joinGroupUrl) {
            joinGroupLink.href = appConfig.joinGroupUrl;
        }

        const addToCalendarDropdown = document.getElementById('add-to-calendar-dropdown');
        if (addToCalendarDropdown) {
            appConfig.calendars.forEach(calendar => {
                if (calendar.enabled) {
                    try {
                        const u = new URL(calendar.url);
                        const calendarId = u.searchParams.get('src');
                        if (calendarId) {
                            const link = document.createElement('a');
                            link.href = `https://www.google.com/calendar/render?cid=${calendarId}`;
                            link.textContent = calendar.name;
                            link.target = '_blank';
                            addToCalendarDropdown.appendChild(link);
                        }
                    } catch (error) {
                        console.error('Error parsing calendar URL for Add to Calendar button:', error);
                    }
                }
            });
        }

    } else {
        placeholder.innerHTML = `
            <div class="calendar-setup">
                <h3>Calendar Integration</h3>
                <p>Calendar integration is not configured. Please update the configuration file to enable calendar display.</p>
            </div>
        `;
        const addToCalendarDropdown = document.getElementById('add-to-calendar-dropdown');
        if (addToCalendarDropdown) {
            addToCalendarDropdown.parentElement.style.display = 'none';
        }
        }
    }
    
    function populateCalendarFilter() {
        const calendarFilterContainer = document.querySelector('.calendar-filter-container');
        if (!calendarFilterContainer) return;
    
        // Clear existing content
        calendarFilterContainer.innerHTML = '';
    
        if (appConfig.calendars && appConfig.calendars.length > 0) {
            appConfig.calendars.forEach((calendarEntry) => {
                if (calendarEntry.enabled) {
                    try {
                        const u = new URL(calendarEntry.url);
                        const calendarId = u.searchParams.get('src');
                        if (calendarId) {
                            const label = document.createElement('label');
                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.className = 'calendar-checkbox';
                            checkbox.value = calendarId;
                            checkbox.checked = true; // By default, all are checked
                            checkbox.addEventListener('change', debounce(loadEvents, 250)); // Re-load events on change
    
                            label.appendChild(checkbox);
                            label.appendChild(document.createTextNode(` ${calendarEntry.name}`));
                            calendarFilterContainer.appendChild(label);
                        }
                    } catch (error) {
                        console.error('Error parsing calendar URL for filter:', calendarEntry.url, error);
                    }
                }
            });
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
    const selectedCalendarIds = Array.from(document.querySelectorAll('.calendar-checkbox:checked'))
                                     .map(checkbox => checkbox.value);

    let filteredEvents = currentEvents;

    if (selectedCalendarIds.length > 0 && selectedCalendarIds.length < appConfig.calendars.length) {
        filteredEvents = currentEvents.filter(event => selectedCalendarIds.includes(event.source));
    }

    if (filteredEvents.length === 0) {
        eventsList.innerHTML = '<p>No events available for RSVP at this time.</p>';
        return;
    }
    
    const now = new Date();
    const eventsHtml = filteredEvents.map(event => {
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
            attendanceInfo = event.attendees.join('\n');
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
                    <button class="rsvp-add-btn-small ${isFull ? 'rsvp-full-btn' : ''}" data-event-id="${event.id}" data-action="add" ${isFull ? 'disabled' : ''}>
                        <span class="icon">＋</span>
                    </button>
                    <button class="rsvp-remove-btn-small" data-event-id="${event.id}" data-action="remove" ${event.attendingCount === 0 ? 'disabled' : ''}>
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
    console.log('openRsvpModal started for event:', eventId);
    const event = currentEvents.find(e => e.id === eventId);
    if (!event) {
        console.error('Add Modal: Event not found!');
        return;
    }

    currentEventForRsvp = event;

    // Show modal immediately
    console.log('Add Modal: Removing hidden class');
    rsvpModal.classList.remove('hidden');

    // Populate content after a short delay to allow rendering
    setTimeout(() => {
        console.log('Add Modal: setTimeout callback executing');
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
    }, 10); // A small delay is enough
}

function closeRsvpModal() {
    rsvpModal.classList.add('hidden');
    document.getElementById('attendee-name').value = '';
    currentEventForRsvp = null;
}

function openRemoveRsvpModal(eventId) {
    console.log('openRemoveRsvpModal started for event:', eventId);
    const event = currentEvents.find(e => e.id === eventId);
    if (!event) {
        console.error('Remove Modal: Event not found!');
        return;
    }

    currentEventForRsvp = event;

    // Show modal immediately
    console.log('Remove Modal: Removing hidden class');
    document.getElementById('remove-rsvp-modal').classList.remove('hidden');

    // Populate content after a short delay to allow rendering
    setTimeout(() => {
        console.log('Remove Modal: setTimeout callback executing');
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
    }, 10); // A small delay is enough
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
    eventsList.addEventListener('click', (e) => {
        const btn = e.target.closest('.rsvp-add-btn-small, .rsvp-remove-btn-small');
        if (!btn) return;

        const eventId = btn.dataset.eventId;
        const action = btn.dataset.action;

        if (!eventId || !action) return;

        const event = currentEvents.find(e => e.id === eventId);
        if (!event) return;

        const eventDate = new Date(event.date);
        const now = new Date();
        if (eventDate < now) {
            alert('Cannot RSVP for past events');
            return;
        }

        if (action === 'add') {
            openRsvpModal(eventId);
        } else if (action === 'remove') {
            openRemoveRsvpModal(eventId);
        }
    });

    // Close modal when clicking outside
    rsvpModal.addEventListener('click', function(e) {
        if (e.target === rsvpModal) {
            closeRsvpModal();
        }
    });

    // Refresh button
    const refreshBtn = document.getElementById('refresh-events-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', debounce(loadEvents, 250));
    }

    // Donate button
    const donateBtn = document.getElementById('donate-btn');
    if (donateBtn) {
        donateBtn.addEventListener('click', donate);
    }
}

async function donate() {
    try {
        const keyResponse = await fetch(`${API_BASE_URL}/api/stripe-key`);
        const { publicKey } = await keyResponse.json();
        const stripe = Stripe(publicKey);

        const response = await fetch(`${API_BASE_URL}/api/create-donation-checkout-session`, {
            method: 'POST',
        });
        const session = await response.json();
        const result = await stripe.redirectToCheckout({
            sessionId: session.id,
        });

        if (result.error) {
            alert(result.error.message);
        }
    } catch (error) {
        console.error('Error creating checkout session:', error);
        alert('Error creating checkout session. Please try again.');
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
        } else {
            alert('Error: ' + result.message);
        }
    })
    .catch(error => {
        console.error('Error submitting RSVP:', error);
        alert('Error submitting RSVP. Please try again.');
    });
}





    const reportIssueBtn = document.getElementById('report-issue-btn');
    if (reportIssueBtn) {
        reportIssueBtn.addEventListener('click', () => {
            window.open('https://docs.google.com/forms/d/e/1FAIpQLScEcmD-j6pd9U9q323nQT5xMf2G8AW2X4GkUAlGOr89ZlNwGg/viewform?embedded=true', '_blank');
        });
    }