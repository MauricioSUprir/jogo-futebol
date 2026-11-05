/* ===== whatsapp.js — mensagem de boas-vindas no WhatsApp de quem cria a conta =====
   Usa a API oficial do WhatsApp (WhatsApp Cloud API, da Meta). Fica DESLIGADO até
   o dono colocar no Render:
     WHATSAPP_TOKEN        token de acesso do app no Meta for Developers
     WHATSAPP_NUMERO_ID    "Phone number ID" do número que envia
     WHATSAPP_TEMPLATE     nome do modelo aprovado (padrão: hello_world, o de teste da Meta)
     WHATSAPP_IDIOMA       idioma do modelo (padrão: en_US para o hello_world; pt_BR para os seus)
   Mensagem que a empresa começa precisa ser um MODELO aprovado pela Meta. O modelo
   "boas_vindas" sugerido tem um parâmetro: o primeiro nome da pessoa.            */

export const whatsappLigado = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_NUMERO_ID);

/** Número brasileiro → formato internacional sem símbolos (5511987654321). null se não parece número. */
export function normalizarTelefone(bruto) {
  let d = String(bruto || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;          // DDD + número
  if (!/^55\d{10,11}$/.test(d)) return null;
  return d;
}

export async function enviarBoasVindas({ telefone, nome }) {
  if (!whatsappLigado() || !telefone) return 'desligado';
  const template = process.env.WHATSAPP_TEMPLATE || 'hello_world';
  const idioma = process.env.WHATSAPP_IDIOMA || (template === 'hello_world' ? 'en_US' : 'pt_BR');
  const corpo = {
    messaging_product: 'whatsapp', to: telefone, type: 'template',
    template: {
      name: template, language: { code: idioma },
      ...(template === 'hello_world' ? {} : {
        components: [{ type: 'body', parameters: [{ type: 'text', text: String(nome || 'estudante').split(' ')[0].slice(0, 40) }] }],
      }),
    },
  };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_NUMERO_ID}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      console.error('WhatsApp recusou:', r.status, d?.error?.message || '');
      return 'falhou';
    }
    return 'enviado';
  } catch (e) {
    console.error('WhatsApp fora do ar:', e.message);
    return 'falhou';
  }
}
