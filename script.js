const STATE = {
  currentUser: null,
  currentQrVerification: null,
  pendingQrCode: null,
  finderScanner: null,
  petScanner: null,
  loginScanner: null,
};

let forgotPasswordVerificationCode = null;
let forgotPasswordVerifiedEmail = null;
let forgotPasswordCodeExpiry = null;
let forgotPasswordCountdownInterval = null;

const MASTER_ADMIN = {
  first_name: 'Master',
  last_name: 'Admin',
  email: 'admin@petnetwork.com',
  password: 'MasterAdmin!2026',
  role: 'admin',
  provider: 'local',
  phone: '+1-800-555-0101',
};

// Supabase Configuration
const SUPABASE_URL = 'https://sbkkdtfdhvikhfdbhsbx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2tkdGZkaHZpa2hmZGJoc2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1OTk3NDUsImV4cCI6MjA5NTE3NTc0NX0.E-v0T9hbvRMWBOSjXOgHKSYRE3RgPnvcEtkQ9GJC1gA';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Third-party Provider IDs (set these in production)
// Google OAuth2 Configuration
// Replace with your actual Google Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = '540931981374-205a6qbbrte6lhulq32g5gcqt1adop3c.apps.googleusercontent.com';
// NOTE: For production, store CLIENT_ID securely and use backend validation of tokens

// EmailJS Configuration
const EMAILJS_USER_ID = 'lklD_aOveFRq-wSUU';
const EMAILJS_SERVICE_ID = 'service_m2bq1cq';
const EMAILJS_TEMPLATE_ID = 'template_oogzqdb';
const EMAILJS_VERIFICATION_TEMPLATE_ID = 'template_diemj95';

function initEmailJs() {
  try {
    if (!window.emailjs) {
      console.warn('EmailJS SDK not loaded. Email notifications disabled.');
      return;
    }
    if (!EMAILJS_USER_ID || EMAILJS_USER_ID.includes('YOUR_')) {
      console.warn('EMAILJS_USER_ID not configured. Set constants in script.js to enable sending.');
      return;
    }
    emailjs.init(EMAILJS_USER_ID);
  } catch (e) {
    console.error('Error initializing EmailJS:', e);
  }
}

let QR_BASE_URL = '';
let petQrModal = null;
let petQrModalEscapeHandler = null;

function $(id) {
  return document.getElementById(id);
}

function openLightbox(src) {
  const lightbox = $('imageLightbox');
  const img = $('lightboxImage');
  if (!lightbox || !img) return;
  img.src = src;
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = $('imageLightbox');
  if (!lightbox) return;
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
}

// Supabase data access functions
async function loadData(table) {
  try {
    const { data, error } = await db.from(table).select('*');
    if (error) {
  initGoogleSignIn();
  initEmailJs();
      return [];
    }
    return data || [];
  } catch (err) {
    console.error(`Error loading ${table}:`, err);
    return [];
  }
}

async function saveData(table, record) {
  try {
    const { data, error } = await db.from(table).insert([record]).select();
    if (error) {
      console.error(`Error saving to ${table}:`, error);
      return null;
    }
    return data ? data[0] : null;
  } catch (err) {
    console.error(`Error saving to ${table}:`, err);
    return null;
  }
}

async function updateData(table, id, updates) {
  try {
    const { data, error } = await db.from(table).update(updates).eq('id', id).select();
    if (error) {
      console.error(`Error updating ${table}:`, error);
      return null;
    }
    return data ? data[0] : null;
  } catch (err) {
    console.error(`Error updating ${table}:`, err);
    return null;
  }
}

async function deleteData(table, id) {
  try {
    const { error } = await db.from(table).delete().eq('id', id);
    if (error) {
      console.error(`Error deleting from ${table}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Error deleting from ${table}:`, err);
    return false;
  }
}

async function initializeStorage() {
  // Master admin is hardcoded in code, no need to save to Supabase
  // Nothing to initialize here to avoid schema mismatch on startup
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.remove('active');
    view.classList.add('hidden');
  });
  const target = $(viewId);
  target.classList.remove('hidden');
  target.classList.add('active');
  
  // Reset all nav button highlights
  document.querySelectorAll('.top-nav button').forEach((btn) => {
    btn.classList.remove('active-nav');
  });
}

function setNavigation() {
  const userNav = $('userNav');
  const adminNav = $('adminNav');
  if (!STATE.currentUser) {
    // When no user logged in: hide both navs
    if (userNav) {
      userNav.classList.add('hidden');
      userNav.style.display = 'none';
    }
    if (adminNav) {
      adminNav.classList.add('hidden');
      adminNav.style.display = 'none';
    }
    return;
  }
  const isAdmin = STATE.currentUser.role === 'admin';
  if (isAdmin) {
    // When admin logged in: show admin nav, hide user nav
    if (adminNav) {
      adminNav.classList.remove('hidden');
      adminNav.style.display = 'flex';
    }
    if (userNav) {
      userNav.classList.add('hidden');
      userNav.style.display = 'none';
    }
  } else {
    // When regular user logged in: show user nav, hide admin nav
    if (userNav) {
      userNav.classList.remove('hidden');
      userNav.style.display = 'flex';
    }
    if (adminNav) {
      adminNav.classList.add('hidden');
      adminNav.style.display = 'none';
    }
  }
}

function showMessage(message) {
  alert(message);
}

function secureRandomCode() {
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((n) => ('0' + (n % 36).toString(36)).slice(-2))
    .join('').toUpperCase();
  return `PN-${randomPart}`;
}

function getQrPayload(rawCode) {
  if (!QR_BASE_URL) {
    return rawCode;
  }
  const path = window.location.pathname || '/';
  return `${QR_BASE_URL}${path}?qr=${encodeURIComponent(rawCode)}`;
}

function getLocalIpCandidates() {
  return new Promise((resolve) => {
    const ips = new Set();
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        pc.close();
        resolve(Array.from(ips));
        return;
      }
      const parts = event.candidate.candidate.split(' ');
      const ip = parts[4];
      if (ip && !ips.has(ip)) {
        ips.add(ip);
      }
    };
    pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => resolve([]));
  });
}

function isLocalHost(origin) {
  const lower = origin.toLowerCase();
  return lower.includes('127.0.0.1') || lower.includes('localhost');
}

async function prepareQrBaseUrl() {
  // Priority 1: explicit override from hosting environment (useful for ngrok or production)
  if (window.PETNET_BASE_URL) {
    QR_BASE_URL = window.PETNET_BASE_URL.replace(/\/$/, '');
    return;
  }

  const origin = window.location.origin || '';
  // Avoid using machine-local hostnames that won't resolve on mobile (.local or custom hostnames)
  if (origin && !isLocalHost(origin) && !origin.includes('.local')) {
    QR_BASE_URL = origin;
    return;
  }

  // Try to find a LAN IP candidate (IPv4) as a fallback for testing on same Wi-Fi network
  const localIps = await getLocalIpCandidates();
  const fallbackIp = localIps.find((ip) => ip && !ip.startsWith('127.') && !ip.startsWith('169.') && !ip.includes(':'));
  if (fallbackIp) {
    const port = window.location.port ? `:${window.location.port}` : '';
    QR_BASE_URL = `${window.location.protocol}//${fallbackIp}${port}`;
    return;
  }

  // If we couldn't determine a usable URL, leave empty and warn the developer
  QR_BASE_URL = '';
  console.warn('QR_BASE_URL not set. For mobile scanning, set window.PETNET_BASE_URL to an accessible URL (e.g. http://192.168.1.X:5500) or use a tunnel like ngrok.');
}

function normalizeQrText(scannedText) {
  const trimmed = scannedText.trim();
  try {
    const url = new URL(trimmed);
    const payload = url.searchParams.get('qr');
    if (payload) {
      return payload;
    }
  } catch (error) {
    // not a URL, continue
  }
  const match = trimmed.match(/[?&]qr=([^&]+)/i);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

function createQRCodeElement(container, text, label = 'QR Code') {
  container.innerHTML = '';
  const holder = document.createElement('div');
  holder.className = 'qr-card';
  const title = document.createElement('h4');
  title.textContent = label;
  const codeHolder = document.createElement('div');
  const qrNode = document.createElement('div');
  qrNode.className = 'qr-image';
  codeHolder.appendChild(qrNode);
  new QRCode(qrNode, {
    text: getQrPayload(text),
    width: 260,
    height: 260,
    colorDark: '#14213d',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
  const codeText = document.createElement('small');
  codeText.textContent = text;
  const printButton = document.createElement('button');
  printButton.className = 'secondary';
  printButton.textContent = 'Print QR Code';
  printButton.addEventListener('click', () => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    printWindow.document.write('<html><head><title>Print QR Code</title>');
    printWindow.document.write('<style>body{margin:0;padding:20px;font-family:sans-serif;} img{width:100%;max-width:300px;display:block;margin:0 auto;} div{text-align:center;margin-top:12px;font-weight:700;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(codeHolder.innerHTML);
    printWindow.document.write(`<div>${text}</div>`);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  });
  holder.append(title, codeHolder, codeText, printButton);
  container.appendChild(holder);
}

function closePetQrModal() {
  if (!petQrModal) return;
  petQrModal.classList.add('hidden');
  document.body.style.overflow = '';
  if (petQrModalEscapeHandler) {
    window.removeEventListener('keydown', petQrModalEscapeHandler);
    petQrModalEscapeHandler = null;
  }
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('Clipboard API unavailable, falling back to execCommand:', error);
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);
  return copied;
}

function ensurePetQrModal() {
  if (petQrModal) return petQrModal;

  const overlay = document.createElement('div');
  overlay.id = 'petQrModalOverlay';
  overlay.className = 'qr-modal-overlay hidden';
  overlay.innerHTML = `
    <div class="qr-modal" role="dialog" aria-modal="true">
      <div class="qr-modal-header">
        <div>
          <p class="qr-modal-kicker">PET QR</p>
          <h2 class="qr-modal-title"></h2>
        </div>
        <button type="button" class="qr-modal-close" aria-label="Close">&times;</button>
      </div>

      <div class="qr-modal-body">
        <div class="qr-summary-row">
          <div class="qr-code-label-block">
            <div class="qr-code-label">COLLAR ID</div>
            <div class="qr-code-value"></div>
          </div>
          <span class="linked-badge">Linked</span>
        </div>

        <div class="qr-display-card">
          <div id="petQrDisplayStage" class="qr-display-stage"></div>
          <div class="qr-pet-name"></div>
          <div class="qr-pet-meta"></div>
        </div>

        <label class="qr-url-label" for="petQrUrlText">QR URL</label>
        <input id="petQrUrlText" class="qr-url-display" type="text" readonly />

        <div class="qr-how-it-works"></div>

        <div class="qr-actions" aria-label="QR actions">
          <button type="button" id="petQrDownloadBtn" class="secondary">Download</button>
          <button type="button" id="petQrCopyBtn" class="secondary">Copy Link</button>
          <button type="button" id="petQrPrintBtn" class="secondary">Print</button>
        </div>

        <div class="scan-activity-panel">
          <div class="scan-activity-header">
            <div>
              <div class="scan-activity-eyebrow">SCAN ACTIVITY</div>
              <h3 class="scan-activity-title">LAST 7 DAYS</h3>
            </div>
            <div class="scan-total-pill"></div>
          </div>
          <div id="petQrChart" class="scan-chart-grid"></div>
          <div class="scan-last-scanned"></div>
        </div>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closePetQrModal();
    }
  });

  overlay.querySelector('.qr-modal-close').addEventListener('click', closePetQrModal);
  document.body.appendChild(overlay);
  petQrModal = overlay;
  return petQrModal;
}

async function openPetQrModal(pet, qrCode) {
  const modal = ensurePetQrModal();
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const title = modal.querySelector('.qr-modal-title');
  const collarValue = modal.querySelector('.qr-code-value');
  const petNameEl = modal.querySelector('.qr-pet-name');
  const petMetaEl = modal.querySelector('.qr-pet-meta');
  const qrUrlInput = modal.querySelector('#petQrUrlText');
  const howItWorks = modal.querySelector('.qr-how-it-works');
  const chart = modal.querySelector('#petQrChart');
  const totalPill = modal.querySelector('.scan-total-pill');
  const lastScannedEl = modal.querySelector('.scan-last-scanned');
  const qrStage = modal.querySelector('#petQrDisplayStage');
  const downloadBtn = modal.querySelector('#petQrDownloadBtn');
  const copyBtn = modal.querySelector('#petQrCopyBtn');
  const printBtn = modal.querySelector('#petQrPrintBtn');

  const qrUrl = getQrPayload(qrCode.code);
  const petName = pet.name;
  title.textContent = `QR Code — ${petName}`;
  collarValue.textContent = qrCode.code;
  petNameEl.textContent = petName;
  petMetaEl.textContent = `${pet.breed || 'Unknown breed'} • ${pet.age || 'Age unknown'}`;
  qrUrlInput.value = qrUrl;
  howItWorks.textContent = `First scan → registration page to link the collar. Every scan after → goes straight to ${petName}'s profile.`;

  qrStage.innerHTML = '';
  new QRCode(qrStage, {
    text: qrUrl,
    width: 260,
    height: 260,
    colorDark: '#14213d',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });

  downloadBtn.textContent = 'Download';
  copyBtn.textContent = 'Copy Link';
  copyBtn.disabled = false;

  copyBtn.onclick = async () => {
    const copied = await copyTextToClipboard(qrUrl);
    copyBtn.textContent = copied ? 'Copied!' : 'Copy Link';
    if (copied) {
      window.setTimeout(() => {
        copyBtn.textContent = 'Copy Link';
      }, 1500);
    }
  };

  downloadBtn.onclick = () => {
    const canvas = qrStage.querySelector('canvas');
    const imageSource = canvas ? canvas.toDataURL('image/png') : (qrStage.querySelector('img') ? qrStage.querySelector('img').src : null);
    if (!imageSource) return;
    const anchor = document.createElement('a');
    anchor.href = imageSource;
    anchor.download = `${petName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pet'}-qr.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  printBtn.onclick = () => {
    const canvas = qrStage.querySelector('canvas');
    const imageSource = canvas ? canvas.toDataURL('image/png') : (qrStage.querySelector('img') ? qrStage.querySelector('img').src : null);
    if (!imageSource) return;
    const printWindow = window.open('', '_blank', 'width=520,height=760');
    if (!printWindow) return;
    printWindow.document.write('<html><head><title>Print QR</title><style>body{font-family:Inter,system-ui,sans-serif;margin:0;padding:24px;background:#fff;color:#1a1a1a;} .print-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;} .print-title{font-size:24px;font-weight:800;margin:0;} .print-subtitle{margin:0;color:#6b3d1b;font-size:14px;} .print-image{max-width:320px;width:100%;border-radius:16px;border:1px solid #f0b97a;padding:12px;background:#fff;} .print-caption{font-size:12px;color:#6b3d1b;}</style></head><body>');
    printWindow.document.write('<div class="print-wrap">');
    printWindow.document.write(`<h1 class="print-title">${petName}</h1>`);
    printWindow.document.write(`<p class="print-subtitle">Collar ID: ${qrCode.code}</p>`);
    printWindow.document.write(`<img class="print-image" src="${imageSource}" alt="${petName} QR Code" />`);
    printWindow.document.write(`<p class="print-caption">${qrUrl}</p>`);
    printWindow.document.write('</div></body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const { data: history = [] } = await db.from('scan_history').select('*').eq('qr_code_id', qrCode.id).order('scanned_at', { ascending: true });
  const sevenDayBuckets = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(base);
    day.setDate(day.getDate() - offset);
    const start = new Date(day);
    const end = new Date(day);
    end.setDate(end.getDate() + 1);
    const count = history.filter((entry) => {
      const scannedAt = new Date(entry.scanned_at || entry.created_at);
      return scannedAt >= start && scannedAt < end;
    }).length;
    sevenDayBuckets.push({ day, count });
  }

  chart.innerHTML = '';
  const maxCount = Math.max(...sevenDayBuckets.map((entry) => entry.count), 1);
  sevenDayBuckets.forEach((entry) => {
    const column = document.createElement('div');
    column.className = 'scan-bar-column';
    const fill = document.createElement('div');
    fill.className = 'scan-bar-fill';
    fill.style.height = `${Math.max((entry.count / maxCount) * 100, 12)}%`;
    const value = document.createElement('div');
    value.className = 'scan-bar-count';
    value.textContent = entry.count;
    const dayLabel = document.createElement('div');
    dayLabel.className = 'scan-bar-day';
    dayLabel.textContent = entry.day.toLocaleDateString(undefined, { weekday: 'short' });
    column.append(fill, value, dayLabel);
    chart.appendChild(column);
  });

  const totalCount = history.length;
  totalPill.textContent = `${totalCount} total`;

  const lastScan = history.slice().reverse().find((entry) => entry.scanned_at || entry.created_at);
  if (lastScan) {
    lastScannedEl.textContent = `Last scanned: ${new Date(lastScan.scanned_at || lastScan.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  } else {
    lastScannedEl.textContent = 'Last scanned: No scans yet';
  }

  if (petQrModalEscapeHandler) {
    window.removeEventListener('keydown', petQrModalEscapeHandler);
  }
  petQrModalEscapeHandler = (event) => {
    if (event.key === 'Escape') {
      closePetQrModal();
    }
  };
  window.addEventListener('keydown', petQrModalEscapeHandler);
}

async function renderUserDashboard() {
  const pets = await loadData('pets');
  const qrCodes = await loadData('qr_codes');
  const myPets = pets.filter((pet) => pet.owner_id === STATE.currentUser.id);
  const petCardList = $('petCardList');
  petCardList.innerHTML = '';

  if (!myPets.length) {
    petCardList.innerHTML = '<p>You have no registered pets yet.</p>';
  }

  myPets.forEach((pet) => {
    const card = document.createElement('div');
    card.className = 'pet-card';
    card.style.position = 'relative';
    const statusBadge = document.createElement('div');
    statusBadge.className = `status-badge ${pet.is_lost ? 'lost' : 'active'}`;
    statusBadge.textContent = pet.is_lost ? '● Lost' : '● Active';
    const image = document.createElement('img');
    image.src = pet.photo;
    image.alt = pet.name;
    image.style.cursor = 'pointer';
    image.addEventListener('click', () => openLightbox(image.src));
    const title = document.createElement('h4');
    title.textContent = pet.name;
    const details = document.createElement('p');
    details.innerHTML = `<strong>Type:</strong> ${pet.type || pet.pet_type || 'N/A'}<br><strong>Breed:</strong> ${pet.breed}<br><strong>Age:</strong> ${pet.age}`;
    const label = document.createElement('small');
    const code = qrCodes.find((qr) => qr.id === pet.qr_code_id);
    label.textContent = `Collar: ${code ? code.code : 'Not assigned'}`;
    const health = document.createElement('p');
    health.innerHTML = `<strong>Allergies:</strong> ${pet.allergies || 'None'}<br><strong>Medications:</strong> ${pet.medications || 'None'}<br><strong>Immunizations:</strong> ${pet.immunizations || 'Unspecified'}`;
    const lostToggleRow = document.createElement('div');
    lostToggleRow.className = 'lost-toggle-row';
    lostToggleRow.innerHTML = `
      <div>
        <strong>Mark as lost</strong>
        <div class="toggle-sub">Alerts finders immediately</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="lostToggle-${pet.id}" ${pet.is_lost ? 'checked' : ''} onchange="toggleLostStatus('${pet.id}', this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    `;
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    const editButton = document.createElement('button');
    editButton.className = 'primary';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => editPet(pet.id));
    const viewQrButton = document.createElement('button');
    viewQrButton.className = 'secondary';
    viewQrButton.textContent = code ? 'View QR' : 'No QR';
    if (!code) {
      viewQrButton.disabled = true;
      viewQrButton.title = 'Assign a collar QR first';
      viewQrButton.style.opacity = '0.6';
      viewQrButton.style.cursor = 'not-allowed';
    } else {
      viewQrButton.addEventListener('click', async () => {
        await openPetQrModal(pet, code);
      });
    }
    actions.append(editButton, viewQrButton);
    card.append(statusBadge, image, title, details, label, health, lostToggleRow, actions);
    petCardList.appendChild(card);
  });
}

function renderAdminPanel() {
  showView('adminQrCodesScreen');
  renderAdminQrCodes(false);
}

async function renderAdminOwners(recentOnly = false) {
  const users = await loadData('users');
  const container = $('adminPetOwners');
  if (!container) return;
  container.innerHTML = '';
  const list = users.filter(u => u.role !== 'admin').slice().reverse();
  const items = recentOnly ? list.slice(0, 8) : list;
  if (!items.length) {
    container.innerHTML = '<p>No registered pet owners yet.</p>';
    return;
  }
  items.forEach((u) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const title = document.createElement('h4');
    title.textContent = getFullName(u) || u.email;
    const details = document.createElement('p');
    details.innerHTML = `<strong>Email:</strong> ${u.email}<br><strong>Phone:</strong> ${u.phone || 'N/A'}<br><strong>Provider:</strong> ${u.provider || 'local'}<br><strong>Role:</strong> ${u.role}`;
    card.append(title, details);
    container.appendChild(card);
  });
}

async function renderAdminRegisteredPets(recentOnly = false) {
  const pets = (await loadData('pets')).slice().reverse();
  const users = await loadData('users');
  const container = $('adminRegisteredPets');
  if (!container) return;
  container.innerHTML = '';
  const items = recentOnly ? pets.slice(0, 8) : pets;
  if (!items.length) {
    container.innerHTML = '<p>No registered pets yet.</p>';
    return;
  }
  items.forEach((pet) => {
    const card = document.createElement('div');
    card.className = 'pet-card';
    const image = document.createElement('img');
    image.src = pet.photo;
    image.alt = pet.name;
    image.style.cursor = 'pointer';
    image.addEventListener('click', () => openLightbox(image.src));
    const title = document.createElement('h4');
    title.textContent = pet.name;
    const owner = users.find(u => u.id === pet.owner_id);
    const details = document.createElement('p');
    details.innerHTML = `<strong>Owner:</strong> ${owner ? (getFullName(owner) || owner.email) : 'Unknown'}<br><strong>Type:</strong> ${pet.type || pet.pet_type || 'N/A'}<br><strong>Breed:</strong> ${pet.breed}<br><strong>Age:</strong> ${pet.age}`;
    card.append(image, title, details);
    container.appendChild(card);
  });
}

async function renderAdminScanHistory(recentOnly = false) {
  // Read scan history directly from Supabase, newest first
  showView('adminScansScreen');
  const { data: history, error } = await db.from('scan_history').select('*').order('scanned_at', { ascending: false });
  const { data: qrCodes } = await db.from('qr_codes').select('*');
  const { data: pets } = await db.from('pets').select('*');

  const container = $('adminScanHistory');
  if (!container) return;

  if (error || !history || !history.length) {
    container.innerHTML = '<p>No scan history yet.</p>';
    return;
  }

  container.innerHTML = '';
  history.forEach(scan => {
    const qr = qrCodes ? qrCodes.find(q => String(q.id) === String(scan.qr_code_id)) : null;
    const pet = pets ? pets.find(p => String(p.qr_code_id) === String(qr ? qr.id : scan.qr_code_id)) : null;
    const div = document.createElement('div');
    div.className = 'history-card';
    div.innerHTML = `
      <strong>${pet ? pet.name : 'Unknown Pet'}</strong>
      <div>QR: ${qr ? qr.code : (scan.qr_code_text || scan.qr_code_id)}</div>
      <div>Scanned by: ${scan.scanned_by || 'Anonymous'}</div>
      <div>Time: ${new Date(scan.scanned_at || scan.created_at).toLocaleString()}</div>
    `;
    container.appendChild(div);
  });
}

async function renderAdminQrCodes(availableOnly = false) {
  const { data: qrCodes, error } = await db.from('qr_codes').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error loading QR codes:', error);
    return;
  }
  const container = $('adminQrCodesList');
  if (!container) return;
  container.innerHTML = '';
  const items = availableOnly ? qrCodes.filter(qr => qr.status === 'available') : qrCodes;
  if (!items || !items.length) {
    container.innerHTML = '<p>No QR codes available.</p>';
    return;
  }
  items.forEach((qr) => {
    const cardContainer = document.createElement('div');
    createQRCodeElement(cardContainer, qr.code, `Collar ${qr.code}`);
    container.appendChild(cardContainer);
  });
}

async function renderAdminQrStatus() {
  const { data: qrCodes, error: qrError } = await db.from('qr_codes').select('*').order('created_at', { ascending: false });
  const { data: pets = [], error: petsError } = await db.from('pets').select('*');
  const { data: users = [], error: usersError } = await db.from('users').select('*');
  const { data: history = [], error: histError } = await db.from('scan_history').select('*');

  if (qrError) {
    console.error('Error loading QR codes:', qrError);
    return;
  }
  if (!qrCodes || !qrCodes.length) {
    const tableBodyEmpty = $('qrStatusTableBody');
    if (tableBodyEmpty) {
      tableBodyEmpty.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">No QR codes found.</td></tr>';
    }
    const summaryElEmpty = $('qrStatusSummary');
    if (summaryElEmpty) summaryElEmpty.innerHTML = '<h3>Assignment Breakdown</h3><p>No QR codes available.</p>';
    return;
  }

  const counts = { assigned: 0, available: 0, lost: 0 };
  qrCodes.forEach(qr => {
    const assignedPet = pets.find(p => String(p.qr_code_id) === String(qr.id));
    if (assignedPet && assignedPet.is_lost) {
      counts.lost++;
    } else if (assignedPet) {
      counts.assigned++;
    } else {
      counts.available++;
    }
  });
  const total = qrCodes.length;

  // Update summary card
  const summaryEl = $('qrStatusSummary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <h3>Assignment Breakdown</h3>
      <p style="margin: 12px 0; font-weight: 600;">🟢 Active/Assigned: ${counts.assigned} (${total ? Math.round(counts.assigned/total*100) : 0}%)</p>
      <p style="margin: 12px 0; font-weight: 600;">🟠 Unassigned: ${counts.available} (${total ? Math.round(counts.available/total*100) : 0}%)</p>
      <p style="margin: 12px 0; font-weight: 600;">🔴 Lost Status: ${counts.lost} (${total ? Math.round(counts.lost/total*100) : 0}%)</p>
      <p style="margin: 20px 0 0 0; font-weight: 700; font-size: 1.1rem;"><strong>Total Collars: ${total}</strong></p>
    `;
  }

  // Update table
  const tableBody = $('qrStatusTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  qrCodes.forEach(qr => {
    // Find assigned pet by matching qr.id to pet.qr_code_id (support string/number types)
    const assignedPet = pets.find(p => String(p.qr_code_id) === String(qr.id)) || null;
    const owner = assignedPet ? users.find(u => String(u.id) === String(assignedPet.owner_id)) : null;
    const scanCount = history.filter(h => String(h.qr_code_id) === String(qr.id)).length;

    const ownerName = owner ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') : '—';
    const petName = assignedPet ? assignedPet.name : '—';

    // Determine status based on assignment and is_lost flag
    let status, statusColor;
    if (assignedPet && assignedPet.is_lost) {
      status = 'Lost Status';
      statusColor = 'red';
    } else if (assignedPet) {
      status = 'Active';
      statusColor = 'green';
    } else {
      status = 'Unassigned';
      statusColor = 'orange';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${qr.code}</td>
      <td><span class="status-pill ${statusColor}">${status}</span></td>
      <td>${petName}</td>
      <td>${ownerName}</td>
      <td>${scanCount}</td>
    `;
    tableBody.appendChild(row);
  });
}

async function getUserByEmail(email) {
  try {
    const { data, error } = await db.from('users').select('*').eq('email', email.toLowerCase()).single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting user by email:', error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error('Error getting user by email:', err);
    return null;
  }
}

async function getUsersByProvider(provider) {
  try {
    const { data, error } = await db.from('users').select('*').eq('provider', provider.toLowerCase());
    if (error) {
      console.error('Error getting users by provider:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Error getting users by provider:', err);
    return [];
  }
}

function loginSocialUser(provider) {
  if (provider === 'Gmail') {
    triggerGoogleSignIn();
  } else if (provider === 'Facebook') {
    triggerFacebookSignIn();
  }
}

function triggerGoogleSignIn() {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    showMessage('Google Sign-In service is not available. Please ensure Google Identity Services library is loaded.');
    return;
  }

  try {
    // Ensure we don't auto-select an already signed-in account
    if (google.accounts.id.disableAutoSelect) google.accounts.id.disableAutoSelect();

    // Try One Tap first; if it doesn't display, render a popup button and open it
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // If One Tap doesn't show, fall back to programmatic popup sign-in
        let btn = document.getElementById('petnet-google-btn');
        if (!btn) {
          btn = document.createElement('div');
          btn.id = 'petnet-google-btn';
          btn.style.position = 'fixed';
          btn.style.left = '-9999px';
          document.body.appendChild(btn);
        }
        google.accounts.id.renderButton(
          btn,
          { type: 'standard', size: 'large', theme: 'outline', text: 'signin_with' }
        );
        // Click the hidden button to open the popup chooser
        setTimeout(() => {
          const rendered = btn.querySelector('button');
          if (rendered) rendered.click();
        }, 100);
      }
    });
  } catch (error) {
    console.error('Google Sign-In error:', error);
    showMessage('Google Sign-In failed. Please try again.');
  }
}

function handleGoogleSignInResponse(response) {
  if (!response.credential) {
    showMessage('Google Sign-In was cancelled. Please try again.');
    return;
  }

  try {
    // Decode JWT token to extract user profile
    const decodedToken = parseJwt(response.credential);
    const email = decodedToken.email;
    const name = decodedToken.name;
    const picture = decodedToken.picture;
    const googleUserId = decodedToken.sub;

    // Process sign-in asynchronously
    (async () => {
      try {
        // Check if user already exists
        let user = await getUserByEmail(email);
        if (user) {
          // Existing user: log them in
          saveCurrentUser(user);
          setNavigation();
          if (user.role === 'admin') {
            renderAdminPanel();
          } else {
            await routeAfterLogin();
          }
        } else {
          // New user: prompt for phone number, then create account
          const phone = prompt('Welcome! Please enter your phone number for owner contact:');
          if (!phone) {
            showMessage('Phone number is required to create an account.');
            return;
          }

          const fakePassword = `google-${googleUserId}`;
          const { first_name, last_name } = splitFullName(name);
          const newUser = {
            first_name,
            last_name,
            email: email.toLowerCase(),
            phone,
            password: fakePassword,
            role: 'user',
            provider: 'google',
            picture,
          };

          const savedUser = await saveData('users', newUser);
          saveCurrentUser(savedUser);
          setNavigation();
          await routeAfterLogin();
        }
      } catch (err) {
        console.error('Error in Google Sign-In processing:', err);
        showMessage('Failed to process Google Sign-In. Please try again.');
      }
    })();
  } catch (error) {
    console.error('Error processing Google Sign-In:', error);
    showMessage('Failed to process Google Sign-In. Please try again.');
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('JWT parsing error:', error);
    throw new Error('Invalid token format');
  }
}

function getFullName(u) {
  if (!u) return '';
  return [u.first_name, u.middle_name, u.last_name, u.suffix].filter(Boolean).join(' ');
}

function splitFullName(fullName) {
  if (!fullName) return { first_name: '', last_name: '' };
  const parts = fullName.trim().split(/\s+/);
  return {
    first_name: parts.shift() || '',
    last_name: parts.join(' ') || '',
  };
}

function initGoogleSignIn() {
  if (!window.google) {
    console.warn('Google Identity Services library not yet loaded.');
    return;
  }

  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignInResponse,
      auto_select: false, // Disable auto-select to require user action
      ux_mode: 'popup', // Use popup instead of redirect
    });
  } catch (error) {
    console.error('Google Sign-In initialization error:', error);
  }
}

// Initialize Facebook SDK (client-side). Set `FACEBOOK_APP_ID` above.
function initFacebookSdk() {
  // Facebook SDK initialization removed
}

function triggerFacebookSignIn() {
  // Facebook login removed - use Google Sign-In instead
  showMessage('Facebook login is no longer available. Please use Google Sign-In instead.');
}

function handleFacebookSignInResponse(authResponse) {
  // Facebook login removed
}

function setQrBaseUrl(url) {
  if (!url) return;
  QR_BASE_URL = url.replace(/\/$/, '');
}

async function registerSocialUser(provider) {
  const providerName = provider;
  const email = prompt(`Enter your ${providerName} email address:`);
  if (!email) return;

  const existing = await getUserByEmail(email);
  if (existing) {
    STATE.currentUser = existing;
    setNavigation();
    if (existing.role === 'admin') {
      location.hash = 'admin';
      renderAdminPanel();
    } else {
      location.hash = 'register';
      beginPetRegistration();
    }
    return;
  }

  const name = prompt('Enter your full name:');
  if (!name) return;
  const phone = prompt('Enter your phone number for owner contact:');
  if (!phone) return;
  const fakePassword = `${providerName.toLowerCase()}-${Date.now()}`;
  await registerUser(name, email, phone, fakePassword, providerName.toLowerCase());
}

function saveCurrentUser(user) {
  STATE.currentUser = user;
  try {
    sessionStorage.setItem('pawsqr_session', JSON.stringify(user));
  } catch (e) {
    console.warn('Unable to save session:', e);
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem('pawsqr_session');
    if (raw) {
      const user = JSON.parse(raw);
      STATE.currentUser = user;
    }
  } catch (e) {
    console.warn('Unable to load session:', e);
    sessionStorage.removeItem('pawsqr_session');
  }
}

async function seedDemoData(user) {
  const existingQrs = await loadData('qr_codes');
  const pets = await loadData('pets');

  // Create demo QR codes if none exist (avoid supplying manual IDs)
  let demoQr1 = null;
  if (existingQrs.length === 0) {
    const saved1 = await saveData('qr_codes', { code: 'PN-DEMO-QR-0001', status: 'assigned' });
    const saved2 = await saveData('qr_codes', { code: 'PN-DEMO-QR-0002', status: 'available' });
    demoQr1 = saved1;
  } else {
    demoQr1 = existingQrs.find(q => q.code === 'PN-DEMO-QR-0001') || null;
  }

  // Create a demo pet linked to the first demo QR (use returned IDs)
  if (user && pets.length === 0 && demoQr1) {
    const petPayload = {
      owner_id: user.id,
      name: 'Luna',
      age: '2 years',
      breed: 'Siamese',
      photo: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80',
      characteristics: 'Blue eyes, white paws, small scar on ear',
      allergies: 'None',
      medications: 'None',
      immunizations: 'Up to date',
      qr_code_id: demoQr1.id,
    };
    const savedPet = await saveData('pets', petPayload);
    // ensure qr is updated to reference the saved pet id
    if (savedPet && demoQr1) {
      await updateData('qr_codes', demoQr1.id, { pet_id: savedPet.id, status: 'assigned' });
    }
  }
}

async function autoLoginFromHash() {
  const hash = location.hash.replace('#', '');
  if (!STATE.currentUser && hash === 'admin') {
    STATE.currentUser = MASTER_ADMIN;
    await seedDemoData(null);
    return;
  }
  if (!STATE.currentUser && (hash === 'demo' || hash === 'user')) {
    const users = await loadData('users');
    let user = users.find((u) => u.role === 'user');
    if (!user) {
      const newUserData = {
        first_name: 'Demo',
        last_name: 'PetOwner',
        email: 'demo@petnetwork.com',
        phone: '+1-800-555-0199',
        password: 'PetOwner!2026',
        role: 'user',
        provider: 'local',
      };
      const savedUser = await saveData('users', newUserData);
      user = savedUser;
    }
    STATE.currentUser = user;
    await seedDemoData(user);
  }
}

async function routeToView() {
  // Ensure navigation visibility is correct before routing
  setNavigation();
  
  const hash = location.hash.replace('#', '');
  const queryParams = new URLSearchParams(window.location.search);
  const deepQr = queryParams.get('qr');
  
  // SCENARIO A: Deep-link via QR code scan (handle before checking currentUser)
  // This is public - works whether user is logged in or not
  if (deepQr) {
    const rawCode = normalizeQrText(deepQr);
    const qrCodes = await loadData('qr_codes');
    const qrCode = qrCodes.find((q) => q.code === rawCode);
    
    if (!qrCode) {
      // QR code doesn't exist in system
      showMessage('This QR code is not recognized. Please contact support.');
      showView('loginScreen');
      return;
    }
    
    // SCENARIO B: QR code is REGISTERED to a pet - show pet info (public finder view)
    if (qrCode.status === 'assigned' && qrCode.pet_id) {
      await renderFinderResult(rawCode);
      return;
    }
    
    // SCENARIO C: QR code is UNREGISTERED (available) - send to login/registration
    if (qrCode.status === 'available') {
      STATE.pendingQrCode = qrCode;
      showView('loginScreen');
      showMessage('Welcome! This collar is ready to be registered. Please log in or create an account.');
      return;
    }
    
    // SCENARIO D: QR code exists but is deactivated or lost - show error
    showMessage('This collar has been deactivated or marked as lost. Please contact support.');
    showView('loginScreen');
    return;
  }
  
  if (!STATE.currentUser) {
    showView('loginScreen');
    return;
  }

  if (STATE.currentUser.role === 'admin') {
    renderAdminPanel();
    return;
  }

  if (hash === 'register') {
    beginPetRegistration();
    return;
  }
  if (hash === 'history') {
    showView('historyScreen');
    showHistoryView();
    return;
  }
  if (hash === 'finder') {
    showView('finderScreen');
    return;
  }
  showView('dashboardScreen');
  await renderUserDashboard();
}

async function routeAfterLogin() {
  const pets = await loadData('pets');
  const userPets = pets.filter(p => p.owner_id === STATE.currentUser.id);
  if (userPets.length > 0) {
    showView('dashboardScreen');
    await renderUserDashboard();
  } else {
    beginPetRegistration();
  }
}

async function login(email, password) {
  if (email === MASTER_ADMIN.email && password === MASTER_ADMIN.password) {
    saveCurrentUser(MASTER_ADMIN);
    setNavigation();
    renderAdminPanel();
    return;
  }

  const hashedPassword = await hashPassword(password);

  const { data, error } = await db.from('users').select('*').eq('email', email).single();

  if (error || !data) {
    alert('No account found for that email.');
    return;
  }

  if (data.password !== hashedPassword) {
    alert('Incorrect password.');
    return;
  }

  saveCurrentUser(data);
  setNavigation();
  await routeAfterLogin();
}

async function registerUser() {
  const firstName = document.getElementById('createFirstName').value.trim();
  const middleName = document.getElementById('createMiddleName').value.trim();
  const lastName = document.getElementById('createLastName').value.trim();
  const suffix = document.getElementById('createSuffix').value.trim();
  const email = document.getElementById('createEmail').value.trim();
  const phone = document.getElementById('createPhone').value.trim();
  const password = document.getElementById('createPassword').value;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Please enter a valid email address.');
    return;
  }

  const hashedPassword = await hashPassword(password);

  const { data, error } = await db.from('users').insert([{
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    suffix: suffix,
    email: email,
    phone: phone,
    password: hashedPassword,
    role: 'user',
    provider: 'local'
  }]).select().single();

  if (error) {
    alert('Registration failed: ' + error.message);
    return;
  }

  // Send welcome email if EmailJS is configured
  try {
    if (window.emailjs && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && !EMAILJS_SERVICE_ID.includes('YOUR_') && !EMAILJS_TEMPLATE_ID.includes('YOUR_')) {
      const toName = `${firstName} ${lastName}`.trim() || email;
      const templateParams = {
        to_name: toName,
        to_email: email,
        email: email
      };
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        console.log('Welcome email sent to', email);
      } catch (sendErr) {
        console.error('Error sending welcome email:', sendErr);
      }
    }
  } catch (e) {
    console.warn('EmailJS welcome send skipped:', e);
  }

  document.getElementById('createAccountForm').reset();
  alert('Account created successfully! Please log in.');
  showView('loginScreen');
}

function registerSocialUser(provider) {
  // This function is deprecated for OAuth providers. Use provider-specific flows instead.
  showMessage(`${provider} Sign-In flow has been moved to provider-specific handlers.`);
}

function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  STATE.currentUser = null;
  STATE.pendingQrCode = null;
  STATE.currentQrVerification = null;
  try {
    sessionStorage.removeItem('pawsqr_session');
  } catch (e) {
    console.warn('Unable to clear session:', e);
  }
  setNavigation();
  toggleLoginState('welcome');
  showView('loginScreen');
  const loginEmail = $('loginEmail');
  const loginPassword = $('loginPassword');
  if (loginEmail) loginEmail.value = '';
  if (loginPassword) loginPassword.value = '';
}

function startLoginQrScanner() {
  const container = $('loginScannerContainer');
  container.classList.remove('hidden');

  if (STATE.loginScanner) {
    STATE.loginScanner.clear().catch(() => {});
    STATE.loginScanner = null;
  }

  const html5QrCode = new Html5Qrcode('loginScannerContainer');
  STATE.loginScanner = html5QrCode;
  html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, (decodedText) => {
    html5QrCode.stop().then(() => {
      handleLoginQrDecoded(decodedText);
    }).catch(() => {
      handleLoginQrDecoded(decodedText);
    });
  }).catch(() => {
    showMessage('Unable to access camera. You can enter the QR code manually on the account registration page.');
  });
}

async function handleLoginQrDecoded(codeText) {
  if (STATE.loginScanner) {
    STATE.loginScanner.clear().catch(() => {});
    STATE.loginScanner = null;
  }
  const normalized = normalizeQrText(codeText);
  const qrCodes = await loadData('qr_codes');
  const qr = qrCodes.find((q) => q.code === normalized);
  if (!qr) {
    showMessage('This QR code is not registered. Please ask the administrator for a valid collar.');
    return;
  }
  if (qr.status === 'assigned') {
    showMessage('This collar QR code is already assigned to a pet. Please use a different code.');
    return;
  }
  STATE.pendingQrCode = qr;
  $('loginScannerContainer').classList.add('hidden');
  showMessage('QR code verified. Please create your account to continue registering your pet.');
  showView('createAccountScreen');
}

async function beginPetRegistration(editPet = null, preVerifiedQr = null) {
  const qrScanSection = $('qrScanSection');
  $('petFormTitle').textContent = editPet ? 'Edit Pet Profile' : 'Register Pet';
  $('petForm').reset();
  $('scannerStatus').textContent = 'No QR code scanned yet.';
  $('petQrCode').value = '';
  STATE.currentQrVerification = null;
  $('scannerContainer').classList.add('hidden');

  if (editPet) {
    if (qrScanSection) qrScanSection.classList.add('hidden');
    $('editingPetId').value = editPet.id;
    $('petName').value = editPet.name;
    $('petAge').value = editPet.age;
    const petTypeValue = editPet.type || editPet.pet_type;
    if (petTypeValue) {
      const radio = document.querySelector(`input[name="petType"][value="${petTypeValue}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }
      $('petBreed').value = editPet.breed;
    }
    $('petPhoto').value = editPet.photo;
    $('petCharacteristics').value = editPet.characteristics;
    $('petAllergies').value = editPet.allergies;
    $('petMedications').value = editPet.medications;
    const savedImmunizations = editPet.immunizations ? editPet.immunizations.split(', ') : [];
    document.querySelectorAll('#immunizationCheckboxes input').forEach(cb => {
      cb.checked = savedImmunizations.includes(cb.value);
    });
    if (editPet.qr_code_id) {
      const qrs = await loadData('qr_codes');
      const qr = qrs.find((code) => code.id === editPet.qr_code_id);
      if (qr) {
        $('petQrCode').value = qr.code;
        STATE.currentQrVerification = qr;
        $('scannerStatus').textContent = `QR collar already assigned: ${qr.code}`;
      } else {
        STATE.currentQrVerification = {
          id: editPet.qr_code_id,
          code: editPet.qr_code_id,
          status: 'assigned',
        };
      }
    }
  } else {
    if (qrScanSection) qrScanSection.classList.remove('hidden');
    $('editingPetId').value = '';
    if (preVerifiedQr) {
      STATE.currentQrVerification = preVerifiedQr;
      $('petQrCode').value = preVerifiedQr.code;
      $('scannerStatus').textContent = `QR code verified: ${preVerifiedQr.code}`;
    }
  }
  showView('petFormScreen');
}

async function toggleLostStatus(petId, isLost) {
  const { error } = await db.from('pets').update({ is_lost: isLost }).eq('id', petId);
  if (error) {
    showMessage('Error updating status.');
    return;
  }
  await renderUserDashboard();
}

// Removed lost-pet broadcast emails per user request.

async function editPet(petId) {
  const pets = await loadData('pets');
  const pet = pets.find((p) => p.id === petId);
  if (!pet) return;
  beginPetRegistration(pet);
}

function launchQrScanner(target) {
  const config = { fps: 10, qrbox: 250 };
  const scannerName = target === 'pet' ? 'petScanner' : 'finderScanner';
  const container = target === 'pet' ? $('scannerContainer') : $('finderScannerContainer');
  const status = target === 'pet' ? $('scannerStatus') : null;

  // Show scanner container
  container.classList.remove('hidden');

  // Ensure any existing scanner is completely stopped and cleared before starting a new one
  const cleanupAndStartScanner = () => {
    if (STATE[scannerName]) {
      try {
        STATE[scannerName].stop()
          .then(() => {
            // Successful stop, now clear
            try {
              STATE[scannerName].clear();
            } catch (e) {
              console.warn('Error clearing scanner:', e);
            }
            STATE[scannerName] = null;
            startFreshScanner();
          })
          .catch((stopErr) => {
            // Stop failed, but force cleanup anyway
            console.warn('Error stopping scanner:', stopErr);
            try {
              STATE[scannerName].clear();
            } catch (e) {
              console.warn('Error clearing scanner after stop failure:', e);
            }
            STATE[scannerName] = null;
            startFreshScanner();
          });
      } catch (e) {
        console.warn('Error in scanner cleanup:', e);
        STATE[scannerName] = null;
        startFreshScanner();
      }
    } else {
      startFreshScanner();
    }
  };

  const startFreshScanner = () => {
    try {
      const html5QrCode = new Html5Qrcode(
        target === 'pet' ? 'scannerContainer' : 'finderScannerContainer'
      );
      STATE[scannerName] = html5QrCode;

      html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // QR code successfully scanned
          if (target === 'pet') {
            handlePetQrScan(decodedText);
          } else {
            handleFinderQrScanned(decodedText, html5QrCode, container);
          }
        }
      ).catch((err) => {
        console.error('Error starting scanner:', err);
        if (status) {
          status.textContent = 'Camera not available. Enter QR code manually.';
        }
        STATE[scannerName] = null;
      });
    } catch (e) {
      console.error('Error initializing scanner:', e);
      if (status) {
        status.textContent = 'Error initializing scanner.';
      }
      STATE[scannerName] = null;
    }
  };

  cleanupAndStartScanner();
}

async function handlePetQrScan(decodedText) {
  let scannedCode = decodedText.trim();

  // Extract code from URL if it's a full URL
  try {
    if (scannedCode.startsWith('http')) {
      const url = new URL(scannedCode);
      const qrParam = url.searchParams.get('qr');
      if (qrParam) scannedCode = qrParam;
    }
  } catch (e) {}

  // Stop the scanner immediately
  try {
    if (STATE.petScanner) {
      await STATE.petScanner.stop();
      STATE.petScanner.clear();
      STATE.petScanner = null;
    }
  } catch (e) {}

  // Hide scanner container
  const container = $('scannerContainer');
  if (container) container.classList.add('hidden');

  // Look up or create QR record in Supabase
  let { data: qrRecord } = await db.from('qr_codes').select('*').eq('code', scannedCode).single();

  if (!qrRecord) {
    const { data: newQr, error } = await db.from('qr_codes').insert([{
      code: scannedCode,
      status: 'available'
    }]).select().single();
    if (error || !newQr) {
      $('scannerStatus').textContent = 'Error saving QR code. Please try again.';
      return;
    }
    qrRecord = newQr;
  }

  if (qrRecord.status === 'assigned') {
    $('scannerStatus').textContent = 'This QR code is already assigned to a pet. Please scan a different one.';
    STATE.currentQrVerification = null;
    return;
  }

  // Set verification
  STATE.currentQrVerification = qrRecord;
  $('scannerStatus').textContent = `✓ QR Code scanned: ${scannedCode}`;
  if ($('petQrCode')) $('petQrCode').value = scannedCode;
}

function handleFinderQrScanned(decodedText, scannerInstance, container) {
  // Stop the scanner immediately
  scannerInstance.stop()
    .then(() => {
      scannerInstance.clear().catch(() => {});
      STATE.finderScanner = null;
      container.classList.add('hidden');
      
      // Set the input and lookup
      $('finderQrInput').value = decodedText;
      handleFinderLookup();
    })
    .catch(() => {
      scannerInstance.clear().catch(() => {});
      STATE.finderScanner = null;
      container.classList.add('hidden');
      
      $('finderQrInput').value = decodedText;
      handleFinderLookup();
    });
}

async function verifyScannedQr(codeText) {
  const normalized = normalizeQrText(codeText);
  const qrCodes = await loadData('qr_codes');
  
  // Debug logging
  console.log('Scanned QR code (normalized):', normalized);
  console.log('Current QR codes in Supabase:', qrCodes);
  
  let qrCode = qrCodes.find((q) => q.code === normalized);
  
  // If QR code is not found in Supabase, create a new record for it
  // This allows scanning codes generated on other devices/sessions
  if (!qrCode) {
    console.log('QR code not found in Supabase, creating new record');
    qrCode = { code: normalized, status: 'available' };
    const savedQr = await saveData('qr_codes', qrCode);
    qrCode = savedQr;
    console.log('New QR code created and saved:', qrCode);
  }
  
  // Check if QR code is already assigned to a pet
  if (qrCode.status === 'assigned') {
    $('scannerStatus').textContent = 'This QR code is already assigned to a pet.';
    return;
  }
  
  // Successfully verified - set the verification state
  $('petQrCode').value = qrCode.code;
  STATE.currentQrVerification = qrCode;
  $('scannerStatus').textContent = `QR code verified: ${qrCode.code}`;
  console.log('QR code verification successful, STATE.currentQrVerification set:', STATE.currentQrVerification);
}

function handleFinderLookup() {
  const codeText = $('finderQrInput').value.trim();
  const rawCode = normalizeQrText(codeText);
  renderFinderResult(rawCode);
}

async function renderFinderResult(rawCode) {
  const qrCodes = await loadData('qr_codes');
  const pets = await loadData('pets');
  const users = await loadData('users');
  
  const qrCode = qrCodes.find((q) => q.code === rawCode);
  if (!qrCode || !qrCode.pet_id) {
    showMessage('This pet has not been registered yet. Redirecting to the login screen.');
    showView('loginScreen');
    setNavigation();
    const loginEmail = $('loginEmail');
    const loginPassword = $('loginPassword');
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    return;
  }
  const pet = pets.find((p) => p.id === qrCode.pet_id);
  const owner = users.find((u) => u.id === pet.owner_id);
  showView('finderScreen');
  const result = $('finderResult');
  result.innerHTML = `
    <h3>${pet.name}</h3>
    <img src="${pet.photo}" alt="${pet.name}" style="width:100%;border-radius:16px;margin-bottom:12px;max-height:260px;object-fit:cover;cursor:pointer;" />
    <p><strong>Type:</strong> ${pet.type || pet.pet_type || 'N/A'}</p>
    <p><strong>Breed:</strong> ${pet.breed}</p>
    <p><strong>Age:</strong> ${pet.age}</p>
    <p><strong>Characteristics:</strong> ${pet.characteristics}</p>
    <p><strong>Allergies:</strong> ${pet.allergies || 'None'}<br><strong>Medications:</strong> ${pet.medications || 'None'}<br><strong>Immunizations:</strong> ${pet.immunizations || 'Unspecified'}</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;">
      <a class="primary" href="tel:${owner.phone}" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Call Owner</a>
      <a class="secondary" href="mailto:${owner.email}?subject=Found%20${encodeURIComponent(pet.name)}" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Email Owner</a>
    </div>
    ${owner ? `<p style="margin-top:16px;font-weight:600;">Owner: ${[owner.first_name, owner.last_name].filter(Boolean).join(' ')}</p>` : ''}
  `;
  const finderImage = result.querySelector('img');
  if (finderImage) {
    finderImage.addEventListener('click', () => openLightbox(finderImage.src));
  }

  // Save a scan record to Supabase (Finder lookup)
  try {
    const { error: scanError } = await db.from('scan_history').insert([{
      qr_code_id: qrCode.id,
      scanned_by: STATE.currentUser ? [STATE.currentUser.first_name, STATE.currentUser.last_name].filter(Boolean).join(' ') : 'Anonymous',
      location: null,
      scanned_at: new Date().toISOString(),
      user_id: owner.id,
      pet_id: pet.id,
      qr_code_text: qrCode.code,
      action: 'Finder lookup'
    }]);
    if (scanError) console.error('Error saving scan history:', scanError);
  } catch (e) {
    console.error('Unexpected error saving scan history:', e);
  }
}

async function recordHistory(entry) {
  const history = await loadData('scan_history');
  await saveData('scan_history', {
    ...entry,
    created_at: new Date().toISOString(),
  });
}

async function submitPetForm(event) {
  event.preventDefault();
  const petName = $('petName').value.trim();
  const petAge = $('petAge').value.trim();
  const petBreed = $('petBreed').value.trim();
  const petPhoto = $('petPhoto').value.trim();
  const petCharacteristics = $('petCharacteristics').value.trim();
  const petAllergies = $('petAllergies').value.trim();
  const petMedications = $('petMedications').value.trim();
  const petType = document.querySelector('input[name="petType"]:checked');
  const checked = Array.from(document.querySelectorAll('#immunizationCheckboxes input:checked')).map(cb => cb.value);
  const petImmunizations = checked.join(', ') || 'None';
  const editingId = $('editingPetId').value;

  if (!STATE.currentQrVerification) {
    showMessage('You must scan a QR code first.');
    return;
  }

  const pets = await loadData('pets');
  const existingPet = editingId ? pets.find((p) => p.id === editingId) : null;
  const { data: freshQr, error: qrError } = await db.from('qr_codes').select('*').eq('id', STATE.currentQrVerification.id).single();
  if (qrError || !freshQr) {
    showMessage('QR code not found. Please scan again.');
    STATE.currentQrVerification = null;
    return;
  }
  if (freshQr.status === 'assigned' && (!existingPet || existingPet.qr_code_id !== freshQr.id)) {
    showMessage('This QR code is already assigned to a pet. Please scan a different one.');
    STATE.currentQrVerification = null;
    return;
  }
  const qr = freshQr;

  if (editingId) {
    const existingPet = pets.find((p) => p.id === editingId);
    if (!existingPet) {
      showMessage('Pet not found.');
      return;
    }
    await updateData('pets', editingId, {
      name: petName,
      age: petAge,
      type: petType ? petType.value : 'N/A',
      pet_type: petType ? petType.value : '',
      breed: petBreed,
      photo: petPhoto,
      characteristics: petCharacteristics,
      allergies: petAllergies,
      medications: petMedications,
      immunizations: petImmunizations,
      qr_code_id: qr.id,
    });
    if (existingPet.qr_code_id !== qr.id) {
      const previousIndex = qrCodes.findIndex((code) => code.id === existingPet.qr_code_id);
      if (previousIndex >= 0) {
        await updateData('qr_codes', qrCodes[previousIndex].id, { status: 'available', pet_id: null });
      }
      await updateData('qr_codes', qr.id, { pet_id: existingPet.id, status: 'assigned' });
    }
    await recordHistory({ action: 'Updated pet profile', user_id: STATE.currentUser.id, pet_id: existingPet.id, qr_code_text: qr.code });
  } else {
    const newPet = {
      owner_id: STATE.currentUser.id,
      name: petName,
      age: petAge,
      type: petType ? petType.value : 'N/A',
      pet_type: petType ? petType.value : '',
      breed: petBreed,
      photo: petPhoto,
      characteristics: petCharacteristics,
      allergies: petAllergies,
      medications: petMedications,
      immunizations: petImmunizations,
      qr_code_id: qr.id,
      created_at: new Date().toISOString(),
    };
    const savedPet = await saveData('pets', newPet);
    await updateData('qr_codes', qr.id, { pet_id: savedPet.id, status: 'assigned' });
    await recordHistory({ action: 'Registered pet', user_id: STATE.currentUser.id, pet_id: savedPet.id, qr_code_text: qr.code });
  }

  $('petForm').reset();
  STATE.currentQrVerification = null;
  showView('dashboardScreen');
  await renderUserDashboard();
}

async function generateQrCodeBatch(count = 1) {
  const generatedCodes = [];
  for (let i = 0; i < count; i += 1) {
    const code = secureRandomCode();
    const { data, error } = await db.from('qr_codes').insert([{ code: code, status: 'available' }]).select().single();
    if (error) {
      console.error('Error generating QR code:', error);
      showMessage('Error generating QR code: ' + (error.message || error));
      return;
    }
    generatedCodes.push(data);
  }
  showView('adminQrCodesScreen');
  await renderAdminQrCodes(false);
  showMessage(`Successfully generated ${count} new collar QR code(s).`);
}

async function sendWelcomeEmailsToAll() {
  const statusEl = $('welcomeEmailStatus');
  if (statusEl) statusEl.textContent = 'Loading users...';
  
  const { data: users, error } = await db.from('users').select('*');
  if (error || !users || !users.length) {
    if (statusEl) statusEl.textContent = 'No users found or error loading users.';
    return;
  }
  
  const nonAdmins = users.filter(u => u.role !== 'admin');
  if (statusEl) statusEl.textContent = `Sending to ${nonAdmins.length} users...`;
  
  let successCount = 0;
  let failCount = 0;
  
  for (const user of nonAdmins) {
    try {
      const toName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_name: toName,
        to_email: user.email,
        email: user.email
      });
      successCount++;
      if (statusEl) statusEl.textContent = `Sent ${successCount}/${nonAdmins.length}...`;
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Failed to send to', user.email, err);
      failCount++;
    }
  }
  
  if (statusEl) statusEl.textContent = `Done! ✓ ${successCount} sent, ${failCount} failed.`;
}

async function resetPassword() {
  if (!forgotPasswordVerifiedEmail) { alert('Please verify your email first.'); return; }
  const newPassword = $('forgotNewPassword') ? $('forgotNewPassword').value : '';
  const confirmPassword = $('forgotConfirmPassword') ? $('forgotConfirmPassword').value : '';

  if (newPassword !== confirmPassword) { alert('Passwords do not match.'); return; }
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*]/.test(newPassword)) {
    alert('Password does not meet requirements.');
    return;
  }

  try {
    const { data: user, error } = await db.from('users').select('*').eq('email', forgotPasswordVerifiedEmail).single();
    if (error || !user) {
      alert('No account found for that email.');
      return;
    }

    const hashedPassword = await hashPassword(newPassword);

    const { data, error: updateError } = await db.from('users').update({ password: hashedPassword }).eq('id', user.id).select().single();
    if (updateError) {
      console.error('Error updating password:', updateError);
      alert('Failed to reset password. Please try again later.');
      return;
    }

    // Reset form and return to login
    const forgotForm = $('forgotForm');
    if (forgotForm) forgotForm.reset();
    forgotPasswordVerifiedEmail = null;
    forgotPasswordVerificationCode = null;
    alert('Password reset successful. Please log in with your new password.');
    toggleLoginState('form');
    showView('loginScreen');
  } catch (e) {
    console.error('Unexpected error resetting password:', e);
    alert('An unexpected error occurred. Please try again later.');
  }
}

async function sendVerificationCode() {
  const email = $('forgotEmail') ? $('forgotEmail').value.trim() : '';
  if (!email) { alert('Please enter your registered email.'); return; }

  try {
    const { data: user, error } = await db.from('users').select('id,email').eq('email', email).single();
    if (error || !user) { alert('No account found for that email.'); return; }

    // generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    forgotPasswordVerificationCode = code;
    forgotPasswordCodeExpiry = Date.now() + 10 * 60 * 1000;

    if (forgotPasswordCountdownInterval) {
      clearInterval(forgotPasswordCountdownInterval);
      forgotPasswordCountdownInterval = null;
    }

    const countdownEl = $('codeCountdown');
    const updateCountdown = () => {
      const remaining = forgotPasswordCodeExpiry - Date.now();
      if (remaining <= 0) {
        if (forgotPasswordCountdownInterval) {
          clearInterval(forgotPasswordCountdownInterval);
          forgotPasswordCountdownInterval = null;
        }
        forgotPasswordVerificationCode = null;
        forgotPasswordCodeExpiry = null;
        if (countdownEl) countdownEl.textContent = 'Code expired. Request a new code.';
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      if (countdownEl) countdownEl.textContent = `Code expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    updateCountdown();
    forgotPasswordCountdownInterval = setInterval(updateCountdown, 1000);

    // send via EmailJS REST endpoint (public key not required for service/template sends)
    const payload = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_VERIFICATION_TEMPLATE_ID,
      user_id: EMAILJS_USER_ID,
      template_params: {
        to_email: email,
        verification_code: code
      }
    };

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('EmailJS send failed', await res.text());
      alert('Failed to send verification email. Please try again later.');
      return;
    }

    // move to step 2
    const step1 = $('forgotStep1');
    const step2 = $('forgotStep2');
    if (step1) step1.classList.add('hidden');
    if (step2) step2.classList.remove('hidden');
    alert('Verification code sent. Check your email.');
  } catch (e) {
    console.error('Error sending verification code', e);
    alert('Unexpected error. Please try again later.');
  }
}

function verifyCode() {
  const entered = $('forgotVerificationCode') ? $('forgotVerificationCode').value.trim() : '';
  if (!entered) { alert('Please enter the verification code.'); return; }

  if (!forgotPasswordCodeExpiry || Date.now() > forgotPasswordCodeExpiry) {
    alert('Code has expired. Please request a new one.');
    forgotPasswordVerificationCode = null;
    forgotPasswordCodeExpiry = null;
    if (forgotPasswordCountdownInterval) {
      clearInterval(forgotPasswordCountdownInterval);
      forgotPasswordCountdownInterval = null;
    }
    if ($('forgotVerificationCode')) $('forgotVerificationCode').value = '';
    const step2 = $('forgotStep2');
    const step1 = $('forgotStep1');
    if (step2) step2.classList.add('hidden');
    if (step1) step1.classList.remove('hidden');
    return;
  }

  if (entered !== forgotPasswordVerificationCode) { alert('Invalid verification code.'); return; }

  // code verified — lock in the email and proceed to reset
  if (forgotPasswordCountdownInterval) {
    clearInterval(forgotPasswordCountdownInterval);
    forgotPasswordCountdownInterval = null;
  }
  forgotPasswordVerifiedEmail = $('forgotEmail') ? $('forgotEmail').value.trim() : null;
  forgotPasswordVerificationCode = null;
  forgotPasswordCodeExpiry = null;
  const step2 = $('forgotStep2');
  const step3 = $('forgotStep3');
  if (step2) step2.classList.add('hidden');
  if (step3) step3.classList.remove('hidden');
}

async function showHistoryView() {
  const container = $('historyList');
  if (!container) return;

  // Load user's pets, then fetch scan history for those pet QR IDs
  const { data: userPets = [] } = await db.from('pets').select('*').eq('owner_id', STATE.currentUser.id);
  if (!userPets || !userPets.length) {
    container.innerHTML = '<p>No scan history yet.</p>';
    return;
  }
  const petQrIds = userPets.map(p => p.qr_code_id).filter(Boolean);
  if (!petQrIds.length) {
    container.innerHTML = '<p>No scan history yet.</p>';
    return;
  }

  const { data: history, error } = await db.from('scan_history').select('*').in('qr_code_id', petQrIds).order('scanned_at', { ascending: false });
  const { data: qrCodes = [] } = await db.from('qr_codes').select('*');

  if (error || !history || !history.length) {
    container.innerHTML = '<p>No scan history yet.</p>';
    return;
  }

  container.innerHTML = '';
  history.forEach(scan => {
    const qr = qrCodes.find(q => String(q.id) === String(scan.qr_code_id)) || null;
    const pet = userPets.find(p => String(p.qr_code_id) === String(scan.qr_code_id));
    const item = document.createElement('div');
    item.className = 'history-card';
    item.innerHTML = `
      <strong>${pet ? pet.name : 'Unknown Pet'}</strong>
      <div>QR: ${qr ? qr.code : (scan.qr_code_text || scan.qr_code_id)}</div>
      <div>Scanned by: ${scan.scanned_by || 'Anonymous'}</div>
      <div>Time: ${new Date(scan.scanned_at || scan.created_at).toLocaleString()}</div>
    `;
    container.appendChild(item);
  });
}

function toggleLoginState(state) {
  const welcomeState = $('loginWelcomeState');
  const formState = $('loginFormState');
  const forgotState = $('forgotPasswordState');

  if (welcomeState) welcomeState.classList.add('hidden');
  if (formState) formState.classList.add('hidden');
  if (forgotState) forgotState.classList.add('hidden');

  if (state === 'welcome' && welcomeState) welcomeState.classList.remove('hidden');
  else if (state === 'form' && formState) formState.classList.remove('hidden');
  else if (state === 'forgot' && forgotState) forgotState.classList.remove('hidden');
}

function attachEvents() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  // Login state toggle buttons
  const loginToggleButton = $('loginToggleButton');
  const backToWelcome = $('backToWelcome');
  const linkCreateAccount = $('linkCreateAccount');
  
  if (loginToggleButton) {
    loginToggleButton.addEventListener('click', () => toggleLoginState('form'));
  }
  if (backToWelcome) {
    backToWelcome.addEventListener('click', () => toggleLoginState('welcome'));
  }
  if (linkCreateAccount) {
    linkCreateAccount.addEventListener('click', (e) => {
      e.preventDefault();
      showView('createAccountScreen');
    });
  }

  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await login($('loginEmail').value.trim(), $('loginPassword').value);
  });
  $('showCreateAccount').addEventListener('click', () => showView('createAccountScreen'));
  $('backToLogin').addEventListener('click', () => { toggleLoginState('welcome'); showView('loginScreen'); });
  $('createAccountForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const confirmPwd = $('confirmPassword') ? $('confirmPassword').value : null;
    if (confirmPwd !== null && $('createPassword').value !== confirmPwd) {
      alert('Passwords do not match. Please try again.');
      return;
    }
    await registerUser();
  });

  // Fix 1: Eye icon toggle for password visibility
  const toggleBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('createPassword');
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = passwordInput.type === 'password' ? '👁' : '🙈';
    });
  }

  // Confirm password eye icon
  const toggleConfirmBtn = document.getElementById('toggleConfirmPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  if (toggleConfirmBtn && confirmPasswordInput) {
    toggleConfirmBtn.addEventListener('click', () => {
      confirmPasswordInput.type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
      toggleConfirmBtn.textContent = confirmPasswordInput.type === 'password' ? '👁' : '🙈';
    });
  }

  // Login password eye toggle
  const toggleLoginBtn = document.getElementById('toggleLoginPassword');
  const loginPasswordInput = document.getElementById('loginPassword');
  if (toggleLoginBtn && loginPasswordInput) {
    toggleLoginBtn.addEventListener('click', () => {
      loginPasswordInput.type = loginPasswordInput.type === 'password' ? 'text' : 'password';
      toggleLoginBtn.textContent = loginPasswordInput.type === 'password' ? '👁' : '🙈';
    });
  }

  // Fix 2: Live password validation requirements
  const pwInput = document.getElementById('createPassword');
  if (pwInput) {
    pwInput.addEventListener('input', () => {
      const val = pwInput.value;
      const update = (id, test) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.color = test ? 'green' : 'red';
        el.textContent = (test ? '✓' : '✗') + el.textContent.slice(1);
      };
      update('req-length', val.length >= 8);
      update('req-upper', /[A-Z]/.test(val));
      update('req-number', /[0-9]/.test(val));
      update('req-special', /[!@#$%^&*]/.test(val));
    });
  }

  // Pet type and breed selector
  const dogBreeds = ['Askal','Labrador','Bulldog','Poodle','Beagle','German Shepherd','Golden Retriever','Shih Tzu','Chihuahua','Dachshund','Siberian Husky','Rottweiler','Doberman','Pomeranian','Chow Chow'];
  const catBreeds = ['Puspin','Persian','Siamese','Maine Coon','Bengal','Ragdoll','British Shorthair','Sphynx','Scottish Fold','Abyssinian','Birman','Burmese','Russian Blue','Turkish Angora'];

  document.querySelectorAll('input[name="petType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const breeds = radio.value === 'dog' ? dogBreeds : catBreeds;
      const breedSelect = document.getElementById('petBreed');
      breedSelect.innerHTML = breeds.map(b => `<option value="${b}">${b}</option>`).join('');
    });
  });

  $('btnGoogle').addEventListener('click', () => loginSocialUser('Gmail'));
  const btnLogoutUser = $('btnLogoutUser');
  const btnLogoutAdmin = $('btnLogoutAdmin');
  if (btnLogoutUser) btnLogoutUser.addEventListener('click', handleLogout);
  if (btnLogoutAdmin) btnLogoutAdmin.addEventListener('click', handleLogout);

  // User navigation
  const navMyPets = $('navMyPets');
  const navRegisterPet = $('navRegisterPet');
  const navMyHistory = $('navMyHistory');
  const navFinder = $('navFinder');
  if (navMyPets) navMyPets.addEventListener('click', async () => { navMyPets.classList.add('active-nav'); showView('dashboardScreen'); await renderUserDashboard(); });
  if (navRegisterPet) navRegisterPet.addEventListener('click', () => { navRegisterPet.classList.add('active-nav'); beginPetRegistration(); });
  if (navMyHistory) navMyHistory.addEventListener('click', async () => { navMyHistory.classList.add('active-nav'); showView('historyScreen'); await showHistoryView(); });
  if (navFinder) navFinder.addEventListener('click', () => { navFinder.classList.add('active-nav'); showView('finderScreen'); });

  // Admin navigation
  const navAdminOwners = $('navAdminOwners');
  const navAdminPets = $('navAdminPets');
  const navAdminScans = $('navAdminScans');
  const navAdminQrStatus = $('navAdminQrStatus');
  const navAdminPanel = $('navAdminPanel');
  if (navAdminOwners) navAdminOwners.addEventListener('click', async () => { navAdminOwners.classList.add('active-nav'); showView('adminOwnersScreen'); await renderAdminOwners(true); });
  if (navAdminPets) navAdminPets.addEventListener('click', async () => { navAdminPets.classList.add('active-nav'); showView('adminPetsScreen'); await renderAdminRegisteredPets(true); });
  if (navAdminScans) navAdminScans.addEventListener('click', async () => { navAdminScans.classList.add('active-nav'); showView('adminScansScreen'); await renderAdminScanHistory(true); });
  if (navAdminQrStatus) navAdminQrStatus.addEventListener('click', async () => { navAdminQrStatus.classList.add('active-nav'); showView('adminQrStatusScreen'); await renderAdminQrStatus(); });
  if (navAdminPanel) navAdminPanel.addEventListener('click', () => { navAdminPanel.classList.add('active-nav'); renderAdminPanel(); });

  // Admin QR codes view
  const btnQrAvailable = $('btnQrAvailable');
  const btnQrAll = $('btnQrAll');
  if (btnQrAvailable) btnQrAvailable.addEventListener('click', async () => await renderAdminQrCodes(true));
  if (btnQrAll) btnQrAll.addEventListener('click', async () => await renderAdminQrCodes(false));
  const btnGenerateMore = $('btnGenerateMore');
  if (btnGenerateMore) btnGenerateMore.addEventListener('click', async () => {
    const count = parseInt($('batchCount').value, 10) || 1;
    await generateQrCodeBatch(count);
  });

  $('btnAddPet').addEventListener('click', () => beginPetRegistration());
  $('cancelPetForm').addEventListener('click', () => { showView('dashboardScreen'); renderUserDashboard(); });
  $('btnScanPetQr').addEventListener('click', () => launchQrScanner('pet'));
  $('petForm').addEventListener('submit', submitPetForm);
  const petPhotoFile = $('petPhotoFile');
  if (petPhotoFile) {
    petPhotoFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      const preview = $('petPhotoPreview');
      const hidden = $('petPhoto');
      if (!file) {
        if (preview) preview.src = '';
        if (hidden) hidden.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function (ev) {
        if (preview) preview.src = ev.target.result;
        if (hidden) hidden.value = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  $('finderLookUp').addEventListener('click', handleFinderLookup);
  $('finderScan').addEventListener('click', () => launchQrScanner('finder'));
  $('finderBack').addEventListener('click', () => showView('dashboardScreen'));
  $('historyBack').addEventListener('click', () => showView('dashboardScreen'));
  // admin controls for recent / all views
  const btnOwnersRecent = $('btnOwnersRecent');
  const btnOwnersAll = $('btnOwnersAll');
  if (btnOwnersRecent) btnOwnersRecent.addEventListener('click', async () => await renderAdminOwners(true));
  if (btnOwnersAll) btnOwnersAll.addEventListener('click', async () => await renderAdminOwners(false));
  const btnPetsRecent = $('btnPetsRecent');
  const btnPetsAll = $('btnPetsAll');
  if (btnPetsRecent) btnPetsRecent.addEventListener('click', async () => await renderAdminRegisteredPets(true));
  if (btnPetsAll) btnPetsAll.addEventListener('click', async () => await renderAdminRegisteredPets(false));
  const btnScansRecent = $('btnScansRecent');
  const btnScansAll = $('btnScansAll');
  if (btnScansRecent) btnScansRecent.addEventListener('click', async () => await renderAdminScanHistory(true));
  if (btnScansAll) btnScansAll.addEventListener('click', async () => await renderAdminScanHistory(false));
  $('btnGenerateBatch').addEventListener('click', async () => {
    const count = parseInt($('batchCount').value, 10) || 1;
    await generateQrCodeBatch(count);
  });
  const btnSendWelcomeAll = $('btnSendWelcomeAll');
  if (btnSendWelcomeAll) btnSendWelcomeAll.addEventListener('click', async () => {
    if (!confirm(`Send welcome emails to all registered users? This may take a moment.`)) return;
    await sendWelcomeEmailsToAll();
  });

  // Forgot password UI events
  const showForgotPassword = $('showForgotPassword');
  const backToLoginForm = $('backToLoginForm');
  const backToLoginLink = $('backToLoginLink');
  const btnSendVerificationCode = $('btnSendVerificationCode');
  const btnVerifyCode = $('btnVerifyCode');
  const resendCode = $('resendCode');
  const btnResetPassword = $('btnResetPassword');
  const toggleForgotNew = $('toggleForgotNew');
  const toggleForgotConfirm = $('toggleForgotConfirm');

  if (showForgotPassword) showForgotPassword.addEventListener('click', (e) => { e.preventDefault(); toggleLoginState('forgot'); });
  if (backToLoginForm) backToLoginForm.addEventListener('click', () => toggleLoginState('form'));
  if (backToLoginLink) backToLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleLoginState('form'); });
  if (btnSendVerificationCode) btnSendVerificationCode.addEventListener('click', sendVerificationCode);
  if (btnVerifyCode) btnVerifyCode.addEventListener('click', (e) => { e.preventDefault(); verifyCode(); });
  if (resendCode) resendCode.addEventListener('click', (e) => {
    e.preventDefault();
    if (forgotPasswordCountdownInterval) {
      clearInterval(forgotPasswordCountdownInterval);
      forgotPasswordCountdownInterval = null;
    }
    if ($('forgotVerificationCode')) $('forgotVerificationCode').value = '';
    sendVerificationCode();
  });
  if (btnResetPassword) btnResetPassword.addEventListener('click', resetPassword);
  if (toggleForgotNew) toggleForgotNew.addEventListener('click', () => {
    const input = $('forgotNewPassword');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    toggleForgotNew.textContent = input.type === 'password' ? '👁' : '🙈';
  });
  if (toggleForgotConfirm) toggleForgotConfirm.addEventListener('click', () => {
    const input = $('forgotConfirmPassword');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    toggleForgotConfirm.textContent = input.type === 'password' ? '👁' : '🙈';
  });

  const fpPw = $('forgotNewPassword');
  if (fpPw) {
    fpPw.addEventListener('input', () => {
      const val = fpPw.value;
      const update = (id, test) => {
        const el = $(id);
        if (!el) return;
        el.style.color = test ? 'green' : 'red';
        el.textContent = (test ? '✓' : '✗') + el.textContent.slice(1);
      };
      update('fp-req-length', val.length >= 8);
      update('fp-req-upper', /[A-Z]/.test(val));
      update('fp-req-number', /[0-9]/.test(val));
      update('fp-req-special', /[!@#$%^&*]/.test(val));
    });
  }
}

async function init() {
  // Restore session from storage on page load
  STATE.isAdmin = false;
  loadSession();

  setNavigation();
  await initializeStorage();
  await autoLoginFromHash();
  await prepareQrBaseUrl();
  initGoogleSignIn();
  attachEvents();
  await routeToView();
  window.addEventListener('hashchange', () => routeToView());
}

init();
