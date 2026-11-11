import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { TIPOS, type Contagem, type Estatisticas, type Protocolo } from "./types";
import { nivelPrazo, prazoFinal } from "../components/ui";

// Resumo agregado: SÓ NÚMEROS. Nenhum texto de cidadão, nome, e-mail, telefone ou número de protocolo entra aqui.
export type Resumo = Omit<Estatisticas, "geradoEm" | "geradoPor">;

const r1 = (n: number) => Math.round(n * 10) / 10;
// chaves de mapa não podem ter "." nem "/" no Firestore (campos); nomes de secretaria são trocados por segurança
const chave = (s: string) => s.replace(/[./~*[\]`]/g, " ").trim().slice(0, 80) || "(sem nome)";

export function calcularEstatisticas(lista: Protocolo[]): Resumo {
  const porStatus: Record<string, number> = {};
  const porTipo: Record<string, number> = {};
  const porSecretaria: Record<string, Contagem> = {};
  const porMes: Record<string, number> = {};
  let vencidas = 0, somaResp = 0, nResp = 0, dentro = 0, somaNota = 0, nNota = 0;

  for (const p of lista) {
    porStatus[p.status] = (porStatus[p.status] ?? 0) + 1;
    const tipo = p.tipo in TIPOS ? p.tipo : "outro";
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    const s = (porSecretaria[chave(p.secretariaNome)] ??= { total: 0, vencidas: 0, concluidas: 0 });
    s.total++;
    if (p.status === "concluido") s.concluidas++;
    const venc = p.status === "aberto" && nivelPrazo(p) === "vencido";
    if (venc) { vencidas++; s.vencidas++; }
    const criado = p.criadoEm?.toDate?.();
    if (criado) {
      const mes = `${criado.getFullYear()}-${String(criado.getMonth() + 1).padStart(2, "0")}`;
      porMes[mes] = (porMes[mes] ?? 0) + 1;
      const resp = p.respondidoEm?.toDate?.();
      if (resp) {
        nResp++; somaResp += (resp.getTime() - criado.getTime()) / 86_400_000;
        const limite = prazoFinal(p);
        if (limite && resp.getTime() <= limite.getTime()) dentro++;
      }
    }
    if (typeof p.avaliacao === "number") { somaNota += p.avaliacao; nNota++; }
  }
  // só os 24 meses mais recentes (limite das regras: 60)
  const meses = Object.keys(porMes).sort().slice(-24);
  return {
    total: lista.length, porStatus, porTipo, porSecretaria,
    porMes: Object.fromEntries(meses.map((m) => [m, porMes[m]])),
    vencidas,
    tempoMedioRespostaDias: nResp ? r1(somaResp / nResp) : 0,
    dentroPrazoPct: nResp ? Math.round((dentro / nResp) * 100) : 0,
    notaMedia: nNota ? r1(somaNota / nNota) : 0,
    avaliacoes: nNota,
  };
}

export async function publicarEstatisticas(lista: Protocolo[], nome: string) {
  await setDoc(doc(db, "estatisticas", "atual"), { ...calcularEstatisticas(lista), geradoEm: serverTimestamp(), geradoPor: nome });
}
