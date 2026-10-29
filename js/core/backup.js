// Sauvegarde du fichier de stats.
// - Téléphone : menu de partage d'Android (Drive, mail…) ; à défaut, téléchargement.
// - PC (Chrome, Edge) : un dossier choisi une fois, réécrit automatiquement après chaque quiz.
import { exportText, markExported } from './store.js';

const FILE = 'geoquiz-sauvegarde.json';
const dated = () => `geoquiz-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;

export async function saveNow() {
  const text = exportText();
  const file = new File([text], dated(), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde Geoquiz' });
      markExported();
      return 'Sauvegarde envoyée.';
    } catch (e) {
      if (e?.name === 'AbortError') return 'Sauvegarde annulée.';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = dated();
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  markExported();
  return 'Sauvegarde téléchargée dans Téléchargements.';
}

/* ---------- Dossier automatique (PC) ---------- */
export const folderSupported = () => 'showDirectoryPicker' in window;

function idb() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('geoquiz', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function kv(op, key, val) {
  const db = await idb();
  return new Promise((ok, ko) => {
    const tx = db.transaction('kv', op === 'get' ? 'readonly' : 'readwrite');
    const st = tx.objectStore('kv');
    const r = op === 'get' ? st.get(key) : op === 'del' ? st.delete(key) : st.put(val, key);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

export async function folder() { try { return await kv('get', 'dir'); } catch { return null; } }

export async function chooseFolder() {
  const dir = await window.showDirectoryPicker({ id: 'geoquiz', mode: 'readwrite' });
  await kv('put', 'dir', dir);
  await writeToFolder(true);
  return dir.name;
}

export async function forgetFolder() { try { await kv('del', 'dir'); } catch { /* rien */ } }

// État de l'autorisation : 'granted', 'prompt' (à redonner après réouverture) ou null (pas de dossier).
export async function folderState() {
  const dir = await folder();
  if (!dir) return null;
  try { return { name: dir.name, perm: await dir.queryPermission({ mode: 'readwrite' }) }; } catch { return null; }
}

export async function writeToFolder(ask = false) {
  const dir = await folder();
  if (!dir) return false;
  let perm = await dir.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted' && ask) perm = await dir.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') return false;
  const fh = await dir.getFileHandle(FILE, { create: true });
  const w = await fh.createWritable();
  await w.write(exportText());
  await w.close();
  markExported();
  return true;
}
