import { SignJWT, importPKCS8 } from './vendor/jose.js';

const KEY_STORAGE = 'keygen_private_key_pem';
const DB_STORAGE = 'keygen_licenses_db';
const PIN_STORAGE = 'keygen_pin';
const ISSUER = 'angelvmar-license-issuer';

let privateKey = null;
const $ = (id) => document.getElementById(id);

async function loadKey(pem) {
  try {
    privateKey = await importPKCS8(pem, 'RS256');
    return true;
  } catch (e) { alert('Clave inválida.'); return false; }
}

function showApp() {
  $('key-section').style.display = 'none';
  $('gen-section').style.display = 'block';
  $('db-section').style.display = 'block';
  renderDB();
}

// --- SEGURIDAD (PIN) ---
function checkPin() {
  const savedPin = localStorage.getItem(PIN_STORAGE);
  if (!savedPin) {
    // Si no hay PIN, lo pedimos crear (solo la primera vez)
    const newPin = prompt('🔒 Crea un PIN de 4 dígitos para proteger tus llaves:');
    if (newPin && newPin.length === 4) localStorage.setItem(PIN_STORAGE, newPin);
  }
  
  if (localStorage.getItem(PIN_STORAGE)) {
    $('main-app').style.display = 'none';
    $('lock-screen').style.display = 'block';
  } else {
    $('main-app').style.display = 'block';
  }
}

$('unlock-btn').onclick = () => {
  if ($('pin-input').value === localStorage.getItem(PIN_STORAGE)) {
    $('lock-screen').style.display = 'none';
    $('main-app').style.display = 'block';
    initKey();
  } else { alert('PIN incorrecto'); }
};

// --- BASE DE DATOS (LocalStorage) ---
function getDB() { return JSON.parse(localStorage.getItem(DB_STORAGE) || '[]'); }
function saveDB(data) { localStorage.setItem(DB_STORAGE, JSON.stringify(data)); }

function renderDB() {
  const data = getDB();
  const query = $('search-input').value.toLowerCase();
  
  $('stat-total').textContent = data.length;
  $('stat-users').textContent = new Set(data.map(d => d.user)).size;
  $('stat-apps').textContent = new Set(data.map(d => d.app)).size;

  const filtered = data.filter(item => 
    item.user.toLowerCase().includes(query) || 
    item.app.toLowerCase().includes(query) ||
    (item.notes && item.notes.toLowerCase().includes(query))
  ).reverse();

  const container = $('list-container');
  if (filtered.length === 0) {
    container.innerHTML = '<p class="hint" style="text-align:center;">No hay licencias.</p>';
    return;
  }

  const now = Date.now();
  container.innerHTML = filtered.map((item) => {
    const isExpired = item.expiresAt < now;
    const expDate = new Date(item.expiresAt).toLocaleDateString();
    const statusClass = isExpired ? 'expired' : 'active';
    const statusText = isExpired ? 'Expirada' : 'Activa';

    return `
      <div class="license-card ${statusClass}">
        <div class="lc-header">
          <strong>${item.user}</strong>
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
        <div class="lc-body">
          <p>📱 <b>App:</b> ${item.app}</p>
          ${item.notes ? `<p>📝 <b>Nota:</b> ${item.notes}</p>` : ''}
          <p>🏷️ <b>Funciones:</b> ${item.features.length ? item.features.join(', ') : 'Ninguna'}</p>
          <p>📅 <b>Vence:</b> ${expDate}</p>
        </div>
        <div class="lc-actions">
          <button onclick="copyJWT('${item.jwt}')" class="secondary" style="padding: 8px; font-size: 0.8rem;">📋 Texto</button>
          <button onclick="shareJWT('${item.jwt}', '${item.app}')" class="secondary" style="padding: 8px; font-size: 0.8rem;">📤 Compartir</button>
          <button onclick="showQR('${item.jwt}')" class="secondary" style="padding: 8px; font-size: 0.8rem;">📷 QR</button>
          <button onclick="deleteLicense('${item.jwt}')" class="danger" style="padding: 8px; font-size: 0.8rem;">❌</button>
        </div>
      </div>
    `;
  }).join('');
}

window.copyJWT = async (jwt) => {
  try { await navigator.clipboard.writeText(jwt); alert('✅ Texto copiado'); } catch { alert('❌ Error'); }
};

window.shareJWT = async (jwt, appName) => {
  const text = `Licencia para ${appName}:\n\n${jwt}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Licencia', text: text }); } catch (e) { console.log(e); }
  } else {
    alert('Compartir no soportado en este dispositivo. Usa Copiar Texto.');
  }
};

window.showQR = (jwt) => {
  const qr = qrcode(0, 'L');
  qr.addData(jwt);
  qr.make();
  $('qr-canvas-container').innerHTML = qr.createImgTag(5); // Tamaño del QR
  $('qr-modal').style.display = 'flex';
};

window.deleteLicense = (jwt) => {
  if (!confirm('¿Eliminar esta licencia?')) return;
  saveDB(getDB().filter(item => item.jwt !== jwt));
  renderDB();
};

// --- RESPALDO ---
$('export-btn').onclick = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getDB()));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = `keygen_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
};

$('import-input').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        if (confirm(`Se importarán ${imported.length} licencias. ¿Sobrescribir las actuales?`)) {
          saveDB(imported); renderDB(); alert('✅ Importado');
        }
      } else { alert('Formato inválido'); }
    } catch { alert('Error al leer JSON'); }
  };
  reader.readAsText(file);
};

// --- EVENTOS GENERALES ---
$('search-input').addEventListener('input', renderDB);
$('close-qr').onclick = () => $('qr-modal').style.display = 'none';

$('trial-btn').onclick = () => {
  $('app-name').value = 'App de Prueba';
  $('user-id').value = 'Trial_' + Math.floor(Math.random() * 1000);
  $('features').value = 'pro';
  $('days').value = '7';
};

$('save-key-btn').onclick = async () => {
  const pem = $('key-input').value.trim();
  if (!pem.includes('BEGIN PRIVATE KEY')) { alert('Formato inválido (PKCS#8).'); return; }
  if (await loadKey(pem)) {
    localStorage.setItem(KEY_STORAGE, pem);
    showApp();
  }
};

$('clear-db-btn').onclick = () => {
  if (!confirm('¿Borrar TODO el registro?')) return;
  localStorage.removeItem(DB_STORAGE); renderDB();
};

$('license-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!privateKey) return;

  const app = $('app-name').value.trim();
  const user = $('user-id').value.trim();
  const notes = $('notes').value.trim();
  const features = $('features').value.split(',').map(f => f.trim()).filter(Boolean);
  const days = Math.max(1, parseInt($('days').value, 10) || 365);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = (now + days * 86400) * 1000;

  try {
    const jwt = await new SignJWT({ app, features })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject(user)
      .setIssuer(ISSUER)
      .setIssuedAt(now)
      .setExpirationTime(now + days * 86400)
      .sign(privateKey);

    const db = getDB();
    db.push({ app, user, notes, features, expiresAt, date: new Date().toISOString(), jwt });
    saveDB(db);

    $('user-id').value = ''; $('notes').value = ''; $('features').value = '';
    renderDB();
    alert('✅ Licencia generada y guardada');
  } catch (err) { alert('Error al firmar: ' + err.message); }
};

async function initKey() {
  const saved = localStorage.getItem(KEY_STORAGE);
  if (saved && await loadKey(saved)) showApp();
  else $('key-section').style.display = 'block';
}

checkPin();
