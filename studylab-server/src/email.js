/* ===== email.js — código de verificação por e-mail (6 números) =====
   Fica DESLIGADO até o dono colocar no Render UMA das opções:
     Brevo (grátis, 300 e-mails/dia, não precisa de domínio — só confirmar o e-mail remetente):
       BREVO_API_KEY      chave da API (Brevo → SMTP & API → API Keys)
       EMAIL_REMETENTE    o e-mail confirmado como remetente no Brevo (ex.: mindtrack.ai.app@gmail.com)
     Resend (grátis, 3.000/mês, precisa de um domínio próprio verificado):
       RESEND_API_KEY     chave da API
       EMAIL_REMETENTE    ex.: codigo@seudominio.com.br
   Desligado: a conta é criada sem o código (como antes), e o "esqueci a senha" avisa que não dá.

   O código nunca é guardado: só o hash (sha256 do e-mail + código + SEGREDO). Vale 10 min,
   aceita 5 tentativas e é de uso único. Fica na memória do servidor: se ele reiniciar,
   o aluno pede outro (é coisa de minutos).                                              */
import crypto from 'node:crypto';

export const emailLigado = () => !!((process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) && process.env.EMAIL_REMETENTE);

const VALIDADE = 10 * 60 * 1000;
const TENTATIVAS = 5;
const pendentes = new Map();     // `${motivo}:${email}` → { hash, expira, tentativas }

const hashDe = (email, codigo) =>
  crypto.createHash('sha256').update(`${process.env.SEGREDO || 'mindtrack'}|${email}|${codigo}`).digest();

/** Gera um código novo para o e-mail (o anterior deixa de valer). */
export function gerarCodigo(email, motivo) {
  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  pendentes.set(`${motivo}:${email}`, { hash: hashDe(email, codigo), expira: Date.now() + VALIDADE, tentativas: 0 });
  // limpeza dos vencidos (a lista nunca cresce sem parar)
  if (pendentes.size > 5000) for (const [k, v] of pendentes) if (v.expira < Date.now()) pendentes.delete(k);
  return codigo;
}

/** true se o código confere (e o gasta). Lança erro com a mensagem para o aluno quando não confere. */
export function conferirCodigo(email, motivo, codigo) {
  const chave = `${motivo}:${email}`;
  const p = pendentes.get(chave);
  const erro = (m) => Object.assign(new Error(m), { status: 400 });
  if (!p || p.expira < Date.now()) { pendentes.delete(chave); throw erro('Código vencido. Peça um novo.'); }
  if (!/^\d{6}$/.test(String(codigo || '').trim())) throw erro('O código tem 6 números.');
  p.tentativas++;
  const certo = crypto.timingSafeEqual(p.hash, hashDe(email, String(codigo).trim()));
  if (!certo) {
    if (p.tentativas >= TENTATIVAS) { pendentes.delete(chave); throw erro('Código errado muitas vezes. Peça um novo.'); }
    throw erro(`Código errado. Você ainda tem ${TENTATIVAS - p.tentativas} tentativa(s).`);
  }
  pendentes.delete(chave);
  return true;
}

const ASSUNTO = { criar: 'Seu código para criar a conta no MindTrack AI', senha: 'Seu código para trocar a senha do MindTrack AI' };

function html({ nome, codigo, motivo }) {
  const oi = nome ? `Oi, ${String(nome).split(' ')[0].replace(/[<>&"]/g, '')}!` : 'Oi!';
  const frase = motivo === 'senha' ? 'Use este código para criar uma senha nova:' : 'Use este código para terminar de criar sua conta:';
  return `<!doctype html><html><body style="margin:0;background:#f3eee3;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:440px;margin:0 auto;padding:28px 20px">
  <div style="font-size:22px;font-weight:800;letter-spacing:-.5px">MindTrack <span style="color:#1d9bf0">AI</span></div>
  <div style="background:#fff;border-radius:18px;padding:24px;margin-top:16px;border:1px solid #e5dccb">
    <p style="font-size:16px;margin:0 0 8px">${oi}</p>
    <p style="font-size:15px;margin:0 0 18px;color:#444">${frase}</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;background:#0b0d10;color:#fff;border-radius:14px;padding:16px 0">${codigo}</div>
    <p style="font-size:13px;color:#777;margin:18px 0 0">O código vale 10 minutos. Se não foi você, pode ignorar este e-mail.</p>
  </div>
</div></body></html>`;
}

/** Manda o código. Devolve 'enviado' | 'falhou' | 'desligado'. */
export async function enviarCodigo({ email, nome, codigo, motivo }) {
  if (!emailLigado()) return 'desligado';
  const remetente = process.env.EMAIL_REMETENTE;
  const assunto = ASSUNTO[motivo] || ASSUNTO.criar;
  const texto = `Seu código do MindTrack AI: ${codigo}\nVale 10 minutos. Se não foi você, ignore este e-mail.`;
  try {
    let r;
    if (process.env.BREVO_API_KEY) {
      r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: 'MindTrack AI', email: remetente }, to: [{ email, ...(nome ? { name: nome } : {}) }],
          subject: assunto, htmlContent: html({ nome, codigo, motivo }), textContent: texto,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } else {
      r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: `MindTrack AI <${remetente}>`, to: [email], subject: assunto, html: html({ nome, codigo, motivo }), text: texto }),
        signal: AbortSignal.timeout(15000),
      });
    }
    if (!r.ok) { console.error('e-mail do código', r.status, (await r.text()).slice(0, 200)); return 'falhou'; }
    return 'enviado';
  } catch (e) {
    console.error('e-mail do código', e.message);
    return 'falhou';
  }
}
