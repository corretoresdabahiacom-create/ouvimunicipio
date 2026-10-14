import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { Pencil, Trash2 } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { registrarAuditoria } from "../lib/audit";
import type { MembroEquipe, Secretaria } from "../lib/types";
import { Aviso, Botao, Campo, Cartao, Carregando } from "./ui";
import { Aparencia, Publicidade, Usuarios } from "./AdminExtra";

function useColecao<T>(nome: string, mapear: (id: string, d: Record<string, unknown>) => T) {
  const [dados, setDados] = useState<T[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => onSnapshot(collection(db, nome),
    (s) => setDados(s.docs.map((d) => mapear(d.id, d.data()))),
    (e) => { setErro(mensagemDeErro(e)); setDados([]); }), [nome]); // eslint-disable-line react-hooks/exhaustive-deps
  return { dados, erro };
}

const PAPEL_ROTULO = { admin: "Administrador", secretario: "Secretário(a)", assessor: "Assessor(a)" } as const;

export function PainelAdmin() {
  const [aba, setAba] = useState<"secretarias" | "equipe" | "usuarios" | "aparencia" | "publicidade">("secretarias");
  const [aviso, setAviso] = useState("");
  const sec = useColecao<Secretaria>("secretarias", (id, d) => ({ id, nome: String(d.nome), ativa: d.ativa === true }));
  const eq = useColecao<MembroEquipe>("equipe", (id, d) => ({ email: id, nome: String(d.nome), papel: d.papel as MembroEquipe["papel"], secretariaId: d.secretariaId as string | undefined, ativo: d.ativo === true }));

  async function auditar(acao: string, alvo: string, detalhe = "") {
    const ok = await registrarAuditoria(acao, alvo, detalhe);
    setAviso(ok ? "" : "Ação concluída, mas o e-mail de auditoria não pôde ser enviado.");
  }

  if (sec.dados === null || eq.dados === null) return <Carregando />;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Administração</h2>
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {([["secretarias", "Secretarias"], ["equipe", "Servidores"], ["usuarios", "Usuários"], ["aparencia", "Aparência"], ["publicidade", "Publicidade"]] as const).map(([a, rotulo]) => (
          <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${aba === a ? "bg-brand text-white" : "border bg-white text-slate-700"}`}>
            {rotulo}
          </button>
        ))}
      </div>
      {(sec.erro || eq.erro) && <Aviso>{sec.erro || eq.erro}</Aviso>}
      {aviso && <Aviso tipo="info">{aviso}</Aviso>}
      {aba === "secretarias" ? <Secretarias lista={sec.dados} equipe={eq.dados} auditar={auditar} />
        : aba === "equipe" ? <Equipe lista={eq.dados} secretarias={sec.dados} auditar={auditar} />
        : aba === "usuarios" ? <Usuarios auditar={auditar} />
        : aba === "aparencia" ? <Aparencia auditar={auditar} />
        : <Publicidade auditar={auditar} />}
    </div>
  );
}

type Auditar = (acao: string, alvo: string, detalhe?: string) => Promise<void>;

function Secretarias({ lista, equipe, auditar }: { lista: Secretaria[]; equipe: MembroEquipe[]; auditar: Auditar }) {
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault(); setErro("");
    const n = nome.trim();
    if (n.length < 2) return setErro("Informe o nome da secretaria.");
    try {
      if (editando) { await updateDoc(doc(db, "secretarias", editando), { nome: n }); await auditar("secretaria.editar", n); }
      else { await addDoc(collection(db, "secretarias"), { nome: n, ativa: true }); await auditar("secretaria.criar", n); }
      setNome(""); setEditando(null);
    } catch (err) { setErro(mensagemDeErro(err)); }
  }
  async function alternar(s: Secretaria) {
    try { await updateDoc(doc(db, "secretarias", s.id), { ativa: !s.ativa }); await auditar("secretaria.editar", s.nome, s.ativa ? "desativada" : "ativada"); }
    catch (err) { setErro(mensagemDeErro(err)); }
  }
  async function excluir(s: Secretaria) {
    if (equipe.some((m) => m.secretariaId === s.id)) return setErro("Há servidores nesta secretaria. Mova ou remova-os antes.");
    if (!confirm(`Excluir a secretaria "${s.nome}"? Protocolos já enviados são mantidos.`)) return;
    try { await deleteDoc(doc(db, "secretarias", s.id)); await auditar("secretaria.excluir", s.nome); }
    catch (err) { setErro(mensagemDeErro(err)); }
  }

  return (
    <Cartao className="space-y-4">
      <form onSubmit={salvar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1"><Campo rotulo={editando ? "Editar nome" : "Nova secretaria"} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} /></div>
        <Botao type="submit">{editando ? "Salvar" : "Adicionar"}</Botao>
        {editando && <Botao type="button" variante="secundario" onClick={() => { setEditando(null); setNome(""); }}>Cancelar</Botao>}
      </form>
      {erro && <Aviso>{erro}</Aviso>}
      <ul className="divide-y">
        {[...lista].sort((a, b) => a.nome.localeCompare(b.nome)).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className={s.ativa ? "" : "text-slate-400 line-through"}>{s.nome}</span>
            <span className="flex items-center gap-1">
              <Botao variante="link" onClick={() => alternar(s)}>{s.ativa ? "Desativar" : "Ativar"}</Botao>
              <button aria-label={`Editar ${s.nome}`} className="p-2" onClick={() => { setEditando(s.id); setNome(s.nome); }}><Pencil className="size-4" /></button>
              <button aria-label={`Excluir ${s.nome}`} className="p-2 text-red-600" onClick={() => excluir(s)}><Trash2 className="size-4" /></button>
            </span>
          </li>
        ))}
        {lista.length === 0 && <li className="py-2 text-slate-600">Nenhuma secretaria cadastrada.</li>}
      </ul>
    </Cartao>
  );
}

function Equipe({ lista, secretarias, auditar }: { lista: MembroEquipe[]; secretarias: Secretaria[]; auditar: Auditar }) {
  const { perfil } = useAuth();
  const vazio = { email: "", nome: "", papel: "secretario" as MembroEquipe["papel"], secretariaId: "", ativo: true };
  const [f, setF] = useState(vazio);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault(); setErro("");
    const email = f.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErro("E-mail inválido.");
    if (f.nome.trim().length < 2) return setErro("Informe o nome.");
    if (f.papel !== "admin" && !f.secretariaId) return setErro("Escolha a secretaria.");
    try {
      const dados: Record<string, unknown> = { nome: f.nome.trim(), papel: f.papel, ativo: f.ativo };
      if (f.papel !== "admin") dados.secretariaId = f.secretariaId;
      await setDoc(doc(db, "equipe", email), dados);
      await auditar(editando ? "servidor.editar" : "servidor.criar", email, `${PAPEL_ROTULO[f.papel]}${f.papel !== "admin" ? ` – ${secretarias.find((s) => s.id === f.secretariaId)?.nome ?? ""}` : ""}${f.ativo ? "" : " (inativo)"}`);
      setF(vazio); setEditando(false);
    } catch (err) { setErro(mensagemDeErro(err)); }
  }
  async function excluir(m: MembroEquipe) {
    if (!confirm(`Remover o acesso de ${m.nome} (${m.email})?`)) return;
    try { await deleteDoc(doc(db, "equipe", m.email)); await auditar("servidor.excluir", m.email); }
    catch (err) { setErro(mensagemDeErro(err)); }
  }

  return (
    <Cartao className="space-y-4">
      <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="E-mail do servidor" type="email" value={f.email} disabled={editando} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={120} required />
        <label className="block"><span className="mb-1 block text-sm font-medium">Função</span>
          <select value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value as MembroEquipe["papel"] })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            {Object.entries(PAPEL_ROTULO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select></label>
        {f.papel !== "admin" && (
          <label className="block"><span className="mb-1 block text-sm font-medium">Secretaria</span>
            <select value={f.secretariaId} onChange={(e) => setF({ ...f, secretariaId: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" required>
              <option value="">Selecione…</option>
              {secretarias.filter((s) => s.ativa).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select></label>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} className="size-4" /> Acesso ativo</label>
        <div className="flex gap-2 sm:col-span-2">
          <Botao type="submit">{editando ? "Salvar alterações" : "Cadastrar servidor"}</Botao>
          {editando && <Botao type="button" variante="secundario" onClick={() => { setF(vazio); setEditando(false); }}>Cancelar</Botao>}
        </div>
      </form>
      <Aviso tipo="info">Depois de cadastrar, peça à pessoa para criar a conta no app com <b>este mesmo e-mail</b> e confirmar o e-mail. O acesso só vale após a confirmação.</Aviso>
      {erro && <Aviso>{erro}</Aviso>}
      <ul className="divide-y">
        {[...lista].sort((a, b) => a.nome.localeCompare(b.nome)).map((m) => (
          <li key={m.email} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className={m.ativo ? "" : "opacity-50"}>
              <p className="font-medium">{m.nome} <span className="text-xs font-normal text-slate-500">· {PAPEL_ROTULO[m.papel]}</span></p>
              <p className="text-sm text-slate-600">{m.email}{m.secretariaId ? ` · ${secretarias.find((s) => s.id === m.secretariaId)?.nome ?? "secretaria removida"}` : ""}{m.ativo ? "" : " · inativo"}</p>
            </div>
            <span className="flex">
              <button aria-label={`Editar ${m.nome}`} className="p-2" onClick={() => { setF({ email: m.email, nome: m.nome, papel: m.papel, secretariaId: m.secretariaId ?? "", ativo: m.ativo }); setEditando(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="size-4" /></button>
              {m.email !== perfil?.email && <button aria-label={`Remover ${m.nome}`} className="p-2 text-red-600" onClick={() => excluir(m)}><Trash2 className="size-4" /></button>}
            </span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
