import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { MAX_SUSPENSAO_DIAS, PRAZO_DIAS, PRAZO_PRORROGACAO_DIAS, type Protocolo } from "../lib/types";

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

export type EtapaVisual = { texto: string; classe: string };
// Rótulo da situação. "Aberto" se desdobra em: aguardando informações, reaberto, em triagem ou em análise.
export function etapaRotulo(status: Protocolo["status"], p?: Partial<Protocolo>): EtapaVisual {
  if (status === "concluido") return { texto: "Concluído", classe: "bg-slate-200 text-slate-800" };
  if (status === "respondido") return { texto: "Respondido", classe: "bg-emerald-100 text-emerald-800" };
  if (p?.aguardandoDesde) return { texto: "Aguardando informações", classe: "bg-blue-100 text-blue-900" };
  if (p?.reabertoEm) return { texto: "Reaberto", classe: "bg-violet-100 text-violet-900" };
  if (p?.triagemEm) return { texto: "Em triagem", classe: "bg-sky-100 text-sky-900" };
  return { texto: "Em análise", classe: "bg-amber-100 text-amber-900" };
}
export function Selo({ status, p }: { status: Protocolo["status"]; p?: Partial<Protocolo> }) {
  const e = etapaRotulo(status, p);
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.classe}`}>{e.texto}</span>;
}

export function dataBR(t: { toDate?: () => Date } | null | undefined): string {
  return t?.toDate ? t.toDate().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "agora";
}

const DIA_MS = 86_400_000;

// Dias de espera pelo cidadão que entram no prazo: os já somados (suspensoDias) + a espera em andamento (no máximo 20).
export function diasSuspensos(p: Protocolo, agora = Date.now()): number {
  let d = p.suspensoDias ?? 0;
  const a = p.aguardandoDesde?.toDate?.();
  if (a && p.status === "aberto") d += Math.min(MAX_SUSPENSAO_DIAS, Math.max(0, Math.ceil((agora - a.getTime()) / DIA_MS)));
  return d;
}

// Prazo da manifestação: 30 dias a partir do envio (ou da reabertura), mais 30 se a secretaria prorrogou (uma única vez,
// com justificativa) e mais os dias em que o prazo ficou suspenso à espera de informações do cidadão.
export function prazoFinal(p: Protocolo, agora = Date.now()): Date | null {
  const d = (p.reabertoEm ?? p.criadoEm)?.toDate?.();
  return d ? new Date(d.getTime() + (PRAZO_DIAS + (p.prorrogadoEm ? PRAZO_PRORROGACAO_DIAS : 0) + diasSuspensos(p, agora)) * DIA_MS) : null;
}

export function diasRestantes(p: Protocolo): number | null {
  const f = prazoFinal(p);
  return f ? Math.ceil((f.getTime() - Date.now()) / DIA_MS) : null;
}

// Alertas de prazo: 10 dias, 5 dias, 2 dias, no dia do vencimento e depois de vencido.
export type NivelPrazo = "ok" | "dez" | "cinco" | "dois" | "hoje" | "vencido";
export function nivelPrazo(p: Protocolo, agora = Date.now()): NivelPrazo | null {
  const f = prazoFinal(p, agora);
  if (!f) return null;
  const ms = f.getTime() - agora;
  if (ms < 0) return "vencido";
  if (ms < DIA_MS) return "hoje";
  if (ms <= 2 * DIA_MS) return "dois";
  if (ms <= 5 * DIA_MS) return "cinco";
  if (ms <= 10 * DIA_MS) return "dez";
  return "ok";
}

export function rotuloPrazo(p: Protocolo): { texto: string; classe: string; urgente: boolean } | null {
  const n = nivelPrazo(p);
  if (!n) return null;
  const d = diasRestantes(p) ?? 0;
  const prorrog = p.prorrogadoEm ? " (prorrogado)" : "";
  switch (n) {
    case "vencido": return { texto: `Prazo vencido${prorrog}`, classe: "font-semibold text-red-800", urgente: true };
    case "hoje": return { texto: `Vence hoje${prorrog}`, classe: "font-semibold text-red-800", urgente: true };
    case "dois": return { texto: `Vence em até 2 dias${prorrog}`, classe: "font-semibold text-red-800", urgente: true };
    case "cinco": return { texto: `Vence em até 5 dias${prorrog}`, classe: "font-semibold text-orange-800", urgente: true };
    case "dez": return { texto: `Vence em até 10 dias${prorrog}`, classe: "font-medium text-amber-800", urgente: false };
    default: return { texto: `Prazo: ${d} dias${prorrog}`, classe: "text-slate-700", urgente: false };
  }
}

// Volta para a tela anterior. Se a pessoa chegou direto (link, QR Code), leva para "destino".
export function BotaoVoltar({ destino, onClick, claro = false }: { destino?: string; onClick?: () => void; claro?: boolean }) {
  function voltar() {
    if (onClick) return onClick();
    let veioDoSite = false;
    try { veioDoSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch { /* ignore */ }
    if (veioDoSite && history.length > 1) history.back();
    else location.assign(destino ?? "/");
  }
  return (
    <button type="button" onClick={voltar}
      className={`inline-flex items-center gap-1 rounded px-2 py-1.5 text-sm font-medium ${claro ? "hover:bg-white/10" : "text-brand hover:bg-slate-100"}`}>
      <ArrowLeft className="size-4" aria-hidden /> Voltar
    </button>
  );
}
