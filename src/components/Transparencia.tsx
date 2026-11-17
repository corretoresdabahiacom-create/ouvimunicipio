import { useEffect, useState } from "react";
import { getDoc } from "firebase/firestore";
import { docM, useMunicipio } from "../lib/municipio";
import { useSite } from "../lib/useConfig";
import type { Estatisticas } from "../lib/types";
import { Aviso, Carregando, dataBR } from "./ui";
import { BotaoLibras, Logo } from "./Marca";
import { PainelNumeros } from "./Prefeito";

// Página pública (sem login): números da Ouvidoria do município, só se o administrador publicar.
// Nada de nomes, e-mails ou mensagens: é o mesmo resumo agregado que o prefeito vê.
export function PaginaTransparencia() {
  const m = useMunicipio();
  const site = useSite();
  const [e, setE] = useState<Estatisticas | null | undefined>(undefined);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    getDoc(docM("estatisticas", "atual"))
      .then((s) => setE(s.exists() ? (s.data() as Estatisticas) : null))
      .catch(() => { setFechado(true); setE(null); });
  }, []);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo tamanho="size-12" className="text-brand" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-brand">{site.nome}</h1>
            <p className="text-sm text-slate-700">Painel de transparência da Ouvidoria</p>
          </div>
        </div>
        <BotaoLibras />
      </header>
      <main id="conteudo" className="space-y-4">
        {e === undefined && <Carregando />}
        {fechado && <Aviso tipo="info">Este município ainda não publica o painel de transparência.</Aviso>}
        {e === null && !fechado && <Aviso tipo="info">Ainda não há números publicados.</Aviso>}
        {e && <>
          <p className="text-sm text-slate-700">Números consolidados das manifestações recebidas pela Ouvidoria (Lei nº 13.460/2017).
            Não há nomes nem conteúdo das mensagens. Atualizado em {dataBR(e.geradoEm)}.</p>
          <PainelNumeros e={e} />
        </>}
      </main>
      <footer className="space-y-2 border-t pt-4 text-sm">
        <a href={`/${m?.id ?? ""}`} className="font-medium text-brand underline">Fazer uma manifestação ou acompanhar meu protocolo</a>
        {site.contato && <p className="text-slate-600">Contato da Ouvidoria: {site.contato}</p>}
      </footer>
    </div>
  );
}
