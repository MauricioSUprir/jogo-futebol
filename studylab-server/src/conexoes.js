/* ===== conexoes.js — os apps que o aluno liga ao MindTrack =====
   • Google (Agenda, Classroom, Drive): login OAuth no próprio Google. O servidor
     troca o código pelo "refresh token" e guarda ele CIFRADO no banco (AES-256-GCM).
     O app nunca vê esse token — só recebe as provas, tarefas e eventos já prontos.
   • Calendário por link (.ics): Outlook, iCloud, Moodle, o calendário da escola…
     O link privado também fica cifrado. Só baixamos de endereços públicos da
     internet (nada de rede interna), no máximo 2 MB.

   Variáveis de ambiente:
     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   cliente OAuth "Aplicativo da Web"
     GOOGLE_API_KEY, GOOGLE_PROJETO           só para o seletor do Drive (públicos)
     URL_SERVIDOR (ou RENDER_EXTERNAL_URL)    para montar o endereço de volta     */
import crypto from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { SignJWT, jwtVerify, decodeJwt } from 'jose';

const G = 'https://www.googleapis.com/auth/';
const BASICOS = ['openid', 'email', 'profile'];
export const SERVICOS_GOOGLE = {
  conta: { escopos: [] },                                                  // só entrar
  agenda: { escopos: [`${G}calendar.events.readonly`] },
  classroom: { escopos: [`${G}classroom.courses.readonly`, `${G}classroom.coursework.me.readonly`] },
  drive: { escopos: [`${G}drive.file`] },
};
export const SERVICOS = [...Object.keys(SERVICOS_GOOGLE).filter((s) => s !== 'conta'), 'ics'];

const URLS = {
  autorizar: () => process.env.GOOGLE_OAUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
  token: () => process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
  revogar: 'https://oauth2.googleapis.com/revoke',
  agenda: 'https://www.googleapis.com/calendar/v3',
  classroom: 'https://classroom.googleapis.com/v1',
};

export const googleLigado = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const baseServidor = () => (process.env.URL_SERVIDOR || process.env.RENDER_EXTERNAL_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')
  || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
export const urlDeVolta = () => `${baseServidor()}/conexoes/google/volta`;

export function configPublica() {
  return {
    google: googleLigado(),
    // a chave do seletor do Drive é pública por natureza (fica no navegador);
    // ela deve estar restrita ao site do app no Google Cloud
    drive: googleLigado() && process.env.GOOGLE_API_KEY && process.env.GOOGLE_PROJETO
      ? { clientId: process.env.GOOGLE_CLIENT_ID, chave: process.env.GOOGLE_API_KEY, projeto: process.env.GOOGLE_PROJETO }
      : null,
  };
}

const erro = (msg, status = 400, extra = {}) => Object.assign(new Error(msg), { status, ...extra });

/* ---------- chaves derivadas do SEGREDO (cada uso com a sua) ---------- */
const derivar = (uso) => crypto.createHash('sha256')
  .update(`${process.env.SEGREDO || 'segredo-de-desenvolvimento'}:${uso}`).digest();

export function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', derivar('conexoes'), iv);
  const dados = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), dados.toString('base64url')].join('.');
}

export function decifrar(guardado) {
  const [v, iv, tag, dados] = String(guardado).split('.');
  if (v !== 'v1') throw erro('Conexão em formato desconhecido', 500);
  const d = crypto.createDecipheriv('aes-256-gcm', derivar('conexoes'), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(dados, 'base64url')), d.final()]).toString('utf8');
}

/* ---------- "state" do OAuth e o tíquete de entrada ---------- */
export async function criarEstado({ servico, volta, conta }) {
  return new SignJWT({ servico, volta, conta: conta || null })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('mindtrack-oauth')
    .setIssuedAt().setExpirationTime('15m').setJti(crypto.randomUUID())
    .sign(derivar('estado'));
}
export async function lerEstado(token) {
  const { payload } = await jwtVerify(String(token || ''), derivar('estado'), { issuer: 'mindtrack-oauth' });
  return payload;
}

/* O tíquete viaja no endereço de volta (depois do #, que não vai para servidor
   nenhum), vale 3 minutos e só pode ser trocado UMA vez pela sessão. */
const ticketsUsados = new Map();
export async function criarTicket(usuarioId) {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuer('mindtrack-troca')
    .setSubject(usuarioId).setIssuedAt().setExpirationTime('3m').setJti(crypto.randomUUID())
    .sign(derivar('troca'));
}
export async function usarTicket(ticket) {
  let payload;
  try { ({ payload } = await jwtVerify(String(ticket || ''), derivar('troca'), { issuer: 'mindtrack-troca' })); }
  catch { throw erro('Esse link de entrada expirou. Entre de novo.', 401); }
  if (ticketsUsados.has(payload.jti)) throw erro('Esse link de entrada já foi usado.', 401);
  const agora = Date.now();
  for (const [k, ate] of ticketsUsados) if (ate < agora) ticketsUsados.delete(k);
  ticketsUsados.set(payload.jti, agora + 5 * 60000);
  return String(payload.sub);
}

/* ---------- Google OAuth ---------- */
export async function urlAutorizacao({ servico, volta, conta, dica = '' }) {
  const s = SERVICOS_GOOGLE[servico];
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: urlDeVolta(),
    response_type: 'code',
    scope: [...BASICOS, ...s.escopos].join(' '),
    state: await criarEstado({ servico, volta, conta }),
    include_granted_scopes: 'true',
  });
  if (servico === 'conta') {
    p.set('access_type', 'online');
    p.set('prompt', 'select_account');
  } else {
    p.set('access_type', 'offline');            // queremos o refresh token…
    p.set('prompt', 'consent select_account');  // …e o Google só manda de novo com consent
  }
  if (dica) p.set('login_hint', dica);
  return `${URLS.autorizar()}?${p}`;
}

async function postToken(campos) {
  const r = await fetch(URLS.token(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...campos,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d.error === 'invalid_grant') throw erro('A permissão do Google expirou ou foi tirada. Conecte de novo.', 410, { expirou: true });
    throw erro(`Google recusou (${d.error || r.status})`, 502);
  }
  return d;
}

export const trocarCodigo = (code) => postToken({ code, grant_type: 'authorization_code', redirect_uri: urlDeVolta() });

/** O id_token veio DIRETO do Google pelo canal TLS do token: basta conferir
 *  emissor, destinatário e validade (OpenID Connect, seção 3.1.3.7). */
export function quemEntrou(idToken) {
  const p = decodeJwt(String(idToken || ''));
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(p.iss)) throw erro('Resposta do Google inesperada', 502);
  if (p.aud !== process.env.GOOGLE_CLIENT_ID) throw erro('Resposta do Google para outro app', 502);
  if (p.exp && p.exp * 1000 < Date.now() - 60000) throw erro('Resposta do Google vencida', 502);
  return { sub: String(p.sub), email: String(p.email || ''), nome: String(p.name || ''), foto: String(p.picture || '') };
}

export const faltamEscopos = (servico, concedidos = '') => {
  const tem = new Set(String(concedidos).split(/\s+/));
  return SERVICOS_GOOGLE[servico].escopos.filter((e) => !tem.has(e));
};

const acessos = new Map();   // refresh → { token, ate } (evita pedir token novo a cada sincronização)
export async function acessoGoogle(refresh) {
  const guardado = acessos.get(refresh);
  if (guardado && guardado.ate > Date.now() + 60000) return { token: guardado.token, expira: guardado.ate };
  const d = await postToken({ refresh_token: refresh, grant_type: 'refresh_token' });
  const ate = Date.now() + (Number(d.expires_in) || 3600) * 1000;
  acessos.set(refresh, { token: d.access_token, ate });
  if (acessos.size > 500) acessos.delete(acessos.keys().next().value);
  return { token: d.access_token, expira: ate };
}

export async function revogar(refresh) {
  acessos.delete(refresh);
  try {
    await fetch(URLS.revogar, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh }) });
  } catch { /* se o Google não responder, a conexão sai do nosso lado mesmo assim */ }
}

async function getGoogle(url, token) {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) throw erro('A permissão do Google expirou. Conecte de novo.', 410, { expirou: true });
  if (r.status === 403) throw erro(d.error?.message || 'O Google não liberou esse acesso para a sua conta.', 403);
  if (!r.ok) throw erro(`O Google não respondeu (${r.status})`, 502);
  return d;
}

/* ---------- o que vira o quê ---------- */
const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Mesmos tipos que a importação por foto da Minha Escola usa. */
export function tipoPeloTitulo(titulo) {
  const t = sem(titulo);
  if (/\bsimulado/.test(t)) return 'simulado';
  if (/\b(teste|quiz)\b/.test(t)) return 'teste';
  if (/\b(prova|avaliacao|exame|recuperacao|p[1-4]\b|ap[1-4]\b)/.test(t)) return 'prova';
  if (/\b(trabalho|seminario|entrega|projeto|redacao)/.test(t)) return 'trabalho';
  if (/\bferias\b/.test(t)) return 'ferias';
  if (/\b(feriado|recesso|ponto facultativo)/.test(t)) return 'feriado';
  if (/\b(reuniao|conselho de classe|plantao)/.test(t)) return 'reuniao';
  if (/\b(bimestre|trimestre|semestre)/.test(t)) return 'bimestre';
  return 'evento';
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const somaDia = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const curto = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

function item({ id, titulo, data, ate = '', hora = '', descricao = '' }) {
  if (!ISO.test(data) || !titulo) return null;
  const it = { idExterno: id, tipo: tipoPeloTitulo(titulo), titulo: curto(titulo, 120), data };
  if (ate && ISO.test(ate) && ate > data) it.ate = ate;
  if (/^\d{2}:\d{2}$/.test(hora)) it.hora = hora;
  if (descricao) it.descricao = curto(descricao, 300);
  return it;
}

/* Google Agenda: a agenda principal, de 1 semana atrás até 4 meses à frente. */
export async function lerAgenda(token) {
  const de = new Date(Date.now() - 7 * 86400000).toISOString();
  const ate = new Date(Date.now() + 120 * 86400000).toISOString();
  const q = new URLSearchParams({ timeMin: de, timeMax: ate, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const d = await getGoogle(`${URLS.agenda}/calendars/primary/events?${q}`, token);
  return (d.items || []).filter((e) => e.status !== 'cancelled').map((e) => {
    const diaInteiro = !!e.start?.date;
    const data = diaInteiro ? e.start.date : String(e.start?.dateTime || '').slice(0, 10);
    // no Google o fim do evento de dia inteiro é o dia SEGUINTE
    const fim = diaInteiro ? somaDia(e.end?.date || data, -1) : '';
    return item({
      id: `gagenda:${e.id}`, titulo: e.summary, data, ate: fim,
      hora: diaInteiro ? '' : String(e.start?.dateTime || '').slice(11, 16), descricao: e.description,
    });
  }).filter(Boolean);
}

/* Google Classroom: as atividades das turmas ativas, com o que já foi entregue. */
export async function lerClassroom(token) {
  const turmas = (await getGoogle(`${URLS.classroom}/courses?studentId=me&courseStates=ACTIVE&pageSize=20`, token)).courses || [];
  const limite = somaDia(hojeBR(), -21);
  const saida = [];
  for (const turma of turmas.slice(0, 15)) {
    const [trabalhos, entregas] = await Promise.all([
      getGoogle(`${URLS.classroom}/courses/${encodeURIComponent(turma.id)}/courseWork?pageSize=40`, token).catch(() => ({})),
      getGoogle(`${URLS.classroom}/courses/${encodeURIComponent(turma.id)}/courseWork/-/studentSubmissions?userId=me&pageSize=100`, token).catch(() => ({})),
    ]);
    const entregue = new Set((entregas.studentSubmissions || [])
      .filter((s) => ['TURNED_IN', 'RETURNED'].includes(s.state)).map((s) => s.courseWorkId));
    for (const t of trabalhos.courseWork || []) {
      const dd = t.dueDate;
      const entrega = dd?.year ? `${dd.year}-${String(dd.month).padStart(2, '0')}-${String(dd.day).padStart(2, '0')}` : '';
      if (entrega && entrega < limite) continue;          // coisa velha não interessa
      saida.push({
        idExterno: `gclass:${t.id}`, titulo: curto(t.title, 120), materia: curto(turma.name, 60),
        entrega, feita: entregue.has(t.id), link: /^https:\/\//.test(t.alternateLink || '') ? t.alternateLink : '',
        descricao: curto(t.description, 300), tipo: tipoPeloTitulo(t.title),
      });
    }
  }
  return saida.slice(0, 120);
}

/* ---------- calendário por link (.ics) ---------- */
const TETO_ICS = 2 * 1024 * 1024;

/* ICS_PERMITIR_LOCAL=1 só existe para os testes: libera a PRÓPRIA máquina (127.x/::1), nada mais. */
const soLoopbackLiberado = (ip) => process.env.ICS_PERMITIR_LOCAL === '1' && (/^127\./.test(ip) || ip === '::1' || ip === '::ffff:127.0.0.1');
function bloqueado(ip) { return ipPrivado(ip) && !soLoopbackLiberado(ip); }

function ipPrivado(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return ipPrivado(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8')
    || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

/* A checagem acontece NA HORA de conectar (lookup do próprio socket):
   assim um domínio não consegue "trocar" de IP entre a checagem e o download. */
function lookupSeguro(host, opcoes, cb) {
  dns.lookup(host, { ...opcoes, all: true }, (e, enderecos) => {
    if (e) return cb(e);
    const lista = Array.isArray(enderecos) ? enderecos : [{ address: enderecos, family: opcoes.family || 4 }];
    if (lista.some((x) => bloqueado(x.address))) {
      return cb(erro('Esse endereço não é público.', 400));
    }
    if (opcoes.all) return cb(null, lista);
    cb(null, lista[0].address, lista[0].family);
  });
}

export function normalizarLinkIcs(bruto) {
  let u;
  try { u = new URL(String(bruto || '').trim().replace(/^webcals?:\/\//i, 'https://')); }
  catch { throw erro('Esse link não parece um endereço de calendário.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw erro('Use um link http(s) ou webcal.');
  if (u.username || u.password) throw erro('Link com usuário e senha não é aceito.');
  const ip = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(ip) && bloqueado(ip)) throw erro('Esse endereço não é público.');
  if (u.port && !['80', '443'].includes(u.port) && process.env.ICS_PERMITIR_LOCAL !== '1') throw erro('Porta não permitida.');
  return u.toString();
}

function baixar(link, saltos = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(link);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(u, { lookup: lookupSeguro, timeout: 12000, headers: { 'user-agent': 'MindTrack-Calendario/1.0', accept: 'text/calendar, */*' } }, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
        r.resume();
        if (saltos >= 3) return reject(erro('O link redireciona demais.'));
        try { return resolve(baixar(normalizarLinkIcs(new URL(r.headers.location, u).toString()), saltos + 1)); }
        catch (e) { return reject(e); }
      }
      if (r.statusCode !== 200) { r.resume(); return reject(erro(`O calendário respondeu ${r.statusCode}. Confira se o link é público.`)); }
      const partes = []; let total = 0;
      r.on('data', (c) => {
        total += c.length;
        if (total > TETO_ICS) { req.destroy(); reject(erro('Calendário grande demais (máximo 2 MB).')); }
        else partes.push(c);
      });
      r.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
      r.on('error', reject);
    });
    req.on('timeout', () => req.destroy(erro('O calendário demorou demais para responder.', 504)));
    req.on('error', (e) => reject(e.status ? e : erro('Não consegui baixar esse calendário.')));
  });
}

const desescapar = (v) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');

/** Data de um DTSTART/DTEND do iCalendar → { data, hora }. Horário em UTC (…Z)
 *  vira o de Brasília (UTC−3, sem horário de verão desde 2019). */
function dataIcs(valor = '') {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  if (!m[4]) return { data: `${m[1]}-${m[2]}-${m[3]}`, hora: '' };
  if (m[7]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 3 * 3600000).toISOString();
    return { data: d.slice(0, 10), hora: d.slice(11, 16) };
  }
  return { data: `${m[1]}-${m[2]}-${m[3]}`, hora: `${m[4]}:${m[5]}` };
}

export function lerIcs(texto) {
  const linhas = String(texto).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  if (!linhas.some((l) => l.trim() === 'BEGIN:VCALENDAR')) throw erro('Esse link não devolveu um calendário (.ics).');
  let nome = '';
  const eventos = [];
  let ev = null;
  for (const l of linhas) {
    if (l === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (l === 'END:VEVENT') { if (ev) eventos.push(ev); ev = null; continue; }
    const i = l.indexOf(':');
    if (i < 0) continue;
    const chave = l.slice(0, i).split(';')[0].toUpperCase();
    const valor = l.slice(i + 1);
    if (!ev) { if (chave === 'X-WR-CALNAME') nome = desescapar(valor); continue; }
    if (['SUMMARY', 'DTSTART', 'DTEND', 'UID', 'DESCRIPTION', 'STATUS'].includes(chave)) ev[chave] = valor;
  }
  const de = somaDia(hojeBR(), -7);
  const ate = somaDia(hojeBR(), 180);
  const itens = eventos
    .filter((e) => (e.STATUS || '').toUpperCase() !== 'CANCELLED')
    .map((e) => {
      const ini = dataIcs(e.DTSTART);
      if (!ini) return null;
      const fim = dataIcs(e.DTEND);
      const fimData = fim ? (fim.hora ? fim.data : somaDia(fim.data, -1)) : '';  // dia inteiro: o fim é exclusivo
      const uid = e.UID || crypto.createHash('sha1').update(`${e.SUMMARY}|${e.DTSTART}`).digest('hex');
      return item({
        id: `ics:${crypto.createHash('sha1').update(uid).digest('hex').slice(0, 20)}:${ini.data}`,
        titulo: desescapar(e.SUMMARY || ''), data: ini.data, ate: fimData, hora: ini.hora,
        descricao: desescapar(e.DESCRIPTION || ''),
      });
    })
    .filter((x) => x && (x.ate || x.data) >= de && x.data <= ate)
    .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')))
    .slice(0, 300);
  return { nome: curto(nome, 60), itens };
}

export async function baixarIcs(link) {
  return lerIcs(await baixar(normalizarLinkIcs(link)));
}
