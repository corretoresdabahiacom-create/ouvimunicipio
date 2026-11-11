import type { Timestamp } from "firebase/firestore";

export type Papel = "cidadao" | "admin" | "secretario" | "assessor" | "ouvidor" | "prefeito";

export type Situacao = "ativo" | "bloqueado" | "excluido";

export interface Perfil {
  aceiteVersao?: string;
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
  papel: "admin" | "secretario" | "assessor" | "ouvidor" | "prefeito";
  secretariaId?: string;
  ativo: boolean;
}

export interface AnexoMeta { k: string; nome: string; tipo: "imagem" | "video"; mime: string; partes: number; bytes: number }

export const TIPOS = {
  reclamacao: "Reclamação", denuncia: "Denúncia", solicitacao: "Solicitação",
  sugestao: "Sugestão", elogio: "Elogio", informacao: "Pedido de informação",
} as const;
export type TipoManifestacao = keyof typeof TIPOS;

export type StatusProtocolo = "aberto" | "respondido" | "concluido";

// O documento do protocolo guarda só metadados (o administrador pode lê-lo para estatísticas).
// Os textos e anexos ficam em protocolos/{numero}/mensagens, visíveis só ao autor e à secretaria.
export interface Protocolo {
  id: string;
  numero: string;
  autorUid: string;
  secretariaId: string;
  secretariaNome: string;
  tipo: TipoManifestacao;
  status: StatusProtocolo;
  criadoEm: Timestamp | null;
  respondidoEm?: Timestamp | null;
  concluidoEm?: Timestamp | null;
  avaliacao?: number;
  // prorrogação única do prazo (Lei 13.460/2017, art. 16): motivo visível ao cidadão
  prorrogadoEm?: Timestamp | null;
  prorrogacaoMotivo?: string;
  prorrogacaoPor?: string;
  // ouvidor geral: encaminhamentos (histórico em protocolos/{n}/historico) e cobrança interna ao setor
  encaminhamentos?: number;
  encaminhadoEm?: Timestamp | null;
  cobradoEm?: Timestamp | null;
  ultimaMsgPor?: "cidadao" | "servidor";
  apagada?: boolean;
  // protocolos antigos (antes da conversa) guardavam o texto aqui
  assunto?: string;
  mensagem?: string;
  resposta?: string;
}

export interface Mensagem {
  id: string; // m00, m01…
  de: "cidadao" | "servidor";
  autorUid: string;
  texto: string;
  assunto?: string;
  anexos: AnexoMeta[];
  criadoEm: Timestamp | null;
}

export interface Notificacao {
  id: string;
  uid: string;
  protocoloId: string;
  tipo: "recebido" | "resposta" | "aviso" | "prorrogacao";
  mensagem: string;
  criadoEm: Timestamp | null;
  expiraEm: Timestamp;
}

// Registro imutável de cada encaminhamento feito pelo ouvidor geral (protocolos/{n}/historico/h1, h2…).
export interface Encaminhamento {
  id: string;
  de: string; deNome: string;
  para: string; paraNome: string;
  por: string; motivo: string;
  criadoEm: Timestamp | null;
}

// Só números, sem dados pessoais: é o único dado que o prefeito lê (estatisticas/atual).
export interface Contagem { total: number; vencidas: number; concluidas: number }
export interface Estatisticas {
  geradoEm: Timestamp | null;
  geradoPor: string;
  total: number;
  porStatus: Record<string, number>;
  porTipo: Record<string, number>;
  porSecretaria: Record<string, Contagem>;
  porMes: Record<string, number>; // "2026-10": 12
  vencidas: number;
  tempoMedioRespostaDias: number;
  dentroPrazoPct: number;
  notaMedia: number;
  avaliacoes: number;
}

export const PRAZO_DIAS = 30;
export const PRAZO_PRORROGACAO_DIAS = 30; // prorrogação única, com justificativa (Lei 13.460/2017, art. 16)
export const AVISO_HORAS = 24;
export const APAGAR_APOS_DIAS = 30; // conversa é apagada 30 dias depois de concluída
export const MAX_MENSAGENS = 50;
export const VERSAO_TERMOS = "2026-10";

export type PlanoMunicipio = "basico" | "padrao" | "completo";
export const PLANOS: Record<PlanoMunicipio, string> = { basico: "Básico", padrao: "Padrão", completo: "Completo" };
