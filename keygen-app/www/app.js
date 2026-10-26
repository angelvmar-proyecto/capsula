import { SignJWT, importPKCS8 } from './vendor/jose.js';

const KEY_STORAGE = 'keygen_private_key_pem';
const HISTORY_STORAGE = 'keygen_history';
const ISSUER = 'angelvmar-license-issuer';

let privateKey = null;
const $ = (id) => document.getElementById(id);

async function loadKey(pem) {
  try {
    privateKey = await importPKCS8(pem, 'RS256');
    return true;
  } catch (e) {
    console.error('Error importPKCS8:', e);
    return false;
  }
}

function showApp() {
  $('key-section').style.display = 'none';
  $('gen-section').style.display = 'block';
  $('history-section').style.display = 'block';
  renderHistory();
}

// --- HISTORIAL ---
function getHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_STORAGE) || '[]');
}

function saveToHistory(item) {
  const history = getHistory();
  history.unshift(item); // Agrega al inicio
  localStorage.setItem(HISTORY_STORAGE, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  const list = $('history-list');
  
  if (history.length === 0) {
    list.innerHTML = '<p class="hint">No hay licencias generadas aún.</p>';
    return;
  }

  list.innerHTML = history.map((item, index) => `
    <div class="history-item">
      <div class="history-header">
        <strong>${item.app}</strong> - ${item.user}
      </div>
      <div class="history-meta">
        ${item.features.length ? '🏷️ ' + item.features.join(', ') : 'Sin funciones extra'} <br>
        📅 ${new Date(item.date).toLocaleDateString()}
      </div>
      <div class="history-actions">
        <button onclick="copyHistory(${index})" class="secondary" style="padding: 6px; font-size: 0.8rem;">📋 Copiar</button>
        <button onclick="deleteHistory(${index})" class="danger" style="padding: 6px; font-size: 0.8rem;">❌ Borrar</button>
      </div>
    </div>
  `).join('');
}

window.copyHistory = async (index) => {
  const history = getHistory();
  try {
    await navigator.clipboard.writeText(history[index].jwt);
    alert('Licencia copiada al portapapeles');
  } catch {
    alert('No se pudo copiar');
  }
};

window.deleteHistory = (index) => {
  if(!confirm('¿Borrar esta licencia del historial?')) return;
  const history = getHistory();
  history.splice(index, 1);
  localStorage.setItem(HISTORY_STORAGE, JSON.stringify(history));
  renderHistory();
};

// --- FIN HISTORIAL ---

async function init() {
  const saved = localStorage.getItem(KEY_STORAGE);
  if (saved && await loadKey(saved)) showApp();
}

$('save-key-btn').onclick = async () => {
  const pem = $('key-input').value.trim();
  if (!pem.includes('BEGIN PRIVATE KEY')) {
    alert('Formato inválido. Debe ser PKCS#8 (-----BEGIN PRIVATE KEY-----).');
    return;
  }
  if (await loadKey(pem)) {
    localStorage.setItem(KEY_STORAGE, pem);
    showApp();
  } else {
    alert('Clave inválida. Revisa el formato.');
  }
};

$('clear-key-btn').onclick = () => {
  if (!confirm('¿Olvidar la clave privada? (El historial se mantendrá)')) return;
  localStorage.removeItem(KEY_STORAGE);
  privateKey = null;
  $('key-input').value = '';
  $('key-section').style.display = 'block';
  $('gen-section').style.display = 'none';
  $('history-section').style.display = 'none';
};

$('clear-history-btn').onclick = () => {
  if (!confirm('¿Borrar TODO el historial de licencias? Esta acción no se puede deshacer.')) return;
  localStorage.removeItem(HISTORY_STORAGE);
  renderHistory();
};

$('license-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!privateKey) return;

  const appName = $('app-name').value.trim();
  const userId = $('user-id').value.trim();
  const features = $('features').value.split(',').map(f => f.trim()).filter(Boolean);
  const days = Math.max(1, parseInt($('days').value, 10) || 365);

  try {
    const now = Math.floor(Date.now() / 1000);
    // Firmar el JWT incluyendo el nombre de la app
    const jwt = await new SignJWT({ app: appName, features })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setIssuedAt(now)
      .setExpirationTime(now + days * 86400)
      .sign(privateKey);

    // Mostrar resultado actual
    $('result').value = jwt;
    $('result-container').style.display = 'block';

    // Guardar en historial
    saveToHistory({
      app: appName,
      user: userId,
      features: features,
      date: new Date().toISOString(),
      jwt: jwt
    });

    // Limpiar formulario (excepto días)
    $('user-id').value = '';
    $('features').value = '';
    
  } catch (err) {
    console.error(err);
    alert('Error al firmar: ' + err.message);
  }
};

$('copy-btn').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('result').value);
    $('copy-btn').textContent = '✅ Copiado';
    setTimeout(() => $('copy-btn').textContent = '📋 Copiar licencia', 1800);
  } catch {
    alert('Selecciona el texto y copia manualmente.');
  }
};

init();
