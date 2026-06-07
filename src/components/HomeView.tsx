/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search, PenLine, ShieldCheck, Landmark } from "lucide-react";
import { motion } from "motion/react";

interface HomeViewProps {
  setView: (view: string) => void;
  headerColor?: string;
  municipio: string;
}

export function HomeView({ setView, headerColor = "#1351B4", municipio }: HomeViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto px-4 py-8 md:py-12"
    >
      {/* Centered Municipal Logo Icon - High-Quality 3D Rendered Chamber Building Logo */}
      <div className="flex justify-center mb-8 relative">
        <motion.div 
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05, rotate: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 100 }}
          className="w-20 h-20 flex items-center justify-center relative cursor-pointer select-none"
        >
          <svg viewBox="0 0 120 120" className="w-[70px] h-[70px] object-contain select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#110E0B"/>
                <stop offset="100%" stopColor="#3A322C"/>
              </linearGradient>
              
              <linearGradient id="stoneGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E5DEC9" />
                <stop offset="50%" stopColor="#F6F2E5" />
                <stop offset="100%" stopColor="#DFD8BE" />
              </linearGradient>

              <linearGradient id="columnGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#CCC4AA" />
                <stop offset="30%" stopColor="#FDFBF4" />
                <stop offset="70%" stopColor="#EBE3CD" />
                <stop offset="100%" stopColor="#B7AF95" />
              </linearGradient>

              <linearGradient id="roofGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#C5BCA3" />
                <stop offset="100%" stopColor="#FBF8ED" />
              </linearGradient>
              
              <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F2EDE0" />
                <stop offset="100%" stopColor="#CEC6AF" />
              </linearGradient>
              
              <linearGradient id="stepHighlight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.6} />
                <stop offset="50%" stopColor="#E7E1CC" />
                <stop offset="100%" stopColor="#C9C0A7" />
              </linearGradient>
            </defs>

            {/* Ground / Drop Shadow */}
            <ellipse cx="60" cy="111" rx="55" ry="5.5" fill="#000000" fillOpacity="0.12" />

            {/* Hidden dark recess background behind columns */}
            <path d="M21 44 H99 V92 H21 Z" fill="url(#bgGrad)" />

            {/* Inner columns background dividers (darker shadows between columns) */}
            <rect x="34" y="44" width="10" height="48" fill="#1C1613" />
            <rect x="55" y="44" width="10" height="48" fill="#1C1613" />
            <rect x="76" y="44" width="10" height="48" fill="#1C1613" />

            {/* Columns (4 pieces) */}
            {/* Column 1 */}
            <g>
              <path d="M19 88.5 H31 V92 H19 Z" fill="url(#stoneGrad)" />
              <path d="M21 44 H29 V88.5 H21 Z" fill="url(#columnGrad)" />
              <line x1="23" y1="44" x2="23" y2="88.5" stroke="#FFF" strokeWidth={0.5} strokeOpacity={0.4} />
              <line x1="25" y1="44" x2="25" y2="88.5" stroke="#9A9279" strokeWidth={0.5} strokeOpacity={0.4} />
              <line x1="27" y1="44" x2="27" y2="88.5" stroke="#FFF" strokeWidth={0.5} strokeOpacity={0.3} />
              <path d="M19.5 41 H30.5 V44 H19.5 Z" fill="url(#stoneGrad)" />
              <rect x="20.5" y="39.5" width="9" height="1.5" fill="#EAE4D3" />
            </g>

            {/* Column 2 */}
            <g>
              <path d="M40 88.5 H52 V92 H40 Z" fill="url(#stoneGrad)" />
              <path d="M42 44 H50 V88.5 H42 Z" fill="url(#columnGrad)" />
              <line x1="44" y1="44" x2="44" y2="88.5" stroke="#FFF" strokeWidth={0.5} strokeOpacity={0.4} />
              <line x1="46" y1="44" x2="46" y2="88.5" stroke="#9A9279" strokeWidth={0.5} strokeOpacity={0.4} />
              <line x1="48" y1="44" x2="48" y2="88.5" stroke="#FFF" strokeWidth={0.5} strokeOpacity={0.3} />
              <path d="M40.5 41 H51.5 V44 H40.5 Z" fill="url(#stoneGrad)" />
              <rect x="41.5" y="39.5" width="9" height="1.5" fill="#EAE4D3" />
            </g>

            {/* Column 3 */}
            <g>
              <path d="M61 88.5 H73 V92 H61 Z" fill="url(#stoneGrad)" />
              <path d="M63 44 H71 V88.5 H63 Z" fill="url(#columnGrad)" />
              <line x1="65" y1="44" x2="65" y2="88.5" stroke="#FFF" strokeWidth={0.5} strokeOpacity={0.4} />
              <line x1="67" y1="44" x2="67" y2="88.5" stroke="#9A9279" strokeWidth={0.5} strokeOpacity={0.4} />
              <line x1="69" y1="44" x2="69" y2="88.5" stroke="#FFF" strokeWidth={0.5} strokeOpacity={0.3} />
              <path d="M61.5 41 H72.5 V44 H61.5 Z" fill="url(#stoneGrad)" />
              <rect x="62.5" y="39.5" width="9" height="1.5" fill="#EAE4D3" />
            </g>

            {/* Column 4 */}
            <g>
              <path d="M82 88.5 H94 V92 H82 Z" fill="url(#stoneGrad)" />
              <path d="M84 44 H92 V88.5 H84 Z" fill="url(#columnGrad)" />
              <line x1="86" y1="44" x2="86" y2="88.5" stroke="#FFF" strokeWidth={0.5} strokeOpacity={0.4} />
              <line x1="88" y1="44" x2="88" y2="88.5" stroke="#9A9279" strokeWidth={0.5} strokeOpacity={0.4} />
              <line x1="90" y1="44" x2="90" y2="88.5" stroke="#FFF" strokeWidth={0.5} strokeOpacity={0.3} />
              <path d="M82.5 41 H93.5 V44 H82.5 Z" fill="url(#stoneGrad)" />
              <rect x="83.5" y="39.5" width="9" height="1.5" fill="#EAE4D3" />
            </g>

            {/* Architrave and Cornice (above columns) */}
            <rect x="13" y="34.5" width="94" height="5" fill="url(#beamGrad)" stroke="#B6AE97" strokeWidth={0.5} />
            
            {/* Dental molding pattern */}
            <g fill="#A7A089">
              <rect x="16" y="36.5" width="3" height="1.5" />
              <rect x="22" y="36.5" width="3" height="1.5" />
              <rect x="28" y="36.5" width="3" height="1.5" />
              <rect x="34" y="36.5" width="3" height="1.5" />
              <rect x="40" y="36.5" width="3" height="1.5" />
              <rect x="46" y="36.5" width="3" height="1.5" />
              <rect x="52" y="36.5" width="3" height="1.5" />
              <rect x="58" y="36.5" width="3" height="1.5" />
              <rect x="64" y="36.5" width="3" height="1.5" />
              <rect x="70" y="36.5" width="3" height="1.5" />
              <rect x="76" y="36.5" width="3" height="1.5" />
              <rect x="82" y="36.5" width="3" height="1.5" />
              <rect x="88" y="36.5" width="3" height="1.5" />
              <rect x="94" y="36.5" width="3" height="1.5" />
              <rect x="100" y="36.5" width="3" height="1.5" />
            </g>
            
            <rect x="10" y="30.5" width="100" height="4" fill="url(#stoneGrad)" stroke="#AFAA95" strokeWidth={0.5} />

            {/* Pediment / Triangular roof */}
            <polygon points="7,30.5 113,30.5 60,5 7,30.5" fill="url(#roofGrad)" stroke="#A09880" strokeWidth={0.5} />
            
            {/* Under-roof horizontal shadow ridge */}
            <line x1="8" y1="30.5" x2="112" y2="30.5" stroke="#6F6855" strokeWidth={1.5} />
            
            {/* Roof edge trim to make it look 3D layered */}
            <polygon points="7,30.5 113,30.5 60,30.5 7,30.5" fill="#8C846D" />

            {/* Steps Foundation (Three level stairs) */}
            {/* Step 1 */}
            <rect x="15" y="92" width="90" height="5" fill="url(#stepHighlight)" stroke="#B6AE97" rx="0.5" strokeWidth={0.5} />
            {/* Step 2 */}
            <rect x="11" y="97" width="98" height="5.5" fill="url(#stepHighlight)" stroke="#AFA993" rx="0.7" strokeWidth={0.5} />
            {/* Step 3 */}
            <rect x="6" y="102.5" width="108" height="6.5" fill="url(#stepHighlight)" stroke="#A39B85" rx="1.2" strokeWidth={0.5} />
            
            <line x1="7" y1="103" x2="113" y2="103" stroke="#FDFDFC" strokeWidth={0.7} strokeOpacity={0.8} />
          </svg>
        </motion.div>
      </div>

      {/* Hero Welcome Headers matching attached image exactly */}
      <div className="text-center mb-10 md:mb-14">
        <h2 className="font-display font-extrabold text-3xl md:text-5xl text-[#071D41] tracking-tight leading-tight mb-2">
          {(() => {
            const normalized = municipio.trim().toLowerCase();
            if (normalized.startsWith("prefeitura") || normalized.startsWith("câmara") || normalized.startsWith("camara") || normalized.startsWith("governo")) {
              return `Bem-vindo à Ouvidoria da ${municipio}`;
            }
            return `Bem-vindo à Ouvidoria da Prefeitura Municipal de ${municipio}`;
          })()}
        </h2>
        <div className="h-1.5 w-16 bg-[#FFCD07] mx-auto my-4 rounded-full" />
        <p className="text-[#071D41] text-base md:text-xl font-extrabold tracking-tight mt-3">
          Sua voz importa. Fale com a gente.
        </p>
        <p className="text-stone-500 text-xs md:text-sm max-w-xl mx-auto font-sans leading-relaxed mt-2.5">
          Registre reclamações, sugestões, elogios e denúncias de forma segura e transparente. 
          Triagem assistida e acompanhamento ágil em total conformidade com a LGPD.
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
            Conforme a LGPD (Lei nº 13.709/2018). Seus dados pessoais são tratados com total sigilo, segurança e transparência em todas as esferas administrativas.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
