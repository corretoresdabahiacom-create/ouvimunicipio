import type { Timestamp } from "firebase/firestore";

export type Papel = "cidadao" | "admin" | "secretario" | "assessor";

export type Situacao = "ativo" | "bloqueado" | "excluido";

export interface Perfil {
  uid: string;
  email: string;
  nome: string;
  telefone?: string;
  papel: Papel;
  secretariaId?: string;
  situacao: Situacao;
}

export interface UsuarioApp {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  situacao: Situacao;
  criadoEm: Timestamp | null;
}

export interface Secretaria { id: string; nome: string; ativa: boolean }

export interface MembroEquipe {
  email: string; // ID do documento
  nome: string;
  papel: "admin" | "secretario" | "assessor";
  secretariaId?: string;
  ativo: boolean;
}

export interface AnexoMeta { k: string; nome: string; tipo: "imagem" | "video"; mime: string; partes: number; bytes: number }

export interface Protocolo {
  id: string;
  numero: string;
  autorUid: string;
  secretariaId: string;
  secretariaNome: string;
  assunto: string;
  mensagem: string;
  anexos: AnexoMeta[];
  status: "aberto" | "respondido";
  criadoEm: Timestamp | null;
  resposta?: string;
  respondidoEm?: Timestamp | null;
}

export interface Notificacao {
  id: string;
  uid: string;
  protocoloId: string;
  tipo: "recebido" | "resposta";
  mensagem: string;
  criadoEm: Timestamp | null;
  expiraEm: Timestamp;
}

export const PRAZO_DIAS = 30;
export const AVISO_HORAS = 24;
