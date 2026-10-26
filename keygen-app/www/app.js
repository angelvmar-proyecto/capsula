import { SignJWT, importPKCS8 } from './vendor/jose.js';

const STORAGE_KEY = 'keygen_private_key_pem';
const ISSUER = 'angelvmar-license-issuer';

let privateKey = null;

const $ = (id) => document.getElementById(id);
const keySection = $('key-section');
const genSection = $('gen-section');
const keyInput   = $('key-input');
const keyStatus  = $('key-status');
const result     = $('result');
const copyBtn    = $('copy-btn');

async function loadKey(pem) {
  try {
    privateKey = await importPKCS8(pem, 'RS256');
    return true;
  } catch (e) {
    console.error('importPKCS8 error:', e);
    return false;
  }
}

function showGen() {
  keySection.style.display = 'none';
  genSection.style.display = 'block';
  keyStatus.textContent = '';
}

async function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && await loadKey(saved)) showGen();
}

$('save-key-btn').onclick = async () => {
  const pem = keyInput.value.trim();
  if (!pem.includes('BEGIN PRIVATE KEY')) {
    alert('Formato inválido. Debe empezar con "-----BEGIN PRIVATE KEY-----" (PKCS#8).');
    return;
  }
  const ok = await loadKey(pem);
  if (!ok) {
    alert('No se pudo cargar la clave. Verifica que sea válida.');
    return;
  }
  localStorage.setItem(STORAGE_KEY, pem);
  showGen();
};

$('clear-key-btn').onclick = () => {
  if (!confirm('¿Olvidar la clave privada de este dispositivo?')) return;
  localStorage.removeItem(STORAGE_KEY);
  privateKey = null;
  keyInput.value = '';
  result.value = '';
  result.style.display = 'none';
  copyBtn.style.display = 'none';
  genSection.style.display = 'none';
  keySection.style.display = 'block';
};

$('license-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!privateKey) return;

  const userId = $('user-id').value.trim();
  const features = $('features').value
    .split(',').map(f => f.trim()).filter(Boolean);
  const days = Math.max(1, parseInt($('days').value, 10) || 365);

  if (!userId) { alert('El ID de usuario es obligatorio'); return; }

  try {
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({ features })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setIssuedAt(now)
      .setExpirationTime(now + days * 86400)
      .sign(privateKey);

    result.value = jwt;
    result.style.display = 'block';
    copyBtn.style.display = 'inline-block';
  } catch (err) {
    console.error(err);
    alert('Error al firmar: ' + err.message);
  }
};

copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(result.value);
    copyBtn.textContent = '✅ Copiado';
    setTimeout(() => copyBtn.textContent = '📋 Copiar', 1800);
  } catch {
    result.select();
    document.execCommand('copy');
  }
};

init();
