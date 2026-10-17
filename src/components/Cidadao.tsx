import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { collection, doc, getDocs, onSnapshot, query, where, writeBatch, serverTimestamp, Timestamp, deleteDoc } from "firebase/firestore";
import { Paperclip, X, Send, ArrowLeft, Bell, Clock } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import {
  MAX_ANEXOS, MAX_TOTAL_BYTES, MAX_VIDEO_BYTES, tipoDe, comprimirImagem, dividirEmPartes, formatarBytes,
} from "../lib/media";
import type { AnexoMeta, Notificacao, Protocolo, Secretaria } from "../lib/types";
import { Aviso, Botao, Campo, Cartao, Carregando, Midias, Selo, dataBR, diasRestantes, prazoFinal } from "./ui";

function gerarNumero(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(8));
  return `OUV-${new Date().getFullYear()}-${Array.from(b, (x) => alfabeto[x % alfabeto.length]).join("")}`;
}

// ---------- Nova mensagem ----------
interface Escolhido { file: File; tipo: "imagem" | "video" }

export function NovaMensagem({ aoConcluir }: { aoConcluir: (numero: string) => void }) {
  const { perfil } = useAuth();
  const [secs, setSecs] = useState<Secretaria[] | null>(null);
  const [secId, setSecId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [arquivos, setArquivos] = useState<Escolhido[]>([]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDocs(query(collection(db, "secretarias"), where("ativa", "==", true)))
      .then((s) => setSecs(s.docs.map((d) => ({ id: d.id, nome: d.get("nome"), ativa: true })).sort((a, b) => a.nome.localeCompare(b.nome))))
      .catch((e) => { setErro(mensagemDeErro(e)); setSecs([]); });
  }, []);

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

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    setErro("");
    const sec = secs?.find((s) => s.id === secId);
    if (!sec) return setErro("Escolha a secretaria.");
    if (assunto.trim().length < 3) return setErro("Escreva um assunto.");
    if (mensagem.trim().length < 3) return setErro("Escreva sua mensagem.");

    setOcupado(true);
    try {
      // 1) prepara anexos (imagens são comprimidas; tudo é dividido em partes)
      const preparados: { meta: AnexoMeta; partes: string[] }[] = [];
      let total = 0;
      for (let i = 0; i < arquivos.length; i++) {
        const { file, tipo } = arquivos[i];
        const blob = tipo === "imagem" ? await comprimirImagem(file) : file;
        total += blob.size;
        if (total > MAX_TOTAL_BYTES) throw new Error(`Os anexos somam mais de ${formatarBytes(MAX_TOTAL_BYTES)}. Remova algum.`);
        const partes = await dividirEmPartes(blob);
        preparados.push({
          meta: { k: String(i), nome: file.name.slice(0, 100), tipo, mime: tipo === "imagem" ? "image/jpeg" : file.type, partes: partes.length, bytes: blob.size },
          partes,
        });
      }

      // 2) grava tudo de uma vez (protocolo + aviso + partes das mídias)
      const numero = gerarNumero();
      const batch = writeBatch(db);
      batch.set(doc(db, "protocolos", numero), {
        numero, autorUid: perfil.uid, secretariaId: sec.id, secretariaNome: sec.nome,
        assunto: assunto.trim(), mensagem: mensagem.trim(),
        anexos: preparados.map((p) => p.meta), status: "aberto", criadoEm: serverTimestamp(),
      });
      for (const p of preparados) {
        p.partes.forEach((data, idx) => {
          const k = `${p.meta.k}_${idx}`;
          batch.set(doc(db, "protocolos", numero, "midias", k), { k, mime: p.meta.mime, data });
        });
      }
      batch.set(doc(collection(db, "notificacoes")), {
        uid: perfil.uid, protocoloId: numero, tipo: "recebido",
        mensagem: `Protocolo ${numero} registrado para ${sec.nome}. Prazo de resposta: 30 dias.`,
        criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 30 * 86400_000),
      });
      await batch.commit();
      aoConcluir(numero);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally { setOcupado(false); }
  }

  if (secs === null) return <Carregando />;
  return (
    <Cartao>
      <h2 className="mb-4 text-lg font-semibold">Nova mensagem</h2>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Para qual secretaria?</span>
          <select value={secId} onChange={(e) => setSecId(e.target.value)} required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base">
            <option value="">Selecione…</option>
            {secs.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
        <Campo rotulo="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={120} required />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Mensagem</span>
          <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={6} maxLength={5000} required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base" />
          <span className="text-xs text-slate-500">{mensagem.length}/5000</span>
        </label>

        <div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple hidden
            onChange={(e) => adicionar(e.target.files)} />
          <Botao type="button" variante="secundario" onClick={() => inputRef.current?.click()} disabled={arquivos.length >= MAX_ANEXOS}>
            <Paperclip className="size-4" aria-hidden /> Anexar foto ou vídeo
          </Botao>
          <p className="mt-1 text-xs text-slate-500">Até {MAX_ANEXOS} arquivos. Fotos são reduzidas automaticamente; vídeos até {formatarBytes(MAX_VIDEO_BYTES)} (curtos).</p>
          <ul className="mt-2 space-y-1">
            {arquivos.map((a, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm">
                <span className="truncate">{a.tipo === "imagem" ? "🖼️" : "🎬"} {a.file.name} <span className="text-slate-500">({formatarBytes(a.file.size)})</span></span>
                <button type="button" aria-label={`Remover ${a.file.name}`} className="p-1" onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))}><X className="size-4" /></button>
              </li>
            ))}
          </ul>
        </div>

        {erro && <Aviso>{erro}</Aviso>}
        <Botao type="submit" carregando={ocupado} className="w-full"><Send className="size-4" aria-hidden /> Enviar mensagem</Botao>
      </form>
    </Cartao>
  );
}

// ---------- Protocolo (detalhe, usado por cidadão e servidor) ----------
export function ProtocoloDetalhe({ p, voltar, children }: { p: Protocolo; voltar: () => void; children?: React.ReactNode }) {
  const dias = diasRestantes(p);
  const prazo = prazoFinal(p);
  return (
    <div className="space-y-4">
      <Botao variante="link" onClick={voltar}><ArrowLeft className="size-4" aria-hidden /> Voltar</Botao>
      <Cartao className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-sm text-slate-500">{p.numero}</p>
            <h2 className="text-lg font-semibold">{p.assunto}</h2>
          </div>
          <Selo status={p.status} />
        </div>
        <dl className="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
          <div><dt className="inline font-medium">Secretaria: </dt><dd className="inline">{p.secretariaNome}</dd></div>
          <div><dt className="inline font-medium">Enviado em: </dt><dd className="inline">{dataBR(p.criadoEm)}</dd></div>
          {p.status === "aberto" && prazo && (
            <div className="sm:col-span-2"><dt className="inline font-medium">Prazo de resposta: </dt>
              <dd className="inline">{prazo.toLocaleDateString("pt-BR")} {dias !== null && (dias >= 0 ? `(${dias} dias restantes)` : "(prazo vencido)")}</dd></div>
          )}
        </dl>
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-800">{p.mensagem}</p>
        <Midias protocolo={p} />
        {p.status === "respondido" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <h3 className="mb-1 font-semibold text-emerald-900">Resposta da secretaria</h3>
            <p className="whitespace-pre-wrap text-emerald-950">{p.resposta}</p>
            <p className="mt-2 text-xs text-emerald-800">Respondido em {dataBR(p.respondidoEm)}</p>
          </div>
        )}
      </Cartao>
      {children}
    </div>
  );
}

export function usarProtocolos(campo: "autorUid" | "secretariaId", valor: string | undefined) {
  const [lista, setLista] = useState<Protocolo[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!valor) { setLista([]); return; }
    return onSnapshot(query(collection(db, "protocolos"), where(campo, "==", valor)),
      (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Protocolo)
        .sort((a, b) => (b.criadoEm?.toMillis?.() ?? Date.now()) - (a.criadoEm?.toMillis?.() ?? Date.now()))),
      (e) => { setErro(mensagemDeErro(e)); setLista([]); });
  }, [campo, valor]);
  return { lista, erro };
}

// ---------- Meus protocolos ----------
export function MeusProtocolos({ abrir, selecionado, limparSelecao }: { abrir: (id: string) => void; selecionado: string | null; limparSelecao: () => void }) {
  const { perfil } = useAuth();
  const { lista, erro } = usarProtocolos("autorUid", perfil?.uid);
  if (lista === null) return <Carregando />;
  const atual = selecionado ? lista.find((p) => p.id === selecionado) : null;
  if (atual) return <ProtocoloDetalhe p={atual} voltar={limparSelecao} />;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Meus protocolos</h2>
      {erro && <Aviso>{erro}</Aviso>}
      {lista.length === 0 && !erro && <Cartao><p className="text-slate-600">Você ainda não enviou mensagens.</p></Cartao>}
      {lista.map((p) => (
        <button key={p.id} onClick={() => abrir(p.id)} className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-slate-500">{p.numero}</span><Selo status={p.status} />
          </div>
          <p className="mt-1 font-semibold">{p.assunto}</p>
          <p className="text-sm text-slate-600">{p.secretariaNome} · {dataBR(p.criadoEm)}</p>
          {p.status === "aberto" && diasRestantes(p) !== null && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-700"><Clock className="size-3" aria-hidden /> Prazo: {diasRestantes(p)} dias</p>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Avisos (somem sozinhos) ----------
export function usarNotificacoes() {
  const { perfil } = useAuth();
  const [todas, setTodas] = useState<Notificacao[]>([]);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (!perfil) return;
    return onSnapshot(query(collection(db, "notificacoes"), where("uid", "==", perfil.uid)),
      (s) => setTodas(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Notificacao)), () => setTodas([]));
  }, [perfil]);

  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const visiveis = useMemo(() => todas.filter((n) => n.expiraEm.toMillis() > agora)
    .sort((a, b) => (b.criadoEm?.toMillis?.() ?? Date.now()) - (a.criadoEm?.toMillis?.() ?? Date.now())), [todas, agora]);

  // limpeza: apaga do banco os avisos já vencidos
  useEffect(() => {
    todas.filter((n) => n.expiraEm.toMillis() <= agora).forEach((n) => { void deleteDoc(doc(db, "notificacoes", n.id)).catch(() => undefined); });
  }, [todas, agora]);

  return { visiveis, agora };
}

function restante(n: Notificacao, agora: number): string {
  const ms = n.expiraEm.toMillis() - agora;
  const h = Math.floor(ms / 3600_000);
  if (h >= 48) return `some em ${Math.floor(h / 24)} dias`;
  return h >= 1 ? `some em ${h} h` : `some em ${Math.max(1, Math.ceil(ms / 60_000))} min`;
}

export function PainelAvisos({ abrirProtocolo }: { abrirProtocolo: (id: string) => void }) {
  const { visiveis, agora } = usarNotificacoes();
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="size-5" aria-hidden /> Avisos</h2>
      {visiveis.length === 0 && <Cartao><p className="text-slate-600">Nenhum aviso no momento.</p></Cartao>}
      {visiveis.map((n) => (
        <Cartao key={n.id} className={n.tipo === "resposta" ? "border-emerald-300 bg-emerald-50" : n.tipo === "aviso" ? "border-amber-300 bg-amber-50" : ""}>
          <p className="text-sm font-medium">{n.tipo === "resposta" ? "Resposta recebida" : n.tipo === "aviso" ? "Aviso da prefeitura" : "Protocolo registrado"}</p>
          <p className="mt-1 whitespace-pre-line text-slate-800">{n.mensagem}</p>
          <p className="mt-1 text-xs text-slate-500">{dataBR(n.criadoEm)} · {restante(n, agora)}</p>
          <div className="mt-2 flex gap-2">
            {n.protocoloId && <Botao variante="secundario" onClick={() => abrirProtocolo(n.protocoloId)}>Abrir protocolo</Botao>}
            <Botao variante="link" onClick={() => { void deleteDoc(doc(db, "notificacoes", n.id)); }}>Dispensar</Botao>
          </div>
        </Cartao>
      ))}
    </div>
  );
}
