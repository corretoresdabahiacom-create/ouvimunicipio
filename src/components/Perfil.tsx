import { useState, type FormEvent } from "react";
import { deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
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
      await updateDoc(doc(db, "users", perfil!.uid), { nome: nome.trim().slice(0, 120), email: perfil!.email, telefone: t ? t : deleteField() });
      await recarregar();
      setMsg("Dados atualizados.");
    } catch (err) { setErro(mensagemDeErro(err)); }
    finally { setOcupado(false); }
  }

  return (
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
  );
}
