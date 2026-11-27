import type { Metadata } from "next";
import { Eye, Gift, Heart, ShieldCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { ListaDesejos, type ItemDesejo } from "@/components/desejos/lista-desejos";
import { FormPreferencias, type Preferencias } from "@/components/desejos/form-preferencias";

export const metadata: Metadata = { title: "Minha lista de desejos" };

export default async function PaginaListaDeDesejos() {
  const usuario = await exigirUsuario("/lista-de-desejos");
  const supabase = await clienteServidor();
  const [{ data: itens }, { data: prefs }, { count: grupos }] = await Promise.all([
    supabase
      .from("wishlist_items")
      .select("id, title, notes, url, image_path, price_estimate, position")
      .eq("user_id", usuario.id)
      .order("position")
      .order("created_at"),
    supabase
      .from("gift_preferences")
      .select("hobbies, interests, favorite_colors, shirt_size, pants_size, shoe_size, dislikes, notes")
      .eq("user_id", usuario.id)
      .maybeSingle(),
    supabase.from("participants").select("id", { count: "exact", head: true }).eq("user_id", usuario.id).eq("status", "approved"),
  ]);

  const preferencias: Preferencias = prefs ?? {
    hobbies: [],
    interests: [],
    favorite_colors: [],
    shirt_size: null,
    pants_size: null,
    shoe_size: null,
    dislikes: [],
    notes: null,
  };
  const lista: ItemDesejo[] = (itens ?? []).map((i) => ({ ...i, price_estimate: i.price_estimate === null ? null : Number(i.price_estimate) }));

  return (
    <div className="flex flex-col gap-6">
      <header className="vidro-forte relative overflow-hidden rounded-[2rem] p-5 sm:p-7">
        <div className="fita-ouro absolute inset-x-0 top-0 h-1" aria-hidden />
        <h1 className="flex items-center gap-2 font-titulo text-3xl font-semibold sm:text-4xl">
          <Gift className="size-8 text-t1" aria-hidden /> Minha lista de desejos
        </h1>
        <p className="mt-2 max-w-2xl text-suave">
          Ideias de presente, na sua ordem de preferência, e um pouco sobre você. Vale para todos os seus grupos: é a mesma lista
          em cada amigo oculto de que você participa.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <p className="flex items-start gap-2 rounded-2xl bg-white/50 px-3 py-2.5 text-sm dark:bg-white/5">
            <Eye className="mt-0.5 size-4 shrink-0 text-t1" aria-hidden />
            <span>
              <strong>Quem vê:</strong> as pessoas aprovadas nos seus grupos{grupos ? ` (você está em ${grupos})` : ""}. Quem te tirar usa a
              lista para escolher o presente.
            </span>
          </p>
          <p className="flex items-start gap-2 rounded-2xl bg-white/50 px-3 py-2.5 text-sm dark:bg-white/5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-esmeralda" aria-hidden />
            <span>
              Olhar a lista não entrega nada: ninguém fica sabendo quem tirou quem, e você não vê quem abriu a sua.
            </span>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section aria-labelledby="sec-presentes" className="min-w-0 lg:col-span-3">
          <Cartao>
            <TituloCartao icone={<Gift className="size-5" />} titulo={<span id="sec-presentes">Presentes que eu quero</span>} />
            <ListaDesejos itens={lista} />
          </Cartao>
        </section>
        <section aria-labelledby="sec-sobre" className="min-w-0 lg:col-span-2">
          <Cartao>
            <TituloCartao
              icone={<Heart className="size-5" />}
              titulo={<span id="sec-sobre">Sobre mim</span>}
              descricao="Gostos, cores, tamanhos e o que você prefere não ganhar."
            />
            <FormPreferencias inicial={preferencias} />
          </Cartao>
        </section>
      </div>
    </div>
  );
}
