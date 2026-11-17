import { useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { docM } from "../lib/municipio";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import { X } from "lucide-react";
import { useSite } from "../lib/useConfig";
import { VERSAO_TERMOS } from "../lib/types";
import { Aviso, Botao, Cartao } from "./ui";

/** Textos-modelo. A prefeitura deve revisá-los com a assessoria jurídica e o encarregado de dados (LGPD). */
export function Termos() {
  const { nome } = useSite();
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-800">
      <h3 className="text-base font-semibold">Termos de Uso</h3>
      <p>Versão {VERSAO_TERMOS}. Este serviço é a Ouvidoria Municipal de <b>{nome}</b>: um canal para você enviar reclamações, denúncias, solicitações, sugestões, elogios e pedidos de informação às secretarias, com protocolo e acompanhamento.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li><b>Cadastro.</b> Informe dados verdadeiros e confirme seu e-mail. A senha é pessoal; não a compartilhe. Você é responsável pelo que for feito com a sua conta.</li>
        <li><b>Uso adequado.</b> Não envie conteúdo ofensivo, ilegal ou falso, nem dados pessoais de terceiros sem necessidade. Fotos e vídeos devem ter relação com a manifestação.</li>
        <li><b>Prazos.</b> Cada protocolo recebe um número e tem prazo de 30 dias para a primeira resposta da secretaria, que pode ser prorrogado <b>uma única vez</b>, por mais 30 dias e com justificativa, nos termos da Lei nº 13.460/2017. A Ouvidoria pode encaminhar o protocolo a outra secretaria quando o assunto for de outro setor; você vê esse histórico no protocolo.</li>
        <li><b>Conversa.</b> Depois da primeira resposta a conversa continua no protocolo. Quando o atendimento é concluído, a conversa e os anexos são apagados 30 dias depois.</li>
        <li><b>Avisos.</b> O aplicativo avisa quando há resposta. Os avisos de resposta somem em 24 horas; o conteúdo permanece no protocolo.</li>
        <li><b>Suspensão.</b> A prefeitura pode bloquear contas usadas de forma abusiva ou fraudulenta.</li>
        <li><b>Alterações.</b> Estes termos podem mudar. Quando mudarem, pediremos um novo aceite.</li>
      </ol>
    </div>
  );
}

export function Politica() {
  const { nome, contato } = useSite();
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-800">
      <h3 className="text-base font-semibold">Política de Privacidade (LGPD)</h3>
      <p>Versão {VERSAO_TERMOS}. Controlador dos dados: <b>{nome}</b>. Contato do encarregado/ouvidoria: <b>{contato || "informado pela prefeitura no atendimento"}</b>.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li><b>Dados que tratamos.</b> Nome, e-mail, telefone (opcional), o texto das mensagens, fotos e vídeos que você anexar, e dados técnicos de acesso (login). Não usamos rastreadores de publicidade.</li>
        <li><b>Para quê.</b> Atender sua manifestação e prestar o serviço público de ouvidoria (LGPD, art. 7º, III e Lei nº 13.460/2017). O telefone e o envio de avisos por e-mail dependem do seu consentimento.</li>
        <li><b>Quem pode ver.</b> O conteúdo das mensagens e anexos é visível para <b>você, a secretaria responsável</b> e a <b>Ouvidoria geral do município</b>, que lê para encaminhar ao setor certo e cobrar respostas (ela não responde em nome da secretaria). O administrador do sistema vê a lista de usuários (nome, e-mail e telefone) para gerenciar contas e dados estatísticos do protocolo (número, tipo, secretaria, datas e nota), mas <b>não lê as conversas</b>. O prefeito vê <b>apenas números</b> (totais, prazos e notas), sem nomes nem conteúdo.</li>
        <li><b>Fornecedores.</b> Usamos Google Firebase (login e banco de dados), Cloudflare (hospedagem) e um serviço de envio de e-mails. Esses dados podem ficar em servidores fora do Brasil, com as garantias previstas na LGPD.</li>
        <li><b>Por quanto tempo.</b> Conversa e anexos: apagados 30 dias após a conclusão do atendimento. Dados do protocolo sem identificação (número, tipo, secretaria, datas e nota): mantidos para estatísticas e prestação de contas. Sua conta: até você pedir a exclusão.</li>
        <li><b>Seus direitos (art. 18).</b> Você pode acessar e corrigir seus dados em <i>Perfil</i>, pedir informações, revogar consentimentos e <b>excluir sua conta</b> a qualquer momento em <i>Perfil → Excluir minha conta</i>. A exclusão apaga nome, e-mail, telefone e login. Mensagens já enviadas continuam acessíveis apenas à secretaria e à Ouvidoria até 30 dias após a conclusão do protocolo, sem ligação com o seu nome.</li>
        <li><b>Segurança.</b> Conexão criptografada, e-mail confirmado, regras de acesso por pessoa, por secretaria e por município e bloqueio de contas. Nenhum sistema é totalmente imune; em caso de incidente relevante, a prefeitura comunicará conforme a lei.</li>
        <li><b>Dispositivo.</b> Guardamos no aparelho apenas o necessário para o funcionamento (login, cor e nome do município).</li>
      </ol>
    </div>
  );
}

/** Janela com os dois textos. */
export function JanelaLegal({ fechar }: { fechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={fechar} aria-label="Termos de uso e política de privacidade"
      className="m-auto max-h-[85dvh] w-[min(92vw,40rem)] overflow-y-auto rounded-xl p-4 backdrop:bg-black/50 sm:p-6">
      <div className="mb-3 flex justify-end">
        <button onClick={() => ref.current?.close()} aria-label="Fechar" className="rounded p-2"><X className="size-5" /></button>
      </div>
      <div className="space-y-6">
        <Aviso tipo="info">Texto-modelo. A prefeitura deve revisá-lo com sua assessoria jurídica e o encarregado de dados.</Aviso>
        <Termos />
        <Politica />
      </div>
      <div className="mt-4"><Botao onClick={() => ref.current?.close()}>Fechar</Botao></div>
    </dialog>
  );
}

export function LinkLegal({ children = "Termos de Uso e Política de Privacidade" }: { children?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="text-brand underline">{children}</button>
      {aberto && <JanelaLegal fechar={() => setAberto(false)} />}
    </>
  );
}

/** Tela exibida a quem ainda não aceitou a versão atual dos termos (contas antigas ou termos atualizados). */
export function AceiteTermos() {
  const { perfil, recarregar, sair } = useAuth();
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!perfil) return null;
  async function aceitar() {
    setErro(""); setOcupado(true);
    try {
      await updateDoc(docM("users", perfil!.uid), { email: perfil!.email, aceiteVersao: VERSAO_TERMOS, aceiteEm: serverTimestamp() });
      await recarregar();
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <Cartao className="space-y-4">
        <h1 className="text-xl font-bold">Termos de Uso e Privacidade</h1>
        <p className="text-slate-700">Para continuar, leia e aceite os termos. Você pode excluir sua conta a qualquer momento em <i>Perfil</i>.</p>
        <p><LinkLegal>Ler os Termos de Uso e a Política de Privacidade</LinkLegal></p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 size-4" />
          <span>Li e aceito os Termos de Uso e a Política de Privacidade.</span>
        </label>
        {erro && <Aviso>{erro}</Aviso>}
        <Botao onClick={aceitar} disabled={!ok} carregando={ocupado} className="w-full">Aceitar e continuar</Botao>
        <Botao variante="link" onClick={sair}>Sair sem aceitar</Botao>
      </Cartao>
    </main>
  );
}
