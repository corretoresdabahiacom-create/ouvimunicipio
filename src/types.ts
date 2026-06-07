/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Manifestacao {
  id: number;
  protocolo: string;
  tipo: string;
  descricao: string;
  status: string;
  prioridade: string;
  secretaria: string;
  bairro: string;
  data: string;
  ia_categoria: string;
  resposta_ia?: string;
  autor_nome?: string;
  autor_ocupacao?: string;
  destacado?: boolean;
  responsavel_nome?: string;
  responsavel_cargo?: string;
  responsavel_email?: string;
  despacho?: string;
  despacho_autor?: string;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  secretaria: string;
  ativo: boolean;
  ocupacao?: string;
  email_alternativo?: string;
  termos_aceitos?: boolean;
  termos_data_aceito?: string;
  permissoes?: {
    visualizarRelatorios: boolean;
    responderChamados: boolean;
    gerenciarPublicidade: boolean;
    gerenciarSecretarias: boolean;
    alterarCores: boolean;
  };
}

export interface SecretariaItem {
  id: number;
  nome: string;
  email: string;
  responsavel: string;
  funcoes?: string;
}

export interface ClassifyResponse {
  categoria: string;
  secretaria: string;
  prioridade: string;
  resposta: string;
  is_ai: boolean;
}

export interface SimulatedEmailLog {
  id: string;
  protocolo: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  timestamp: string;
  statusAntigo: string;
  statusNovo: string;
}

