import { describe, expect, it } from "vitest";
import { hotp, totp, conferirTotp, base32Codificar, base32Decodificar, gerarSegredo, uriOtpauth, gerarCodigosRecuperacao } from "@/lib/seguranca/totp";
import { gerarHashSenha, conferirSenha, HASH_FICTICIO, problemaNaSenha } from "@/lib/seguranca/senha";
import { cifrar, decifrar } from "@/lib/seguranca/cifra";
import { randomBytes } from "node:crypto";

describe("HOTP (RFC 4226, apêndice D)", () => {
  const chave = Buffer.from("12345678901234567890");
  const esperados = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  it("bate os 10 vetores", () => {
    esperados.forEach((c, i) => expect(hotp(chave, i)).toBe(c));
  });
});

describe("TOTP (RFC 6238, SHA-1, 8 dígitos)", () => {
  const seg = base32Codificar(Buffer.from("12345678901234567890"));
  const vetores: [number, string][] = [
    [59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"],
    [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"],
  ];
  it("bate os vetores da RFC", () => {
    for (const [t, c] of vetores) expect(totp(seg, t * 1000, 8)).toBe(c);
  });
});

describe("conferirTotp", () => {
  const seg = gerarSegredo();
  const t = 1_800_000_000_000;
  it("aceita o código atual e ±1 passo", () => {
    expect(conferirTotp(seg, totp(seg, t), t)).not.toBeNull();
    expect(conferirTotp(seg, totp(seg, t - 30_000), t)).not.toBeNull();
    expect(conferirTotp(seg, totp(seg, t + 30_000), t)).not.toBeNull();
  });
  it("recusa código fora da janela, mal formado e reutilizado", () => {
    expect(conferirTotp(seg, totp(seg, t - 90_000), t)).toBeNull();
    expect(conferirTotp(seg, "12345", t)).toBeNull();
    expect(conferirTotp(seg, "abcdef", t)).toBeNull();
    const passo = conferirTotp(seg, totp(seg, t), t)!;
    expect(conferirTotp(seg, totp(seg, t), t, passo)).toBeNull();
  });
  it("base32 ida e volta e URI", () => {
    const b = randomBytes(20);
    expect(base32Decodificar(base32Codificar(b)).equals(b)).toBe(true);
    expect(uriOtpauth("ABC", "joao")).toMatch(/^otpauth:\/\/totp\/LIFE%20OS%3Ajoao\?secret=ABC&issuer=LIFE\+OS/);
  });
  it("códigos de recuperação: 8, únicos, no formato XXXXX-XXXXX", () => {
    const c = gerarCodigosRecuperacao();
    expect(c).toHaveLength(8);
    expect(new Set(c).size).toBe(8);
    c.forEach((x) => expect(x).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/));
  });
});

describe("senha (scrypt)", () => {
  it("confere a certa e recusa a errada", async () => {
    const h = await gerarHashSenha("Uma senha boa 123");
    expect(h.startsWith("scrypt$17$8$1$")).toBe(true);
    expect(await conferirSenha("Uma senha boa 123", h)).toBe(true);
    expect(await conferirSenha("uma senha boa 123", h)).toBe(false);
    expect(await conferirSenha("x", HASH_FICTICIO)).toBe(false);
    expect(await conferirSenha("x", "lixo")).toBe(false);
  }, 20_000);
  it("regras de força", () => {
    expect(problemaNaSenha("curta1")).toMatch(/10/);
    expect(problemaNaSenha("somenteletras")).toMatch(/Misture/);
    expect(problemaNaSenha("senha-com-numero-1")).toBeNull();
    expect(problemaNaSenha("uma frase bem longa sem numeros")).toBeNull();
  });
});

describe("cifra AES-256-GCM", () => {
  const k = randomBytes(32);
  it("ida e volta, IV diferente a cada vez", () => {
    const a = cifrar("segredo", k);
    expect(a).not.toBe(cifrar("segredo", k));
    expect(decifrar(a, k)).toBe("segredo");
  });
  it("recusa texto adulterado ou chave errada", () => {
    const a = cifrar("segredo", k);
    const bruto = Buffer.from(a.slice(3), "base64");
    bruto[bruto.length - 1] ^= 1;
    expect(() => decifrar("v1:" + bruto.toString("base64"), k)).toThrow();
    expect(() => decifrar(a, randomBytes(32))).toThrow();
  });
});
