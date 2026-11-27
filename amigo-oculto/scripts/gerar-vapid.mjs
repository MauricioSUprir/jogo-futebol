// Gera um par de chaves VAPID para as notificações push (Web Push). Uso: npm run vapid
// Copie as linhas para o .env.local (desenvolvimento) ou para as variáveis de ambiente da Vercel (produção).
// A chave pública vai para o navegador; a privada fica SÓ no servidor. Trocar as chaves invalida as inscrições antigas
// (cada pessoa precisa ativar o push de novo em Configurações).
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const webpush = require("web-push");
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:contato@seu-dominio.com.br");
