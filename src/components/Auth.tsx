import { useState, type FormEvent } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { MailCheck } from "lucide-react";
import { auth } from "../lib/firebase";
import { mensagemDeErro } from "../lib/erros";
import { useAuth } from "../lib/useAuth";
import { Botao, Campo, Cartao, Aviso } from "./ui";
import { BotaoLibras, Carrossel, Logo } from "./Marca";
import { idMunicipio } from "../lib/municipio";
import { useSite } from "../lib/useConfig";
import { LinkLegal } from "./Legal";
import { VERSAO_TERMOS } from "../lib/types";

type Modo = "entrar" | "cadastrar" | "recuperar";

export function TelaAuth() {
  const [modo, setModo] = useState<Modo>("entrar");
  const { nome: municipio, transparencia } = useSite();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(""); setInfo(""); setOcupado(true);
    try {
      if (modo === "entrar") {
        await signInWithEmailAndPassword(auth, email.trim(), senha);
      } else if (modo === "cadastrar") {
        if (nome.trim().length < 3) throw new Error("Informe seu nome completo.");
        if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) throw new Error("A senha precisa ter 8 ou mais caracteres, com letras e números.");
        if (!aceite) throw new Error("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.");
        const tel = telefone.replace(/\D/g, "");
        if (tel && !/^[0-9]{10,13}$/.test(tel)) throw new Error("Telefone inválido. Use DDD + número, ou deixe em branco.");
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
        try { if (tel) localStorage.setItem(`tel:${cred.user.uid}`, tel); localStorage.setItem(`aceite:${cred.user.uid}`, VERSAO_TERMOS); } catch { /* ignore */ }
        await updateProfile(cred.user, { displayName: nome.trim().slice(0, 120) });
        await sendEmailVerification(cred.user);
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo("Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha.");
      }
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally { setOcupado(false); }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <header className="flex flex-col items-center gap-2 text-center">
        <Logo tamanho="size-20" className="text-brand" />
        <h1 className="text-2xl font-bold text-brand">{municipio}</h1>
        <p className="text-sm font-medium text-slate-700">Ouvidoria Municipal</p>
        <p className="text-sm text-slate-600">Envie sua mensagem à secretaria e acompanhe o protocolo.</p>
      </header>
      <div className="flex justify-center"><BotaoLibras /></div>
      <Carrossel />
      <Cartao>
        <h2 className="mb-4 text-lg font-semibold">{modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar conta" : "Recuperar senha"}</h2>
        <form onSubmit={enviar} className="space-y-3">
          {modo === "cadastrar" && <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required maxLength={120} />}
          {modo === "cadastrar" && <Campo rotulo="Telefone (opcional)" type="tel" inputMode="numeric" value={telefone} onChange={(e) => setTelefone(e.target.value)} autoComplete="tel" maxLength={20} dica="DDD + número. Só a prefeitura vê, para contato." />}
          <Campo rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} />
          {modo !== "recuperar" && (
            <Campo rotulo="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              dica={modo === "cadastrar" ? "Mínimo de 8 caracteres, com letras e números." : undefined} />
          )}
          {modo === "cadastrar" && (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-1 size-4" />
              <span>Li e aceito os <LinkLegal>Termos de Uso e a Política de Privacidade</LinkLegal>. Meus dados serão usados apenas para atender minhas solicitações.</span>
            </label>
          )}
          {erro && <Aviso>{erro}</Aviso>}
          {info && <Aviso tipo="ok">{info}</Aviso>}
          <Botao type="submit" carregando={ocupado} className="w-full">
            {modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Cadastrar" : "Enviar link"}
          </Botao>
        </form>
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
          {modo !== "entrar" && <Botao variante="link" onClick={() => { setModo("entrar"); setErro(""); setInfo(""); }}>Já tenho conta</Botao>}
          {modo === "entrar" && <Botao variante="link" onClick={() => { setModo("cadastrar"); setErro(""); }}>Criar conta</Botao>}
          {modo === "entrar" && <Botao variante="link" onClick={() => { setModo("recuperar"); setErro(""); }}>Esqueci a senha</Botao>}
        </div>
      </Cartao>
      {transparencia && idMunicipio() && (
        <p className="text-center text-sm"><a href={`/${idMunicipio()}/transparencia`} className="font-medium text-brand underline">Painel de transparência da Ouvidoria</a></p>
      )}
    </main>
  );
}

export function TelaConfirmarEmail() {
  const { user, recarregar, sair } = useAuth();
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function reenviar() {
    setErro(""); setMsg("");
    try { if (user) { await sendEmailVerification(user); setMsg("Enviamos um novo e-mail. Verifique também a caixa de spam."); } }
    catch (e) { setErro(mensagemDeErro(e)); }
  }
  async function jaConfirmei() {
    setErro(""); setMsg(""); setOcupado(true);
    try { await recarregar(); if (!auth.currentUser?.emailVerified) setErro("Ainda não identificamos a confirmação. Abra o link do e-mail e tente de novo."); }
    catch (e) { setErro(mensagemDeErro(e)); }
    finally { setOcupado(false); }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <Cartao className="space-y-4 text-center">
        <MailCheck className="mx-auto size-12 text-brand" aria-hidden />
        <h1 className="text-xl font-bold">Confirme seu e-mail</h1>
        <p className="text-slate-600">Enviamos um link de confirmação para <b>{user?.email}</b>. Abra o e-mail e clique no link. Sem a confirmação, o acesso fica bloqueado.</p>
        {erro && <Aviso>{erro}</Aviso>}
        {msg && <Aviso tipo="ok">{msg}</Aviso>}
        <div className="flex flex-col gap-2">
          <Botao onClick={jaConfirmei} carregando={ocupado}>Já confirmei</Botao>
          <Botao variante="secundario" onClick={reenviar}>Reenviar e-mail</Botao>
          <Botao variante="link" onClick={sair}>Sair</Botao>
        </div>
      </Cartao>
    </main>
  );
}
