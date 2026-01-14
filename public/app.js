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

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Toast notification system
let toastTimeout = null;

function showToast(message, type = 'info', duration = 4000) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    // Add to DOM
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto-dismiss
    toastTimeout = setTimeout(() => {
        hideToast(toast);
    }, duration);

    // Click to dismiss
    toast.addEventListener('click', () => {
        hideToast(toast);
    });

    return toast;
}

function hideToast(toast) {
    if (!toast) return;

    toast.classList.remove('show');
    setTimeout(() => {
        toast.remove();
    }, 300);

    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
}

// Attendee bottom sheet (mobile)
function openAttendeeSheet(event) {
    if (!event) {
        console.warn('openAttendeeSheet called without event object');
        return;
    }

    const sheet = document.getElementById('attendee-sheet');
    const title = document.getElementById('attendee-sheet-title');
    const list = document.getElementById('attendee-sheet-list');
    const empty = document.getElementById('attendee-sheet-empty');

    if (!sheet || !title || !list || !empty) {
        console.error('Bottom sheet DOM elements not found');
        return;
    }

    try {
        // Set title
        const attendingCount = event.attendingCount || 0;
        const limitText = event.attendance_limit ? `/${event.attendance_limit}` : '';
        title.textContent = `Attendees (${attendingCount}${limitText})`;

        // Populate list
        list.innerHTML = '';
        if (event.attendees && event.attendees.length > 0) {
            event.attendees.forEach(attendee => {
                const li = document.createElement('li');
                li.textContent = attendee;
                list.appendChild(li);
            });
            list.classList.remove('hidden');
            empty.classList.add('hidden');
        } else {
            list.classList.add('hidden');
            empty.classList.remove('hidden');
        }

        // Show sheet
        sheet.classList.remove('hidden');
        requestAnimationFrame(() => {
            sheet.classList.add('show');
        });

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Error opening attendee sheet:', error);
        document.body.style.overflow = ''; // Restore scroll
        sheet.classList.add('hidden');
    }
}

function closeAttendeeSheet() {
    const sheet = document.getElementById('attendee-sheet');

    if (!sheet) {
        console.warn('Bottom sheet element not found');
        return;
    }

    sheet.classList.remove('show');
    setTimeout(() => {
        sheet.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

// Detect if device is touch-enabled
function isTouchDevice() {
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0);
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/\n/g, '&#10;');
}

function sanitizeUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
        return null;
    }

    const trimmed = rawUrl.trim().replace(/[\s"'<>)]*$/, '');

    try {
        const validated = new URL(trimmed);
        if (validated.protocol === 'http:' || validated.protocol === 'https:') {
            return validated.href;
        }
    } catch (error) {
        return null;
    }

    return null;
}

function extractEventLink(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return null;
    }

    const linkMatch = value.match(/link:?\s*(https?:\/\/\S+)/i);
    if (linkMatch) {
        const sanitized = sanitizeUrl(linkMatch[1]);
        if (sanitized) {
            return sanitized;
        }
    }

    const fallbackMatch = value.match(/https?:\/\/\S+/i);
    if (fallbackMatch) {
        const sanitized = sanitizeUrl(fallbackMatch[0]);
        if (sanitized) {
            return sanitized;
        }
    }

    return null;
}

// Event Attendance App - Main JavaScript File

// Configuration
const API_BASE_URL = window.location.origin;

// State management
let currentEvents = [];
let currentEventForRsvp = null;
let appConfig = {};

// DOM Elements
const calendarContainer = document.getElementById('calendar-container');
const eventsList = document.getElementById('events-list');
const rsvpModal = document.getElementById('rsvp-modal');
const rsvpForm = document.getElementById('rsvp-form');
const attendanceSummary = document.getElementById('attendance-summary');
const appTitle = document.querySelector('.app-title');
const headerSubtitle = document.querySelector('.header-subtitle');
const MOBILE_VIEW_QUERY = window.matchMedia('(max-width: 480px)');
const TABLET_VIEW_QUERY = window.matchMedia('(max-width: 768px)');

const HEADER_CONTENT = {
    title: 'Leuven Taiwanese Events',
    mobileTitle: 'Leuven TW Events',
    subtitle: ''
};

function isMobileViewport() {
    return MOBILE_VIEW_QUERY.matches;
}

function applyHeaderContent() {
    if (!appTitle) {
        return;
    }

    const useMobileTitle = isMobileViewport() && HEADER_CONTENT.mobileTitle;
    const titleText = useMobileTitle ? HEADER_CONTENT.mobileTitle : HEADER_CONTENT.title;
    appTitle.textContent = titleText || '';

    if (headerSubtitle) {
        const shouldShowSubtitle = Boolean(HEADER_CONTENT.subtitle) && !isMobileViewport();
        headerSubtitle.textContent = shouldShowSubtitle ? HEADER_CONTENT.subtitle : '';
        headerSubtitle.hidden = !shouldShowSubtitle;
    }
}

function handleViewportChange() {
    applyHeaderContent();
}

if (typeof MOBILE_VIEW_QUERY.addEventListener === 'function') {
    MOBILE_VIEW_QUERY.addEventListener('change', handleViewportChange);
} else if (typeof MOBILE_VIEW_QUERY.addListener === 'function') {
    MOBILE_VIEW_QUERY.addListener(handleViewportChange);
}

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
    applyHeaderContent();
    
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

        // Set up scroll-snap page indicators
        setupScrollSnapIndicators();

        // Load donation balance for button (don't block on this)
        loadDonationBalance().catch(err => {
            console.error('Failed to load donation balance:', err);
        });
    }).catch(error => {
        console.error('Error initializing app:', error);
    });
}

// Scroll-snap page indicators for mobile
function setupScrollSnapIndicators() {
    // Only activate on mobile/tablet
    if (!TABLET_VIEW_QUERY.matches) {
        return;
    }

    const scrollContainer = document.querySelector('.scroll-snap-container');
    const pageDots = document.querySelectorAll('.page-dot');
    
    if (!scrollContainer || !pageDots.length) {
        return;
    }

    // Update active dot based on scroll position
    const updateActiveDot = debounce(() => {
        const scrollLeft = scrollContainer.scrollLeft;
        const windowWidth = window.innerWidth;

        // Calculate which page we're on (0, 1, or 2)
        const currentPage = Math.round(scrollLeft / windowWidth);
        const maxPageIndex = pageDots.length - 1;
        const clampedPage = Math.max(0, Math.min(maxPageIndex, currentPage));
        
        // Update dot active states
        pageDots.forEach((dot, index) => {
            if (index === clampedPage) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }, 100);

    // Listen to scroll events
    scrollContainer.addEventListener('scroll', updateActiveDot);
    window.addEventListener('resize', updateActiveDot);

    // Click handler for dots - scroll to page
    pageDots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            const targetScrollLeft = index * window.innerWidth;
            scrollContainer.scrollTo({
                left: targetScrollLeft,
                top: 0,
                behavior: 'smooth'
            });
        });
    });

    // Initial update
    updateActiveDot();

    // Show first-time swipe hint
    if (!localStorage.getItem('swipeHintShown') && TABLET_VIEW_QUERY.matches) {
        const hint = document.getElementById('swipe-hint');
        if (hint) {
            setTimeout(() => {
                hint.classList.remove('hidden');
                hint.classList.add('show');
            }, 1000);

            // Hide after 3 seconds or on first scroll
            const hideHint = () => {
                hint.classList.remove('show');
                setTimeout(() => hint.classList.add('hidden'), 300);
                localStorage.setItem('swipeHintShown', 'true');
                scrollContainer.removeEventListener('scroll', hideHint);
            };

            setTimeout(hideHint, 4000);
            scrollContainer.addEventListener('scroll', hideHint, { once: true });
        }
    }
}

// Set up WebSocket connection
function setupWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
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
    if (!calendarContainer) {
        return;
    }

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

            calendarContainer.innerHTML = `
                <div id="calendar-lazy-loader" style="min-height: 600px; display: flex; align-items: center; justify-content: center; color: #718096;">
                    <p>Loading calendar...</p>
                </div>
            `;

            // Lazy load calendar iframe
            const lazyLoadCalendar = () => {
                const loader = document.getElementById('calendar-lazy-loader');
                if (!loader) return;

                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            calendarContainer.innerHTML = `
                                <iframe src="${finalCalendarUrl}"
                                        style="border: 0"
                                        width="100%"
                                        height="600"
                                        frameborder="0"
                                        scrolling="no"
                                        loading="lazy">
                                </iframe>
                            `;
                            observer.disconnect();
                        }
                    });
                }, { rootMargin: '200px' });

                observer.observe(loader);
            };

            // Start observing
            lazyLoadCalendar();
        };

        updateCalendarView();

        window.addEventListener('resize', updateCalendarView);

        const joinGroupLink = document.getElementById('join-group-link');
        if (joinGroupLink && appConfig.joinGroupUrl) {
            joinGroupLink.href = appConfig.joinGroupUrl;
        }

        const addToCalendarDropdown = document.getElementById('add-to-calendar-dropdown');
        if (addToCalendarDropdown) {
            if (addToCalendarDropdown.parentElement) {
                addToCalendarDropdown.parentElement.style.display = '';
            }
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
        calendarContainer.innerHTML = `
            <div class="calendar-setup">
                <h3>Calendar Integration</h3>
                <p>Calendar integration is not configured. Please update the configuration file to enable calendar display.</p>
            </div>
        `;
        const addToCalendarDropdown = document.getElementById('add-to-calendar-dropdown');
        if (addToCalendarDropdown && addToCalendarDropdown.parentElement) {
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
    fetch(`${API_BASE_URL}/api/events?timeRange=${timeRange}`, {
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache'
        }
    })
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
        const sanitizedFormattedDate = escapeHtml(formattedDate);

        const sanitizedEventId = escapeAttribute(event.id);
        const sanitizedTitle = escapeHtml(event.title);

        const descriptionText = typeof event.description === 'string' ? event.description : '';
        const sanitizedDescription = escapeHtml(descriptionText).replace(/\n/g, '<br>');
        const eventLink = extractEventLink(descriptionText);

        const locationText = typeof event.location === 'string' ? event.location : '';
        const sanitizedLocation = escapeHtml(locationText).replace(/\n/g, '<br>');

        let footerContent = '';
        let footerClasses = 'event-footer';

        if (eventLink) {
            footerClasses += ' event-footer-link';
            const sanitizedEventLink = escapeAttribute(eventLink);
            footerContent = `
                    <a class="event-link-button" href="${sanitizedEventLink}" target="_blank" rel="noopener noreferrer">
                        <span class="icon" aria-hidden="true">🔗</span>
                        <span>Open Link</span>
                    </a>
            `;
        } else {
            const attendeesList = Array.isArray(event.attendees) ? event.attendees.map(escapeHtml) : [];
            const attendanceInfo = attendeesList.join('\n');
            const attendanceInfoAttr = escapeAttribute(attendanceInfo);

            const isFull = event.attendance_limit !== null && event.attendingCount >= event.attendance_limit;

            let attendanceText = `${event.attendingCount} Attending`;
            if (event.attendance_limit !== null) {
                attendanceText += ` / ${event.attendance_limit}`;
            }
            const sanitizedAttendanceText = escapeHtml(attendanceText);

            // On touch devices, make attendance info clickable to open bottom sheet
            const attendanceClick = isTouchDevice()
                ? `data-sheet-event-id="${sanitizedEventId}"`
                : '';
            const attendanceCursor = isTouchDevice() ? 'style="cursor: pointer;"' : '';

            const rsvpButtons = isPastEvent
                ? '<div class="rsvp-disabled">Past Event - RSVP Closed</div>'
                : `
                    <div class="event-rsvp-buttons">
                        <button class="rsvp-add-btn-small ${isFull ? 'rsvp-full-btn' : ''}" data-event-id="${sanitizedEventId}" data-action="add" ${isFull ? 'disabled' : ''}>
                            <span class="icon">＋</span>
                        </button>
                        <button class="rsvp-remove-btn-small" data-event-id="${sanitizedEventId}" data-action="remove" ${event.attendingCount === 0 ? 'disabled' : ''}>
                            <span class="icon">－</span>
                        </button>
                    </div>
                `;

            footerContent = `
                    <div class="attendance-info" title="${attendanceInfoAttr}" ${attendanceClick} ${attendanceCursor} tabindex="0" role="button" aria-label="View attendee list">
                        <span>${sanitizedAttendanceText}</span>
                    </div>
                    ${rsvpButtons}
            `;
        }
        
        return `
            <div class="event-card" data-event-id="${sanitizedEventId}">
                <h3>${sanitizedTitle}</h3>
                <p class="event-date">${sanitizedFormattedDate}</p>
                ${descriptionText ? `<p class="event-description">${sanitizedDescription}</p>` : ''}
                ${locationText ? `<p class="event-location">📍 ${sanitizedLocation}</p>` : ''}
                <div class="${footerClasses}">
                    ${footerContent}
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
        const modalDescription = typeof event.description === 'string' ? event.description : '';
        document.getElementById('modal-event-description').innerHTML = escapeHtml(modalDescription).replace(/\n/g, '<br>');
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
        showToast('No event selected for RSVP', 'error');
        return;
    }

    const attendeeName = document.getElementById('attendee-to-remove').value;
    const rsvpData = {
        eventId: currentEventForRsvp.id,
        action: 'remove',
        attendeeName: attendeeName
    };

    // Disable button during API call
    const submitBtn = document.querySelector('.rsvp-remove-btn');
    const originalText = submitBtn.querySelector('.text').textContent;
    submitBtn.disabled = true;
    submitBtn.querySelector('.text').textContent = 'Removing...';

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
        submitBtn.disabled = false;
        submitBtn.querySelector('.text').textContent = originalText;

        if (result.success) {
            // Success feedback with animation
            submitBtn.classList.add('pulse-success');
            setTimeout(() => submitBtn.classList.remove('pulse-success'), 400);

            // Haptic feedback if supported
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            closeRemoveRsvpModal();
        } else {
            showToast(result.message || 'Error removing RSVP', 'error');
            submitBtn.classList.add('shake');
            setTimeout(() => submitBtn.classList.remove('shake'), 300);
        }
    })
    .catch(error => {
        console.error('Error submitting RSVP:', error);
        submitBtn.disabled = false;
        submitBtn.querySelector('.text').textContent = originalText;
        showToast('Connection error - please try again', 'error');
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

    // Attendee sheet
    const attendeeSheet = document.getElementById('attendee-sheet');
    if (attendeeSheet) {
        const backdrop = attendeeSheet.querySelector('.bottom-sheet-backdrop');
        const closeBtn = attendeeSheet.querySelector('.bottom-sheet-close-btn');

        if (backdrop) {
            backdrop.addEventListener('click', closeAttendeeSheet);
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', closeAttendeeSheet);
        }
    }

    // Attendance info click handler for touch devices
    document.addEventListener('click', (e) => {
        const attendanceInfo = e.target.closest('.attendance-info[data-sheet-event-id]');
        if (attendanceInfo && isTouchDevice()) {
            e.preventDefault();
            const eventId = attendanceInfo.getAttribute('data-sheet-event-id');
            const event = currentEvents.find(ev => ev.id === eventId);
            if (event) {
                openAttendeeSheet(event);
            }
        }
    });

    // Keyboard support for attendance info
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') &&
            e.target.classList.contains('attendance-info') &&
            e.target.hasAttribute('data-sheet-event-id') &&
            isTouchDevice()) {
            e.preventDefault();
            const eventId = e.target.getAttribute('data-sheet-event-id');
            const event = currentEvents.find(ev => ev.id === eventId);
            if (event) {
                openAttendeeSheet(event);
            }
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

    const reportIssueBtn = document.getElementById('report-issue-btn');
    if (reportIssueBtn) {
        reportIssueBtn.addEventListener('click', () => {
            window.open('https://docs.google.com/forms/d/e/1FAIpQLScEcmD-j6pd9U9q323nQT5xMf2G8AW2X4GkUAlGOr89ZlNwGg/viewform?embedded=true', '_blank');
        });
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
        showToast('No event selected for RSVP', 'error');
        return;
    }

    const attendeeName = document.getElementById('attendee-name').value.trim();
    if (!attendeeName) {
        showToast('Please enter your name', 'error');
        const input = document.getElementById('attendee-name');
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 300);
        return;
    }

    const rsvpData = {
        eventId: currentEventForRsvp.id,
        action: action,
        attendeeName: attendeeName
    };

    // Disable button during API call
    const submitBtn = document.querySelector('.rsvp-add-btn');
    const originalText = submitBtn.querySelector('.text').textContent;
    submitBtn.disabled = true;
    submitBtn.querySelector('.text').textContent = 'Submitting...';

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
        submitBtn.disabled = false;
        submitBtn.querySelector('.text').textContent = originalText;

        if (result.success) {
            // Success feedback with animation
            submitBtn.classList.add('pulse-success');
            setTimeout(() => submitBtn.classList.remove('pulse-success'), 400);

            // Haptic feedback if supported
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            closeRsvpModal();
        } else {
            // Error feedback
            showToast(result.message || 'Error submitting RSVP', 'error');
            submitBtn.classList.add('shake');
            setTimeout(() => submitBtn.classList.remove('shake'), 300);
        }
    })
    .catch(error => {
        console.error('Error submitting RSVP:', error);
        submitBtn.disabled = false;
        submitBtn.querySelector('.text').textContent = originalText;
        showToast('Connection error - please try again', 'error');
    });
}







async function loadDonationBalance() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/donations?limit=1`);
        const data = await response.json();
        updateDonationButton(data.balance);
    } catch (error) {
        console.error('Error loading donation balance:', error);
        // Keep default emoji on error
    }
}

function updateDonationButton(balance) {
    const donationBtn = document.getElementById('donation-btn');
    if (!donationBtn) return;
    
    // Update emoji based on balance
    if (balance > 0) {
        donationBtn.textContent = '🤗';
        donationBtn.classList.add('positive');
        donationBtn.classList.remove('negative');
    } else if (balance < 0) {
        donationBtn.textContent = '😰';
        donationBtn.classList.add('negative');
        donationBtn.classList.remove('positive');
    } else {
        donationBtn.textContent = '🤗';
        donationBtn.classList.remove('positive', 'negative');
    }
    
    // Calculate gradient background based on balance
    // Range: -100 (red) to +100 (green), with white at 0
    const minRange = -100;
    const maxRange = 100;
    const clampedBalance = Math.max(minRange, Math.min(maxRange, balance));
    
    // Normalize balance to 0-1 range (0 = min, 1 = max)
    const normalized = (clampedBalance - minRange) / (maxRange - minRange);
    
    // Interpolate colors: red -> white -> green
    // Red: #ef4444 at -100 (rgb(239, 68, 68))
    // White: #ffffff at 0 (rgb(255, 255, 255))
    // Green: #10b981 at +100 (rgb(16, 185, 129))
    let red, green, blue;
    
    if (normalized < 0.5) {
        // Interpolate between red and white
        const t = normalized * 2; // 0 to 1
        red = Math.round(239 + (255 - 239) * t);   // 239 -> 255
        green = Math.round(68 + (255 - 68) * t);   // 68 -> 255
        blue = Math.round(68 + (255 - 68) * t);    // 68 -> 255
    } else {
        // Interpolate between white and green
        const t = (normalized - 0.5) * 2; // 0 to 1
        red = Math.round(255 + (16 - 255) * t);    // 255 -> 16
        green = Math.round(255 + (185 - 255) * t); // 255 -> 185
        blue = Math.round(255 + (129 - 255) * t);  // 255 -> 129
    }
    
    const gradientColor = `rgb(${red}, ${green}, ${blue})`;
    
    // Apply gradient background to donation button
    donationBtn.style.background = `linear-gradient(135deg, ${gradientColor} 0%, ${gradientColor} 100%)`;
}
