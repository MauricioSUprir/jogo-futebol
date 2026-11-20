// TOTP (RFC 6238) e HOTP (RFC 4226) com HMAC-SHA1 — compatível com Google Authenticator,
// Apple Senhas, Authy, 1Password etc. Funções puras, testadas com os vetores das RFCs.
import { createHmac, randomBytes } from "node:crypto";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Codificar(buf: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = "";
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

export function base32Decodificar(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const c of limpo) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) throw new Error("Segredo base32 inválido");
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function gerarSegredo(): string {
  return base32Codificar(randomBytes(20));
}

export function hotp(chave: Buffer, contador: number, digitos = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const mac = createHmac("sha1", chave).update(msg).digest();
  const o = mac[mac.length - 1] & 15;
  const bin = ((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(bin % 10 ** digitos).padStart(digitos, "0");
}

export const PASSO_S = 30;

export function passoDe(tempoMs: number): number {
  return Math.floor(tempoMs / 1000 / PASSO_S);
}

export function totp(segredo: string, tempoMs: number, digitos = 6): string {
  return hotp(base32Decodificar(segredo), passoDe(tempoMs), digitos);
}

/**
 * Confere um código com tolerância de ±1 passo (relógio do celular um pouco adiantado/atrasado).
 * Devolve o passo aceito, ou null. Passos ≤ ultimoPasso são recusados (o mesmo código não vale duas vezes).
 */
export function conferirTotp(
  segredo: string,
  codigo: string,
  tempoMs: number,
  ultimoPasso: number | null = null,
  janela = 1,
): number | null {
  const limpo = codigo.replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpo)) return null;
  const chave = base32Decodificar(segredo);
  const atual = passoDe(tempoMs);
  for (let d = -janela; d <= janela; d++) {
    const passo = atual + d;
    if (ultimoPasso !== null && passo <= ultimoPasso) continue;
    if (hotp(chave, passo) === limpo) return passo;
  }
  return null;
}

export function uriOtpauth(segredo: string, conta: string, emissor = "LIFE OS"): string {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  const q = new URLSearchParams({ secret: segredo, issuer: emissor, algorithm: "SHA1", digits: "6", period: String(PASSO_S) });
  return `otpauth://totp/${rotulo}?${q.toString()}`;
}

/** Códigos de recuperação legíveis, sem caracteres que se confundem (0/O, 1/I/L). */
export function gerarCodigosRecuperacao(qtd = 8): string[] {
  const alfa = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const codigos: string[] = [];
  for (let i = 0; i < qtd; i++) {
    const b = randomBytes(10);
    let s = "";
    for (let j = 0; j < 10; j++) s += alfa[b[j] % alfa.length];
    codigos.push(`${s.slice(0, 5)}-${s.slice(5)}`);
  }
  return codigos;
}

export function normalizarCodigoRecuperacao(c: string): string {
  return c.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
