// Sauvegarde du fichier de stats, nommée « AAAAMMJJ - Export Geoquiz.txt » (date locale).
// - Téléphone : menu de partage d'Android, pour choisir la destination (Proton Drive, Drive, mail…).
//   Le contenu est du JSON, mais en .txt : le partage d'Android refuse souvent les fichiers .json.
// - PC (Chrome, Edge) : fenêtre « Enregistrer sous » ; en plus, un dossier choisi une fois
//   peut être réécrit automatiquement après chaque quiz.
// - Sinon : téléchargement.
import { exportText, markExported } from './store.js';

const TYPE = 'text/plain';
export function fileName(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())} - Export Geoquiz.txt`;
}

// Téléphone ou tablette : le menu de partage passe avant tout (c'est lui qui propose Proton Drive).
const mobile = () => /Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;

// Partage : réussi quand Android le confirme, ou quand on revient sur l'app après être passé dans
// l'appli choisie (Proton Drive…) : certaines applis ne renvoient jamais la confirmation, et la date
// de dernière sauvegarde ne bougeait alors plus.
async function share(file) {
  if (!navigator.share) return 'none';
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return 'none';
  let away = false, onVis;
  const back = new Promise(res => {
    onVis = () => { if (document.hidden) away = true; else if (away) res('ok'); };
    document.addEventListener('visibilitychange', onVis);
  });
  const sent = navigator.share({ files: [file], title: file.name }).then(
    () => 'ok',
    e => (away ? 'ok' : e?.name === 'AbortError' ? 'abort' : 'none'),
  );
  try {
    return await Promise.race([sent, back]);
  } finally {
    document.removeEventListener('visibilitychange', onVis);
  }
}

async function savePicker(text, name) {
  if (!('showSaveFilePicker' in window)) return 'none';
  try {
    const fh = await window.showSaveFilePicker({
      suggestedName: name, id: 'geoquiz-export',
      types: [{ description: 'Sauvegarde Geoquiz', accept: { [TYPE]: ['.txt'] } }],
    });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    return 'ok';
  } catch (e) {
    return e?.name === 'AbortError' ? 'abort' : 'none';
  }
}

export async function saveNow() {
  const text = exportText();
  const name = fileName();
  const file = new File([text], name, { type: TYPE });
  // Téléphone : partage d'abord ; ordinateur : « Enregistrer sous » d'abord.
  const tries = mobile() ? [() => share(file), () => savePicker(text, name)] : [() => savePicker(text, name), () => share(file)];
  for (const t of tries) {
    const r = await t();
    if (r === 'ok') { markExported(); return `Sauvegarde envoyée : ${name}`; }
    if (r === 'abort') return 'Sauvegarde annulée.';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  markExported();
  return `Ce navigateur ne propose pas le partage de fichiers : sauvegarde téléchargée (${name}).`;
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
  const fh = await dir.getFileHandle(fileName(), { create: true }); // un fichier par jour, réécrit au fil des quiz
  const w = await fh.createWritable();
  await w.write(exportText());
  await w.close();
  markExported();
  return true;
}
