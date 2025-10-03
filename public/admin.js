const API_BASE_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
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
        eventCard.innerHTML = `
            <div>
                <h3>${event.title}</h3>
                <p>${new Date(event.date).toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
            </div>
            <div class="attendance-limit-form">
                <input type="number" id="limit-${event.id}" value="${event.attendance_limit || ''}" placeholder="No limit" min="1">
                <button onclick="updateAttendanceLimit('${event.id}')">${buttonText}</button>
                <button class="btn-secondary" onclick="removeAttendanceLimit('${event.id}')">Remove Limit</button>
            </div>
        `;
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

    try {
        const eventResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
        if (!eventResponse.ok) throw new Error('Failed to fetch event details.');
        const event = await eventResponse.json();

        if (newLimit === event.attendance_limit) {
            alert(`Attendance limit for "${event.title}" is already set to ${newLimit ? newLimit : 'unlimited'}.`);
            return;
        }

        const actionText = event.attendance_limit ? 'updated' : 'set';

        const updateResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: event.title,
                date: event.date,
                description: event.description,
                location: event.location,
                attendanceLimit: newLimit
            })
        });

        if (updateResponse.ok) {
            alert(`Attendance limit for "${event.title}" successfully ${actionText} to ${newLimit ? newLimit : 'unlimited'}.`);
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
    try {
        const eventResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
        if (!eventResponse.ok) throw new Error('Failed to fetch event details.');
        const event = await eventResponse.json();

        if (event.attendance_limit === null) {
            alert(`There is no attendance limit set for "${event.title}".`);
            return;
        }

        const updateResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: event.title,
                date: event.date,
                description: event.description,
                location: event.location,
                attendanceLimit: null
            })
        });

        if (updateResponse.ok) {
            alert(`Attendance limit for "${event.title}" removed successfully!`);
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
