const API_BASE_URL = window.location.origin;

// Admin key management
function getAdminKey() {
    let key = localStorage.getItem('adminKey');
    if (!key) {
        key = prompt('Enter admin key (will be saved locally in your browser):');
        if (key) {
            localStorage.setItem('adminKey', key);
        }
    }
    return key;
}

function clearStoredKey() {
    localStorage.removeItem('adminKey');
    alert('Admin key cleared. You will be prompted again on next submission.');
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('donation-form');
    form.addEventListener('submit', handleSubmit);

    // Add a button to clear stored key (optional - for security)
    const clearKeyBtn = document.createElement('button');
    clearKeyBtn.type = 'button';
    clearKeyBtn.textContent = 'Clear Stored Admin Key';
    clearKeyBtn.className = 'btn-secondary';
    clearKeyBtn.style.marginTop = '10px';
    clearKeyBtn.onclick = clearStoredKey;
    form.appendChild(clearKeyBtn);
});

function handleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount'));
    const donator = formData.get('donator').trim();
    const description = formData.get('description').trim();
    const entryDate = formData.get('entry_date');
    
    if (!amount || amount === 0) {
        showMessage('Amount is required and cannot be zero', 'error');
        return;
    }
    
    const donationData = {
        amount: amount,
        donator: donator || null,
        description: description || null,
        entry_date: entryDate || null
    };
    
    submitDonation(donationData);
}

async function submitDonation(data) {
    const messageDiv = document.getElementById('form-message');
    messageDiv.textContent = 'Submitting...';
    messageDiv.className = 'form-message loading';

    const adminKey = getAdminKey();
    if (!adminKey) {
        showMessage('Admin key is required', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/donations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Key': adminKey
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.status === 401) {
            localStorage.removeItem('adminKey');
            showMessage('Invalid admin key. Please refresh the page and try again.', 'error');
            return;
        }

        if (response.ok && result.success) {
            showMessage('Donation entry added successfully!', 'success');
            resetForm();
        } else {
            showMessage(result.message || 'Error adding donation entry', 'error');
        }
    } catch (error) {
        console.error('Error submitting donation:', error);
        showMessage('Error submitting donation. Please try again.', 'error');
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('form-message');
    messageDiv.textContent = message;
    messageDiv.className = `form-message ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'form-message';
        }, 3000);
    }
}

function resetForm() {
    document.getElementById('donation-form').reset();
    const messageDiv = document.getElementById('form-message');
    messageDiv.textContent = '';
    messageDiv.className = 'form-message';
}

