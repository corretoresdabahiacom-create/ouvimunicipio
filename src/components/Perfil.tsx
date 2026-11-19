import { useState, type FormEvent } from "react";
import { deleteField, deleteDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../lib/firebase";
import { colM, docM } from "../lib/municipio";
import { LinkLegal } from "./Legal";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { Aviso, Botao, Campo, Cartao } from "./ui";

export function Perfil() {
  const { perfil, recarregar } = useAuth();
  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [tel, setTel] = useState(perfil?.telefone ?? "");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!perfil) return null;

  async function salvar(e: FormEvent) {
    e.preventDefault(); setErro(""); setMsg("");
    const t = tel.replace(/\D/g, "");
    if (nome.trim().length < 3) return setErro("Informe seu nome completo.");
    if (t && !/^[0-9]{10,13}$/.test(t)) return setErro("Telefone inválido. Use DDD + número, ou deixe em branco.");
    setOcupado(true);
    try {
      await updateDoc(docM("users", perfil!.uid), { nome: nome.trim().slice(0, 120), email: perfil!.email, telefone: t ? t : deleteField() });
      await recarregar();
      setMsg("Dados atualizados.");
    } catch (err) { setErro(mensagemDeErro(err)); }
    finally { setOcupado(false); }
  }

  return (
    <div className="space-y-4">
    <Cartao>
      <h2 className="mb-4 text-lg font-semibold">Meus dados</h2>
      <form onSubmit={salvar} className="space-y-3">
        <Campo rotulo="E-mail" value={perfil.email} disabled readOnly />
        <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />
        <Campo rotulo="Telefone (opcional)" type="tel" inputMode="numeric" value={tel} onChange={(e) => setTel(e.target.value)} maxLength={20} dica="DDD + número. Só a prefeitura vê, para contato." />
        {erro && <Aviso>{erro}</Aviso>}
        {msg && <Aviso tipo="ok">{msg}</Aviso>}
        <Botao type="submit" carregando={ocupado}>Salvar</Botao>
      </form>
    </Cartao>
    <ExcluirConta />
    <p className="text-center text-sm"><LinkLegal /></p>
    </div>
  );
}

function ExcluirConta() {
  const { perfil } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!perfil) return null;

  if (perfil.papel !== "cidadao") return (
    <Cartao><h2 className="mb-2 font-semibold">Excluir minha conta</h2>
      <p className="text-sm text-slate-700">Contas da equipe da prefeitura são removidas pelo administrador.</p></Cartao>
  );

  async function excluir(e: FormEvent) {
    e.preventDefault(); setErro("");
    const user = auth.currentUser;
    if (!user?.email) return;
    if (!confirm("Excluir sua conta de forma definitiva? Isso não pode ser desfeito.")) return;
    setOcupado(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senha));
      const ns = await getDocs(query(colM("notificacoes"), where("uid", "==", user.uid)));
      await Promise.all(ns.docs.map((d) => deleteDoc(d.ref)));
      await updateDoc(docM("users", user.uid), { situacao: "excluido", nome: "(removido)", email: "", telefone: deleteField() });
      await deleteUser(user);
    } catch (err) { setErro(mensagemDeErro(err)); setOcupado(false); }
  }

  return (
    <Cartao className="space-y-3">
      <h2 className="font-semibold">Excluir minha conta</h2>
      {!aberto ? <Botao variante="secundario" onClick={() => setAberto(true)}>Quero excluir minha conta</Botao> : (
        <form onSubmit={excluir} className="space-y-3">
          <Aviso tipo="info">Apagamos seu nome, e-mail, telefone e o seu login. Mensagens que você já enviou continuam disponíveis apenas à secretaria e à Ouvidoria até 30 dias após a conclusão do protocolo, sem ligação com o seu nome. Não dá para desfazer. <b>O login é o mesmo em todos os municípios:</b> se você também usa a ouvidoria de outro município, exclua primeiro o cadastro lá, porque depois desta exclusão não será mais possível entrar.</Aviso>
          <Campo rotulo="Digite sua senha para confirmar" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
          {erro && <Aviso>{erro}</Aviso>}
          <div className="flex gap-2">
            <Botao type="submit" variante="perigo" carregando={ocupado}>Excluir definitivamente</Botao>
            <Botao type="button" variante="secundario" onClick={() => { setAberto(false); setSenha(""); setErro(""); }}>Cancelar</Botao>
          </div>
        </form>
      )}
    </Cartao>
  );
}
