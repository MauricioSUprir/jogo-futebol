// As opções de diagnóstico dos gráficos (item 45, `golaco/PLANO-GRAFICOS.md` passo 1), lidas do endereço UMA vez, na carga
// do módulo: assim o criarCena/criarCampo não mudam de assinatura. Em Node (sem `location`) vale o padrão.
//   ?aa=0|1      força o antisserrilhado (MSAA do próprio canvas) em qualquer qualidade, por cima da tabela do cena.js, do
//                ?gfx=antigo e do teto dos tablets; outro valor = a tabela.
//   ?gfx=antigo  a volta ao de antes (escolha D7 do dono): o que é imagem do item 45 desligado — aqui, o antisserrilhado do
//                config.js (QUALIDADE.antialias: a Média sem MSAA).
//   ?tom=neutro  o NeutralToneMapping com a exposição × 1,40 (só para comparar com o ACES; escolhido na carga).
//   ?sombra=0    sem a sombra do estádio no chão (item 46: render/sombra-estadio-gpu.js); ?sombra=sync calcula a máscara de uma
//                vez na carga (o padrão com webdriver: o quadro de um teste não depende de quando o tempo ocioso chegou) e
//                ?sombra=fatias em fatias no tempo ocioso (o padrão sem webdriver). O ?gfx=antigo também a desliga.

/** As opções de uma busca (`location.search`): {aa: null | true | false, gfxAntigo, tom: 'aces' | 'neutro', sombra: true | false |
 *  'sync' | 'fatias'}. Pura. */
export function lerOpcoesGraficos(busca = '') {
  const p = new URLSearchParams(busca);
  const aa = p.get('aa');
  return {
    aa: aa === '1' ? true : aa === '0' ? false : null,
    gfxAntigo: p.get('gfx') === 'antigo',
    tom: p.get('tom') === 'neutro' ? 'neutro' : 'aces',
    sombra: p.get('gfx') === 'antigo' || p.get('sombra') === '0' ? false : p.get('sombra') === 'sync' ? 'sync' : p.get('sombra') === 'fatias' ? 'fatias' : true,
  };
}

export const GRAFICOS = Object.freeze(lerOpcoesGraficos(typeof location !== 'undefined' && location ? location.search : ''));
