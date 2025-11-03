const API_BASE_URL = window.location.origin;

let donationData = {
    balance: 0,
    donations: []
};

document.addEventListener('DOMContentLoaded', () => {
    loadDonations();
    setupDonateButton();
});

async function loadDonations() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/donations?limit=20`);
        const data = await response.json();
        
        donationData = data;
        displayBalance(data.balance);
        displayDonations(data.donations);
    } catch (error) {
        console.error('Error loading donations:', error);
        document.getElementById('donations-list').innerHTML = 
            '<p class="error-message">Error loading donations. Please try again later.</p>';
    }
}

function displayBalance(balance) {
    const balanceAmount = document.getElementById('balance-amount');
    const balanceBarFill = document.getElementById('balance-bar-fill');
    
    // Format balance as currency
    const formattedBalance = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    }).format(balance);
    
    balanceAmount.textContent = formattedBalance;
    
    // Set color based on balance
    if (balance > 0) {
        balanceAmount.classList.add('positive');
        balanceAmount.classList.remove('negative');
    } else if (balance < 0) {
        balanceAmount.classList.add('negative');
        balanceAmount.classList.remove('positive');
    } else {
        balanceAmount.classList.remove('positive', 'negative');
    }
    
    // Calculate the balance bar
    // We'll use a reasonable range for display, e.g., -1000 to +1000
    const minRange = -1000;
    const maxRange = 1000;
    const range = maxRange - minRange;
    
    // Clamp balance to range for display
    const clampedBalance = Math.max(minRange, Math.min(maxRange, balance));
    const percentage = ((clampedBalance - minRange) / range) * 100;
    
    // Position fill from zero (center)
    if (balance >= 0) {
        balanceBarFill.style.left = '50%';
        balanceBarFill.style.width = `${percentage - 50}%`;
        balanceBarFill.classList.add('positive');
        balanceBarFill.classList.remove('negative');
    } else {
        balanceBarFill.style.left = `${percentage}%`;
        balanceBarFill.style.width = `${50 - percentage}%`;
        balanceBarFill.classList.add('negative');
        balanceBarFill.classList.remove('positive');
    }
}

function displayDonations(donations) {
    const donationsList = document.getElementById('donations-list');
    
    if (donations.length === 0) {
        donationsList.innerHTML = '<p>No donations yet.</p>';
        return;
    }
    
    const donationsHtml = donations.map(donation => {
        const date = new Date(donation.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const amount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(donation.amount);
        
        const amountClass = donation.amount >= 0 ? 'positive' : 'negative';
        const emoji = donation.amount >= 0 ? '➕' : '➖';
        
        return `
            <div class="donation-entry">
                <div class="donation-entry-header">
                    <span class="donation-emoji" aria-hidden="true">${emoji}</span>
                    <span class="donation-amount ${amountClass}">${amount}</span>
                </div>
                ${donation.donator ? `<div class="donation-donator"><strong>Donator:</strong> ${escapeHtml(donation.donator)}</div>` : ''}
                ${donation.description ? `<div class="donation-description">${escapeHtml(donation.description)}</div>` : ''}
                <div class="donation-date">${formattedDate}</div>
            </div>
        `;
    }).join('');
    
    donationsList.innerHTML = donationsHtml;
}

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

function setupDonateButton() {
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

