const SUPABASE_URL = 'https://sbkkdtfdhvikhfdbhsbx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2tkdGZkaHZpa2hmZGJoc2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1OTk3NDUsImV4cCI6MjA5NTE3NTc0NX0.E-v0T9hbvRMWBOSjXOgHKSYRE3RgPnvcEtkQ9GJC1gA';
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== STATE =====
const STATE = {
  currentUser: null,
  currentQrVerification: null,
  pendingQrCode: null,
  finderScanner: null,
  petScanner: null,
  loginScanner: null,
};

// Master admin (kept in code, not in database)
const MASTER_ADMIN = {
  id: 'admin-1',
  name: 'Master Admin',
  email: 'admin@petnetwork.com',
  password: 'MasterAdmin!2026',
  role: 'admin',
  provider: 'local',
  phone: '+1-800-555-0101',
};

// Google OAuth2 Configuration
const GOOGLE_CLIENT_ID = '540931981374-205a6qbbrte6lhulq32g5gcqt1adop3c.apps.googleusercontent.com';

let QR_BASE_URL = '';

// ===== UTILITY FUNCTIONS =====
function $(id) {
  return document.getElementById(id);
}

function showMessage(message) {
  alert(message);
}

// ===== SUPABASE DATA HELPERS =====
async function getUsers() {
  const { data, error } = await supabaseClient.from('users').select('*');
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data.map(user => ({
    ...user,
    // Convert snake_case to camelCase for compatibility
    firstName: user.first_name,
    middleName: user.middle_name,
    lastName: user.last_name,
  }));
}

async function getUserByEmail(email) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching user:', error);
    return null;
  }
  if (!data) return null;
  
  return {
    ...data,
    firstName: data.first_name,
    middleName: data.middle_name,
    lastName: data.last_name,
  };
}

async function saveUser(user) {
  const { data, error } = await supabaseClient
    .from('users')
    .insert([{
      id: user.id,
      first_name: user.firstName || '',
      middle_name: user.middleName || '',
      last_name: user.lastName || '',
      suffix: user.suffix || '',
      email: user.email,
      phone: user.phone,
      password: user.password,
      role: user.role,
      provider: user.provider,
    }])
    .select();
  
  if (error) {
    console.error('Error saving user:', error);
    throw error;
  }
  return data;
}

async function getPets() {
  const { data, error } = await supabaseClient.from('pets').select('*');
  if (error) {
    console.error('Error fetching pets:', error);
    return [];
  }
  return data.map(pet => ({
    ...pet,
    ownerId: pet.owner_id,
    qrCodeId: pet.qr_code_id,
  }));
}

async function getUserPets(userId) {
  const { data, error } = await supabaseClient
    .from('pets')
    .select('*')
    .eq('owner_id', userId);
  
  if (error) {
    console.error('Error fetching user pets:', error);
    return [];
  }
  return data.map(pet => ({
    ...pet,
    ownerId: pet.owner_id,
    qrCodeId: pet.qr_code_id,
  }));
}

async function savePet(pet) {
  const petData = {
    id: pet.id,
    owner_id: pet.ownerId,
    name: pet.name,
    age: pet.age,
    breed: pet.breed,
    photo: pet.photo,
    characteristics: pet.characteristics,
    allergies: pet.allergies,
    medications: pet.medications,
    immunizations: pet.immunizations,
    qr_code_id: pet.qrCodeId,
    created_at: pet.createdAt,
  };

  const { data, error } = await supabaseClient
    .from('pets')
    .insert([petData])
    .select();
  
  if (error) {
    console.error('Error saving pet:', error);
    throw error;
  }
  return data;
}

async function updatePet(petId, updates) {
  const updateData = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.age) updateData.age = updates.age;
  if (updates.breed) updateData.breed = updates.breed;
  if (updates.photo) updateData.photo = updates.photo;
  if (updates.characteristics) updateData.characteristics = updates.characteristics;
  if (updates.allergies) updateData.allergies = updates.allergies;
  if (updates.medications) updateData.medications = updates.medications;
  if (updates.immunizations) updateData.immunizations = updates.immunizations;
  if (updates.qrCodeId) updateData.qr_code_id = updates.qrCodeId;

  const { data, error } = await supabaseClient
    .from('pets')
    .update(updateData)
    .eq('id', petId)
    .select();
  
  if (error) {
    console.error('Error updating pet:', error);
    throw error;
  }
  return data;
}

async function getQrCodes() {
  const { data, error } = await supabaseClient.from('qr_codes').select('*');
  if (error) {
    console.error('Error fetching QR codes:', error);
    return [];
  }
  return data.map(qr => ({
    ...qr,
    petId: qr.pet_id,
  }));
}

async function getQrCodeByCode(code) {
  const { data, error } = await supabaseClient
    .from('qr_codes')
    .select('*')
    .eq('code', code)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching QR code:', error);
    return null;
  }
  if (!data) return null;
  
  return {
    ...data,
    petId: data.pet_id,
  };
}

async function saveQrCode(qr) {
  const { data, error } = await supabaseClient
    .from('qr_codes')
    .insert([{
      id: qr.id,
      code: qr.code,
      label: qr.label || null,
      status: qr.status,
      pet_id: qr.petId || null,
      created_at: qr.createdAt,
    }])
    .select();
  
  if (error) {
    console.error('Error saving QR code:', error);
    throw error;
  }
  return data;
}

async function updateQrCode(qrId, updates) {
  const updateData = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.petId !== undefined) updateData.pet_id = updates.petId;
  if (updates.label) updateData.label = updates.label;

  const { data, error } = await supabaseClient
    .from('qr_codes')
    .update(updateData)
    .eq('id', qrId)
    .select();
  
  if (error) {
    console.error('Error updating QR code:', error);
    throw error;
  }
  return data;
}

async function getScanHistory() {
  const { data, error } = await supabaseClient.from('scan_history').select('*');
  if (error) {
    console.error('Error fetching scan history:', error);
    return [];
  }
  return data;
}

async function saveScanHistory(entry) {
  const { data, error } = await supabaseClient
    .from('scan_history')
    .insert([{
      id: entry.id,
      qr_code_id: entry.qrCodeId,
      scanned_by: entry.userId,
      location: entry.action || null,
      scanned_at: entry.timestamp,
    }])
    .select();
  
  if (error) {
    console.error('Error saving scan history:', error);
    throw error;
  }
  return data;
}

// ===== CORE FUNCTIONS =====
async function initializeStorage() {
  // Check if admin exists in database
  const adminUser = await getUserByEmail(MASTER_ADMIN.email);
  if (!adminUser) {
    // Insert master admin
    await saveUser({
      id: MASTER_ADMIN.id,
      firstName: 'Master',
      middleName: '',
      lastName: 'Admin',
      suffix: '',
      email: MASTER_ADMIN.email,
      phone: MASTER_ADMIN.phone,
      password: MASTER_ADMIN.password,
      role: MASTER_ADMIN.role,
      provider: MASTER_ADMIN.provider,
    });
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
  
  document.querySelectorAll('.top-nav button').forEach((btn) => {
    btn.classList.remove('active-nav');
  });
}

function setNavigation() {
  const userNav = $('userNav');
  const adminNav = $('adminNav');
  if (!STATE.currentUser) {
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
    if (adminNav) {
      adminNav.classList.remove('hidden');
      adminNav.style.display = 'flex';
    }
    if (userNav) {
      userNav.classList.add('hidden');
      userNav.style.display = 'none';
    }
  } else {
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
  if (window.PETNET_BASE_URL) {
    QR_BASE_URL = window.PETNET_BASE_URL.replace(/\/$/, '');
    return;
  }

  const origin = window.location.origin || '';
  if (origin && !isLocalHost(origin) && !origin.includes('.local')) {
    QR_BASE_URL = origin;
    return;
  }

  const localIps = await getLocalIpCandidates();
  const fallbackIp = localIps.find((ip) => ip && !ip.startsWith('127.') && !ip.startsWith('169.') && !ip.includes(':'));
  if (fallbackIp) {
    const port = window.location.port ? `:${window.location.port}` : '';
    QR_BASE_URL = `${window.location.protocol}//${fallbackIp}${port}`;
    return;
  }

  QR_BASE_URL = '';
  console.warn('QR_BASE_URL not set. For mobile scanning, set window.PETNET_BASE_URL to an accessible URL.');
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
  const pets = await getPets();
  const qrCodes = await getQrCodes();
  const myPets = pets.filter((pet) => pet.ownerId === STATE.currentUser.id);
  const myCodes = qrCodes.filter((qr) => qr.status === 'assigned' && myPets.some((pet) => pet.qrCodeId === qr.id));
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
    const matchingQr = qrCodes.find((qr) => qr.id === pet.qrCodeId);
    label.textContent = `Collar: ${matchingQr ? matchingQr.code : 'Not assigned'}`;
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
      win.document.write(`<h1>${pet.name}</h1><img src="${pet.photo}" alt="${pet.name}"/><p><strong>Breed:</strong> ${pet.breed}</p><p><strong>Age:</strong> ${pet.age}</p><p><strong>Characteristics:</strong> ${pet.characteristics}</p><p><strong>Allergies:</strong> ${pet.allergies || 'None'}</p><p><strong>Medications:</strong> ${pet.medications || 'None'}</p><p><strong>Immunizations:</strong> ${pet.immunizations || 'Unspecified'}</p><p><strong>Collar ID:</strong> ${matchingQr ? matchingQr.code : 'Not assigned'}</p>`);
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
  const users = await getUsers();
  const container = $('adminPetOwners');
  if (!container) return;
  container.innerHTML = '';
  const list = users.filter(u => u.role !== 'admin');
  const items = recentOnly ? list.slice(-8) : list;
  if (!items.length) {
    container.innerHTML = '<p>No registered pet owners yet.</p>';
    return;
  }
  items.forEach((u) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const title = document.createElement('h4');
    title.textContent = u.name || `${u.first_name} ${u.last_name}`;
    const details = document.createElement('p');
    details.innerHTML = `<strong>Email:</strong> ${u.email}<br><strong>Phone:</strong> ${u.phone || 'N/A'}<br><strong>Provider:</strong> ${u.provider || 'local'}<br><strong>Role:</strong> ${u.role}`;
    card.append(title, details);
    container.appendChild(card);
  });
}

async function renderAdminRegisteredPets(recentOnly = false) {
  const pets = await getPets();
  const users = await getUsers();
  const container = $('adminRegisteredPets');
  if (!container) return;
  container.innerHTML = '';
  const items = recentOnly ? pets.slice(-8) : pets;
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
    const owner = users.find(u => u.id === pet.ownerId);
    const details = document.createElement('p');
    details.innerHTML = `<strong>Owner:</strong> ${owner ? owner.name || `${owner.first_name} ${owner.last_name}` : 'Unknown'}<br><strong>Breed:</strong> ${pet.breed}<br><strong>Age:</strong> ${pet.age}`;
    card.append(image, title, details);
    container.appendChild(card);
  });
}

async function renderAdminScanHistory(recentOnly = false) {
  const history = await getScanHistory();
  const users = await getUsers();
  const pets = await getPets();
  const container = $('adminScanHistory');
  if (!container) return;
  container.innerHTML = '';
  const items = recentOnly ? history.slice(-12) : history;
  if (!items.length) {
    container.innerHTML = '<p>No scan records available.</p>';
    return;
  }
  items.forEach((event) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const user = users.find(u => u.id === event.scanned_by);
    const pet = pets.find(p => p.id === event.pet_id);
    const title = document.createElement('h4');
    title.textContent = `${event.location || 'Scan'}`;
    const details = document.createElement('p');
    details.innerHTML = `<strong>User:</strong> ${user ? user.name || `${user.first_name} ${user.last_name}` : 'Unknown'}<br><strong>Pet:</strong> ${pet ? pet.name : 'N/A'}<br><strong>Time:</strong> ${new Date(event.scanned_at).toLocaleString()}`;
    card.append(title, details);
    container.appendChild(card);
  });
}

async function renderAdminQrCodes(availableOnly = false) {
  const qrCodes = await getQrCodes();
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
  const qrCodes = await getQrCodes();
  const pets = await getPets();
  const users = await getUsers();
  const history = await getScanHistory();

  const statusCounts = {
    active: 0,
    unassigned: 0,
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
    
    const codeCell = document.createElement('td');
    codeCell.textContent = qr.code;
    codeCell.style.fontWeight = '600';
    
    const statusCell = document.createElement('td');
    const statusText = qr.status === 'assigned' ? 'Active' : 
                       qr.status === 'available' ? 'Unassigned' :
                       qr.status === 'deactivated' ? 'Deactivated' :
                       qr.status === 'lost' ? 'Lost Status' : qr.status;
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${qr.status === 'assigned' ? 'active' : qr.status === 'available' ? 'unassigned' : qr.status}`;
    statusBadge.textContent = statusText;
    statusCell.appendChild(statusBadge);
    
    const petCell = document.createElement('td');
    if (qr.petId) {
      const pet = pets.find((p) => p.id === qr.petId);
      petCell.textContent = pet ? pet.name : 'N/A';
    } else {
      petCell.textContent = '—';
      petCell.style.color = '#999';
    }
    
    const ownerCell = document.createElement('td');
    if (qr.petId) {
      const pet = pets.find((p) => p.id === qr.petId);
      if (pet) {
        const owner = users.find((u) => u.id === pet.ownerId);
        ownerCell.textContent = owner ? owner.name || `${owner.first_name} ${owner.last_name}` : 'Unknown';
      } else {
        ownerCell.textContent = '—';
        ownerCell.style.color = '#999';
      }
    } else {
      ownerCell.textContent = '—';
      ownerCell.style.color = '#999';
    }
    
    const scansCell = document.createElement('td');
    const scanCount = history.filter((h) => h.qr_code_id === qr.id).length;
    scansCell.textContent = scanCount.toString();
    scansCell.style.fontWeight = '600';
    
    row.append(codeCell, statusCell, petCell, ownerCell, scansCell);
    tableBody.appendChild(row);
  });
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
    if (google.accounts.id.disableAutoSelect) google.accounts.id.disableAutoSelect();

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
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
    const decodedToken = parseJwt(response.credential);
    const email = decodedToken.email;
    const name = decodedToken.name;
    const picture = decodedToken.picture;
    const googleUserId = decodedToken.sub;

    (async () => {
      let user = await getUserByEmail(email);
      if (user) {
        saveCurrentUser(user);
        setNavigation();
        if (user.role === 'admin') {
          renderAdminPanel();
        } else {
          routeAfterLogin();
        }
      } else {
        const phone = prompt('Welcome! Please enter your phone number for owner contact:');
        if (!phone) {
          showMessage('Phone number is required to create an account.');
          return;
        }

        const fakePassword = `google-${googleUserId}`;
        const nameParts = name.split(' ');
        const newUser = {
          id: `user-${Date.now()}`,
          firstName: nameParts[0],
          middleName: nameParts.slice(1, -1).join(' '),
          lastName: nameParts[nameParts.length - 1],
          suffix: '',
          email,
          phone,
          password: fakePassword,
          role: 'user',
          provider: 'google',
        };

        await saveUser(newUser);
        saveCurrentUser(newUser);
        setNavigation();
        routeAfterLogin();
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
      auto_select: false,
      ux_mode: 'popup',
    });
  } catch (error) {
    console.error('Google Sign-In initialization error:', error);
  }
}

function initFacebookSdk() {
  // Facebook SDK initialization removed
}

function triggerFacebookSignIn() {
  showMessage('Facebook login is no longer available. Please use Google Sign-In instead.');
}

function handleFacebookSignInResponse(authResponse) {
  // Facebook login removed
}

function setQrBaseUrl(url) {
  if (!url) return;
  QR_BASE_URL = url.replace(/\/$/, '');
}

function saveCurrentUser(user) {
  STATE.currentUser = user;
  localStorage.setItem('petnet_session', JSON.stringify(user));
}

function loadSession() {
  const raw = localStorage.getItem('petnet_session');
  if (raw) {
    const user = JSON.parse(raw);
    STATE.currentUser = user;
  }
}

async function seedDemoData(user) {
  const qrCodes = await getQrCodes();
  const pets = await getPets();
  
  if (qrCodes.length === 0) {
    await saveQrCode({ 
      id: 'qr-demo-1', 
      code: 'PN-DEMO-QR-0001', 
      label: 'Collar 001', 
      status: 'assigned', 
      petId: 'pet-demo-1', 
      createdAt: new Date().toISOString() 
    });
    await saveQrCode({ 
      id: 'qr-demo-2', 
      code: 'PN-DEMO-QR-0002', 
      label: 'Collar 002', 
      status: 'available', 
      petId: null, 
      createdAt: new Date().toISOString() 
    });
  }
  
  if (user && pets.length === 0) {
    await savePet({ 
      id: 'pet-demo-1', 
      ownerId: user.id, 
      name: 'Luna', 
      age: '2 years', 
      breed: 'Siamese', 
      photo: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80', 
      characteristics: 'Blue eyes, white paws, small scar on ear', 
      allergies: 'None', 
      medications: 'None', 
      immunizations: 'Up to date', 
      qrCodeId: 'qr-demo-1', 
      createdAt: new Date().toISOString() 
    });
  }
}

async function autoLoginFromHash() {
  const hash = location.hash.replace('#', '');
  
  if (!STATE.currentUser && hash === 'admin') {
    saveCurrentUser(MASTER_ADMIN);
    await seedDemoData(null);
    return;
  }
  
  if (!STATE.currentUser && (hash === 'demo' || hash === 'user')) {
    let user = await getUserByEmail('demo@petnetwork.com');
    if (!user) {
      user = {
        id: `user-${Date.now()}`,
        firstName: 'Demo',
        middleName: '',
        lastName: 'PetOwner',
        suffix: '',
        email: 'demo@petnetwork.com',
        phone: '+1-800-555-0199',
        password: 'PetOwner!2026',
        role: 'user',
        provider: 'local',
      };
      await saveUser(user);
    }
    saveCurrentUser(user);
    await seedDemoData(user);
  }
}

async function routeToView() {
  setNavigation();
  
  const hash = location.hash.replace('#', '');
  const queryParams = new URLSearchParams(window.location.search);
  const deepQr = queryParams.get('qr');
  
  if (deepQr) {
    const rawCode = normalizeQrText(deepQr);
    const qrCode = await getQrCodeByCode(rawCode);
    
    if (!qrCode) {
      showMessage('This QR code is not recognized. Please contact support.');
      showView('loginScreen');
      return;
    }
    
    if (qrCode.status === 'assigned' && qrCode.petId) {
      await renderFinderResult(rawCode);
      return;
    }
    
    if (qrCode.status === 'available') {
      STATE.pendingQrCode = qrCode;
      showView('loginScreen');
      showMessage('Welcome! This collar is ready to be registered. Please log in or create an account.');
      return;
    }
    
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
    await showHistoryView();
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
  const pets = await getUserPets(STATE.currentUser.id);
  if (pets.length > 0) {
    showView('dashboardScreen');
    await renderUserDashboard();
  } else {
    beginPetRegistration();
  }
}

async function login(email, password) {
  const user = await getUserByEmail(email);
  if (!user) {
    showMessage('No account found for that email. Please create an account.');
    return;
  }
  if (user.password !== password) {
    showMessage('Invalid password. Please try again.');
    return;
  }
  saveCurrentUser(user);
  setNavigation();
  if (user.role === 'admin') {
    renderAdminPanel();
  } else {
    await routeAfterLogin();
  }
}

function validatePassword(password) {
  const requirements = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  };
  return Object.values(requirements).every(Boolean);
}

async function registerUser(name, email, phone, password, provider = 'local') {
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    showMessage('This email is already registered. Please use a different email or log in.');
    return;
  }
  if (!validatePassword(password)) {
    showMessage('Password must meet all requirements: minimum 8 characters, at least one uppercase letter, at least one number, and at least one special character (!@#$%^&*).');
    return;
  }
  
  const nameParts = name.split(' ');
  const user = {
    id: `user-${Date.now()}`,
    firstName: nameParts[0] || '',
    middleName: nameParts.slice(1, -1).join(' ') || '',
    lastName: nameParts[nameParts.length - 1] || '',
    suffix: '',
    email,
    phone,
    password,
    role: 'user',
    provider,
  };
  
  await saveUser(user);
  $('createAccountForm').reset();
  alert('Account created successfully! A confirmation has been sent to ' + email + '. Please check your inbox.');
  toggleLoginState('welcome');
  showView('loginScreen');
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

function handleLoginQrDecoded(codeText) {
  if (STATE.loginScanner) {
    STATE.loginScanner.clear().catch(() => {});
    STATE.loginScanner = null;
  }
  const normalized = normalizeQrText(codeText);
  
  (async () => {
    const qrCode = await getQrCodeByCode(normalized);
    if (!qrCode) {
      showMessage('This QR code is not registered. Please ask the administrator for a valid collar.');
      return;
    }
    if (qrCode.status === 'assigned') {
      showMessage('This collar QR code is already assigned to a pet. Please use a different code.');
      return;
    }
    STATE.pendingQrCode = qrCode;
    $('loginScannerContainer').classList.add('hidden');
    showMessage('QR code verified. Please create your account to continue registering your pet.');
    showView('createAccountScreen');
  })();
}

function beginPetRegistration(editPet = null, preVerifiedQr = null) {
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
    if (editPet.qrCodeId) {
      (async () => {
        const qrCodes = await getQrCodes();
        const qr = qrCodes.find((code) => code.id === editPet.qrCodeId);
        if (qr) {
          $('petQrCode').value = qr.code;
          STATE.currentQrVerification = qr;
          $('scannerStatus').textContent = `QR collar already assigned: ${qr.code}`;
        }
      })();
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

function editPet(petId) {
  (async () => {
    const pets = await getPets();
    const pet = pets.find((p) => p.id === petId);
    if (!pet) return;
    beginPetRegistration(pet);
  })();
}

function launchQrScanner(target) {
  const config = { fps: 10, qrbox: 250 };
  const scannerName = target === 'pet' ? 'petScanner' : 'finderScanner';
  const container = target === 'pet' ? $('scannerContainer') : $('finderScannerContainer');
  const status = target === 'pet' ? $('scannerStatus') : null;

  container.classList.remove('hidden');

  const cleanupAndStartScanner = () => {
    if (STATE[scannerName]) {
      try {
        STATE[scannerName].stop()
          .then(() => {
            try {
              STATE[scannerName].clear();
            } catch (e) {
              console.warn('Error clearing scanner:', e);
            }
            STATE[scannerName] = null;
            startFreshScanner();
          })
          .catch((stopErr) => {
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
  scannerInstance.stop()
    .then(() => {
      scannerInstance.clear().catch(() => {});
      STATE.petScanner = null;
      container.classList.add('hidden');
      handlePetQrVerification(decodedText);
    })
    .catch(() => {
      scannerInstance.clear().catch(() => {});
      STATE.petScanner = null;
      container.classList.add('hidden');
      handlePetQrVerification(decodedText);
    });
}

async function handlePetQrVerification(decodedText) {
  let scannedCode = decodedText.trim();
  if (scannedCode.includes('?qr=')) {
    try {
      scannedCode = new URL(scannedCode).searchParams.get('qr');
    } catch (e) {
      const match = scannedCode.match(/[?&]qr=([^&]+)/);
      scannedCode = match ? decodeURIComponent(match[1]) : decodedText.trim();
    }
  }
  
  const qrCodes = await getQrCodes();
  let qrRecord = qrCodes.find(q => q.code === scannedCode || q.id === scannedCode);
  
  if (!qrRecord) {
    qrRecord = {
      id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code: scannedCode,
      label: `Collar ${qrCodes.length + 1}`,
      status: 'available',
      petId: null,
      createdAt: new Date().toISOString(),
    };
    await saveQrCode(qrRecord);
  }
  
  STATE.currentQrVerification = qrRecord;
  $('petQrCode').value = scannedCode;
  $('scannerStatus').textContent = `QR Code scanned: ${scannedCode}`;
}

function handleFinderQrScanned(decodedText, scannerInstance, container) {
  scannerInstance.stop()
    .then(() => {
      scannerInstance.clear().catch(() => {});
      STATE.finderScanner = null;
      container.classList.add('hidden');
      
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

function handleFinderLookup() {
  const codeText = $('finderQrInput').value.trim();
  const rawCode = normalizeQrText(codeText);
  renderFinderResult(rawCode);
}

async function renderFinderResult(rawCode) {
  const qrCodes = await getQrCodes();
  const qrCode = qrCodes.find((q) => q.code === rawCode);
  
  if (!qrCode || !qrCode.petId) {
    showMessage('This pet has not been registered yet. Redirecting to the login screen.');
    showView('loginScreen');
    setNavigation();
    const loginEmail = $('loginEmail');
    const loginPassword = $('loginPassword');
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    return;
  }
  
  const pets = await getPets();
  const users = await getUsers();
  const pet = pets.find((p) => p.id === qrCode.petId);
  const owner = users.find((u) => u.id === pet.ownerId);
  
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
  
  await recordHistory({ 
    action: 'Finder lookup', 
    userId: owner.id, 
    petId: pet.id, 
    qrCodeId: qrCode.id 
  });
}

async function recordHistory(entry) {
  await saveScanHistory({
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    qrCodeId: entry.qrCodeId,
    userId: entry.userId,
    action: entry.action,
    timestamp: new Date().toISOString(),
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

  const qrCodes = await getQrCodes();
  const qr = qrCodes.find((code) => code.id === STATE.currentQrVerification.id);
  if (!qr || qr.status === 'assigned') {
    showMessage('The QR code is no longer available. Please scan a new one.');
    return;
  }

  if (editingId) {
    const pets = await getPets();
    const existingPet = pets.find((p) => p.id === editingId);
    if (!existingPet) {
      showMessage('Pet not found.');
      return;
    }
    
    const petUpdates = {
      name: petName,
      age: petAge,
      breed: petBreed,
      photo: petPhoto,
      characteristics: petCharacteristics,
      allergies: petAllergies,
      medications: petMedications,
      immunizations: petImmunizations,
    };

    if (existingPet.qrCodeId !== qr.id) {
      petUpdates.qrCodeId = qr.id;
      // Update old QR code
      const oldQr = qrCodes.find(code => code.id === existingPet.qrCodeId);
      if (oldQr) {
        await updateQrCode(oldQr.id, { status: 'available', petId: null });
      }
      // Update new QR code
      await updateQrCode(qr.id, { status: 'assigned', petId: existingPet.id });
    }

    await updatePet(editingId, petUpdates);
    await recordHistory({ 
      action: 'Updated pet profile', 
      userId: STATE.currentUser.id, 
      petId: editingId, 
      qrCodeId: qr.id 
    });
  } else {
    const newPet = {
      id: `pet-${Date.now()}`,
      ownerId: STATE.currentUser.id,
      name: petName,
      age: petAge,
      breed: petBreed,
      photo: petPhoto,
      characteristics: petCharacteristics,
      allergies: petAllergies,
      medications: petMedications,
      immunizations: petImmunizations,
      qrCodeId: qr.id,
      createdAt: new Date().toISOString(),
    };
    
    await savePet(newPet);
    await updateQrCode(qr.id, { status: 'assigned', petId: newPet.id });
    await recordHistory({ 
      action: 'Registered pet', 
      userId: STATE.currentUser.id, 
      petId: newPet.id, 
      qrCodeId: qr.id 
    });
  }

  $('petForm').reset();
  STATE.currentQrVerification = null;
  showView('dashboardScreen');
  await renderUserDashboard();
}

async function generateQrCodeBatch(count = 1) {
  const qrCodes = await getQrCodes();
  for (let i = 0; i < count; i += 1) {
    const id = `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const code = secureRandomCode();
    await saveQrCode({ 
      id, 
      code, 
      label: `Collar ${qrCodes.length + i + 1}`, 
      status: 'available', 
      petId: null, 
      createdAt: new Date().toISOString() 
    });
  }
  
  showView('adminQrCodesScreen');
  await renderAdminQrCodes(false);
  
  showMessage(`Successfully generated ${count} new collar QR code(s). They are ready for printing and distribution.`);
}

async function showHistoryView() {
  const historyList = $('historyList');
  const history = await getScanHistory();
  const userHistory = history.filter((record) => record.scanned_by === STATE.currentUser.id);
  
  historyList.innerHTML = '';
  if (!userHistory.length) {
    historyList.innerHTML = '<p>No scan history yet.</p>';
    return;
  }
  
  userHistory.slice().reverse().forEach((event) => {
    const item = document.createElement('div');
    item.className = 'history-card';
    const title = document.createElement('h4');
    title.textContent = event.location || 'Scan';
    const note = document.createElement('p');
    note.innerHTML = `<strong>Time:</strong> ${new Date(event.scanned_at).toLocaleString()}`;
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

  $('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    login($('loginEmail').value.trim(), $('loginPassword').value);
  });
  $('showCreateAccount').addEventListener('click', () => showView('createAccountScreen'));
  $('backToLogin').addEventListener('click', () => { toggleLoginState('welcome'); showView('loginScreen'); });

  $('togglePassword').addEventListener('click', () => {
    const input = $('createPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  $('createPassword').addEventListener('input', () => {
    const val = $('createPassword').value;
    const update = (id, test) => {
      const el = $(id);
      const text = el.textContent.slice(2);
      el.textContent = (test ? '✓ ' : '✗ ') + text;
      el.style.color = test ? 'green' : 'red';
    };
    update('req-length', val.length >= 8);
    update('req-upper', /[A-Z]/.test(val));
    update('req-number', /[0-9]/.test(val));
    update('req-special', /[!@#$%^&*]/.test(val));
  });

  $('createAccountForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const fullName = [
      $('createFirstName').value.trim(),
      $('createMiddleName').value.trim(),
      $('createLastName').value.trim(),
      $('createSuffix').value.trim()
    ].filter(Boolean).join(' ');
    registerUser(fullName, $('createEmail').value.trim(), $('createPhone').value.trim(), $('createPassword').value);
  });
  
  $('btnGoogle').addEventListener('click', () => loginSocialUser('Gmail'));
  
  const btnLogoutUser = $('btnLogoutUser');
  const btnLogoutAdmin = $('btnLogoutAdmin');
  if (btnLogoutUser) btnLogoutUser.addEventListener('click', handleLogout);
  if (btnLogoutAdmin) btnLogoutAdmin.addEventListener('click', handleLogout);

  const navMyPets = $('navMyPets');
  const navRegisterPet = $('navRegisterPet');
  const navMyHistory = $('navMyHistory');
  const navFinder = $('navFinder');
  if (navMyPets) navMyPets.addEventListener('click', () => { navMyPets.classList.add('active-nav'); showView('dashboardScreen'); renderUserDashboard(); });
  if (navRegisterPet) navRegisterPet.addEventListener('click', () => { navRegisterPet.classList.add('active-nav'); beginPetRegistration(); });
  if (navMyHistory) navMyHistory.addEventListener('click', () => { navMyHistory.classList.add('active-nav'); showView('historyScreen'); showHistoryView(); });
  if (navFinder) navFinder.addEventListener('click', () => { navFinder.classList.add('active-nav'); showView('finderScreen'); });

  const navAdminOwners = $('navAdminOwners');
  const navAdminPets = $('navAdminPets');
  const navAdminScans = $('navAdminScans');
  const navAdminQrStatus = $('navAdminQrStatus');
  const navAdminPanel = $('navAdminPanel');
  if (navAdminOwners) navAdminOwners.addEventListener('click', () => { navAdminOwners.classList.add('active-nav'); showView('adminOwnersScreen'); renderAdminOwners(true); });
  if (navAdminPets) navAdminPets.addEventListener('click', () => { navAdminPets.classList.add('active-nav'); showView('adminPetsScreen'); renderAdminRegisteredPets(true); });
  if (navAdminScans) navAdminScans.addEventListener('click', () => { navAdminScans.classList.add('active-nav'); showView('adminScansScreen'); renderAdminScanHistory(true); });
  if (navAdminQrStatus) navAdminQrStatus.addEventListener('click', () => { navAdminQrStatus.classList.add('active-nav'); showView('adminQrStatusScreen'); renderAdminQrStatus(); });
  if (navAdminPanel) navAdminPanel.addEventListener('click', () => { navAdminPanel.classList.add('active-nav'); renderAdminPanel(); });

  const btnQrAvailable = $('btnQrAvailable');
  const btnQrAll = $('btnQrAll');
  if (btnQrAvailable) btnQrAvailable.addEventListener('click', () => renderAdminQrCodes(true));
  if (btnQrAll) btnQrAll.addEventListener('click', () => renderAdminQrCodes(false));
  
  const btnGenerateMore = $('btnGenerateMore');
  if (btnGenerateMore) btnGenerateMore.addEventListener('click', () => {
    const count = parseInt($('batchCount').value, 10) || 1;
    generateQrCodeBatch(count);
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
  
  const btnOwnersRecent = $('btnOwnersRecent');
  const btnOwnersAll = $('btnOwnersAll');
  if (btnOwnersRecent) btnOwnersRecent.addEventListener('click', () => renderAdminOwners(true));
  if (btnOwnersAll) btnOwnersAll.addEventListener('click', () => renderAdminOwners(false));
  
  const btnPetsRecent = $('btnPetsRecent');
  const btnPetsAll = $('btnPetsAll');
  if (btnPetsRecent) btnPetsRecent.addEventListener('click', () => renderAdminRegisteredPets(true));
  if (btnPetsAll) btnPetsAll.addEventListener('click', () => renderAdminRegisteredPets(false));
  
  const btnScansRecent = $('btnScansRecent');
  const btnScansAll = $('btnScansAll');
  if (btnScansRecent) btnScansRecent.addEventListener('click', () => renderAdminScanHistory(true));
  if (btnScansAll) btnScansAll.addEventListener('click', () => renderAdminScanHistory(false));
  
  $('btnGenerateBatch').addEventListener('click', () => {
    const count = parseInt($('batchCount').value, 10) || 1;
    generateQrCodeBatch(count);
  });
}

async function init() {
  STATE.currentUser = null;
  STATE.isAdmin = false;

  await initializeStorage();
  setNavigation();
  await autoLoginFromHash();
  await prepareQrBaseUrl();
  initGoogleSignIn();
  attachEvents();
  await routeToView();
  window.addEventListener('hashchange', routeToView);
}

init();