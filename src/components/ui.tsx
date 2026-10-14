import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { juntarPartes } from "../lib/media";
import type { Protocolo } from "../lib/types";

export function Botao({ carregando, variante = "primario", className = "", children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean; variante?: "primario" | "secundario" | "perigo" | "link" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed min-h-11";
  const v = {
    primario: "bg-brand text-white hover:bg-brand-dark",
    secundario: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
    perigo: "bg-red-600 text-white hover:bg-red-700",
    link: "text-brand underline-offset-2 hover:underline px-1",
  }[variante];
  return (
    <button {...p} disabled={p.disabled || carregando} className={`${base} ${v} ${className}`}>
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}
    </button>
  );
}

export function Campo({ rotulo, dica, ...p }: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      <input {...p} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-brand focus:outline-none" />
      {dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}
    </label>
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "ok" | "info"; children: ReactNode }) {
  const cores = { erro: "bg-red-50 text-red-800 border-red-200", ok: "bg-emerald-50 text-emerald-800 border-emerald-200", info: "bg-blue-50 text-blue-900 border-blue-200" }[tipo];
  const Icone = tipo === "ok" ? CheckCircle2 : AlertCircle;
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`flex gap-2 rounded-lg border p-3 text-sm ${cores}`}>
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden /><div>{children}</div>
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return <div className="flex items-center justify-center gap-2 p-8 text-slate-500"><Loader2 className="size-5 animate-spin" aria-hidden />{texto}</div>;
}

export function Selo({ status }: { status: Protocolo["status"] }) {
  return status === "respondido"
    ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Respondido</span>
    : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Em análise</span>;
}

export function dataBR(t: { toDate?: () => Date } | null | undefined): string {
  return t?.toDate ? t.toDate().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "agora";
}

export function prazoFinal(p: Protocolo): Date | null {
  const d = p.criadoEm?.toDate?.();
  return d ? new Date(d.getTime() + 30 * 86400_000) : null;
}

export function diasRestantes(p: Protocolo): number | null {
  const f = prazoFinal(p);
  return f ? Math.ceil((f.getTime() - Date.now()) / 86400_000) : null;
}

// Mostra as mídias do protocolo, remontadas a partir das partes gravadas no Firestore.
export function Midias({ protocolo }: { protocolo: Protocolo }) {
  const [itens, setItens] = useState<{ k: string; nome: string; tipo: string; url: string }[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!protocolo.anexos?.length) { setItens([]); return; }
    let vivo = true;
    const urls: string[] = [];
    (async () => {
      try {
        const snap = await getDocs(collection(db, "protocolos", protocolo.id, "midias"));
        const porAnexo = new Map<string, { idx: number; data: string }[]>();
        snap.forEach((d) => {
          const [a, i] = d.id.split("_");
          porAnexo.set(a, [...(porAnexo.get(a) ?? []), { idx: Number(i), data: d.get("data") as string }]);
        });
        const out = protocolo.anexos.flatMap((m) => {
          const partes = (porAnexo.get(m.k) ?? []).sort((x, y) => x.idx - y.idx).map((x) => x.data);
          if (!partes.length) return [];
          const url = URL.createObjectURL(juntarPartes(partes, m.mime));
          urls.push(url);
          return [{ k: m.k, nome: m.nome, tipo: m.tipo, url }];
        });
        if (vivo) setItens(out);
      } catch { if (vivo) { setErro("Não foi possível carregar os anexos."); setItens([]); } }
    })();
    return () => { vivo = false; urls.forEach(URL.revokeObjectURL); };
  }, [protocolo.id, protocolo.anexos]);

  if (!protocolo.anexos?.length) return null;
  if (itens === null) return <Carregando texto="Carregando anexos…" />;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700">Anexos</h4>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        {itens.map((m) => m.tipo === "imagem"
          ? <img key={m.k} src={m.url} alt={m.nome} className="max-h-72 w-full rounded-lg border object-contain bg-slate-100" />
          : <video key={m.k} src={m.url} controls preload="metadata" className="max-h-72 w-full rounded-lg border bg-black" />)}
      </div>
    </div>
  );
}
