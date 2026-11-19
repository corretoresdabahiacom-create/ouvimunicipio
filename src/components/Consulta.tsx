import { useState, type FormEvent } from "react";
import { getDoc } from "firebase/firestore";
import { Search } from "lucide-react";
import { docM, useMunicipio } from "../lib/municipio";
import { useSite } from "../lib/useConfig";
import type { FichaConsulta, Protocolo } from "../lib/types";
import { Aviso, BotaoVoltar, Botao, Cartao, Selo, dataBR, prazoFinal, rotuloPrazo } from "./ui";
import { BotaoLibras, Logo } from "./Marca";

const FORMATO = /^OUV-\d{4}-[A-Z0-9]{8}$/;

// Consulta pública (sem login): só situação, secretaria e datas. Quem tem o número consulta; ninguém lista.
export function PaginaConsulta() {
  const m = useMunicipio();
  const site = useSite();
  const inicial = decodeURIComponent(location.pathname.split("/").filter(Boolean)[2] ?? "").toUpperCase();
  const [numero, setNumero] = useState(inicial);
  const [ficha, setFicha] = useState<FichaConsulta | null>(null);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function consultar(e?: FormEvent) {
    e?.preventDefault();
    const n = numero.trim().toUpperCase();
    setFicha(null); setMsg("");
    if (!FORMATO.test(n)) return setMsg("Confira o número. O formato é OUV-2026-XXXXXXXX.");
    setOcupado(true);
    try {
      const s = await getDoc(docM("consulta", n));
      if (s.exists()) setFicha(s.data() as FichaConsulta);
      else setMsg("Protocolo não encontrado. Confira o número (letras e números) e o município do endereço.");
    } catch { setMsg("Não foi possível consultar agora. Verifique a conexão e tente de novo."); }
    finally { setOcupado(false); }
  }

  const comoProtocolo = ficha ? ({ ...ficha, tipo: ficha.lai ? "lai" : undefined } as unknown as Protocolo) : null;
  const prazo = comoProtocolo && ficha?.status === "aberto" ? rotuloPrazo(comoProtocolo) : null;
  return (
    <div className="mx-auto min-h-dvh max-w-xl space-y-4 p-4">
      <BotaoVoltar destino={`/${m?.id ?? ""}`} />
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo tamanho="size-12" className="text-brand" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-brand">{site.nome}</h1>
            <p className="text-sm text-slate-700">Consultar protocolo da Ouvidoria</p>
          </div>
        </div>
        <BotaoLibras />
      </header>
      <main id="conteudo" className="space-y-4">
        <Cartao>
          <form onSubmit={consultar} className="space-y-3">
            <label className="block"><span className="mb-1 block text-sm font-medium">Número do protocolo</span>
              <input value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())} placeholder="OUV-2026-XXXXXXXX" autoComplete="off" spellCheck={false}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-base uppercase" /></label>
            <Botao type="submit" carregando={ocupado}><Search className="size-4" aria-hidden /> Consultar</Botao>
          </form>
        </Cartao>
        {msg && <Aviso>{msg}</Aviso>}
        {ficha && (
          <Cartao className="space-y-2">
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{numero.trim().toUpperCase()}</span><Selo status={ficha.status} p={comoProtocolo ?? undefined} /></div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-600">Secretaria</dt><dd>{ficha.secretariaNome}</dd>
              <dt className="text-slate-600">Enviado em</dt><dd>{dataBR(ficha.criadoEm)}</dd>
              {comoProtocolo && prazoFinal(comoProtocolo) && <><dt className="text-slate-600">Prazo de resposta</dt>
                <dd>{prazoFinal(comoProtocolo)!.toLocaleDateString("pt-BR")}{ficha.prorrogadoEm ? " (prorrogado)" : ""}</dd></>}
              {ficha.respondidoEm && <><dt className="text-slate-600">1ª resposta em</dt><dd>{dataBR(ficha.respondidoEm)}</dd></>}
              {ficha.concluidoEm && <><dt className="text-slate-600">Concluído em</dt><dd>{dataBR(ficha.concluidoEm)}</dd></>}
            </dl>
            {prazo && <p className={`text-sm ${prazo.classe}`}>{prazo.texto}</p>}
            <p className="text-xs text-slate-600">Por segurança, esta consulta não mostra o conteúdo. Para ler as respostas, entre com sua conta.</p>
          </Cartao>
        )}
      </main>
      <footer className="border-t pt-4 text-sm">
        <a href={`/${m?.id ?? ""}`} className="font-medium text-brand underline">Entrar para ver a conversa ou fazer uma manifestação</a>
      </footer>
    </div>
  );
}
