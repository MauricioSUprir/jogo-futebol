import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * "Exportar meus dados" (LGPD, art. 18): um JSON com o que a conta guarda sobre a própria pessoa. Tudo é lido com a
 * sessão dela (RLS), sempre filtrando pelo próprio id — nada de outras pessoas, e nada que revele o sorteio (quem tirou
 * quem só aparece para cada um na tela do próprio grupo).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await clienteServidor();
  const { data: sessao } = await supabase.auth.getUser();
  const usuario = sessao.user;
  if (!usuario) return NextResponse.json({ erro: "Entre na sua conta para exportar seus dados." }, { status: 401 });
  const uid = usuario.id;

  const [perfil, ajustes, preferencias, desejos, participacoes, chat, mural, capsulas, album, notificacoes, push] = await Promise.all([
    supabase.from("profiles").select("display_name, nickname, avatar_path, bio, is_guest, created_at, updated_at").eq("id", uid).maybeSingle(),
    supabase.from("user_settings").select("notify_email, notify_push, sound_effects, vibration, reduce_motion, color_mode, updated_at").eq("user_id", uid).maybeSingle(),
    supabase.from("gift_preferences").select("hobbies, interests, favorite_colors, shirt_size, pants_size, shoe_size, dislikes, notes, updated_at").eq("user_id", uid).maybeSingle(),
    supabase.from("wishlist_items").select("title, notes, url, image_path, price_estimate, position, created_at, updated_at").eq("user_id", uid).order("position"),
    supabase
      .from("participants")
      .select("role, status, rsvp, gift_bought, gift_bought_at, allow_public_reveal, result_viewed_at, join_message, created_at, approved_at, events!participants_event_id_fkey(id, name, theme, reveal_at, location, status, created_at, finished_at, archived_at)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false }),
    supabase.from("chat_messages").select("event_id, body, created_at, deleted_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(5000),
    supabase.from("wall_posts").select("event_id, body, color, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(5000),
    supabase.from("time_capsules").select("event_id, body, open_at, created_at").eq("user_id", uid).order("created_at", { ascending: false }),
    supabase.from("album_photos").select("event_id, storage_path, caption, width, height, created_at").eq("uploader_id", uid).order("created_at", { ascending: false }),
    supabase.from("notifications").select("kind, title, body, link, created_at, read_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(1000),
    supabase.from("push_subscriptions").select("user_agent, created_at").eq("user_id", uid),
  ]);

  const dados = {
    sobre: {
      gerado_em: new Date().toISOString(),
      aplicativo: "Amigo Oculto",
      observacao:
        "Dados da sua conta. Mensagens anônimas, palpites, quiz e cartões ficam dentro de cada grupo e são lidos pelas telas do grupo; o resultado do sorteio só aparece para você na sala de cada grupo.",
    },
    conta: {
      id: uid,
      email: usuario.email ?? null,
      convidado: !!usuario.is_anonymous,
      criada_em: usuario.created_at,
      ultimo_acesso: usuario.last_sign_in_at ?? null,
      formas_de_entrar: (usuario.identities ?? []).map((i) => i.provider),
    },
    perfil: perfil.data,
    configuracoes: ajustes.data,
    preferencias_de_presente: preferencias.data,
    lista_de_desejos: desejos.data ?? [],
    participacoes: (participacoes.data ?? []).map(({ events, ...p }) => ({ ...p, grupo: events })),
    mensagens_no_chat: chat.data ?? [],
    recados_no_mural: mural.data ?? [],
    capsulas_do_tempo: capsulas.data ?? [],
    fotos_no_album: album.data ?? [],
    notificacoes: notificacoes.data ?? [],
    aparelhos_com_push: push.data ?? [],
  };

  const dia = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="amigo-oculto-meus-dados-${dia}.json"`,
      "Cache-Control": "no-store, private",
    },
  });
}
