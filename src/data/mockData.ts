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
};

export const MOCK_MANIFESTACOES: Manifestacao[] = [];

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
