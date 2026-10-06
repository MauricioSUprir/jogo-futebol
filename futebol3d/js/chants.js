// Motor de cantos da torcida (especificação §30–§31). Lógica pura (sem DOM/áudio):
// a cada quadro recebe o contexto da partida e devolve QUAL canto tocar e QUANTO cada
// setor da arquibancada está cantando. O áudio (audio.js) posiciona cada setor no espaço.
//
// Nunca é "play(musica.mp3)": o canto nasce num setor, os outros entram aos poucos,
// cai quando o ataque fica perigoso, vira "UUUH!", palmas, e depois nasce de novo.
//   murmúrio → início (um setor) → espalhando → cheio → (fim | interrompido → uuh → palmas) → murmúrio
//
// Setores: 0 = atrás do gol da casa (organizada), 1 = lateral oposta à câmera (principal),
//          2 = atrás do outro gol (visitantes), 3 = lateral da câmera.
export const SECTORS = [
  { nome: 'organizada', x: -1, z: 0 },
  { nome: 'lateral oposta', x: 0, z: 1 },
  { nome: 'visitantes', x: 1, z: 0 },
  { nome: 'lateral da câmera', x: 0, z: -1 },
];

// Biblioteca de cada clube: qual canto é o principal, o de vitória e o de pressão, e o
// tom (mesma melodia sintetizada, afinação própria) — cada torcida soa diferente.
export function clubLibrary(teamId = '') {
  let h = 7;
  for (let i = 0; i < teamId.length; i++) h = (h * 31 + teamId.charCodeAt(i)) >>> 0;
  const songs = ['chant', 'festa', 'ole'];
  const main = songs[h % 2 === 0 ? 0 : 2];
  return {
    principal: main,
    vitoria: 'festa',
    pressao: main === 'chant' ? 'ole' : 'chant',
    rate: 0.94 + ((h >>> 3) % 13) / 100,          // 0,94 … 1,06
  };
}

const rnd = (a, b) => a + Math.random() * (b - a);

export class ChantEngine {
  constructor(homeId, awayId) {
    this.home = clubLibrary(homeId); this.away = clubLibrary(awayId);
    this.state = 'murmurio'; this.t = 0; this.next = rnd(4, 8);
    this.song = null; this.rate = 1;
    this.sec = [0, 0, 0, 0];              // quanto cada setor canta (alvo 0..1)
    this.order = [];                      // ordem de entrada dos setores
    this.event = null;                    // 'ooh' | 'applause' (consumido pelo chamador)
    this.peak = 0;                        // maior ameaça vista durante a interrupção
  }

  // ctx: { phase, threat (0..1), homeScore, awayScore, minute, homeIntensity, goal: 'home'|'away'|null }
  update(dt, c) {
    this.t += dt; this.event = null;
    const s = this.state, diff = c.homeScore - c.awayScore;
    // gol: festa imediata no estádio inteiro (ou só no setor visitante)
    if (c.goal) {
      this.state = 'festa'; this.t = 0; this.next = 18;
      if (c.goal === 'home') { this.song = this.home.vitoria; this.rate = this.home.rate; this.sec = [1, 1, 0.15, 1]; }
      else { this.song = this.away.vitoria; this.rate = this.away.rate; this.sec = [0.1, 0.15, 1, 0.1]; }
      return this.out();
    }
    if (c.phase !== 'play' && c.phase !== 'setpiece' && s !== 'festa') { this.sec = this.sec.map(v => v * 0.5); }
    switch (s) {
      case 'murmurio':
        this.sec = [0, 0, 0, 0];
        if (this.t >= this.next && c.threat < 0.5) this.start(c, diff);
        break;
      case 'inicio':
      case 'espalhando': {
        // entra o próximo setor a cada 2,5–4 s
        if (this.t >= this.next) {
          const k = this.order.find(i => this.sec[i] < 0.5);
          if (k === undefined) { this.state = 'cheio'; this.t = 0; this.next = rnd(18, 32) * (diff < 0 && c.minute > 70 ? 1.4 : 1); }
          else { this.sec[k] = 0.65 + Math.random() * 0.35; this.state = 'espalhando'; this.t = 0; this.next = rnd(2.5, 4); }
        }
        if (c.threat > 0.62) this.interrupt();
        break;
      }
      case 'cheio':
        if (c.threat > 0.62) this.interrupt();
        else if (this.t >= this.next) { this.state = 'murmurio'; this.t = 0; this.next = rnd(5, 11); this.song = null; }
        break;
      case 'interrompido':
        // a arquibancada prende a respiração; quando o lance acaba, "UUUH!" (se foi perto) e palmas
        this.sec = this.sec.map(v => Math.min(v, 0.12));
        this.peak = Math.max(this.peak, c.threat);
        if (c.threat < 0.3 || this.t > 6) {
          this.hadOoh = this.peak > 0.75;
          if (this.hadOoh) this.event = 'ooh';
          this.state = 'palmas'; this.t = 0; this.next = rnd(3, 4.5); this.clap = true;
        }
        break;
      case 'palmas':
        if (this.clap && this.t >= (this.hadOoh ? 1.2 : 0.05)) { this.event = 'applause'; this.clap = false; }
        this.sec = [0, 0, 0, 0];
        if (this.t >= this.next) { this.state = 'murmurio'; this.t = 0; this.next = rnd(1.5, 4); this.song = null; }
        break;
      case 'festa':
        if (this.t >= this.next) { this.state = 'murmurio'; this.t = 0; this.next = rnd(4, 8); this.song = null; this.sec = [0, 0, 0, 0]; }
        break;
    }
    return this.out();
  }

  start(c, diff) {
    // a torcida da casa escolhe o canto pelo momento do jogo
    const L = this.home;
    const late = c.minute > 70;
    this.song = diff > 0 ? L.vitoria : diff < 0 && late || (c.homeIntensity ?? 0.5) > 0.75 ? L.pressao : L.principal;
    this.rate = L.rate;
    // visitantes ganhando: às vezes quem começa é o setor deles
    const awayStarts = diff < 0 && Math.random() < 0.45;
    if (awayStarts) { this.song = this.away.vitoria; this.rate = this.away.rate; this.order = [2]; }
    else this.order = [0, ...[1, 3].sort(() => Math.random() - 0.5)];
    this.sec = [0, 0, 0, 0];
    this.sec[this.order[0]] = 1;
    this.state = 'inicio'; this.t = 0; this.next = rnd(2.5, 4);
  }

  interrupt() { this.state = 'interrompido'; this.t = 0; this.peak = 0; }

  out() { return { state: this.state, song: this.song, rate: this.rate, sectors: this.sec, event: this.event }; }
}
