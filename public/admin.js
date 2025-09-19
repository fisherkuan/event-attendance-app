const API_BASE_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
});

async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/events?timeRange=future`);
        const events = await response.json();
        displayEvents(events);
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

function displayEvents(events) {
    const eventsList = document.getElementById('admin-events-list');
    eventsList.innerHTML = events.map(event => `
        <div class="event-card-admin">
            <div>
                <h3>${event.title}</h3>
                <p>${new Date(event.date).toLocaleString()}</p>
            </div>
            <div class="attendance-limit-form">
                <input type="number" id="limit-${event.id}" value="${event.attendance_limit || ''}" placeholder="No limit" min="1">
                <button onclick="updateAttendanceLimit('${event.id}')">Set Limit</button>
                <button class="btn-secondary" onclick="removeAttendanceLimit('${event.id}')">Remove Limit</button>
            </div>
        </div>
    `).join('');
}

async function updateAttendanceLimit(eventId) {
    const input = document.getElementById(`limit-${eventId}`);
    const newLimit = input.value ? parseInt(input.value, 10) : null;

    if (newLimit !== null && newLimit <= 0) {
        alert('Attendance limit must be a positive number.');
        return;
    }

    try {
        // First, get the current event details
        const eventResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
        if (!eventResponse.ok) {
            throw new Error('Failed to fetch event details.');
        }
        const event = await eventResponse.json();

        // Now, send the update request with all required fields
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
            alert('Attendance limit updated successfully!');
            loadEvents();
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
        // First, get the current event details
        const eventResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
        if (!eventResponse.ok) {
            throw new Error('Failed to fetch event details.');
        }
        const event = await eventResponse.json();

        // Now, send the update request with all required fields
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
            alert('Attendance limit removed successfully!');
            loadEvents();
        } else {
            const error = await updateResponse.json();
            alert(`Error: ${error.message}`);
        }
    } catch (error) {
        console.error('Error removing attendance limit:', error);
        alert('Error removing attendance limit. See console for details.');
    }
}
