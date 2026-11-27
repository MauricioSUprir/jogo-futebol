import "server-only";
import { after } from "next/server";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { clienteAdmin } from "@/lib/supabase/admin";
import { urlDoSite } from "@/lib/env";

/**
 * Entrega das notificações por e-mail e push. As notificações nascem no banco (internas, em tempo real); aqui o
 * servidor reivindica um lote (claim_notifications, com SKIP LOCKED: nunca entrega duas vezes) e envia pelos canais
 * que a pessoa autorizou. Sem provedor de e-mail ou sem chaves VAPID configuradas, o canal fica desligado (o status
 * vira "skipped") — nada finge ter enviado.
 *
 * E-mail: EMAIL_FROM + um destes: RESEND_API_KEY, BREVO_API_KEY ou SMTP_URL (smtp://usuario:senha@host:porta).
 * Push: NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (+ VAPID_SUBJECT, ex.: mailto:contato@seudominio).
 */

export function emailConfigurado(): boolean {
  return !!process.env.EMAIL_FROM && !!(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY || process.env.SMTP_URL);
}

export function pushConfigurado(): boolean {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function htmlDoEmail(titulo: string, corpo: string | null, link: string | null): string {
  const url = link ? `${urlDoSite()}${link}` : urlDoSite();
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f1e7;font-family:Arial,Helvetica,sans-serif;color:#1f2a24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #eadfca">
<tr><td style="background:linear-gradient(135deg,#b3172d,#0b6e4f);padding:22px 28px;color:#fff">
<div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#f5d27a">Amigo Oculto</div>
<div style="font-size:22px;font-weight:bold;margin-top:6px">${escapar(titulo)}</div></td></tr>
<tr><td style="padding:24px 28px;font-size:16px;line-height:1.5">${corpo ? `<p style="margin:0 0 20px">${escapar(corpo)}</p>` : ""}
<a href="${escapar(url)}" style="display:inline-block;background:#b3172d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">Abrir no Amigo Oculto</a>
<p style="margin:24px 0 0;font-size:12px;color:#6b7a70">Você recebe este e-mail porque participa de um amigo oculto. Para parar, desligue os e-mails em Minha conta → Notificações.</p>
</td></tr></table></td></tr></table></body></html>`;
}

let transporteSmtp: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function enviarEmail(para: string, assunto: string, html: string, texto: string): Promise<void> {
  const de = process.env.EMAIL_FROM!;
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: de, to: [para], subject: assunto, html, text: texto }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}`);
    return;
  }
  if (process.env.BREVO_API_KEY) {
    const m = /^(.*)<(.+)>$/.exec(de);
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: m ? { name: m[1].trim(), email: m[2].trim() } : { email: de },
        to: [{ email: para }],
        subject: assunto,
        htmlContent: html,
        textContent: texto,
      }),
    });
    if (!r.ok) throw new Error(`Brevo ${r.status}`);
    return;
  }
  if (process.env.SMTP_URL) {
    transporteSmtp ??= nodemailer.createTransport(process.env.SMTP_URL);
    await transporteSmtp.sendMail({ from: de, to: para, subject: assunto, html, text: texto });
    return;
  }
  throw new Error("nenhum provedor de e-mail configurado");
}

let vapidPronto = false;
function prepararVapid() {
  if (vapidPronto) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@amigo-oculto.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidPronto = true;
}

/** Entrega um lote. Devolve quantos e-mails e pushes saíram. */
export async function entregarNotificacoes(limite = 50): Promise<{ emails: number; pushes: number; falhas: number }> {
  const admin = clienteAdmin();
  const { data, error } = await admin.rpc("claim_notifications", { p_limit: limite });
  if (error) throw error;
  let emails = 0;
  let pushes = 0;
  let falhas = 0;
  const comEmail = emailConfigurado();
  const comPush = pushConfigurado();
  for (const n of data ?? []) {
    if (n.send_email) {
      let status: "sent" | "failed" | "skipped" = "skipped";
      if (comEmail && n.email) {
        try {
          await enviarEmail(n.email, n.title, htmlDoEmail(n.title, n.body, n.link), `${n.title}\n\n${n.body ?? ""}\n\n${urlDoSite()}${n.link ?? ""}`);
          status = "sent";
          emails++;
        } catch {
          status = "failed";
          falhas++;
        }
      }
      await admin.rpc("finish_notification_delivery", { p_id: n.id, p_channel: "email", p_status: status });
    }
    if (n.send_push) {
      let status: "sent" | "failed" | "skipped" = "skipped";
      if (comPush) {
        prepararVapid();
        const { data: inscricoes } = await admin.from("push_subscriptions").select("*").eq("user_id", n.user_id);
        let algum = false;
        for (const s of inscricoes ?? []) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ titulo: n.title, corpo: n.body, link: n.link ?? "/notificacoes", id: n.id }),
              { TTL: 60 * 60 * 24 },
            );
            algum = true;
          } catch (e) {
            const codigo = (e as { statusCode?: number }).statusCode;
            if (codigo === 404 || codigo === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
        status = algum ? "sent" : "failed";
        if (algum) pushes++;
        else falhas++;
      }
      await admin.rpc("finish_notification_delivery", { p_id: n.id, p_channel: "push", p_status: status });
    }
  }
  return { emails, pushes, falhas };
}

/** Entrega depois de responder (Next `after`), em ações que criam notificações. O cron é a rede de segurança. */
export function entregarEmSegundoPlano(): void {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SECRET_KEY) return;
  after(async () => {
    try {
      await entregarNotificacoes(50);
    } catch {
      // a notificação interna já está no banco; o cron tenta de novo
    }
  });
}
