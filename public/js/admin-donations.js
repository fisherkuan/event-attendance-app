const API_BASE_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('donation-form');
    form.addEventListener('submit', handleSubmit);
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
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/donations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
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

