import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { mensagemDeErro } from "../lib/erros";
import { Aviso, Botao } from "./ui";

interface Adm { email: string; nome: string; ativo: boolean }

// Administradores de um município (só eles: as regras não deixam o superadmin ler secretários, ouvidores etc.).
// Serve para corrigir um e-mail digitado errado: cadastre o certo e remova o errado. Desativar tira o acesso na hora.
export function AdminsDoMunicipio({ mun, nomeMun }: { mun: string; nomeMun: string }) {
  const [lista, setLista] = useState<Adm[] | null>(null);
  const [erro, setErro] = useState("");
  const [removendo, setRemovendo] = useState("");

  useEffect(() => onSnapshot(query(collection(db, "municipios", mun, "equipe"), where("papel", "==", "admin")),
    (s) => setLista(s.docs.map((d) => ({ email: d.id, nome: String(d.get("nome") ?? ""), ativo: d.get("ativo") === true })).sort((a, b) => a.email.localeCompare(b.email))),
    (e) => { setErro(mensagemDeErro(e)); setLista([]); }), [mun]);

  async function alternar(a: Adm) {
    setErro("");
    try { await updateDoc(doc(db, "municipios", mun, "equipe", a.email), { ativo: !a.ativo }); } catch (e) { setErro(mensagemDeErro(e)); }
  }
  async function remover(a: Adm) {
    setErro("");
    try { await deleteDoc(doc(db, "municipios", mun, "equipe", a.email)); setRemovendo(""); } catch (e) { setErro(mensagemDeErro(e)); }
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <h3 className="text-sm font-semibold">Administradores de {nomeMun}</h3>
      {erro && <Aviso>{erro}</Aviso>}
      {lista === null && <p className="text-sm text-slate-600">Carregando…</p>}
      {lista?.length === 0 && !erro && <p className="text-sm text-slate-600">Nenhum administrador cadastrado. Use "Administrador do município" acima.</p>}
      <ul className="divide-y">
        {lista?.map((a) => (
          <li key={a.email} className="space-y-2 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{a.nome} {!a.ativo && <span className="text-xs font-normal text-red-700">· desativado</span>}</p>
                <p className="truncate text-sm text-slate-600">{a.email}</p></div>
              <div className="flex gap-2">
                <Botao variante="secundario" onClick={() => void alternar(a)}>{a.ativo ? "Desativar" : "Reativar"}</Botao>
                <Botao variante="link" onClick={() => setRemovendo(removendo === a.email ? "" : a.email)}>Remover</Botao>
              </div>
            </div>
            {removendo === a.email && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                Remover <b>{a.email}</b> da administração de {nomeMun}? A pessoa perde o acesso de administrador na hora (a conta de login dela continua existindo e
                pode ser cidadã normalmente). Para mudar o e-mail, cadastre o novo antes.
                <div className="mt-2 flex gap-2"><Botao onClick={() => void remover(a)}>Remover</Botao>
                  <Botao variante="secundario" onClick={() => setRemovendo("")}>Cancelar</Botao></div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
