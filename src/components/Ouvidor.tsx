import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { AlertTriangle, BellRing, FileText, RefreshCw, Search, Send } from "lucide-react";
import { db } from "../lib/firebase";
import { colM, docM } from "../lib/municipio";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { publicarEstatisticas } from "../lib/estatisticas";
import { TIPOS, type Protocolo, type Secretaria } from "../lib/types";
import { Aviso, Botao, Cartao, Carregando, Selo, dataBR, nivelPrazo, rotuloPrazo } from "./ui";
import { ProtocoloDetalhe } from "./Conversa";
import { RelatorioGestao } from "./Relatorio";
import { VistaMapa } from "./VistaMapa";
import { sincronizarFicha } from "../lib/consulta";

const LIMITE_LEITURA = 1000; // protege a cota gratuita do Firestore

function useTodos() {
  const [lista, setLista] = useState<Protocolo[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => onSnapshot(query(colM("protocolos"), orderBy("criadoEm", "desc"), limit(LIMITE_LEITURA)),
    (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Protocolo)),
    (e) => { setErro(mensagemDeErro(e)); setLista([]); }), []);
  return { lista, erro };
}

function useSecretarias() {
  const [lista, setLista] = useState<Secretaria[]>([]);
  useEffect(() => onSnapshot(colM("secretarias"),
    (s) => setLista(s.docs.map((d) => ({ id: d.id, nome: String(d.data().nome), ativa: d.data().ativa === true }))
      .sort((a, b) => a.nome.localeCompare(b.nome))), () => setLista([])), []);
  return lista;
}

// ---------- encaminhar / cobrar ----------
function Acoes({ p, secretarias }: { p: Protocolo; secretarias: Secretaria[] }) {
  const { perfil } = useAuth();
  const [para, setPara] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const aberto = p.status === "aberto" || p.status === "respondido";
  const destinos = secretarias.filter((s) => s.ativa && s.id !== p.secretariaId);

  async function encaminhar(e: FormEvent) {
    e.preventDefault(); setErro(""); setOk("");
    const dest = secretarias.find((s) => s.id === para);
    if (!dest) return setErro("Escolha a secretaria de destino.");
    if (motivo.trim().length < 5) return setErro("Explique o motivo (mínimo 5 caracteres).");
    if (!perfil) return;
    setOcupado(true);
    try {
      const n = (p.encaminhamentos ?? 0) + 1;
      const lote = writeBatch(db);
      lote.update(docM("protocolos", p.id), { secretariaId: dest.id, secretariaNome: dest.nome, encaminhadoEm: serverTimestamp(), encaminhamentos: n });
      lote.set(docM("protocolos", p.id, "historico", `h${n}`), {
        de: p.secretariaId, deNome: p.secretariaNome, para: dest.id, paraNome: dest.nome,
        por: perfil.nome, motivo: motivo.trim(), criadoEm: serverTimestamp(),
      });
      await lote.commit();
      void sincronizarFicha(p.id);
      setPara(""); setMotivo(""); setOk(`Encaminhado para ${dest.nome}.`);
    } catch (err) { setErro(mensagemDeErro(err)); } finally { setOcupado(false); }
  }

  async function cobrar() {
    setErro(""); setOk(""); setOcupado(true);
    try {
      const lote = writeBatch(db);
      lote.update(docM("protocolos", p.id), { cobradoEm: serverTimestamp() });
      await lote.commit();
      setOk("Cobrança registrada. A secretaria verá o aviso no protocolo.");
    } catch (err) { setErro(mensagemDeErro(err)); } finally { setOcupado(false); }
  }

  return (
    <Cartao className="space-y-3">
      <h3 className="font-semibold">Ações da Ouvidoria</h3>
      <p className="text-sm text-slate-700">Você pode ler a conversa, mas não responde pelo setor. O cidadão e a secretaria veem o histórico de encaminhamentos.</p>
      {p.cobradoEm && <p className="text-sm text-slate-700">Última cobrança: {dataBR(p.cobradoEm)}</p>}
      {aberto ? (
        <form onSubmit={encaminhar} className="space-y-3">
          <label className="block"><span className="mb-1 block text-sm font-medium">Encaminhar para</span>
            <select value={para} onChange={(e) => setPara(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
              <option value="">Selecione…</option>
              {destinos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Motivo (visível à secretaria)</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" carregando={ocupado}><Send className="size-4" aria-hidden /> Encaminhar</Botao>
            {p.status === "aberto" && <Botao type="button" variante="secundario" onClick={cobrar} disabled={ocupado}><BellRing className="size-4" aria-hidden /> Cobrar resposta</Botao>}
          </div>
        </form>
      ) : <Aviso tipo="info">Protocolo concluído: não pode mais ser encaminhado.</Aviso>}
      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
    </Cartao>
  );
}

// ---------- painel ----------
export function PainelOuvidor() {
  const { perfil } = useAuth();
  const { lista, erro } = useTodos();
  const secretarias = useSecretarias();
  const [sel, setSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [fSec, setFSec] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPrazo, setFPrazo] = useState("");
  const [pub, setPub] = useState<{ ocupado: boolean; msg: string; erro: string }>({ ocupado: false, msg: "", erro: "" });
  const automatico = useRef(false);
  const [relatorio, setRelatorio] = useState(false);
  const [verMapa, setVerMapa] = useState(false);

  async function publicar(l: Protocolo[], manual: boolean) {
    if (!perfil) return;
    setPub({ ocupado: true, msg: "", erro: "" });
    try {
      await publicarEstatisticas(l, perfil.nome);
      setPub({ ocupado: false, msg: manual ? "Painel do prefeito atualizado." : "", erro: "" });
    } catch (e) { setPub({ ocupado: false, msg: "", erro: mensagemDeErro(e) }); }
  }
  // atualiza sozinho o resumo do prefeito, no máximo uma vez a cada 12 h, quando o ouvidor abre o painel
  useEffect(() => {
    if (!lista || automatico.current || !perfil) return;
    automatico.current = true;
    getDoc(docM("estatisticas", "atual")).then((s) => {
      const t = s.exists() ? (s.data().geradoEm?.toMillis?.() ?? 0) : 0;
      if (Date.now() - t > 12 * 3_600_000) void publicar(lista, false);
    }).catch(() => undefined);
  }, [lista]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(() => {
    if (!lista) return [];
    const b = busca.trim().toUpperCase();
    return lista.filter((p) =>
      (!b || p.numero.includes(b)) && (!fSec || p.secretariaId === fSec) && (!fTipo || p.tipo === fTipo) && (!fStatus || p.status === fStatus)
      && (!fPrazo || (p.status === "aberto" && (fPrazo === "vencido" ? nivelPrazo(p) === "vencido" : ["hoje", "dois", "cinco"].includes(nivelPrazo(p) ?? "")))));
  }, [lista, busca, fSec, fTipo, fStatus, fPrazo]);

  if (lista === null) return <Carregando />;
  const atual = sel ? lista.find((p) => p.id === sel) : null;
  if (atual) return <ProtocoloDetalhe p={atual} voltar={() => setSel(null)} eu="ouvidor" topo={<Acoes p={atual} secretarias={secretarias} />} />;

  const vencidos = lista.filter((p) => p.status === "aberto" && nivelPrazo(p) === "vencido").length;
  const sel_ = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Ouvidoria geral</h2>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => setVerMapa((v) => !v)} aria-expanded={verMapa}>
            {verMapa ? "Ver lista" : "Ver no mapa"}
          </Botao>
          <Botao variante="secundario" onClick={() => setRelatorio((v) => !v)} aria-expanded={relatorio}>
            <FileText className="size-4" aria-hidden /> Relatório de gestão
          </Botao>
          <Botao variante="secundario" onClick={() => publicar(lista, true)} carregando={pub.ocupado}>
            <RefreshCw className="size-4" aria-hidden /> Atualizar painel do prefeito
          </Botao>
        </div>
      </div>
      {relatorio && <RelatorioGestao lista={lista} limiteAtingido={lista.length >= LIMITE_LEITURA} responsavel={perfil?.nome ?? ""} />}
      {pub.msg && <Aviso tipo="ok">{pub.msg}</Aviso>}
      {pub.erro && <Aviso>{pub.erro}</Aviso>}
      {erro && <Aviso>{erro}</Aviso>}
      {lista.length >= LIMITE_LEITURA && <Aviso tipo="info">Mostrando os {LIMITE_LEITURA} protocolos mais recentes.</Aviso>}
      {vencidos > 0 && (
        <div role="alert" className="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{vencidos} protocolo{vencidos > 1 ? "s" : ""} sem resposta com o prazo vencido. Use o filtro “Vencidos” para cobrar os setores.</p>
        </div>
      )}
      <Cartao className="grid gap-2 sm:grid-cols-2">
        <label className="relative block sm:col-span-2"><span className="sr-only">Buscar pelo número do protocolo</span>
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Número do protocolo (OUV-…)" className={`${sel_} w-full pl-9`} /></label>
        <select aria-label="Secretaria" value={fSec} onChange={(e) => setFSec(e.target.value)} className={sel_}>
          <option value="">Todas as secretarias</option>{secretarias.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        <select aria-label="Tipo" value={fTipo} onChange={(e) => setFTipo(e.target.value)} className={sel_}>
          <option value="">Todos os tipos</option>{Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
        <select aria-label="Situação" value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={sel_}>
          <option value="">Todas as situações</option><option value="aberto">Aberto</option><option value="respondido">Respondido</option><option value="concluido">Concluído</option></select>
        <select aria-label="Prazo" value={fPrazo} onChange={(e) => setFPrazo(e.target.value)} className={sel_}>
          <option value="">Qualquer prazo</option><option value="vencido">Vencidos</option><option value="critico">Vencem em até 5 dias</option></select>
      </Cartao>
      <p className="text-sm text-slate-700">{filtrados.length} protocolo{filtrados.length === 1 ? "" : "s"}</p>
      {verMapa && <VistaMapa lista={filtrados} abrir={setSel} />}
      {!verMapa && filtrados.length === 0 && <Cartao><p className="text-slate-600">Nenhum protocolo com esses filtros.</p></Cartao>}
      {!verMapa && filtrados.slice(0, 100).map((p) => {
        const r = p.status === "aberto" ? rotuloPrazo(p) : null;
        return (
          <button key={p.id} onClick={() => setSel(p.id)} className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand">
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-600">{p.numero}</span><Selo status={p.status} /></div>
            <p className="mt-1 font-semibold">{TIPOS[p.tipo] ?? "Manifestação"} · {p.secretariaNome}</p>
            <p className="text-sm text-slate-700">Enviado em {dataBR(p.criadoEm)}{p.encaminhamentos ? ` · encaminhado ${p.encaminhamentos}×` : ""}</p>
            {r && <p className={`mt-1 text-xs ${r.classe}`}>{r.texto}</p>}
          </button>
        );
      })}
      {!verMapa && filtrados.length > 100 && <Aviso tipo="info">Mostrando 100 de {filtrados.length}. Refine os filtros.</Aviso>}
    </div>
  );
}
