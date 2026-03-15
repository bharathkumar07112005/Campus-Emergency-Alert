// ===== APP STATE =====
const state = {
  name: '',
  studentId: '',
  phone: '',
  location: null,
  locationText: 'Locating...',
  contactsVisible: false,
  holdTimer: null,
  holdStart: null,
};

// ===== SCREEN NAVIGATION =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
}

// ===== SPLASH → LOGIN =====
window.onload = () => {
  setTimeout(() => {
    showScreen('login');
  }, 3000);
  initLocation();
};

// ===== LOCATION =====
function initLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        // Fallback mock location
        state.location = { lat: 13.0827, lng: 80.2707 };
        state.locationText = 'Main Campus, Block A, Near Library';
        updateLocationUI();
      }
    );
  } else {
    state.location = { lat: 13.0827, lng: 80.2707 };
    state.locationText = 'Main Campus, Block A';
    updateLocationUI();
  }
}

function reverseGeocode(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
    .then(r => r.json())
    .then(data => {
      const addr = data.address;
      const parts = [addr.road, addr.suburb, addr.city || addr.town].filter(Boolean);
      state.locationText = parts.slice(0, 3).join(', ') || 'Campus Location Acquired';
      updateLocationUI();
    })
    .catch(() => {
      state.locationText = 'Campus Location Acquired';
      updateLocationUI();
    });
}

function updateLocationUI() {
  const el = document.getElementById('loc-text');
  if (el) el.textContent = state.locationText;
}

function refreshLocation() {
  const el = document.getElementById('loc-text');
  if (el) el.textContent = 'Refreshing location...';
  const btn = document.querySelector('.loc-refresh');
  if (btn) { btn.style.transform = 'rotate(720deg)'; btn.style.transition = 'transform 0.8s ease'; }
  setTimeout(() => { if (btn) btn.style.transform = ''; }, 900);
  initLocation();
}

// ===== LOGIN =====
function doLogin() {
  const name = document.getElementById('inp-name').value.trim();
  const id = document.getElementById('inp-id').value.trim();
  const phone = document.getElementById('inp-phone').value.trim();
  const errEl = document.getElementById('login-error');

  if (!name || !id || !phone) {
    errEl.classList.remove('hidden');
    setTimeout(() => errEl.classList.add('hidden'), 3000);
    return;
  }

  state.name = name;
  state.studentId = id;
  state.phone = phone;

  // Update home screen
  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('topbar-name');
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = name.split(' ')[0];

  showScreen('home');
}

// ===== EMERGENCY BUTTON (Hold 1s) =====
const emergencyBtn = document.getElementById('btn-emergency');
if (emergencyBtn) {
  // Mouse
  emergencyBtn.addEventListener('mousedown', startHold);
  emergencyBtn.addEventListener('mouseup', cancelHold);
  emergencyBtn.addEventListener('mouseleave', cancelHold);
  // Touch
  emergencyBtn.addEventListener('touchstart', startHold, { passive: true });
  emergencyBtn.addEventListener('touchend', cancelHold);
}

function startHold(e) {
  state.holdStart = Date.now();
  state.holdTimer = setTimeout(() => {
    triggerEmergency();
  }, 1000);
}

function cancelHold(e) {
  if (state.holdTimer) {
    clearTimeout(state.holdTimer);
    state.holdTimer = null;
  }
}

function triggerEmergency() {
  const btn = document.getElementById('btn-emergency');
  if (btn) btn.classList.add('alerting');
  setTimeout(() => btn && btn.classList.remove('alerting'), 500);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  const msgEl = document.getElementById('alert-msg');
  const detailsEl = document.getElementById('alert-details');

  if (msgEl) msgEl.textContent = `Emergency alert from ${state.name || 'student'}. Immediate assistance required at your location.`;
  if (detailsEl) {
    detailsEl.innerHTML = `
      <strong>🧑 Student:</strong> ${state.name || 'N/A'}<br/>
      <strong>🎓 ID:</strong> ${state.studentId || 'N/A'}<br/>
      <strong>📱 Phone:</strong> ${state.phone || 'N/A'}<br/>
      <strong>📍 Location:</strong> ${state.locationText}<br/>
      <strong>🕐 Time:</strong> ${timeStr}, ${dateStr}<br/>
      <strong>📡 Status:</strong> <span style="color:#2E7D32;font-weight:700">Alert Dispatched ✓</span>
    `;
  }

  const overlay = document.getElementById('overlay-alert');
  if (overlay) overlay.classList.remove('hidden');

  // Vibrate if supported
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
}

function dismissAlert() {
  const overlay = document.getElementById('overlay-alert');
  if (overlay) overlay.classList.add('hidden');
  // Update status back to safe
  const dot = document.querySelector('.status-dot');
  const txt = document.querySelector('.status-text');
  if (dot) { dot.style.background = '#69F0AE'; dot.style.boxShadow = '0 0 8px #69F0AE'; }
  if (txt) { txt.style.color = '#69F0AE'; txt.textContent = 'Safe'; }
}

// ===== SHARE LOCATION =====
// Contacts map: name → phone number for SMS routing
const CONTACTS = {
  security:  '9361329829',
  warden:    '8754192659',
  helpdesk:  '9043437758',
};

function shareLocation(contactKey) {
  // Default to security if no specific contact chosen
  const targetNumber = CONTACTS[contactKey] || CONTACTS.security;
  const contactLabel = contactKey === 'warden'   ? 'Hostel Warden'
                     : contactKey === 'helpdesk' ? 'College Help Desk'
                     : 'Campus Security';

  const doShare = (lat, lng) => {
    const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
    const smsBody  = `Emergency! A student needs help.\nMy location:\n${mapsLink}`;

    // Try to open SMS app on mobile
    const smsUri = `sms:${targetNumber}?body=${encodeURIComponent(smsBody)}`;
    window.location.href = smsUri;

    // Also show the confirmation overlay after a short delay
    setTimeout(() => {
      const msgEl     = document.getElementById('loc-share-msg');
      const detailsEl = document.getElementById('loc-share-details');
      const now       = new Date();
      const timeStr   = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      if (msgEl) msgEl.textContent =
        `Your live location is being sent to ${contactLabel} via SMS.`;

      if (detailsEl) {
        detailsEl.innerHTML = `
          <strong>📍 Address:</strong> ${state.locationText}<br/>
          <strong>🌐 Coordinates:</strong> ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}<br/>
          <strong>📲 Sent to:</strong> ${contactLabel} (+91 ${targetNumber})<br/>
          <strong>🕐 Sent at:</strong> ${timeStr}<br/>
          <strong>👤 Student:</strong> ${state.name || 'N/A'}<br/>
          <strong>🗺️ Map Link:</strong> <a href="${mapsLink}" target="_blank" style="color:#1A237E">View on Google Maps →</a>
        `;
      }

      const overlay = document.getElementById('overlay-location');
      if (overlay) overlay.classList.remove('hidden');
    }, 400);
  };

  // Get fresh GPS coordinates before sharing
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        doShare(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        // Fallback to last known / mock location
        const lat = state.location ? state.location.lat : 13.0827;
        const lng = state.location ? state.location.lng : 80.2707;
        doShare(lat, lng);
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  } else {
    const lat = state.location ? state.location.lat : 13.0827;
    const lng = state.location ? state.location.lng : 80.2707;
    doShare(lat, lng);
  }
}

function dismissLocation() {
  const overlay = document.getElementById('overlay-location');
  if (overlay) overlay.classList.add('hidden');
}

// ===== CONTACTS =====
function showContacts() {
  const section = document.getElementById('contacts-section');
  if (!section) return;
  state.contactsVisible = !state.contactsVisible;
  if (state.contactsVisible) {
    section.classList.add('visible');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    section.classList.remove('visible');
  }
}

// ===== KEYBOARD LOGIN =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const loginScreen = document.getElementById('screen-login');
    if (loginScreen && loginScreen.classList.contains('active')) {
      doLogin();
    }
  }
});
