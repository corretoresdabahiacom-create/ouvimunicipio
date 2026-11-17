import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { collection, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Carregando } from "../components/ui";

// O município vem do endereço (/itabuna). Tudo que é dele fica em municipios/{id}/… no Firestore.
export const PADRAO_ENV: string = (import.meta.env.VITE_MUNICIPIO_PADRAO as string | undefined) ?? "";
const RESERVADOS = ["superadmin", "api", "assets", "icons"];
const SLUG = /^[a-z0-9-]{2,40}$/;

let atual = "";
export const idMunicipio = () => atual;
function exigir(): string {
  if (!atual) throw new Error("Nenhum município selecionado.");
  return atual;
}
export const colM = (...seg: string[]) => collection(db, "municipios", exigir(), ...seg);
export const docM = (...seg: string[]) => doc(db, "municipios", exigir(), ...seg);

export type Rota = { tipo: "super" } | { tipo: "municipio"; slug: string } | { tipo: "raiz" };
export function rotaAtual(path = location.pathname): Rota {
  const p = path.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!p) return { tipo: "raiz" };
  if (p === "superadmin") return { tipo: "super" };
  if (SLUG.test(p) && !RESERVADOS.includes(p)) return { tipo: "municipio", slug: p };
  return { tipo: "raiz" };
}

export interface Municipio { id: string; nome: string; ativo: boolean; plano: string }
const Ctx = createContext<Municipio | null>(null);
export const useMunicipio = () => useContext(Ctx);

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="text-slate-700">{texto}</p>
    </main>
  );
}

export function MunicipioProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [m, setM] = useState<Municipio | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    atual = slug; // definido antes de qualquer tela usar o banco
    getDoc(doc(db, "municipios", slug))
      .then((s) => {
        if (!vivo) return;
        setM(s.exists() ? { id: slug, nome: String(s.get("nome")), ativo: s.get("ativo") === true, plano: String(s.get("plano") ?? "basico") } : null);
        try { if (s.exists()) localStorage.setItem("municipio", slug); } catch { /* ignore */ }
      })
      .catch(() => vivo && setM(null));
    return () => { vivo = false; };
  }, [slug]);

  if (m === undefined) return <Carregando />;
  if (!m) return <Mensagem titulo="Município não encontrado" texto="Confira o endereço. Cada prefeitura tem o seu, por exemplo: /nome-do-municipio." />;
  if (!m.ativo) return <Mensagem titulo="Atendimento temporariamente indisponível" texto={`O canal de ouvidoria de ${m.nome} está suspenso. Procure diretamente a prefeitura.`} />;
  return <Ctx.Provider value={m}>{children}</Ctx.Provider>;
}

// Endereço "/" : leva ao último município usado neste aparelho (ou ao padrão do projeto).
export function Raiz0() {
  let destino = "";
  try { destino = localStorage.getItem("municipio") ?? ""; } catch { /* ignore */ }
  destino = SLUG.test(destino) ? destino : PADRAO_ENV;
  useEffect(() => { if (destino) location.replace(`/${destino}`); }, [destino]);
  if (destino) return <Carregando />;
  return <Mensagem titulo="Ouvidoria municipal" texto="Acesse o endereço do seu município, por exemplo: /nome-do-municipio." />;
}
