const SUPABASE_URL = 'https://sbkkdtfdhvikhfdbhsbx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2tkdGZkaHZpa2hmZGJoc2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1OTk3NDUsImV4cCI6MjA5NTE3NTc0NX0.E-v0T9hbvRMWBOSjXOgHKSYRE3RgPnvcEtkQ9GJC1gA';
const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATE = {
  currentUser: null,
  currentQrVerification: null,
  pendingQrCode: null,
  finderScanner: null,
  petScanner: null,
  loginScanner: null,
};

const MASTER_ADMIN = {
  id: 'admin-1',
  name: 'Master Admin',
  email: 'admin@petnetwork.com',
  password: 'MasterAdmin!2026',
  role: 'admin',
  provider: 'local',
  phone: '+1-800-555-0101',
};

const GOOGLE_CLIENT_ID = '540931981374-205a6qbbrte6lhulq32g5gcqt1adop3c.apps.googleusercontent.com';

let QR_BASE_URL = '';

function $(id) { return document.getElementById(id); }
function showMessage(message) { alert(message); }

async function getUsers() {
  const { data } = await dbClient.from('users').select('*');
  return data || [];
}

async function getUserByEmail(email) {
  console.log('Checking email:', email.toLowerCase());
  const { data, error } = await dbClient
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .limit(1);
  console.log('getUserByEmail result - data:', data, 'error:', error);
  if (error) { console.error('getUserByEmail error:', error); return null; }
  return (data && data.length > 0) ? data[0] : null;
}

async function saveUser(user) {
  await dbClient.from('users').insert([{
    id: user.id,
    first_name: user.firstName || user.name || '',
    last_name: user.lastName || '',
    email: user.email,
    phone: user.phone,
    password: user.password,
    role: user.role,
    provider: user.provider,
  }]);
}

async function getPets() {
  const { data } = await dbClient.from('pets').select('*');
  return (data || []).map(p => ({ ...p, ownerId: p.owner_id, qrCodeId: p.qr_code_id }));
}

async function savePet(pet) {
  await dbClient.from('pets').insert([{
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
  }]);
}

async function updatePetInDb(petId, updates) {
  const updateData = {
    name: updates.name,
    age: updates.age,
    breed: updates.breed,
    photo: updates.photo,
    characteristics: updates.characteristics,
    allergies: updates.allergies,
    medications: updates.medications,
    immunizations: updates.immunizations,
  };
  if (updates.qrCodeId) updateData.qr_code_id = updates.qrCodeId;
  await dbClient.from('pets').update(updateData).eq('id', petId);
}

async function getQrCodes() {
  const { data } = await dbClient.from('qr_codes').select('*');
  return (data || []).map(q => ({ ...q, petId: q.pet_id }));
}

async function saveQrCode(qr) {
  await dbClient.from('qr_codes').insert([{
    id: qr.id,
    code: qr.code,
    label: qr.label || null,
    status: qr.status,
    pet_id: qr.petId || null,
  }]);
}

async function updateQrCodeInDb(qrId, updates) {
  const updateData = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.petId !== undefined) updateData.pet_id = updates.petId;
  await dbClient.from('qr_codes').update(updateData).eq('id', qrId);
}

async function getScanHistory() {
  const { data } = await dbClient.from('scan_history').select('*');
  return data || [];
}

async function saveScanHistory(entry) {
  await dbClient.from('scan_history').insert([{
    id: entry.id,
    qr_code_id: entry.qrCodeId,
    scanned_by: entry.userId,
    location: entry.action,
    scanned_at: entry.timestamp,
  }]);
}

async function initializeStorage() {
  const admin = await getUserByEmail(MASTER_ADMIN.email);
  if (!admin) {
    await saveUser({ ...MASTER_ADMIN, firstName: 'Master', lastName: 'Admin' });
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
    if (userNav) { userNav.classList.add('hidden'); userNav.style.display = 'none'; }
    if (adminNav) { adminNav.classList.add('hidden'); adminNav.style.display = 'none'; }
    return;
  }
  const isAdmin = STATE.currentUser.role === 'admin';
  if (isAdmin) {
    if (adminNav) { adminNav.classList.remove('hidden'); adminNav.style.display = 'flex'; }
    if (userNav) { userNav.classList.add('hidden'); userNav.style.display = 'none'; }
  } else {
    if (userNav) { userNav.classList.remove('hidden'); userNav.style.display = 'flex'; }
    if (adminNav) { adminNav.classList.add('hidden'); adminNav.style.display = 'none'; }
  }
}

function secureRandomCode() {
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((n) => ('0' + (n % 36).toString(36)).slice(-2))
    .join('').toUpperCase();
  return `PN-${randomPart}`;
}

function getQrPayload(rawCode) {
  if (!QR_BASE_URL) return rawCode;
  const path = window.location.pathname || '/';
  return `${QR_BASE_URL}${path}?qr=${encodeURIComponent(rawCode)}`;
}

function getLocalIpCandidates() {
  return new Promise((resolve) => {
    const ips = new Set();
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.onicecandidate = (event) => {
      if (!event.candidate) { pc.close(); resolve(Array.from(ips)); return; }
      const ip = event.candidate.candidate.split(' ')[4];
      if (ip && !ips.has(ip)) ips.add(ip);
    };
    pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => resolve([]));
  });
}

function isLocalHost(origin) {
  const lower = origin.toLowerCase();
  return lower.includes('127.0.0.1') || lower.includes('localhost');
}

async function prepareQrBaseUrl() {
  if (window.PETNET_BASE_URL) { QR_BASE_URL = window.PETNET_BASE_URL.replace(/\/$/, ''); return; }
  const origin = window.location.origin || '';
  if (origin && !isLocalHost(origin) && !origin.includes('.local')) { QR_BASE_URL = origin; return; }
  const localIps = await getLocalIpCandidates();
  const fallbackIp = localIps.find((ip) => ip && !ip.startsWith('127.') && !ip.startsWith('169.') && !ip.includes(':'));
  if (fallbackIp) {
    const port = window.location.port ? `:${window.location.port}` : '';
    QR_BASE_URL = `${window.location.protocol}//${fallbackIp}${port}`;
    return;
  }
  QR_BASE_URL = '';
}

function normalizeQrText(scannedText) {
  const trimmed = scannedText.trim();
  try {
    const url = new URL(trimmed);
    const payload = url.searchParams.get('qr');
    if (payload) return payload;
  } catch (e) {}
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
  new QRCode(qrNode, { text: getQrPayload(text), width: 260, height: 260, colorDark: '#14213d', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  const codeText = document.createElement('small');
  codeText.textContent = text;
  const printButton = document.createElement('button');
  printButton.className = 'secondary';
  printButton.textContent = 'Print QR Code';
  printButton.addEventListener('click', () => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    printWindow.document.write('<html><head><title>Print QR Code</title><style>body{margin:0;padding:20px;font-family:sans-serif;}img{width:100%;max-width:300px;display:block;margin:0 auto;}div{text-align:center;margin-top:12px;font-weight:700;}</style></head><body>');
    printWindow.document.write(codeHolder.innerHTML);
    printWindow.document.write(`<div>${text}</div></body></html>`);
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
  if (!myCodes.length) userQrList.innerHTML = '<p>No assigned collars yet. Register a pet after scanning a QR code.</p>';
  myCodes.forEach((qr) => {
    const container = document.createElement('div');
    createQRCodeElement(container, qr.code, `Collar ${qr.label || qr.id}`);
    const notice = document.createElement('small');
    notice.textContent = 'Assigned to your pet';
    container.querySelector('button').before(notice);
    userQrList.appendChild(container);
  });
  if (!myPets.length) petCardList.innerHTML = '<p>You have no registered pets yet.</p>';
  myPets.forEach((pet) => {
    const card = document.createElement('div');
    card.className = 'pet-card';
    const image = document.createElement('img');
    image.src = pet.photo; image.alt = pet.name;
    const title = document.createElement('h4');
    title.textContent = pet.name;
    const details = document.createElement('p');
    details.innerHTML = `<strong>Breed:</strong> ${pet.breed}<br><strong>Age:</strong> ${pet.age}`;
    const label = document.createElement('small');
    const code = qrCodes.find((qr) => qr.id === pet.qrCodeId);
    label.textContent = `Collar: ${code ? code.code : 'Not assigned'}`;
    const health = document.createElement('p');
    health.innerHTML = `<strong>Allergies:</strong> ${pet.allergies || 'None'}<br><strong>Medications:</strong> ${pet.medications || 'None'}<br><strong>Immunizations:</strong> ${pet.immunizations || 'Unspecified'}`;
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;';
    const editButton = document.createElement('button');
    editButton.className = 'primary'; editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => editPet(pet.id));
    const printButton = document.createElement('button');
    printButton.className = 'secondary'; printButton.textContent = 'Print Profile';
    printButton.addEventListener('click', () => {
      const win = window.open('', '_blank');
      win.document.write('<html><head><title>Pet Profile</title><style>body{font-family:sans-serif;padding:24px;}img{max-width:100%;border-radius:16px;}</style></head><body>');
      win.document.write(`<h1>${pet.name}</h1><img src="${pet.photo}" alt="${pet.name}"/><p><strong>Breed:</strong> ${pet.breed}</p><p><strong>Age:</strong> ${pet.age}</p><p><strong>Collar ID:</strong> ${code ? code.code : 'Not assigned'}</p>`);
      win.document.write('</body></html>');
      win.document.close(); win.print();
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
  const items = recentOnly ? list.slice(0, 8) : list;
  if (!items.length) { container.innerHTML = '<p>No registered pet owners yet.</p>'; return; }
  items.forEach((u) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const title = document.createElement('h4');
    title.textContent = u.first_name ? `${u.first_name} ${u.last_name}` : u.name;
    const details = document.createElement('p');
    details.innerHTML = `<strong>Email:</strong> ${u.email}<br><strong>Phone:</strong> ${u.phone || 'N/A'}`;
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
  const items = recentOnly ? pets.slice(0, 8) : pets;
  if (!items.length) { container.innerHTML = '<p>No registered pets yet.</p>'; return; }
  items.forEach((pet) => {
    const card = document.createElement('div');
    card.className = 'pet-card';
    const image = document.createElement('img');
    image.src = pet.photo; image.alt = pet.name;
    const title = document.createElement('h4');
    title.textContent = pet.name;
    const owner = users.find(u => u.id === pet.ownerId);
    const details = document.createElement('p');
    details.innerHTML = `<strong>Owner:</strong> ${owner ? (owner.first_name ? `${owner.first_name} ${owner.last_name}` : owner.name) : 'Unknown'}<br><strong>Breed:</strong> ${pet.breed}`;
    card.append(image, title, details);
    container.appendChild(card);
  });
}

async function renderAdminScanHistory(recentOnly = false) {
  const history = await getScanHistory();
  const container = $('adminScanHistory');
  if (!container) return;
  container.innerHTML = '';
  const items = recentOnly ? history.slice(0, 12) : history;
  if (!items.length) { container.innerHTML = '<p>No scan records available.</p>'; return; }
  items.forEach((event) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `<h4>${event.location || 'Scan'}</h4><p><strong>Time:</strong> ${new Date(event.scanned_at).toLocaleString()}</p>`;
    container.appendChild(card);
  });
}

async function renderAdminQrCodes(availableOnly = false) {
  const qrCodes = await getQrCodes();
  const container = $('adminQrCodesList');
  if (!container) return;
  container.innerHTML = '';
  const items = availableOnly ? qrCodes.filter(qr => qr.status === 'available') : qrCodes;
  if (!items.length) { container.innerHTML = '<p>No QR codes available.</p>'; return; }
  items.forEach((qr) => {
    const cardContainer = document.createElement('div');
    cardContainer.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    createQRCodeElement(cardContainer, qr.code, `Collar ${qr.label || qr.code}`);
    const statusBadge = document.createElement('small');
    statusBadge.style.cssText = 'padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600;';
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
  const statusCounts = { active: 0, unassigned: 0, deactivated: 0, lost: 0 };
  qrCodes.forEach((qr) => {
    if (qr.status === 'assigned') statusCounts.active++;
    else if (qr.status === 'available') statusCounts.unassigned++;
    else if (qr.status === 'deactivated') statusCounts.deactivated++;
    else if (qr.status === 'lost') statusCounts.lost++;
  });
  const totalCollars = qrCodes.length;
  const progressBar = $('qrProgressBar');
  progressBar.innerHTML = '';
  if (totalCollars > 0) {
    ['active', 'unassigned', 'deactivated', 'lost'].forEach((status) => {
      const count = statusCounts[status];
      if (count > 0) {
        const segment = document.createElement('div');
        segment.className = `progress-segment ${status}`;
        segment.style.width = `${(count / totalCollars) * 100}%`;
        segment.textContent = count;
        progressBar.appendChild(segment);
      }
    });
  }
  const legendContainer = $('qrProgressLegend');
  legendContainer.innerHTML = '';
  [
    { label: '🟢 Active / Assigned', status: 'active', count: statusCounts.active },
    { label: '🟠 Unassigned', status: 'unassigned', count: statusCounts.unassigned },
    { label: '⚫ Deactivated', status: 'deactivated', count: statusCounts.deactivated },
    { label: '🔴 Lost Status', status: 'lost', count: statusCounts.lost },
  ].forEach((item) => {
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    const pct = totalCollars > 0 ? ((item.count / totalCollars) * 100).toFixed(1) : 0;
    legendItem.innerHTML = `<div class="legend-dot ${item.status}"></div><div class="legend-text"><span>${item.label}</span><span style="font-weight:700">${item.count} (${pct}%)</span></div>`;
    legendContainer.appendChild(legendItem);
  });
  const totalItem = document.createElement('div');
  totalItem.className = 'legend-item';
  totalItem.innerHTML = `<span style="font-weight:700">Total Collars</span><span style="font-weight:700">${totalCollars}</span>`;
  legendContainer.appendChild(totalItem);
  const tableBody = $('qrStatusTableBody');
  tableBody.innerHTML = '';
  if (!qrCodes.length) { tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">No QR codes found.</td></tr>'; return; }
  qrCodes.forEach((qr) => {
    const row = document.createElement('tr');
    const pet = qr.petId ? pets.find(p => p.id === qr.petId) : null;
    const owner = pet ? users.find(u => u.id === pet.ownerId) : null;
    const scanCount = history.filter(h => h.qr_code_id === qr.id).length;
    const statusText = qr.status === 'assigned' ? 'Active' : qr.status === 'available' ? 'Unassigned' : qr.status === 'deactivated' ? 'Deactivated' : 'Lost Status';
    const badgeClass = qr.status === 'assigned' ? 'active' : qr.status === 'available' ? 'unassigned' : qr.status;
    row.innerHTML = `<td style="font-weight:600">${qr.code}</td><td><span class="status-badge ${badgeClass}">${statusText}</span></td><td>${pet ? pet.name : '—'}</td><td>${owner ? (owner.first_name ? `${owner.first_name} ${owner.last_name}` : owner.name) : '—'}</td><td style="font-weight:600">${scanCount}</td>`;
    tableBody.appendChild(row);
  });
}

function loginSocialUser(provider) {
  if (provider === 'Gmail') triggerGoogleSignIn();
}

function triggerGoogleSignIn() {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    showMessage('Google Sign-In service is not available.');
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
          btn.style.cssText = 'position:fixed;left:-9999px;';
          document.body.appendChild(btn);
        }
        google.accounts.id.renderButton(btn, { type: 'standard', size: 'large', theme: 'outline', text: 'signin_with' });
        setTimeout(() => { const rendered = btn.querySelector('button'); if (rendered) rendered.click(); }, 100);
      }
    });
  } catch (error) {
    showMessage('Google Sign-In failed. Please try again.');
  }
}

function handleGoogleSignInResponse(response) {
  if (!response.credential) { showMessage('Google Sign-In was cancelled.'); return; }
  try {
    const decodedToken = parseJwt(response.credential);
    const { email, name, sub: googleUserId } = decodedToken;
    (async () => {
      let user = await getUserByEmail(email);
      if (user) {
        saveCurrentUser(user);
        setNavigation();
        if (user.role === 'admin') renderAdminPanel();
        else await routeAfterLogin();
      } else {
        const phone = prompt('Welcome! Please enter your phone number:');
        if (!phone) { showMessage('Phone number is required.'); return; }
        const nameParts = name.split(' ');
        const newUser = {
          id: `user-${Date.now()}`,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          name,
          email,
          phone,
          password: `google-${googleUserId}`,
          role: 'user',
          provider: 'google',
        };
        await saveUser(newUser);
        saveCurrentUser(newUser);
        setNavigation();
        await routeAfterLogin();
      }
    })();
  } catch (error) {
    showMessage('Failed to process Google Sign-In.');
  }
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  return JSON.parse(jsonPayload);
}

function initGoogleSignIn() {
  if (!window.google) return;
  try {
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleSignInResponse, auto_select: false, ux_mode: 'popup' });
  } catch (error) {}
}

function saveCurrentUser(user) {
  STATE.currentUser = user;
  localStorage.setItem('petnet_session', JSON.stringify(user));
}

async function login(email, password) {
  if (email === MASTER_ADMIN.email && password === MASTER_ADMIN.password) {
    saveCurrentUser(MASTER_ADMIN);
    setNavigation();
    renderAdminPanel();
    return;
  }
  const user = await getUserByEmail(email);
  if (!user) { showMessage('No account found for that email.'); return; }
  if (user.password !== password) { showMessage('Invalid password.'); return; }
  saveCurrentUser(user);
  setNavigation();
  await routeAfterLogin();
}

async function routeAfterLogin() {
  const pets = await getPets();
  const userPets = pets.filter(p => p.ownerId === STATE.currentUser.id);
  if (userPets.length > 0) { showView('dashboardScreen'); await renderUserDashboard(); }
  else beginPetRegistration();
}

async function registerUser(name, email, phone, password, provider = 'local') {
  console.log('registerUser called with email:', email);
  const existing = await getUserByEmail(email);
  console.log('existing user check result:', existing);
  if (existing) { showMessage('This email is already registered.'); return; }
  const nameParts = name.split(' ');
  const user = {
    id: `user-${Date.now()}`,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    name,
    email,
    phone,
    password,
    role: 'user',
    provider,
  };
  await saveUser(user);
  $('createAccountForm').reset();
  toggleLoginState('welcome');
  showView('loginScreen');
  showMessage('Account created! Please log in.');
}

function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
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
        if (qr) { $('petQrCode').value = qr.code; STATE.currentQrVerification = qr; $('scannerStatus').textContent = `QR collar already assigned: ${qr.code}`; }
      })();
    }
  } else {
    $('editingPetId').value = '';
    if (preVerifiedQr) { STATE.currentQrVerification = preVerifiedQr; $('petQrCode').value = preVerifiedQr.code; $('scannerStatus').textContent = `QR code verified: ${preVerifiedQr.code}`; }
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
        STATE[scannerName].stop().then(() => {
          try { STATE[scannerName].clear(); } catch (e) {}
          STATE[scannerName] = null;
          startFreshScanner();
        }).catch(() => {
          try { STATE[scannerName].clear(); } catch (e) {}
          STATE[scannerName] = null;
          startFreshScanner();
        });
      } catch (e) { STATE[scannerName] = null; startFreshScanner(); }
    } else { startFreshScanner(); }
  };
  const startFreshScanner = () => {
    try {
      const html5QrCode = new Html5Qrcode(target === 'pet' ? 'scannerContainer' : 'finderScannerContainer');
      STATE[scannerName] = html5QrCode;
      html5QrCode.start({ facingMode: 'environment' }, config, (decodedText) => {
        if (target === 'pet') handlePetQrScanned(decodedText, html5QrCode, container);
        else handleFinderQrScanned(decodedText, html5QrCode, container);
      }).catch((err) => {
        if (status) status.textContent = 'Camera not available. Enter QR code manually.';
        STATE[scannerName] = null;
      });
    } catch (e) {
      if (status) status.textContent = 'Error initializing scanner.';
      STATE[scannerName] = null;
    }
  };
  cleanupAndStartScanner();
}

function handlePetQrScanned(decodedText, scannerInstance, container) {
  scannerInstance.stop().then(() => {
    scannerInstance.clear().catch(() => {});
    STATE.petScanner = null;
    container.classList.add('hidden');
    handlePetQrVerification(decodedText);
  }).catch(() => {
    scannerInstance.clear().catch(() => {});
    STATE.petScanner = null;
    container.classList.add('hidden');
    handlePetQrVerification(decodedText);
  });
}

async function handlePetQrVerification(decodedText) {
  let scannedCode = decodedText.trim();
  if (scannedCode.includes('?qr=')) {
    try { scannedCode = new URL(scannedCode).searchParams.get('qr'); }
    catch (e) { const match = scannedCode.match(/[?&]qr=([^&]+)/); scannedCode = match ? decodeURIComponent(match[1]) : decodedText.trim(); }
  }
  const qrCodes = await getQrCodes();
  let qrRecord = qrCodes.find(q => q.code === scannedCode || q.id === scannedCode);
  if (!qrRecord) {
    qrRecord = { id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, code: scannedCode, label: `Collar ${qrCodes.length + 1}`, status: 'available', petId: null };
    await saveQrCode(qrRecord);
  }
  STATE.currentQrVerification = qrRecord;
  $('petQrCode').value = scannedCode;
  $('scannerStatus').textContent = `QR Code scanned: ${scannedCode}`;
}

function handleFinderQrScanned(decodedText, scannerInstance, container) {
  scannerInstance.stop().then(() => {
    scannerInstance.clear().catch(() => {});
    STATE.finderScanner = null;
    container.classList.add('hidden');
    $('finderQrInput').value = decodedText;
    handleFinderLookup();
  }).catch(() => {
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
  await saveScanHistory({ id: `history-${Date.now()}`, qrCodeId: qrCode.id, userId: owner.id, action: 'Finder lookup', timestamp: new Date().toISOString() });
}

async function submitPetForm(event) {
  event.preventDefault();
  if (!STATE.currentQrVerification) { alert('You must scan and verify a unique collar QR code before registering or updating a pet.'); return; }
  const petName = $('petName').value.trim();
  const petAge = $('petAge').value.trim();
  const petBreed = $('petBreed').value.trim();
  const petPhoto = $('petPhoto').value.trim();
  const petCharacteristics = $('petCharacteristics').value.trim();
  const petAllergies = $('petAllergies').value.trim();
  const petMedications = $('petMedications').value.trim();
  const petImmunizations = $('petImmunizations').value.trim();
  const editingId = $('editingPetId').value;
  const qrCodes = await getQrCodes();
  const qr = qrCodes.find((code) => code.id === STATE.currentQrVerification.id);
  if (!qr || qr.status === 'assigned') { showMessage('The QR code is no longer available. Please scan a new one.'); return; }
  if (editingId) {
    await updatePetInDb(editingId, { name: petName, age: petAge, breed: petBreed, photo: petPhoto, characteristics: petCharacteristics, allergies: petAllergies, medications: petMedications, immunizations: petImmunizations });
    await updateQrCodeInDb(qr.id, { status: 'assigned', petId: editingId });
  } else {
    const newPet = { id: `pet-${Date.now()}`, ownerId: STATE.currentUser.id, name: petName, age: petAge, breed: petBreed, photo: petPhoto, characteristics: petCharacteristics, allergies: petAllergies, medications: petMedications, immunizations: petImmunizations, qrCodeId: qr.id };
    await savePet(newPet);
    await updateQrCodeInDb(qr.id, { status: 'assigned', petId: newPet.id });
    await saveScanHistory({ id: `history-${Date.now()}`, qrCodeId: qr.id, userId: STATE.currentUser.id, action: 'Registered pet', timestamp: new Date().toISOString() });
  }
  $('petForm').reset();
  STATE.currentQrVerification = null;
  showView('dashboardScreen');
  await renderUserDashboard();
}

async function generateQrCodeBatch(count = 1) {
  const qrCodes = await getQrCodes();
  for (let i = 0; i < count; i++) {
    const id = `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const code = secureRandomCode();
    await saveQrCode({ id, code, label: `Collar ${qrCodes.length + i + 1}`, status: 'available', petId: null });
  }
  showView('adminQrCodesScreen');
  await renderAdminQrCodes(false);
  showMessage(`Successfully generated ${count} new collar QR code(s).`);
}

async function showHistoryView() {
  const history = await getScanHistory();
  const historyList = $('historyList');
  const userHistory = history.filter(r => r.scanned_by === STATE.currentUser.id);
  historyList.innerHTML = '';
  if (!userHistory.length) { historyList.innerHTML = '<p>No scan history yet.</p>'; return; }
  userHistory.slice().reverse().forEach((event) => {
    const item = document.createElement('div');
    item.className = 'history-card';
    item.innerHTML = `<h4>${event.location || 'Scan'}</h4><p><strong>Time:</strong> ${new Date(event.scanned_at).toLocaleString()}</p>`;
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

async function routeToView() {
  setNavigation();
  const queryParams = new URLSearchParams(window.location.search);
  const deepQr = queryParams.get('qr');
  if (deepQr) {
    const rawCode = normalizeQrText(deepQr);
    const qrCodes = await getQrCodes();
    const qrCode = qrCodes.find((q) => q.code === rawCode);
    if (!qrCode) { showMessage('This QR code is not recognized.'); showView('loginScreen'); return; }
    if (qrCode.status === 'assigned' && qrCode.petId) { await renderFinderResult(rawCode); return; }
    if (qrCode.status === 'available') { STATE.pendingQrCode = qrCode; showView('loginScreen'); showMessage('Welcome! This collar is ready to be registered.'); return; }
    showMessage('This collar has been deactivated or marked as lost.');
    showView('loginScreen');
    return;
  }
  if (!STATE.currentUser) { showView('loginScreen'); return; }
  if (STATE.currentUser.role === 'admin') { renderAdminPanel(); return; }
  showView('dashboardScreen');
  await renderUserDashboard();
}

function attachEvents() {
  const loginToggleButton = $('loginToggleButton');
  const backToWelcome = $('backToWelcome');
  const linkCreateAccount = $('linkCreateAccount');
  if (loginToggleButton) loginToggleButton.addEventListener('click', () => toggleLoginState('form'));
  if (backToWelcome) backToWelcome.addEventListener('click', () => toggleLoginState('welcome'));
  if (linkCreateAccount) linkCreateAccount.addEventListener('click', (e) => { e.preventDefault(); showView('createAccountScreen'); });
  $('loginForm').addEventListener('submit', (event) => { event.preventDefault(); login($('loginEmail').value.trim(), $('loginPassword').value); });
  $('showCreateAccount').addEventListener('click', () => showView('createAccountScreen'));
  $('backToLogin').addEventListener('click', () => { toggleLoginState('welcome'); showView('loginScreen'); });
  $('createAccountForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const firstName = $('createFirstName') ? $('createFirstName').value.trim() : '';
      const lastName = $('createLastName') ? $('createLastName').value.trim() : '';
      const middleName = $('createMiddleName') ? $('createMiddleName').value.trim() : '';
      const suffix = $('createSuffix') ? $('createSuffix').value.trim() : '';
      const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
      const email = $('createEmail').value.trim();
      const phone = $('createPhone').value.trim();
      const password = $('createPassword').value;
      const confirmPwd = $('confirmPassword') ? $('confirmPassword').value : password;
      if (password !== confirmPwd) { alert('Passwords do not match.'); return; }
      await registerUser(fullName, email, phone, password);
    } catch (err) {
      console.error('Form submit error:', err);
      alert('Something went wrong: ' + err.message);
    }
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
  if (btnGenerateMore) btnGenerateMore.addEventListener('click', () => { const count = parseInt($('batchCount').value, 10) || 1; generateQrCodeBatch(count); });
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
      if (!file) { if (preview) preview.src = ''; if (hidden) hidden.value = ''; return; }
      const reader = new FileReader();
      reader.onload = function (ev) { if (preview) preview.src = ev.target.result; if (hidden) hidden.value = ev.target.result; };
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
  $('btnGenerateBatch').addEventListener('click', () => { const count = parseInt($('batchCount').value, 10) || 1; generateQrCodeBatch(count); });
}

async function init() {
  STATE.currentUser = null;
  await initializeStorage();
  setNavigation();
  await prepareQrBaseUrl();
  initGoogleSignIn();
  attachEvents();
  await routeToView();
  window.addEventListener('hashchange', routeToView);
init();

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

    // Check if user already exists
    let user = getUserByEmail(email);
    if (user) {
      // Existing user: log them in
      saveCurrentUser(user);
      setNavigation();
      if (user.role === 'admin') {
        renderAdminPanel();
      } else {
        routeAfterLogin();
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
        id: `user-${Date.now()}`,
        name,
        email,
        phone,
        password: fakePassword,
        role: 'user',
        provider: 'google',
        picture,
      };

      const users = loadData(storageKeys.users, []);
      users.push(newUser);
      saveData(storageKeys.users, users);
      saveCurrentUser(newUser);
      setNavigation();
      routeAfterLogin();
    }
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

function registerSocialUser(provider) {
  const providerName = provider;
  const email = prompt(`Enter your ${providerName} email address:`);
  if (!email) return;

  const existing = getUserByEmail(email);
  if (existing) {
    saveCurrentUser(existing);
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
  registerUser(name, email, phone, fakePassword, providerName.toLowerCase());
}

function saveCurrentUser(user) {
  STATE.currentUser = user;
  localStorage.setItem('petnet_session', JSON.stringify(user));
}

function loadSession() {
  const raw = localStorage.getItem('petnet_session');
  if (raw) {
    const user = JSON.parse(raw);
    const stored = loadData(storageKeys.users, []).find((u) => u.id === user.id);
    if (stored) {
      STATE.currentUser = stored;
    }
  }
}

function seedDemoData(user) {
  const qrCodes = loadData(storageKeys.qrCodes, []);
  const pets = loadData(storageKeys.pets, []);
  if (qrCodes.length === 0) {
    qrCodes.push({ id: 'qr-demo-1', code: 'PN-DEMO-QR-0001', label: 'Collar 001', status: 'assigned', petId: 'pet-demo-1', createdAt: new Date().toISOString() });
    qrCodes.push({ id: 'qr-demo-2', code: 'PN-DEMO-QR-0002', label: 'Collar 002', status: 'available', petId: null, createdAt: new Date().toISOString() });
    saveData(storageKeys.qrCodes, qrCodes);
  }
  if (user && pets.length === 0) {
    pets.push({ id: 'pet-demo-1', ownerId: user.id, name: 'Luna', age: '2 years', breed: 'Siamese', photo: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80', characteristics: 'Blue eyes, white paws, small scar on ear', allergies: 'None', medications: 'None', immunizations: 'Up to date', qrCodeId: 'qr-demo-1', createdAt: new Date().toISOString() });
    saveData(storageKeys.pets, pets);
  }
}

function autoLoginFromHash() {
  const hash = location.hash.replace('#', '');
  if (!STATE.currentUser && hash === 'admin') {
    const users = loadData(storageKeys.users, []);
    let admin = users.find((user) => user.role === 'admin');
    if (!admin) {
      users.push(MASTER_ADMIN);
      saveData(storageKeys.users, users);
      admin = MASTER_ADMIN;
    }
    saveCurrentUser(admin);
    seedDemoData(null);
    return;
  }
  if (!STATE.currentUser && (hash === 'demo' || hash === 'user')) {
    const users = loadData(storageKeys.users, []);
    let user = users.find((u) => u.role === 'user');
    if (!user) {
      user = {
        id: `user-${Date.now()}`,
        name: 'Demo PetOwner',
        email: 'demo@petnetwork.com',
        phone: '+1-800-555-0199',
        password: 'PetOwner!2026',
        role: 'user',
        provider: 'local',
      };
      users.push(user);
      saveData(storageKeys.users, users);
    }
    saveCurrentUser(user);
    seedDemoData(user);
  }
}

function routeToView() {
  // Ensure navigation visibility is correct before routing
  setNavigation();
  
  const hash = location.hash.replace('#', '');
  const queryParams = new URLSearchParams(window.location.search);
  const deepQr = queryParams.get('qr');
  
  // SCENARIO A: Deep-link via QR code scan (handle before checking currentUser)
  // This is public - works whether user is logged in or not
  if (deepQr) {
    const rawCode = normalizeQrText(deepQr);
    const qrCode = loadData(storageKeys.qrCodes, []).find((q) => q.code === rawCode);
    
    if (!qrCode) {
      // QR code doesn't exist in system
      showMessage('This QR code is not recognized. Please contact support.');
      showView('loginScreen');
      return;
    }
    
    // SCENARIO B: QR code is REGISTERED to a pet - show pet info (public finder view)
    if (qrCode.status === 'assigned' && qrCode.petId) {
      renderFinderResult(rawCode);
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
  renderUserDashboard();
}

function routeAfterLogin() {
  const pets = loadData(storageKeys.pets, []);
  const userPets = pets.filter(p => p.ownerId === STATE.currentUser.id);
  if (userPets.length > 0) {
    showView('dashboardScreen');
    renderUserDashboard();
  } else {
    beginPetRegistration();
  }
}

function login(email, password) {
  const user = getUserByEmail(email);
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
    routeAfterLogin();
  }
}

function registerUser(name, email, phone, password, provider = 'local') {
  if (getUserByEmail(email)) {
    showMessage('This email is already registered. Please use a different email or log in.');
    return;
  }
  const users = loadData(storageKeys.users, []);
  const user = {
    id: `user-${Date.now()}`,
    name,
    email,
    phone,
    password,
    role: 'user',
    provider,
  };
  users.push(user);
  saveData(storageKeys.users, users);
  $('createAccountForm').reset();
  toggleLoginState('welcome');
  showView('loginScreen');
  showMessage('Account created! Please log in.');
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

function handleLoginQrDecoded(codeText) {
  if (STATE.loginScanner) {
    STATE.loginScanner.clear().catch(() => {});
    STATE.loginScanner = null;
  }
  const normalized = normalizeQrText(codeText);
  const qrCodes = loadData(storageKeys.qrCodes, []);
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
      const qr = loadData(storageKeys.qrCodes, []).find((code) => code.id === editPet.qrCodeId);
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

function editPet(petId) {
  const pet = loadData(storageKeys.pets, []).find((p) => p.id === petId);
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

function handlePetQrVerification(decodedText) {
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
  
  // Look up the code in localStorage
  const qrCodes = loadData(storageKeys.qrCodes, []);
  let qrRecord = qrCodes.find(q => q.code === scannedCode || q.id === scannedCode);
  
  // If NOT found in localStorage, create it on the spot
  if (!qrRecord) {
    qrRecord = {
      id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code: scannedCode,
      label: `Collar ${qrCodes.length + 1}`,
      status: 'available',
      petId: null,
      createdAt: new Date().toISOString(),
    };
    qrCodes.push(qrRecord);
    saveData(storageKeys.qrCodes, qrCodes);
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

function verifyScannedQr(codeText) {
  const normalized = normalizeQrText(codeText);
  const qrCodes = loadData(storageKeys.qrCodes, []);
  
  // Debug logging
  console.log('Scanned QR code (normalized):', normalized);
  console.log('Current QR codes in localStorage:', qrCodes);
  
  let qrCode = qrCodes.find((q) => q.code === normalized);
  
  // If QR code is not found in localStorage, create a new record for it
  // This allows scanning codes generated on other devices/sessions
  if (!qrCode) {
    console.log('QR code not found in localStorage, creating new record');
    qrCode = {
      id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code: normalized,
      label: `Collar ${qrCodes.length + 1}`,
      status: 'available',
      petId: null,
      createdAt: new Date().toISOString(),
    };
    qrCodes.push(qrCode);
    saveData(storageKeys.qrCodes, qrCodes);
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

function renderFinderResult(rawCode) {
  const qrCode = loadData(storageKeys.qrCodes, []).find((q) => q.code === rawCode);
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
  const pet = loadData(storageKeys.pets, []).find((p) => p.id === qrCode.petId);
  const owner = loadData(storageKeys.users, []).find((u) => u.id === pet.ownerId);
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
  recordHistory({ action: 'Finder lookup', userId: owner.id, petId: pet.id, qrCodeText: qrCode.code });
}

function recordHistory(entry) {
  const history = loadData(storageKeys.history, []);
  history.push({
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
    timestamp: new Date().toISOString(),
  });
  saveData(storageKeys.history, history);
}

function submitPetForm(event) {
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

  const pets = loadData(storageKeys.pets, []);
  const qrCodes = loadData(storageKeys.qrCodes, []);
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
    existingPet.name = petName;
    existingPet.age = petAge;
    existingPet.breed = petBreed;
    existingPet.photo = petPhoto;
    existingPet.characteristics = petCharacteristics;
    existingPet.allergies = petAllergies;
    existingPet.medications = petMedications;
    existingPet.immunizations = petImmunizations;
    if (existingPet.qrCodeId !== qr.id) {
      const previousIndex = qrCodes.findIndex((code) => code.id === existingPet.qrCodeId);
      if (previousIndex >= 0) {
        qrCodes[previousIndex].status = 'available';
        qrCodes[previousIndex].petId = null;
      }
      existingPet.qrCodeId = qr.id;
      qr.petId = existingPet.id;
      qr.status = 'assigned';
    }
    recordHistory({ action: 'Updated pet profile', userId: STATE.currentUser.id, petId: existingPet.id, qrCodeText: qr.code });
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
    pets.push(newPet);
    qr.petId = newPet.id;
    qr.status = 'assigned';
    recordHistory({ action: 'Registered pet', userId: STATE.currentUser.id, petId: newPet.id, qrCodeText: qr.code });
  }

  saveData(storageKeys.pets, pets);
  saveData(storageKeys.qrCodes, qrCodes);
  $('petForm').reset();
  STATE.currentQrVerification = null;
  showView('dashboardScreen');
  renderUserDashboard();
}

function generateQrCodeBatch(count = 1) {
  const qrCodes = loadData(storageKeys.qrCodes, []);
  const generatedCodes = [];
  for (let i = 0; i < count; i += 1) {
    const id = `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const code = secureRandomCode();
    const qrRecord = { id, code, label: `Collar ${qrCodes.length + i + 1}`, status: 'available', petId: null, createdAt: new Date().toISOString() };
    qrCodes.push(qrRecord);
    generatedCodes.push(qrRecord);
  }
  saveData(storageKeys.qrCodes, qrCodes);
  
  // Navigate to the QR codes display screen
  showView('adminQrCodesScreen');
  renderAdminQrCodes(false);
  
  // Show confirmation message
  showMessage(`Successfully generated ${count} new collar QR code(s). They are ready for printing and distribution.`);
}

function showHistoryView() {
  const historyList = $('historyList');
  const history = loadData(storageKeys.history, []).filter((record) => record.userId === STATE.currentUser.id);
  historyList.innerHTML = '';
  if (!history.length) {
    historyList.innerHTML = '<p>No scan history yet.</p>';
  }
  history.slice().reverse().forEach((event) => {
    const item = document.createElement('div');
    item.className = 'history-card';
    const title = document.createElement('h4');
    title.textContent = event.action;
    const note = document.createElement('p');
    note.innerHTML = `<strong>QR:</strong> ${event.qrCodeText}<br><strong>Time:</strong> ${new Date(event.timestamp).toLocaleString()}`;
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

  $('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    login($('loginEmail').value.trim(), $('loginPassword').value);
  });
  $('showCreateAccount').addEventListener('click', () => showView('createAccountScreen'));
  $('backToLogin').addEventListener('click', () => { toggleLoginState('welcome'); showView('loginScreen'); });
  $('createAccountForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const fullName = [
      $('createFirstName').value.trim(),
      $('createMiddleName') ? $('createMiddleName').value.trim() : '',
      $('createLastName').value.trim(),
      $('createSuffix') ? $('createSuffix').value.trim() : ''
    ].filter(Boolean).join(' ');
    const confirmPwd = $('confirmPassword') ? $('confirmPassword').value : null;
    if (confirmPwd !== null && $('createPassword').value !== confirmPwd) {
      alert('Passwords do not match. Please try again.');
      return;
    }
    registerUser(fullName, $('createEmail').value.trim(), $('createPhone').value.trim(), $('createPassword').value);
  });
  $('togglePassword').addEventListener('click', () => {
    const input = $('createPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  $('toggleConfirmPassword').addEventListener('click', () => {
    const input = $('confirmPassword');
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
  if (navMyPets) navMyPets.addEventListener('click', () => { navMyPets.classList.add('active-nav'); showView('dashboardScreen'); renderUserDashboard(); });
  if (navRegisterPet) navRegisterPet.addEventListener('click', () => { navRegisterPet.classList.add('active-nav'); beginPetRegistration(); });
  if (navMyHistory) navMyHistory.addEventListener('click', () => { navMyHistory.classList.add('active-nav'); showView('historyScreen'); showHistoryView(); });
  if (navFinder) navFinder.addEventListener('click', () => { navFinder.classList.add('active-nav'); showView('finderScreen'); });

  // Admin navigation
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

  // Admin QR codes view
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
  // admin controls for recent / all views
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
  // Clear session on page load - users must log in fresh each time
  STATE.currentUser = null;
  STATE.isAdmin = false;

  initializeStorage();
  setNavigation();
  autoLoginFromHash();
  await prepareQrBaseUrl();
  initGoogleSignIn();
  attachEvents();
  routeToView();
  window.addEventListener('hashchange', routeToView);
}

init();
