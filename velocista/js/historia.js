// A história do jogo (enredo e personagens próprios). Dois jeitos de contar:
//  - RÁDIO: uma caixa com o rosto e o nome de quem fala, sem parar o jogo (a equipe do S.T.A.R. Labs e as provocações
//    dos vilões);
//  - CENA: faixas de cinema, o jogo parado e a câmera girando em volta de quem fala (prólogo, encontro e derrota de
//    cada vilão, batalha final, epílogo). Toque/Enter/BATER avança; "Pular" encerra.
// Enredo: há seis semanas o Núcleo Aurora do S.T.A.R. Labs sobrecarregou e um raio atravessou você. O Zoom rouba a
// energia da cidade; derrotado, conta que alguém sabia do Núcleo antes da explosão. Era o Flash Reverso: ele sabotou o
// Núcleo para criar um velocista e roubar a velocidade dele — e foi ele quem deu poder ao Zoom. No fim, os dois atacam
// o laboratório para levar o Núcleo.

export const PERSONAGENS = {
  helena: { nome: 'Dra. Helena Vasques', sigla: 'HV', cor: '#3fd0ff' },
  bruno: { nome: 'Bruno "Faísca" Lima', sigla: 'BL', cor: '#7be08a' },
  heroi: { nome: 'Você', sigla: 'EU', cor: '#ffd23f' },
  zoom: { nome: 'Zoom', sigla: 'Z', cor: '#3fa0ff' },
  reverso: { nome: 'Flash Reverso', sigla: 'FR', cor: '#ff3b30' },
};

const F = (quem, texto) => ({ quem, texto });

/** falas por missão: ao começar (abre) e ao concluir (fecha) */
export const MISSOES_FALAS = {
  lab: { fecha: [F('helena', 'Bem-vindo de volta ao Cortex. Os sensores estão prontos para medir você.')] },
  velocidade: { abre: [F('bruno', 'Vamos ver o velocímetro chorar. Segure CORRER e passe dos 200 km/h.')], fecha: [F('bruno', 'Duzentos! O radar da avenida acabou de pedir demissão.')] },
  esferas: { abre: [F('helena', 'O raio do Núcleo deixou fragmentos de energia pela cidade. Recolha cinco: eles recarregam você.')], fecha: [F('helena', 'Seus níveis subiram. Seu corpo absorve essa energia como nada que eu já vi.')] },
  escalar: { abre: [F('bruno', 'Física é opcional pra você. Corra de frente para um prédio alto e suba até o topo.')], fecha: [F('bruno', 'Vista bonita, hein? Agora desce antes que alguém tire foto.')] },
  vibrar: { abre: [F('helena', 'Se você vibrar rápido o bastante, suas moléculas atravessam a matéria. Teoricamente.')], fecha: [F('helena', 'Teoria confirmada. Eu precisei sentar depois dessa.')] },
  assalto: { abre: [F('bruno', 'Rádio da polícia: assalto em andamento. Hora de ser herói.')], fecha: [F('bruno', 'O ladrão nem viu de onde veio. Literalmente.')] },
  gangue: { abre: [F('helena', 'Uma gangue tomou uma rua do centro. Use os punhos, mas com cuidado.')], fecha: [F('bruno', 'Ok, isso foi muito legal. Vou chamar de Punhos Relâmpago.'), F('helena', 'Espera... os sensores captaram outro pico de energia. Azul. Não é você.')] },
  especiais: { abre: [F('bruno', 'Com a energia cheia, seus raios ficam absurdos. Testa os golpes especiais numa gangue.')], fecha: [F('bruno', 'Raio, ciclone e sônico. Você virou uma tempestade ambulante.')] },
  portais: { abre: [F('bruno', 'Montei um circuito de portais pela cidade. Setenta segundos. Valendo!')], fecha: [F('bruno', 'Recorde novo! Vou ter que montar um circuito mais difícil.')] },
  fuga: { abre: [F('helena', 'Carro em fuga na avenida principal. Ele acha que é rápido.')], fecha: [F('helena', 'Motorista detido. Ninguém se feriu.')] },
  incendio: { abre: [F('helena', 'Incêndio num prédio. Corra em círculo bem rápido em volta dele: o vácuo apaga o fogo.')], fecha: [F('bruno', 'Você apagou um incêndio CORRENDO. Eu amo esse trabalho.')] },
  queda: { abre: [F('helena', 'Alguém está caindo de um prédio! Vai, vai, vai!')], fecha: [F('helena', 'Você chegou a tempo. Ela está bem.')] },
  patrulha: { abre: [F('helena', 'A cidade precisa de você. Impeça cinco crimes.')], fecha: [F('bruno', 'A polícia está perguntando quem é o borrão vermelho.')] },
  relatorio: { abre: [F('helena', 'Volte ao Cortex. Precisamos conversar sobre o que vem por aí.')], fecha: [F('helena', 'Você fez em semanas o que eu não imaginava em anos. Obrigada.')] },
};

/** cenas (jogo parado) */
export const CENAS = {
  prologo: [
    F('helena', 'Seis semanas atrás, o Núcleo Aurora sobrecarregou. Um raio atravessou você e o laboratório inteiro apagou.'),
    F('helena', 'Quando você acordou, nenhum aparelho conseguia medir sua velocidade. Você é o homem mais rápido do mundo.'),
    F('bruno', 'E a cidade nem sabe que você existe. Ainda.'),
    F('helena', 'Venha até o Cortex. Precisamos descobrir do que você é capaz.'),
  ],
  'encontro-zoom': [
    F('zoom', 'Então você é o garoto do raio. Eu esperava mais.'),
    F('zoom', 'Os geradores desta cidade são meus. E a sua velocidade também vai ser.'),
    F('heroi', 'Você vai devolver cada watt.'),
    F('zoom', 'Me pega, se conseguir.'),
  ],
  'derrotado-zoom': [
    F('zoom', 'Você acha... que eu trabalho sozinho?'),
    F('zoom', 'Foi ele que me deu essa velocidade. Ele sabia do Núcleo Aurora antes da explosão.'),
    F('zoom', 'Ele está vindo. Ele sempre esteve aqui.'),
    F('helena', 'Antes da explosão? Isso... não pode ser.'),
  ],
  'encontro-reverso': [
    F('reverso', 'Seis semanas. Foi o tempo que o meu experimento levou para aprender a correr.'),
    F('reverso', 'O Núcleo Aurora não explodiu sozinho. Eu precisava de um velocista. E agora preciso da sua velocidade.'),
    F('heroi', 'Foi você. O Zoom, o acidente... tudo.'),
    F('reverso', 'Corra, Flash. É o que você faz de melhor.'),
  ],
  'derrotado-reverso': [
    F('reverso', 'Isso... não acaba aqui.'),
    F('reverso', 'O Núcleo Aurora ainda vai ser meu.'),
    F('helena', 'Ele vai voltar para o laboratório. Para o Núcleo. Precisamos estar prontos.'),
  ],
  'encontro-final': [
    F('reverso', 'Juntos, Zoom. Como combinamos.'),
    F('zoom', 'Desta vez não tem para onde fugir, garoto.'),
    F('reverso', 'Quando o Núcleo for meu, ninguém nesta cidade vai ser mais rápido do que eu.'),
    F('heroi', 'Então vão ter que passar por mim.'),
  ],
  'derrotado-final': [
    F('helena', 'O Núcleo está seguro. E a cidade também.'),
    F('bruno', 'Vou precisar de um nome melhor do que "garoto do raio".'),
    F('helena', 'A cidade já escolheu. Lá fora, estão chamando você de Flash.'),
  ],
};

/** falas de rádio dos capítulos (sem parar o jogo) */
export const RADIO = {
  'capitulo-zoom': [F('helena', 'Pico de energia azul no centro! Algo está drenando os geradores da cidade.'), F('bruno', 'O guia está marcando. Vai lá ver o que é.')],
  'capitulo-reverso': [F('bruno', 'Achei uma coisa nos registros. Alguém mexeu no Núcleo Aurora na noite do acidente.'), F('bruno', 'A assinatura de energia é vermelha. E está se movendo pela cidade agora.')],
  'capitulo-final': [F('helena', 'Alarme no S.T.A.R. Labs! Os dois estão na porta do laboratório!'), F('bruno', 'Eles querem o Núcleo. Volta pra cá, rápido!')],
  'luta-zoom': [F('helena', 'Ele é mais rápido em linha reta, mas cansa depois da investida. É aí que você bate.')],
  'luta-reverso': [F('reverso', 'Eu conheço cada movimento seu. Eu os criei.'), F('helena', 'Desvie da investida e dos raios. Espere a janela!')],
  'luta-final': [F('bruno', 'Dois contra um. Não para de se mexer e vibra quando eles vierem!')],
  'perseguicao-zoom': [F('bruno', 'Ele passou dos 200 km/h! E... você não está gastando energia? O raio azul está te carregando!'), F('helena', 'Fique colado nele. Quando chegar perto, aperte BATER.')],
  'perseguicao-reverso': [F('helena', 'Ele é mais rápido que você descansado. Espere ele cansar e encoste.')],
  'fase2-reverso': [F('helena', 'Os níveis dele dispararam! Não pare de se mexer!')],
  'derrota-zoom': [F('zoom', 'Lento demais.')],
  'derrota-reverso': [F('reverso', 'Previsível.')],
  'derrota-final': [F('reverso', 'Você nunca vai ser rápido o bastante.')],
  'escapou-zoom': [F('helena', 'Perdemos o sinal dele. Ele vai aparecer de novo.')],
  'escapou-reverso': [F('helena', 'Ele sumiu do radar. Vai voltar, tenho certeza.')],
};
const PROVOCA = { zoom: ['Sorte.', 'Ainda não.', 'Você está ficando lento.'], reverso: ['Isso não é nada.', 'Perto. Mas não o bastante.', 'Eu deixei.', 'Você está me divertindo.'] };

export function criarHistoria({ armazem = null, raiz = document.body } = {}) {
  const CHAVE = 'theflash.historia.v1';
  let salvo = null; try { salvo = JSON.parse(armazem?.getItem(CHAVE) || 'null'); } catch { salvo = null; }
  const vistas = new Set(salvo?.vistas || []);
  const gravar = () => { try { armazem?.setItem(CHAVE, JSON.stringify({ vistas: [...vistas] })); } catch { /* sem armazenamento */ } };
  const marcar = (id) => { vistas.add(id); gravar(); };

  // ---------- rádio ----------
  const radio = document.createElement('div'); radio.id = 'radio'; radio.innerHTML = '<i class="retrato"></i><div><b></b><span></span></div>';
  document.getElementById('hud').appendChild(radio);
  const rRetrato = radio.querySelector('.retrato'), rNome = radio.querySelector('b'), rTexto = radio.querySelector('span');
  const fila = []; let falando = null, tFala = 0;
  function falar(falas) { for (const f of falas) fila.push(f); }
  function mostrar(el, ret, nome, f) {
    const p = PERSONAGENS[f.quem] || PERSONAGENS.helena;
    ret.textContent = p.sigla; ret.style.background = p.cor; nome.textContent = p.nome; nome.style.color = p.cor;
    el.classList.toggle('vilao', f.quem === 'zoom' || f.quem === 'reverso');
  }

  // ---------- cena ----------
  const cena = document.createElement('div'); cena.id = 'cenaHist'; cena.hidden = true;
  cena.innerHTML = '<div class="faixa cima"></div><div class="faixa baixo"><i class="retrato"></i><div class="fala"><b></b><p></p><small>Toque para continuar</small></div></div><button type="button" class="pular">Pular</button>';
  raiz.appendChild(cena);
  const cRetrato = cena.querySelector('.retrato'), cNome = cena.querySelector('b'), cTexto = cena.querySelector('p');
  let C = null;                                              // {falas, i, t, letras, aoFim, foco}
  function iniciarCena(id, foco, aoFim) {
    const falas = CENAS[id]; if (!falas) { aoFim?.(); return false; }
    C = { id, falas, i: 0, t: 0, letras: 0, aoFim, foco, ang: Math.random() * 6.28 };
    marcar(`cena:${id}`); cena.hidden = false; document.body.classList.add('em-cena'); radio.classList.remove('vis'); falando = null;
    mostrarFala(); return true;
  }
  function mostrarFala() { const f = C.falas[C.i]; mostrar(cena, cRetrato, cNome, f); cTexto.textContent = ''; C.letras = 0; C.t = 0; }
  function avancar() {
    if (!C) return;
    const f = C.falas[C.i];
    if (C.letras < f.texto.length) { C.letras = f.texto.length; cTexto.textContent = f.texto; return; }   // 1º toque completa o texto
    C.i++;
    if (C.i >= C.falas.length) return terminar();
    mostrarFala();
  }
  function terminar() { if (!C) return; const fim = C.aoFim; C = null; cena.hidden = true; document.body.classList.remove('em-cena'); fim?.(); }
  cena.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target.closest('.pular')) terminar(); else avancar(); });

  /** atualiza a cada quadro (dt real) */
  function atualizar(dt) {
    if (C) {
      const f = C.falas[C.i]; C.t += dt;
      if (C.letras < f.texto.length) { C.letras = Math.min(f.texto.length, C.letras + dt * 45); cTexto.textContent = f.texto.slice(0, Math.floor(C.letras)); }
      else if (C.t > 2.2 + f.texto.length * 0.055) avancar();                       // avança sozinho depois de dar tempo de ler
      return;
    }
    if (falando) { tFala -= dt; if (tFala <= 0) { falando = null; radio.classList.remove('vis'); } }
    else if (fila.length) {
      falando = fila.shift(); tFala = 2.4 + falando.texto.length * 0.05;
      mostrar(radio, rRetrato, rNome, falando); rTexto.textContent = falando.texto; radio.classList.add('vis');
    }
  }
  /** câmera da cena: gira devagar em volta do foco, à altura do rosto */
  function camera(cam, dt) {
    if (!C?.foco) return false;
    const f = C.foco(); if (!f) return false;
    C.ang += dt * 0.18;
    const d = C.id.startsWith('encontro-final') || C.id.startsWith('derrotado-final') ? 7 : 4.2;
    cam.position.set(f.x + Math.sin(C.ang) * d, f.y + 1.75, f.z + Math.cos(C.ang) * d);
    cam.lookAt(f.x, f.y + 1.45, f.z);
    return true;
  }

  return {
    atualizar, camera, avancar, pular: terminar,
    get emCena() { return !!C; }, get cenaAtual() { return C?.id || null; },
    viu: (id) => vistas.has(id),
    /** a cena (uma vez só, a não ser que `sempre`) */
    cena(id, foco, aoFim, { sempre = false } = {}) {
      // nos testes automáticos as cenas só rodam com ?historia=1 (os outros testes esperam o jogo correndo)
      if ((!sempre && vistas.has(`cena:${id}`)) || (navigator.webdriver && !/[?&]historia=1/.test(location.search))) { aoFim?.(); return false; }
      return iniciarCena(id, foco, aoFim);
    },
    /** falas de rádio de um momento (uma vez só, a não ser que `sempre`) */
    radio(id, { sempre = false } = {}) { const falas = RADIO[id]; if (!falas || (!sempre && vistas.has(`radio:${id}`))) return; marcar(`radio:${id}`); falar(falas); },
    missao(id, momento) { const falas = MISSOES_FALAS[id]?.[momento]; const k = `missao:${id}:${momento}`; if (!falas || vistas.has(k)) return; marcar(k); falar(falas); },
    provocar(vilao, n) { const v = PROVOCA[vilao]; if (v) falar([F(vilao, v[(n - 1) % v.length])]); },
    zerar() { vistas.clear(); gravar(); },
  };
}
