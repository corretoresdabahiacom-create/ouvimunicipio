import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { colM, docM, idMunicipio } from "./municipio";

export interface SiteConfig { nome: string; cor: string; logo: string; contato: string }
export interface Anuncio { id: string; titulo: string; link: string; imagem: string; ativo: boolean; ordem: number }

export const PADRAO: SiteConfig = { nome: "Prefeitura Municipal", cor: "#0b3b8c", logo: "", contato: "" };
const chave = () => `ouvidoria-site-config:${idMunicipio()}`;

function lerCache(): SiteConfig {
  try { const s = localStorage.getItem(chave()); if (s) return { ...PADRAO, ...JSON.parse(s) }; } catch { /* sem cache */ }
  return PADRAO;
}
function gravarCache(c: SiteConfig) { try { localStorage.setItem(chave(), JSON.stringify(c)); } catch { /* ignore */ } }

// ----- cores -----
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Contraste da cor com texto branco (mínimo recomendado: 4,5). */
export function contrasteComBranco(hex: string): number { return 1.05 / (luminancia(hex) + 0.05); }
export function escurecer(hex: string, f = 0.25): string {
  const [r, g, b] = rgb(hex).map((v) => Math.round(v * (1 - f)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export const HEX_OK = /^#[0-9a-fA-F]{6}$/;

function aplicar(c: SiteConfig) {
  const raiz = document.documentElement;
  const cor = HEX_OK.test(c.cor) ? c.cor : PADRAO.cor;
  raiz.style.setProperty("--color-brand", cor);
  raiz.style.setProperty("--color-brand-dark", escurecer(cor));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", cor);
  document.title = `Ouvidoria – ${c.nome}`;
}

const Ctx = createContext<SiteConfig>(PADRAO);
export const useSite = () => useContext(Ctx);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<SiteConfig>(lerCache);

  useEffect(() => { aplicar(cfg); }, [cfg]);
  useEffect(() => {
    if (!idMunicipio()) return; // fora de um município (ex.: /superadmin) não há marca para carregar
    return onSnapshot(docM("config", "site"), (s) => {
    // sem conexão o Firestore devolve "inexistente" do cache local: nesse caso mantém a marca já conhecida
    if (s.metadata.fromCache && !s.exists()) return;
    const d = s.exists() ? { ...PADRAO, nome: s.get("nome") ?? PADRAO.nome, cor: s.get("cor") ?? PADRAO.cor, logo: s.get("logo") ?? "", contato: s.get("contato") ?? "" } : PADRAO;
    gravarCache(d); setCfg(d);
    }, () => undefined);
  }, []);

  return <Ctx.Provider value={cfg}>{children}</Ctx.Provider>;
}

export function useAnuncios(): Anuncio[] {
  const [lista, setLista] = useState<Anuncio[]>([]);
  useEffect(() => {
    // fora de um município (ex.: /superadmin) não há anúncios: sem isso a tela de login quebrava
    if (!idMunicipio()) return;
    getDocs(query(colM("anuncios"), where("ativo", "==", true)))
      .then((s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Anuncio).sort((a, b) => a.ordem - b.ordem)))
      .catch(() => setLista([]));
  }, []);
  return lista;
}

export function linkSeguro(l: string): string | null {
  try { const u = new URL(l); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}
