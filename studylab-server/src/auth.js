/* ===== auth.js — quem é o aluno =====
   1) O app manda o token do Google (login).
   2) Conferimos a assinatura desse token com as chaves públicas do Google.
   3) Devolvemos uma SESSÃO do StudyLab (30 dias), que é o que o app usa depois.
   Assim o aluno não precisa relogar a cada hora.                              */
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';

const CHAVES_GOOGLE = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const EMISSORES = ['https://accounts.google.com', 'accounts.google.com'];
const DIAS_SESSAO = 30;

const segredo = () => new TextEncoder().encode(process.env.SEGREDO || 'segredo-de-desenvolvimento');

/** Confere o token do Google e devolve os dados do aluno. */
export async function verificarGoogle(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID não configurado no servidor');
  const { payload } = await jwtVerify(idToken, CHAVES_GOOGLE, {
    audience: clientId,
    issuer: EMISSORES,
  });
  if (!payload.email_verified) throw new Error('E-mail do Google não verificado');
  return {
    id: String(payload.sub),
    email: String(payload.email || ''),
    nome: String(payload.name || ''),
    foto: String(payload.picture || ''),
  };
}

export async function criarSessao(usuario) {
  return new SignJWT({ email: usuario.email, nome: usuario.nome })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuario.id)
    .setIssuedAt()
    .setIssuer('studylab')
    .setExpirationTime(`${DIAS_SESSAO}d`)
    .sign(segredo());
}

export async function lerSessao(token) {
  const { payload } = await jwtVerify(token, segredo(), { issuer: 'studylab' });
  return { id: String(payload.sub), email: String(payload.email || ''), nome: String(payload.nome || '') };
}

/** Lê o "Authorization: Bearer ..." e devolve o aluno, ou null. */
export async function alunoDaRequisicao(req) {
  const cab = req.headers.authorization || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7).trim() : '';
  if (!token) return null;
  try { return await lerSessao(token); } catch { return null; }
}
