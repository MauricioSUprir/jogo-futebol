// PODERES QUE EVOLUEM COM AS BATALHAS (dono, 31/10: "mostra o Barry aprendendo seus poderes e as habilidades que ele vai
// ganhando com as batalhas"): cada luta vencida dá experiência; a cada nível o velocista aprende uma habilidade, que a Caitlin
// ou o Cisco explicam pelo rádio. Vale nas duas versões. PURO (sem three.js nem DOM): o jogo lê os bônus a cada quadro.
// Quem já tinha vencido vilões antes desta versão começa com a experiência deles (`inicial`).

/** experiência por tipo de vitória */
export const XP = { vilao: 100, rival: 50, crime: 15, nocaute: 2 };
/** os níveis: a experiência acumulada para chegar, a habilidade aprendida e o que ela muda (bônus TOTAL a partir dele) */
export const NIVEIS = [
  { xp: 0, nome: 'Velocista', texto: 'Correr, escalar, vibrar e bater.' },
  { xp: 80, nome: 'Punho relâmpago', texto: 'Socos e golpes 20% mais fortes.', forca: 1.2 },
  { xp: 200, nome: 'Fôlego de raio', texto: 'A energia volta 25% mais rápido.', recarga: 1.25 },
  { xp: 350, nome: 'Passo relâmpago', texto: 'O BATER alcança bandidos mais longe (22 m).', alcance: 22 },
  { xp: 550, nome: 'Pele de raio', texto: 'Recebe 20% menos dano.', protecao: 0.8 },
  { xp: 800, nome: 'Arranque', texto: 'A supervelocidade embala 30% mais rápido.', embalo: 1.3 },
  { xp: 1100, nome: 'Coração da Força de Aceleração', texto: 'As esferas dão o dobro de energia.', esfera: 2 },
  { xp: 1450, nome: 'Punho de trovão', texto: 'Socos e golpes 40% mais fortes.', forca: 1.4 },
  { xp: 1850, nome: 'Corpo de raio', texto: 'Recebe 35% menos dano.', protecao: 0.65 },
  { xp: 2300, nome: 'Velocista completo', texto: 'A energia volta 50% mais rápido.', recarga: 1.5 },
];
const BONUS0 = { forca: 1, recarga: 1, alcance: 16, protecao: 1, embalo: 1, esfera: 1 };

/** o nível (1..10) de uma experiência */
export const nivelDe = (xp) => { let n = 1; for (let i = 1; i < NIVEIS.length; i++) if (xp >= NIVEIS[i].xp) n = i + 1; return n; };
/** os bônus de um nível: o último valor de cada um até ele */
export function bonusDe(nivel) {
  const b = { ...BONUS0 };
  for (let i = 1; i < Math.min(nivel, NIVEIS.length); i++) for (const k of Object.keys(BONUS0)) if (NIVEIS[i][k] !== undefined) b[k] = NIVEIS[i][k];
  return b;
}

/** armazem: localStorage (ou null); chave: onde guardar; inicial: a experiência de quem já jogou (sem save ainda) */
export function criarPoderes({ armazem = null, chave = 'theflash.poderes.v1', inicial = 0 } = {}) {
  let salvo = null; try { salvo = JSON.parse(armazem?.getItem(chave) || 'null'); } catch { salvo = null; }
  let xp = Number.isFinite(salvo?.xp) ? salvo.xp : Math.max(0, inicial);
  let bonus = bonusDe(nivelDe(xp));
  const gravar = () => { try { armazem?.setItem(chave, JSON.stringify({ xp })); } catch { /* sem armazenamento */ } };
  if (!salvo) gravar();
  return {
    get xp() { return xp; },
    get nivel() { return nivelDe(xp); },
    get bonus() { return bonus; },
    /** quanto falta para o próximo nível: {de, ate, fracao} (no último nível, fracao = 1) */
    get progresso() {
      const n = nivelDe(xp); if (n >= NIVEIS.length) return { de: NIVEIS[n - 1].xp, ate: NIVEIS[n - 1].xp, fracao: 1 };
      const de = NIVEIS[n - 1].xp, ate = NIVEIS[n].xp; return { de, ate, fracao: (xp - de) / (ate - de) };
    },
    /** uma vitória: devolve os níveis novos ([{nivel, nome, texto}], vazio se não subiu) */
    ganhar(tipo, vezes = 1) {
      const antes = nivelDe(xp); xp += (XP[tipo] || 0) * vezes; gravar();
      const depois = nivelDe(xp); bonus = bonusDe(depois);
      const novos = []; for (let n = antes + 1; n <= depois; n++) novos.push({ nivel: n, ...NIVEIS[n - 1] });
      return novos;
    },
    zerar() { xp = 0; bonus = bonusDe(1); gravar(); },
  };
}
