// Teste da EDIÇÃO PESSOAL (js/edicao.js; dono, 31/10: "na versão normal, fica do jeito que está, na licenciada, deixa star
// labs igual, ... visuais dos personagens e vilões iguais"). Em Node: o SHA-256 de reserva confere com o do Node, a senha
// errada não entra, a senha NÃO está em nenhum arquivo (só o hash), os trajes da série existem com o desenho próprio (sem as
// faixas douradas, com os raios das orelhas) e a versão normal não muda (o herói segue 'heroi'). No navegador: a tela de
// início com o botão, a senha errada avisa e digitar nela não mexe no jogo, a senha certa (ou o hash guardado) recarrega na
// edição pessoal com o selo e o traje da série, "Versão normal" volta, e sem erros no console (os shaders compilam).
// A senha nunca vai em arquivo: para testar a entrada por ela, passe THEFLASH_SENHA no ambiente (sem ela, o teste guarda o
// hash direto, como o aparelho faz depois de acertar).
// Uso: node velocista/tools/teste-edicao.mjs [--sem-navegador]
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const args = process.argv.slice(2), SENHA = process.env.THEFLASH_SENHA || '';
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

// ---- 1. a trava ----
const ed = await import(pathToFileURL(path.join(RAIZ, 'js/edicao.js')).href);
const HASH = /const HASH = '([0-9a-f]{64})'/.exec(ler('js/edicao.js'))?.[1];
ok(!!HASH, 'o código guarda só o SHA-256 da senha (64 dígitos hexadecimais)');
for (const t of ['abc', '', 'cortina de fumaça', 'x'.repeat(200)]) ok(ed._sha256JS(t) === crypto.createHash('sha256').update(t).digest('hex'), `SHA-256 de reserva (sem crypto.subtle) igual ao do Node: "${t.slice(0, 20)}"`);
ok(ed.PESSOAL === false, 'sem a senha guardada, a página é a versão normal');
ok(!(await ed.conferirSenha('')) && !(await ed.conferirSenha('flash')) && !(await ed.conferirSenha('barry allen')) && !(await ed.conferirSenha(HASH)), 'senha vazia, errada ou o próprio hash não entram');
if (SENHA) {
  ok(await ed.conferirSenha(SENHA) && await ed.conferirSenha(`  ${SENHA.toUpperCase()} `), 'a senha certa entra (sem diferença de maiúsculas e espaços nas pontas)');
  // o que o copiar e colar do celular traz junto (dono, 31/10: "senha errada, copiei e colei"; a seleção pegou o "P" da frase seguinte)
  const colados = [`${SENHA}\n\nP`, `${SENHA}P`, `Senha: ${SENHA}. Pode digitar`, SENHA.replace(/-/g, '\u2011'), SENHA.replace(/-/g, ' – '), SENHA.replace('a', 'á'),
    `\u200B${SENHA}\uFEFF`, SENHA.split('').join('\u200B'), `${SENHA}\n`];
  const r = []; for (const c of colados) r.push(await ed.conferirSenha(c));
  ok(r.every(Boolean), `colada com sobra, quebra de linha, traço tipográfico, acento do corretor ou caractere invisível: entra (${r.map((x) => (x ? 'ok' : 'NÃO')).join(' ')})`);
  const quase = [SENHA.slice(0, -1), SENHA.slice(1), SENHA.slice(0, -1) + (SENHA.at(-1) === '0' ? '1' : '0'), SENHA.slice(0, 20), `${SENHA.slice(0, 15)}x${SENHA.slice(15)}`];
  const q = []; for (const c of quase) q.push(await ed.conferirSenha(c));
  ok(!q.some(Boolean), `um pedaço dela ou ela com um caractere trocado no meio: não entra (${q.map((x) => (x ? 'ENTROU' : 'ok')).join(' ')})`);
  const t0 = performance.now(); await ed.conferirSenha('x'.repeat(200)); const ms = performance.now() - t0;
  ok(ms < 1500, `conferir um texto colado bem comprido (200 letras) leva ${ms.toFixed(0)} ms (< 1,5 s)`);
  // a senha não pode estar escrita em lugar nenhum do jogo (nem no repositório inteiro)
  const achados = [], olhar = (dir) => { for (const n of fs.readdirSync(dir, { withFileTypes: true })) { if (n.name === '.git' || n.name === 'node_modules') continue; const f = path.join(dir, n.name); if (n.isDirectory()) olhar(f); else if (fs.statSync(f).size < 8e6 && fs.readFileSync(f).includes(SENHA)) achados.push(f); } };
  olhar(path.join(RAIZ, '..'));
  ok(!achados.length, `a senha não aparece em nenhum arquivo do repositório (${achados.slice(0, 3).join(', ')})`);
} else console.log('     (sem THEFLASH_SENHA: a entrada pela senha e a busca dela nos arquivos ficam de fora)');

// ---- 2. os trajes da série ----
const traje = ler('js/traje.js'), humano = ler('js/humano.js');
const paleta = (n) => new RegExp(`\\n  ${n}: \\{[^\\n]*\\}`).exec(traje)?.[0] || '';
ok(/serie: true/.test(paleta('heroiSerie')) && /orelhas: true/.test(paleta('heroiSerie')) && !/raioTesta/.test(paleta('heroiSerie')), 'heroiSerie: o desenho da série (sem faixas douradas) com os raios das orelhas, sem o raio da testa');
ok(/desenho: 'novo'/.test(paleta('novoSerie')) && /orelhas: true/.test(paleta('novoSerie')), 'novoSerie: o traje novo com os raios das orelhas no lugar das asas');
ok(/serie: true/.test(paleta('reversoSerie')) && /orelhas: true/.test(paleta('reversoSerie')), 'reversoSerie: o Reverso no desenho da série');
{ const [v, o] = [/verm: \[([^\]]+)\]/, /ouro: \[([^\]]+)\]/].map((r) => r.exec(paleta('reversoSerie'))[1].split(',').map(Number));
  ok(v[0] > 0.5 && v[1] > 0.3 && v[2] < 0.1 && o[0] > 0.4 && o[1] < 0.1, 'o Reverso da série é amarelo com os detalhes vermelhos'); }
ok(/#ifdef SERIE[\s\S]*?cost = max\(cost, tLosangos/.test(traje) && /#ifndef SERIE|#ifdef SERIE[\s\S]*?#else[\s\S]*?as duas faixas da lateral externa/.test(traje), 'no desenho da série as faixas douradas saem e entra o couro acolchoado');
ok(/#ifdef ORELHAS\s+ouro = max\(ouro, tOrelha\(q\)\)/.test(traje) && /#ifdef ORELHAS\s+float asa = tOrelha\(q\)/.test(traje), 'os raios das orelhas nos dois capuzes');
for (const n of ['heroiSerie', 'novoSerie', 'reversoSerie']) ok(new RegExp(`${n}: \\{ disco: 0x[0-9a-f]+, cor: 0x[0-9a-f]+, emissivo: 0x[0-9a-f]+, forma: 'raio'`).test(humano), `emblema de ${n}: o raio no círculo`);
ok(/const TRAJE_SERIE = \{ heroi: 'heroiSerie', novo: 'novoSerie', reverso: 'reversoSerie' \}/.test(humano) && /\(pessoal && TRAJE_SERIE\[traje\]\) \|\| traje/.test(humano) && /if \(!pessoa\) traje = trajeDaEdicao\(traje\)/.test(humano), 'só na edição pessoal o herói e o Reverso trocam de traje (as pessoas da história e os outros vilões não)');
// a versão normal fica como está: as paletas de antes seguem iguais
ok(/\n  heroi: \{ verm: \[0\.24, 0\.010, 0\.016\]/.test(traje) && /\n  novo: \{ verm: \[0\.30, 0\.011, 0\.018\]/.test(traje) && /\n  reverso: \{ verm: \[0\.62, 0\.40, 0\.015\]/.test(traje), 'a versão normal: os trajes de antes não mudaram');

// ---- 3. a página ----
const html = ler('index.html'), jogo = ler('js/jogo.js');
ok(/id="btnEdicao"/.test(html) && /id="formSenha"/.test(html) && /type="password"/.test(html) && /id="seloEdicao"/.test(html) && /id="seloPausa"/.test(html), 'a tela de início tem o botão, o campo de senha e o selo (também na pausa)');
ok(/\$\('senha'\)\.addEventListener\('keydown', \(e\) => e\.stopPropagation\(\)\)/.test(jogo), 'digitar a senha não mexe no jogo');

if (!args.includes('--sem-navegador')) {
  const { servidor, abrir } = await import(pathToFileURL(path.join(AQUI, '../../golaco/tools/lib/navegador.mjs')).href);
  const srv = await servidor(0, RAIZ);
  const { navegador, pagina, erros } = await abrir({ largura: 960, altura: 540 });
  pagina.setDefaultTimeout(1200000);                     // o Chromium sem GPU daqui é lento: o jogo ocupa a página
  const pronto = () => pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
  await pagina.goto(srv.url, { timeout: 1200000 }); await pronto();
  ok(await pagina.evaluate(() => window.__rel.PESSOAL === false && document.getElementById('seloEdicao').hidden && document.getElementById('btnEdicao').textContent === 'Edição pessoal'), 'versão normal: sem selo, o botão "Edição pessoal"');
  await pagina.click('#btnEdicao');
  ok(await pagina.evaluate(() => !document.getElementById('formSenha').hidden && document.activeElement?.id === 'senha'), 'o botão abre o campo da senha (com o foco nele)');
  const mapa0 = await pagina.evaluate(() => document.getElementById('mapaBox').classList.contains('grande'));
  await pagina.keyboard.type('mph errada'); await pagina.keyboard.press('Enter');
  await pagina.waitForFunction(() => !document.getElementById('senhaErro').hidden, null, { timeout: 60000 });
  ok(await pagina.evaluate((m) => window.__rel.J.modo === 'menu' && document.getElementById('mapaBox').classList.contains('grande') === m && !localStorage.getItem('theflash.edicao.v1'), mapa0), 'senha errada: avisa, não entra, e as teclas digitadas não mexeram no jogo (nem o Enter começou)');
  if (SENHA) {
    await pagina.fill('#senha', `${SENHA}\n\nP`);                 // (como o dono colou: a seleção pegou o começo da frase seguinte)
    await Promise.all([pagina.waitForNavigation({ timeout: 1200000 }), pagina.press('#senha', 'Enter')]);
  } else {
    await pagina.evaluate((h) => localStorage.setItem('theflash.edicao.v1', h), HASH);
    await pagina.reload({ timeout: 1200000 });
  }
  await pronto();
  ok(await pagina.evaluate(() => window.__rel.PESSOAL === true && !document.getElementById('seloEdicao').hidden && document.getElementById('btnEdicao').textContent === 'Versão normal' && document.documentElement.classList.contains('pessoal')), `edição pessoal (${SENHA ? 'pela senha' : 'pelo hash guardado'}): o selo e o botão "Versão normal"`);
  await pagina.waitForFunction(() => !!window.__rel.modelo, null, { timeout: 1200000, polling: 500 });
  ok(await pagina.evaluate(() => window.__rel.modelo.materiais[0].customProgramCacheKey() === 'traje-corpo-heroiSerie' && window.__rel.modelo.materiais[1].customProgramCacheKey() === 'traje-cabeca-heroiSerie'), 'o herói veste o traje da série');
  // começa o jogo e desenha uns quadros com o herói na tela (o shader da série compila)
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  await pagina.evaluate(() => new Promise((r) => { let k = 0; const f = () => (++k >= 20 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  await pagina.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); });
  ok(await pagina.evaluate(() => !document.getElementById('seloPausa').hidden), 'o selo também na pausa');
  ok(await pagina.evaluate(() => { const b = document.getElementById('btnEdicao'); return document.getElementById('telaPausa').contains(b) && b.offsetParent !== null && b.textContent === 'Versão normal' && getComputedStyle(document.getElementById('seloEdicao')).display === 'none'; }),
    'na pausa, o botão da edição (aqui, "Versão normal"), sem repetir o selo');
  // volta para a versão normal
  await Promise.all([pagina.waitForNavigation({ timeout: 1200000 }), pagina.evaluate(() => document.getElementById('btnEdicao').click())]);
  await pronto();
  ok(await pagina.evaluate(() => window.__rel.PESSOAL === false && !localStorage.getItem('theflash.edicao.v1') && document.getElementById('seloEdicao').hidden), '"Versão normal": esquece a senha neste aparelho e volta como era');
  await pagina.waitForFunction(() => !!window.__rel.modelo, null, { timeout: 1200000, polling: 500 });
  ok(await pagina.evaluate(() => window.__rel.modelo.materiais[0].customProgramCacheKey() === 'traje-corpo-heroi'), 'e o herói volta ao traje de sempre');
  // no meio do jogo (dono, 31/10: "não sei como bota"): a entrada da edição pessoal também na pausa, com o campo da senha
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  await pagina.evaluate(() => new Promise((r) => { let k = 0; const f = () => (++k >= 10 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  await pagina.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); });
  ok(await pagina.evaluate(() => { const b = document.getElementById('btnEdicao'); return window.__rel.J.modo === 'pausa' && document.getElementById('telaPausa').contains(b) && b.offsetParent !== null && b.textContent === 'Edição pessoal'; }),
    'versão normal, no meio do jogo: a pausa tem o botão "Edição pessoal"');
  await pagina.evaluate(() => document.getElementById('btnEdicao').click());
  ok(await pagina.evaluate(() => !document.getElementById('formSenha').hidden && document.getElementById('formSenha').offsetParent !== null && document.activeElement?.id === 'senha'), 'e ele abre o campo da senha ali mesmo');
  await pagina.keyboard.type('p errada'); await pagina.keyboard.press('Enter');
  await pagina.waitForFunction(() => !document.getElementById('senhaErro').hidden, null, { timeout: 60000 });
  ok(await pagina.evaluate(() => window.__rel.J.modo === 'pausa' && !localStorage.getItem('theflash.edicao.v1')), 'digitar a senha na pausa não despausa o jogo (nem o P); senha errada não entra');
  // os outros dois trajes da série na vitrine (compilam sem erro)
  await pagina.evaluate((h) => localStorage.setItem('theflash.edicao.v1', h), HASH);
  for (const t of ['novo', 'reverso']) {
    await pagina.goto(`${srv.url}traje.html?traje=${t}&girar=0`, { timeout: 1200000 });
    await pagina.waitForFunction(() => window.__traje?.pronto && window.__traje.quadros > 5, null, { timeout: 1200000 });
  }
  ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
