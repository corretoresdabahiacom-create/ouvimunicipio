import { useEffect, useState, type FormEvent } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { PLANOS, type PlanoMunicipio } from "../lib/types";
import { Aviso, Botao, Campo, Cartao, Carregando } from "./ui";
import { auth } from "../lib/firebase";

interface Mun { id: string; nome: string; ativo: boolean; plano: PlanoMunicipio; excluido: boolean }

// Painel do dono do SaaS. Cria, edita, suspende e exclui municípios e cadastra o 1º administrador de cada um.
// Não existe aqui nenhuma tela que leia protocolos, conversas ou usuários (as regras também não deixam).
export function PainelSuperAdmin() {
  const { sair } = useAuth();
  const [lista, setLista] = useState<Mun[] | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [f, setF] = useState({ slug: "", nome: "", plano: "basico" as PlanoMunicipio });
  const [adm, setAdm] = useState({ mun: "", email: "", nome: "" });
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [excluindo, setExcluindo] = useState<{ id: string; confirma: string } | null>(null);

  useEffect(() => onSnapshot(collection(db, "municipios"),
    (s) => setLista(s.docs.map((d) => ({ id: d.id, nome: String(d.get("nome")), ativo: d.get("ativo") === true, plano: (d.get("plano") ?? "basico") as PlanoMunicipio, excluido: d.get("excluido") === true }))
      .sort((a, b) => a.nome.localeCompare(b.nome))),
    (e) => { setErro(mensagemDeErro(e)); setLista([]); }), []);

  async function criar(e: FormEvent) {
    e.preventDefault(); setErro(""); setOk("");
    const slug = f.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) return setErro("Endereço: 2 a 40 caracteres, só letras minúsculas, números e hífen.");
    if (["superadmin", "api", "assets", "icons"].includes(slug)) return setErro("Esse endereço é reservado.");
    if (lista?.some((m) => m.id === slug)) return setErro("Esse endereço já existe (ou pertence a um município excluído). Escolha outro.");
    if (f.nome.trim().length < 2) return setErro("Informe o nome do município.");
    try {
      await setDoc(doc(db, "municipios", slug), { nome: f.nome.trim(), ativo: true, plano: f.plano, criadoEm: serverTimestamp() });
      setOk(`Município criado: /${slug}. Cadastre agora o administrador dele.`); setAdm({ ...adm, mun: slug }); setF({ slug: "", nome: "", plano: "basico" });
    } catch (err) { setErro(mensagemDeErro(err)); }
  }
  async function salvarNome(e: FormEvent) {
    e.preventDefault(); setErro(""); setOk("");
    if (!editando) return;
    const nome = editando.nome.trim();
    if (nome.length < 2) return setErro("Nome: pelo menos 2 caracteres.");
    try { await updateDoc(doc(db, "municipios", editando.id), { nome }); setEditando(null); setOk("Nome atualizado."); }
    catch (err) { setErro(mensagemDeErro(err)); }
  }
  async function excluir(e: FormEvent) {
    e.preventDefault(); setErro(""); setOk("");
    if (!excluindo) return;
    if (excluindo.confirma.trim().toLowerCase() !== excluindo.id) return setErro(`Para confirmar, digite exatamente: ${excluindo.id}`);
    try {
      await updateDoc(doc(db, "municipios", excluindo.id), { excluido: true, ativo: false, excluidoEm: serverTimestamp() });
      setOk(`Município /${excluindo.id} excluído: ninguém mais acessa e o endereço não pode ser reutilizado. Os dados continuam guardados até você rodar o script de apagamento definitivo (veja SETUP_FIREBASE.md).`);
      setExcluindo(null);
    } catch (err) { setErro(mensagemDeErro(err)); }
  }

  async function alterar(m: Mun, dados: Partial<Pick<Mun, "ativo" | "plano">>) {
    setErro(""); setOk("");
    try { await updateDoc(doc(db, "municipios", m.id), dados); } catch (err) { setErro(mensagemDeErro(err)); }
  }
  async function criarAdmin(e: FormEvent) {
    e.preventDefault(); setErro(""); setOk("");
    const email = adm.email.trim().toLowerCase();
    if (!adm.mun) return setErro("Escolha o município.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErro("E-mail inválido.");
    if (email === (auth.currentUser?.email ?? "").toLowerCase())
      return setErro("Use outro e-mail: por segurança, o superadmin não pode ser administrador de município (o administrador vê os usuários).");
    if (adm.nome.trim().length < 2) return setErro("Informe o nome.");
    try {
      await setDoc(doc(db, "municipios", adm.mun, "equipe", email), { nome: adm.nome.trim(), papel: "admin", ativo: true });
      setOk(`Administrador cadastrado em /${adm.mun}. Peça para a pessoa criar a conta nesse endereço com este e-mail e confirmá-lo.`);
      setAdm({ ...adm, email: "", nome: "" });
    } catch (err) { setErro(mensagemDeErro(err)); }
  }

  if (lista === null) return <Carregando />;
  const sel = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Painel do SaaS — municípios</h1>
        <Botao variante="secundario" onClick={() => void sair()}>Sair</Botao>
      </div>
      <Aviso tipo="info">Aqui você cria, edita, suspende e exclui municípios. Por segurança, este painel <b>não mostra</b> protocolos, conversas nem usuários.</Aviso>
      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Novo município</h2>
        <form onSubmit={criar} className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Endereço (ex.: itabuna)" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} maxLength={40} required
            dica={`Vira o link: ${location.host}/${f.slug.trim().toLowerCase() || "itabuna"}. Só minúsculas, números e hífen; não muda depois.`} />
          <Campo rotulo="Nome" dica="Nome oficial. Ex.: Prefeitura Municipal de Itabuna." value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={120} required />
          <label className="block"><span className="mb-1 block text-sm font-medium">Plano</span>
            <select value={f.plano} onChange={(e) => setF({ ...f, plano: e.target.value as PlanoMunicipio })} className={sel}>
              {Object.entries(PLANOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
          <div className="sm:col-span-3"><Botao type="submit">Criar município</Botao></div>
        </form>
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Administrador do município</h2>
        <form onSubmit={criarAdmin} className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-sm font-medium">Município</span>
            <select value={adm.mun} onChange={(e) => setAdm({ ...adm, mun: e.target.value })} className={sel} required>
              <option value="">Selecione…</option>{lista.filter((m) => !m.excluido).map((m) => <option key={m.id} value={m.id}>{m.nome} (/{m.id})</option>)}</select></label>
          <Campo rotulo="E-mail" type="email" dica="De quem vai administrar. Diferente do seu e-mail de superadmin." value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} required />
          <Campo rotulo="Nome" dica="Nome da pessoa (aparece no registro de ações)." value={adm.nome} onChange={(e) => setAdm({ ...adm, nome: e.target.value })} maxLength={120} required />
          <div className="sm:col-span-3"><Botao type="submit">Cadastrar administrador</Botao></div>
        </form>
      </Cartao>

      <Cartao>
        <h2 className="mb-2 font-semibold">Municípios ({lista.filter((m) => !m.excluido).length})</h2>
        {lista.filter((m) => !m.excluido).length === 0 && <p className="text-slate-600">Nenhum município ainda.</p>}
        <ul className="divide-y">
          {lista.filter((m) => !m.excluido).map((m) => (
            <li key={m.id} className="space-y-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{m.nome} {!m.ativo && <span className="text-xs font-normal text-red-700">· suspenso</span>}</p>
                  <a href={`/${m.id}`} className="text-sm text-brand underline">/{m.id}</a>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label={`Plano de ${m.nome}`} value={m.plano} onChange={(e) => void alterar(m, { plano: e.target.value as PlanoMunicipio })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                    {Object.entries(PLANOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
                  <Botao variante="secundario" onClick={() => { setEditando({ id: m.id, nome: m.nome }); setExcluindo(null); }}>Editar</Botao>
                  <Botao variante="secundario" onClick={() => void alterar(m, { ativo: !m.ativo })}>{m.ativo ? "Suspender" : "Reativar"}</Botao>
                  <Botao variante="link" onClick={() => { setExcluindo({ id: m.id, confirma: "" }); setEditando(null); }}>Excluir</Botao>
                </div>
              </div>
              {editando?.id === m.id && (
                <form onSubmit={salvarNome} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
                  <div className="min-w-56 flex-1"><Campo rotulo="Nome do município" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} maxLength={120} required /></div>
                  <Botao type="submit">Salvar</Botao>
                  <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
                  <p className="w-full text-xs text-slate-600">O endereço (/{m.id}) não pode ser alterado, porque os links e o app instalado nos celulares dependem dele.</p>
                </form>
              )}
              {excluindo?.id === m.id && (
                <form onSubmit={excluir} className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3">
                  <p className="text-sm text-red-900"><b>Excluir {m.nome}?</b> Ninguém mais acessa /{m.id}, ele some desta lista e o endereço não poderá ser usado de novo.
                    Os dados (protocolos, usuários) continuam guardados até você rodar o apagamento definitivo. <b>Não dá para desfazer pelo painel.</b>
                    Se for só uma pausa, use "Suspender".</p>
                  <Campo rotulo={`Para confirmar, digite: ${m.id}`} value={excluindo.confirma} onChange={(e) => setExcluindo({ ...excluindo, confirma: e.target.value })} autoComplete="off" />
                  <div className="flex gap-2">
                    <Botao type="submit">Excluir definitivamente</Botao>
                    <Botao type="button" variante="secundario" onClick={() => setExcluindo(null)}>Cancelar</Botao>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
        {lista.some((m) => m.excluido) && (
          <p className="mt-2 text-xs text-slate-600">Excluídos (endereços bloqueados): {lista.filter((m) => m.excluido).map((m) => `/${m.id}`).join(", ")}</p>
        )}
      </Cartao>
    </main>
  );
}
