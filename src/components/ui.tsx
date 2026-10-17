import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Protocolo } from "../lib/types";

export function Botao({ carregando, variante = "primario", className = "", children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean; variante?: "primario" | "secundario" | "perigo" | "link" }) {
  const base = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed min-h-11";
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
      <input {...p} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-brand focus:outline-2 focus:outline-offset-1 focus:outline-brand" />
      {dica && <span className="mt-1 block text-xs text-slate-600">{dica}</span>}
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
  return <div className="flex items-center justify-center gap-2 p-8 text-slate-600"><Loader2 className="size-5 animate-spin" aria-hidden />{texto}</div>;
}

export function Selo({ status }: { status: Protocolo["status"] }) {
  if (status === "concluido") return <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">Concluído</span>;
  return status === "respondido"
    ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Respondido</span>
    : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Em análise</span>;
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
