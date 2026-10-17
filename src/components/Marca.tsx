import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Landmark } from "lucide-react";
import { linkSeguro, useAnuncios, useSite } from "../lib/useConfig";

export function Logo({ tamanho = "size-10", className = "" }: { tamanho?: string; className?: string }) {
  const { logo } = useSite();
  return logo
    ? <img src={logo} alt="" className={`${tamanho} shrink-0 object-contain ${className}`} />
    : <Landmark className={`${tamanho} shrink-0 ${className}`} aria-hidden />;
}

export function Cabecalho() {
  const { nome } = useSite();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Logo tamanho="size-8" className="rounded bg-white/10 p-0.5" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold">{nome}</p>
        <p className="text-[11px] opacity-80">Ouvidoria</p>
      </div>
    </div>
  );
}

export function Carrossel() {
  const anuncios = useAnuncios();
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const reduzir = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (anuncios.length < 2 || pausa || reduzir) return;
    const t = setInterval(() => setI((x) => (x + 1) % anuncios.length), 6000);
    return () => clearInterval(t);
  }, [anuncios.length, pausa, reduzir]);

  if (anuncios.length === 0) return null;
  const atual = anuncios[i % anuncios.length];
  const href = linkSeguro(atual.link);
  const img = <img src={atual.imagem} alt={atual.titulo} className="size-full object-cover" loading="lazy" />;

  return (
    <section aria-roledescription="carrossel" aria-label="Publicidade" className="relative"
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      <div className="aspect-[3/1] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
        {href
          ? <a href={href} target="_blank" rel="noopener noreferrer sponsored" aria-label={`${atual.titulo} (abre em nova aba)`} className="block size-full">{img}</a>
          : img}
      </div>
      <p className="mt-1 text-right text-[10px] uppercase tracking-wide text-slate-600">Publicidade</p>
      {anuncios.length > 1 && (
        <>
          <button aria-label="Anúncio anterior" onClick={() => setI((i - 1 + anuncios.length) % anuncios.length)}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white"><ChevronLeft className="size-4" /></button>
          <button aria-label="Próximo anúncio" onClick={() => setI((i + 1) % anuncios.length)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white"><ChevronRight className="size-4" /></button>
          <div className="absolute inset-x-0 bottom-6 flex justify-center gap-1.5">
            {anuncios.map((a, n) => (
              <button key={a.id} aria-label={`Anúncio ${n + 1}`} aria-current={n === i % anuncios.length} onClick={() => setI(n)}
                className={`size-2 rounded-full ${n === i % anuncios.length ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
