/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search, PenLine, ShieldCheck, Landmark } from "lucide-react";
import { motion } from "motion/react";

interface HomeViewProps {
  setView: (view: string) => void;
  headerColor?: string;
}

export function HomeView({ setView, headerColor = "#1351B4" }: HomeViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto px-4 py-8 md:py-12"
    >
      {/* Centered Municipal Logo Icon */}
      <div className="flex justify-center mb-6">
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10 }}
          className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-stone-50 to-stone-100 rounded-full flex items-center justify-center border-2 border-stone-200/80 shadow-md"
        >
          <Landmark className="w-10 h-10 md:w-12 md:h-12 text-[#071D41]" />
        </motion.div>
      </div>

      {/* Hero Welcome Headers */}
      <div className="text-center mb-10 md:mb-14">
        <h2 className="font-display font-extrabold text-3xl md:text-5xl text-[#071D41] tracking-tight leading-tight">
          Bem-vindo à Ouvidoria Municipal
        </h2>
        <div className="h-1.5 w-16 bg-[#FFCD07] mx-auto my-4 rounded-full" />
        <p className="text-stone-600 text-sm md:text-lg max-w-xl mx-auto font-sans leading-relaxed">
          Sua voz importa. Registre reclamações, sugestões, elogios e denúncias. 
          Acompanhe o andamento pelo protocolo de forma digital e transparente.
        </p>
      </div>

      {/* Main Core Interaction Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10 md:mb-12">
        {/* Click card 1: Abrir manifestacao */}
        <div
          id="btn-click-abrir"
          onClick={() => setView("abrir")}
          className="bg-white rounded-2xl p-6 text-center border border-stone-200 cursor-pointer shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition-all group border-t-4"
          style={{ borderTopColor: headerColor }}
        >
          <div 
            style={{ backgroundColor: `${headerColor}1e`, color: headerColor }}
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-all font-sans"
          >
            <span className="text-2xl">📝</span>
          </div>
          <h3 
            style={{ color: headerColor }}
            className="font-display font-bold text-lg md:text-xl mb-2"
          >
            Abrir Manifestação
          </h3>
          <p className="text-stone-500 text-xs md:text-sm leading-relaxed">
            Registre reclamação, sugestão, elogio ou denúncia sobre serviços do município.
          </p>
        </div>

        {/* Click card 2: Consultar protocolo */}
        <div
          id="btn-click-consultar"
          onClick={() => setView("consultar")}
          className="bg-white rounded-2xl p-6 text-center border border-stone-200 hover:border-green-400 cursor-pointer shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition-all group border-t-4 border-t-[#168821]"
        >
          <div className="w-12 h-12 bg-green-50 text-[#168821] rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-green-100 group-hover:scale-110 transition-all">
            <span className="text-2xl">🔍</span>
          </div>
          <h3 className="font-display font-bold text-lg md:text-xl text-[#168821] mb-2">
            Consultar Protocolo
          </h3>
          <p className="text-stone-500 text-xs md:text-sm leading-relaxed">
            Acompanhe o andamento do seu chamado de forma rápida e segura.
          </p>
        </div>
      </div>

      {/* LGPD Secure Card */}
      <div className="max-w-xl mx-auto bg-[#071D41] rounded-2xl p-5 md:p-6 text-white shadow-xl flex items-start gap-4 border border-white/5">
        <div className="p-2.5 bg-white/10 rounded-xl text-amber-400 flex-shrink-0">
          <span className="text-2xl">🔒</span>
        </div>
        <div className="min-w-0">
          <h4 className="font-display font-bold text-sm md:text-base mb-1 tracking-tight">
            Seus dados estão protegidos
          </h4>
          <p className="text-white/80 text-xs leading-relaxed">
            Conforme a LGPD (Lei nº 13.709/2018). Seus dados pessoais são tratados com total sigilo, segurança e transparência in todas as esferas administrativas.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
