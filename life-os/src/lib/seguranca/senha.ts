// Hash de senha com scrypt (node:crypto), parâmetros da OWASP: N = 2^17, r = 8, p = 1.
// Formato guardado: "scrypt$<log2 N>$<r>$<p>$<sal base64>$<hash base64>".
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (senha: string, sal: Buffer, tamanho: number, opcoes: ScryptOptions) =>
  new Promise<Buffer>((ok, erro) =>
    scryptCb(senha, sal, tamanho, opcoes, (e, chave) => (e ? erro(e) : ok(chave))),
  );

const LOG_N = 17;
const R = 8;
const P = 1;
const TAMANHO = 32;

function opcoes(logN: number, r: number, p: number): ScryptOptions {
  const N = 2 ** logN;
  return { N, r, p, maxmem: 256 * N * r + 1024 * 1024 };
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha.normalize("NFKC"), sal, TAMANHO, opcoes(LOG_N, R, P));
  return ["scrypt", LOG_N, R, P, sal.toString("base64"), hash.toString("base64")].join("$");
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, logN, r, p, salB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, "base64");
  const hash = await scrypt(
    senha.normalize("NFKC"),
    Buffer.from(salB64, "base64"),
    esperado.length,
    opcoes(Number(logN), Number(r), Number(p)),
  );
  return hash.length === esperado.length && timingSafeEqual(hash, esperado);
}

/** Hash que nunca confere: gasta o mesmo tempo quando o usuário não existe (não entrega quem existe). */
export const HASH_FICTICIO =
  "scrypt$17$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export function problemaNaSenha(senha: string): string | null {
  if (senha.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (senha.length > 200) return "A senha pode ter no máximo 200 caracteres.";
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(senha)).length;
  if (tipos < 2 && senha.length < 16) return "Misture letras e números (ou use uma frase com 16+ caracteres).";
  return null;
}
