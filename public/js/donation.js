const API_BASE_URL = window.location.origin;

const TABLET_VIEW_QUERY = window.matchMedia('(max-width: 768px)');

let donationData = {
    balance: 0,
    donations: []
};

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
}

document.addEventListener('DOMContentLoaded', () => {
    loadDonations();
    setupDonateButton();
    setupScrollSnapIndicators();
    setupRefreshButton();
});

function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-donations-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', debounce(loadDonations, 250));
    }
}

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
}

function displayDonations(donations) {
    const donationsList = document.getElementById('donations-list');
    
    if (donations.length === 0) {
        donationsList.innerHTML = '<p>No donations yet.</p>';
        return;
    }
    
    const donationsHtml = donations.map(donation => {
        // Use entry_date if available, otherwise fall back to created_at
        const dateToUse = donation.entry_date || donation.created_at;
        const date = new Date(dateToUse);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
        
        const amount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(donation.amount);
        
        const amountClass = donation.amount >= 0 ? 'positive' : 'negative';
        
        return `
            <div class="donation-entry">
                <div class="donation-entry-header">
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
        const stripe = window.Stripe(publicKey);

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

        // Calculate which page we're on (0 or 1)
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
}

