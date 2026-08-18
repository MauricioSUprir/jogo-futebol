/* ===== views/criador.js — Área do criador (rota escondida: #/criador) =====
   NÃO aparece no menu e o aluno nunca chega aqui: só abre tocando 5 vezes na
   linha da versão, no rodapé das Configurações. É onde o dono do app liga o
   servidor — o único lugar do StudyLab onde se fala em chave.                */
import { h } from '../util.js';
import { st, set, ehPro } from '../store.js';
import { titulo, cartao, toast, campo, inp, sel, confirmar } from '../ui.js';
import { SERVIDOR } from '../produto.js';
import { saudeDoServidor } from '../api.js';
import { MODELOS, chamar } from '../ai.js';
import { comoLigarGoogle } from './entrar.js';

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  el.append(h('a', { class: 'chip mb', href: '#/config', style: { display: 'inline-flex' } }, '‹ voltar para Configurações'));
  el.append(titulo('🛠️ Área do criador', 'Esta tela não aparece no menu e o aluno não chega nela.'));

  /* ---------- como o Study AI funciona ---------- */
  el.append(cartao(
    h('b', {}, '🔐 Onde mora a chave da Claude'),
    h('p', { class: 'small' },
      'O aluno ', h('b', {}, 'nunca'), ' coloca chave nenhuma. Ele paga, o servidor confirma o pagamento e libera o Pro; '
      + 'quando ele pergunta algo, o app fala com o ', h('b', {}, 'seu servidor'), ', e é o servidor que chama a Claude com a '
      + 'sua chave. A chave fica na variável ', h('code', {}, 'ANTHROPIC_API_KEY'), ' do Railway e nunca chega ao navegador.'),
    h('div', { class: 'card card--flat' },
      h('div', { class: 'small' }, '📱 aluno paga o Pix'),
      h('div', { class: 'tiny muted' }, '↓'),
      h('div', { class: 'small' }, '🏦 Mercado Pago confirma → 💰 cai na sua conta'),
      h('div', { class: 'tiny muted' }, '↓'),
      h('div', { class: 'small' }, '🖥️ seu servidor libera o Pro'),
      h('div', { class: 'tiny muted' }, '↓'),
      h('div', { class: 'small' }, '🤖 Study AI pronto para usar — sem chave, sem configurar nada'))));

  /* ---------- servidor ---------- */
  const endServidor = inp({ value: s.ia.servidor || '', placeholder: 'https://...up.railway.app' });
  const status = h('div', { class: 'tiny muted mt' });
  const segredoEl = h('code', { class: 'tiny muted', style: { wordBreak: 'break-all' } }, 'clique para gerar');

  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '🖥️ Servidor do StudyLab'),
    h('p', { class: 'tiny muted' },
      'Publique a pasta studylab-server (Railway) e cole aqui o endereço. É isso que liga o Study AI e o pagamento para todo mundo.'),
    campo('Endereço', endServidor),
    h('div', { class: 'flexb' },
      h('button', {
        class: 'btn btn--p', onclick: () => {
          set((x) => { x.ia.servidor = endServidor.value.trim().replace(/\/$/, ''); });
          toast('Endereço salvo', 'good'); pintar();
        },
      }, 'Salvar'),
      h('button', {
        class: 'btn', onclick: async (e) => {
          set((x) => { x.ia.servidor = endServidor.value.trim().replace(/\/$/, ''); });
          if (!endServidor.value.trim()) return toast('Cole o endereço primeiro', 'bad');
          e.target.disabled = true; e.target.textContent = 'Testando…';
          try {
            const d = await saudeDoServidor();
            status.replaceChildren(
              h('div', {}, `✅ no ar · banco ${d.banco} · modelo ${d.modelo}`),
              h('div', { style: { marginTop: '4px' } },
                `${d.studyAiPronto ? '✅' : '❌'} Study AI · `,
                `${d.pagamentoPronto ? '✅' : '❌'} pagamento · `,
                `${d.googleConfigurado ? '✅' : '○'} Google (opcional)`),
              ...(d.falta?.length
                ? [h('div', { style: { marginTop: '6px' } }, 'Falta configurar no Railway:'),
                  h('ul', { style: { margin: '4px 0 0', paddingLeft: '18px' } }, ...d.falta.map((f) => h('li', {}, f)))]
                : [h('div', { style: { marginTop: '6px', color: 'var(--ok)' } }, 'Tudo configurado. 🎉')]));
            toast(d.falta?.length ? 'No ar, mas falta configuração' : 'Tudo pronto! 🎉', d.falta?.length ? '' : 'good');
          } catch (err) { status.textContent = `❌ ${err.message}`; toast(err.message, 'bad'); }
          e.target.disabled = false; e.target.textContent = '🔌 Testar servidor';
        },
      }, '🔌 Testar servidor')),
    status,
    h('div', { class: 'hr' }),
    h('b', { class: 'small' }, 'Variáveis do Railway'),
    h('ul', { class: 'tiny muted', style: { paddingLeft: '18px', lineHeight: 1.7 } },
      h('li', {}, h('code', {}, 'ANTHROPIC_API_KEY'), ' — sua chave da Claude (obrigatória)'),
      h('li', {}, h('code', {}, 'SEGREDO'), ' — gere abaixo (obrigatória)'),
      h('li', {}, h('code', {}, 'MP_ACCESS_TOKEN'), ' — Access token do Mercado Pago, para receber'),
      h('li', {}, h('code', {}, 'MP_WEBHOOK_SECRET'), ' — assinatura secreta do webhook'),
      h('li', {}, h('code', {}, 'ORIGENS'), ' — https://mauriciosuprir.github.io')),
    h('div', { class: 'flexb mt' },
      h('button', {
        class: 'btn btn--sm', onclick: () => {
          const bytes = new Uint8Array(32);
          crypto.getRandomValues(bytes);
          const segredo = [...bytes].map((b) => b.toString(36)).join('').slice(0, 48);
          navigator.clipboard?.writeText(segredo);
          segredoEl.textContent = segredo;
          toast('SEGREDO copiado', 'good');
        },
      }, '🎲 Gerar SEGREDO'),
      segredoEl))));

  /* ---------- teste local, antes do servidor existir ---------- */
  const chaveTeste = inp({ type: 'password', value: s.ia.chaveCriador || '', placeholder: 'sk-ant-…' });
  const modelo = sel(MODELOS.map((m) => ({ v: m.id, t: m.nome })), s.ia.modelo);
  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '🧪 Testar a IA antes de publicar o servidor'),
    h('p', { class: 'small' },
      'Só para você ver o Study AI funcionando hoje, ', h('b', {}, 'neste aparelho'), '. A chave fica guardada só aqui e '
      + 'nenhum aluno vê este campo. Assim que o servidor estiver no ar, ele passa a mandar e esta chave é ignorada.'),
    h('div', { class: 'f-row' }, campo('Chave da Claude API', chaveTeste), campo('Modelo', modelo)),
    h('div', { class: 'flexb' },
      h('button', {
        class: 'btn', onclick: () => {
          set((x) => { x.ia.chaveCriador = chaveTeste.value.trim(); x.ia.modelo = modelo.value; });
          toast('Salvo', 'good'); pintar();
        },
      }, 'Salvar'),
      h('button', {
        class: 'btn', onclick: async (e) => {
          set((x) => { x.ia.chaveCriador = chaveTeste.value.trim(); x.ia.modelo = modelo.value; });
          if (!ehPro()) return toast('Ative o Pro primeiro (código TESTE7 em Planos)', 'bad');
          e.target.disabled = true; e.target.textContent = 'Testando…';
          try { await chamar({ system: 'Responda apenas: ok', conteudo: 'teste', maxTokens: 20, esforco: 'low' }); toast('Study AI funcionando! 🎉', 'good'); }
          catch (err) { toast(err.message, 'bad'); }
          e.target.disabled = false; e.target.textContent = '🔌 Testar';
        },
      }, '🔌 Testar'),
      s.ia.chaveCriador ? h('button', {
        class: 'btn btn--d sp', onclick: () => confirmar('Apagar a chave de teste?', 'A IA volta a depender só do servidor.', () => {
          set((x) => { x.ia.chaveCriador = ''; }); toast('Chave apagada'); pintar();
        }),
      }, 'Apagar') : null))));

  /* ---------- outros ---------- */
  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '🔑 Login com o Google (opcional)'),
    h('p', { class: 'tiny muted' }, 'Sem ele o aluno usa conta de aparelho e assina do mesmo jeito. Com ele, recupera a conta em outro celular.'),
    h('button', { class: 'btn btn--sm', onclick: comoLigarGoogle }, 'Ver o passo a passo'))));

  el.append(h('p', { class: 'tiny muted center mt2' },
    `Servidor: ${s.ia.servidor || SERVIDOR || 'nenhum'} · chamadas de IA hoje: ${s.ia.usoHoje || 0}`));
}
