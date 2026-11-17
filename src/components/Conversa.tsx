import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch, type WriteBatch,
} from "firebase/firestore";
import { ArrowLeft, MapPin, Paperclip, Send, Star, X } from "lucide-react";
import { db } from "../lib/firebase";
import { colM, docM } from "../lib/municipio";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { registrarEnvio } from "../lib/limite";
import { sincronizarFicha } from "../lib/consulta";
import {
  MAX_ANEXOS, MAX_TOTAL_BYTES, MAX_VIDEO_BYTES, comprimirImagem, dividirEmPartes, formatarBytes, juntarPartes, tipoDe,
} from "../lib/media";
import { APAGAR_APOS_DIAS, MAX_MENSAGENS, PRAZO_PRORROGACAO_DIAS, TIPOS, type AnexoMeta, type Encaminhamento, type Mensagem, type Modelo, type Protocolo } from "../lib/types";
import { Aviso, Botao, Cartao, Carregando, Selo, dataBR, nivelPrazo, prazoFinal, rotuloPrazo } from "./ui";

const DIA = 86_400_000;

// ---------- apagar conversa 30 dias depois de concluída ----------
export function apagarEm(p: Protocolo): Date | null {
  const c = p.concluidoEm?.toDate?.();
  return p.status === "concluido" && c ? new Date(c.getTime() + APAGAR_APOS_DIAS * DIA) : null;
}
export function conversaVencida(p: Protocolo): boolean {
  const d = apagarEm(p);
  return !!d && d.getTime() <= Date.now();
}

/** Apaga mensagens e mídias de um protocolo concluído há mais de 30 dias e marca como apagada. */
export async function apagarConversa(p: Protocolo): Promise<void> {
  if (!conversaVencida(p) || p.apagada) return;
  const [m, md] = await Promise.all([
    getDocs(colM("protocolos", p.id, "mensagens")),
    getDocs(colM("protocolos", p.id, "midias")),
  ]);
  const refs = [...m.docs, ...md.docs].map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const lote = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => lote.delete(r));
    await lote.commit();
  }
  await updateDoc(docM("protocolos", p.id), { apagada: true });
}

/** Limpeza silenciosa de até 3 conversas vencidas por abertura de lista. */
export function useLimpezaConversas(lista: Protocolo[] | null) {
  const feito = useRef(new Set<string>());
  useEffect(() => {
    if (!lista) return;
    lista.filter((p) => conversaVencida(p) && !p.apagada && !feito.current.has(p.id)).slice(0, 3).forEach((p) => {
      feito.current.add(p.id);
      void apagarConversa(p).catch(() => feito.current.delete(p.id));
    });
  }, [lista]);
}

// ---------- anexos ----------
interface Escolhido { file: File; tipo: "imagem" | "video" }

export function useAnexos() {
  const [arquivos, setArquivos] = useState<Escolhido[]>([]);
  const [erro, setErro] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function adicionar(lista: FileList | null) {
    if (!lista) return;
    setErro("");
    const novos: Escolhido[] = [];
    for (const file of Array.from(lista)) {
      const tipo = tipoDe(file);
      if (!tipo) { setErro(`"${file.name}": use imagem (JPG/PNG/WebP) ou vídeo (MP4/WebM).`); continue; }
      if (tipo === "video" && file.size > MAX_VIDEO_BYTES) { setErro(`"${file.name}": o vídeo deve ter até ${formatarBytes(MAX_VIDEO_BYTES)}. Grave um vídeo mais curto.`); continue; }
      novos.push({ file, tipo });
    }
    const todos = [...arquivos, ...novos];
    if (todos.length > MAX_ANEXOS) { setErro(`No máximo ${MAX_ANEXOS} anexos.`); return; }
    setArquivos(todos);
    if (inputRef.current) inputRef.current.value = "";
  }
  return { arquivos, erro, setErro, inputRef, adicionar, remover: (i: number) => setArquivos((a) => a.filter((_, j) => j !== i)), limpar: () => setArquivos([]) };
}

export function SeletorAnexos({ a }: { a: ReturnType<typeof useAnexos> }) {
  return (
    <div>
      <input ref={a.inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple hidden
        onChange={(e) => a.adicionar(e.target.files)} />
      <Botao type="button" variante="secundario" onClick={() => a.inputRef.current?.click()} disabled={a.arquivos.length >= MAX_ANEXOS}>
        <Paperclip className="size-4" aria-hidden /> Anexar foto ou vídeo
      </Botao>
      <p className="mt-1 text-xs text-slate-600">Até {MAX_ANEXOS} arquivos. Fotos são reduzidas automaticamente; vídeos até {formatarBytes(MAX_VIDEO_BYTES)} (curtos).</p>
      {a.erro && <div className="mt-2"><Aviso>{a.erro}</Aviso></div>}
      <ul className="mt-2 space-y-1">
        {a.arquivos.map((x, i) => (
          <li key={i} className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm">
            <span className="truncate">{x.tipo === "imagem" ? "🖼️" : "🎬"} {x.file.name} <span className="text-slate-600">({formatarBytes(x.file.size)})</span></span>
            <button type="button" aria-label={`Remover ${x.file.name}`} className="p-2" onClick={() => a.remover(i)}><X className="size-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Preparado { meta: AnexoMeta; partes: string[] }

/** Comprime imagens e divide tudo em partes. `msg` é o número da mensagem com 2 dígitos ("00"…"49"). */
export async function prepararAnexos(arquivos: Escolhido[], msg: string): Promise<Preparado[]> {
  const out: Preparado[] = [];
  let total = 0;
  for (let i = 0; i < arquivos.length; i++) {
    const { file, tipo } = arquivos[i];
    const blob = tipo === "imagem" ? await comprimirImagem(file) : file;
    total += blob.size;
    if (total > MAX_TOTAL_BYTES) throw new Error(`Os anexos somam mais de ${formatarBytes(MAX_TOTAL_BYTES)}. Remova algum.`);
    const partes = await dividirEmPartes(blob);
    out.push({
      meta: { k: `${msg}_${i}`, nome: file.name.slice(0, 100), tipo, mime: tipo === "imagem" ? "image/jpeg" : file.type, partes: partes.length, bytes: blob.size },
      partes,
    });
  }
  return out;
}

export function gravarMidias(lote: WriteBatch, numero: string, preparados: Preparado[]) {
  for (const p of preparados) {
    p.partes.forEach((data, idx) => {
      const k = `${p.meta.k}_${idx}`;
      lote.set(docM("protocolos", numero, "midias", k), { k, mime: p.meta.mime, data });
    });
  }
}

// ---------- mídias de uma mensagem ----------
function Midias({ numero, anexos }: { numero: string; anexos: AnexoMeta[] }) {
  const [itens, setItens] = useState<{ k: string; nome: string; tipo: string; url: string }[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    const urls: string[] = [];
    (async () => {
      try {
        const out: { k: string; nome: string; tipo: string; url: string }[] = [];
        for (const m of anexos) {
          const docs = await Promise.all(Array.from({ length: m.partes }, (_, i) => getDoc(docM("protocolos", numero, "midias", `${m.k}_${i}`))));
          if (docs.some((d) => !d.exists())) continue;
          const url = URL.createObjectURL(juntarPartes(docs.map((d) => d.get("data") as string), m.mime));
          urls.push(url); out.push({ k: m.k, nome: m.nome, tipo: m.tipo, url });
        }
        if (vivo) setItens(out);
      } catch { if (vivo) { setErro("Não foi possível carregar os anexos."); setItens([]); } }
    })();
    return () => { vivo = false; urls.forEach(URL.revokeObjectURL); };
  }, [numero, anexos]);

  if (itens === null) return <Carregando texto="Carregando anexos…" />;
  return (
    <div className="mt-2 space-y-2">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        {itens.map((m) => m.tipo === "imagem"
          ? <img key={m.k} src={m.url} alt={`Anexo: ${m.nome}`} className="max-h-72 w-full rounded-lg border bg-slate-100 object-contain" />
          : <video key={m.k} src={m.url} controls preload="metadata" aria-label={`Vídeo: ${m.nome}`} className="max-h-72 w-full rounded-lg border bg-black" />)}
      </div>
    </div>
  );
}

// ---------- mensagens ----------
export function useMensagens(p: Protocolo) {
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null);
  const [erro, setErro] = useState("");
  const ativa = !(p.apagada || conversaVencida(p));
  useEffect(() => {
    if (!ativa) { setMsgs([]); return; }
    return onSnapshot(colM("protocolos", p.id, "mensagens"),
      (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Mensagem).sort((a, b) => a.id.localeCompare(b.id))),
      (e) => { setErro(mensagemDeErro(e)); setMsgs([]); });
  }, [p.id, ativa]);
  return { msgs, erro, ativa };
}

function Balao({ m, numero, eu }: { m: Mensagem; numero: string; eu: "cidadao" | "servidor" | "ouvidor" }) {
  const minha = m.de === eu;
  const quem = m.de === "servidor" ? "Secretaria" : (eu === "cidadao" ? "Você" : "Cidadão");
  return (
    <li className={`flex ${minha ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] rounded-xl border p-3 ${m.de === "servidor" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-slate-50 text-slate-900"}`}>
        <p className="text-xs font-semibold">{quem} · <span className="font-normal">{dataBR(m.criadoEm)}</span></p>
        {m.assunto && <p className="mt-1 font-semibold">{m.assunto}</p>}
        <p className="mt-1 whitespace-pre-wrap">{m.texto}</p>
        {m.local && (
          <a className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline" target="_blank" rel="noreferrer"
            href={`https://www.openstreetmap.org/?mlat=${m.local.lat}&mlon=${m.local.lng}#map=18/${m.local.lat}/${m.local.lng}`}>
            <MapPin className="size-4" aria-hidden /> Ver o local informado no mapa
          </a>
        )}
        {m.anexos?.length > 0 && <Midias numero={numero} anexos={m.anexos} />}
      </div>
    </li>
  );
}

// Respostas-modelo da secretaria (só servidores da própria secretaria leem)
function useModelos(secretariaId: string | undefined, ativo: boolean) {
  const [lista, setLista] = useState<Modelo[]>([]);
  useEffect(() => {
    if (!ativo || !secretariaId) return;
    return onSnapshot(query(colM("modelos"), where("secretariaId", "==", secretariaId)),
      (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Modelo).sort((a, b) => a.titulo.localeCompare(b.titulo))),
      () => setLista([]));
  }, [secretariaId, ativo]);
  return lista;
}
export const aplicarModelo = (texto: string, p: Protocolo) =>
  texto.replaceAll("{numero}", p.numero).replaceAll("{secretaria}", p.secretariaNome);

// ---------- compositor (resposta / complemento) ----------
function Compositor({ p, proximo, eu }: { p: Protocolo; proximo: number; eu: "cidadao" | "servidor" }) {
  const { perfil } = useAuth();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const anexos = useAnexos();
  const modelos = useModelos(perfil?.secretariaId, eu === "servidor");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    if (texto.trim().length < 1) return setErro("Escreva a mensagem.");
    if (proximo >= MAX_MENSAGENS) return setErro("Esta conversa atingiu o limite de mensagens.");
    setErro(""); setOcupado(true);
    try {
      const idx = String(proximo).padStart(2, "0");
      const preparados = await prepararAnexos(anexos.arquivos, idx);
      const lote = writeBatch(db);
      lote.set(docM("protocolos", p.id, "mensagens", `m${idx}`), {
        de: eu, autorUid: perfil.uid, texto: texto.trim(), anexos: preparados.map((x) => x.meta), criadoEm: serverTimestamp(),
      });
      gravarMidias(lote, p.id, preparados);
      if (eu === "servidor") {
        lote.update(docM("protocolos", p.id), {
          status: "respondido", ultimaMsgPor: "servidor", ...(p.status === "aberto" ? { respondidoEm: serverTimestamp() } : {}),
        });
        lote.set(doc(colM("notificacoes")), {
          uid: p.autorUid, protocoloId: p.id, tipo: "resposta",
          mensagem: `Há uma nova resposta da secretaria no protocolo ${p.numero}. Atenção: este aviso será apagado em 24 horas. A conversa continua disponível no protocolo.`,
          criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 24 * 3600_000),
        });
      } else {
        await registrarEnvio(lote, perfil.uid, `${p.id}/m${idx}`);
        lote.update(docM("protocolos", p.id), { ultimaMsgPor: "cidadao" });
      }
      await lote.commit();
      if (eu === "servidor") void sincronizarFicha(p.id);
      setTexto(""); anexos.limpar();
    } catch (err) { setErro(mensagemDeErro(err)); }
    finally { setOcupado(false); }
  }

  return (
    <Cartao>
      <form onSubmit={enviar} className="space-y-3">
        <label className="block">
          {eu === "servidor" && modelos.length > 0 && (
            <select aria-label="Usar uma resposta-modelo" value="" className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(e) => { const m = modelos.find((x) => x.id === e.target.value); if (m) setTexto((t) => (t.trim() ? `${t.trimEnd()}\n\n` : "") + aplicarModelo(m.texto, p)); }}>
              <option value="">Inserir resposta-modelo…</option>
              {modelos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          )}
          <span className="mb-1 block text-sm font-medium">{eu === "servidor" ? "Sua resposta ao cidadão" : p.status === "aberto" ? "Complementar minha mensagem" : "Responder à secretaria"}</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={5000} required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
        </label>
        <SeletorAnexos a={anexos} />
        {eu === "servidor" && <Aviso tipo="info">O cidadão será avisado. O aviso some em 24 horas, mas a conversa fica no protocolo. Mensagens enviadas não podem ser alteradas.</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
        <Botao type="submit" carregando={ocupado}><Send className="size-4" aria-hidden /> Enviar</Botao>
      </form>
    </Cartao>
  );
}

// ---------- nota 1 a 5 ----------
function Estrelas({ valor, onChange, desativado }: { valor: number; onChange?: (n: number) => void; desativado?: boolean }) {
  return (
    <div role="group" aria-label="Nota do atendimento, de 1 a 5" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={desativado} onClick={() => onChange?.(n)} aria-pressed={valor === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
          className="rounded p-1.5 disabled:cursor-default">
          <Star className={`size-7 ${n <= valor ? "fill-amber-400 text-amber-500" : "text-slate-400"}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}

function Encerramento({ p, eu }: { p: Protocolo; eu: "cidadao" | "servidor" }) {
  const [nota, setNota] = useState(0);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const ref = docM("protocolos", p.id);

  async function concluir() {
    setErro(""); setOcupado(true);
    try {
      await updateDoc(ref, { status: "concluido", concluidoEm: serverTimestamp(), ...(eu === "cidadao" && nota ? { avaliacao: nota } : {}) });
      void sincronizarFicha(p.id);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  }
  async function avaliar() {
    setErro(""); setOcupado(true);
    try { await updateDoc(ref, { avaliacao: nota }); } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  }

  if (p.status === "aberto") return null;
  const apagar = apagarEm(p);
  return (
    <Cartao className="space-y-3">
      {p.status === "respondido" && (
        <>
          <h3 className="font-semibold">{eu === "cidadao" ? "Seu problema foi resolvido?" : "Encerrar atendimento"}</h3>
          {eu === "cidadao" && <>
            <p className="text-sm text-slate-700">Avalie o atendimento (opcional) e conclua. Se ainda precisar de algo, use o campo acima para responder.</p>
            <Estrelas valor={nota} onChange={setNota} />
          </>}
          {erro && <Aviso>{erro}</Aviso>}
          <Botao onClick={concluir} carregando={ocupado}>Concluir atendimento</Botao>
          <p className="text-xs text-slate-600">Ao concluir, a conversa e os anexos são apagados {APAGAR_APOS_DIAS} dias depois. Ficam apenas os dados do protocolo (número, secretaria, datas e nota), sem seu nome.</p>
        </>
      )}
      {p.status === "concluido" && (
        <>
          <p className="font-medium">Atendimento concluído em {dataBR(p.concluidoEm)}.</p>
          {apagar && <p className="text-sm text-slate-700">A conversa e os anexos serão apagados em {apagar.toLocaleDateString("pt-BR")}.</p>}
          {p.avaliacao ? <div><p className="text-sm">Nota do cidadão:</p><Estrelas valor={p.avaliacao} desativado /></div>
            : eu === "cidadao" && (
              <div className="space-y-2"><p className="text-sm">Como foi o atendimento?</p><Estrelas valor={nota} onChange={setNota} />
                {erro && <Aviso>{erro}</Aviso>}
                <Botao onClick={avaliar} disabled={!nota} carregando={ocupado}>Enviar nota</Botao></div>
            )}
        </>
      )}
    </Cartao>
  );
}

// ---------- prorrogação do prazo (Lei 13.460/2017, art. 16: uma única vez, com justificativa) ----------
function Prorrogacao({ p }: { p: Protocolo }) {
  const { perfil } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function prorrogar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    const m = motivo.trim();
    if (m.length < 10) return setErro("Explique o motivo (mínimo de 10 caracteres). O cidadão vai ler esta justificativa.");
    setErro(""); setOcupado(true);
    try {
      const lote = writeBatch(db);
      lote.update(docM("protocolos", p.id), { prorrogadoEm: serverTimestamp(), prorrogacaoMotivo: m, prorrogacaoPor: perfil.nome });
      lote.set(doc(colM("notificacoes")), {
        uid: p.autorUid, protocoloId: p.id, tipo: "prorrogacao",
        mensagem: `O prazo do protocolo ${p.numero} foi prorrogado por ${PRAZO_PRORROGACAO_DIAS} dias. Motivo informado pela secretaria: ${m}`,
        criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 30 * 86400_000),
      });
      await lote.commit();
      void sincronizarFicha(p.id);
      setAberto(false);
    } catch (err) { setErro(mensagemDeErro(err)); } finally { setOcupado(false); }
  }

  if (!aberto) return <Botao variante="secundario" onClick={() => setAberto(true)}>Prorrogar prazo (+{PRAZO_PRORROGACAO_DIAS} dias)</Botao>;
  return (
    <form onSubmit={prorrogar} className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm text-amber-950">A lei permite prorrogar <b>uma única vez</b>, por até {PRAZO_PRORROGACAO_DIAS} dias, com justificativa expressa. O cidadão será avisado e verá o motivo. Seu nome fica registrado.</p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Motivo da prorrogação</span>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={300} required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
      </label>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex gap-2">
        <Botao type="submit" carregando={ocupado}>Confirmar prorrogação</Botao>
        <Botao type="button" variante="link" onClick={() => { setAberto(false); setErro(""); }}>Cancelar</Botao>
      </div>
    </form>
  );
}

// ---------- detalhe do protocolo ----------
export function useHistorico(p: Protocolo) {
  const [lista, setLista] = useState<Encaminhamento[]>([]);
  const n = p.encaminhamentos ?? 0;
  useEffect(() => {
    if (!n) { setLista([]); return; }
    return onSnapshot(colM("protocolos", p.id, "historico"),
      (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Encaminhamento).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))),
      () => setLista([]));
  }, [p.id, n]);
  return lista;
}

export function ProtocoloDetalhe({ p, voltar, eu, topo }: { p: Protocolo; voltar: () => void; eu: "cidadao" | "servidor" | "ouvidor"; topo?: ReactNode }) {
  const historico = useHistorico(p);
  const { msgs, erro, ativa } = useMensagens(p);
  const prazo = prazoFinal(p);
  const rotulo = rotuloPrazo(p);
  const proximo = useMemo(() => (msgs && msgs.length ? Number(msgs[msgs.length - 1].id.slice(1)) + 1 : 0), [msgs]);
  const titulo = msgs?.[0]?.assunto ?? p.assunto ?? TIPOS[p.tipo] ?? "Manifestação";
  const legado = !!p.mensagem && (msgs?.length ?? 0) === 0;
  const aberto = p.status !== "concluido";

  let corpo: ReactNode;
  if (msgs === null) corpo = <Carregando />;
  else if (!ativa) corpo = <Aviso tipo="info">A conversa deste protocolo foi apagada {APAGAR_APOS_DIAS} dias após a conclusão, conforme a política de privacidade. Restam apenas os dados do protocolo.</Aviso>;
  else corpo = (
    <ul className="space-y-3" aria-live="polite">
      {legado && <>
        <li className="rounded-xl border bg-slate-50 p-3"><p className="whitespace-pre-wrap">{p.mensagem}</p></li>
        {p.resposta && <li className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-semibold">Secretaria</p><p className="whitespace-pre-wrap">{p.resposta}</p></li>}
      </>}
      {msgs.map((m) => <Balao key={m.id} m={m} numero={p.id} eu={eu} />)}
    </ul>
  );

  return (
    <div className="space-y-4">
      <Botao variante="link" onClick={voltar}><ArrowLeft className="size-4" aria-hidden /> Voltar</Botao>
      <Cartao className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-sm text-slate-600">{p.numero}</p>
            <h2 className="text-lg font-semibold">{titulo}</h2>
          </div>
          <Selo status={p.status} />
        </div>
        <dl className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
          <div><dt className="inline font-medium">Tipo: </dt><dd className="inline">{TIPOS[p.tipo] ?? "—"}</dd></div>
          <div><dt className="inline font-medium">Secretaria: </dt><dd className="inline">{p.secretariaNome}</dd></div>
          <div><dt className="inline font-medium">Enviado em: </dt><dd className="inline">{dataBR(p.criadoEm)}</dd></div>
          {p.status === "aberto" && prazo && rotulo && (
            <div><dt className="inline font-medium">Prazo de resposta: </dt>
              <dd className="inline">{prazo.toLocaleDateString("pt-BR")} · <span className={rotulo.classe}>{rotulo.texto.replace(/^Prazo: /, "")}</span></dd></div>
          )}
        </dl>
        {p.prorrogadoEm && (
          <Aviso tipo="info">
            <b>Prazo prorrogado</b> em {dataBR(p.prorrogadoEm)}{p.prorrogacaoPor ? ` por ${p.prorrogacaoPor}` : ""}, por mais {PRAZO_PRORROGACAO_DIAS} dias (a prorrogação só pode ser feita uma vez).
            {p.prorrogacaoMotivo && <> Motivo: {p.prorrogacaoMotivo}</>}
          </Aviso>
        )}
        {historico.length > 0 && (
          <Aviso tipo="info">
            <b>Encaminhado pela Ouvidoria:</b>
            <ul className="mt-1 list-disc pl-5">
              {historico.map((h) => <li key={h.id}>{dataBR(h.criadoEm)} · de {h.deNome} para <b>{h.paraNome}</b>{eu !== "cidadao" && <> (por {h.por}). Motivo: {h.motivo}</>}</li>)}
            </ul>
          </Aviso>
        )}
        {eu === "servidor" && p.status === "aberto" && p.cobradoEm && (
          <Aviso>A Ouvidoria cobrou uma resposta a este protocolo em {dataBR(p.cobradoEm)}.</Aviso>
        )}
        {eu === "servidor" && p.status === "aberto" && !p.prorrogadoEm && nivelPrazo(p) !== "vencido" && <Prorrogacao p={p} />}
        {erro && <Aviso>{erro}</Aviso>}
        {corpo}
      </Cartao>
      {topo}
      {eu !== "ouvidor" && aberto && ativa && msgs && (
        proximo >= MAX_MENSAGENS
          ? <Aviso tipo="info">Esta conversa atingiu o limite de {MAX_MENSAGENS} mensagens.</Aviso>
          : <Compositor p={p} proximo={proximo} eu={eu} />
      )}
      {eu !== "ouvidor" && <Encerramento p={p} eu={eu} />}
      {/* apagar manualmente não existe: a limpeza é automática */}
    </div>
  );
}
