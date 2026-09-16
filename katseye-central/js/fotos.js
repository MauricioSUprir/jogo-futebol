/* ===== fotos.js — as imagens do app, guardadas no IndexedDB =====
   Foto não cabe no localStorage (o limite é de poucos MB e é compartilhado
   com o resto do estado). Então o estado guarda só o `fotoId` e o arquivo
   em si mora aqui, como dataURL, num banco separado.                        */

const BANCO = 'katseye-fotos';
const LOJA = 'fotos';
let bancoAberto = null;

function abrir() {
  if (bancoAberto) return bancoAberto;
  bancoAberto = new Promise((ok, erro) => {
    if (!('indexedDB' in window)) { erro(new Error('Este navegador não guarda imagens.')); return; }
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOJA)) db.createObjectStore(LOJA, { keyPath: 'id' });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error || new Error('Não consegui abrir o armazenamento de imagens.'));
  });
  return bancoAberto;
}

function transacao(modo) {
  return abrir().then((db) => db.transaction(LOJA, modo).objectStore(LOJA));
}

/** Guarda uma imagem (dataURL) e devolve o id para o estado referenciar. */
export async function guardar(id, dataURL) {
  const loja = await transacao('readwrite');
  return new Promise((ok, erro) => {
    const r = loja.put({ id, dataURL, em: Date.now() });
    r.onsuccess = () => ok(id);
    r.onerror = () => erro(r.error || new Error('Não consegui salvar a imagem.'));
  });
}

export async function ler(id) {
  if (!id) return null;
  try {
    const loja = await transacao('readonly');
    return await new Promise((ok) => {
      const r = loja.get(id);
      r.onsuccess = () => ok(r.result?.dataURL || null);
      r.onerror = () => ok(null);
    });
  } catch { return null; }
}

export async function apagar(id) {
  try {
    const loja = await transacao('readwrite');
    loja.delete(id);
  } catch { /* se não deu, o registro fica órfão e a limpeza pega depois */ }
}

/** Lê várias de uma vez — a galeria usa isso ao montar a grade. */
export async function lerVarias(ids) {
  const out = {};
  await Promise.all(ids.map(async (id) => { out[id] = await ler(id); }));
  return out;
}

/** Apaga imagens que nenhum registro do estado referencia mais. */
export async function limparOrfas(idsEmUso) {
  try {
    const loja = await transacao('readwrite');
    const usados = new Set(idsEmUso);
    return await new Promise((ok) => {
      const r = loja.getAllKeys();
      r.onsuccess = () => {
        const mortos = (r.result || []).filter((k) => !usados.has(k));
        mortos.forEach((k) => loja.delete(k));
        ok(mortos.length);
      };
      r.onerror = () => ok(0);
    });
  } catch { return 0; }
}

/** Apaga tudo — usado em "zerar o app". */
export async function apagarTudo() {
  try {
    bancoAberto = null;
    await new Promise((ok) => {
      const r = indexedDB.deleteDatabase(BANCO);
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    });
  } catch { /* segue */ }
}

/**
 * Reduz a imagem antes de guardar: acima de `max` px o navegador guarda
 * megabytes à toa e a galeria fica lenta. Devolve um dataURL JPEG.
 */
export function redimensionar(dataURL, max = 1600, qualidade = 0.86) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      if (escala === 1 && dataURL.length < 900000) { ok(dataURL); return; }
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => ok(dataURL);
    img.src = dataURL;
  });
}

/** Quanto o navegador já deixou o app usar (quando ele conta). */
export async function espaco() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usado: e.usage || 0, cota: e.quota || 0 } : null;
  } catch { return null; }
}
