const API_BASE_URL = window.location.origin;

let allAdminEvents = []; // Global variable to store event data

const themeToggle = document.getElementById('theme-toggle');
const THEME_STORAGE_KEY = 'event-attendance-theme';
const THEME_TOGGLE_ICONS = {
    funky: '🥸',
    classic: '👾'
};

function getStoredTheme() {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
        console.warn('Unable to read theme preference:', error);
        return null;
    }
}

function storeTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        console.warn('Unable to persist theme preference:', error);
    }
}

function applyTheme(theme) {
    const isFunky = theme !== 'classic';
    document.body.classList.toggle('theme-funky', isFunky);
    document.body.classList.toggle('theme-classic', !isFunky);

    if (themeToggle) {
        const icon = isFunky ? THEME_TOGGLE_ICONS.funky : THEME_TOGGLE_ICONS.classic;
        themeToggle.innerHTML = `<span aria-hidden="true">${icon}</span>`;
        themeToggle.setAttribute('aria-pressed', isFunky ? 'true' : 'false');
        const nextLabel = isFunky ? 'Switch to classic theme' : 'Switch to funky theme';
        themeToggle.setAttribute('aria-label', nextLabel);
        themeToggle.setAttribute('title', nextLabel);
    }
}

function setupThemeToggle() {
    const savedTheme = getStoredTheme();
    const initialTheme = savedTheme === 'funky' ? 'funky' : 'classic';
    applyTheme(initialTheme);
    if (!savedTheme) {
        storeTheme(initialTheme);
    }

    if (!themeToggle) {
        return;
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.classList.contains('theme-funky') ? 'funky' : 'classic';
        const nextTheme = currentTheme === 'funky' ? 'classic' : 'funky';
        applyTheme(nextTheme);
        storeTheme(nextTheme);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    loadEvents();
    setupWebSocket();
});

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
            if (data.type === 'event_update') {
                updateEventInUI(data.payload);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed. Attempting to reconnect...');
        setTimeout(setupWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function updateEventInUI(event) {
    const eventElement = document.querySelector(`.event-card-admin[data-event-id='${event.id}']`);
    if (eventElement) {
        const input = document.getElementById(`limit-${event.id}`);
        const button = eventElement.querySelector('button');

        if (document.activeElement !== input) {
            input.value = event.attendance_limit || '';
        }

        button.textContent = event.attendance_limit ? 'Update Limit' : 'Set Limit';
    }
}

async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/events?timeRange=future`, { cache: 'no-cache' });
        const events = await response.json();
        allAdminEvents = events; // Populate the global variable
        displayEvents(events);
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

function displayEvents(events) {
    const eventsList = document.getElementById('admin-events-list');
    eventsList.innerHTML = ''; // Clear the list

    events.forEach(event => {
        const buttonText = event.attendance_limit ? 'Update Limit' : 'Set Limit';
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card-admin';
        eventCard.dataset.eventId = event.id;

        const infoContainer = document.createElement('div');
        const titleEl = document.createElement('h3');
        titleEl.textContent = event.title;
        const dateEl = document.createElement('p');
        dateEl.textContent = new Date(event.date).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        infoContainer.appendChild(titleEl);
        infoContainer.appendChild(dateEl);

        const formContainer = document.createElement('div');
        formContainer.className = 'attendance-limit-form';

        const limitInput = document.createElement('input');
        limitInput.type = 'number';
        limitInput.id = `limit-${event.id}`;
        limitInput.value = event.attendance_limit || '';
        limitInput.placeholder = 'No limit';
        limitInput.min = '1';

        const updateButton = document.createElement('button');
        updateButton.textContent = buttonText;
        updateButton.addEventListener('click', () => updateAttendanceLimit(event.id));

        const removeButton = document.createElement('button');
        removeButton.className = 'btn-secondary';
        removeButton.textContent = 'Remove Limit';
        removeButton.addEventListener('click', () => removeAttendanceLimit(event.id));

        formContainer.appendChild(limitInput);
        formContainer.appendChild(updateButton);
        formContainer.appendChild(removeButton);

        eventCard.appendChild(infoContainer);
        eventCard.appendChild(formContainer);
        eventsList.appendChild(eventCard);
    });
}

async function updateAttendanceLimit(eventId) {
    const input = document.getElementById(`limit-${eventId}`);
    const newLimit = input.value ? parseInt(input.value, 10) : null;

    if (newLimit !== null && newLimit <= 0) {
        alert('Attendance limit must be a positive number.');
        return;
    }

    let shouldProceedWithUpdate = true;

    // Get the current event object to check its description
    const currentEvent = allAdminEvents.find(event => event.id === eventId);
    if (currentEvent && currentEvent.description) {
        const description = currentEvent.description.trim();
        const limitMatch = description.match(/limit:?\s*(\d+)/i);
        let descriptionLimit = undefined;
        if (limitMatch) {
            descriptionLimit = parseInt(limitMatch[1], 10);
        }

        // If a limit is specified in the description and it's different from the UI input
        if (descriptionLimit !== undefined && descriptionLimit !== newLimit) {
            alert('NOT EFFECTIVE: This event has an attendance limit specified in its description. Please remove it from the description if you want to update the limit here.');
            shouldProceedWithUpdate = false;
        }
    }

    if (!shouldProceedWithUpdate) {
        return;
    }

    try {
        const updateResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attendanceLimit: newLimit })
            }
        );

        if (updateResponse.ok) {
            const updatedEvent = await updateResponse.json();
            alert(`Attendance limit for "${updatedEvent.event.title}" successfully updated to ${newLimit ? newLimit : 'unlimited'}.`);
        } else {
            const error = await updateResponse.json();
            alert(`Error: ${error.message}`);
        }
    } catch (error) {
        console.error('Error updating attendance limit:', error);
        alert('Error updating attendance limit. See console for details.');
    }
}

async function removeAttendanceLimit(eventId) {
    let shouldProceedWithRemoval = true;

    // Get the current event object to check its description
    const currentEvent = allAdminEvents.find(event => event.id === eventId);
    if (currentEvent && currentEvent.description) {
        const description = currentEvent.description.trim();
        const limitMatch = description.match(/limit:?\s*(\d+)/i);
        let descriptionLimit = undefined;
        if (limitMatch) {
            descriptionLimit = parseInt(limitMatch[1], 10);
        }

        // If a limit is specified in the description, warn the user
        if (descriptionLimit !== undefined) {
            alert('NOT EFFECTIVE: This event has an attendance limit specified in its description. Please remove it from the description if you want to remove the limit here.');
            shouldProceedWithRemoval = false;
        }
    }

    if (!shouldProceedWithRemoval) {
        return;
    }

    try {
        const updateResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attendanceLimit: null })
            }
        );

        if (updateResponse.ok) {
            const updatedEvent = await updateResponse.json();
            alert(`Attendance limit for "${updatedEvent.event.title}" removed successfully!`);
            document.getElementById(`limit-${eventId}`).value = '';
        } else {
            const error = await updateResponse.json();
            alert(`Error: ${error.message}`);
        }
    } catch (error) {
        console.error('Error removing attendance limit:', error);
        alert('Error removing attendance limit. See console for details.');
    }
}
