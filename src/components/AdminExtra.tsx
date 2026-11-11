import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  addDoc, collection, deleteDoc, deleteField, doc, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, startAfter, Timestamp, updateDoc, where, writeBatch, type Query, type QueryDocumentSnapshot, type QuerySnapshot,
} from "firebase/firestore";
import { ArrowDown, ArrowUp, Ban, ImagePlus, Mail, Pencil, Trash2, Undo2 } from "lucide-react";
import { db } from "../lib/firebase";
import { colM, docM } from "../lib/municipio";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { imagemParaDataUrl } from "../lib/media";
import { enviarEmailUsuarios } from "../lib/audit";
import { baixarCSV } from "./AdminRelatorios";
import { contrasteComBranco, escurecer, HEX_OK, linkSeguro, useSite, type Anuncio } from "../lib/useConfig";
import type { UsuarioApp } from "../lib/types";
import { Aviso, Botao, Campo, Cartao, Carregando, dataBR } from "./ui";
import { Logo } from "./Marca";

type Auditar = (acao: string, alvo: string, detalhe?: string) => Promise<void>;

// ======================= APARÊNCIA =======================
const CORES = ["#0b3b8c", "#1351b4", "#0f766e", "#166534", "#7c2d12", "#7e1d6b", "#374151", "#b91c1c"];

export function Aparencia({ auditar }: { auditar: Auditar }) {
  const site = useSite();
  const [nome, setNome] = useState(site.nome);
  const [cor, setCor] = useState(site.cor);
  const [logo, setLogo] = useState(site.logo);
  const [contato, setContato] = useState(site.contato);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const arq = useRef<HTMLInputElement>(null);

  const corValida = HEX_OK.test(cor);
  const contraste = corValida ? contrasteComBranco(cor) : 0;

  async function escolherLogo(f: File | undefined) {
    if (!f) return;
    setErro("");
    try { setLogo(await imagemParaDataUrl(f, { maxW: 256, maxH: 256, mime: "image/webp", qualidade: 0.9, maxChars: 200_000 })); }
    catch (e) { setErro(mensagemDeErro(e)); }
    if (arq.current) arq.current.value = "";
  }

  async function salvar(e: FormEvent) {
    e.preventDefault(); setErro(""); setMsg("");
    if (nome.trim().length < 2) return setErro("Informe o nome do município.");
    if (!corValida) return setErro("Cor inválida. Use o formato #RRGGBB.");
    if (contraste < 4.5) return setErro("A cor está clara demais: o texto branco ficaria difícil de ler. Escolha uma cor mais escura.");
    setOcupado(true);
    try {
      await setDoc(docM("config", "site"), { nome: nome.trim(), cor: cor.toLowerCase(), logo, contato: contato.trim(), atualizadoEm: serverTimestamp() });
      setMsg("Aparência salva. Já vale para todos os usuários.");
      await auditar("config.editar", nome.trim(), `cor ${cor}${logo ? ", com logomarca" : ", sem logomarca"}`);
    } catch (err) { setErro(mensagemDeErro(err)); }
    finally { setOcupado(false); }
  }

  return (
    <Cartao className="space-y-4">
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome do município (aparece na tela inicial)" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required dica='Exemplo: "Prefeitura Municipal de Rio Preto"' />
        <Campo rotulo="Contato do encarregado de dados / ouvidoria (LGPD)" value={contato} onChange={(e) => setContato(e.target.value)} maxLength={120} dica="E-mail ou telefone que aparece na Política de Privacidade." />

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Logomarca da prefeitura</p>
          <div className="flex items-center gap-3">
            <div className="flex size-24 items-center justify-center rounded-lg border bg-slate-50"><Logo tamanho="size-20" className="text-brand" /></div>
            <div className="space-y-2">
              <input ref={arq} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => escolherLogo(e.target.files?.[0])} />
              <Botao type="button" variante="secundario" onClick={() => arq.current?.click()}><ImagePlus className="size-4" aria-hidden /> Escolher imagem</Botao>
              {logo && <Botao type="button" variante="link" onClick={() => setLogo("")}>Remover logomarca</Botao>}
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-600">PNG com fundo transparente funciona melhor. A imagem é reduzida automaticamente.</p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Cor principal do layout</p>
          <div className="flex flex-wrap items-center gap-2">
            {CORES.map((c) => (
              <button key={c} type="button" aria-label={`Usar a cor ${c}`} onClick={() => setCor(c)} style={{ background: c }}
                className={`size-9 rounded-full border-2 ${cor.toLowerCase() === c ? "border-slate-900" : "border-white shadow"}`} />
            ))}
            <input type="color" aria-label="Escolher outra cor" value={corValida ? cor : "#0b3b8c"} onChange={(e) => setCor(e.target.value)} className="size-9 cursor-pointer rounded border p-0" />
            <input value={cor} onChange={(e) => setCor(e.target.value)} maxLength={7} aria-label="Código da cor" className="w-28 rounded-lg border px-2 py-2 font-mono text-sm" />
          </div>
          {corValida && contraste < 4.5 && <div className="mt-2"><Aviso>Cor clara demais para texto branco (contraste {contraste.toFixed(1)}; o mínimo é 4,5).</Aviso></div>}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Pré-visualização</p>
          <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-white" style={{ background: corValida ? cor : "#0b3b8c" }}>
            {logo ? <img src={logo} alt="" className="size-8 object-contain" /> : <Logo tamanho="size-8" />}
            <div className="leading-tight"><p className="text-sm font-bold">{nome || "Nome do município"}</p><p className="text-[11px] opacity-80">Ouvidoria</p></div>
            <span className="ml-auto rounded px-3 py-1 text-xs font-semibold" style={{ background: corValida ? escurecer(cor) : "#082b66" }}>Botão</span>
          </div>
        </div>

        {erro && <Aviso>{erro}</Aviso>}
        {msg && <Aviso tipo="ok">{msg}</Aviso>}
        <Botao type="submit" carregando={ocupado}>Salvar aparência</Botao>
      </form>
    </Cartao>
  );
}

// ======================= PUBLICIDADE =======================
const MAX_ANUNCIOS = 10;

export function Publicidade({ auditar }: { auditar: Auditar }) {
  const [lista, setLista] = useState<Anuncio[] | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Anuncio | null>(null);
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("");
  const [imagem, setImagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const arq = useRef<HTMLInputElement>(null);

  useEffect(() => onSnapshot(colM("anuncios"),
    (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Anuncio).sort((a, b) => a.ordem - b.ordem)),
    (e) => { setErro(mensagemDeErro(e)); setLista([]); }), []);

  function limpar() { setEditando(null); setTitulo(""); setLink(""); setImagem(""); }

  async function escolher(f: File | undefined) {
    if (!f) return;
    setErro("");
    try { setImagem(await imagemParaDataUrl(f, { maxW: 1200, maxH: 400, mime: "image/jpeg", qualidade: 0.85, maxChars: 380_000, cobrir: true })); }
    catch (e) { setErro(mensagemDeErro(e)); }
    if (arq.current) arq.current.value = "";
  }

  async function salvar(e: FormEvent) {
    e.preventDefault(); setErro("");
    if (!titulo.trim()) return setErro("Dê um título ao anúncio (usado como descrição da imagem).");
    if (!imagem) return setErro("Escolha a imagem do anúncio.");
    const l = link.trim();
    if (l && !linkSeguro(l)) return setErro("O link deve começar com https://");
    if (!editando && (lista?.length ?? 0) >= MAX_ANUNCIOS) return setErro(`Limite de ${MAX_ANUNCIOS} anúncios. Exclua algum antes.`);
    setOcupado(true);
    try {
      if (editando) {
        await updateDoc(docM("anuncios", editando.id), { titulo: titulo.trim(), link: l, imagem });
        await auditar("anuncio.editar", titulo.trim());
      } else {
        const ordem = (lista ?? []).reduce((m, a) => Math.max(m, a.ordem), -1) + 1;
        await addDoc(colM("anuncios"), { titulo: titulo.trim(), link: l, imagem, ativo: true, ordem, criadoEm: serverTimestamp() });
        await auditar("anuncio.criar", titulo.trim(), l);
      }
      limpar();
    } catch (err) { setErro(mensagemDeErro(err)); }
    finally { setOcupado(false); }
  }

  async function alternar(a: Anuncio) {
    try { await updateDoc(docM("anuncios", a.id), { ativo: !a.ativo }); await auditar("anuncio.editar", a.titulo, a.ativo ? "desativado" : "ativado"); }
    catch (err) { setErro(mensagemDeErro(err)); }
  }
  async function mover(a: Anuncio, dir: -1 | 1) {
    const l = lista ?? []; const i = l.findIndex((x) => x.id === a.id); const o = l[i + dir];
    if (!o) return;
    try {
      await updateDoc(docM("anuncios", a.id), { ordem: o.ordem });
      await updateDoc(docM("anuncios", o.id), { ordem: a.ordem });
    } catch (err) { setErro(mensagemDeErro(err)); }
  }
  async function excluir(a: Anuncio) {
    if (!confirm(`Excluir o anúncio "${a.titulo}"?`)) return;
    try { await deleteDoc(docM("anuncios", a.id)); await auditar("anuncio.excluir", a.titulo); }
    catch (err) { setErro(mensagemDeErro(err)); }
  }

  if (lista === null) return <Carregando />;
  return (
    <div className="space-y-3">
      <Cartao>
        <form onSubmit={salvar} className="space-y-3">
          <h3 className="font-semibold">{editando ? "Editar anúncio" : "Novo anúncio"}</h3>
          <Campo rotulo="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} required />
          <Campo rotulo="Link ao clicar (opcional)" type="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="https://" />
          <div>
            <input ref={arq} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => escolher(e.target.files?.[0])} />
            <Botao type="button" variante="secundario" onClick={() => arq.current?.click()}><ImagePlus className="size-4" aria-hidden /> {imagem ? "Trocar imagem" : "Escolher imagem"}</Botao>
            <p className="mt-1 text-xs text-slate-600">Formato ideal: 3 por 1 (ex.: 1200 × 400). Imagens de outros formatos são cortadas ao centro.</p>
            {imagem && <img src={imagem} alt="Pré-visualização do anúncio" className="mt-2 aspect-[3/1] w-full rounded-lg border object-cover" />}
          </div>
          {erro && <Aviso>{erro}</Aviso>}
          <div className="flex gap-2">
            <Botao type="submit" carregando={ocupado}>{editando ? "Salvar" : "Adicionar anúncio"}</Botao>
            {editando && <Botao type="button" variante="secundario" onClick={limpar}>Cancelar</Botao>}
          </div>
        </form>
      </Cartao>

      {lista.length === 0 && <Cartao><p className="text-slate-600">Nenhum anúncio cadastrado.</p></Cartao>}
      {lista.map((a, i) => (
        <Cartao key={a.id} className={`flex gap-3 ${a.ativo ? "" : "opacity-60"}`}>
          <img src={a.imagem} alt="" className="aspect-[3/1] w-32 shrink-0 rounded border object-cover sm:w-44" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{a.titulo} {!a.ativo && <span className="text-xs text-slate-600">(inativo)</span>}</p>
            <p className="truncate text-xs text-slate-600">{a.link || "sem link"}</p>
            <div className="mt-1 flex flex-wrap items-center">
              <button aria-label="Subir" disabled={i === 0} className="p-2 disabled:opacity-30" onClick={() => mover(a, -1)}><ArrowUp className="size-4" /></button>
              <button aria-label="Descer" disabled={i === lista.length - 1} className="p-2 disabled:opacity-30" onClick={() => mover(a, 1)}><ArrowDown className="size-4" /></button>
              <Botao variante="link" onClick={() => alternar(a)}>{a.ativo ? "Desativar" : "Ativar"}</Botao>
              <button aria-label={`Editar ${a.titulo}`} className="p-2" onClick={() => { setEditando(a); setTitulo(a.titulo); setLink(a.link); setImagem(a.imagem); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="size-4" /></button>
              <button aria-label={`Excluir ${a.titulo}`} className="p-2 text-red-600" onClick={() => excluir(a)}><Trash2 className="size-4" /></button>
            </div>
          </div>
        </Cartao>
      ))}
    </div>
  );
}

// ======================= USUÁRIOS =======================
const PAGINA = 100;
const LIMITE_TOTAL = 2000;

function formatarTelefone(t?: string): string {
  if (!t) return "";
  const d = t.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function Usuarios({ auditar }: { auditar: Auditar }) {
  const { perfil } = useAuth();
  const [itens, setItens] = useState<UsuarioApp[]>([]);
  const [ultimo, setUltimo] = useState<QueryDocumentSnapshot | null>(null);
  const [fim, setFim] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [bloqueados, setBloqueados] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [sit, setSit] = useState<"todos" | "ativo" | "bloqueado" | "excluido">("todos");
  const [soTel, setSoTel] = useState(false);
  const [periodo, setPeriodo] = useState<"todos" | "7" | "30" | "90">("todos");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msgAberta, setMsgAberta] = useState(false);
  const [todosServidor, setTodosServidor] = useState<UsuarioApp[] | null>(null);
  const [buscandoTodos, setBuscandoTodos] = useState(false);

  async function contar() {
    try {
      const col = colM("users");
      setTotal((await getCountFromServer(col)).data().count);
      setBloqueados((await getCountFromServer(query(col, where("situacao", "==", "bloqueado")))).data().count);
    } catch { /* contagem é opcional */ }
  }

  async function carregar(maisPaginas = 1) {
    setCarregando(true); setErro("");
    try {
      let cursor = ultimo, novos: UsuarioApp[] = [], acabou = fim;
      for (let p = 0; p < maisPaginas && !acabou; p++) {
        const q = query(colM("users"), orderBy("criadoEm", "desc"), limit(PAGINA), ...(cursor ? [startAfter(cursor)] : []));
        const s = await getDocs(q);
        novos = novos.concat(s.docs.map((d) => ({
          id: d.id, nome: d.get("nome") ?? "", email: d.get("email") ?? "", telefone: d.get("telefone") ?? undefined,
          situacao: d.get("situacao") ?? "ativo", criadoEm: d.get("criadoEm") ?? null,
        }) as UsuarioApp));
        cursor = s.docs[s.docs.length - 1] ?? cursor;
        if (s.docs.length < PAGINA) acabou = true;
        if (itens.length + novos.length >= LIMITE_TOTAL) { acabou = true; }
      }
      setItens((x) => [...x, ...novos]); setUltimo(cursor); setFim(acabou);
    } catch (e) { setErro(mensagemDeErro(e)); }
    finally { setCarregando(false); }
  }

  useEffect(() => { void contar(); void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const td = t.replace(/\D/g, "");
    const desde = periodo === "todos" ? 0 : Date.now() - Number(periodo) * 86_400_000;
    return itens.filter((u) =>
      (sit === "todos" || u.situacao === sit) && (!soTel || !!u.telefone) &&
      (desde === 0 || (u.criadoEm?.toMillis?.() ?? 0) >= desde) &&
      (!t || u.nome.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || (td.length >= 3 && (u.telefone ?? "").includes(td))));
  }, [itens, busca, sit, soTel, periodo]);

  // Destinatários: os marcados; se nada estiver marcado, todos os que aparecem no filtro (só contas ativas).
  const destinatarios = useMemo(() => {
    const base = sel.size > 0 ? itens.filter((u) => sel.has(u.id)) : filtrados;
    return base.filter((u) => u.situacao === "ativo" && u.id !== perfil?.uid);
  }, [sel, itens, filtrados, perfil]);
  // Envio em massa: busca no servidor TODOS os ativos (respeitando o período), sem depender da tabela carregada.
  async function buscarTodosAtivos() {
    setBuscandoTodos(true); setErro("");
    try {
      const col = colM("users");
      const desde = periodo === "todos" ? null : Timestamp.fromMillis(Date.now() - Number(periodo) * 86_400_000);
      const out: UsuarioApp[] = [];
      let cursor: QueryDocumentSnapshot | null = null;
      while (out.length < 5000) {
        const q: Query = desde
          ? query(col, where("criadoEm", ">=", desde), orderBy("criadoEm"), ...(cursor ? [startAfter(cursor)] : []), limit(500))
          : query(col, where("situacao", "==", "ativo"), ...(cursor ? [startAfter(cursor)] : []), limit(500));
        const snap: QuerySnapshot = await getDocs(q);
        snap.docs.forEach((d) => {
          if ((d.get("situacao") ?? "ativo") === "ativo" && d.id !== perfil?.uid)
            out.push({ id: d.id, nome: d.get("nome") ?? "", email: d.get("email") ?? "", telefone: d.get("telefone") ?? undefined, situacao: "ativo", criadoEm: d.get("criadoEm") ?? null });
        });
        cursor = snap.docs[snap.docs.length - 1] ?? null;
        if (snap.docs.length < 500) break;
      }
      setTodosServidor(out); setMsgAberta(true);
    } catch (e) { setErro(mensagemDeErro(e)); }
    finally { setBuscandoTodos(false); }
  }
  function exportarFiltrados() {
    if (!confirm("O arquivo terá nome, e-mail e telefone (dados pessoais). Guarde com cuidado. Continuar?")) return;
    baixarCSV(`usuarios-filtrados-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Nome", "E-mail", "Telefone", "Situação", "Cadastro em"],
      ...filtrados.map((u) => [u.nome, u.email, u.telefone ?? "", u.situacao, u.criadoEm ? dataBR(u.criadoEm) : ""]),
    ]);
    void auditar("exportacao.csv", "usuários (filtro)", `${filtrados.length} linhas`);
  }
  const alternar = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const marcaveis = filtrados.filter((u) => u.situacao === "ativo" && u.id !== perfil?.uid);

  async function mudar(u: UsuarioApp, nova: "ativo" | "bloqueado" | "excluido") {
    const rotulo = u.nome || u.email;
    if (nova === "excluido" && !confirm(`EXCLUIR ${rotulo}?\n\nNome, e-mail e telefone serão apagados da lista e a conta ficará bloqueada para sempre. As mensagens já enviadas ficam registradas na secretaria. Isso não pode ser desfeito.`)) return;
    if (nova === "bloqueado" && !confirm(`Bloquear ${rotulo}? A pessoa não poderá mais usar o app até ser desbloqueada.`)) return;
    try {
      const ref = docM("users", u.id);
      if (nova === "excluido") await updateDoc(ref, { situacao: "excluido", nome: "(removido)", email: "", telefone: deleteField() });
      else await updateDoc(ref, { situacao: nova });
      await auditar(nova === "ativo" ? "usuario.desbloquear" : nova === "bloqueado" ? "usuario.bloquear" : "usuario.excluir", u.email || u.id, u.nome);
      setItens((x) => x.map((i) => i.id === u.id ? (nova === "excluido" ? { ...i, situacao: nova, nome: "(removido)", email: "", telefone: undefined } : { ...i, situacao: nova }) : i));
      void contar();
    } catch (e) { setErro(mensagemDeErro(e)); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Cartao className="text-center"><p className="text-3xl font-bold text-brand">{total ?? "—"}</p><p className="text-sm text-slate-600">usuários cadastrados</p></Cartao>
        <Cartao className="text-center"><p className="text-3xl font-bold text-red-700">{bloqueados ?? "—"}</p><p className="text-sm text-slate-600">bloqueados</p></Cartao>
      </div>

      <Cartao className="space-y-3">
        <Campo rotulo="Buscar por nome, e-mail ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} type="search" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">Situação:{" "}
            <select value={sit} onChange={(e) => setSit(e.target.value as typeof sit)} className="rounded-lg border bg-white px-2 py-1.5">
              <option value="todos">Todas</option><option value="ativo">Ativos</option><option value="bloqueado">Bloqueados</option><option value="excluido">Excluídos</option>
            </select></label>
          <label className="text-sm">Cadastro:{" "}
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)} className="rounded-lg border bg-white px-2 py-1.5">
              <option value="todos">Qualquer data</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option>
            </select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soTel} onChange={(e) => setSoTel(e.target.checked)} className="size-4" /> Só com telefone</label>
        </div>
        <p className="text-xs text-slate-600">A busca vale para os {itens.length} usuários já carregados{fim ? " (todos)" : ""}. Mostrando {filtrados.length}.</p>
      </Cartao>

      <div className="flex flex-wrap items-center gap-3">
        <Botao onClick={() => { setTodosServidor(null); setMsgAberta(true); }} disabled={destinatarios.length === 0}><Mail className="mr-1 inline size-4" aria-hidden />Enviar mensagem a {destinatarios.length} {destinatarios.length === 1 ? "usuário" : "usuários"}</Botao>
        <span className="text-xs text-slate-600">{sel.size > 0 ? `${sel.size} marcado(s)` : "Nenhum marcado: vai para todos que aparecem no filtro"}</span>
        {sel.size > 0 && <Botao variante="link" onClick={() => setSel(new Set())}>Limpar seleção</Botao>}
        <Botao variante="secundario" onClick={buscarTodosAtivos} carregando={buscandoTodos}>Enviar a todos os ativos{periodo !== "todos" ? ` (cadastro: últimos ${periodo} dias)` : ""}</Botao>
        <Botao variante="secundario" onClick={exportarFiltrados} disabled={filtrados.length === 0}>Exportar lista filtrada (CSV)</Botao>
      </div>
      {msgAberta && <EnviarMensagem destinatarios={todosServidor ?? destinatarios} auditar={auditar} fechar={() => { setMsgAberta(false); setTodosServidor(null); }} />}

      {erro && <Aviso>{erro}</Aviso>}
      <Cartao className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
            <tr><th className="w-8 px-3 py-2"><input type="checkbox" className="size-4" aria-label="Marcar todos os listados" checked={marcaveis.length > 0 && marcaveis.every((u) => sel.has(u.id))} onChange={(e) => setSel(e.target.checked ? new Set(marcaveis.map((u) => u.id)) : new Set())} /></th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Telefone</th><th className="px-3 py-2">Desde</th><th className="px-3 py-2 text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y">
            {filtrados.map((u) => (
              <tr key={u.id} className={u.situacao === "ativo" ? "" : "bg-slate-50 text-slate-600"}>
                <td className="px-3 py-2">{u.situacao === "ativo" && u.id !== perfil?.uid && <input type="checkbox" className="size-4" aria-label={`Marcar ${u.nome || u.email}`} checked={sel.has(u.id)} onChange={() => alternar(u.id)} />}</td>
                <td className="px-3 py-2 font-medium">{u.nome || "—"} {u.situacao === "bloqueado" && <span className="rounded bg-red-100 px-1.5 text-xs text-red-800">bloqueado</span>}{u.situacao === "excluido" && <span className="rounded bg-slate-200 px-1.5 text-xs">excluído</span>}</td>
                <td className="px-3 py-2 break-all">{u.email || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatarTelefone(u.telefone) || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{u.criadoEm ? dataBR(u.criadoEm).split(" ")[0].replace(",", "") : "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {u.id !== perfil?.uid && u.situacao !== "excluido" && (<>
                    {u.situacao === "ativo"
                      ? <button className="p-2 text-amber-700" aria-label={`Bloquear ${u.nome || u.email}`} title="Bloquear" onClick={() => mudar(u, "bloqueado")}><Ban className="size-4" /></button>
                      : <button className="p-2 text-emerald-700" aria-label={`Desbloquear ${u.nome || u.email}`} title="Desbloquear" onClick={() => mudar(u, "ativo")}><Undo2 className="size-4" /></button>}
                    <button className="p-2 text-red-600" aria-label={`Excluir ${u.nome || u.email}`} title="Excluir" onClick={() => mudar(u, "excluido")}><Trash2 className="size-4" /></button>
                  </>)}
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && !carregando && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-600">Nenhum usuário encontrado.</td></tr>}
          </tbody>
        </table>
      </Cartao>
      {carregando && <Carregando />}
      {!fim && !carregando && (
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => carregar(1)}>Carregar mais {PAGINA}</Botao>
          <Botao variante="secundario" onClick={() => carregar(Math.ceil(LIMITE_TOTAL / PAGINA))}>Carregar todos</Botao>
        </div>
      )}
      <Aviso tipo="info">
        <b>Bloquear</b> impede o uso do app e o acesso aos dados, e pode ser desfeito. <b>Excluir</b> apaga nome, e-mail e telefone da lista e bloqueia a conta para sempre.
        O cadastro de login da pessoa continua existindo até ser removido em <i>Firebase → Authentication → Usuários</i> (necessário apenas se ela precisar se cadastrar de novo com o mesmo e-mail).
      </Aviso>
    </div>
  );
}


// ======================= MENSAGEM AOS USUÁRIOS =======================
const LIMITE_AVISO = 500, LIMITE_EMAIL_ENVIO = 500;

function EnviarMensagem({ destinatarios, auditar, fechar }: { destinatarios: UsuarioApp[]; auditar: Auditar; fechar: () => void }) {
  const [noApp, setNoApp] = useState(true);
  const [porEmail, setPorEmail] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [dias, setDias] = useState(7);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const comEmail = destinatarios.filter((u) => u.email);
  const tamanhoAviso = assunto.trim().length + texto.trim().length + 3;
  const grande = noApp && tamanhoAviso > LIMITE_AVISO;

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro(""); setOk("");
    const a = assunto.trim(), t = texto.trim();
    if (!noApp && !porEmail) return setErro("Escolha pelo menos um canal: no aplicativo ou por e-mail.");
    if (a.length < 3 || t.length < 3) return setErro("Preencha o assunto e a mensagem.");
    if (grande) return setErro(`Para o aviso no aplicativo, assunto + mensagem devem ter até ${LIMITE_AVISO} caracteres (agora ${tamanhoAviso}).`);
    if (porEmail && comEmail.length > LIMITE_EMAIL_ENVIO) return setErro(`Por e-mail, envie para no máximo ${LIMITE_EMAIL_ENVIO} pessoas por vez. Use os filtros para dividir.`);
    if (!confirm(`Enviar para ${destinatarios.length} usuário(s)${noApp ? " no aplicativo" : ""}${noApp && porEmail ? " e" : ""}${porEmail ? " por e-mail" : ""}?`)) return;

    setEnviando(true);
    const falhas: string[] = [];
    let app = 0, mail = 0;
    if (noApp) {
      try {
        const expiraEm = Timestamp.fromMillis(Date.now() + dias * 86_400_000);
        for (let i = 0; i < destinatarios.length; i += 400) {
          const lote = writeBatch(db);
          destinatarios.slice(i, i + 400).forEach((u) => lote.set(doc(colM("notificacoes")), {
            uid: u.id, protocoloId: "", tipo: "aviso", mensagem: `${a}\n${t}`, criadoEm: serverTimestamp(), expiraEm,
          }));
          await lote.commit(); app += Math.min(400, destinatarios.length - i);
        }
      } catch (err) { falhas.push(`Aviso no aplicativo: ${mensagemDeErro(err)}`); }
    }
    if (porEmail) {
      for (let i = 0; i < comEmail.length; i += 100) {
        const m = await enviarEmailUsuarios(comEmail.slice(i, i + 100).map((u) => u.email), a, t);
        if (m) { falhas.push(`E-mail: ${m}`); break; }
        mail += Math.min(100, comEmail.length - i);
      }
    }
    await auditar("mensagem.enviar", `${destinatarios.length} usuário(s)`, `${a} | app: ${app} | e-mail: ${mail}`);
    setEnviando(false);
    if (falhas.length) setErro(falhas.join(" "));
    if (app || mail) { setOk(`Enviado: ${app} aviso(s) no aplicativo e ${mail} e-mail(s).`); setTexto(""); setAssunto(""); }
  }

  return (
    <Cartao className="space-y-3 border-brand">
      <h3 className="font-semibold">Nova mensagem para {destinatarios.length} usuário(s)</h3>
      <form onSubmit={enviar} className="space-y-3">
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 text-sm font-medium">Enviar por</legend>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={noApp} onChange={(e) => setNoApp(e.target.checked)} /> Aviso no aplicativo</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={porEmail} onChange={(e) => setPorEmail(e.target.checked)} /> E-mail ({comEmail.length} com e-mail)</label>
        </fieldset>
        <Campo rotulo="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={120} required />
        <label className="block text-sm"><span className="mb-1 block font-medium">Mensagem</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={porEmail && !noApp ? 2000 : LIMITE_AVISO} required className="w-full rounded-lg border px-3 py-2" /></label>
        {noApp && <p className={`text-xs ${grande ? "text-red-700" : "text-slate-600"}`}>Aviso no aplicativo: {tamanhoAviso}/{LIMITE_AVISO} caracteres (assunto + mensagem).</p>}
        {noApp && (
          <label className="block text-sm">O aviso fica visível por{" "}
            <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-lg border bg-white px-2 py-1.5">
              <option value={2}>2 dias</option><option value={7}>7 dias</option><option value={15}>15 dias</option><option value={30}>30 dias</option>
            </select> e some sozinho.</label>
        )}
        {porEmail && <Aviso tipo="info">O e-mail sai do remetente configurado no Cloudflare (RESEND_FROM). No plano gratuito do Resend o limite é de cerca de 100 e-mails por dia.</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        <div className="flex gap-2">
          <Botao type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</Botao>
          <Botao type="button" variante="secundario" onClick={fechar}>Fechar</Botao>
        </div>
      </form>
    </Cartao>
  );
}
