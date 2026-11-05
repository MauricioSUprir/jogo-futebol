/* ===== index.js — servidor do MindTrack =====
   Rotas:
     GET  /saude          está no ar?
     POST /entrar         { idToken } -> sessão de 30 dias + assinatura
     GET  /eu             quem sou eu, meu plano e meu uso de hoje
     POST /codigo         { codigo } -> ativa o Pro
     POST /ia             o MindTrack AI (só para assinante)
     POST /cancelar       cancela a assinatura
     GET  /admin/numeros  ?token=ADMIN_TOKEN
     POST /admin/codigo   cria um código
     Conexões (só com conta Google; ver conexoes.js):
     GET  /conexoes/config            o que está configurado no servidor
     POST /conexoes/google/iniciar    { servico, volta } -> endereço do login do Google
     GET  /conexoes/google/volta      o Google volta aqui; redireciona para o app
     POST /conta/troca                { ticket } -> sessão (depois de entrar com o Google)
     GET  /conexoes                   o que o aluno ligou
     POST /conexoes/sincronizar       { servico } -> eventos/atividades prontos
     POST /conexoes/ics               { url } -> liga um calendário por link
     POST /conexoes/google/token      { servico:'drive' } -> acesso curto para o seletor
     POST /conexoes/remover           { servico }                                */
import http from 'node:http';
import {
  migrar, salvarUsuario, entrarPorDispositivo, assinaturaAtiva, criarAssinatura, cancelarAssinatura,
  usarCodigo, criarCodigo, usoDoDia, usoDoMes, registrarUso, numeros, emMemoria,
  registrarPagamento, jaProcessado, marcarPago, pagamentosDoUsuario,
  usuarioPorId, entrarComGoogle, salvarConexao, criarContaEmail, contaPorEmail, senhaConfere, atualizarFoto, conexoesDo, conexaoDe, apagarConexao, marcarSincronizado,
} from './db.js';
import {
  SERVICOS_GOOGLE, googleLigado, configPublica, urlAutorizacao, lerEstado, trocarCodigo, quemEntrou,
  faltamEscopos, criarTicket, usarTicket, cifrar, decifrar, acessoGoogle, revogar, lerAgenda, lerClassroom,
  baixarIcs, urlDeVolta,
} from './conexoes.js';
import { verificarGoogle, criarSessao, alunoDaRequisicao } from './auth.js';
import { criarRotasSociais } from './social.js';
import { whatsappLigado, normalizarTelefone, enviarBoasVindas } from './whatsapp.js';
import { migrarSocial } from './social-db.js';
import {
  perguntar, modeloPadrao, modeloPara, contarFotos, provedor, temChaveIA, modeloEmUso, escadaGemini, estadoEscada, tamanhoCache,
} from './ia.js';
import {
  PLANOS, pagamentoLigado, criarAssinatura as criarAssinaturaMP, criarPagamentoUnico, criarPix,
  pagarComCartao, chavePublica, interpretarAviso, webhookConfere, urlDoWebhook, consultarPagamento,
  normalizarPlanoId, nivelDoPlano,
} from './pagamento.js';

const PORTA = Number(process.env.PORT) || 3000;
/* Limites por nível de plano. Foram calculados para o dono ter lucro mesmo no
   pior caso (aluno que usa TUDO), com o modelo padrão (Haiku). Dá para mexer
   por variável de ambiente sem tocar no código. */
const num = (k, padrao) => Number(process.env[k]) || padrao;
const LIMITES = {
  pro: {
    dia: num('LIMITE_DIARIO', 30), mes: num('LIMITE_MENSAL', 400),
    fotosDia: num('FOTOS_DIA', 5), fotosPergunta: 2,
  },
  plus: {
    dia: num('LIMITE_DIARIO_PLUS', 80), mes: num('LIMITE_MENSAL_PLUS', 1000),
    fotosDia: num('FOTOS_DIA_PLUS', 25), fotosPergunta: 4,
  },
};
const MODO_TESTE = process.env.MODO_TESTE === '1';
/* Sites do app que podem falar com o servidor: os de sempre + os da variável ORIGENS.
   O app mora em guidrodrigues21-a11y.github.io/mindtrack-ai/ (o antigo, no jogo-futebol, só redireciona). */
const ORIGENS = [...new Set(['https://guidrodrigues21-a11y.github.io', 'https://mauriciosuprir.github.io',
  ...(process.env.ORIGENS || '').split(',')].map((o) => o.trim()).filter(Boolean))];

/* ---------- utilidades ---------- */
function cors(req, res) {
  const origem = req.headers.origin || '';
  const ok = ORIGENS.includes('*') || ORIGENS.includes(origem);
  if (ok) res.setHeader('access-control-allow-origin', origem || '*');
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-max-age', '86400');
  return ok;
}
function json(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(corpo) });
  res.end(corpo);
}
async function lerCorpo(req, limite = 300000) {
  const partes = []; let total = 0;
  for await (const p of req) {
    total += p.length;
    if (total > limite) throw Object.assign(new Error('Pedido grande demais'), { status: 413 });
    partes.push(p);
  }
  if (!partes.length) return {};
  try { return JSON.parse(Buffer.concat(partes).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}
/* O nível da assinatura sai do nome do plano guardado:
   'plus_mensal' e 'codigo_plus' são Plus; o resto é Pro. */
const resumoAssinatura = (a) => (a
  ? { plano: nivelDoPlano(a.plano), planoId: a.plano, proAte: a.fim, origem: a.origem }
  : { plano: 'free', planoId: null, proAte: null, origem: null });
const limitesDe = (assinatura) => LIMITES[nivelDoPlano(assinatura?.plano)] || LIMITES.pro;

/* ---------- freio simples por IP (evita abuso na porta de entrada) ---------- */
const batidas = new Map();
function muitasBatidas(ip, limite = num('FREIO_IP', 60), janela = 60000) {
  const agora = Date.now();
  const lista = (batidas.get(ip) || []).filter((t) => agora - t < janela);
  lista.push(agora); batidas.set(ip, lista);
  if (batidas.size > 5000) batidas.clear();
  return lista.length > limite;
}

/* ---------- rotas ---------- */
const rotas = {
  'GET /saude': async () => {
    const falta = [];
    if (!temChaveIA()) {
      falta.push('ANTHROPIC_API_KEY ou GEMINI_API_KEY — sem uma delas o MindTrack AI não responde '
        + '(a do Gemini é grátis em aistudio.google.com)');
    }
    if (pagamentoLigado() && !chavePublica()) falta.push('MP_PUBLIC_KEY — sem ela o cartão abre fora do app');
    if (!googleLigado()) falta.push('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET — sem eles a aba Conexões (conta Google, Agenda, Classroom, Drive) não liga');
    if (!process.env.SEGREDO) falta.push('SEGREDO — as sessões dos alunos ficam inseguras');
    if (emMemoria) falta.push('DATABASE_URL — sem banco, tudo some quando o servidor reinicia');
    if (!pagamentoLigado()) falta.push('MP_ACCESS_TOKEN — sem ele ninguém consegue pagar');
    if (pagamentoLigado() && !process.env.MP_WEBHOOK_SECRET) falta.push('MP_WEBHOOK_SECRET — os avisos de pagamento não são verificados');
    return {
      ok: true,
      banco: emMemoria ? 'memoria' : 'postgres',
      provedor: provedor(),                                  // claude | gemini | null
      modelo: modeloEmUso(),
      ...(provedor() === 'gemini' ? {
        escada: { topo: escadaGemini('topo'), normal: escadaGemini('normal'), leve: escadaGemini('leve') },
        foraDaCota: estadoEscada(),                          // modelo → até quando está sem cota
      } : {}),
      respostasGuardadas: tamanhoCache(),
      chaveConfigurada: temChaveIA(),
      googleConfigurado: !!process.env.GOOGLE_CLIENT_ID,     // opcional: dá para usar conta de aparelho
      conexoesProntas: googleLigado(),                       // conta Google + Agenda/Classroom/Drive
      whatsappConfigurado: whatsappLigado(),                 // boas-vindas no WhatsApp ao criar conta
      enderecoDeVoltaGoogle: urlDeVolta(),                   // é este que vai no Google Cloud
      pagamentoConfigurado: pagamentoLigado(),
      studyAiPronto: temChaveIA() && !!process.env.SEGREDO,
      pagamentoPronto: pagamentoLigado() && !!process.env.MP_WEBHOOK_SECRET,
      falta,
    };
  },

  'GET /planos': async () => ({
    pagamentoLigado: pagamentoLigado(),
    formas: pagamentoLigado() ? ['pix', 'cartao', 'recorrente'] : [],
    planos: Object.entries(PLANOS).map(([id, p]) => ({ id, nome: p.nome, nivel: p.nivel, valor: p.valor, dias: p.dias })),
    limites: LIMITES,
  }),

  'POST /entrar': async (req) => {
    const corpo = await lerCorpo(req);
    let dados;
    if (MODO_TESTE && corpo.teste) {
      // atalho SÓ para os testes automatizados (MODO_TESTE=1). Nunca em produção.
      dados = { id: String(corpo.teste.id), email: corpo.teste.email || '', nome: corpo.teste.nome || '', foto: '' };
    } else if (corpo.dispositivo) {
      // conta de aparelho: funciona sem Google, e é o suficiente para assinar
      const { id, segredo, nome } = corpo.dispositivo;
      if (!id || !segredo) throw Object.assign(new Error('Dados do aparelho incompletos'), { status: 400 });
      const u = await entrarPorDispositivo({ id: String(id), segredo: String(segredo), nome: String(nome || 'Estudante') });
      if (!u) throw Object.assign(new Error('Este aparelho não confere. Entre com o Google para recuperar sua conta.'), { status: 401 });
      const token = await criarSessao({ id: u.id, email: u.email || '', nome: u.nome });
      const assinatura = await assinaturaAtiva(u.id);
      return { token, usuario: { id: u.id, nome: u.nome, email: u.email || '', foto: '' }, ...resumoAssinatura(assinatura) };
    } else {
      const { idToken } = corpo;
      if (!idToken) throw Object.assign(new Error('Falta o idToken do Google'), { status: 400 });
      let g;
      try { g = await verificarGoogle(idToken); }
      catch (e) { throw Object.assign(new Error(`Login do Google recusado: ${e.message}`), { status: 401 }); }
      // acha também a conta de aparelho que já foi ligada a este Google
      const u = await entrarComGoogle({ sub: g.id, email: g.email, nome: g.nome, foto: g.foto });
      return respostaDeEntrada(u);
    }
    const usuario = await salvarUsuario(dados);
    const token = await criarSessao(dados);
    const assinatura = await assinaturaAtiva(dados.id);
    return { token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, foto: usuario.foto }, ...resumoAssinatura(assinatura) };
  },

  'GET /eu': async (req) => {
    const aluno = await exigirAluno(req);
    const [assinatura, uso] = await Promise.all([assinaturaAtiva(aluno.id), usoDoDia(aluno.id)]);
    const L = limitesDe(assinatura);
    return {
      usuario: { id: aluno.id, nome: aluno.nome, email: aluno.email },
      ...resumoAssinatura(assinatura),
      uso: {
        chamadasHoje: uso.chamadas, fotosHoje: uso.fotos || 0,
        limiteDiario: L.dia, limiteMensal: L.mes,
        limiteFotosDia: L.fotosDia, limiteFotosPergunta: L.fotosPergunta,
      },
    };
  },

  'POST /codigo': async (req) => {
    const aluno = await exigirAluno(req);
    const { codigo } = await lerCorpo(req);
    const achado = await usarCodigo(codigo);
    if (!achado) throw Object.assign(new Error('Código inválido ou já esgotado'), { status: 404 });
    const a = await criarAssinatura({
      usuarioId: aluno.id, plano: achado.nivel === 'plus' ? 'codigo_plus' : 'codigo',
      dias: achado.dias, origem: 'codigo', referencia: achado.codigo,
    });
    return { ...resumoAssinatura(a), dias: achado.dias };
  },

  'POST /cancelar': async (req) => {
    const aluno = await exigirAluno(req);
    await cancelarAssinatura(aluno.id);
    return resumoAssinatura(null);
  },

  'POST /ia': async (req) => {
    const aluno = await exigirAluno(req);
    const assinatura = await assinaturaAtiva(aluno.id);
    if (!assinatura) throw Object.assign(new Error('O MindTrack AI faz parte dos planos Pro e Plus.'), { status: 402 });
    const nivel = nivelDoPlano(assinatura.plano);
    const L = limitesDe(assinatura);

    const [uso, doMes] = await Promise.all([usoDoDia(aluno.id), usoDoMes(aluno.id)]);
    if (uso.chamadas >= L.dia) {
      throw Object.assign(new Error(`Você usou as ${L.dia} perguntas de hoje. Volte amanhã.`
        + (nivel === 'pro' ? ' (No Plus são mais perguntas por dia.)' : '')), { status: 429 });
    }
    if (doMes >= L.mes) {
      throw Object.assign(new Error(`Você chegou ao limite de ${L.mes} perguntas do mês.`), { status: 429 });
    }

    // fotos são maiores: o corpo do /ia aceita até ~9 MB (as outras rotas seguem pequenas)
    const { system, conteudo, schema, maxTokens, esforco } = await lerCorpo(req, 9000000);
    if (!system || !conteudo) throw Object.assign(new Error('Pedido incompleto'), { status: 400 });

    const fotos = contarFotos(conteudo);
    if (fotos > L.fotosPergunta) {
      throw Object.assign(new Error(`Seu plano envia até ${L.fotosPergunta} foto(s) por pergunta.`
        + (nivel === 'pro' ? ' No Plus vão até 4.' : '')), { status: 429 });
    }
    if (fotos && (uso.fotos || 0) + fotos > L.fotosDia) {
      throw Object.assign(new Error(`Você chegou ao limite de ${L.fotosDia} foto(s) por dia.`
        + (nivel === 'pro' ? ' No Plus são 25 por dia.' : '')), { status: 429 });
    }

    const r = await perguntar({ system, conteudo, schema, maxTokens, esforco, nivel });
    // resposta que veio do cache não gastou a IA: não conta no limite do aluno
    if (!r.cache) await registrarUso(aluno.id, { ...r.uso, fotos });
    return {
      texto: r.texto,
      restamHoje: Math.max(0, L.dia - uso.chamadas - (r.cache ? 0 : 1)),
      fotosRestamHoje: Math.max(0, L.fotosDia - (uso.fotos || 0) - fotos),
    };
  },

  /* ---------- pagamento ---------- */
  'POST /pagar': async (req) => {
    const aluno = await exigirAluno(req);
    if (!pagamentoLigado()) throw Object.assign(new Error('O pagamento ainda não está disponível. Use um código de acesso.'), { status: 503 });
    const corpo = await lerCorpo(req);
    const planoId = normalizarPlanoId(corpo.planoId);
    const forma = corpo.forma || 'unico';
    const plano = PLANOS[planoId];
    if (!plano) throw Object.assign(new Error('Plano desconhecido'), { status: 400 });

    // 'unico' = Checkout Pro (Pix + cartão, compra N dias)
    // 'recorrente' = assinatura no cartão, renova sozinha (Pix não permite)
    const r = forma === 'recorrente'
      ? await criarAssinaturaMP({ planoId, usuario: aluno })
      : await criarPagamentoUnico({ planoId, usuario: aluno });
    await registrarPagamento({
      usuarioId: aluno.id, plano: planoId, valor: r.valor,
      referencia: `${forma === 'recorrente' ? 'preapproval' : 'preferencia'}:${r.id}`,
    });
    return { link: r.link, plano: planoId, valor: r.valor, forma: r.forma };
  },

  /* Pix na própria tela do MindTrack: QR + código copia-e-cola. */
  'POST /pagar/pix': async (req) => {
    const aluno = await exigirAluno(req);
    if (!pagamentoLigado()) throw Object.assign(new Error('O pagamento ainda não está disponível. Use um código de acesso.'), { status: 503 });
    const corpo = await lerCorpo(req);
    const planoId = normalizarPlanoId(corpo.planoId);
    const r = await criarPix({ planoId, usuario: aluno, email: corpo.email });
    await registrarPagamento({ usuarioId: aluno.id, plano: planoId, referencia: `payment:${r.id}`, valor: r.valor });
    return r;
  },

  /* A chave PÚBLICA do Mercado Pago pode ficar no navegador — é ela que monta
     o formulário do cartão. A privada (MP_ACCESS_TOKEN) nunca sai daqui. */
  'GET /pagamento/chave-publica': async () => ({ chave: chavePublica(), formularioNoApp: !!chavePublica() }),

  'POST /pagar/cartao': async (req) => {
    const aluno = await exigirAluno(req);
    if (!pagamentoLigado()) throw Object.assign(new Error('O pagamento ainda não está disponível.'), { status: 503 });
    const corpo = await lerCorpo(req);
    const planoId = normalizarPlanoId(corpo.planoId);
    const cartao = corpo.cartao;
    const plano = PLANOS[planoId];
    if (!plano) throw Object.assign(new Error('Plano desconhecido'), { status: 400 });

    const r = await pagarComCartao({ planoId, usuario: aluno, cartao });
    const referencia = `payment:${r.id}`;
    // Registra como pendente: quem marca "pago" é o trecho abaixo, e é ele que
    // libera os dias. Marcar pago antes faria a trava de duplicidade barrar a
    // própria liberação.
    const novo = !(await jaProcessado(referencia));
    await registrarPagamento({ usuarioId: aluno.id, plano: planoId, referencia, valor: r.valor });

    if (r.status === 'approved' && novo) {
      await criarAssinatura({ usuarioId: aluno.id, plano: planoId, dias: plano.dias, origem: 'pagamento', referencia });
      await marcarPago({ usuarioId: aluno.id, plano: planoId, referencia, valor: r.valor });
      console.log(`✅ Pro liberado para ${aluno.id} (${planoId}, ${plano.dias} dias) — cartão`);
    }
    const assinatura = await assinaturaAtiva(aluno.id);
    return { ...r, ...resumoAssinatura(assinatura) };
  },

  'GET /meus-pagamentos': async (req) => {
    const aluno = await exigirAluno(req);
    return { pagamentos: await pagamentosDoUsuario(aluno.id) };
  },

  /* O Mercado Pago chama aqui quando alguém paga. Sem login: a garantia é a
     assinatura digital do aviso + a consulta na API deles antes de liberar. */
  'POST /webhook/mercadopago': async (req, url) => {
    if (!webhookConfere(req, url)) {
      console.warn('Webhook do Mercado Pago com assinatura inválida — ignorado.');
      return { recebido: true };
    }
    const corpo = await lerCorpo(req).catch(() => ({}));
    const tipo = corpo.type || corpo.topic || url.searchParams.get('type') || url.searchParams.get('topic');
    const id = corpo?.data?.id || corpo.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    let aviso = null;
    try { aviso = await interpretarAviso({ tipo, id }); }
    catch (e) { console.error('Falha ao consultar o Mercado Pago:', e.message); return { recebido: true }; }
    if (!aviso) return { recebido: true, acao: 'nada a fazer' };

    if (await jaProcessado(aviso.referencia)) return { recebido: true, acao: 'já processado' };

    await criarAssinatura({
      usuarioId: aviso.usuarioId, plano: aviso.planoId, dias: aviso.dias,
      origem: 'pagamento', referencia: aviso.referencia,
    });
    await marcarPago({ usuarioId: aviso.usuarioId, plano: aviso.planoId, referencia: aviso.referencia, valor: aviso.valor });
    console.log(`✅ Pro liberado para ${aviso.usuarioId} (${aviso.planoId}, ${aviso.dias} dias)`);
    return { recebido: true, acao: 'pro liberado' };
  },

  /* ---------- conexões ---------- */
  'GET /conexoes/config': async () => ({ ...configPublica(), servicos: ['agenda', 'classroom', 'drive', 'ics'] }),

  'POST /conexoes/google/iniciar': async (req) => {
    if (!googleLigado()) throw Object.assign(new Error('O login do Google ainda não foi configurado no servidor.'), { status: 503 });
    const { servico, volta } = await lerCorpo(req);
    if (!SERVICOS_GOOGLE[servico]) throw Object.assign(new Error('Serviço desconhecido'), { status: 400 });
    const voltaOk = conferirVolta(volta);
    const aluno = await alunoDaRequisicao(req);
    let dica = '';
    if (servico !== 'conta') {
      const u = await exigirContaGoogle(req);
      dica = u.email;
    }
    return { url: await urlAutorizacao({ servico, volta: voltaOk, conta: aluno?.id || null, dica }) };
  },

  'GET /conexoes/google/volta': async (req, url) => {
    let estado;
    try { estado = await lerEstado(url.searchParams.get('state')); }
    catch { return { [REDIRECIONA]: `${URL_APP}#/conexoes?erro=expirou` }; }
    const ir = (p) => ({ [REDIRECIONA]: `${estado.volta}#/conexoes?${new URLSearchParams(p)}` });
    if (url.searchParams.get('error')) return ir({ erro: 'cancelado' });
    try {
      const tok = await trocarCodigo(url.searchParams.get('code') || '');
      const quem = quemEntrou(tok.id_token);
      if (estado.servico === 'conta') {
        const u = await entrarComGoogle(quem, estado.conta);
        return ir({ entrou: await criarTicket(u.id) });
      }
      const u = estado.conta && await usuarioPorId(estado.conta);
      if (!u || u.provedor !== 'google') return ir({ erro: 'sem_conta' });
      if (faltamEscopos(estado.servico, tok.scope).length) {
        if (tok.refresh_token) await revogar(tok.refresh_token);
        return ir({ erro: 'faltou_permissao', servico: estado.servico });
      }
      if (!tok.refresh_token) return ir({ erro: 'sem_permissao', servico: estado.servico });
      await salvarConexao({
        usuarioId: u.id, servico: estado.servico, conta: quem.email,
        segredo: cifrar(tok.refresh_token), escopos: tok.scope || '',
      });
      return ir({ ok: estado.servico });
    } catch (e) {
      console.error('volta do Google', e.message);
      return ir({ erro: 'falhou', servico: estado.servico });
    }
  },

  /* ---------- conta com e-mail e senha (o app pede antes do questionário) ---------- */
  'POST /conta/criar': async (req) => {
    const c = await lerCorpo(req, 400000);
    const nome = String(c.nome || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const email = String(c.email || '').trim().toLowerCase();
    const telefone = normalizarTelefone(c.telefone);
    const senha = String(c.senha || '');
    const foto = String(c.foto || '');
    if (nome.length < 2) throw Object.assign(new Error('Escreva seu nome.'), { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) throw Object.assign(new Error('Esse e-mail não parece certo.'), { status: 400 });
    if (!telefone) throw Object.assign(new Error('Número com DDD, só números (ex.: 11 98765-4321).'), { status: 400 });
    if (senha.length < 8 || senha.length > 100) throw Object.assign(new Error('A senha precisa ter pelo menos 8 caracteres.'), { status: 400 });
    if (foto && (!/^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(foto) || foto.length > 200000)) {
      throw Object.assign(new Error('Foto em formato inesperado (use JPG ou PNG).'), { status: 400 });
    }
    if (muitasBatidas(`conta:${ipDe(req)}`, 5, 3600000)) throw Object.assign(new Error('Muitas contas criadas daqui. Tente mais tarde.'), { status: 429 });
    const atual = await alunoDaRequisicao(req);                 // conta do aparelho: vira a conta de verdade
    const u = await criarContaEmail({ nome, email, telefone, senha, foto }, atual?.id || null);
    if (!u) throw Object.assign(new Error('Esse e-mail já tem conta. Toque em "Já tenho conta" para entrar.'), { status: 409 });
    const whatsapp = await enviarBoasVindas({ telefone, nome });
    return { ...(await respostaDeEntrada(u)), whatsapp };
  },

  'POST /conta/entrar': async (req) => {
    const { email, senha } = await lerCorpo(req);
    const e = String(email || '').trim().toLowerCase();
    if (muitasBatidas(`login:${ipDe(req)}:${e}`, 8, 600000)) throw Object.assign(new Error('Muitas tentativas. Espere 10 minutos.'), { status: 429 });
    const u = await contaPorEmail(e);
    if (!u || !senhaConfere(senha, u.senha_hash)) throw Object.assign(new Error('E-mail ou senha errados.'), { status: 401 });
    return respostaDeEntrada(u);
  },

  'POST /conta/foto': async (req) => {
    const aluno = await exigirAluno(req);
    const { foto } = await lerCorpo(req, 400000);
    if (!/^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(String(foto || '')) || foto.length > 200000) {
      throw Object.assign(new Error('Foto em formato inesperado (use JPG ou PNG).'), { status: 400 });
    }
    await atualizarFoto(aluno.id, foto);
    return { ok: true };
  },

  'POST /conta/troca': async (req) => {
    const { ticket } = await lerCorpo(req);
    const id = await usarTicket(ticket);
    const u = await usuarioPorId(id);
    if (!u) throw Object.assign(new Error('Conta não encontrada'), { status: 404 });
    return respostaDeEntrada(u);
  },

  'GET /conexoes': async (req) => {
    const u = await exigirContaGoogle(req, { pro: false });
    const lista = await conexoesDo(u.id);
    return {
      conexoes: lista.map((c) => ({
        servico: c.servico, conta: c.conta,
        desde: c.criado_em && new Date(c.criado_em).toISOString(),
        sincronizadoEm: c.sincronizado_em && new Date(c.sincronizado_em).toISOString(),
      })),
    };
  },

  'POST /conexoes/sincronizar': async (req) => {
    const u = await exigirContaGoogle(req);
    const { servico } = await lerCorpo(req);
    const c = await conexaoDe(u.id, servico);
    if (!c) throw Object.assign(new Error('Esse app não está conectado.'), { status: 404 });
    freioSincronizar(u.id);
    let saida;
    try {
      if (servico === 'ics') saida = await baixarIcs(decifrar(c.segredo));
      else {
        const { token } = await acessoGoogle(decifrar(c.segredo));
        if (servico === 'agenda') saida = { itens: await lerAgenda(token) };
        else if (servico === 'classroom') saida = { atividades: await lerClassroom(token) };
        else throw Object.assign(new Error('Esse app não sincroniza dados.'), { status: 400 });
      }
    } catch (e) {
      if (e.expirou) await apagarConexao(u.id, servico);
      throw e;
    }
    await marcarSincronizado(u.id, servico);
    return { servico, ...saida, sincronizadoEm: new Date().toISOString() };
  },

  'POST /conexoes/ics': async (req) => {
    const u = await exigirContaGoogle(req);
    const { url: link } = await lerCorpo(req);
    freioSincronizar(u.id);
    const cal = await baixarIcs(link);
    await salvarConexao({ usuarioId: u.id, servico: 'ics', conta: cal.nome || 'Calendário', segredo: cifrar(link) });
    await marcarSincronizado(u.id, 'ics');
    return { servico: 'ics', ...cal, sincronizadoEm: new Date().toISOString() };
  },

  'POST /conexoes/google/token': async (req) => {
    const u = await exigirContaGoogle(req);
    const { servico } = await lerCorpo(req);
    if (servico !== 'drive') throw Object.assign(new Error('Só o Drive usa o seletor.'), { status: 400 });
    const c = await conexaoDe(u.id, 'drive');
    if (!c) throw Object.assign(new Error('Conecte o Google Drive primeiro.'), { status: 404 });
    try {
      const { token, expira } = await acessoGoogle(decifrar(c.segredo));
      return { accessToken: token, expira };
    } catch (e) {
      if (e.expirou) await apagarConexao(u.id, 'drive');
      throw e;
    }
  },

  'POST /conexoes/remover': async (req) => {
    const u = await exigirContaGoogle(req);
    const { servico } = await lerCorpo(req);
    const c = await conexaoDe(u.id, servico);
    if (c && servico !== 'ics') {
      // o mesmo Google pode estar em outra conexão (Agenda e Drive juntos): só revoga se for o único
      const outras = (await conexoesDo(u.id)).filter((x) => x.servico !== servico && x.servico !== 'ics');
      const segredo = decifrar(c.segredo);
      if (!outras.some((x) => decifrar(x.segredo) === segredo)) await revogar(segredo);
    }
    await apagarConexao(u.id, servico);
    return { ok: true };
  },

  'GET /admin/numeros': async (req, url) => {
    exigirAdmin(url);
    return numeros();
  },

  'POST /admin/codigo': async (req, url) => {
    exigirAdmin(url);
    const { codigo, dias, usosMax, nivel } = await lerCorpo(req);
    if (!codigo || !dias) throw Object.assign(new Error('Informe codigo e dias'), { status: 400 });
    return criarCodigo({ codigo, dias: Number(dias), usosMax: Number(usosMax) || 1, nivel });
  },
};

/* Rotas com id no caminho. */
const rotasDinamicas = [
  {
    padrao: /^GET \/pagamento\/([\w-]+)$/,
    /** O app pergunta de tempos em tempos: já caiu? Se caiu, libera na hora —
        sem depender do webhook chegar primeiro. */
    async executar(req, url, [id]) {
      const aluno = await exigirAluno(req);
      const p = await consultarPagamento(id);
      const [usuarioId, planoBruto] = String(p.external_reference || '').split('|');
      const planoId = normalizarPlanoId(planoBruto);
      if (usuarioId !== aluno.id) throw Object.assign(new Error('Este pagamento não é seu'), { status: 403 });

      const plano = PLANOS[planoId];
      const referencia = `payment:${p.id}`;
      let liberado = false;

      if (p.status === 'approved' && plano && !(await jaProcessado(referencia))) {
        await criarAssinatura({ usuarioId, plano: planoId, dias: plano.dias, origem: 'pagamento', referencia });
        await marcarPago({ usuarioId, plano: planoId, referencia, valor: p.transaction_amount ?? plano.valor });
        liberado = true;
        console.log(`✅ Pro liberado para ${usuarioId} (${planoId}, ${plano.dias} dias) — confirmado pela consulta`);
      }
      const assinatura = await assinaturaAtiva(aluno.id);
      return { status: p.status, detalhe: p.status_detail || null, liberadoAgora: liberado, ...resumoAssinatura(assinatura) };
    },
  },
];

const ipDe = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

/* ---------- conexões: utilidades ---------- */
const REDIRECIONA = Symbol('redireciona');
const URL_APP = (process.env.URL_APP || 'https://guidrodrigues21-a11y.github.io/mindtrack-ai/').replace(/#.*$/, '');

/** O "volta" vem do app: só aceitamos páginas dos sites autorizados (ORIGENS). */
function conferirVolta(volta) {
  if (!volta) return URL_APP;
  let u;
  try { u = new URL(String(volta)); } catch { throw Object.assign(new Error('Endereço de volta inválido'), { status: 400 }); }
  if (!['http:', 'https:'].includes(u.protocol) || !(ORIGENS.includes('*') || ORIGENS.includes(u.origin))) {
    throw Object.assign(new Error('Endereço de volta não autorizado'), { status: 400 });
  }
  return `${u.origin}${u.pathname}${u.search}`;
}

/** As Conexões precisam de conta de verdade (Google ou e-mail e senha) e são do Pro. */
async function exigirContaGoogle(req, { pro = true } = {}) {
  const aluno = await exigirAluno(req);
  const u = await usuarioPorId(aluno.id);
  if (!u) throw Object.assign(new Error('Faça login de novo.'), { status: 401 });
  if (!['google', 'email'].includes(u.provedor)) {
    throw Object.assign(new Error('As Conexões precisam de uma conta: crie sua conta ou entre com o Google.'), { status: 403, precisaConta: true });
  }
  if (pro && !(await assinaturaAtiva(u.id))) {
    throw Object.assign(new Error('As Conexões são do MindTrack Pro.'), { status: 402, precisaPro: true });
  }
  return u;
}

async function respostaDeEntrada(u) {
  const token = await criarSessao({ id: u.id, email: u.email || '', nome: u.nome || '' });
  const assinatura = await assinaturaAtiva(u.id);
  return {
    token, usuario: { id: u.id, nome: u.nome, email: u.email || '', foto: u.foto || '', telefone: u.telefone || '', provedor: u.provedor || 'google' },
    ...resumoAssinatura(assinatura),
  };
}

const sincronizacoes = new Map();
function freioSincronizar(id, limite = 30, janela = 3600000) {
  const agora = Date.now();
  const lista = (sincronizacoes.get(id) || []).filter((t) => agora - t < janela);
  if (lista.length >= limite) throw Object.assign(new Error('Muitas sincronizações seguidas. Tente daqui a pouco.'), { status: 429 });
  lista.push(agora);
  sincronizacoes.set(id, lista);
}

/* ---------- amizades, chat e duelos (social.js) ---------- */
const SCHEMA_DUELO = {
  type: 'object', additionalProperties: false, required: ['perguntas'],
  properties: {
    perguntas: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['enunciado', 'opcoes', 'correta'],
        properties: {
          enunciado: { type: 'string' },
          opcoes: { type: 'array', items: { type: 'string' } },
          correta: { type: 'integer', description: 'índice 0 a 3 da opção certa' },
          explicacao: { type: 'string' },
        },
      },
    },
  },
};
/** Duelo com tema livre (Pro): a IA cria as 5 perguntas. Não conta no limite do aluno. */
async function gerarPerguntasIA(tema) {
  const r = await perguntar({
    system: 'Você cria perguntas de quiz escolar em português do Brasil para um duelo entre dois alunos. '
      + 'Exatamente 5 perguntas de múltipla escolha, 4 opções curtas, só UMA correta, nível ensino fundamental II '
      + 'e médio, sem pegadinha e sem nada que você não tenha certeza. explicacao: 1 frase curta.',
    conteudo: `Tema do duelo: ${String(tema).slice(0, 80)}`,
    schema: SCHEMA_DUELO, esforco: 'low', maxTokens: 2500, nivel: 'pro',
  });
  const d = JSON.parse(r.texto);
  return (d.perguntas || [])
    .filter((q) => q?.enunciado && Array.isArray(q.opcoes) && q.opcoes.length === 4 && q.correta >= 0 && q.correta <= 3)
    .map((q) => ({ materia: tema, enunciado: String(q.enunciado).slice(0, 300), opcoes: q.opcoes.map((o) => String(o).slice(0, 120)), correta: q.correta, explicacao: String(q.explicacao || '').slice(0, 300) }));
}
const social = criarRotasSociais({
  exigirAluno, lerCorpo, temIA: temChaveIA, gerarPerguntasIA,
  ehPago: async (id) => !!(await assinaturaAtiva(id)),
});
Object.assign(rotas, social.rotas);
rotasDinamicas.push(...social.dinamicas);

async function exigirAluno(req) {
  const aluno = await alunoDaRequisicao(req);
  if (!aluno) throw Object.assign(new Error('Faça login de novo.'), { status: 401 });
  return aluno;
}
function exigirAdmin(url) {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado || url.searchParams.get('token') !== esperado) {
    throw Object.assign(new Error('Não autorizado'), { status: 401 });
  }
}

/* ---------- servidor ---------- */
const servidor = http.createServer(async (req, res) => {
  const permitido = cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(permitido ? 204 : 403); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const chave = `${req.method} ${url.pathname.replace(/\/+$/, '') || '/saude'}`;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

  if (!permitido && req.headers.origin) return json(res, 403, { erro: 'Origem não autorizada' });
  if (muitasBatidas(ip)) return json(res, 429, { erro: 'Calma aí — muitas chamadas seguidas.' });

  if (chave === 'GET /tempo-real') {
    return social.abrirTempoReal(req, res, url).catch((e) => { console.error('tempo-real', e); if (!res.headersSent) json(res, 500, { erro: 'Erro inesperado' }); });
  }
  const rota = rotas[chave];
  const dinamica = rota ? null : rotasDinamicas.map((d) => ({ d, m: chave.match(d.padrao) })).find((x) => x.m);
  if (!rota && !dinamica) return json(res, 404, { erro: 'Rota não encontrada' });

  try {
    const saida = rota ? await rota(req, url) : await dinamica.d.executar(req, url, dinamica.m.slice(1));
    if (saida && saida[REDIRECIONA]) {
      res.writeHead(302, { location: saida[REDIRECIONA], 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
      return res.end();
    }
    json(res, 200, saida);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(chave, e);
    json(res, status, { erro: e.message || 'Erro inesperado' });
  }
});

migrar()
  .then(() => migrarSocial())
  .then(() => servidor.listen(PORTA, () => {
    console.log(`MindTrack no ar em :${PORTA}`);
    console.log(`  banco: ${emMemoria ? 'MEMÓRIA (só para testes)' : 'postgres'}`);
    console.log(`  IA: ${provedor() || 'NENHUMA CHAVE'} · modelo ${modeloEmUso()}${provedor() === 'claude' ? ` (Plus: ${modeloPara('plus')})` : ''}`);
    console.log(`  limites Pro: ${LIMITES.pro.dia}/dia, ${LIMITES.pro.mes}/mês, ${LIMITES.pro.fotosDia} fotos/dia`);
    console.log(`  limites Plus: ${LIMITES.plus.dia}/dia, ${LIMITES.plus.mes}/mês, ${LIMITES.plus.fotosDia} fotos/dia`);
    console.log(`  chave de IA: ${temChaveIA() ? 'ok' : 'FALTANDO (ANTHROPIC_API_KEY ou GEMINI_API_KEY — a do Gemini é grátis)'}`);
    console.log(`  pagamento: ${pagamentoLigado() ? 'Mercado Pago ligado (Pix + cartão)' : 'desligado (só código de acesso)'}`);
    if (pagamentoLigado()) console.log(`  webhook: ${urlDoWebhook() || 'defina URL_WEBHOOK ou configure no painel do Mercado Pago'}`);
    if (pagamentoLigado() && !process.env.MP_WEBHOOK_SECRET) {
      console.warn('  ⚠️  MP_WEBHOOK_SECRET vazio — os avisos do Mercado Pago não serão verificados.');
    }
    console.log(`  origens liberadas: ${ORIGENS.join(', ')}`);
    if (MODO_TESTE) console.warn('  ⚠️  MODO_TESTE=1 — o login pode ser simulado. NUNCA use isso em produção.');
  }))
  .catch((e) => { console.error('Falha ao preparar o banco:', e); process.exit(1); });
