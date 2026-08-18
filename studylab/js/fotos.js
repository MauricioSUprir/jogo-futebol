/* ===== fotos.js — as fotos da Minha Escola, guardadas no aparelho =====
   Fotos são grandes demais para o localStorage, então ficam no IndexedDB do
   navegador. Nada disso sai do celular: só vai para a internet a foto que o
   aluno anexar numa pergunta ao Study AI.                                     */

const NOME = 'studylab-fotos';
const LOJA = 'fotos';
let bancoP = null;

function abrir() {
  if (bancoP) return bancoP;
  bancoP = new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME, 1);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(LOJA)) {
        const loja = db.createObjectStore(LOJA, { keyPath: 'id' });
        loja.createIndex('materiaId', 'materiaId', { unique: false });
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error || new Error('Não consegui abrir o armazenamento de fotos.'));
  });
  return bancoP;
}

function transacao(modo, executar) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(LOJA, modo);
    const saida = executar(tx.objectStore(LOJA));
    tx.oncomplete = () => resolve(saida?.result ?? saida);
    tx.onerror = () => reject(tx.error);
  }));
}

export async function guardarFoto({ materiaId, dataUrl, legenda = '' }) {
  const foto = {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    materiaId, dataUrl, legenda, em: new Date().toISOString(),
  };
  await transacao('readwrite', (loja) => loja.put(foto));
  return foto;
}

export function fotosDaMateria(materiaId) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const pedido = db.transaction(LOJA, 'readonly').objectStore(LOJA).index('materiaId').getAll(materiaId);
    pedido.onsuccess = () => resolve((pedido.result || []).sort((a, b) => a.em.localeCompare(b.em)));
    pedido.onerror = () => reject(pedido.error);
  }));
}

export const apagarFoto = (id) => transacao('readwrite', (loja) => loja.delete(id));

export async function apagarFotosDaMateria(materiaId) {
  const fotos = await fotosDaMateria(materiaId);
  await Promise.all(fotos.map((f) => apagarFoto(f.id)));
}

export function contarFotosDaMateria(materiaId) {
  return abrir().then((db) => new Promise((resolve) => {
    const pedido = db.transaction(LOJA, 'readonly').objectStore(LOJA).index('materiaId').count(materiaId);
    pedido.onsuccess = () => resolve(pedido.result || 0);
    pedido.onerror = () => resolve(0);
  }));
}

/* ---------- preparo de imagem ---------- */
/** Redimensiona e comprime a foto (JPEG) para não estourar armazenamento nem
 *  o envio ao servidor. Devolve um dataURL. */
export function comprimirImagem(arquivo, { max = 1280, qualidade = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(arquivo.type)) return reject(new Error('Escolha uma imagem (JPG, PNG…).'));
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * escala));
      c.height = Math.max(1, Math.round(img.height * escala));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui ler essa imagem.')); };
    img.src = url;
  });
}

/** Converte um dataURL no bloco de imagem que a IA entende. */
export function dataUrlParaBloco(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Foto em formato inesperado.');
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
}
