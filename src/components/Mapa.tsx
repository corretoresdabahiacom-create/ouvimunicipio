import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordenada } from "../lib/types";

// Mapas com OpenStreetMap (gratuito, com atribuição obrigatória). Carregado sob demanda (lazy).
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUICAO = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const BRASIL: L.LatLngTuple = [-14.2, -51.9];

function novoMapa(el: HTMLElement, centro: L.LatLngTuple, zoom: number) {
  const m = L.map(el, { center: centro, zoom, scrollWheelZoom: false });
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATRIBUICAO }).addTo(m);
  return m;
}

export interface Ponto { id: string; lat: number; lng: number; cor: string; rotulo: string }

// Mapa de ocorrências (ouvidor e secretaria). Pontos aproximados (≈100 m): nunca o endereço exato.
export function MapaOcorrencias({ pontos, aoAbrir }: { pontos: Ponto[]; aoAbrir: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);
  const abrir = useRef(aoAbrir);
  abrir.current = aoAbrir;

  useEffect(() => {
    if (!ref.current) return;
    mapa.current = novoMapa(ref.current, BRASIL, 4);
    camada.current = L.layerGroup().addTo(mapa.current);
    return () => { mapa.current?.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    const m = mapa.current, c = camada.current;
    if (!m || !c) return;
    c.clearLayers();
    for (const p of pontos) {
      L.circleMarker([p.lat, p.lng], { radius: 8, color: "#ffffff", weight: 2, fillColor: p.cor, fillOpacity: 0.9 })
        .bindTooltip(p.rotulo)
        .on("click", () => abrir.current(p.id))
        .addTo(c);
    }
    if (pontos.length) m.fitBounds(L.latLngBounds(pontos.map((p) => [p.lat, p.lng] as L.LatLngTuple)).pad(0.2), { maxZoom: 16 });
  }, [pontos]);

  return <div ref={ref} role="region" aria-label="Mapa das ocorrências" className="h-96 w-full rounded-xl border" />;
}

// Escolha do local pelo cidadão: toque no mapa para marcar (ou o ponto do GPS, que pode ser ajustado).
export function SeletorLocal({ valor, onChange }: { valor: Coordenada | null; onChange: (c: Coordenada) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marca = useRef<L.CircleMarker | null>(null);
  const muda = useRef(onChange);
  muda.current = onChange;

  useEffect(() => {
    if (!ref.current) return;
    const m = novoMapa(ref.current, valor ? [valor.lat, valor.lng] : BRASIL, valor ? 17 : 4);
    m.on("click", (e: L.LeafletMouseEvent) => muda.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapa.current = m;
    return () => { m.remove(); mapa.current = null; marca.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current;
    if (!m || !valor) return;
    if (!marca.current) marca.current = L.circleMarker([valor.lat, valor.lng], { radius: 10, color: "#ffffff", weight: 3, fillColor: "#dc2626", fillOpacity: 1 }).addTo(m);
    else marca.current.setLatLng([valor.lat, valor.lng]);
    if (m.getZoom() < 15) m.setView([valor.lat, valor.lng], 17);
  }, [valor]);

  return <div ref={ref} role="application" aria-label="Mapa: toque para marcar o local" className="h-72 w-full rounded-lg border" />;
}
