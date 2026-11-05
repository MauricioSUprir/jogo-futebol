/* ===== tempo-real.js — avisos instantâneos do servidor para o celular =====
   Server-Sent Events: o app abre UMA conexão (EventSource) e o servidor empurra
   mensagens novas, pedidos de amizade e cada passo do duelo. É HTTP comum, então
   funciona no plano grátis do Render, sem biblioteca nenhuma.
   Abrir a conexão pede um tíquete curto (o EventSource não manda cabeçalhos). */
import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const conexoes = new Map();   // usuarioId → Set<res>
const chave = () => crypto.createHash('sha256').update(`${process.env.SEGREDO || 'segredo-de-desenvolvimento'}:tempo-real`).digest();

export const criarTicketTempoReal = (usuarioId) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' })
  .setIssuer('mindtrack-rt').setSubject(usuarioId).setIssuedAt().setExpirationTime('2m').sign(chave());

export async function lerTicketTempoReal(ticket) {
  try {
    const { payload } = await jwtVerify(String(ticket || ''), chave(), { issuer: 'mindtrack-rt' });
    return String(payload.sub);
  } catch { return null; }
}

export const estaOnline = (usuarioId) => (conexoes.get(usuarioId)?.size || 0) > 0;

/** Liga a resposta HTTP como canal de eventos. aoSair é chamado quando o celular desconecta. */
export function abrirCanal(usuarioId, req, res, aoSair) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  const lista = conexoes.get(usuarioId) || new Set();
  lista.add(res);
  conexoes.set(usuarioId, lista);
  enviarA(res, 'ola', { online: true });
  // batida a cada 20 s: mantém a conexão viva nos proxies do caminho
  const batida = setInterval(() => res.write(': batida\n\n'), 20000);
  req.on('close', () => {
    clearInterval(batida);
    lista.delete(res);
    if (!lista.size) conexoes.delete(usuarioId);
    aoSair?.(usuarioId);
  });
}

function enviarA(res, evento, dados) {
  try { res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`); } catch { /* conexão caiu */ }
}

/** Manda um evento para todos os aparelhos abertos desta pessoa. */
export function enviar(usuarioId, evento, dados) {
  for (const res of conexoes.get(usuarioId) || []) enviarA(res, evento, dados);
}

export const totalConectados = () => conexoes.size;
