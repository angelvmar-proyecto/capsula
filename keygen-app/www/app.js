import { SignJWT, importPKCS8 } from './vendor/jose.js';

const KEY_STORAGE = 'keygen_private_key_pem';
const DB_STORAGE = 'keygen_licenses_db';
const ISSUER = 'angelvmar-license-issuer';

let privateKey = null;
const $ = (id) => document.getElementById(id);

async function loadKey(pem) {
  try {
    privateKey = await importPKCS8(pem, 'RS256');
    return true;
  } catch (e) {
    alert('Error: La clave no es válida.');
    return false;
  }
}

function showApp() {
  $('key-section').style.display = 'none';
  $('gen-section').style.display = 'block';
  $('db-section').style.display = 'block';
  renderDB();
}

// --- BASE DE DATOS (LocalStorage) ---
function getDB() { return JSON.parse(localStorage.getItem(DB_STORAGE) || '[]'); }
function saveDB(data) { localStorage.setItem(DB_STORAGE, JSON.stringify(data)); }

function renderDB() {
  const data = getDB();
  const query = $('search-input').value.toLowerCase();
  
  // Actualizar estadísticas
  $('stat-total').textContent = data.length;
  $('stat-users').textContent = new Set(data.map(d => d.user)).size;
  $('stat-apps').textContent = new Set(data.map(d => d.app)).size;

  // Filtrar
  const filtered = data.filter(item => 
    item.user.toLowerCase().includes(query) || 
    item.app.toLowerCase().includes(query)
  ).reverse();

  const container = $('list-container');
  if (filtered.length === 0) {
    container.innerHTML = '<p class="hint" style="text-align:center;">No se encontraron licencias.</p>';
    return;
  }

  const now = Date.now();
  container.innerHTML = filtered.map((item, index) => {
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
          <p>🏷️ <b>Funciones:</b> ${item.features.length ? item.features.join(', ') : 'Ninguna'}</p>
          <p>📅 <b>Vence:</b> ${expDate}</p>
        </div>
        <div class="lc-actions">
          <button onclick="copyJWT('${item.jwt}')" class="secondary" style="padding: 8px; font-size: 0.8rem;">📋 Copiar JWT</button>
          <button onclick="deleteLicense('${item.jwt}')" class="danger" style="padding: 8px; font-size: 0.8rem;">❌ Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

window.copyJWT = async (jwt) => {
  try { await navigator.clipboard.writeText(jwt); alert('✅ Licencia copiada'); } catch { alert('❌ Error al copiar'); }
};

window.deleteLicense = (jwt) => {
  if (!confirm('¿Eliminar esta licencia permanentemente?')) return;
  const data = getDB().filter(item => item.jwt !== jwt);
  saveDB(data);
  renderDB();
};

// --- EVENTOS ---
$('search-input').addEventListener('input', renderDB);

$('save-key-btn').onclick = async () => {
  const pem = $('key-input').value.trim();
  if (!pem.includes('BEGIN PRIVATE KEY')) { alert('Formato inválido (PKCS#8).'); return; }
  if (await loadKey(pem)) {
    localStorage.setItem(KEY_STORAGE, pem);
    showApp();
  }
};

$('clear-key-btn').onclick = () => {
  if (!confirm('¿Olvidar la clave privada?')) return;
  localStorage.removeItem(KEY_STORAGE);
  privateKey = null;
  $('key-input').value = '';
  $('key-section').style.display = 'block';
  $('gen-section').style.display = 'none';
  $('db-section').style.display = 'none';
};

$('clear-db-btn').onclick = () => {
  if (!confirm('¿Borrar TODO el registro de licencias?')) return;
  localStorage.removeItem(DB_STORAGE);
  renderDB();
};

$('license-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!privateKey) return;

  const app = $('app-name').value.trim();
  const user = $('user-id').value.trim();
  const features = $('features').value.split(',').map(f => f.trim()).filter(Boolean);
  const days = Math.max(1, parseInt($('days').value, 10) || 365);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = (now + days * 86400) * 1000; // Guardamos en milisegundos para JS

  try {
    const jwt = await new SignJWT({ app, features })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject(user)
      .setIssuer(ISSUER)
      .setIssuedAt(now)
      .setExpirationTime(now + days * 86400)
      .sign(privateKey);

    // Guardar en "Base de Datos"
    const db = getDB();
    db.push({ app, user, features, expiresAt, date: new Date().toISOString(), jwt });
    saveDB(db);

    // Limpiar formulario y actualizar UI
    $('user-id').value = '';
    $('features').value = '';
    renderDB();
    alert('✅ Licencia generada y guardada');
  } catch (err) {
    alert('Error al firmar: ' + err.message);
  }
};

async function init() {
  const saved = localStorage.getItem(KEY_STORAGE);
  if (saved && await loadKey(saved)) showApp();
}
init();
