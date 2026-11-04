// HUD mínimo (navegador): a tela da PARTIDA com pouca coisa por cima do jogo. Pedido do dono (11/10): "quero menos
// informação na tela", "tem muita coisa na tela", "não quero a linha de impedimento durante o jogo; quando o jogo
// parar por impedimento, aí no replay vai mostrar a linha". Diagnóstico e pesquisa: PESQUISA-ESTADIO.md, "Tela limpa".
//  H1 área do HUD no celular deitado (união geométrica: caixas visíveis do #hud + botões de toque como círculos +
//     analógico em repouso quando a opacidade passa de 0,25), no ataque, na defesa e na cobrança do pênalti, em 844×390,
//     667×375, 568×320 e 640×360 (entalhe simulado), com o nome do condutor mais largo no canto da fase — desde o item 32
//     (17/10: placar maior e relógio MM:SS) em 4 estados do relógio ("34:12", "47:13 +4", "97:13 +10", "Intervalo"; o H1 de
//     antes media o relógio em "0'", 240 passos depois de abrir, e o pior caso do jogo de verdade passava dele: 568×320 ia a
//     11,06% com "34'" e a 11,95% nos acréscimos) e, desde a revisão, nos 4 MAIS LARGOS (gols de 2 dígitos com "+10", o
//     relógio de 3 dígitos "100:18 +10", os dois com 10-10 e o intervalo com 10-9: o hud aperta o placar por dígito a mais),
//     sem e com a cara do TM: ≤ 11% em 844×390, 667×375 e 640×360 e ≤ 12% em 568×320 (a tela do iPhone SE de 2016: com MM:SS,
//     escudos e siglas a barra teria de ter ≤ 169 px para os 11%; decisão do dono, FILA "Depende do dono" 15). A 640×360 (o
//     Android de 360 dp deitado) entrou na revisão: a base já passava dos 11% nela (11,09% nos acréscimos); o placar dela é o de
//     26 px, como o da 568×320
//  H1b (revisão do item 32) nos 4 estados largos do H1, nas 4 telas e sem e com a cara do TM: os espaços do placar apertam
//     (topo-c4) com 1 dígito a mais e o "+N" sai (topo-c3) só com 2 ou mais; relógio e gols com o texto certo, as fontes nos
//     mínimos do H10 (gols ≥ 18, relógio ≥ 16, siglas ≥ 12 — 11 nas baixas —, escudos ≥ 14) e nada sai da barra nem se sobrepõe
//  H2 texto na tela durante o jogo fora do placar e dos NOMES dos botões de toque (barra de força, painel, avisos):
//     0 caracteres — nas duas fases das 4 telas e em 2 min de jogo de verdade (a barra de força aparece quando a IA
//     carrega o passe). Os nomes dos botões voltaram por pedido do dono (12/10: "coloca o nome da função do botão
//     de novo") e são medidos no H9
//  H9 nomes dos botões de toque por padrão (dono, 12/10): todo botão visível mostra o nome da função, inteiro dentro
//     do CÍRCULO do botão (a corda na altura do texto), nas duas fases das 4 telas (na versão anterior, só o ícone:
//     reprova; com os botões a 80%, "LANÇAMENTO" passava da borda — em telas pequenas vira "LANÇAR")
//  H3 torcida visível escondida pelo HUD no celular 844×390 (pixels de torcida do canvas — torcida ligada ×
//     desligada, a conta do item 10 do teste-estadio — que caem dentro das formas do HUD), 8 instantes: ≤ 15%
//  H4 linha de impedimento VIVA (com a bola rolando): 0 amostras em 2 min de jogo; a DO LANCE continua no apito
//  H5 PC 1280×720: a dica de teclas aparece no começo e some sozinha (≤ 9 s pelo relógio das animações da página, que
//     atrasa do real com a máquina carregada); depois dela, área do HUD ≤ 2,5%
//  H6 (informativo) jogadores a < 20 m da bola com ≥ 30% do corpo atrás do HUD, média por instante
//  H7 opções da pausa: "Minimapa" (padrão desligado no celular e ligado no PC) e "Nomes nos botões" (padrão
//     LIGADO desde 12/10) mudam a tela, ficam salvas e, com os dois ligados, nada encosta
//     e, no topo da pausa (item 58: a marca e a competição à esquerda; a pílula do placar e o X à direita), nada encosta
//     (folga ≥ 4 px) nem transborda nas 4 telas do H1; as opções (Minimapa e Nomes nos botões) moram no submenu Opções da
//     pausa, que cabe sem rolar; o submenu "Modo de jogo" (Pré-jogo e a cena de substituição, 12/10) cabe sem rolar no
//     celular deitado
//  H8 os ajustes de toque antigos (golaco.toque.v1) não valem mais: todo mundo recebe o padrão novo (80%, 55%)
//  H11 (item 70, P2) os botões PARADINHA e PULINHO aparecem SÓ na cobrança do pênalti da pessoa (a classe cobranca-penalti
//     do #toque, main.js): no ataque e na defesa, nenhum; na cobrança, os dois (e saem ENFIADA e LANÇAMENTO) — com o nome
//     inteiro no círculo (H9) e a área do HUD no orçamento (H1, que mede também esse estado); na página de verdade (H11b), o pênalti a favor montado
//     (__golaco.faltaDeTeste na área) liga a classe e a bola rolando a desliga
//  H10 placar — 12/10 o dono pediu MENOR ("quero o placar assim, tem que ser algo menor e mais com a nossa cara", com a
//     barra de TV de referência: o H10 exigia ≤ 24/26 px e menor que o de antes); 17/10, POSTERIOR, manda MAIOR ("o placar
//     com mais a cara do Total Match, um pouco MAIOR e o relógio com os SEGUNDOS além dos minutos": item 32). Nas 4 telas
//     do celular (com entalhe) e no PC 1280×720, sem e com a cara do TM, no jogo ("34:12"), nos acréscimos ("47:13 +4" e
//     "97:13 +10"), no intervalo e no fim —
//     a) formato: marca (o símbolo do GOLAÇO ou do TM; na partida só com mais de 700 px de largura e no PC — até 700 px,
//        AUSENTE), escudo + sigla da casa, placar, sigla + escudo do visitante (Golaço FC e Ventania FC) e o relógio
//        fechando a barra; #relogio em MM:SS no jogo e nos acréscimos, o "+N" visível só nos acréscimos, "Intervalo"/"Fim"
//        no lugar do relógio com .parado; bloco verde rolando e escuro parado, contraste ≥ 4,5:1 nos dois; com a cara do
//        TM, a Inter TM no relógio e nos gols (document.fonts.check) e o símbolo do TM na marca;
//     b) maior, "um pouco": altura 28 ± 0,5 px nos celulares, 26 nos baixos (≤ 340 px de altura ou ≤ 700 × 360: 568×320 e
//        640×360) e 30 no PC; maior que a de 12/10 (PLACAR_1210: 24/26 px, medido na b3041818 com --raiz); gols ≥ 18 px
//        (PC ≥ 20) e relógio ≥ 16 px (PC ≥ 17) no jogo e nos acréscimos; "um pouco": ≤ 29 px no celular (a referência do
//        dono), a área no jogo ≤ 1,5 × a de 12/10 na mesma tela e, em 844×390, ≤ 7192 px² (a referência, 248×29);
//     c) legível: siglas ≥ 11 px (≥ 12 fora das telas baixas e no PC; Apple HIG e Material 3: 11), "+N" ≥ 11 px,
//        "Intervalo"/"Fim" ≥ 13 px, escudos ≥ 14 px;
//     d) nada encosta: as peças dentro da barra e sem se sobrepor; com o minimapa ligado e o placar mais largo ("+10"),
//        nada encosta (folga ≥ 4 px) e o "+N" continua na tela; com gols de 2 dígitos (10-9) também; no treino de ataque com
//        o minimapa e o painel, nada encosta e a marca fica;
//     e) leitor de tela: o placar tem o nome dos dois times (Golaço FC e Ventania FC; na tela só as siglas)
//  H14 (item 32) o relógio anda na página: a) 844×390, a partida da demo (semente 4), relógio manual, 600 quadros (10 s
//     reais): o #relogio sempre em MM:SS, avança 112 ± 2 s de jogo (11,25 por segundo real) e nunca volta; escritas no
//     #relogio (MutationObserver) ≤ textos distintos + 1 (só escreve quando muda); a largura do placar constante (± 0,5
//     px: os dígitos de largura fixa); b) ?min=0.25 até o fim: o "+N" (N = partida.acrescimo) com o relógio ≥ "45:00",
//     "Intervalo" com .parado, o 2º tempo abre em "45:0x", o "+N" no 2º tempo e "Fim" com .parado
//  H12 (itens 59 e 60, dono 23/10: "o campinho que está lá em cima tem que ficar lá embaixo") o minimapa embaixo, no meio,
//     entre o analógico e os botões —
//     a) celular 844×390, 667×375, 568×320 e 640×360, com e sem entalhe: a 80% (o padrão) visível com 92×60; a 70, 100 e
//        140% visível (≥ 76×50, |cx − W/2| ≤ 0,12·W, base a ≤ 6 px de H − sa.b, ≥ 8 px do analógico em repouso e de todo
//        botão das duas fases, ≥ 4 px dos dois nomes forçados) OU escondido com html.mapa-sem-lugar e a varredura do PRÓPRIO
//        teste confirma que nenhum 76×50 caberia (não some à toa);
//     b) nada no alto: na partida com o minimapa ligado, nenhuma caixa do #hud com o topo acima de 30% da altura além do
//        placar e do menu (4 telas e o PC);
//     c) torcida atrás do minimapa ligado (844×390, os 8 instantes do H3): ≤ 1% dos pixels de torcida (na base, no alto: 5,5%);
//     d) a faixa do fim de jogo (com os botões) esconde o minimapa; a do intervalo e a "Você foi expulso" (com o botão) ficam
//        a ≥ 4 px dele — 4 telas com entalhe, com e sem a cara do TM (a faixa do TM desce para baixo do aviso);
//     e) o "Tamanho" mudado na pausa (70 → 140 → 80%) reposiciona sem resize: volta ao lugar do 80%;
//     f) PC 1280×720 e 1920×1080: como antes (centro em W/2 ± 1, base em H − 14 ± 1)
//  H13 (item 60, dono 23/10: "o nome do jogador com a bola fica tapando e atrapalhando o jogo") o nome nos cantos de baixo —
//     a) o time da ESQUERDA do placar (0) com a bola: canto inferior esquerdo (≤ 16 px da borda segura, base a ≤ 6 px de
//        H − sa.b, acima nada: topo ≥ base do analógico em repouso + 2); o da direita (1): canto inferior direito (topo ≥ base
//        do círculo mais baixo do arco + 2); ≥ 4 px de todo botão, do minimapa ligado e do placar; pelo caminho de verdade
//        (cenaDeTeste: o meu goleiro com a bola no pé × o adversário com a bola) e com o nome mais largo forçado, nas 4 telas,
//        com e sem entalhe, a 70, 80 e 100%; PC nos cantos a 14 px;
//     b) o texto é "número camisa" da ficha de quem tem a bola; letra ≥ 11 px (celular) / 12 (PC); contraste ≥ 4,5:1; a faixa
//        de cor = a do placar daquele time;
//     c) nome de 10 'W': caixa ≤ 88 px (≤ 600 px de largura) / 120 (outros celulares) / 200 (PC), reticências, número inteiro;
//     d) o lado vem do placar: no 2º tempo (o campo trocou de lado) o meu goleiro com a bola continua à esquerda;
//     e) some: bola solta (0,5 s apagado, 1,0 s fora), intervalo e fim, as 4 camadas (replay, comemoração, substituição,
//        cena), treino de ataque, disputa de pênaltis e ?prints=1; aparece no Modo Livre;
//     f) sem piscar: em 2 min de jogo, 0 voltas depois de < 0,8 s escondido (na base, 22); escritas no DOM (informativo);
//     g) PC: com a dica de teclas na tela o nome da esquerda fica na linha de baixo, à direita dela (≥ 4 px; em cima dela
//        encostava na faixa ENTRA/SAI do jogo); em janela estreita (560 × 600) ele cabe entre a dica e o minimapa (≥ 56 px,
//        ≥ 4 px dos dois) ou some até ela sumir (era uma lasca de 8 px por cima do minimapa); depois que ela some, no canto, e
//        uma camada (replay, cena) que liga e desliga não a traz de volta (voltava por 8 s debaixo do nome)
//  H1c/H2c/H1d/H1e/H9c (item 65: "essa seta, essa reta ... tem que estar com a cara do Total Match, alguma coisa mais
//     minimalista") a cobrança mirada DE VERDADE (escanteio e tiro livre da pessoa, __golaco.bolaParadaDeTeste/faltaDeTeste,
//     com o módulo da bola parada), nas 4 telas com o entalhe, sem e com a cara do TM, com o nome do condutor mais largo e o
//     placar mais largo do H1 ("10-10 100:18 +10"): H1c a área do HUD ≤ 11 / 11 / 11 / 12% (a régua do H1; na base 12,95% em
//     667×375, 13,14% em 640×360 e 14,45% em 568×320 — os 2 botões CURVA e o painel #mira); H2c nenhum texto fora do placar,
//     do nome e dos nomes dos botões (na base o rótulo ALTA/CHUTE); H1d nenhum botão CURVA; H1e nada encosta (folga ≥ 4 px; na
//     base o painel invadia o CORRER em 11 px em 568×320); H9c os chevrons ‹ › do gesto da curva (no CHUTE e no LANÇAMENTO)
//     dentro do círculo (≥ 2 px da borda) e sem encostar no nome do botão (≥ 1 px)
//   node tools/teste-hud-minimo.mjs [--raiz <pasta do jogo>] [--so-placar] [--so-mirada]   (--raiz: mede outra cópia, ex.: a
//   base; --so-placar: só as telas do H1/H7/H9, o H5 com o H10 e o H14, sem os 2 min de jogo nem as opções salvas — para iterar
//   no placar; --so-mirada: só a cobrança mirada, H1c/H2c/H1d/H1e/H9c)
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const soPlacar = args.includes('--so-placar');
const soMirada = args.includes('--so-mirada');
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const srv = await servidor(0, raiz);
const pronta = pg => pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });

// formas do HUD visíveis (no navegador): retângulos e círculos; e o texto visível fora do placar
// (itens 59 e 60: a caixa SEM fundo, sem borda e sem sombra — o ≡ da partida, um alvo de toque de 44 × 44 transparente com o
// ícone de 22 × 22 — conta pelo que se vê: a união dos filhos visíveis. A régua de antes contava o alvo inteiro)
const FORMAS = () => {
  const vis = e => e && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.01;
  const alfa = c => { const v = (c.match(/[\d.]+/g) ?? []).map(Number); return v.length > 3 ? v[3] : v.length ? 1 : 0; };
  const transparente = e => {
    const s = getComputedStyle(e);
    return alfa(s.backgroundColor) < 0.01 && s.backgroundImage === 'none' && s.boxShadow === 'none'
      && ['Top', 'Right', 'Bottom', 'Left'].every(l => parseFloat(s[`border${l}Width`]) === 0 || s[`border${l}Style`] === 'none' || alfa(s[`border${l}Color`]) < 0.01);
  };
  const f = [];
  for (const e of document.querySelectorAll('#hud [data-caixa], #carga.visivel')) {
    if (!vis(e)) continue;
    let r = e.getBoundingClientRect();
    if (e.children.length && transparente(e)) {
      let u = null;
      for (const c of e.children) {
        const cs = getComputedStyle(c);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const q = c.getBoundingClientRect();
        if (q.width < 1 || q.height < 1) continue;
        u = u ? { left: Math.min(u.left, q.left), top: Math.min(u.top, q.top), right: Math.max(u.right, q.right), bottom: Math.max(u.bottom, q.bottom) } : { left: q.left, top: q.top, right: q.right, bottom: q.bottom };
      }
      if (u) r = { ...u, width: u.right - u.left, height: u.bottom - u.top };
    }
    if (r.width >= 1 && r.height >= 1) f.push({ nome: e.dataset.caixa || e.id, ret: [r.left, r.top, r.right, r.bottom] });
  }
  for (const e of document.querySelectorAll('#toque:not([hidden]) .btn-toque')) {
    if (getComputedStyle(e).display === 'none' || e.offsetWidth === 0) continue;
    f.push({ nome: e.id, circ: [e.offsetLeft + e.offsetWidth / 2, e.offsetTop + e.offsetHeight / 2, Math.min(e.offsetWidth, e.offsetHeight) / 2] });
  }
  const ab = document.querySelector('#toque:not([hidden]) .analogico-base');
  const op = ab ? +getComputedStyle(document.getElementById('analogico')).opacity : 0;
  if (ab && op > 0.25) { const r = ab.getBoundingClientRect(); if (r.width > 0) f.push({ nome: 'analogico', circ: [r.left + r.width / 2, r.top + r.height / 2, r.width / 2] }); }
  // (o nome do jogador com a bola, item 60: a exceção escrita à "sem narração", como o placar — só número e nome, conferido
  // à parte pelo H2)
  let fora = 0; const txt = [];
  for (const e of document.querySelectorAll('#hud *, #toque *')) {
    if (!vis(e) || e.closest('.placar') || e.closest('.btn-toque') || e.closest('#nome-condutor')) continue;
    for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { fora += n.textContent.trim().length; txt.push(n.textContent.trim()); }
  }
  const nc = document.getElementById('nome-condutor');
  const nome = nc && nc.closest('#hud') && vis(nc) ? [...nc.querySelectorAll('.nc-num, .nc-nome')].map(x => x.textContent.trim()).filter(Boolean).join(' ') : null;
  // nomes dos botões de toque (H9): visível, com texto e inteiro dentro do botão
  const nomes = { botoes: 0, comNome: 0, sem: [] };
  for (const b of document.querySelectorAll('#toque:not([hidden]) .btn-toque')) {
    if (getComputedStyle(b).display === 'none' || b.offsetWidth === 0) continue;
    nomes.botoes++;
    const sp = b.querySelector('span'), rb = b.getBoundingClientRect(), rs = sp ? sp.getBoundingClientRect() : null;
    // inteiro dentro do CÍRCULO (não só do quadrado): na altura do texto, a corda do círculo (pela borda mais longe do
    // centro, a de cima ou a de baixo) tem de conter a largura do texto
    const cx = rb.left + rb.width / 2, cy = rb.top + rb.height / 2, raio = rb.width / 2;
    const dy = rs ? Math.max(Math.abs(rs.top - cy), Math.abs(rs.bottom - cy)) : raio;
    const meia = dy < raio ? Math.sqrt(raio * raio - dy * dy) : 0;
    const ok = sp && vis(sp) && sp.textContent.trim() && rs.width > 0 && rs.left >= cx - meia - 0.5 && rs.right <= cx + meia + 0.5;
    if (ok) nomes.comNome++; else nomes.sem.push(b.id);
  }
  return { f, fora, txt: [...new Set(txt)], nomes, nome };
};
const AREA = (f, W, H) => {
  let n = 0, t = 0;
  for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) {
    t++;
    if (f.some(s => (s.ret ? x >= s.ret[0] && x <= s.ret[2] && y >= s.ret[1] && y <= s.ret[3] : (x - s.circ[0]) ** 2 + (y - s.circ[1]) ** 2 <= s.circ[2] ** 2))) n++;
  }
  return n / t;
};
/** Formas que encostam (folga 4 px; círculo × retângulo pela distância). */
const ENCOSTA = f => {
  const p = [];
  const dRet = (c, r) => Math.hypot(c[0] - Math.max(r[0], Math.min(c[0], r[2])), c[1] - Math.max(r[1], Math.min(c[1], r[3]))) - c[2];
  for (let i = 0; i < f.length; i++) for (let k = i + 1; k < f.length; k++) {
    const a = f[i], b = f[k];
    let d;
    if (a.circ && b.circ) d = Math.hypot(a.circ[0] - b.circ[0], a.circ[1] - b.circ[1]) - a.circ[2] - b.circ[2];
    else if (a.circ) d = dRet(a.circ, b.ret);
    else if (b.circ) d = dRet(b.circ, a.ret);
    else d = Math.max(a.ret[0] - b.ret[2], b.ret[0] - a.ret[2], a.ret[1] - b.ret[3], b.ret[1] - a.ret[3]);
    if (d < 4) p.push(`${a.nome} × ${b.nome}`);
  }
  return p;
};

// H10 (item 32): o placar no estado pedido (gols e relógio como o laço passa ao HUD, pelo __golaco.placarDeTeste com o relógio
// manual parado: o laço não o reescreve) e as medidas dele. O relógio leva o {segundo} novo E o {minuto} de antes: a base
// (b3041818, --raiz) escreve com ele o formato de 12/10 ("34'", "45+2'" e "1º T +4") — o "antes" medido.
const ESTADOS_PLACAR = [
  ['jogo', [1, 0], { minuto: 34, segundo: 2052, tempo: 1, estado: 'jogo', acrescimo: null }],
  ['+4', [2, 1], { minuto: 45, segundo: 2833, tempo: 1, estado: 'jogo', acrescimo: { anunciado: 4, decorrido: 2 } }],
  ['+10', [2, 1], { minuto: 90, segundo: 5833, tempo: 2, estado: 'jogo', acrescimo: { anunciado: 10, decorrido: 7 } }],
  ['intervalo', [2, 1], { minuto: 45, segundo: 2700, tempo: 1, estado: 'intervalo', acrescimo: null }],
  ['fim', [3, 1], { minuto: 90, segundo: 5400, tempo: 2, estado: 'fim', acrescimo: null }],
];
/** H1: os estados do relógio medidos na área (o fim é o mais estreito: só no H10). */
const ESTADOS_H1 = ESTADOS_PLACAR.slice(0, 4);
// H1 (revisão do item 32): também os estados MAIS LARGOS, com o nº de dígitos a mais que o placar mais largo de todo dia (gols
// de 1 dígito e "97:13 +10") — gols de 2 dígitos (10-9) e o relógio de 3 (o "100:18", que só existe na pausa de um gol depois
// dos +10), cada um sozinho, os dois juntos com os dois gols de 2 dígitos (10-10 e "100:18 +10": o mais largo possível) e o
// intervalo com 10-9. O hud aperta o placar pelos passos do aperto (1 dígito a mais: os espaços; 2 ou mais: também o "+N").
// Antes da revisão: 667×375 a 11,10% com 10-9 e "+10" e a 11,08% com "100:18 +10"; 568×320 a 12,02%. Só no H1 e no H1b (o
// H10 mede os 5 de todo dia)
const REL_100 = { minuto: 90, segundo: 6018, tempo: 2, estado: 'gol', acrescimo: { anunciado: 10, decorrido: 10 } };
const ESTADOS_H1_LARGOS = [
  ['10-9 +10', [10, 9], ESTADOS_PLACAR[2][2], 1],
  ['100:18 +10', [2, 1], REL_100, 1],
  ['10-10 100:18 +10', [10, 10], REL_100, 3],
  ['10-9 intervalo', [10, 9], ESTADOS_PLACAR[3][2], 1],
];
/** No navegador: liga (true) ou desliga a cara do TM como o ?tm faz (a classe tm + css/tm.css), com a Inter TM carregada. */
const CARA_TM = async liga => {
  const raizEl = document.documentElement, espera = () => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
  if (liga && !raizEl.classList.contains('tm')) {
    raizEl.classList.add('tm');
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/tm.css'; l.id = 'tm-teste';
    await new Promise(ok => { l.onload = ok; l.onerror = ok; document.head.append(l); });
    await Promise.all([800, 900].map(p => document.fonts.load(`${p} 16px "Inter TM"`, '0123456789:+').catch(() => null)));
    await document.fonts.ready;
  } else if (!liga && document.getElementById('tm-teste')) {
    raizEl.classList.remove('tm'); document.getElementById('tm-teste').remove();
  }
  dispatchEvent(new Event('resize'));
  await espera();
  return raizEl.classList.contains('tm');
};
const MEDIR_PLACAR = async (gols, rel) => {
  const g = window.__golaco;
  g.placarDeTeste(gols, rel);
  for (const e of document.querySelectorAll('.placar-gols')) e.classList.remove('mudou');
  // o topo se ajusta no próximo quadro (resize → requestAnimationFrame)
  await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const ret = e => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }; };
  const pl = document.querySelector('#hud .placar');
  const peca = (nome, e, fonte) => (vis(e) && e.getBoundingClientRect().width > 0 ? { nome, ...ret(e), fs: fonte ? parseFloat(getComputedStyle(fonte).fontSize) : null, txt: e.textContent.trim() } : { nome, ausente: true });
  const esc = [...pl.querySelectorAll('.placar-escudo')];
  const usa = esc.map(e => (e.querySelector('use')?.getAttribute('href') ?? ''));
  const rel0 = document.getElementById('placar-relogio'), relB = document.getElementById('relogio');
  const marcaEl = pl.querySelector('.placar-marca');
  const pecas = [
    peca('marca', marcaEl),
    peca('escudo da casa', esc[0]), peca('sigla da casa', document.getElementById('sigla-0'), document.getElementById('sigla-0')),
    peca('gols da casa', document.getElementById('gols-0'), document.getElementById('gols-0')),
    peca('gols do visitante', document.getElementById('gols-1'), document.getElementById('gols-1')),
    peca('sigla do visitante', document.getElementById('sigla-1'), document.getElementById('sigla-1')), peca('escudo do visitante', esc[1]),
    peca('relógio', rel0, relB),
  ];
  const tempo = document.getElementById('relogio-tempo');
  const rgb = c => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  // o fundo do bloco do relógio: a cor (o GOLAÇO) ou as cores do degradê (o TM, --tm-botao): o contraste pela PIOR delas
  const cs = getComputedStyle(rel0);
  const cores = /gradient/.test(cs.backgroundImage) ? (cs.backgroundImage.match(/rgba?\([^)]*\)/g) ?? []).map(rgb) : [rgb(cs.backgroundColor)];
  const letra = rgb(getComputedStyle(relB).color);
  const contraste = Math.min(...cores.map(c => { const l1 = lum(c), l2 = lum(letra); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }));
  const alfa = Math.min(...cores.map(c => (c.length > 3 ? c[3] : 1)));
  const fam = e => (e ? getComputedStyle(e).fontFamily : '');
  return {
    caixa: ret(pl), pecas, usa, cls: document.documentElement.className, W: innerWidth, H: innerHeight,
    corCasa: (() => { const e = pl.querySelector('#placar-time-0 .placar-cor'); return vis(e) ? ret(e) : null; })(),
    tempo: vis(tempo) && tempo.getBoundingClientRect().width > 0 ? { fs: parseFloat(getComputedStyle(tempo).fontSize), ...ret(tempo), txt: tempo.textContent.trim() } : null,
    relogio: { txt: relB.textContent.trim(), parado: rel0.classList.contains('parado'), cores, alfa, lum: Math.max(...cores.map(lum)), contraste, fs: parseFloat(getComputedStyle(relB).fontSize) },
    tm: document.documentElement.classList.contains('tm'),
    fontes: { relogio: fam(relB), gols: fam(document.getElementById('gols-0')), interTM: document.fonts.check('800 16px "Inter TM"') && document.fonts.check('900 16px "Inter TM"') },
    marcaFundo: marcaEl && vis(marcaEl) ? getComputedStyle(marcaEl).backgroundImage : null,
  };
};
// o placar de 12/10 (b3041818, medido com este teste e --raiz, sem a cara do TM): no jogo ("34'"; igual nas 3 telas do
// celular: nada aperta) — a régua do "um pouco maior" — e a referência do dono (a barra de TV de 248×29 px numa tela de
// 844×390: 2532×1170 com 3 px por px)
const PLACAR_1210 = { celular: { h: 24, area: 4847 }, pc: { h: 26, area: 5349 } };
const PLACAR_REF = { h: 29, area: 248 * 29 };
const PLACAR_ALT = { celular: 28, baixo: 26, pc: 30 };
/** As telas do celular deitado (com entalhe) do H1, H7, H9, H10, H11, H12 e H13: 844×390, 667×375, 568×320 e, desde a revisão do
 * item 32, a 640×360 (o Android de 360 dp deitado: a base já passava dos 11% de HUD nela, 11,09% nos acréscimos). */
const TELAS_CEL = [[844, 390], [667, 375], [568, 320], [640, 360]];
/** A tela baixa do celular, com o placar de 26 px (o estilo.css): ≤ 340 px de altura, ou ≤ 700 × 360. */
const telaBaixa = (W, H) => H <= 340 || (W <= 700 && H <= 360);
const placarFalhas = [], placarLinhas = [];
/** Confere um estado medido (H10 a–d). tela: '844×390' etc.; tipo: 'celular' | 'pc'. */
function conferirPlacar(tela, tipo, estado, r) {
  const f = [], c = r.caixa, baixo = tipo === 'celular' && telaBaixa(r.W, r.H);
  const alt = tipo === 'pc' ? PLACAR_ALT.pc : baixo ? PLACAR_ALT.baixo : PLACAR_ALT.celular;
  const rolando = estado === 'jogo' || estado === '+4' || estado === '+10', acresc = estado === '+4' || estado === '+10';
  const p = Object.fromEntries(r.pecas.map(x => [x.nome, x]));
  // a) a marca só no PC e com mais de 700 px de largura (na partida); as outras peças sempre
  const comMarca = tipo === 'pc' || r.W > 700;
  const faltam = r.pecas.filter(x => x.ausente && x.nome !== 'marca').map(x => x.nome);
  if (comMarca && p.marca.ausente) faltam.unshift('marca');
  if (!comMarca && !p.marca.ausente) f.push(`marca na tela com ${r.W} px de largura`);
  if (faltam.length) f.push(`falta: ${faltam.join(', ')}`);
  if (!faltam.length) {
    const ordem = r.pecas.filter(x => !x.ausente).map(x => x.nome);
    for (let i = 1; i < ordem.length; i++) if (!(p[ordem[i]].l >= p[ordem[i - 1]].l + 1)) f.push(`${ordem[i]} não vem depois de ${ordem[i - 1]}`);
    // sem a marca, a barra começa pela faixa da cor da casa (o escudo vem logo depois dela)
    const comeco = comMarca ? p.marca : r.corCasa;
    if (!comeco || comeco.l - c.l > 2) f.push(`${comMarca ? 'a marca' : 'a cor da casa'} não começa a barra`);
    if (c.r - p['relógio'].r > 2) f.push('o relógio não fecha a barra');
    if (!/escudo-golaco$/.test(r.usa[0] ?? '') || !/escudo-ventania$/.test(r.usa[1] ?? '')) f.push(`escudos ${r.usa.join(' / ') || 'nenhum'}`);
    if (p['sigla da casa'].txt !== 'GLÇ' || p['sigla do visitante'].txt !== 'VNT') f.push(`siglas ${p['sigla da casa'].txt}/${p['sigla do visitante'].txt}`);
  }
  // a) o texto do relógio: MM:SS rolando, o "+N" só nos acréscimos, a palavra parada
  const ESTADO_REL = ESTADOS_PLACAR.find(e => e[0] === estado)[2];
  if (rolando && !/^\d{2,3}:\d{2}$/.test(r.relogio.txt)) f.push(`relógio "${r.relogio.txt}" fora de MM:SS`);
  if (acresc) { if (!r.tempo || r.tempo.txt !== `+${ESTADO_REL.acrescimo.anunciado}`) f.push(`"+${ESTADO_REL.acrescimo.anunciado}" ${r.tempo ? `é "${r.tempo.txt}"` : 'não aparece'}`); }
  else if (r.tempo) f.push(`"${r.tempo.txt}" ao lado do relógio`);
  if (estado === 'intervalo' && r.relogio.txt !== 'Intervalo') f.push(`intervalo "${r.relogio.txt}"`);
  if (estado === 'fim' && r.relogio.txt !== 'Fim') f.push(`fim "${r.relogio.txt}"`);
  if (r.relogio.parado !== !rolando) f.push(rolando ? 'parado com a bola rolando' : 'sem .parado');
  // bloco verde rolando, escuro parado; letras legíveis nos dois
  const [rr, gg, bb] = r.relogio.cores[0] ?? [0, 0, 0];
  if (rolando && !(r.relogio.alfa > 0.9 && gg >= 170 && gg - rr >= 90 && gg - bb >= 50)) f.push(`relógio sem o bloco verde (${r.relogio.cores.map(x => x.join(',')).join(' → ')})`);
  if (!rolando && !(r.relogio.alfa > 0.9 && r.relogio.lum <= 0.2 && gg > rr && gg > bb)) f.push(`parado sem o bloco verde-escuro (${r.relogio.cores.map(x => x.join(',')).join(' → ')})`);
  if (r.relogio.contraste < 4.5) f.push(`contraste do relógio ${r.relogio.contraste.toFixed(1)}:1`);
  // a) com a cara do TM: a Inter TM no relógio e nos gols e o símbolo do TM na marca
  if (r.tm) {
    if (!/^"?Inter TM"?/.test(r.fontes.relogio) || !/^"?Inter TM"?/.test(r.fontes.gols)) f.push(`fonte ${r.fontes.relogio} / ${r.fontes.gols}`);
    if (!r.fontes.interTM) f.push('a Inter TM 800/900 não carregou');
    if (comMarca && !/simbolo\.png/.test(r.marcaFundo ?? '')) f.push(`marca sem o símbolo do TM (${r.marcaFundo})`);
  }
  // b) maior, "um pouco"
  const area = c.w * c.h, antes = PLACAR_1210[tipo];
  if (Math.abs(c.h - alt) > 0.5) f.push(`altura ${c.h.toFixed(1)} ≠ ${alt}`);
  if (!(c.h > antes.h)) f.push(`altura ${c.h.toFixed(1)} ≤ a de 12/10 (${antes.h})`);
  if (tipo === 'celular' && c.h > PLACAR_REF.h + 0.5) f.push(`altura ${c.h.toFixed(1)} > a referência (${PLACAR_REF.h})`);
  if (estado === 'jogo') {
    if (area > 1.5 * antes.area) f.push(`área ${area.toFixed(0)} > 1,5 × a de 12/10 (${antes.area})`);
    if (tela === '844×390' && area > PLACAR_REF.area) f.push(`área ${area.toFixed(0)} > a referência (${PLACAR_REF.area})`);
  }
  const minGols = tipo === 'pc' ? 20 : 18, minRel = tipo === 'pc' ? 17 : 16;
  for (const n of ['gols da casa', 'gols do visitante']) if (p[n] && !p[n].ausente && !(p[n].fs >= minGols)) f.push(`${n} ${p[n].fs} px`);
  if (rolando && !(r.relogio.fs >= minRel)) f.push(`relógio ${r.relogio.fs} px`);
  // c) legível
  const minSigla = tipo === 'pc' || !baixo ? 12 : 11;
  for (const n of ['sigla da casa', 'sigla do visitante']) if (p[n] && !p[n].ausente && !(p[n].fs >= minSigla)) f.push(`${n} ${p[n].fs} px`);
  for (const n of ['escudo da casa', 'escudo do visitante']) if (p[n] && !p[n].ausente && !(p[n].h >= 14 - 0.01)) f.push(`${n} ${p[n].h.toFixed(1)} px`);
  if (acresc && r.tempo && !(r.tempo.fs >= 11)) f.push(`"${r.tempo.txt}" ${r.tempo.fs} px`);
  if (!rolando && !(r.relogio.fs >= 13)) f.push(`"${r.relogio.txt}" ${r.relogio.fs} px`);
  // d) peças dentro da barra e sem sobrepor
  f.push(...pecasNaBarra(r));
  const rot = `${tela}${r.tm ? ' TM' : ''} ${estado}`;
  placarLinhas.push(`${rot} "${r.relogio.txt}${r.tempo ? ' ' + r.tempo.txt : ''}" ${c.w.toFixed(0)}×${c.h.toFixed(0)} = ${area.toFixed(0)} px²${p['gols da casa']?.fs ? ` (gols ${p['gols da casa'].fs}, sigla ${p['sigla da casa']?.fs}, relógio ${r.relogio.fs}${r.tempo ? `, ${r.tempo.txt} ${r.tempo.fs}` : ''} px)` : ''}`);
  if (f.length) placarFalhas.push(`${rot}: ${f.join('; ')}`);
  return { area, h: c.h };
}
const placarEncosta = [], placarTreino = []; let placarAria = '';
/** H10d e H1b: as peças do placar medido dentro da barra e sem se sobrepor (a lista de falhas). */
function pecasNaBarra(r) {
  const f = [], c = r.caixa, dentro = r.pecas.filter(x => !x.ausente);
  for (const x of dentro) if (x.l < c.l - 0.5 || x.r > c.r + 0.5 || x.t < c.t - 0.5 || x.b > c.b + 0.5) f.push(`${x.nome} sai do placar`);
  for (let i = 0; i < dentro.length; i++) for (let k = i + 1; k < dentro.length; k++) {
    const a = dentro[i], b = dentro[k];
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) f.push(`${a.nome} × ${b.nome}`);
  }
  return f;
}
const largoFalhas = [], largoLinhas = [];
/**
 * H1b: o placar num estado largo (ESTADOS_H1_LARGOS; extra = dígitos a mais): o hud o aperta pelos passos do aperto — os
 * espaços (topo-c4) com 1 ou mais; o "+N" (topo-c3) só sai com 2 ou mais —, os textos certos, as fontes nos mínimos do H10 e
 * nada sai da barra nem se sobrepõe.
 */
function conferirLargo(tela, estado, extra, gols, rel, r) {
  const f = [], c = r.caixa, baixo = telaBaixa(r.W, r.H);
  const p = Object.fromEntries(r.pecas.map(x => [x.nome, x]));
  const faltam = r.pecas.filter(x => x.ausente && x.nome !== 'marca').map(x => x.nome);
  if (faltam.length) f.push(`falta: ${faltam.join(', ')}`);
  const rolando = rel.estado !== 'intervalo' && rel.estado !== 'fim', dois = n => String(n).padStart(2, '0');
  const txt = rolando ? `${dois(Math.floor(rel.segundo / 60))}:${dois(rel.segundo % 60)}` : 'Intervalo';
  if (r.relogio.txt !== txt) f.push(`relógio "${r.relogio.txt}" ≠ "${txt}"`);
  if (p['gols da casa']?.txt !== String(gols[0]) || p['gols do visitante']?.txt !== String(gols[1])) f.push(`gols ${p['gols da casa']?.txt}-${p['gols do visitante']?.txt}`);
  const c4 = /\btopo-c4\b/.test(r.cls), c3 = /\btopo-c3\b/.test(r.cls);
  if (!c4) f.push('os espaços não apertaram (sem topo-c4)');
  if (rolando && rel.acrescimo) {
    if (extra === 1 && r.tempo?.txt !== `+${rel.acrescimo.anunciado}`) f.push(`"+${rel.acrescimo.anunciado}" ${r.tempo ? `é "${r.tempo.txt}"` : 'escondido'} com 1 dígito a mais`);
    if (extra >= 2 && r.tempo) f.push(`"${r.tempo.txt}" na tela com ${extra} dígitos a mais`);
  }
  for (const n of ['gols da casa', 'gols do visitante']) if (p[n] && !p[n].ausente && !(p[n].fs >= 18)) f.push(`${n} ${p[n].fs} px`);
  if (rolando && !(r.relogio.fs >= 16)) f.push(`relógio ${r.relogio.fs} px`);
  if (!rolando && !(r.relogio.fs >= 13)) f.push(`"${r.relogio.txt}" ${r.relogio.fs} px`);
  for (const n of ['sigla da casa', 'sigla do visitante']) if (p[n] && !p[n].ausente && !(p[n].fs >= (baixo ? 11 : 12))) f.push(`${n} ${p[n].fs} px`);
  for (const n of ['escudo da casa', 'escudo do visitante']) if (p[n] && !p[n].ausente && !(p[n].h >= 14 - 0.01)) f.push(`${n} ${p[n].h.toFixed(1)} px`);
  f.push(...pecasNaBarra(r));
  const rot = `${tela}${r.tm ? ' TM' : ''} ${estado}`;
  largoLinhas.push(`${rot} "${r.relogio.txt}${r.tempo ? ' ' + r.tempo.txt : ''}" ${c.w.toFixed(0)}×${c.h.toFixed(0)}${c4 ? ' c4' : ''}${c3 ? ' c3' : ''}`);
  if (f.length) largoFalhas.push(`${rot}: ${f.join('; ')}`);
}

// H12 + H13a: a faixa de baixo no celular (itens 59 e 60). No navegador: as margens seguras, os círculos de TODAS as vagas
// do arco (as duas fases: o estilo que a entrada escreve), o analógico em repouso, o minimapa e os dois nomes forçados (o
// mais largo; sem a API, a base, nenhum)
const MEDIR_BAIXO = async () => {
  const g = window.__golaco;
  await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:fixed;left:var(--sa-l);right:var(--sa-r);top:var(--sa-t);bottom:var(--sa-b);pointer-events:none;visibility:hidden';
  document.body.append(sonda);
  const s0 = sonda.getBoundingClientRect(); sonda.remove();
  const W = innerWidth, H = innerHeight;
  const ret = e => {
    if (!e || e.hidden) return null;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || (e.checkVisibility && !e.checkVisibility({ checkVisibilityCSS: true }))) return null;
    const q = e.getBoundingClientRect();
    return q.width > 0 && q.height > 0 ? { l: q.left, t: q.top, r: q.right, b: q.bottom } : null;
  };
  const botoes = [...document.querySelectorAll('#toque .btn-toque[style]')].map(b => {
    const d = parseFloat(b.style.width);
    return d > 0 ? { id: b.id, x: parseFloat(b.style.left) + d / 2, y: parseFloat(b.style.top) + d / 2, d } : null;
  }).filter(Boolean);
  const ba = document.querySelector('#toque:not([hidden]) .analogico-base')?.getBoundingClientRect();
  const nomes = {};
  if (g.nomeCantoDeTeste) {
    for (const t of [0, 1]) { g.nomeCantoDeTeste({ time: t, num: 88, nome: 'Wwwwwwwwww' }); nomes[t] = ret(document.getElementById('nome-condutor')); }
    g.nomeCantoDeTeste(null);
  }
  return {
    W, H, sa: { l: s0.left, t: s0.top, r: W - s0.right, b: H - s0.bottom }, botoes,
    analogico: ba && ba.width > 0 ? { x: ba.left + ba.width / 2, y: ba.top + ba.height / 2, d: ba.width } : null,
    mapa: ret(document.getElementById('minimapa')), placar: ret(document.querySelector('#hud .placar')), nomes,
    api: !!g.nomeCantoDeTeste, cls: document.documentElement.className,
  };
};
const dRetCirc = (q, c) => Math.hypot(c.x - Math.max(q.l, Math.min(c.x, q.r)), c.y - Math.max(q.t, Math.min(c.y, q.b))) - c.d / 2;
const dRetRet = (a, b) => Math.max(b.l - a.r, a.l - b.r, b.t - a.b, a.t - b.b);
/** Algum 76×50 caberia embaixo no meio (a regra do H12a: base a 3 px, até 12% de W para o lado, ≥ 8 px de cada círculo)? */
function cabeMapa(m) {
  const circ = [...m.botoes, ...(m.analogico ? [m.analogico] : [])];
  const b = m.H - m.sa.b - 3, t = b - 50;
  for (let cx = Math.ceil(m.W / 2 - 0.12 * m.W); cx <= m.W / 2 + 0.12 * m.W; cx++) {
    const q = { l: cx - 38, t, r: cx + 38, b };
    if (q.l < m.sa.l || q.r > m.W - m.sa.r) continue;
    if (circ.every(c => dRetCirc(q, c) >= 8)) return cx;
  }
  return null;
}
/** H12a: o minimapa (ligado) na faixa de baixo. Devolve a lista de falhas (vazia = ok) e o resumo. */
function conferirMapa(m, tam) {
  const f = [];
  const mp = m.mapa;
  if (!mp) {
    if (!/\bmapa-sem-lugar\b/.test(m.cls)) f.push('escondido sem mapa-sem-lugar');
    const cx = cabeMapa(m);
    if (cx != null) f.push(`sumiu à toa (76×50 caberia em x ${cx})`);
    return { f, txt: 'sem lugar' };
  }
  const w = mp.r - mp.l, h = mp.b - mp.t, cx = (mp.l + mp.r) / 2;
  if (tam === 0.8 && (Math.abs(w - 92) > 0.6 || Math.abs(h - 60) > 0.6)) f.push(`${w.toFixed(0)}×${h.toFixed(0)} (≠ 92×60)`);
  if (w < 75.5 || h < 49.5) f.push(`${w.toFixed(0)}×${h.toFixed(0)} < 76×50`);
  if (Math.abs(cx - m.W / 2) > 0.12 * m.W + 0.6) f.push(`fora do meio (${(cx - m.W / 2).toFixed(0)} px)`);
  const base = m.H - m.sa.b - mp.b;
  if (base > 6.5 || base < -0.5) f.push(`base a ${base.toFixed(1)} px de H − sa.b`);
  if (mp.t < m.H * 0.5) f.push(`no alto (topo em ${mp.t.toFixed(0)} px)`);
  if (m.analogico && dRetCirc(mp, m.analogico) < 7.5) f.push(`analógico a ${dRetCirc(mp, m.analogico).toFixed(1)} px`);
  for (const c of m.botoes) if (dRetCirc(mp, c) < 7.5) f.push(`${c.id} a ${dRetCirc(mp, c).toFixed(1)} px`);
  for (const t of [0, 1]) if (m.nomes[t] && dRetRet(mp, m.nomes[t]) < 4) f.push(`nome ${t} a ${dRetRet(mp, m.nomes[t]).toFixed(1)} px`);
  return { f, txt: `${w.toFixed(0)}×${h.toFixed(0)} ${Math.abs(cx - m.W / 2) < 1 ? 'meio' : (cx - m.W / 2).toFixed(0)}` };
}
/** H13a (geometria): os dois nomes forçados nos cantos de baixo. Devolve a lista de falhas e o resumo. */
function conferirNomesCantos(m, pc = false) {
  const f = [], txt = [];
  if (!m.api) return { f: ['sem a API do nome nos cantos (o nome fica em cima do jogador)'], txt: '-' };
  const baseArco = Math.max(...m.botoes.map(c => c.y + c.d / 2), -Infinity);
  for (const t of [0, 1]) {
    const n = m.nomes[t];
    const semLugar = new RegExp(`\\bnome-sem-lugar-${t ? 'dir' : 'esq'}\\b`).test(m.cls);
    if (!n) { if (!semLugar) f.push(`nome ${t} escondido`); txt.push(`${t ? 'dir' : 'esq'} sem lugar`); continue; }
    const borda = t === 0 ? n.l - m.sa.l : m.W - m.sa.r - n.r;
    const lim = pc ? 15 : 16;
    if (borda > lim || borda < -0.5) f.push(`nome ${t} a ${borda.toFixed(1)} px da borda ${t ? 'direita' : 'esquerda'}`);
    const base = m.H - m.sa.b - n.b;
    if (pc ? Math.abs(base - 14) > 1 : (base > 6.5 || base < -0.5)) f.push(`nome ${t} com a base a ${base.toFixed(1)} px de H − sa.b`);
    if (!pc) {
      if (t === 0 && m.analogico && n.t < m.analogico.y + m.analogico.d / 2 + 2) f.push(`nome 0 (topo ${n.t.toFixed(0)}) não fica embaixo do analógico (${(m.analogico.y + m.analogico.d / 2).toFixed(0)})`);
      if (t === 1 && n.t < baseArco + 2) f.push(`nome 1 (topo ${n.t.toFixed(0)}) não fica embaixo do arco (${baseArco.toFixed(0)})`);
      for (const c of m.botoes) if (dRetCirc(n, c) < 4) f.push(`nome ${t} × ${c.id} (${dRetCirc(n, c).toFixed(1)} px)`);
      if (m.analogico && dRetCirc(n, m.analogico) < 4) f.push(`nome ${t} × analógico`);
    }
    if (m.mapa && dRetRet(n, m.mapa) < 4) f.push(`nome ${t} × minimapa (${dRetRet(n, m.mapa).toFixed(1)} px)`);
    if (m.placar && dRetRet(n, m.placar) < 4) f.push(`nome ${t} × placar`);
    txt.push(`${t ? 'dir' : 'esq'} ${(n.r - n.l).toFixed(0)} px`);
  }
  return { f, txt: txt.join(', ') };
}
const h12a = [], h12aFalhas = [], h13a = [], h13aFalhas = [], h12b = [], h12bFalhas = [], h12d = [], h12dFalhas = [], h12e = [];
let h12eOk = true;

// H1 (item 32): a área nas 3 fases com o placar no estado pedido (o MEDIR_PLACAR acabou de escrever), o nome do condutor mais
// largo no canto da fase — ataque e pênalti à esquerda (o meu time, o 0), defesa à direita
const AREA_FASES = ([FS, AS]) => {
  const formas = eval(FS), area = eval(AS), g = window.__golaco, out = {};
  for (const fase of ['ataque', 'defesa', 'penalti']) {
    const tq = document.getElementById('toque');
    tq.classList.toggle('fase-ataque', fase !== 'defesa'); tq.classList.toggle('fase-defesa', fase === 'defesa');
    tq.classList.toggle('cobranca-penalti', fase === 'penalti');
    let x;
    if (g.nomeCantoDeTeste) { g.nomeCantoDeTeste({ time: fase === 'defesa' ? 1 : 0, num: 88, nome: 'Wwwwwwwwww' }); x = formas(); g.nomeCantoDeTeste(null); } else x = formas();
    out[fase] = { area: area(x.f, innerWidth, innerHeight), comNome: x.f.some(s => s.nome === 'nome'), pecas: x.f.length };
    tq.classList.remove('cobranca-penalti');
  }
  g.sincronizarFase?.();
  return out;
};
/** A meta do H1 por tela: 11%; 12% em 568×320 (≤ 340 px de altura: decisão do dono, "Depende do dono" 15); 11% em 640×360. */
const metaH1 = h => (h <= 340 ? 0.12 : 0.11);

// H1c/H2c/H1d/H1e/H9c (item 65): a cobrança mirada de verdade. No navegador: o HUD do escanteio ou da falta da pessoa montada
// (a régua do H1: FORMAS, AREA e ENCOSTA), com o nome do condutor mais largo e o placar mais largo; os botões CURVA visíveis; e os
// chevrons do gesto (::before/::after do CHUTE e do LANÇAMENTO, a caixa girada pelo estilo calculado) × o círculo e o nome
const MEDIR_MIRADA = async ([FS, AS, ES, MP, gols, rel]) => {
  const formas = eval(FS), area = eval(AS), encosta = eval(ES), g = window.__golaco;
  if (gols) await eval(MP)(gols, rel);
  if (g.nomeCantoDeTeste) g.nomeCantoDeTeste({ time: 0, num: 88, nome: 'Wwwwwwwwww' });
  await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const x = formas();
  if (g.nomeCantoDeTeste) g.nomeCantoDeTeste(null);
  const curvas = [...document.querySelectorAll('#toque [id^="btn-efeito"]')].filter(b => getComputedStyle(b).display !== 'none' && b.offsetWidth > 0).length;
  const chev = [];
  for (const id of ['btn-chute', 'btn-lancamento']) {
    const b = document.getElementById(id);
    if (!b || getComputedStyle(b).display === 'none' || !b.offsetWidth) { chev.push({ id, falta: 'botão escondido' }); continue; }
    const D = b.offsetWidth, R = D / 2, sp = b.querySelector('span'), rb = b.getBoundingClientRect(), rs = sp && getComputedStyle(sp).display !== 'none' ? sp.getBoundingClientRect() : null;
    for (const pse of ['::before', '::after']) {
      const cs = getComputedStyle(b, pse);
      if (cs.content === 'none' || cs.display === 'none') { chev.push({ id, pse, falta: 'sem chevron' }); continue; }
      // (left/right/top do pseudo-elemento contam da borda de dentro do botão: soma a largura da borda dele)
      const bs = getComputedStyle(b), bl = parseFloat(bs.borderLeftWidth) || 0, br = parseFloat(bs.borderRightWidth) || 0, bt = parseFloat(bs.borderTopWidth) || 0;
      const w = parseFloat(cs.width), h = parseFloat(cs.height), mt = parseFloat(cs.marginTop) || 0;
      const top = parseFloat(cs.top), cx = cs.left !== 'auto' && pse === '::before' ? bl + parseFloat(cs.left) + w / 2 : D - br - parseFloat(cs.right) - w / 2;
      const cy = bt + top + mt + h / 2;
      const mtx = cs.transform && cs.transform !== 'none' ? cs.transform.match(/-?[\d.e-]+/g).map(Number) : [1, 0, 0, 1];
      const ex = (w / 2) * Math.abs(mtx[0]) + (h / 2) * Math.abs(mtx[2]), ey = (w / 2) * Math.abs(mtx[1]) + (h / 2) * Math.abs(mtx[3]);
      // a folga até a borda do círculo (o canto da caixa mais longe do centro) e até o nome (retângulos)
      let borda = Infinity;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) borda = Math.min(borda, R - Math.hypot(cx + sx * ex - R, cy + sy * ey - R));
      let nome = Infinity;
      if (rs && rs.width > 0) {
        const l = rb.left + cx - ex, r = rb.left + cx + ex, t = rb.top + cy - ey, bo = rb.top + cy + ey;
        nome = Math.max(rs.left - r, l - rs.right, rs.top - bo, t - rs.bottom);
      }
      chev.push({ id, pse, borda, nome });
    }
  }
  return { area: area(x.f, innerWidth, innerHeight), fora: x.fora, txt: x.txt, enc: encosta(x.f), curvas, chev, pecas: x.f.length };
};
{
  const linhasMir = [], falhasMir = { h1c: 0, h2c: 0, h1d: 0, h1e: 0, h9c: 0 }, txtMir = new Set(), encMir = [], chevMir = [];
  let medidas = 0;
  for (const [w, h] of TELAS_CEL) {
    const { navegador, pagina, erros } = await abrir({ largura: w, altura: h, dpr: 2, toque: true });
    try {
      await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&semente=4&replay=0&comemoracao=0&cenas=0`, { waitUntil: 'load' });
      await pronta(pagina);
      await pagina.evaluate(async () => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); await g.bolaParada.carregar(); });
      const porCara = [];
      for (const tm of [false, true]) {
        await pagina.evaluate(([CT, tm]) => eval(CT)(tm), [CARA_TM.toString(), tm]);
        const est = [];
        for (const tipo of ['escanteio', 'falta']) {
          const ok = await pagina.evaluate(tipo => {
            const g = window.__golaco;
            g.forcarEntrada(null);
            if (tipo === 'escanteio') g.bolaParadaDeTeste('escanteio'); else g.faltaDeTeste({ u: 22, w: 4 });
            for (let i = 0; i < 900; i++) {
              g.relogio.avancar(1000 / 60, { desenhar: false });
              const e = g.bolaParada.estado, pr = g.mundo.parada;
              if (e && e.ativa && e.mistura >= 1 && pr && g.mundo.tick >= pr.pronta) break;
            }
            for (let i = 0; i < 20; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
            return !!g.bolaParada.estado?.ativa && document.documentElement.classList.contains('cobranca-mirada');
          }, tipo);
          if (!ok) { est.push(`${tipo}: a cobrança não veio`); falhasMir.h1c++; continue; }
          // o relógio de verdade e o placar mais largo do H1 ("10-10 100:18 +10")
          let pior = null;
          for (const [gols, rel] of [[null, undefined], [[10, 10], REL_100]]) {
            const r = await pagina.evaluate(([MM, FS, AS, ES, MP, gols, rel]) => eval(MM)([FS, AS, ES, MP, gols, rel]),
              [MEDIR_MIRADA.toString(), FORMAS.toString(), AREA.toString(), ENCOSTA.toString(), MEDIR_PLACAR.toString(), gols, rel ?? null]);
            medidas++;
            if (!pior || r.area > pior.area) pior = r;
            if (r.fora > 0) { falhasMir.h2c++; r.txt.forEach(t => txtMir.add(t)); }
            if (r.curvas > 0) falhasMir.h1d++;
            if (r.enc.length) { falhasMir.h1e++; encMir.push(`${w}×${h}${tm ? ' TM' : ''} ${tipo}: ${r.enc.join(', ')}`); }
            for (const c of r.chev) if (c.falta || !(c.borda >= 2) || !(c.nome >= 1)) { falhasMir.h9c++; chevMir.push(`${w}×${h}${tm ? ' TM' : ''} ${c.id}${c.pse ?? ''}: ${c.falta ?? `borda ${c.borda.toFixed(1)} px, nome ${Number.isFinite(c.nome) ? c.nome.toFixed(1) : '-'} px`}`); }
            if (w === 568 && !tm && tipo === 'escanteio' && gols) chevMir.push(`(568×320: ${r.chev.map(c => (c.falta ? `${c.id}${c.pse ?? ''} ${c.falta}` : `${c.id}${c.pse} borda ${c.borda.toFixed(1)}, nome ${Number.isFinite(c.nome) ? c.nome.toFixed(1) : '-'}`)).join('; ')})`);
          }
          if (pior.area > metaH1(h)) falhasMir.h1c++;
          est.push(`${tipo} ${(pior.area * 100).toFixed(2)}%`);
          // termina a cobrança (LANÇAMENTO solto) e deixa a bola rolar
          await pagina.evaluate(() => { const g = window.__golaco; g.forcarEntrada({ x: 0, z: 0, botoes: 16 }); for (let i = 0; i < 20; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.forcarEntrada(null); for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
        }
        porCara.push(`${tm ? 'TM' : 'sem TM'}: ${est.join(' · ')}`);
      }
      await pagina.evaluate(CT => eval(CT)(false), CARA_TM.toString());
      linhasMir.push(`${w}×${h} (meta ${Math.round(metaH1(h) * 100)}%) ${porCara.join('; ')}${erros.length ? ` — erros: ${erros.slice(0, 2).join(' | ')}` : ''}`);
      if (erros.length) falhasMir.h1c++;
    } finally { await navegador.close(); }
  }
  const nTelas = linhasMir.length === TELAS_CEL.length;
  meta('H1c área do HUD na cobrança mirada de verdade (item 65: escanteio e tiro livre da pessoa; 4 telas com entalhe, sem e com a cara do TM, o nome mais largo, o relógio de verdade e o placar mais largo)',
    linhasMir.join(' | '), '≤ 11% em 844×390, 667×375 e 640×360, ≤ 12% em 568×320', nTelas && falhasMir.h1c === 0);
  meta('H2c texto na tela durante a cobrança mirada fora do placar, do nome e dos nomes dos botões (o rótulo ALTA/CHUTE do painel antigo)',
    falhasMir.h2c ? `${falhasMir.h2c} medidas com texto: ${JSON.stringify([...txtMir])}` : `0 caracteres em ${medidas} medidas`, '0', nTelas && medidas > 0 && falhasMir.h2c === 0);
  meta('H1d botões CURVA visíveis na cobrança mirada (a curva no toque é o arrasto no CHUTE e no LANÇAMENTO)', `${falhasMir.h1d} medidas com eles`, '0', nTelas && medidas > 0 && falhasMir.h1d === 0);
  meta('H1e nada encosta na cobrança mirada (folga ≥ 4 px entre as peças do HUD)', encMir.join('; ') || 'nada encosta', 'nada', nTelas && medidas > 0 && falhasMir.h1e === 0);
  meta('H9c os chevrons ‹ › do gesto da curva no CHUTE e no LANÇAMENTO: dentro do círculo (≥ 2 px da borda) e sem encostar no nome (≥ 1 px)',
    chevMir.join('; ') || 'ok', 'borda ≥ 2 px, nome ≥ 1 px', nTelas && medidas > 0 && falhasMir.h9c === 0);
}
if (soMirada) {
  await srv.fechar();
  const lg = Math.max(...res.map(r => r.nome.length));
  for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(lg)}  ${r.medido}   (alvo: ${r.alvo})`);
  const okM = res.every(r => r.ok);
  console.log(okM ? '\nteste-hud-minimo: PASSOU' : '\nteste-hud-minimo: REPROVOU');
  process.exit(okM ? 0 : 1);
}

// H1 + H2: layout nas duas fases e nas quatro telas de celular (determinístico, sem simular)
let piorTexto = 0, h1SemNome = 0, h1Falhas = 0; const txtVisto = new Set(); const linhasH1 = [];
const nomesBotoes = { botoes: 0, comNome: 0, sem: new Set() };
const estilosVistos = []; let estilosFalhas = 0;
let piorPausa = Infinity; const linhasPausa = [];
for (const [w, h] of TELAS_CEL) {
  const { navegador, pagina } = await abrir({ largura: w, altura: h, dpr: 2, toque: true });
  try {
    await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&demo=1&semente=4`, { waitUntil: 'load' });
    await pronta(pagina);
    const r = await pagina.evaluate(([FS]) => {
      const formas = eval(FS);
      const g = window.__golaco; g.relogio.usarManual(true);
      for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const out = {};
      // (item 70, P2: 'penalti' = o ataque na cobrança do pênalti da pessoa — a classe cobranca-penalti, com os botões
      // PARADINHA e PULINHO; fora dela eles não aparecem)
      const vis = id => { const b = document.getElementById(id); return !!b && getComputedStyle(b).display !== 'none' && b.offsetWidth > 0; };
      for (const fase of ['ataque', 'defesa', 'penalti']) {
        const tq = document.getElementById('toque');
        tq.classList.toggle('fase-ataque', fase !== 'defesa'); tq.classList.toggle('fase-defesa', fase === 'defesa');
        tq.classList.toggle('cobranca-penalti', fase === 'penalti');
        const x = formas();
        out[fase] = { fora: x.fora, txt: x.txt, nomes: x.nomes, estilos: [vis('btn-paradinha'), vis('btn-pulinho')], saem: [vis('btn-enfiada'), vis('btn-lancamento')] };
        tq.classList.remove('cobranca-penalti');
      }
      g.sincronizarFase?.();
      // o topo da pausa (item 58: a marca e a competição à esquerda; a pílula do placar e o X à direita): nada encosta (na
      // mesma faixa de altura) nem transborda
      g.abrirMenu?.();
      const topo = document.querySelector('.janela-menu .pausa-faixa .janela-topo');
      if (topo) {
        const pecas = [];
        const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
        for (const e of [...topo.children, document.getElementById('pausa-placar'), document.querySelector('#menu .pausa-topo-dir .btn-fechar')]) {
          if (!vis(e)) continue;
          const q = e.getBoundingClientRect(); pecas.push({ nome: e.id || e.getAttribute('class')?.split(' ')[0] || e.tagName, l: q.left, r: q.right, t: q.top, b: q.bottom });
        }
        pecas.sort((a, b) => a.l - b.l);
        let folga = Infinity, par = '';
        for (let i = 1; i < pecas.length; i++) { const d = pecas[i].l - pecas[i - 1].r; if (d < folga) { folga = d; par = `${pecas[i - 1].nome} × ${pecas[i].nome}`; } }
        out.pausa = { folga, par, transborda: Math.max(topo.scrollWidth - topo.clientWidth, ...[...topo.children].map(c => c.scrollWidth - c.clientWidth > 1 && getComputedStyle(c).textOverflow !== 'ellipsis' ? c.scrollWidth - c.clientWidth : 0)) };
      }
      g.fecharMenu?.();
      return out;
    }, [FORMAS.toString()]);
    estilosVistos.push(`${w}×${h}: ataque ${r.ataque.estilos.filter(Boolean).length}, defesa ${r.defesa.estilos.filter(Boolean).length}, pênalti ${r.penalti.estilos.filter(Boolean).length} (ENFIADA/LANÇAMENTO ${r.penalti.saem.filter(Boolean).length})`);
    if (r.ataque.estilos.some(Boolean) || r.defesa.estilos.some(Boolean) || !r.penalti.estilos.every(Boolean) || r.penalti.saem.some(Boolean)) estilosFalhas++;
    for (const fase of ['ataque', 'defesa', 'penalti']) {
      piorTexto = Math.max(piorTexto, r[fase].fora);
      r[fase].txt.forEach(t => txtVisto.add(t));
      nomesBotoes.botoes += r[fase].nomes.botoes; nomesBotoes.comNome += r[fase].nomes.comNome; r[fase].nomes.sem.forEach(id => nomesBotoes.sem.add(`${w}×${h} ${fase} ${id}`));
    }
    if (r.pausa) { linhasPausa.push(`${w}×${h} folga ${r.pausa.folga.toFixed(0)} px (${r.pausa.par})${r.pausa.transborda > 0 ? `, transborda ${r.pausa.transborda} px` : ''}`); piorPausa = Math.min(piorPausa, r.pausa.transborda > 0 ? -1 : r.pausa.folga); }
    // H10 (os 5 estados) e H1 (os 4 do relógio e os 4 largos × as 3 fases; os largos também no H1b), sem e com a cara do TM
    // (minimapa desligado, o padrão do celular)
    const porCara = [];
    for (const tm of [false, true]) {
      await pagina.evaluate(([CT, tm]) => eval(CT)(tm), [CARA_TM.toString(), tm]);
      let pior = { a: 0 }; const est = [];
      for (const [estado, gols, rel, extra] of [...ESTADOS_PLACAR, ...ESTADOS_H1_LARGOS]) {
        const m = await pagina.evaluate(([MP, gols, rel]) => eval(MP)(gols, rel), [MEDIR_PLACAR.toString(), gols, rel]);
        if (extra == null) conferirPlacar(`${w}×${h}`, 'celular', estado, m);
        else conferirLargo(`${w}×${h}`, estado, extra, gols, rel, m);
        if (extra == null && !ESTADOS_H1.some(e => e[0] === estado)) continue;
        const a = await pagina.evaluate(([AF, FS, AS]) => eval(AF)([FS, AS]), [AREA_FASES.toString(), FORMAS.toString(), AREA.toString()]);
        let pe = { a: 0, fase: '' };
        for (const fase of ['ataque', 'defesa', 'penalti']) {
          if (!a[fase].comNome) h1SemNome++;
          if (a[fase].area > pe.a) pe = { a: a[fase].area, fase };
        }
        est.push(`${estado} ${(pe.a * 100).toFixed(2)}`);
        if (pe.a > pior.a) pior = { ...pe, estado };
      }
      if (pior.a > metaH1(h)) h1Falhas++;
      porCara.push(`${tm ? 'TM' : 'sem TM'}: ${est.join(' · ')} → pior ${(pior.a * 100).toFixed(2)}% (${pior.estado}, ${pior.fase})`);
    }
    await pagina.evaluate(CT => eval(CT)(false), CARA_TM.toString());
    // (2 casas: a folga em 667×375 sem o TM nos acréscimos de +10 é de ~0,05 ponto)
    linhasH1.push(`${w}×${h} (meta ${Math.round(metaH1(h) * 100)}%) ${porCara.join('; ')}`);
    // leitor de tela: o nome de cada time (só no aria-label; contraprova de 13/10: num <span> sem papel o Chromium não
    // expunha o nome, e a árvore saía "GLÇ 0 0 VNT")
    if (w === 844) {
      placarAria = (await pagina.locator('#hud .placar').ariaSnapshot()).replace(/\s*\n\s*/g, ' ');
      if (!/Golaço FC/.test(placarAria) || !/Ventania FC/.test(placarAria)) placarFalhas.push(`leitor de tela sem o nome dos times: ${placarAria}`);
    }
    const enc = await pagina.evaluate(async ([MP, FS, ES, gols, rel]) => {
      document.getElementById('chip-minimapa')?.click();
      const m = await eval(MP)(gols, rel);
      const f = eval(FS)().f.filter(x => ['placar', 'minimapa', 'menu'].includes(x.nome));
      const p = eval(ES)(f);
      // com o minimapa ligado o "+N" continua, e gols de 2 dígitos (só o placar muda; o relógio não) refazem o topo: nada
      // encosta (contraprova de 13/10)
      const tempo = m.tempo?.txt ?? null;
      const m2 = await eval(MP)([10, 9], rel);
      const p2 = eval(ES)(eval(FS)().f.filter(x => ['placar', 'minimapa', 'menu'].includes(x.nome)));
      document.getElementById('chip-minimapa')?.click();
      return { p, p2, tempo, nomes: f.map(x => x.nome), cls: m.cls, larg2: m2.caixa.w };
    }, [MEDIR_PLACAR.toString(), FORMAS.toString(), ENCOSTA.toString(), ESTADOS_PLACAR[2][1], ESTADOS_PLACAR[2][2]]);
    placarEncosta.push(`${w}×${h}: ${enc.p.length ? 'encosta ' + enc.p.join(', ') : 'nada encosta'} (${enc.nomes.join(', ')}${/topo-c4/.test(enc.cls) ? '; compacto' : ''}; "+N" "${enc.tempo ?? 'escondido'}"; com 10-9 ${enc.larg2.toFixed(0)} px: ${enc.p2.length ? 'encosta ' + enc.p2.join(', ') : 'nada encosta'})`);
    if (enc.p.length || !enc.nomes.includes('minimapa')) placarFalhas.push(`${w}×${h} com o minimapa: ${enc.p.join(', ') || 'minimapa não aparece'}`);
    if (enc.tempo !== '+10') placarFalhas.push(`${w}×${h} com o minimapa: "+10" ${enc.tempo === null ? 'escondido' : `"${enc.tempo}"`}`);
    if (enc.p2.length) placarFalhas.push(`${w}×${h} com o minimapa e gols 10-9: ${enc.p2.join(', ')}`);
    // H12 + H13a (itens 59 e 60): o minimapa ligado e os dois nomes na faixa de baixo — com e sem entalhe, a 80% (o padrão),
    // 70, 100 e 140% (o "Tamanho" mudado como na pausa, sem resize) e de volta a 80% (H12e: o mesmo lugar); o entalhe muda
    // pela classe + resize (as margens seguras são variáveis CSS)
    if (!soPlacar) {
      await pagina.evaluate(() => document.getElementById('chip-minimapa')?.click());
      const tela = `${w}×${h}`;
      for (const entalhe of [true, false]) {
        await pagina.evaluate(v => { document.documentElement.classList.toggle('entalhe-simulado', v); dispatchEvent(new Event('resize')); }, entalhe);
        let ref80 = null;
        for (const tam of [0.8, 0.7, 1, 1.4, 0.8]) {
          await pagina.evaluate(t => window.__golaco.toqueTamanho(t), tam);
          const m = await pagina.evaluate(MB => eval(MB)(), MEDIR_BAIXO.toString());
          const cm = conferirMapa(m, tam);
          const rot = `${tela}${entalhe ? ' entalhe' : ''} ${Math.round(tam * 100)}%`;
          if (ref80 === null && tam === 0.8) { ref80 = m.mapa; h12a.push(`${rot}: ${cm.txt}`); if (cm.f.length) h12aFalhas.push(`${rot}: ${cm.f.join(', ')}`); }
          else if (tam === 0.8) {
            // H12e: de volta a 80% sem resize, o mesmo lugar
            const igual = !!ref80 && !!m.mapa && ['l', 't', 'r', 'b'].every(k => Math.abs(ref80[k] - m.mapa[k]) < 0.6);
            h12e.push(`${rot}: ${igual ? 'mesmo lugar' : 'MUDOU'}`); if (!igual) h12eOk = false;
          } else { h12a.push(`${rot}: ${cm.txt}`); if (cm.f.length) h12aFalhas.push(`${rot}: ${cm.f.join(', ')}`); }
          if (tam <= 1) {
            const cn = conferirNomesCantos(m);
            h13a.push(`${rot}: ${cn.txt}`); if (cn.f.length) h13aFalhas.push(`${rot}: ${cn.f.join(', ')}`);
          }
        }
      }
      await pagina.evaluate(() => { document.documentElement.classList.add('entalhe-simulado'); dispatchEvent(new Event('resize')); window.__golaco.toqueTamanho(0.8); });
      // H12b: nada no alto além do placar e do menu (a 80%, com entalhe, o minimapa ligado)
      const alto = await pagina.evaluate(async FS => { await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))); return eval(FS)().f.filter(x => x.ret && x.ret[1] < innerHeight * 0.3 && !['placar', 'menu'].includes(x.nome)).map(x => `${x.nome} (topo ${x.ret[1].toFixed(0)})`); }, FORMAS.toString());
      h12b.push(`${tela}: ${alto.length ? alto.join(', ') : 'só placar e menu'}`); if (alto.length) h12bFalhas.push(`${tela}: ${alto.join(', ')}`);
      // H12d: as faixas do meio da tela com o minimapa ligado (sem e com a cara do TM: a faixa do TM desce para baixo do aviso)
      for (const tm of [false, true]) {
        const r = await pagina.evaluate(async tm => {
          const g = window.__golaco, espera = () => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
          if (tm && !document.documentElement.classList.contains('tm')) {
            document.documentElement.classList.add('tm');
            const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/tm.css'; l.id = 'tm-teste';
            await new Promise(ok => { l.onload = ok; l.onerror = ok; document.head.append(l); });
          }
          const cx = e => { if (!e || e.hidden) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return null; const q = e.getBoundingClientRect(); return q.width > 0 ? { l: q.left, t: q.top, r: q.right, b: q.bottom } : null; };
          const folga = (a, b) => Math.max(b.l - a.r, a.l - b.r, b.t - a.b, a.t - b.b);
          const out = {};
          for (const [k, f] of [['fim', { final: true, titulo: 'Fim de jogo', placar: 'GLÇ 2 × 1 VNT', botao: true, botao2: true }], ['intervalo', { titulo: 'Intervalo', placar: 'GLÇ 1 × 0 VNT' }],
            ['expulso', { titulo: 'Você foi expulso', placar: 'GLÇ 1 × 0 VNT', botao: true, botaoTexto: 'Simular o resto', botaoCmd: 'simular-resto' }]]) {
            g.mostrarFaixa(f); await espera();
            const fx = cx(document.getElementById('faixa')), mp = cx(document.getElementById('minimapa'));
            out[k] = { mapa: !!mp, folga: fx && mp ? folga(fx, mp) : null, faixa: fx ? [fx.t, fx.b].map(Math.round) : null };
            g.mostrarFaixa(null); await espera();
          }
          if (tm) { document.documentElement.classList.remove('tm'); document.getElementById('tm-teste')?.remove(); await espera(); }
          return out;
        }, tm);
        const rot = `${tela}${tm ? ' TM' : ''}`;
        const f = [];
        if (r.fim.mapa) f.push(`fim: minimapa na tela${r.fim.folga != null ? ` (${r.fim.folga.toFixed(0)} px da faixa)` : ''}`);
        for (const k of ['intervalo', 'expulso']) if (r[k].mapa && !(r[k].folga >= 4)) f.push(`${k}: ${r[k].folga?.toFixed(0)} px`);
        h12d.push(`${rot}: fim ${r.fim.mapa ? 'COM o minimapa' : 'sem o minimapa'}, intervalo ${r.intervalo.mapa ? `${r.intervalo.folga?.toFixed(0)} px` : 'sem o minimapa'}, expulso ${r.expulso.mapa ? `${r.expulso.folga?.toFixed(0)} px` : 'sem o minimapa'}`);
        if (f.length) h12dFalhas.push(`${rot}: ${f.join(', ')}`);
      }
      await pagina.evaluate(() => document.getElementById('chip-minimapa')?.click());
    }
    // treino de ataque com o minimapa ligado e o painel ("Conduzindo" + posição): nada encosta e a marca do GOLAÇO fica
    // (contraprova de 13/10: em 568 e 667 px ela saía com 40–90 px livres à direita do placar — quem encostava era o
    // painel, e apertar o painel, passo 2, já resolvia)
    const tr = await pagina.evaluate(async ([FS, ES]) => {
      const g = window.__golaco, espera = () => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
      g.trocarModo('ataque'); g.relogio.avancar(1000 / 60);
      document.getElementById('chip-minimapa')?.click();
      g.hudModo('Conduzindo', 'MEI');
      await espera();
      const f = eval(FS)().f.filter(x => ['placar', 'minimapa', 'menu', 'painel'].includes(x.nome));
      const mc = document.querySelector('#hud .placar-marca');
      const marca = !!mc && getComputedStyle(mc).display !== 'none' && mc.getBoundingClientRect().width > 0;
      return { p: eval(ES)(f), marca, nomes: f.map(x => x.nome), modo: document.documentElement.classList.contains('em-partida') ? 'partida' : 'treino' };
    }, [FORMAS.toString(), ENCOSTA.toString()]);
    placarTreino.push(`${w}×${h}: ${tr.p.length ? 'encosta ' + tr.p.join(', ') : 'nada encosta'} (${tr.nomes.join(', ')}; marca ${tr.marca ? 'na tela' : 'FORA'})`);
    if (tr.p.length || !tr.marca || tr.modo !== 'treino' || !tr.nomes.includes('minimapa') || !tr.nomes.includes('painel')) {
      placarFalhas.push(`${w}×${h} treino com o minimapa: ${[...tr.p, tr.marca ? null : 'marca fora', tr.modo !== 'treino' ? 'não trocou de modo' : null].filter(Boolean).join(', ') || 'falta caixa'}`);
    }
  } finally { await navegador.close(); }
}
meta('H9 nomes dos botões de toque por padrão (dono, 12/10), inteiros dentro do círculo do botão (4 telas, 2 fases)', `${nomesBotoes.comNome}/${nomesBotoes.botoes} botões com o nome${nomesBotoes.sem.size ? ' — sem: ' + [...nomesBotoes.sem].slice(0, 8).join(', ') : ''}`, 'todos', nomesBotoes.botoes > 0 && nomesBotoes.comNome === nomesBotoes.botoes);
meta('H1 área do HUD no celular (pior caso: ataque, defesa e a cobrança do pênalti da pessoa × os 4 estados do relógio e os 4 mais largos — gols de 2 dígitos, o relógio de 3, os dois — × sem e com a cara do TM, 4 telas; com o nome do condutor mais largo no canto da fase; o ≡ transparente pelo ícone)',
  `${linhasH1.join(' | ')}${h1SemNome ? ` — ${h1SemNome} medidas sem o nome` : ''}`, '≤ 11% em 844×390, 667×375 e 640×360, ≤ 12% em 568×320 (decisão do dono, "Depende do dono" 15); o nome contado em todas', linhasH1.length === TELAS_CEL.length && h1Falhas === 0 && h1SemNome === 0);
meta('H1b o placar nos estados mais largos (revisão do item 32): o hud aperta pelos passos do aperto — os espaços com 1 dígito a mais, também o "+N" com 2 ou mais —, os textos certos, as fontes nos mínimos do H10 e nada sai da barra nem se sobrepõe (4 telas, sem e com a cara do TM)',
  `${largoFalhas.length ? 'FALHAS: ' + largoFalhas.join(' | ') + ' — ' : ''}${largoLinhas.join('; ')}`, 'topo-c4 em todos; o "+N" com 1 dígito a mais, sem ele com 2 ou mais; gols ≥ 18, relógio ≥ 16, siglas ≥ 12 (11 nas baixas), escudos ≥ 14; nada sobrepõe',
  largoFalhas.length === 0 && largoLinhas.length === 2 * TELAS_CEL.length * ESTADOS_H1_LARGOS.length);
if (!soPlacar) {
  meta('H12a o minimapa embaixo, no meio, entre o analógico e os botões (4 telas, com e sem entalhe; 80% = 92×60; 70/100/140%: no lugar ou sem lugar de verdade)',
    `${h12aFalhas.length ? 'FALHAS: ' + h12aFalhas.join(' | ') + ' — ' : ''}${h12a.join('; ')}`, '80%: 92×60 no meio; ≥ 76×50, ≤ 12% de W do meio, base ≤ 6 px, ≥ 8 px do analógico e dos botões, ≥ 4 px dos nomes; ou sem lugar', h12a.length === 8 * TELAS_CEL.length && h12aFalhas.length === 0);
  meta('H12e o "Tamanho" mudado (70 → 140 → 80%) reposiciona o minimapa sem resize (de volta ao lugar do 80%)', h12e.join('; '), 'mesmo lugar', h12e.length === 2 * TELAS_CEL.length && h12eOk);
  meta('H12b nada no alto além do placar e do menu (partida, minimapa ligado; 4 telas)', h12b.join('; '), 'só placar e menu', h12b.length === TELAS_CEL.length && h12bFalhas.length === 0);
  meta('H12d a faixa do fim de jogo esconde o minimapa; intervalo e "Você foi expulso" a ≥ 4 px dele (4 telas com entalhe, com e sem a cara do TM)',
    `${h12dFalhas.length ? 'FALHAS: ' + h12dFalhas.join(' | ') + ' — ' : ''}${h12d.join('; ')}`, 'fim sem o minimapa; ≥ 4 px', h12d.length === 2 * TELAS_CEL.length && h12dFalhas.length === 0);
  meta('H13a os nomes forçados (o mais largo) nos cantos de baixo, embaixo do analógico e do arco, sem encostar (4 telas, com e sem entalhe, 70/80/100%)',
    `${h13aFalhas.length ? 'FALHAS: ' + [...new Set(h13aFalhas)].slice(0, 12).join(' | ') + ' — ' : ''}${h13a.join('; ')}`, 'esq/dir ≤ 16 px da borda, base ≤ 6 px, embaixo do analógico/arco, ≥ 4 px de tudo', h13a.length === 8 * TELAS_CEL.length && h13aFalhas.length === 0);
}
meta('H11 os botões PARADINHA e PULINHO (item 70, P2): só na cobrança do pênalti da pessoa (4 telas; visíveis de 2)', estilosVistos.join('; '), 'ataque 0, defesa 0, pênalti 2 (ENFIADA/LANÇAMENTO 0)', estilosVistos.length === TELAS_CEL.length && estilosFalhas === 0);
meta('H7 topo da pausa no celular (a marca e a competição; a pílula do placar e o X): nada encosta nem transborda (4 telas com entalhe)', linhasPausa.join('; ') || 'sem a pausa', 'folga ≥ 4 px (a do ENCOSTA)', linhasPausa.length === TELAS_CEL.length && piorPausa >= 4);

// H11b (item 70, P2): na página de verdade, o pênalti a favor montado (a falta na área, __golaco.faltaDeTeste) liga a classe
// cobranca-penalti com o cobrador da pessoa (os dois botões aparecem) e a bola rolando a desliga
if (!soPlacar) {
  const { navegador, pagina } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    await pagina.goto(`${srv.url}?q=baixa&toque=1&semente=4&replay=0&comemoracao=0&cenas=0`, { waitUntil: 'load' });
    await pronta(pagina);
    const r = await pagina.evaluate(() => {
      const g = window.__golaco; g.relogio.usarManual(true);
      const tq = document.getElementById('toque');
      const vis = id => { const b = document.getElementById(id); return !!b && getComputedStyle(b).display !== 'none' && b.offsetWidth > 0; };
      const out = { antes: tq.classList.contains('cobranca-penalti') || vis('btn-paradinha') };
      for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const f = g.faltaDeTeste({ area: true, cartao: null });
      out.parada = f && f.parada;
      // até a cobrança montada (o cobrador da pessoa no ponto de partida)
      for (let i = 0; i < 300 && !(g.mundo.parada && g.mundo.parada.corrida); i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      g.relogio.avancar(1000 / 60, { desenhar: false });
      out.na = tq.classList.contains('cobranca-penalti') && vis('btn-paradinha') && vis('btn-pulinho');
      out.cobrador = g.mundo.parada?.cobrador === g.mundo.controlado?.[0];
      // a pessoa não bate: a IA assume no prazo e a bola rola; a classe sai
      for (let i = 0; i < 60 * 12 && g.mundo.parada && !g.mundo.parada.rolou; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      for (let i = 0; i < 4; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      out.depois = tq.classList.contains('cobranca-penalti') || vis('btn-paradinha');
      return out;
    });
    meta('H11b a página: o pênalti a favor montado liga os botões PARADINHA e PULINHO (o cobrador da pessoa) e a bola rolando os desliga',
      `antes ${r.antes ? 'visíveis' : 'não'} · ${r.parada} montado: ${r.na ? 'visíveis' : 'NÃO'} (cobrador da pessoa ${r.cobrador ? 'sim' : 'não'}) · depois ${r.depois ? 'visíveis' : 'não'}`,
      'não · visíveis · não', !r.antes && r.parada === 'penalti' && r.na && r.cobrador && !r.depois);
  } finally { await navegador.close(); }
}

// H2 (jogo) + H3 + H4 + H6: jogo de verdade no celular 844×390
if (!soPlacar) {
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    // ?comemoracao=0: a comemoração do gol seguraria a simulação ~5–7,5 s por gol e mudaria a linha do tempo destes 2 min
    // (o apito forçado no fim caía no meio de uma cena, o que não existe no jogo); a tela da cena é medida no
    // teste-comemoracao-tela (A5, C1)
    await pagina.goto(`${srv.url}?q=media&hora=dia&toque=1&entalhe=1&demo=1&semente=11&comemoracao=0`, { waitUntil: 'load' });
    await pronta(pagina);
    const r = await pagina.evaluate(([FS]) => {
      const formas = eval(FS);
      const g = window.__golaco; g.relogio.usarManual(true);
      const cv = document.querySelector('canvas');
      const off = document.createElement('canvas'); off.width = 211; off.height = 98;
      const cx = off.getContext('2d', { willReadFrequently: true });
      const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
      const sx = innerWidth / off.width, sy = innerHeight / off.height;
      const dentro = (f, x, y) => f.some(s => (s.ret ? x >= s.ret[0] && x <= s.ret[2] && y >= s.ret[1] && y <= s.ret[3] : (x - s.circ[0]) ** 2 + (y - s.circ[1]) ** 2 <= s.circ[2] ** 2));
      const carga = document.getElementById('carga'), cargaTipo = document.getElementById('carga-tipo');
      let torc = 0, torcEsc = 0, viva = 0, lance = 0, amostras = 0, comCarga = 0, cargaTexto = 0, textoJogo = 0;
      const txt = new Set(), nomesTxt = new Set();
      const perto = [];
      // H12c: a torcida atrás do minimapa LIGADO (o chip só para ler a caixa: os pixels vêm do canvas 3D e o H3 fica no estado
      // padrão, com ele desligado)
      let torcMapa = 0, caixaMapa = null;
      const chip = document.getElementById('chip-minimapa');
      // H13f: o nome do condutor sem piscar — em todo passo, visível? (sem a API, a base: o #nome-condutor sem hidden); voltas
      // depois de < 0,8 s (48 quadros) escondido. Escritas no DOM do nome (informativo) por MutationObserver
      const nomeVis = () => { const e = g.nomeCantoEstado; if (e) return !!e.visivel; const el = document.getElementById('nome-condutor'); return !!el && !el.hidden; };
      let nv = null, nvDesde = 0, voltasCurtas = 0, voltasLongas = 0, trocasNome = 0, ultNome = '', quadroN = 0, quadrosVis = 0;
      const elNome0 = document.getElementById('nome-condutor');
      const obs = new MutationObserver(() => {});
      let escritas = 0;
      const observar = el => { if (el && !el.__obs) { obs.observe(el, { attributes: true, childList: true, characterData: true, subtree: true }); el.__obs = true; } };
      observar(elNome0);
      for (let k = 0; k < 8; k++) {
        for (let i = 0; i < 900; i++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          {
            observar(document.getElementById('nome-condutor'));
            const v = nomeVis();
            quadroN++; if (v) quadrosVis++;
            if (v) { const el = document.getElementById('nome-condutor'); const t = el ? el.textContent : ''; if (t !== ultNome) { trocasNome++; ultNome = t; } }
            if (nv === null) { nv = v; nvDesde = quadroN; }
            else if (v !== nv) { if (v) { if (quadroN - nvDesde < 48) voltasCurtas++; else voltasLongas++; } nv = v; nvDesde = quadroN; }
          }
          if (i % 6 === 0) {
            const li = g.linhaImpedimento; const rol = g.mundo.partida?.estado === 'jogo' && !(g.mundo.parada && !g.mundo.parada.rolou);
            if (rol) { amostras++; if (li?.visivel && !li.lance) viva++; if (li?.visivel && li.lance) lance++; }
            // barra de força na tela: o rótulo ("PASSE", "CHUTE") não aparece na partida
            if (carga?.classList.contains('visivel')) {
              comCarga++;
              if (cargaTipo && cargaTipo.textContent.trim() && getComputedStyle(cargaTipo).display !== 'none' && cargaTipo.offsetWidth > 0) cargaTexto++;
            }
            if (i % 60 === 0) { const x = formas(); textoJogo = Math.max(textoJogo, x.fora); x.txt.forEach(t => txt.add(t)); if (x.nome != null) nomesTxt.add(x.nome); }
          }
        }
        g.estadio.mostrarTorcida(true); g.desenhar(); const a = ler();
        g.estadio.mostrarTorcida(false); g.desenhar(); const b = ler();
        g.estadio.mostrarTorcida(true); g.desenhar();
        const { f } = formas();
        chip?.click();
        const qm = document.getElementById('minimapa').getBoundingClientRect();
        caixaMapa = qm.width > 0 ? [qm.left, qm.top, qm.right, qm.bottom].map(Math.round) : null;
        chip?.click();
        for (let p = 0, i = 0; i < a.length; i += 4, p++) {
          if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 <= 24) continue;
          torc++;
          const x = ((p % off.width) + 0.5) * sx, y = (Math.floor(p / off.width) + 0.5) * sy;
          if (dentro(f, x, y)) torcEsc++;
          if (qm.width > 0 && x >= qm.left && x <= qm.right && y >= qm.top && y <= qm.bottom) torcMapa++;
        }
        const m = g.mundo; let n = 0;
        for (const j of m.jogadores) {
          if (Math.hypot(j.x - m.bola.p.x, j.z - m.bola.p.z) >= 20) continue;
          const p0 = g.naTela(j.x, 0, j.z), p1 = g.naTela(j.x, 1.8, j.z); if (!p0 || !p1) continue;
          const hh = Math.abs(p0.y - p1.y), ww = Math.max(4, 0.4 * hh); let d = 0, t = 0;
          for (let u = 0; u < 5; u++) for (let v = 0; v < 7; v++) { t++; if (dentro(f, p0.x - ww / 2 + (ww * u) / 4, Math.min(p0.y, p1.y) + (hh * v) / 6)) d++; }
          if (d / t >= 0.3) n++;
        }
        perto.push(n);
      }
      // apito de impedimento (o lance de agora): a linha DO LANCE aparece parada no gramado
      const p = g.mundo.partida;
      p.ultimoImped = { tick: g.mundo.tick, linhaX: 18 * (g.mundo.ataca?.[0] ?? 1), id: -1, time: 0 };
      g.desenhar();
      const li = g.linhaImpedimento;
      escritas = obs.takeRecords().length; obs.disconnect();
      return { torc, torcEsc, viva, lance, amostras, perto, comCarga, cargaTexto, textoJogo, txt: [...txt], apito: li ? { visivel: li.visivel, lance: li.lance, x: li.x } : null,
        torcMapa, caixaMapa, nomesTxt: [...nomesTxt], nome: { voltasCurtas, voltasLongas, trocasNome, escritas, visivel: quadrosVis / Math.max(1, quadroN) } };
    }, [FORMAS.toString()]);
    piorTexto = Math.max(piorTexto, r.textoJogo + (r.cargaTexto ? 1 : 0));
    r.txt.forEach(t => txtVisto.add(t));
    // (o nome do condutor, item 60: a exceção escrita — só "número nome", nada mais, em toda amostra dos 2 min)
    const NOME_OK = /^\d{1,2}\s?\S.{0,15}$/;
    const nomesRuins = r.nomesTxt.filter(t => !NOME_OK.test(t));
    meta('H2 texto fora do placar, dos nomes dos botões e do nome do condutor durante o jogo (4 telas, 2 fases e 2 min de partida); o nome do condutor só "número nome"',
      `${piorTexto} caracteres${txtVisto.size ? ': ' + [...txtVisto].join(' ') : ''}; barra de força com rótulo em ${r.cargaTexto}/${r.comCarga} amostras; nome do condutor: ${r.nomesTxt.length} textos${r.nomesTxt.length ? ' (' + r.nomesTxt.slice(0, 4).join(', ') + ')' : ''}${nomesRuins.length ? ' — fora do formato: ' + nomesRuins.join(', ') : ''}`,
      '0; só número e nome', piorTexto === 0 && r.cargaTexto === 0 && nomesRuins.length === 0);
    const frMapa = r.torcMapa / Math.max(1, r.torc);
    meta('H12c torcida atrás do minimapa ligado (celular 844×390, os 8 instantes do H3)', `${(frMapa * 100).toFixed(1)}% de ${r.torc} pixels de torcida (minimapa em ${r.caixaMapa ? r.caixaMapa.join(', ') : 'nenhum lugar'})`, '≤ 1%', !!r.caixaMapa && frMapa <= 0.01 && r.torc > 500);
    meta('H13f o nome do condutor sem piscar (2 min de jogo, celular): voltas depois de < 0,8 s escondido', `${r.nome.voltasCurtas} (voltas depois de ≥ 0,8 s: ${r.nome.voltasLongas}; ${r.nome.trocasNome} nomes; visível ${(100 * r.nome.visivel).toFixed(1)}% do tempo; informativo: ${r.nome.escritas} escritas no DOM, ${(r.nome.escritas / Math.max(1, r.nome.trocasNome)).toFixed(1)} por nome)`,
      '0', r.nome.voltasCurtas === 0 && r.nome.trocasNome > 5);
    const fr = r.torcEsc / Math.max(1, r.torc);
    meta('H3 torcida visível escondida pelo HUD (celular 844×390, 8 instantes)', `${(fr * 100).toFixed(1)}% de ${r.torc} pixels de torcida`, '≤ 15%', fr <= 0.15 && r.torc > 500 && erros.length === 0);
    meta('H4 linha de impedimento viva com a bola rolando (2 min de jogo)', `${r.viva}/${r.amostras} amostras (${(100 * r.viva / Math.max(1, r.amostras)).toFixed(1)}%); linha do lance ${r.lance}`, '0', r.viva === 0 && r.amostras > 500);
    meta('H4 no apito do impedimento a linha DO LANCE aparece parada', r.apito ? `visível ${r.apito.visivel}, do lance ${r.apito.lance}, x = ${r.apito.x.toFixed(1)}` : 'sem estado', 'visível, do lance', r.apito?.visivel && r.apito.lance);
    const med = r.perto.reduce((s, v) => s + v, 0) / r.perto.length;
    meta('H6 (informativo) jogadores a < 20 m da bola atrás do HUD', `média ${med.toFixed(2)} por instante (${r.perto.join(',')})`, 'informativo', true);
  } finally { await navegador.close(); }
}

// H13 b–e (item 60): o nome do condutor pelo caminho de verdade (main.js marcarCondutor) no celular 844×390 com entalhe —
// a simulação parada (pausar) e o relógio manual andando: o desenho lê mundo.posse
/** No navegador: o nome na tela agora ({vis, lado, texto, rect, fs, apagado, contraste, cor, corPlacar, ...}). */
const LER_NOME = () => {
  const e = document.getElementById('nome-condutor');
  if (!e) return { vis: false, existe: false };
  const cs = getComputedStyle(e);
  const vis = !e.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && (!e.checkVisibility || e.checkVisibility({ checkVisibilityCSS: true }));
  const q = e.getBoundingClientRect();
  const num = e.querySelector('.nc-num'), nome = e.querySelector('.nc-nome'), cor = e.querySelector('.nc-cor');
  const rgb = c => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fundo = rgb(cs.backgroundColor), a = fundo.length > 3 ? fundo[3] : 1, letra = rgb(getComputedStyle(nome ?? e).color);
  // o fundo composto sobre preto e sobre branco: o menor contraste
  const cont = base => { const f = fundo.slice(0, 3).map((v, i) => v * a + base * (1 - a)); const l1 = lum(f), l2 = lum(letra); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const placarCor = t => { const c = document.querySelector(`#placar-time-${t} .placar-cor`); return c ? getComputedStyle(c).backgroundColor : null; };
  return {
    existe: true, vis, noHud: !!e.closest('#hud'), dir: e.classList.contains('dir'), apagado: e.classList.contains('apagado') || +cs.opacity < 0.95,
    texto: [num, nome].filter(Boolean).map(x => x.textContent.trim()).filter(Boolean).join(' '), rect: { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height },
    fs: Math.min(...[num, nome].filter(Boolean).map(x => parseFloat(getComputedStyle(x).fontSize))), contraste: Math.min(cont(0), cont(255)),
    cor: cor ? getComputedStyle(cor).backgroundColor : null, corPlacar: [placarCor(0), placarCor(1)], fonte: cs.fontFamily,
    elipse: nome ? getComputedStyle(nome).textOverflow === 'ellipsis' && nome.scrollWidth > nome.clientWidth : false, numInteiro: num ? num.scrollWidth <= num.clientWidth + 0.5 : false,
    eventos: e.style.pointerEvents || cs.pointerEvents,
    sa: (() => { const s = document.createElement('div'); s.style.cssText = 'position:fixed;left:var(--sa-l);right:var(--sa-r);top:var(--sa-t);bottom:var(--sa-b);visibility:hidden'; document.body.append(s); const r = s.getBoundingClientRect(); s.remove(); return { l: r.left, r: innerWidth - r.right, b: innerHeight - r.bottom }; })(),
    W: innerWidth, H: innerHeight,
  };
};
if (!soPlacar) {
  const h13b = [], h13bF = [], h13e = [], h13eF = [];
  let h13d = null, h13dOk = false, h13c = null, h13cOk = false;
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&demo=1&semente=4&min=1&replay=0&comemoracao=0&cenas=0`, { waitUntil: 'load' });
    await pronta(pagina);
    const ficha = await pagina.evaluate(async () => { const m = await import('./js/elenco.js'); window.__fichaTeste = id => { const f = m.fichaDe(id); return f ? `${f.num} ${f.camisa ?? f.nome}` : null; }; return true; });
    const ler = () => pagina.evaluate(LN => eval(LN)(), LER_NOME.toString());
    const passo = ms => pagina.evaluate(ms => window.__golaco.relogio.avancar(ms), ms);
    await pagina.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.pausar(true); });
    // b) o caminho de verdade: o meu goleiro com a bola no pé (time 0, à esquerda) e o adversário com a bola (time 1)
    for (const [cena, t] of [['goleiroPe', 0], ['pressao', 1]]) {
      const esperado = await pagina.evaluate(c => { const g = window.__golaco; g.cenaDeTeste(c); return window.__fichaTeste(g.mundo.posse); }, cena);
      await passo(1000);
      const n = await ler();
      const f = [];
      if (!n.vis) f.push('não aparece');
      else {
        if (!n.noHud) f.push('fora do #hud');
        if (n.dir !== (t === 1)) f.push(`lado ${n.dir ? 'direito' : 'esquerdo'}`);
        const borda = t === 0 ? n.rect.l - n.sa.l : n.W - n.sa.r - n.rect.r, base = n.H - n.sa.b - n.rect.b;
        if (borda > 16 || base > 6.5) f.push(`fora do canto (borda ${borda.toFixed(0)} px, base ${base.toFixed(0)} px)`);
        if (n.texto !== esperado) f.push(`texto "${n.texto}" ≠ "${esperado}"`);
        if (!(n.fs >= 11)) f.push(`letra ${n.fs} px`);
        if (!(n.contraste >= 4.5)) f.push(`contraste ${n.contraste.toFixed(1)}:1`);
        if (n.cor !== n.corPlacar[t]) f.push(`cor ${n.cor} ≠ a do placar ${n.corPlacar[t]}`);
        if (n.eventos !== 'none') f.push(`pointer-events ${n.eventos}`);
        if (n.apagado) f.push('apagado com a bola no pé');
      }
      h13b.push(`${cena} (time ${t}): ${n.vis ? `"${n.texto}" ${n.dir ? 'à direita' : 'à esquerda'} em ${n.rect.l.toFixed(0)}–${n.rect.r.toFixed(0)} × ${n.rect.t.toFixed(0)}–${n.rect.b.toFixed(0)}, ${n.fs} px, contraste ${n.contraste.toFixed(1)}:1` : 'escondido'}`);
      if (f.length) h13bF.push(`${cena}: ${f.join(', ')}`);
    }
    // c) o nome mais largo: a caixa no max-width (844 px > 600: ≤ 120), reticências, o número inteiro
    {
      await pagina.evaluate(() => window.__golaco.nomeCantoDeTeste?.({ time: 0, num: 88, nome: 'Wwwwwwwwww' }));
      const n = await ler();
      await pagina.evaluate(() => window.__golaco.nomeCantoDeTeste?.(null));
      h13cOk = n.vis && n.rect.w <= 120.5 && n.elipse && n.numInteiro;
      h13c = n.vis ? `844×390: ${n.rect.w.toFixed(0)} px, reticências ${n.elipse ? 'sim' : 'NÃO'}, número ${n.numInteiro ? 'inteiro' : 'CORTADO'}` : '844×390: sem o nome forçado';
    }
    // e) some: bola solta (0,5 s apagado, 1,0 s fora), intervalo e fim, as 4 camadas
    {
      const r = await pagina.evaluate(async LN => {
        const g = window.__golaco, ler = eval(LN), out = {};
        g.cenaDeTeste('goleiroPe'); g.relogio.avancar(1000);
        out.antes = ler().vis;
        g.mundo.posse = null; g.relogio.avancar(500); const a = ler(); out.meio = { vis: a.vis, apagado: a.apagado };
        g.relogio.avancar(500); out.depois = ler().vis;
        for (const est of ['intervalo', 'fim']) {
          g.cenaDeTeste('goleiroPe'); g.relogio.avancar(1000);
          const p = g.mundo.partida, e0 = p.estado; p.estado = est; g.relogio.avancar(16); out[est] = ler().vis; p.estado = e0; g.relogio.avancar(16);
        }
        g.cenaDeTeste('goleiroPe'); g.relogio.avancar(1000);
        out.camadas = {};
        for (const c of ['em-replay', 'em-comemoracao', 'em-substituicao', 'em-cena']) { document.documentElement.classList.add(c); out.camadas[c] = ler().vis; document.documentElement.classList.remove(c); }
        out.semCamada = ler().vis;
        return out;
      }, LER_NOME.toString());
      h13e.push(`bola solta: antes ${r.antes ? 'visível' : 'ESCONDIDO'}, 0,5 s ${r.meio.vis ? (r.meio.apagado ? 'apagado' : 'ACESO') : 'ESCONDIDO'}, 1,0 s ${r.depois ? 'VISÍVEL' : 'fora'}`);
      if (!r.antes || !r.meio.vis || !r.meio.apagado || r.depois) h13eF.push('bola solta');
      h13e.push(`intervalo ${r.intervalo ? 'VISÍVEL' : 'fora'}, fim ${r.fim ? 'VISÍVEL' : 'fora'}`);
      if (r.intervalo || r.fim) h13eF.push('intervalo/fim');
      const cam = Object.entries(r.camadas).filter(([, v]) => v).map(([k]) => k);
      h13e.push(`camadas: ${cam.length ? 'VISÍVEL em ' + cam.join(', ') : 'fora nas 4'} (sem camada ${r.semCamada ? 'visível' : 'ESCONDIDO'})`);
      if (cam.length || !r.semCamada) h13eF.push('camadas');
    }
    // d) o lado vem do placar: no 2º tempo (o campo trocou de lado) o meu goleiro com a bola continua à esquerda
    {
      const r = await pagina.evaluate(LN => {
        const g = window.__golaco, ler = eval(LN);
        const a0 = g.mundo.ataca[0];
        for (let k = 0; k < 60 && !(g.mundo.partida.tempo === 2 && g.mundo.partida.estado === 'jogo'); k++) g.rodarPassos(300, 'demo');
        const ok2 = g.mundo.partida.tempo === 2 && g.mundo.ataca[0] === -a0;
        g.cenaDeTeste('goleiroPe'); g.relogio.avancar(1000);
        const n = ler();
        return { ok2, tempo: g.mundo.partida.tempo, a0, a1: g.mundo.ataca[0], vis: n.vis, dir: n.dir, l: n.rect?.l, canto: n.vis && n.rect.l - n.sa.l <= 16 && n.H - n.sa.b - n.rect.b <= 6.5 };
      }, LER_NOME.toString());
      h13dOk = r.ok2 && r.vis && !r.dir && r.canto;
      h13d = `${r.tempo}º tempo, o time 0 ataca ${r.a0 > 0 ? '+x' : '−x'} → ${r.a1 > 0 ? '+x' : '−x'}; o meu goleiro com a bola: ${r.vis ? (r.dir ? 'à DIREITA' : `à esquerda (x ${r.l.toFixed(0)}${r.canto ? ', no canto' : ', FORA do canto'})`) : 'ESCONDIDO'}`;
    }
    // e) os modos: treino de ataque e disputa de pênaltis (some), Modo Livre (aparece, o meu time à esquerda)
    {
      const modo = async (v, pronto) => {
        await pagina.evaluate(v => { const g = window.__golaco; g.pausar(false); g.trocarModo(v); }, v);
        await pagina.waitForFunction(pronto, null, { timeout: 120000 }).catch(() => {});
      };
      await modo('ataque', () => window.__golaco.mundo.modo === 'ataque');
      const tr = await pagina.evaluate(LN => { const g = window.__golaco; g.pausar(true); const j = g.mundo.jogadores.find(o => o.time === 0); if (j) g.mundo.posse = j.id; g.relogio.avancar(1000); return eval(LN)().vis; }, LER_NOME.toString());
      h13e.push(`treino de ataque ${tr ? 'VISÍVEL' : 'fora'}`); if (tr) h13eF.push('treino');
      await modo('penaltis', () => !!window.__golaco.mundo.disputa && (window.__golaco.sobDemanda?.ja() ?? true));
      const pen = await pagina.evaluate(LN => {
        const g = window.__golaco, ler = eval(LN); g.pausar(false);
        let visto = 0, comPosse = 0;
        for (let i = 0; i < 60 * 25; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.mundo.posse != null) { comPosse++; if (ler().vis) visto++; } }
        return { visto, comPosse };
      }, LER_NOME.toString());
      h13e.push(`disputa de pênaltis: ${pen.visto ? `VISÍVEL em ${pen.visto}` : 'fora'} de ${pen.comPosse} quadros com a bola no pé`); if (pen.visto || !pen.comPosse) h13eF.push('pênaltis');
      await modo('livre', () => !!window.__golaco.mundo.livre && (window.__golaco.sobDemanda?.ja() ?? true));
      const lv = await pagina.evaluate(LN => { const g = window.__golaco; g.pausar(true); const j = g.mundo.jogadores.find(o => o.time === 0 && o.posicao !== 'GOL') ?? g.mundo.jogadores.find(o => o.time === 0); if (j) g.mundo.posse = j.id; g.relogio.avancar(1000); const n = eval(LN)(); return { vis: n.vis, dir: n.dir }; }, LER_NOME.toString());
      h13e.push(`Modo Livre: ${lv.vis ? (lv.dir ? 'à DIREITA' : 'à esquerda') : 'ESCONDIDO'}`); if (!lv.vis || lv.dir) h13eF.push('livre');
    }
  } finally { await navegador.close(); }
  // ?prints=1: nunca
  {
    const s2 = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
    try {
      await s2.pagina.goto(`${srv.url}?q=baixa&toque=1&prints=1&demo=1&semente=4`, { waitUntil: 'load' });
      await pronta(s2.pagina);
      const vis = await s2.pagina.evaluate(LN => { const g = window.__golaco; g.relogio.usarManual(true); g.pausar(true); g.cenaDeTeste('goleiroPe'); g.relogio.avancar(1000); return eval(LN)().vis; }, LER_NOME.toString());
      h13e.push(`?prints=1 ${vis ? 'VISÍVEL' : 'fora'}`); if (vis) h13eF.push('prints');
    } finally { await s2.navegador.close(); }
  }
  meta('H13b o nome pelo caminho de verdade: "número camisa" de quem tem a bola, no canto do time no placar, letra ≥ 11 px, contraste ≥ 4,5:1, a cor da faixa do placar, sem pegar toque',
    `${h13bF.length ? 'FALHAS: ' + h13bF.join(' | ') + ' — ' : ''}${h13b.join('; ')}`, 'time 0 à esquerda, time 1 à direita, texto da ficha', h13b.length === 2 && h13bF.length === 0);
  meta('H13c o nome mais largo no celular: ≤ 120 px (844 px de largura), reticências, o número inteiro', h13c ?? '-', '≤ 120 px, reticências, número inteiro', h13cOk);
  meta('H13d o lado vem do placar: no 2º tempo (o campo trocou de lado) o meu goleiro com a bola continua à esquerda', h13d ?? '-', 'à esquerda', h13dOk);
  meta('H13e o nome some: bola solta (0,5 s apagado, 1,0 s fora), intervalo e fim, as 4 camadas, treino, disputa de pênaltis e ?prints=1; aparece no Modo Livre',
    `${h13eF.length ? 'FALHAS: ' + h13eF.join(', ') + ' — ' : ''}${h13e.join('; ')}`, 'como pedido', h13e.length === 7 && h13eF.length === 0 && erros.length === 0);
}

// H5: PC 1280×720 — a dica de teclas aparece no começo e some sozinha; 9 s depois o HUD ocupa ≤ 2,5%
{
  const { navegador, pagina } = await abrir({ largura: 1280, altura: 720, dpr: 1, toque: false });
  try {
    await pagina.goto(`${srv.url}?q=baixa&demo=1&semente=4`, { waitUntil: 'load' });
    await pronta(pagina);
    await pagina.waitForTimeout(1000);
    const dica0 = await pagina.evaluate(() => { const d = document.getElementById('dica'); const s = d && getComputedStyle(d); return !!d && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.5; });
    // o tempo da animação que a apaga (8 s + 0,6 s de esmaecer), lido enquanto ela roda: no fim a dica ganha .vista
    // (display:none) e a animação deixa de existir
    const fimAnim = await pagina.evaluate(() => { const a = document.getElementById('dica')?.getAnimations()[0]; return a ? Math.round(+(a.effect?.getComputedTiming().endTime ?? -1)) : -1; });
    // H13g (com a dica na tela): o nome da esquerda (forçado, o mais largo) fica ≥ 4 px acima dela
    const nomeDica = await pagina.evaluate(LN => {
      const g = window.__golaco; if (!g.nomeCantoDeTeste) return null;
      g.nomeCantoDeTeste({ time: 0, num: 88, nome: 'Wwwwwwwwww' });
      const n = eval(LN)(), d = document.getElementById('dica').getBoundingClientRect();
      g.nomeCantoDeTeste(null);
      return { vis: n.vis, b: n.rect.b, t: n.rect.t, l: n.rect.l, r: n.rect.r, w: n.rect.w, dicaT: d.top, dicaB: d.bottom, dicaL: d.left, dicaR: d.right, H: n.H, sab: n.sa.b };
    }, LER_NOME.toString());
    // H13g (revisão): janela de PC estreita com a dica na tela — o nome da esquerda cabe entre a dica e o minimapa (≥ 56 px, a
    // ≥ 4 px dos dois) ou some até ela sumir (em 560 px era uma lasca de 8 px por cima do minimapa); 800 px: cabe
    const nomeEstreito = [];
    for (const [W, H] of [[560, 600], [800, 600]]) {
      await pagina.setViewportSize({ width: W, height: H });
      await pagina.waitForTimeout(300);
      nomeEstreito.push(await pagina.evaluate(async ([LN, W]) => {
        await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const g = window.__golaco; if (!g.nomeCantoDeTeste) return null;
        g.nomeCantoDeTeste({ time: 0, num: 88, nome: 'Wwwwwwwwww' });
        const n = eval(LN)(), d = document.getElementById('dica'), ds = getComputedStyle(d), q = d.getBoundingClientRect();
        const mp = document.getElementById('minimapa'), m = mp && getComputedStyle(mp).display !== 'none' ? mp.getBoundingClientRect() : null;
        g.nomeCantoDeTeste(null);
        const sep = (a, b) => Math.max(a.l - b.r, b.l - a.r, a.t - b.b, b.t - a.b);
        return { W, dica: ds.display !== 'none' && ds.visibility !== 'hidden' && +ds.opacity > 0.5, vis: n.vis, w: n.rect.w, l: n.rect.l, r: n.rect.r,
          dDica: n.vis ? sep(n.rect, { l: q.left, r: q.right, t: q.top, b: q.bottom }) : null, dMapa: n.vis && m ? sep(n.rect, { l: m.left, r: m.right, t: m.top, b: m.bottom }) : null };
      }, [LER_NOME.toString(), W]));
    }
    await pagina.setViewportSize({ width: 1280, height: 720 });
    await pagina.waitForTimeout(300);
    // a dica some pelo relógio das animações da página (8 s + 0,6 s de esmaecer). Com a máquina carregada o Chromium sem
    // GPU desenha poucos quadros e esse relógio atrasa ~1–2 s do real: esperar um tempo fixo media a dica ainda na tela
    // (2,5% "passando" por arredondamento). Espera o fim da animação (até 40 s reais) e mede o tempo DELA.
    const fimDica = await pagina.waitForFunction(() => {
      const d = document.getElementById('dica'); if (!d) return false;
      const s = getComputedStyle(d);
      return s.display === 'none' || s.visibility === 'hidden' || +s.opacity <= 0.01;
    }, null, { timeout: 40000, polling: 250 }).then(() => ({ ms: fimAnim })).catch(() => null);
    const r = await pagina.evaluate(([FS, AS]) => { const x = eval(FS)(); return { area: eval(AS)(x.f, innerWidth, innerHeight), nomes: x.f.map(s => s.nome) }; }, [FORMAS.toString(), AREA.toString()]);
    meta('H5 área do HUD no PC 1280×720 (depois que a dica some)', `${(r.area * 100).toFixed(1)}% (${r.nomes.join(', ')})`, '≤ 2,5%', r.area <= 0.025);
    meta('H5 a dica de teclas do PC aparece no começo e some sozinha em ≤ 9 s', `${dica0 ? 'visível 1 s depois de abrir' : 'não aparece'}; ${fimDica ? `some aos ${(fimDica.ms / 1000).toFixed(1)} s de animação` : 'não some em 40 s'}`, 'visível; some ≤ 9 s',
      dica0 && fimDica && fimDica.ms > 0 && fimDica.ms <= 9000);
    const mapa = await pagina.evaluate(() => { const m = document.getElementById('minimapa'); return !!m && getComputedStyle(m).display !== 'none' && m.offsetWidth > 0; });
    meta('H7 PC: o minimapa continua ligado por padrão', String(mapa), 'true', mapa);
    // H13g + H13a/c no PC (depois que a dica some): os dois nomes forçados nos cantos a 14 px, ≤ 200 px, letra ≥ 12 px (o
    // animationend da dica, que devolve o nome ao canto, chega no quadro seguinte ao fim da animação: espera ele, até 3 s)
    await pagina.waitForFunction(() => !document.documentElement.classList.contains('dica-visivel'), null, { timeout: 3000 }).catch(() => {});
    const pcNomes = await pagina.evaluate(LN => {
      const g = window.__golaco; if (!g.nomeCantoDeTeste) return null;
      const out = {};
      for (const t of [0, 1]) { g.nomeCantoDeTeste({ time: t, num: 88, nome: 'Wwwwwwwwww' }); out[t] = eval(LN)(); }
      g.nomeCantoDeTeste(null);
      return out;
    }, LER_NOME.toString());
    // (revisão) depois que a dica some, uma camada (replay, cena do cartão) a escondia com display:none e, na saída, a animação
    // recomeçava: ela voltava por 8 s, debaixo do nome da esquerda no canto. Liga e desliga cada camada e olha 0,5 s depois
    const voltaCamada = [];
    for (const cl of ['em-replay', 'em-cena']) {
      await pagina.evaluate(cl => { window.__golaco.nomeCantoDeTeste?.({ time: 0, num: 88, nome: 'Wwwwwwwwww' }); document.documentElement.classList.add(cl); }, cl);
      await pagina.waitForTimeout(300);
      await pagina.evaluate(cl => document.documentElement.classList.remove(cl), cl);
      await pagina.waitForTimeout(500);
      voltaCamada.push(await pagina.evaluate(([LN, cl]) => {
        const n = eval(LN)(), d = document.getElementById('dica'), ds = getComputedStyle(d), q = d.getBoundingClientRect();
        window.__golaco.nomeCantoDeTeste?.(null);
        const dica = ds.display !== 'none' && ds.visibility !== 'hidden' && +ds.opacity > 0.01;
        const sobre = dica && n.vis && q.left < n.rect.r + 4 && n.rect.l < q.right + 4 && q.top < n.rect.b + 4 && n.rect.t < q.bottom + 4;
        return { cl, dica, op: +ds.opacity, sobre, borda: n.vis ? n.rect.l - n.sa.l : null };
      }, [LER_NOME.toString(), cl]));
    }
    {
      const f = [], txt = [];
      if (!nomeDica || !pcNomes || nomeEstreito.some(x => !x)) f.push('sem a API do nome nos cantos');
      else {
        for (const x of nomeEstreito) {
          const ok = x.vis ? x.w >= 56 && x.dDica >= 4 && (x.dMapa === null || x.dMapa >= 4) : x.W < 692;
          if (!x.dica) f.push(`${x.W} px: a dica já tinha sumido`);
          else if (!ok) f.push(`${x.W} px com a dica: nome ${x.vis ? `${x.w.toFixed(0)} px em ${x.l.toFixed(0)}–${x.r.toFixed(0)}, a ${x.dDica.toFixed(0)} px da dica e ${x.dMapa === null ? '-' : x.dMapa.toFixed(0)} do minimapa` : 'escondido'}`);
          txt.push(`${x.W} px com a dica: ${x.vis ? `${x.w.toFixed(0)} px, a ${x.dDica.toFixed(0)} da dica e ${x.dMapa === null ? '-' : x.dMapa.toFixed(0)} do minimapa` : 'nome escondido'}`);
        }
        for (const v of voltaCamada) {
          if (v.dica || v.sobre || v.borda === null || Math.abs(v.borda - 14) > 1) f.push(`depois de ${v.cl}: a dica ${v.dica ? `voltou (opacidade ${v.op.toFixed(2)})${v.sobre ? ' debaixo do nome' : ''}` : 'fora'}, nome ${v.borda === null ? 'escondido' : `a ${v.borda.toFixed(0)} px da borda`}`);
          txt.push(`depois de ${v.cl}: dica ${v.dica ? 'VOLTOU' : 'fora'}`);
        }
        // (com a dica, o nome fica na mesma linha, à direita dela: em cima dela encostava na faixa ENTRA/SAI do jogo)
        const dd = nomeDica.vis ? Math.max(nomeDica.l - nomeDica.dicaR, nomeDica.dicaL - nomeDica.r, nomeDica.t - nomeDica.dicaB, nomeDica.dicaT - nomeDica.b) : -Infinity;
        const baseD = nomeDica.H - nomeDica.sab - nomeDica.b;
        if (!nomeDica.vis || !(dd >= 4) || Math.abs(baseD - 14) > 1) f.push(`com a dica: nome ${nomeDica.vis ? `a ${dd.toFixed(0)} px da dica, base a ${baseD.toFixed(0)} px` : 'escondido'}`);
        txt.push(`com a dica: o nome em ${nomeDica.l.toFixed(0)}–${nomeDica.r.toFixed(0)} × ${nomeDica.t.toFixed(0)}–${nomeDica.b.toFixed(0)}, a dica em ${nomeDica.dicaL.toFixed(0)}–${nomeDica.dicaR.toFixed(0)} × ${nomeDica.dicaT.toFixed(0)}–${nomeDica.dicaB.toFixed(0)}`);
        for (const t of [0, 1]) {
          const n = pcNomes[t];
          if (!n.vis) { f.push(`nome ${t} escondido`); continue; }
          const borda = t === 0 ? n.rect.l - n.sa.l : n.W - n.sa.r - n.rect.r, base = n.H - n.sa.b - n.rect.b;
          if (Math.abs(borda - 14) > 1 || Math.abs(base - 14) > 1) f.push(`nome ${t} a ${borda.toFixed(0)} px da borda e ${base.toFixed(0)} da base`);
          if (n.rect.w > 200.5) f.push(`nome ${t} com ${n.rect.w.toFixed(0)} px`);
          if (!(n.fs >= 12)) f.push(`letra ${n.fs} px`);
          if (n.dir !== (t === 1)) f.push(`nome ${t} do lado errado`);
          txt.push(`${t ? 'dir' : 'esq'} ${n.rect.l.toFixed(0)}–${n.rect.r.toFixed(0)} × ${n.rect.t.toFixed(0)}–${n.rect.b.toFixed(0)}, ${n.fs} px`);
        }
      }
      meta('H13g PC 1280×720: com a dica na tela o nome da esquerda fica na linha de baixo a ≥ 4 px dela (560 e 800 px: ≥ 56 px longe da dica e do minimapa ou escondido abaixo de ~690 px); depois, os dois nos cantos a 14 px (≤ 200 px, letra ≥ 12 px) e a dica não volta depois de uma camada (replay, cena)',
        `${f.length ? 'FALHAS: ' + f.join(', ') + ' — ' : ''}${txt.join('; ')}`, 'longe da dica e do minimapa; cantos a 14 ± 1 px; a dica fora', f.length === 0);
    }
    // H12f + H12b no PC: o minimapa no lugar de antes (centro W/2 ± 1, base H − 14 ± 1) em 1280×720 e 1920×1080; nada no alto
    {
      const pcMapa = [];
      let okF = true, alto = [];
      for (const [W, H] of [[1280, 720], [1920, 1080]]) {
        if (W !== 1280) { await pagina.setViewportSize({ width: W, height: H }); await pagina.waitForTimeout(300); }
        const r = await pagina.evaluate(async FS => {
          await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
          const q = document.getElementById('minimapa').getBoundingClientRect();
          const alto = eval(FS)().f.filter(x => x.ret && x.ret[1] < innerHeight * 0.3 && !['placar', 'menu'].includes(x.nome)).map(x => x.nome);
          return { cx: (q.left + q.right) / 2, b: q.bottom, w: q.width, W: innerWidth, H: innerHeight, alto };
        }, FORMAS.toString());
        const ok = r.w > 0 && Math.abs(r.cx - r.W / 2) <= 1 && Math.abs(r.H - 14 - r.b) <= 1;
        if (!ok) okF = false;
        alto.push(...r.alto);
        pcMapa.push(`${W}×${H}: centro ${(r.cx - r.W / 2).toFixed(1)} px do meio, base a ${(r.H - r.b).toFixed(1)} px`);
      }
      await pagina.setViewportSize({ width: 1280, height: 720 }); await pagina.waitForTimeout(300);
      meta('H12f PC: o minimapa embaixo no meio, como antes (1280×720 e 1920×1080)', pcMapa.join('; '), 'centro W/2 ± 1, base H − 14 ± 1', okF);
      meta('H12b PC: nada no alto além do placar e do menu', alto.length ? alto.join(', ') : 'só placar e menu', 'só placar e menu', alto.length === 0);
    }
    // H10 no PC: os 5 estados, sem e com a cara do TM, com o relógio manual parado (o laço não reescreve o placar); e o H5 com o
    // placar mais largo ("97:13 +10") e o nome mais largo (200 px) no canto de cada time
    await pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
    const h5Largo = [];
    for (const tm of [false, true]) {
      await pagina.evaluate(([CT, tm]) => eval(CT)(tm), [CARA_TM.toString(), tm]);
      for (const [estado, gols, rel] of ESTADOS_PLACAR) {
        const m = await pagina.evaluate(([MP, gols, rel]) => eval(MP)(gols, rel), [MEDIR_PLACAR.toString(), gols, rel]);
        conferirPlacar('1280×720', 'pc', estado, m);
      }
      const a = await pagina.evaluate(async ([MP, FS, AS, gols, rel]) => {
        await eval(MP)(gols, rel);
        const g = window.__golaco, out = [];
        for (const t of [0, 1]) {
          if (g.nomeCantoDeTeste) g.nomeCantoDeTeste({ time: t, num: 88, nome: 'Wwwwwwwwww' });
          const x = eval(FS)(); out.push(eval(AS)(x.f, innerWidth, innerHeight));
        }
        if (g.nomeCantoDeTeste) g.nomeCantoDeTeste(null);
        return Math.max(...out);
      }, [MEDIR_PLACAR.toString(), FORMAS.toString(), AREA.toString(), ESTADOS_PLACAR[2][1], ESTADOS_PLACAR[2][2]]);
      h5Largo.push({ tm, a });
    }
    await pagina.evaluate(CT => eval(CT)(false), CARA_TM.toString());
    const h5Pior = Math.max(...h5Largo.map(x => x.a));
    meta('H5 PC 1280×720 com o placar mais largo ("97:13 +10", sem e com a cara do TM) e o nome mais largo no canto de cada time',
      h5Largo.map(x => `${x.tm ? 'TM' : 'sem TM'} ${(x.a * 100).toFixed(2)}%`).join('; '), '≤ 2,5%', h5Largo.length === 2 && h5Pior <= 0.025);
    meta('H10 placar maior e com a cara do TM (17/10, depois do "menor" de 12/10): formato com MM:SS, "+N" e "Intervalo"/"Fim", altura 28/26/30 px, legível e sem encostar (4 telas do celular + PC, sem e com o TM; jogo, +4, +10, intervalo e fim)',
      `${placarFalhas.length ? 'FALHAS: ' + placarFalhas.join(' | ') + ' — ' : ''}${placarLinhas.join('; ')}; com o minimapa: ${placarEncosta.join('; ')}; treino com o minimapa: ${placarTreino.join('; ')}; leitor de tela: ${placarAria}`,
      `marca (> 700 px e PC), 2 escudos, 2 siglas, placar, relógio MM:SS no bloco verde ("+N" só nos acréscimos; parado escuro); altura ${PLACAR_ALT.celular}/${PLACAR_ALT.baixo} (568×320 e 640×360)/${PLACAR_ALT.pc} (PC) > 12/10 (${PLACAR_1210.celular.h}/${PLACAR_1210.pc.h}) e ≤ ${PLACAR_REF.h} no celular; área no jogo ≤ 1,5 × a de 12/10 e ≤ ${PLACAR_REF.area} em 844×390; gols ≥ 18 (PC 20), relógio ≥ 16 (PC 17), siglas ≥ 12 (11 em 568×320 e 640×360), "+N" ≥ 11, palavra ≥ 13, escudos ≥ 14; nada encosta`,
      placarFalhas.length === 0 && placarLinhas.length === 10 * (TELAS_CEL.length + 1) && placarEncosta.length === TELAS_CEL.length && placarTreino.length === TELAS_CEL.length && !!placarAria);
  } finally { await navegador.close(); }
}

// H14 (item 32): o relógio anda na página — a partida da demo com o relógio manual (sem comemoração, replay e cenas: nada
// segura o laço)
{
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  let a = null, b = null;
  try {
    // a) 600 quadros (10 s reais)
    await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&demo=1&semente=4&comemoracao=0&replay=0&cenas=0`, { waitUntil: 'load' });
    await pronta(pagina);
    a = await pagina.evaluate(() => {
      const g = window.__golaco; g.relogio.usarManual(true);
      const rel = document.getElementById('relogio'), pl = document.querySelector('#hud .placar');
      g.relogio.avancar(1000 / 60, { desenhar: false });
      const obs = new MutationObserver(() => {});
      obs.observe(rel, { characterData: true, childList: true, subtree: true });
      const lerS = t => { const m = /^(\d{2}):(\d{2})$/.exec(t); return m ? +m[1] * 60 + +m[2] : null; };
      const t0 = rel.textContent.trim(), s0 = lerS(t0), textos = new Set(), fora = [], larg = [];
      let ant = s0, voltas = 0;
      for (let i = 0; i < 600; i++) {
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const t = rel.textContent.trim(), s = lerS(t);
        textos.add(t);
        larg.push(pl.getBoundingClientRect().width);
        if (s === null) { if (fora.length < 3) fora.push(t); continue; }
        if (ant !== null && s < ant) voltas++;
        ant = s;
      }
      const escritas = obs.takeRecords().length; obs.disconnect();
      return { t0, s0, t1: rel.textContent.trim(), s1: ant, textos: textos.size, escritas, fora, voltas, lMin: Math.min(...larg), lMax: Math.max(...larg) };
    });
    // b) ?min=0.25 (15 s por tempo) até o fim
    await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&demo=1&semente=4&comemoracao=0&replay=0&cenas=0&min=0.25`, { waitUntil: 'load' });
    await pronta(pagina);
    b = await pagina.evaluate(() => {
      const g = window.__golaco; g.relogio.usarManual(true);
      const rel = document.getElementById('relogio'), tp = document.getElementById('relogio-tempo'), bloco = document.getElementById('placar-relogio');
      const visTp = () => !!tp && tp.getClientRects().length > 0 && getComputedStyle(tp).display !== 'none' && tp.getBoundingClientRect().width > 0;
      const lerS = t => { const m = /^(\d{2,3}):(\d{2})$/.exec(t); return m ? +m[1] * 60 + +m[2] : null; };
      const out = { mais: { 1: null, 2: null }, maisErr: [], intervalo: null, abre2: null, fim: null, quadros: 0 };
      for (let i = 0; i < 8000 && g.mundo.partida.estado !== 'fim'; i++) {
        g.relogio.avancar(1000 / 60, { desenhar: false });
        out.quadros++;
        const p = g.mundo.partida, t = rel.textContent.trim(), n = visTp() ? tp.textContent.trim() : '';
        if (p.estado === 'intervalo') { if (!out.intervalo) out.intervalo = { txt: t, parado: bloco.classList.contains('parado'), extra: n }; continue; }
        if (p.tempo === 2 && out.abre2 === null) out.abre2 = t;
        if (n) {
          const s = lerS(t), base = p.tempo === 1 ? 2700 : 5400;
          if (!out.mais[p.tempo]) out.mais[p.tempo] = `${t} ${n}`;
          if (n !== `+${p.acrescimo}` || s === null || s < base) { if (out.maisErr.length < 3) out.maisErr.push(`${p.tempo}º tempo: "${t} ${n}" (acréscimo ${p.acrescimo})`); }
        }
      }
      g.relogio.avancar(1000 / 60, { desenhar: false });
      out.fim = { estado: g.mundo.partida.estado, txt: rel.textContent.trim(), parado: bloco.classList.contains('parado'), extra: visTp() ? tp.textContent.trim() : '' };
      return out;
    });
  } finally { await navegador.close(); }
  const avanco = a.s1 != null && a.s0 != null ? a.s1 - a.s0 : NaN;
  const dl = a.lMax - a.lMin;
  meta('H14a o relógio anda (844×390, demo, 600 quadros = 10 s reais): sempre MM:SS, 112 ± 2 s de jogo, nunca volta, escreve só quando muda, a largura do placar constante',
    `"${a.t0}" → "${a.t1}"${a.fora.length ? ` (fora de MM:SS: ${a.fora.map(t => `"${t}"`).join(', ')})` : ''}: ${Number.isFinite(avanco) ? avanco : '-'} s de jogo, ${a.voltas} voltas; ${a.escritas} escritas para ${a.textos} textos; largura ${a.lMin.toFixed(1)}–${a.lMax.toFixed(1)} px`,
    'MM:SS; 110,5–114,5 s; 0 voltas; escritas ≤ textos + 1; variação ≤ 0,5 px', a.fora.length === 0 && avanco >= 110.5 && avanco <= 114.5 && a.voltas === 0 && a.escritas <= a.textos + 1 && dl <= 0.5 && erros.length === 0);
  const fb = [];
  if (!b.mais[1] || !b.mais[2]) fb.push(`"+N" ${b.mais[1] ? '' : 'no 1º tempo '}${b.mais[2] ? '' : 'no 2º tempo '}ausente`);
  if (b.maisErr.length) fb.push(...b.maisErr);
  if (!b.intervalo || b.intervalo.txt !== 'Intervalo' || !b.intervalo.parado || b.intervalo.extra) fb.push(`intervalo ${JSON.stringify(b.intervalo)}`);
  if (!/^45:0\d$/.test(b.abre2 ?? '')) fb.push(`o 2º tempo abre em "${b.abre2}"`);
  if (b.fim.estado !== 'fim' || b.fim.txt !== 'Fim' || !b.fim.parado || b.fim.extra) fb.push(`fim ${JSON.stringify(b.fim)}`);
  meta('H14b ?min=0.25 até o fim: o "+N" (o anunciado) com o relógio ≥ 45:00/90:00, "Intervalo" parado, o 2º tempo em 45:0x, o "+N" no 2º tempo, "Fim" parado',
    `${fb.length ? 'FALHAS: ' + fb.join(' | ') + ' — ' : ''}1º tempo "${b.mais[1]}" → ${b.intervalo?.txt ?? '-'} → "${b.abre2}" → "${b.mais[2]}" → ${b.fim.txt} (${b.quadros} quadros)`,
    'a sequência', fb.length === 0);
}

// H7 + H8: opções da pausa no celular e os ajustes antigos
if (!soPlacar) {
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&demo=1&semente=4`, { waitUntil: 'load' });
    await pronta(pagina);
    // H8: ajustes salvos com a chave antiga (tamanho 130%, opacidade 95%) e a página aberta de novo
    await pagina.evaluate(() => { localStorage.setItem('golaco.toque.v1', JSON.stringify({ tamanho: 1.3, opacidade: 0.95 })); });
    await pagina.reload({ waitUntil: 'load' });
    await pronta(pagina);
    const aj = await pagina.evaluate(() => { const s = getComputedStyle(document.documentElement); return { tam: s.getPropertyValue('--toque-escala').trim(), opa: s.getPropertyValue('--toque-opacidade').trim(), chute: document.getElementById('btn-chute')?.offsetWidth ?? 0 }; });
    meta('H8 ajustes antigos (golaco.toque.v1) não valem: padrão novo 80% / 55%', `tamanho ${aj.tam}, opacidade ${aj.opa}, CHUTE ${aj.chute} px`, '0.8 / 0.55', +aj.tam === 0.8 && +aj.opa === 0.55);
    const estado = () => pagina.evaluate(() => {
      const m = document.getElementById('minimapa'), sp = document.querySelector('#btn-chute span');
      return {
        mapa: !!m && getComputedStyle(m).display !== 'none' && m.offsetWidth > 0,
        nomes: !!sp && getComputedStyle(sp).display !== 'none' && sp.offsetWidth > 0,
        temOpcoes: !!document.getElementById('chip-minimapa') && !!document.getElementById('chip-nomes'),
        pressionados: [document.getElementById('chip-minimapa')?.getAttribute('aria-pressed'), document.getElementById('chip-nomes')?.getAttribute('aria-pressed')].join('/'),
        // a pausa cabe sem rolar no celular deitado (item 58: a janela, o corpo e o nível à vista — com o submenu Opções aberto,
        // onde moram o Minimapa e os Nomes nos botões)
        rola: (() => { const l = [document.querySelector('.janela-menu'), document.querySelector('#menu .menu-corpo'), ...document.querySelectorAll('#menu .menu-acoes:not([hidden])')].filter(Boolean); return l.length ? Math.max(...l.map(e => e.scrollHeight - e.clientHeight)) : 0; })(),
      };
    });
    const e0 = await estado();
    let e1 = { mapa: false, nomes: false }, e2 = e1, e3 = { nomes: true }, enc = ['sem as opções'], menu = { pressionados: '-', rola: NaN }, sub = null;
    if (e0.temOpcoes) {
      // (item 58: o Minimapa e os Nomes nos botões estão no submenu Opções da pausa)
      await pagina.evaluate(() => window.__golaco.abrirMenu());
      await pagina.click('#btn-opcoes');
      menu = await estado();
      // o submenu "Modo de jogo" (12/10: a opção da cena de substituição entrou nele, ao lado do pré-jogo) também cabe
      // sem rolar, e os dois botões da linha de cenas não encostam
      sub = await pagina.evaluate(() => {
        document.getElementById('btn-modos')?.click();
        const j = document.querySelector('.janela-menu'), b = document.getElementById('btn-subst'), p = document.getElementById('btn-prejogo');
        const vis = e => !!e && e.offsetParent !== null && e.getBoundingClientRect().height > 0;
        const rb = b?.getBoundingClientRect(), rp = p?.getBoundingClientRect();
        const folga = rb && rp ? Math.max(rb.left - rp.right, rp.left - rb.right, rb.top - rp.bottom, rp.top - rb.bottom) : NaN;
        // (item 58: a janela não rola mais — quem rolaria é o corpo da faixa ou o nível à vista)
        const rola = Math.max(j ? j.scrollHeight - j.clientHeight : 0, ...[document.querySelector('#menu .menu-corpo'), ...document.querySelectorAll('#menu .menu-acoes:not([hidden])')].filter(Boolean).map(e => e.scrollHeight - e.clientHeight));
        const r = { rola, subst: vis(b), prejogo: vis(p), folga, texto: b?.textContent.replace(/\s+/g, ' ').trim() ?? '' };
        document.querySelector('#menu-modos [data-cmd="modos-voltar"]')?.click();
        return r;
      });
      // liga o minimapa (os nomes já vêm ligados): os dois ligados
      await pagina.click('#btn-opcoes');
      await pagina.click('#chip-minimapa');
      await pagina.evaluate(() => window.__golaco.fecharMenu());
      await pagina.waitForTimeout(150);
      e1 = await estado();
      // ligados, nada encosta: placar, minimapa, menu e botões das duas fases (com os nomes)
      enc = await pagina.evaluate(([FS, ES]) => {
        const formas = eval(FS), encosta = eval(ES), p = [];
        for (const fase of ['ataque', 'defesa']) {
          const tq = document.getElementById('toque');
          tq.classList.toggle('fase-ataque', fase === 'ataque'); tq.classList.toggle('fase-defesa', fase === 'defesa');
          p.push(...encosta(formas().f).map(t => `${fase}: ${t}`));
        }
        window.__golaco.sincronizarFase?.();
        return p;
      }, [FORMAS.toString(), ENCOSTA.toString()]);
      await pagina.reload({ waitUntil: 'load' });
      await pronta(pagina);
      e2 = await estado();
      // desligar os nomes na pausa: só o ícone, e fica salvo
      await pagina.evaluate(() => window.__golaco.abrirMenu());
      await pagina.click('#btn-opcoes');
      await pagina.click('#chip-nomes');
      await pagina.evaluate(() => window.__golaco.fecharMenu());
      await pagina.reload({ waitUntil: 'load' });
      await pronta(pagina);
      e3 = await estado();
    }
    meta('H7 celular: minimapa desligado e nomes dos botões LIGADOS por padrão (dono, 12/10); opções na pausa (que cabe sem rolar)', `minimapa ${e0.mapa ? 'ligado' : 'desligado'}, nomes ${e0.nomes ? 'ligados' : 'desligados'}, opções ${e0.temOpcoes ? `na pausa (marcadas ${menu.pressionados}), pausa rola ${menu.rola} px` : 'NÃO existem'}`, 'minimapa não, nomes sim, opções na pausa (false/true), rola ≤ 0 px', !e0.mapa && e0.nomes && e0.temOpcoes && menu.pressionados === 'false/true' && menu.rola <= 0);
    meta('H7 celular: o submenu "Modo de jogo" (com Pré-jogo e Substituição lado a lado) cabe sem rolar e nada encosta',
      sub ? `rola ${sub.rola} px; Substituição ${sub.subst ? `visível ("${sub.texto}")` : 'NÃO aparece'}, Pré-jogo ${sub.prejogo ? 'visível' : 'NÃO aparece'}, folga entre eles ${Number.isFinite(sub.folga) ? sub.folga.toFixed(0) : '-'} px` : 'sem a pausa',
      'rola ≤ 0 px; os dois visíveis; folga ≥ 4 px', !!sub && sub.rola <= 0 && sub.subst && sub.prejogo && sub.folga >= 4);
    meta('H7 celular: com o minimapa ligado na pausa os dois aparecem, nada encosta e fica salvo; desligar os nomes deixa só o ícone (salvo)', `ligados: minimapa ${e1.mapa}, nomes ${e1.nomes}${enc.length ? ' — encosta: ' + enc.join('; ') : ''}; depois de abrir de novo: minimapa ${e2.mapa}, nomes ${e2.nomes}; nomes desligados e aberto de novo: ${e3.nomes ? 'ainda aparecem' : 'só o ícone'}`, 'tudo true, nada encosta; depois só o ícone',
      e1.mapa && e1.nomes && enc.length === 0 && e2.mapa && e2.nomes && !e3.nomes && erros.length === 0);
  } finally { await navegador.close(); }
}
await srv.fechar();
const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.every(r => r.ok);
console.log(ok ? '\nteste-hud-minimo: PASSOU' : '\nteste-hud-minimo: REPROVOU');
process.exit(ok ? 0 : 1);
