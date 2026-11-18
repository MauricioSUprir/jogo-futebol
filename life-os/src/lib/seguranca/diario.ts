// Chave do diário (Mind Center).
// Sem senha extra: as entradas são cifradas com a chave do servidor (LIFEOS_ENCRYPTION_KEY).
// Com senha extra: a chave sai da senha por scrypt (N = 2^17, r = 8, p = 1, como as senhas da conta); o banco guarda
// só o sal e um verificador (um texto conhecido cifrado com essa chave), nunca a senha nem a chave.
// Destrancado, a chave viaja num cookie httpOnly cifrado com a chave do SERVIDOR, preso ao usuário e com validade.
import { randomBytes, scrypt as scryptCb, type ScryptOptions } from "node:crypto";
import { cifrar, decifrar } from "./cifra";

const LOG_N = 17;
const R = 8;
const P = 1;
const VERIFICADOR = "life-os:diario:v1";
export const COOKIE_DIARIO = "lifeos_diario";
export const MINUTOS_DESTRANCADO = 15;

const scrypt = (senha: string, sal: Buffer, opcoes: ScryptOptions) =>
  new Promise<Buffer>((ok, erro) => scryptCb(senha, sal, 32, opcoes, (e, chave) => (e ? erro(e) : ok(chave))));

export function novoSal(): string {
  return randomBytes(16).toString("base64");
}

/** Chave AES-256 a partir da senha do diário e do sal guardado. */
export async function chaveDaSenha(senha: string, salB64: string): Promise<Buffer> {
  const N = 2 ** LOG_N;
  return scrypt(senha.normalize("NFKC"), Buffer.from(salB64, "base64"), { N, r: R, p: P, maxmem: 256 * N * R + 1024 * 1024 });
}

export function criarVerificador(chave: Buffer): string {
  return cifrar(VERIFICADOR, chave);
}

/** A chave confere com o verificador guardado? (AES-GCM: chave errada falha na autenticação.) */
export function chaveConfere(verificador: string, chave: Buffer): boolean {
  try {
    return decifrar(verificador, chave) === VERIFICADOR;
  } catch {
    return false;
  }
}

/** Valor do cookie: a chave do diário cifrada com a chave do servidor, presa ao usuário e com validade. */
export function embrulharChave(userId: string, chave: Buffer, agora = Date.now()): string {
  return cifrar(JSON.stringify({ u: userId, k: chave.toString("base64"), exp: agora + MINUTOS_DESTRANCADO * 60_000 }));
}

/** Abre o cookie; null se não for deste usuário, se venceu ou se foi adulterado. */
export function desembrulharChave(valor: string | undefined, userId: string, agora = Date.now()): Buffer | null {
  if (!valor) return null;
  try {
    const d = JSON.parse(decifrar(valor)) as { u?: string; k?: string; exp?: number };
    if (d.u !== userId || typeof d.k !== "string" || typeof d.exp !== "number" || d.exp < agora) return null;
    const k = Buffer.from(d.k, "base64");
    return k.length === 32 ? k : null;
  } catch {
    return null;
  }
}
