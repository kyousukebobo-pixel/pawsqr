const STATE = {
  currentUser: null,
  currentQrVerification: null,
  pendingQrCode: null,
  finderScanner: null,
  petScanner: null,
  loginScanner: null,
};

const MASTER_ADMIN = {
  name: 'Master Admin',
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

// Third-party Provider IDs (set these in production)
// Google OAuth2 Configuration
// Replace with your actual Google Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = '540931981374-205a6qbbrte6lhulq32g5gcqt1adop3c.apps.googleusercontent.com';
// NOTE: For production, store CLIENT_ID securely and use backend validation of tokens

let QR_BASE_URL = '';

function $(id) {
  return document.getElementById(id);
}

// Supabase data access functions
async function loadData(table) {
  try {
    const { data, error } = await db.from(table).select('*');
    if (error) {
      console.error(`Error loading ${table}:`, error);
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
  try {
    // Check if admin exists
    const users = await loadData('users');
    const existingAdmin = users.find((user) => user.role === 'admin');
    if (!existingAdmin) {
      await saveData('users', MASTER_ADMIN);
    }
  } catch (err) {
    console.error('Error initializing storage:', err);
  }
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

async function renderUserDashboard() {
  const pets = await loadData('pets');
  const qrCodes = await loadData('qr_codes');
  const myPets = pets.filter((pet) => pet.owner_id === STATE.currentUser.id);
  const myCodes = qrCodes.filter((qr) => qr.status === 'assigned' && myPets.some((pet) => pet.qr_code_id === qr.id));
  const userQrList = $('userQrList');
  const petCardList = $('petCardList');
  userQrList.innerHTML = '';
  petCardList.innerHTML = '';

  if (!myCodes.length) {
    userQrList.innerHTML = '<p>No assigned collars yet. Register a pet after scanning a QR code.</p>';
  }

  myCodes.forEach((qr) => {
    const container = document.createElement('div');
    createQRCodeElement(container, qr.code, `Collar ${qr.label || qr.id}`);
    const notice = document.createElement('small');
    notice.textContent = 'Assigned to your pet';
    container.querySelector('button').before(notice);
    userQrList.appendChild(container);
  });

  if (!myPets.length) {
    petCardList.innerHTML = '<p>You have no registered pets yet.</p>';
  }

  myPets.forEach((pet) => {
    const card = document.createElement('div');
    card.className = 'pet-card';
    const image = document.createElement('img');
    image.src = pet.photo;
    image.alt = pet.name;
    const title = document.createElement('h4');
    title.textContent = pet.name;
    const details = document.createElement('p');
    details.innerHTML = `<strong>Breed:</strong> ${pet.breed}<br><strong>Age:</strong> ${pet.age}`;
    const label = document.createElement('small');
    const code = qrCodes.find((qr) => qr.id === pet.qr_code_id);
    label.textContent = `Collar: ${code ? code.code : 'Not assigned'}`;
    const health = document.createElement('p');
    health.innerHTML = `<strong>Allergies:</strong> ${pet.allergies || 'None'}<br><strong>Medications:</strong> ${pet.medications || 'None'}<br><strong>Immunizations:</strong> ${pet.immunizations || 'Unspecified'}`;
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    const editButton = document.createElement('button');
    editButton.className = 'primary';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => editPet(pet.id));
    const printButton = document.createElement('button');
    printButton.className = 'secondary';
    printButton.textContent = 'Print Profile';
    printButton.addEventListener('click', () => {
      const win = window.open('', '_blank');
      win.document.write('<html><head><title>Pet Profile</title><style>body{font-family:sans-serif;padding:24px;}img{max-width:100%;border-radius:16px;} h1,h2{margin-top:0;}</style></head><body>');
      win.document.write(`<h1>${pet.name}</h1><img src="${pet.photo}" alt="${pet.name}"/><p><strong>Breed:</strong> ${pet.breed}</p><p><strong>Age:</strong> ${pet.age}</p><p><strong>Characteristics:</strong> ${pet.characteristics}</p><p><strong>Allergies:</strong> ${pet.allergies || 'None'}</p><p><strong>Medications:</strong> ${pet.medications || 'None'}</p><p><strong>Immunizations:</strong> ${pet.immunizations || 'Unspecified'}</p><p><strong>Collar ID:</strong> ${code ? code.code : 'Not assigned'}</p>`);
      win.document.write('</body></html>');
      win.document.close();
      win.print();
    });
    actions.append(editButton, printButton);
    card.append(image, title, details, label, health, actions);
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
    title.textContent = u.name;
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
    const title = document.createElement('h4');
    title.textContent = pet.name;
    const owner = users.find(u => u.id === pet.owner_id);
    const details = document.createElement('p');
    details.innerHTML = `<strong>Owner:</strong> ${owner ? owner.name : 'Unknown'}<br><strong>Breed:</strong> ${pet.breed}<br><strong>Age:</strong> ${pet.age}`;
    card.append(image, title, details);
    container.appendChild(card);
  });
}

async function renderAdminScanHistory(recentOnly = false) {
  const history = (await loadData('scan_history')).slice().reverse();
  const users = await loadData('users');
  const pets = await loadData('pets');
  const container = $('adminScanHistory');
  if (!container) return;
  container.innerHTML = '';
  const scans = history.filter(h => /(scan|finder|lookup)/i.test(h.action) || /(scan)/i.test(h.action));
  const items = recentOnly ? scans.slice(0, 12) : scans;
  if (!items.length) {
    container.innerHTML = '<p>No scan records available.</p>';
    return;
  }
  items.forEach((event) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const user = users.find(u => u.id === event.user_id);
    const pet = pets.find(p => p.id === event.pet_id);
    const title = document.createElement('h4');
    title.textContent = `${event.action}`;
    const details = document.createElement('p');
    details.innerHTML = `<strong>User:</strong> ${user ? user.name : 'Unknown'}<br><strong>Pet:</strong> ${pet ? pet.name : 'N/A'}<br><strong>QR:</strong> ${event.qr_code_text}<br><strong>Time:</strong> ${new Date(event.created_at).toLocaleString()}`;
    card.append(title, details);
    container.appendChild(card);
  });
}

async function renderAdminQrCodes(availableOnly = false) {
  const qrCodes = (await loadData('qr_codes')).slice().reverse();
  const container = $('adminQrCodesList');
  if (!container) return;
  container.innerHTML = '';
  const items = availableOnly ? qrCodes.filter(qr => qr.status === 'available') : qrCodes;
  if (!items.length) {
    container.innerHTML = '<p>No QR codes available.</p>';
    return;
  }
  items.forEach((qr) => {
    const cardContainer = document.createElement('div');
    cardContainer.style.display = 'flex';
    cardContainer.style.flexDirection = 'column';
    cardContainer.style.gap = '8px';
    createQRCodeElement(cardContainer, qr.code, `Collar ${qr.label || qr.code}`);
    const statusBadge = document.createElement('small');
    statusBadge.style.padding = '4px 8px';
    statusBadge.style.borderRadius = '4px';
    statusBadge.style.fontSize = '12px';
    statusBadge.style.fontWeight = '600';
    if (qr.status === 'available') {
      statusBadge.textContent = '✓ Available';
      statusBadge.style.backgroundColor = '#d4edda';
      statusBadge.style.color = '#155724';
    } else {
      statusBadge.textContent = '✓ Assigned';
      statusBadge.style.backgroundColor = '#e2e3e5';
      statusBadge.style.color = '#383d41';
    }
    cardContainer.appendChild(statusBadge);
    container.appendChild(cardContainer);
  });
}

async function renderAdminQrStatus() {
  const qrCodes = await loadData('qr_codes');
  const pets = await loadData('pets');
  const users = await loadData('users');
  const history = await loadData('scan_history');

  // Count statuses
  const statusCounts = {
    active: 0,        // assigned
    unassigned: 0,    // available
    deactivated: 0,
    lost: 0,
  };

  qrCodes.forEach((qr) => {
    if (qr.status === 'assigned') {
      statusCounts.active += 1;
    } else if (qr.status === 'available') {
      statusCounts.unassigned += 1;
    } else if (qr.status === 'deactivated') {
      statusCounts.deactivated += 1;
    } else if (qr.status === 'lost') {
      statusCounts.lost += 1;
    }
  });

  const totalCollars = qrCodes.length;

  // Render progress bar
  const progressBar = $('qrProgressBar');
  progressBar.innerHTML = '';
  if (totalCollars > 0) {
    const statusOrder = ['active', 'unassigned', 'deactivated', 'lost'];
    statusOrder.forEach((status) => {
      const count = statusCounts[status];
      if (count > 0) {
        const percentage = (count / totalCollars) * 100;
        const segment = document.createElement('div');
        segment.className = `progress-segment ${status}`;
        segment.style.width = `${percentage}%`;
        segment.textContent = `${count}`;
        progressBar.appendChild(segment);
      }
    });
  }

  // Render legend
  const legendContainer = $('qrProgressLegend');
  legendContainer.innerHTML = '';
  const legendItems = [
    { label: '🟢 Active / Assigned', status: 'active', count: statusCounts.active },
    { label: '🟠 Unassigned', status: 'unassigned', count: statusCounts.unassigned },
    { label: '⚫ Deactivated', status: 'deactivated', count: statusCounts.deactivated },
    { label: '🔴 Lost Status', status: 'lost', count: statusCounts.lost },
  ];

  legendItems.forEach((item) => {
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    const dot = document.createElement('div');
    dot.className = `legend-dot ${item.status}`;
    const text = document.createElement('div');
    text.className = 'legend-text';
    const label = document.createElement('span');
    label.textContent = item.label;
    const count = document.createElement('span');
    count.style.fontWeight = '700';
    const pct = totalCollars > 0 ? ((item.count / totalCollars) * 100).toFixed(1) : 0;
    count.textContent = `${item.count} (${pct}%)`;
    text.append(label, count);
    legendItem.append(dot, text);
    legendContainer.appendChild(legendItem);
  });

  // Add total collars item
  const totalItem = document.createElement('div');
  totalItem.className = 'legend-item';
  const totalLabel = document.createElement('span');
  totalLabel.style.fontWeight = '700';
  totalLabel.textContent = 'Total Collars';
  const totalCount = document.createElement('span');
  totalCount.style.fontWeight = '700';
  totalCount.textContent = totalCollars.toString();
  totalItem.append(totalLabel, totalCount);
  legendContainer.appendChild(totalItem);

  // Render table
  const tableBody = $('qrStatusTableBody');
  tableBody.innerHTML = '';

  if (!qrCodes.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5" style="text-align:center;padding:20px;">No QR codes found.</td>';
    tableBody.appendChild(row);
    return;
  }

  qrCodes.forEach((qr) => {
    const row = document.createElement('tr');
    
    // CODE ID
    const codeCell = document.createElement('td');
    codeCell.textContent = qr.code;
    codeCell.style.fontWeight = '600';
    
    // STATUS
    const statusCell = document.createElement('td');
    const statusText = qr.status === 'assigned' ? 'Active' : 
                       qr.status === 'available' ? 'Unassigned' :
                       qr.status === 'deactivated' ? 'Deactivated' :
                       qr.status === 'lost' ? 'Lost Status' : qr.status;
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${qr.status === 'assigned' ? 'active' : qr.status === 'available' ? 'unassigned' : qr.status}`;
    statusBadge.textContent = statusText;
    statusCell.appendChild(statusBadge);
    
    // ASSIGNED PET
    const petCell = document.createElement('td');
    if (qr.pet_id) {
      const pet = pets.find((p) => p.id === qr.pet_id);
      petCell.textContent = pet ? pet.name : 'N/A';
    } else {
      petCell.textContent = '—';
      petCell.style.color = '#999';
    }
    
    // OWNER
    const ownerCell = document.createElement('td');
    if (qr.pet_id) {
      const pet = pets.find((p) => p.id === qr.pet_id);
      if (pet) {
        const owner = users.find((u) => u.id === pet.owner_id);
        ownerCell.textContent = owner ? owner.name : 'Unknown';
      } else {
        ownerCell.textContent = '—';
        ownerCell.style.color = '#999';
      }
    } else {
      ownerCell.textContent = '—';
      ownerCell.style.color = '#999';
    }
    
    // SCANS
    const scansCell = document.createElement('td');
    const scanCount = history.filter((h) => h.qr_code_text === qr.code).length;
    scansCell.textContent = scanCount.toString();
    scansCell.style.fontWeight = '600';
    
    row.append(codeCell, statusCell, petCell, ownerCell, scansCell);
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
          STATE.currentUser = user;
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
          const newUser = {
            name,
            email: email.toLowerCase(),
            phone,
            password: fakePassword,
            role: 'user',
            provider: 'google',
            picture,
          };

          const savedUser = await saveData('users', newUser);
          STATE.currentUser = savedUser;
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
  localStorage.setItem('petnet_session', JSON.stringify(user));
}

function loadSession() {
  const raw = localStorage.getItem('petnet_session');
  if (raw) {
    const user = JSON.parse(raw);
    // Only load from localStorage for session persistence
    // For fresh data, the user needs to log in
    STATE.currentUser = user;
  }
}

async function seedDemoData(user) {
  const qrCodes = await loadData('qr_codes');
  const pets = await loadData('pets');
  if (qrCodes.length === 0) {
    await saveData('qr_codes', { code: 'PN-DEMO-QR-0001', label: 'Collar 001', status: 'assigned', pet_id: 'pet-demo-1', created_at: new Date().toISOString() });
    await saveData('qr_codes', { code: 'PN-DEMO-QR-0002', label: 'Collar 002', status: 'available', pet_id: null, created_at: new Date().toISOString() });
  }
  if (user && pets.length === 0) {
    await saveData('pets', { owner_id: user.id, name: 'Luna', age: '2 years', breed: 'Siamese', photo: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80', characteristics: 'Blue eyes, white paws, small scar on ear', allergies: 'None', medications: 'None', immunizations: 'Up to date', qr_code_id: 'qr-demo-1', created_at: new Date().toISOString() });
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
        name: 'Demo PetOwner',
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
    STATE.currentUser = MASTER_ADMIN;
    setNavigation();
    renderAdminPanel();
    return;
  }

  const { data, error } = await db.from('users').select('*').eq('email', email).single();

  if (error || !data) {
    alert('No account found for that email.');
    return;
  }

  if (data.password !== password) {
    alert('Incorrect password.');
    return;
  }

  STATE.currentUser = data;
  setNavigation();
  routeAfterLogin();
}

async function registerUser() {
  const firstName = document.getElementById('createFirstName').value.trim();
  const middleName = document.getElementById('createMiddleName').value.trim();
  const lastName = document.getElementById('createLastName').value.trim();
  const suffix = document.getElementById('createSuffix').value.trim();
  const email = document.getElementById('createEmail').value.trim();
  const phone = document.getElementById('createPhone').value.trim();
  const password = document.getElementById('createPassword').value;

  const { data, error } = await db.from('users').insert([{
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    suffix: suffix,
    email: email,
    phone: phone,
    password: password,
    role: 'user',
    provider: 'local'
  }]).select().single();

  if (error) {
    alert('Registration failed: ' + error.message);
    return;
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
  localStorage.removeItem('petnet_session');
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
  $('petFormTitle').textContent = editPet ? 'Edit Pet Profile' : 'Register Pet';
  $('petForm').reset();
  $('scannerStatus').textContent = 'No QR code scanned yet.';
  $('petQrCode').value = '';
  STATE.currentQrVerification = null;
  $('scannerContainer').classList.add('hidden');
  if (editPet) {
    $('editingPetId').value = editPet.id;
    $('petName').value = editPet.name;
    $('petAge').value = editPet.age;
    $('petBreed').value = editPet.breed;
    $('petPhoto').value = editPet.photo;
    $('petCharacteristics').value = editPet.characteristics;
    $('petAllergies').value = editPet.allergies;
    $('petMedications').value = editPet.medications;
    $('petImmunizations').value = editPet.immunizations;
    if (editPet.qr_code_id) {
      const qrs = await loadData('qr_codes');
      const qr = qrs.find((code) => code.id === editPet.qr_code_id);
      if (qr) {
        $('petQrCode').value = qr.code;
        STATE.currentQrVerification = qr;
        $('scannerStatus').textContent = `QR collar already assigned: ${qr.code}`;
      }
    }
  } else {
    $('editingPetId').value = '';
    if (preVerifiedQr) {
      STATE.currentQrVerification = preVerifiedQr;
      $('petQrCode').value = preVerifiedQr.code;
      $('scannerStatus').textContent = `QR code verified: ${preVerifiedQr.code}`;
    }
  }
  showView('petFormScreen');
}

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
            handlePetQrScanned(decodedText, html5QrCode, container);
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

function handlePetQrScanned(decodedText, scannerInstance, container) {
  // Stop the scanner immediately
  scannerInstance.stop()
    .then(() => {
      scannerInstance.clear().catch(() => {});
      STATE.petScanner = null;
      container.classList.add('hidden');
      
      // Extract code from URL and verify
      handlePetQrVerification(decodedText);
    })
    .catch(() => {
      scannerInstance.clear().catch(() => {});
      STATE.petScanner = null;
      container.classList.add('hidden');
      
      // Still verify even if stop failed
      handlePetQrVerification(decodedText);
    });
}

async function handlePetQrVerification(decodedText) {
  // Extract code from URL if it contains ?qr=
  let scannedCode = decodedText.trim();
  if (scannedCode.includes('?qr=')) {
    try {
      scannedCode = new URL(scannedCode).searchParams.get('qr');
    } catch (e) {
      // If URL parsing fails, try regex
      const match = scannedCode.match(/[?&]qr=([^&]+)/);
      scannedCode = match ? decodeURIComponent(match[1]) : decodedText.trim();
    }
  }
  
  // Look up the code in Supabase
  const qrCodes = await loadData('qr_codes');
  let qrRecord = qrCodes.find(q => q.code === scannedCode || q.id === scannedCode);
  
  // If NOT found in Supabase, create it on the spot
  if (!qrRecord) {
    qrRecord = {
      code: scannedCode,
      label: `Collar ${qrCodes.length + 1}`,
      status: 'available',
      pet_id: null,
      created_at: new Date().toISOString(),
    };
    const savedQr = await saveData('qr_codes', qrRecord);
    qrRecord = savedQr;
  }
  
  // Set the verification and update the UI
  STATE.currentQrVerification = qrRecord;
  $('petQrCode').value = scannedCode;
  $('scannerStatus').textContent = `QR Code scanned: ${scannedCode}`;
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
    qrCode = {
      code: normalized,
      label: `Collar ${qrCodes.length + 1}`,
      status: 'available',
      pet_id: null,
      created_at: new Date().toISOString(),
    };
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
    <img src="${pet.photo}" alt="${pet.name}" style="width:100%;border-radius:16px;margin-bottom:12px;max-height:260px;object-fit:cover;" />
    <p><strong>Breed:</strong> ${pet.breed}</p>
    <p><strong>Age:</strong> ${pet.age}</p>
    <p><strong>Characteristics:</strong> ${pet.characteristics}</p>
    <p><strong>Allergies:</strong> ${pet.allergies || 'None'}<br><strong>Medications:</strong> ${pet.medications || 'None'}<br><strong>Immunizations:</strong> ${pet.immunizations || 'Unspecified'}</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;">
      <a class="primary" href="tel:${owner.phone}" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Call Owner</a>
      <a class="secondary" href="mailto:${owner.email}?subject=Found%20${encodeURIComponent(pet.name)}" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Email Owner</a>
    </div>
  `;
  await recordHistory({ action: 'Finder lookup', user_id: owner.id, pet_id: pet.id, qr_code_text: qrCode.code });
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
  const petImmunizations = $('petImmunizations').value.trim();
  const editingId = $('editingPetId').value;

  if (!STATE.currentQrVerification) {
    alert('You must scan and verify a unique collar QR code before registering or updating a pet.');
    return;
  }

  const pets = await loadData('pets');
  const qrCodes = await loadData('qr_codes');
  const qr = qrCodes.find((code) => code.id === STATE.currentQrVerification.id);
  if (!qr || qr.status === 'assigned') {
    showMessage('The QR code is no longer available. Please scan a new one.');
    return;
  }

  if (editingId) {
    const existingPet = pets.find((p) => p.id === editingId);
    if (!existingPet) {
      showMessage('Pet not found.');
      return;
    }
    await updateData('pets', editingId, {
      name: petName,
      age: petAge,
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
  const qrCodes = await loadData('qr_codes');
  const generatedCodes = [];
  for (let i = 0; i < count; i += 1) {
    const code = secureRandomCode();
    const qrRecord = { code, label: `Collar ${qrCodes.length + i + 1}`, status: 'available', pet_id: null, created_at: new Date().toISOString() };
    await saveData('qr_codes', qrRecord);
    generatedCodes.push(qrRecord);
  }
  
  // Navigate to the QR codes display screen
  showView('adminQrCodesScreen');
  await renderAdminQrCodes(false);
  
  // Show confirmation message
  showMessage(`Successfully generated ${count} new collar QR code(s). They are ready for printing and distribution.`);
}

async function showHistoryView() {
  const historyList = $('historyList');
  const history = await loadData('scan_history');
  const userHistory = history.filter((record) => record.user_id === STATE.currentUser.id);
  historyList.innerHTML = '';
  if (!userHistory.length) {
    historyList.innerHTML = '<p>No scan history yet.</p>';
  }
  userHistory.slice().reverse().forEach((event) => {
    const item = document.createElement('div');
    item.className = 'history-card';
    const title = document.createElement('h4');
    title.textContent = event.action;
    const note = document.createElement('p');
    note.innerHTML = `<strong>QR:</strong> ${event.qr_code_text}<br><strong>Time:</strong> ${new Date(event.created_at).toLocaleString()}`;
    item.append(title, note);
    historyList.appendChild(item);
  });
}

function toggleLoginState(state) {
  const welcomeState = $('loginWelcomeState');
  const formState = $('loginFormState');
  
  if (state === 'welcome') {
    if (welcomeState) welcomeState.classList.remove('hidden');
    if (formState) formState.classList.add('hidden');
  } else if (state === 'form') {
    if (welcomeState) welcomeState.classList.add('hidden');
    if (formState) formState.classList.remove('hidden');
  }
}

function attachEvents() {
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
  $('btnScanQr').addEventListener('click', () => launchQrScanner('pet'));
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
}

async function init() {
  // Clear session on page load - users must log in fresh each time
  STATE.currentUser = null;
  STATE.isAdmin = false;

  await initializeStorage();
  setNavigation();
  await autoLoginFromHash();
  await prepareQrBaseUrl();
  initGoogleSignIn();
  attachEvents();
  await routeToView();
  window.addEventListener('hashchange', () => routeToView());
}

init();
