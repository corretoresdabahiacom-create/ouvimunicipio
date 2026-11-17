import { useEffect, useState, type FormEvent } from "react";
import { addDoc, deleteDoc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { colM, docM } from "../lib/municipio";
import { mensagemDeErro } from "../lib/erros";
import type { Modelo } from "../lib/types";
import { Aviso, Botao, Campo, Cartao, Carregando } from "./ui";

// Respostas-modelo da secretaria: o secretário cria e edita; toda a equipe da secretaria usa ao responder.
export function GerirModelos({ secretariaId, podeEditar }: { secretariaId: string; podeEditar: boolean }) {
  const [lista, setLista] = useState<Modelo[] | null>(null);
  const [edit, setEdit] = useState<{ id: string | null; titulo: string; texto: string } | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => onSnapshot(query(colM("modelos"), where("secretariaId", "==", secretariaId)),
    (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Modelo).sort((a, b) => a.titulo.localeCompare(b.titulo))),
    (e) => { setErro(mensagemDeErro(e)); setLista([]); }), [secretariaId]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const titulo = edit.titulo.trim(), texto = edit.texto.trim();
    if (titulo.length < 3) return setErro("Título: pelo menos 3 caracteres.");
    if (!texto) return setErro("Escreva o texto do modelo.");
    setErro(""); setOcupado(true);
    try {
      const dados = { secretariaId, titulo, texto, atualizadoEm: serverTimestamp() };
      if (edit.id) await setDoc(docM("modelos", edit.id), dados);
      else await addDoc(colM("modelos"), dados);
      setEdit(null);
    } catch (err) { setErro(mensagemDeErro(err)); } finally { setOcupado(false); }
  }
  async function apagar(m: Modelo) {
    if (!window.confirm(`Apagar o modelo "${m.titulo}"?`)) return;
    try { await deleteDoc(docM("modelos", m.id)); } catch (err) { setErro(mensagemDeErro(err)); }
  }

  if (lista === null) return <Carregando />;
  return (
    <div className="space-y-3">
      <Aviso tipo="info">Textos prontos para agilizar as respostas. Ao responder, escolha em "Inserir resposta-modelo" e ajuste antes de enviar.
        Use <b>{"{numero}"}</b> e <b>{"{secretaria}"}</b> para preencher o número do protocolo e o nome da secretaria.
        {!podeEditar && " Só o secretário pode criar ou alterar modelos."}</Aviso>
      {erro && <Aviso>{erro}</Aviso>}
      {podeEditar && !edit && <Botao onClick={() => setEdit({ id: null, titulo: "", texto: "" })}>Novo modelo</Botao>}
      {edit && (
        <Cartao>
          <form onSubmit={salvar} className="space-y-3">
            <Campo rotulo="Título (só a equipe vê)" value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} maxLength={80} required />
            <label className="block"><span className="mb-1 block text-sm font-medium">Texto</span>
              <textarea value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} rows={6} maxLength={5000} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <div className="flex gap-2">
              <Botao type="submit" carregando={ocupado}>Salvar</Botao>
              <Botao type="button" variante="secundario" onClick={() => { setEdit(null); setErro(""); }}>Cancelar</Botao>
            </div>
          </form>
        </Cartao>
      )}
      {lista.length === 0 && <Cartao><p className="text-slate-600">Nenhum modelo ainda.</p></Cartao>}
      {lista.map((m) => (
        <Cartao key={m.id} className="space-y-2">
          <p className="font-semibold">{m.titulo}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{m.texto}</p>
          {podeEditar && (
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={() => setEdit({ id: m.id, titulo: m.titulo, texto: m.texto })}>Editar</Botao>
              <Botao variante="link" onClick={() => void apagar(m)}>Apagar</Botao>
            </div>
          )}
        </Cartao>
      ))}
    </div>
  );
}
