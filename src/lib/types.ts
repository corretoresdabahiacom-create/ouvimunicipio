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

export interface AnexoMeta { k: string; nome: string; tipo: "imagem" | "video"; mime: string; partes: number; bytes: number; r2?: boolean /* arquivo no Cloudflare R2 (sem partes no Firestore) */ }

export const TIPOS = {
  reclamacao: "Reclamação", denuncia: "Denúncia", solicitacao: "Solicitação",
  sugestao: "Sugestão", elogio: "Elogio", informacao: "Dúvida ou informação geral",
  lai: "Pedido de acesso à informação (LAI)",
} as const;
export type TipoManifestacao = keyof typeof TIPOS;

export type StatusProtocolo = "aberto" | "respondido" | "concluido";

// O documento do protocolo guarda só metadados (o administrador pode lê-lo para estatísticas).
// Os textos e anexos ficam em protocolos/{numero}/mensagens, visíveis só ao autor, à secretaria e ao ouvidor geral.
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
  regiao?: Coordenada; // local aproximado (≈100 m) para o mapa; o exato fica só na conversa
  encaminhadoEm?: Timestamp | null;
  cobradoEm?: Timestamp | null;
  ultimaMsgPor?: "cidadao" | "servidor";
  apagada?: boolean;
  // etapas extras (a situação continua "aberto/respondido/concluido"; estes campos refinam o que se mostra)
  triagemEm?: Timestamp | null;        // ouvidor geral está analisando antes de encaminhar
  aguardandoDesde?: Timestamp | null;  // secretaria pediu informações ao cidadão: o prazo fica suspenso (no máximo 20 dias)
  pedidosInfo?: number;                // quantos pedidos de informação já foram feitos (máx. 2)
  suspensoDias?: number;               // dias de espera já somados ao prazo
  reabertoEm?: Timestamp | null;       // cidadão reabriu o atendimento concluído (uma vez, até 30 dias depois)
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
  local?: Coordenada; // só na 1ª mensagem: local exato informado pelo cidadão (opcional)
}

export interface Coordenada { lat: number; lng: number }

// Ficha pública do protocolo (consulta pelo número, sem login): cópia fiel de alguns campos do protocolo.
export interface FichaConsulta {
  status: Protocolo["status"];
  secretariaNome: string;
  criadoEm: Timestamp | null;
  respondidoEm?: Timestamp | null;
  concluidoEm?: Timestamp | null;
  prorrogadoEm?: Timestamp | null;
  reabertoEm?: Timestamp | null;
  aguardandoDesde?: Timestamp | null;
  suspensoDias?: number;
  lai?: boolean; // pedido de acesso à informação (prazos próprios)
}

// Resposta-modelo da secretaria (texto pronto para as respostas). Marcadores: {numero}, {secretaria}.
export interface Modelo { id: string; secretariaId: string; titulo: string; texto: string }

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
// Pedido de acesso à informação (Lei 12.527/2011): 20 dias, prorrogável por mais 10 (art. 11); recurso em até 10 dias (art. 15),
// que a administração deve decidir em 5 dias.
export const LAI = { prazo: 20, prorrogacao: 10, recursoPrazoDias: 10, decisaoRecursoDias: 5 } as const;
/** Prazos (em dias) conforme o tipo: manifestação comum (30 + 30) ou pedido de acesso à informação (20 + 10). */
export function prazosDoTipo(tipo?: string | null): { prazo: number; prorrogacao: number } {
  return tipo === "lai" ? { prazo: LAI.prazo, prorrogacao: LAI.prorrogacao } : { prazo: PRAZO_DIAS, prorrogacao: PRAZO_PRORROGACAO_DIAS };
}
export const MAX_SUSPENSAO_DIAS = 20; // espera pelo cidadão que soma ao prazo, por pedido
export const PRAZO_PRORROGACAO_DIAS = 30; // prorrogação única, com justificativa (Lei 13.460/2017, art. 16)
export const AVISO_HORAS = 24;
export const APAGAR_APOS_DIAS = 30; // conversa é apagada 30 dias depois de concluída
export const MAX_MENSAGENS = 50;
export const ANOS_RETENCAO = 5; // protocolo concluído é apagado 5 anos depois (scripts/retencao.mjs)
export const VERSAO_TERMOS = "2026-12"; // mudou: prazo de guarda do protocolo (5 anos)

export type PlanoMunicipio = "basico" | "padrao" | "completo";
export const PLANOS: Record<PlanoMunicipio, string> = { basico: "Básico", padrao: "Padrão", completo: "Completo" };
