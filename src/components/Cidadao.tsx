import { lazy, Suspense, useEffect, useState, useMemo, type FormEvent } from "react";
import { doc, getDocs, onSnapshot, query, where, writeBatch, serverTimestamp, Timestamp, deleteDoc } from "firebase/firestore";
import { Send, Bell, Clock, MapPin, LocateFixed } from "lucide-react";
import { db } from "../lib/firebase";
import { colM, docM } from "../lib/municipio";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { registrarEnvio } from "../lib/limite";
import { sincronizarFicha } from "../lib/consulta";
import { LAI, TIPOS, prazosDoTipo, type Coordenada, type Notificacao, type Protocolo, type Secretaria, type TipoManifestacao } from "../lib/types";
import { Aviso, Botao, Campo, Cartao, Carregando, Selo, dataBR, rotuloPrazo } from "./ui";
import { ProtocoloDetalhe, SeletorAnexos, enviarAnexosR2, gravarMidias, prepararAnexos, useAnexos, useLimpezaConversas } from "./Conversa";

const SeletorLocal = lazy(() => import("./Mapa").then((m) => ({ default: m.SeletorLocal })));
const arred = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;

function gerarNumero(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(8));
  return `OUV-${new Date().getFullYear()}-${Array.from(b, (x) => alfabeto[x % alfabeto.length]).join("")}`;
}

// ---------- Nova mensagem ----------
export function NovaMensagem({ aoConcluir }: { aoConcluir: (numero: string) => void }) {
  const { perfil } = useAuth();
  const [secs, setSecs] = useState<Secretaria[] | null>(null);
  const [secId, setSecId] = useState("");
  const [tipo, setTipo] = useState<TipoManifestacao | "">("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const anexos = useAnexos();
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [local, setLocal] = useState<Coordenada | null>(null);
  const [mapaAberto, setMapaAberto] = useState(false);
  const [gps, setGps] = useState("");

  function useGps() {
    if (!("geolocation" in navigator)) return setGps("Este aparelho não informa a localização. Marque no mapa.");
    setGps("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocal({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setMapaAberto(true); setGps("Confira o ponto no mapa e toque para ajustar, se precisar."); },
      (err) => setGps(err.code === 1 ? "Você não permitiu o acesso à localização. Marque o local no mapa." : "Não foi possível obter a localização. Marque o local no mapa."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  useEffect(() => {
    getDocs(query(colM("secretarias"), where("ativa", "==", true)))
      .then((s) => setSecs(s.docs.map((d) => ({ id: d.id, nome: d.get("nome"), ativa: true })).sort((a, b) => a.nome.localeCompare(b.nome))))
      .catch((e) => { setErro(mensagemDeErro(e)); setSecs([]); });
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    setErro("");
    const sec = secs?.find((s) => s.id === secId);
    if (!sec) return setErro("Escolha a secretaria.");
    if (!tipo) return setErro("Escolha o tipo da manifestação.");
    if (assunto.trim().length < 3) return setErro("Escreva um assunto.");
    if (mensagem.trim().length < 3) return setErro("Escreva sua mensagem.");

    setOcupado(true);
    try {
      const preparados = await prepararAnexos(anexos.arquivos, "00");
      const numero = gerarNumero();
      const lote = writeBatch(db);
      await registrarEnvio(lote, perfil.uid, numero);
      lote.set(docM("protocolos", numero), {
        numero, autorUid: perfil.uid, secretariaId: sec.id, secretariaNome: sec.nome,
        tipo, status: "aberto", ultimaMsgPor: "cidadao", criadoEm: serverTimestamp(),
        // só a região aproximada (≈100 m) vai no protocolo, para o mapa interno
        ...(local ? { regiao: { lat: arred(local.lat, 3), lng: arred(local.lng, 3) } } : {}),
      });
      lote.set(docM("protocolos", numero, "mensagens", "m00"), {
        de: "cidadao", autorUid: perfil.uid, assunto: assunto.trim(), texto: mensagem.trim(),
        anexos: preparados.map((p) => p.meta), criadoEm: serverTimestamp(),
        // o ponto exato fica só na conversa (lida só por você, pela secretaria e pela Ouvidoria)
        ...(local ? { local: { lat: arred(local.lat, 6), lng: arred(local.lng, 6) } } : {}),
      });
      gravarMidias(lote, numero, preparados);
      lote.set(doc(colM("notificacoes")), {
        uid: perfil.uid, protocoloId: numero, tipo: "recebido",
        mensagem: `Protocolo ${numero} registrado para ${sec.nome}. Prazo de resposta: ${prazosDoTipo(tipo).prazo} dias.`,
        criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 30 * 86400_000),
      });
      await lote.commit();
      void sincronizarFicha(numero);
      const problema = await enviarAnexosR2(numero, preparados);
      if (problema) window.alert(problema);
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
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Tipo de manifestação</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoManifestacao)} required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base">
            <option value="">Selecione…</option>
            {(Object.keys(TIPOS) as TipoManifestacao[]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
          </select>
          {tipo === "lai" && (
            <span className="mt-1 block text-xs text-slate-700">Use para pedir <b>documentos ou dados públicos</b> do município (Lei 12.527/2011). A resposta vem em até <b>{LAI.prazo} dias</b>,
              prorrogáveis por mais {LAI.prorrogacao} com justificativa. Se for negada ou incompleta, você pode apresentar <b>recurso</b> em até {LAI.recursoPrazoDias} dias.</span>
          )}
        </label>
        <Campo rotulo="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={120} required />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Mensagem</span>
          <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={6} maxLength={5000} required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base" />
          <span className="text-xs text-slate-600">{mensagem.length}/5000</span>
        </label>
        <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Local da ocorrência (opcional)</legend>
          <p className="text-xs text-slate-600">Ajuda a secretaria a achar o problema (buraco, iluminação, lixo…). O ponto exato fica só na sua conversa; nos mapas internos da prefeitura aparece aproximado.</p>
          <div className="flex flex-wrap gap-2">
            <Botao type="button" variante="secundario" onClick={useGps}><LocateFixed className="size-4" aria-hidden /> Usar minha localização</Botao>
            <Botao type="button" variante="secundario" onClick={() => setMapaAberto((v) => !v)} aria-expanded={mapaAberto}><MapPin className="size-4" aria-hidden /> {mapaAberto ? "Fechar mapa" : "Marcar no mapa"}</Botao>
            {local && <Botao type="button" variante="link" onClick={() => { setLocal(null); setGps(""); }}>Remover local</Botao>}
          </div>
          {gps && <p className="text-sm text-slate-700" role="status">{gps}</p>}
          {local && <p className="text-sm text-emerald-800">Local marcado ({local.lat.toFixed(5)}, {local.lng.toFixed(5)}).</p>}
          {mapaAberto && <Suspense fallback={<Carregando texto="Abrindo o mapa…" />}><SeletorLocal valor={local} onChange={setLocal} /></Suspense>}
        </fieldset>
        <SeletorAnexos a={anexos} />
        <p className="text-xs text-slate-600">Sua mensagem só pode ser lida por você, pela secretaria escolhida e pela Ouvidoria geral do município (que pode encaminhá-la ao setor certo).</p>
        {erro && <Aviso>{erro}</Aviso>}
        <Botao type="submit" carregando={ocupado} className="w-full"><Send className="size-4" aria-hidden /> Enviar mensagem</Botao>
      </form>
    </Cartao>
  );
}

export function useProtocolos(campo: "autorUid" | "secretariaId", valor: string | undefined) {
  const [lista, setLista] = useState<Protocolo[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!valor) { setLista([]); return; }
    return onSnapshot(query(colM("protocolos"), where(campo, "==", valor)),
      (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Protocolo)
        .sort((a, b) => (b.criadoEm?.toMillis?.() ?? Date.now()) - (a.criadoEm?.toMillis?.() ?? Date.now()))),
      (e) => { setErro(mensagemDeErro(e)); setLista([]); });
  }, [campo, valor]);
  return { lista, erro };
}

// ---------- Meus protocolos ----------
export function MeusProtocolos({ abrir, selecionado, limparSelecao }: { abrir: (id: string) => void; selecionado: string | null; limparSelecao: () => void }) {
  const { perfil } = useAuth();
  const { lista, erro } = useProtocolos("autorUid", perfil?.uid);
  useLimpezaConversas(lista);
  if (lista === null) return <Carregando />;
  const atual = selecionado ? lista.find((p) => p.id === selecionado) : null;
  if (atual) return <ProtocoloDetalhe p={atual} voltar={limparSelecao} eu="cidadao" />;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Meus protocolos</h2>
      {erro && <Aviso>{erro}</Aviso>}
      {lista.length === 0 && !erro && <Cartao><p className="text-slate-600">Você ainda não enviou mensagens.</p></Cartao>}
      {lista.map((p) => (
        <button key={p.id} onClick={() => abrir(p.id)} className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-slate-600">{p.numero}</span><Selo status={p.status} p={p} />
          </div>
          <p className="mt-1 font-semibold">{TIPOS[p.tipo] ?? p.assunto ?? "Manifestação"}</p>
          <p className="text-sm text-slate-700">{p.secretariaNome} · {dataBR(p.criadoEm)}</p>
          {p.status === "respondido" && p.ultimaMsgPor === "servidor" && <p className="mt-1 text-xs font-semibold text-emerald-800">Há resposta da secretaria</p>}
          {p.status === "aberto" && rotuloPrazo(p) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-800"><Clock className="size-3" aria-hidden /> {rotuloPrazo(p)!.texto}</p>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Avisos (somem sozinhos) ----------
export function useNotificacoes() {
  const { perfil } = useAuth();
  const [todas, setTodas] = useState<Notificacao[]>([]);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (!perfil) return;
    return onSnapshot(query(colM("notificacoes"), where("uid", "==", perfil.uid)),
      (s) => setTodas(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Notificacao)), () => setTodas([]));
  }, [perfil]);

  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const visiveis = useMemo(() => todas.filter((n) => n.expiraEm.toMillis() > agora)
    .sort((a, b) => (b.criadoEm?.toMillis?.() ?? Date.now()) - (a.criadoEm?.toMillis?.() ?? Date.now())), [todas, agora]);

  // limpeza: apaga do banco os avisos já vencidos
  useEffect(() => {
    todas.filter((n) => n.expiraEm.toMillis() <= agora).forEach((n) => { void deleteDoc(docM("notificacoes", n.id)).catch(() => undefined); });
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
  const { visiveis, agora } = useNotificacoes();
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="size-5" aria-hidden /> Avisos</h2>
      {visiveis.length === 0 && <Cartao><p className="text-slate-600">Nenhum aviso no momento.</p></Cartao>}
      {visiveis.map((n) => (
        <Cartao key={n.id} className={n.tipo === "resposta" ? "border-emerald-300 bg-emerald-50" : n.tipo === "aviso" || n.tipo === "prorrogacao" ? "border-amber-300 bg-amber-50" : ""}>
          <p className="text-sm font-medium">{n.tipo === "resposta" ? "Resposta recebida" : n.tipo === "aviso" ? "Aviso da prefeitura" : n.tipo === "prorrogacao" ? "Prazo prorrogado" : "Protocolo registrado"}</p>
          <p className="mt-1 whitespace-pre-line text-slate-800">{n.mensagem}</p>
          <p className="mt-1 text-xs text-slate-600">{dataBR(n.criadoEm)} · {restante(n, agora)}</p>
          <div className="mt-2 flex gap-2">
            {n.protocoloId && <Botao variante="secundario" onClick={() => abrirProtocolo(n.protocoloId)}>Abrir protocolo</Botao>}
            <Botao variante="link" onClick={() => { void deleteDoc(docM("notificacoes", n.id)); }}>Dispensar</Botao>
          </div>
        </Cartao>
      ))}
    </div>
  );
}
