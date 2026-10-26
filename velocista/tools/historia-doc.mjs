// Escreve a história do jogo como ROTEIRO (Markdown), do jeito que ela roda: cada passo da história em ordem, com o rádio,
// as cenas e as lutas. É o documento "THE FLASH — História" do Drive do dono: ele edita lá e me manda; este arquivo
// regera o roteiro a partir do código depois de cada mudança. Uso: node velocista/tools/historia-doc.mjs > roteiro.md
import { MISSOES } from '../js/missoes.js';
import { PERSONAGENS, MISSOES_FALAS, CENAS, RADIO } from '../js/historia.js';

const nome = (q) => (q === 'heroi' ? 'VOCÊ (Flash)' : (PERSONAGENS[q]?.nome || q).toUpperCase());
const LUGAR = { delegacia: 'Delegacia Central', jornal: 'Picture News (jornal)', cafe: 'Café Jitters', prefeitura: 'Praça da Prefeitura',
  casa: 'Casa da família West', presidio: 'Presídio Iron Heights (na ilha, pela Ponte da Baía)' };
// onde cada ato começa (as mesmas telas de capítulo do jogo: o Ato 2 abre depois do Zoom, o 3 depois da dupla final, o 4 depois do Savitar)
const ATOS = { lab: 'ATO 1 — Aprendendo a correr', energia: 'ATO 2 — O guardião da cidade', prefeitura: 'ATO 3 — Fendas no tempo', 'cap-devoe': 'ATO 4 — O Pensador' };
const linhas = [];
const falas = (lista, rotulo) => {
  if (!lista?.length) return;
  linhas.push(`**${rotulo}**`, '');
  for (const f of lista) linhas.push(f.cartao ? `*[tela de capítulo: ${f.rotulo} — ${f.titulo}]*` : `${nome(f.quem)}: ${f.texto}`, '');
};

linhas.push('# THE FLASH — História', '',
  '## Como me mandar a história', '',
  '1. Escreva ou mude a história AQUI, neste documento (pelo celular, no app Google Docs, ou pelo computador).',
  '2. Quando quiser, me diga no chat: **"atualiza a história"**. Eu leio este documento, coloco no jogo e te mando o link.',
  '3. Pode escrever do seu jeito, não precisa seguir o modelo à risca: eu adapto. Também vale colar o texto direto no chat ou mandar foto de um caderno.', '',
  'Modelo de um passo da história (copie e mude):', '',
  '> **MISSÃO: Nome da missão**', '>', '> **O que o jogador faz:** ir até o Café Jitters / derrotar o Zoom / salvar alguém...', '>',
  '> **Onde:** o lugar da cidade', '>', '> **Rádio (sem parar o jogo):** CISCO: fala...', '>', '> **Cena (o jogo para):** IRIS: fala... / VOCÊ: fala...', '',
  '## O que já existe no jogo (dá para usar sem esperar nada novo)', '',
  '**Personagens:** ' + Object.entries(PERSONAGENS).filter(([k]) => k !== 'heroi').map(([, p]) => `${p.nome}${p.vilao ? ' (vilão)' : p.papel ? ` (${p.papel})` : ''}`).join(', ') + '.', '',
  '**Lugares:** S.T.A.R. Labs (com o Cortex por dentro), ' + Object.values(LUGAR).join(', ') + ', as 3 subestações de energia, a avenida principal e a cidade inteira.', '',
  '**Tipos de missão:** ir até um lugar e conversar com alguém; chegar a uma velocidade; recolher esferas de energia; escalar um prédio; atravessar paredes vibrando; parar um assalto; lutar contra uma gangue; parar um carro em fuga; apagar um incêndio correndo em volta; salvar alguém caindo; golpes especiais; corrida de portais contra o relógio; religar as subestações; fechar fendas no tempo; túnel do tempo e viagem ao passado; voltar ao laboratório; luta contra um vilão (com perseguição, 2ª fase, golpes próprios).', '',
  '**Coisa nova** (personagem, vilão, lugar, poder, tipo de missão): é só descrever aqui que eu crio.', '',
  '## A história de hoje (como está no jogo)', '');

falas(CENAS.prologo, 'Cena de abertura (quando o jogo começa)');
MISSOES.forEach((m, i) => {
  if (ATOS[m.id]) linhas.push(`## ${ATOS[m.id]}`, '');
  linhas.push(`### ${i + 1}. ${m.titulo}`, '', `**O que o jogador faz:** ${m.texto}.`, '');
  if (m.ponto && LUGAR[m.ponto]) linhas.push(`**Onde:** ${LUGAR[m.ponto]}.`, '');
  falas(MISSOES_FALAS[m.id]?.abre, 'Rádio ao começar');
  const c = m.capitulo;
  if (c) {
    falas(CENAS[`cap-${c}`], 'Abertura do capítulo');
    falas(RADIO[`capitulo-${c}`], 'Rádio: o vilão apareceu');
    falas(CENAS[`encontro-${c}`], 'Cena: o encontro com o vilão');
    for (const [k, r] of [['perseguicao', 'Rádio na perseguição'], ['luta', 'Rádio na luta'], ['armadura', 'Rádio: a armadura'], ['escudo', 'Rádio: o escudo'], ['fase2', 'Rádio na 2ª fase'], ['escapou', 'Rádio se ele escapa'], ['derrota', 'Rádio se você perde']]) falas(RADIO[`${k}-${c}`], r);
    falas(CENAS[`derrotado-${c}`], 'Cena: o vilão derrotado');
  }
  falas(MISSOES_FALAS[m.id]?.fecha, 'Rádio ao terminar');
  falas(CENAS[`depois-${m.id}`], 'Cena ao terminar');
  if (m.id === 'passado') { falas(CENAS.acidente, 'Cena: a noite do acidente'); falas(CENAS['volta-tunel'], 'Cena: a volta pelo túnel'); }
});
linhas.push('## Fim', '', 'Depois do último passo a cidade fica livre: crimes, esferas e os capítulos dos vilões para jogar de novo na pausa.');
process.stdout.write(linhas.join('\n') + '\n');
