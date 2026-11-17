import type { Ponto } from "../components/Mapa";
import { TIPOS, type Protocolo } from "./types";
import { nivelPrazo } from "../components/ui";

// Cores do mapa: vermelho = sem resposta e vencido; laranja = aguardando resposta; azul = respondido; verde = concluído.
export const LEGENDA_MAPA: [string, string][] = [["#dc2626", "Vencido"], ["#d97706", "Aguardando resposta"], ["#2563eb", "Respondido"], ["#16a34a", "Concluído"]];

export function pontosDoMapa(lista: Protocolo[]): Ponto[] {
  return lista.filter((p) => p.regiao).map((p) => {
    const cor = p.status === "concluido" ? "#16a34a" : p.status === "respondido" ? "#2563eb"
      : nivelPrazo(p) === "vencido" ? "#dc2626" : "#d97706";
    return { id: p.id, lat: p.regiao!.lat, lng: p.regiao!.lng, cor, rotulo: `${p.numero} · ${TIPOS[p.tipo] ?? "Manifestação"} · ${p.secretariaNome}` };
  });
}
