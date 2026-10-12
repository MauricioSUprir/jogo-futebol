// Prints do PRÉ-JOGO (navegador): a abertura, cada plano do roteiro completo (no meio dele) e as duas escalações (e a
// troca de uma para a outra), no PC 1280×720 Alta e no celular 844×390 dpr 2 Média (toque, entalhe simulado), de dia e
// de noite, com a torcida (o HUD não aparece no pré-jogo, por desenho: sem narração e sem placar antes da saída). Relógio
// manual (?prints=1&prejogo=1): o mesmo quadro sempre. Salva em tools/saida/prejogo/ e monta uma folha por perfil e hora
// (folha-<perfil>-<hora>.png, 4 por linha, com o nome de cada plano). Confere erros no console.
//   node tools/prints-prejogo.mjs [--so pc-dia,celular-noite]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const so = arg('--so', '') ? new Set(arg('--so', '').split(',')) : null;
const SAIDA = path.join(RAIZ, 'tools', 'saida', 'prejogo');
fs.mkdirSync(SAIDA, { recursive: true });

const PERFIS = [
  { nome: 'pc-dia', largura: 1280, altura: 720, dpr: 1, toque: false, url: 'q=alta&hora=dia' },
  { nome: 'pc-noite', largura: 1280, altura: 720, dpr: 1, toque: false, url: 'q=alta&hora=noite' },
  { nome: 'celular-dia', largura: 844, altura: 390, dpr: 2, toque: true, url: 'q=media&hora=dia&toque=1&entalhe=1' },
  { nome: 'celular-noite', largura: 844, altura: 390, dpr: 2, toque: true, url: 'q=media&hora=noite&toque=1&entalhe=1' },
].filter(p => !so || so.has(p.nome));

/** Folha de contato: os prints em 4 colunas com o nome embaixo de cada um. */
async function folha(contexto, arquivos, destino) {
  const aux = await contexto.newPage();
  await aux.setContent('<canvas id="c"></canvas>');
  const dados = arquivos.map(a => ({ nome: a.nome, b64: fs.readFileSync(a.arq).toString('base64') }));
  const b64 = await aux.evaluate(async lista => {
    const imgs = [];
    for (const d of lista) { const i = new Image(); i.src = 'data:image/png;base64,' + d.b64; await i.decode(); imgs.push(i); }
    const col = 4, w = 480, h = Math.round(w * imgs[0].height / imgs[0].width), rot = 26;
    const c = document.getElementById('c');
    c.width = col * w; c.height = Math.ceil(imgs.length / col) * (h + rot);
    const g = c.getContext('2d');
    g.fillStyle = '#07090a'; g.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, k) => {
      const x = (k % col) * w, y = Math.floor(k / col) * (h + rot);
      g.drawImage(im, x, y, w, h);
      g.fillStyle = '#eaf3ee'; g.font = '700 15px system-ui, sans-serif'; g.fillText(lista[k].nome, x + 8, y + h + 18);
    });
    return c.toDataURL('image/png').split(',')[1];
  }, dados);
  fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
  await aux.close();
}

const srv = await servidor(0, RAIZ);
let falhas = 0;
try {
  for (const P of PERFIS) {
    const { navegador, contexto, pagina: pg, erros } = await abrir(P);
    await pg.goto(`${srv.url}?prints=1&prejogo=1&semente=3&${P.url}`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
    const feitos = [];
    const salvar = async (n, nome) => {
      const arq = path.join(SAIDA, `${P.nome}-${String(n).padStart(2, '0')}-${nome}.png`);
      await pg.screenshot({ path: arq });
      feitos.push({ nome, arq });
    };
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(16); g.relogio.avancar(16); g.relogio.avancar(16); });
    await salvar(0, 'abertura');
    const planos = await pg.evaluate(() => { const p = window.__golaco.prejogo; p.comecar(); return p.planos; });
    let n = 1;
    for (const p of planos) {
      // o meio do plano (a escalação: 2 s depois de entrar, inteira na tela)
      const t = p.bloco === 'cenas' ? (p.t0 + p.t1) / 2 : p.t0 + 2;
      await pg.evaluate(t => { const g = window.__golaco; g.prejogo.irPara(t - 0.05); g.relogio.avancar(16); g.relogio.avancar(16); g.relogio.avancar(16); }, t);
      await salvar(n++, p.id);
    }
    // a troca de uma escalação para a outra (a do mandante saindo, a do visitante entrando)
    const t1 = planos.find(p => p.id === 'escalacao1').t0;
    await pg.evaluate(t => { const g = window.__golaco; g.prejogo.irPara(t + 0.2); g.relogio.avancar(16); }, t1);
    await salvar(n++, 'troca-de-escalacao');
    await folha(contexto, feitos, path.join(SAIDA, `folha-${P.nome}.png`));
    console.log(`${P.nome}: ${feitos.length} prints; ${erros.length} erros${erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''}`);
    if (erros.length) falhas++;
    await navegador.close();
  }
} finally {
  await srv.fechar();
}
console.log(`prints em ${SAIDA}`);
process.exit(falhas ? 1 : 0);
