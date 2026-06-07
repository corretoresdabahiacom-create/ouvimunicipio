/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Manifestacao, Usuario, SecretariaItem } from "../types";

export const COLORS = {
  govBlue: "#071D41",
  govGreen: "#168821",
  govYellow: "#FFCD07",
  accent: "#1351B4",
  accentLight: "#2670E8",
  danger: "#E52207",
  warning: "#FFCD07",
  success: "#168821",
  bg: "#F0F2F5",
  surface: "#FFFFFF",
  border: "#CBCBCB",
  text: "#1B1B1B",
  textMuted: "#555555",
  textLight: "#888888",
  textLighten: "#E5E5E5",
};

export const MOCK_MANIFESTACOES: Manifestacao[] = [
  {
    id: 1,
    protocolo: "2024001",
    tipo: "Reclamação",
    descricao: "Cratera asfáltica enorme na Rua das Flores, bem na descida perto da escola primária, colocando em risco crianças e motoristas.",
    status: "Pendente",
    prioridade: "Alta",
    secretaria: "Infraestrutura",
    bairro: "Centro",
    data: "2024-05-24",
    ia_categoria: "Pavimentação"
  },
  {
    id: 2,
    protocolo: "2024002",
    tipo: "Sugestão",
    descricao: "Gostaria de propor a instalação de lixeiras dedicadas à coleta seletiva de resíduos plásticos e metálicos na praça municipal principal.",
    status: "Em Andamento",
    prioridade: "Média",
    secretaria: "Serviços Públicos",
    bairro: "Jardim América",
    data: "2024-05-25",
    ia_categoria: "Limpeza Urbana"
  },
  {
    id: 3,
    protocolo: "2024003",
    tipo: "Reclamação",
    descricao: "Vários postes de energia elétrica estão com as lâmpadas totalmente apagadas e com mau contato na Avenida Central há mais de 10 dias seguidos, deixando a rua um perigo.",
    status: "Resolvido",
    prioridade: "Média",
    secretaria: "Infraestrutura",
    bairro: "Vila Nova",
    data: "2026-05-26",
    ia_categoria: "Iluminação Pública"
  },
  {
    id: 4,
    protocolo: "2024004",
    tipo: "Denúncia",
    descricao: "Estão descartando entulho industrial de forma totalmente clandestina nas margens do corrego municipal, bem atrás da escola do bairro.",
    status: "Urgente",
    prioridade: "Alta",
    secretaria: "Serviços Públicos",
    bairro: "Centro",
    data: "2026-05-27",
    ia_categoria: "Limpeza Urbana"
  },
  {
    id: 5,
    protocolo: "2024005",
    tipo: "Elogio",
    descricao: "Presto meus elogios de coração ao excelente atendimento cuidadoso prestado pela equipe médica e de enfermagem no posto UBS do bairro Jardim América.",
    status: "Resolvido",
    prioridade: "Baixa",
    secretaria: "Saúde",
    bairro: "Jardim América",
    data: "2026-05-27",
    ia_categoria: "Saúde"
  },
  {
    id: 6,
    protocolo: "2024006",
    tipo: "Reclamação",
    descricao: "Estamos enfrentando severa falta de abastecimento de água potável na rua XV de Novembro já há 3 dias inteiros, sem nenhuma explicação.",
    status: "Pendente",
    prioridade: "Alta",
    secretaria: "Saneamento",
    bairro: "Vila Nova",
    data: "2026-05-27",
    ia_categoria: "Saneamento"
  }
];

export const SECRETARIAS_PADRAO = [
  "Infraestrutura",
  "Serviços Públicos",
  "Saúde",
  "Saneamento",
  "Educação",
  "Segurança"
];

export const BAIRROS_PADRAO = [
  "Centro", 
  "Jardim América", 
  "Vila Nova", 
  "Santa Luzia", 
  "Boa Vista"
];
