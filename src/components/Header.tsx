/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Settings, User, LogOut, Search, PenLine, Home, UserPlus, LogIn } from "lucide-react";
import { motion } from "motion/react";

interface HeaderProps {
  municipio: string;
  setMunicipio: (val: string) => void;
  headerColor: string;
  setHeaderColor: (val: string) => void;
  logoText: string;
  setLogoText: (val: string) => void;
  programName: string;
  setProgramName: (val: string) => void;
  view: string;
  setView: (val: string) => void;
  user: { nome: string; perfil: string; ocupacao?: string } | null;
  onLogout: () => void;
  logoImageUrl: string;
  setLogoImageUrl: (val: string) => void;
}

export function Header({
  municipio,
  setMunicipio,
  headerColor,
  setHeaderColor,
  logoText,
  setLogoText,
  programName,
  setProgramName,
  view,
  setView,
  user,
  onLogout,
  logoImageUrl,
  setLogoImageUrl,
}: HeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);

  // Identify active portal mode: citizen vs administrative
  const isCidadaoMode = ["cidadao", "abrir", "consultar", "cadastro", "login"].includes(view);
  const isZeladoriaMode = ["dashboard", "admin"].includes(view);

  return (
    <header className="w-full flex flex-col font-sans mb-4">
      {/* 1. Deep Green Header Bar (Matching the attached image exactly) */}
      <div 
        style={{ backgroundColor: headerColor }} /* Solid dynamic background as chosen in Admin */
        className="text-white px-4 py-4 md:py-6 flex items-center justify-between gap-4 select-none"
      >
        <div className="flex items-center gap-3.5 max-w-4xl mx-auto w-full">
          {/* Circular Politician Assembly Avatar with active green dot */}
          <div className="relative shrink-0 select-none">
            <div className="relative w-[60px] h-[60px] md:w-[72px] md:h-[72px] rounded-full overflow-hidden border-2 border-white shadow-xl bg-slate-950 flex items-center justify-center">
              <img 
                src={logoImageUrl || "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?q=80&w=150&auto=format&fit=crop"} 
                alt="Câmara Municipal Assembleia" 
                className="w-full h-full object-cover select-none"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Glowing active indicator dot on the right-bottom as shown in image */}
            <span 
              className="absolute bottom-1 right-0 inline-block w-3.5 h-3.5 bg-[#22C55E] border-2 border-[#1351B4] rounded-full shadow-md animate-pulse z-10"
              style={{ borderColor: headerColor }}
              title="Ouvidoria Online"
            ></span>
          </div>

          {/* Centered Title and Subtitle Block */}
          <div className="flex-1 text-center pr-3">
            {editingTitle ? (
              <input
                id="edit-municipio"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                autoFocus
                className="bg-white/15 text-white border-b-2 border-amber-300 outline-none font-black text-xl sm:text-2xl md:text-3xl px-2 py-0.5 rounded text-center max-w-full"
              />
            ) : (
              <h1 
                onDoubleClick={() => setEditingTitle(true)}
                title="Clique duplo para editar nome do município"
                className="font-display font-black text-white text-xl sm:text-2xl md:text-3xl lg:text-[34px] leading-snug tracking-tight hover:underline cursor-pointer select-text"
              >
                {municipio || "Prefeitura Municipal de Rio Preto"}
              </h1>
            )}

            {editingSubtitle ? (
              <input
                id="edit-subtitle"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                onBlur={() => setEditingSubtitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingSubtitle(false)}
                autoFocus
                className="bg-white/10 text-white/90 border-b border-amber-250 outline-none font-medium text-xs px-2 py-0.5 rounded text-center mt-1 w-full max-w-lg"
              />
            ) : (
              <p 
                onDoubleClick={() => setEditingSubtitle(true)}
                title="Clique duplo para editar programa/subtítulo"
                className="text-[10.5px] sm:text-xs md:text-sm text-stone-200 font-medium tracking-wide mt-1 hover:underline cursor-pointer select-text leading-relaxed opacity-95"
              >
                {programName || "Ouvidoria Legislativa Inteligente (Conformidade Completa LGPD)"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Dark Slate Blue Control Section (Matching image's dark interactive drawer block) */}
      <div className="bg-[#0c1221] px-4 py-3 border-b border-[#1b263b]/50">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          {/* Selector Portal Container Card */}
          <div className="border border-[#1e293b] rounded-xl p-2 bg-[#090e1a] flex flex-col gap-2">
            {!user ? (
              <div className="grid grid-cols-2 gap-2 px-1 py-1">
                {/* 1. Cadastro Button (Vibrant modern green gradient) */}
                <button
                  id="btn-register"
                  onClick={() => setView("cadastro")}
                  className={`relative flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl font-extrabold text-[11px] xs:text-xs transition-all duration-300 transform active:scale-95 cursor-pointer shadow-md ${
                    view === "cadastro" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950/40 ring-2 ring-emerald-400" 
                      : "bg-[#039855] text-white hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-950/20"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Cadastro</span>
                </button>

                {/* 2. Login Button (Polished dark outline/ghost gradient) */}
                <button
                  id="btn-login-header"
                  onClick={() => setView("login")}
                  className={`relative flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl font-extrabold text-[11px] xs:text-xs border transition-all duration-300 transform active:scale-95 cursor-pointer shadow-md ${
                    view === "login" 
                      ? "bg-gradient-to-br from-slate-800 to-slate-900 text-white border-white/30 ring-2 ring-blue-400" 
                      : "border-white/20 bg-white/5 hover:bg-white/10 text-white shadow-black/20"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 rotate-180" />
                  <span>Login</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Tab: Admin when logged in (Only shown to administrators / public servants) */}
                {user.perfil !== "cidadao" && (
                  <button
                    id="tab-zeladoria-vereadores"
                    onClick={() => {
                      setView("dashboard");
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                      isZeladoriaMode 
                        ? "bg-[#1e293b] text-white shadow-md border border-white/10" 
                        : "text-stone-400 hover:text-white bg-white/5"
                    }`}
                  >
                    <Settings className="w-4 h-4 text-[#3b82f6]" />
                    <span>Admin</span>
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-blue-600 text-white rounded-full font-black">1</span>
                  </button>
                )}

                <div className="flex items-center justify-between text-white/90 text-xs py-1.5 border-t border-white/5 mt-1 px-2">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Olá, <strong className="text-amber-400">{user.nome}</strong> {user.ocupacao && `(${user.ocupacao})`}</span>
                  </span>
                  <button 
                    onClick={onLogout}
                    className="text-stone-300 hover:text-red-400 font-bold flex items-center gap-1 bg-white/5 border border-white/10 hover:bg-white/10 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                    title="Sair do sistema"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Sub-Header: Secondary Navigation Controls (Three card options inside absolute matching card layout) */}
      <div className="px-4 py-4 max-w-lg mx-auto w-full">
        <div className="bg-[#F1F3F9] p-1.5 rounded-2xl border border-stone-200/80 shadow-xs flex items-center justify-between gap-1 w-full">
          {/* Tab 1: Início */}
          <button
            id="nav-cidadao"
            onClick={() => setView("cidadao")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 md:px-3 py-2.5 rounded-xl text-[10.5px] xs:text-xs md:text-sm font-extrabold text-center transition-all cursor-pointer ${
              view === "cidadao" 
                ? "bg-[#061C3F] text-white shadow-md transform scale-[1.02]" 
                : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-900"
            }`}
          >
            <span>🏡</span>
            <span>Início</span>
          </button>

          {/* Tab 2: Nova Manifestação */}
          <button
            id="nav-abrir"
            onClick={() => setView("abrir")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 md:px-3 py-2.5 rounded-xl text-[10.5px] xs:text-xs md:text-sm font-extrabold text-center transition-all cursor-pointer ${
              view === "abrir" 
                ? "bg-[#061C3F] text-white shadow-md transform scale-[1.02]" 
                : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-900"
            }`}
          >
            <span>📝</span>
            <span className="whitespace-nowrap">Nova Manifestação</span>
          </button>

          {/* Tab 3: Consultar Protocolo */}
          <button
            id="nav-consultar"
            onClick={() => setView("consultar")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-1 md:px-3 py-2.5 rounded-xl text-[10.5px] xs:text-xs md:text-sm font-extrabold text-center transition-all cursor-pointer ${
              view === "consultar" 
                ? "bg-[#061C3F] text-white shadow-md transform scale-[1.02]" 
                : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-900"
            }`}
          >
            <span>🔍</span>
            <span className="whitespace-nowrap">Consultar Protocolo</span>
          </button>
        </div>
      </div>
    </header>
  );
}
