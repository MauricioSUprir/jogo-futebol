"use client";
// Anexar documento (PDF ou imagem, até 5 MB) a um registro. Vai para /api/documentos, que confere e cifra.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { classesBotao } from "../ui";

export function EnviarDocumento({ registroId, titulo }: { registroId: string; titulo: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [estado, setEstado] = useState<{ enviando?: boolean; erro?: string; ok?: string }>({});

  async function enviar(arquivo: File) {
    if (arquivo.size > 5 * 1024 * 1024) {
      setEstado({ erro: "O arquivo pode ter no máximo 5 MB." });
      return;
    }
    setEstado({ enviando: true });
    const fd = new FormData();
    fd.set("registroId", registroId);
    fd.set("arquivo", arquivo);
    try {
      const r = await fetch("/api/documentos", { method: "POST", body: fd, credentials: "same-origin" });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) setEstado({ erro: j.erro ?? "Não foi possível enviar." });
      else {
        setEstado({ ok: "Documento anexado." });
        router.refresh();
      }
    } catch {
      setEstado({ erro: "Sem conexão. Tente de novo." });
    } finally {
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={`Anexar documento a ${titulo}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} disabled={estado.enviando} className={classesBotao("fantasma", "p", "px-2")}>
        <Paperclip className="h-4 w-4" aria-hidden /> {estado.enviando ? "Enviando…" : "Anexar documento"}
      </button>
      {estado.erro && (
        <span role="alert" className="text-xs text-[#fda4af]">
          {estado.erro}
        </span>
      )}
      {estado.ok && (
        <span role="status" className="text-xs text-[#a7f3d0]">
          {estado.ok}
        </span>
      )}
    </div>
  );
}
