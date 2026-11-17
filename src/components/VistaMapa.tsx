import { lazy, Suspense } from "react";
import { LEGENDA_MAPA, pontosDoMapa } from "../lib/pontos";
import type { Protocolo } from "../lib/types";
import { Carregando, Cartao } from "./ui";

const MapaOcorrencias = lazy(() => import("./Mapa").then((m) => ({ default: m.MapaOcorrencias })));

// Mapa dos protocolos (posição aproximada, ≈100 m). Só aparecem os que têm local informado pelo cidadão.
export function VistaMapa({ lista, abrir }: { lista: Protocolo[]; abrir: (id: string) => void }) {
  const pontos = pontosDoMapa(lista);
  return (
    <Cartao className="space-y-2">
      <p className="text-sm text-slate-700">
        {pontos.length} de {lista.length} protocolo{lista.length === 1 ? "" : "s"} com local informado. Posição aproximada (≈100 m). Toque num ponto para abrir.
      </p>
      <Suspense fallback={<Carregando texto="Abrindo o mapa…" />}>
        <MapaOcorrencias pontos={pontos} aoAbrir={abrir} />
      </Suspense>
      <ul className="flex flex-wrap gap-3 text-xs text-slate-700" aria-label="Legenda">
        {LEGENDA_MAPA.map(([cor, nome]) => (
          <li key={nome} className="flex items-center gap-1"><span className="inline-block size-3 rounded-full" style={{ background: cor }} aria-hidden />{nome}</li>
        ))}
      </ul>
    </Cartao>
  );
}
