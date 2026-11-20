// As opções de diagnóstico dos gráficos (item 45, `golaco/PLANO-GRAFICOS.md` passo 1), lidas do endereço UMA vez, na carga
// do módulo: assim o criarCena/criarCampo não mudam de assinatura. Em Node (sem `location`) vale o padrão.
//   ?aa=0|1      força o antisserrilhado (MSAA do próprio canvas) em qualquer qualidade, por cima da tabela do cena.js, do
//                ?gfx=antigo e do teto dos tablets; outro valor = a tabela.
//   ?gfx=antigo  a volta ao de antes (escolha D7 do dono): o que é imagem do item 45 desligado — aqui, o antisserrilhado do
//                config.js (QUALIDADE.antialias: a Média sem MSAA).
//   ?tom=neutro  o NeutralToneMapping com a exposição × 1,40 (só para comparar com o ACES; escolhido na carga).

/** As opções de uma busca (`location.search`): {aa: null | true | false, gfxAntigo, tom: 'aces' | 'neutro'}. Pura. */
export function lerOpcoesGraficos(busca = '') {
  const p = new URLSearchParams(busca);
  const aa = p.get('aa');
  return {
    aa: aa === '1' ? true : aa === '0' ? false : null,
    gfxAntigo: p.get('gfx') === 'antigo',
    tom: p.get('tom') === 'neutro' ? 'neutro' : 'aces',
  };
}

export const GRAFICOS = Object.freeze(lerOpcoesGraficos(typeof location !== 'undefined' && location ? location.search : ''));
