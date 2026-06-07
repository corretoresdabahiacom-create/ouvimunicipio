/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Settings, User, LogOut, ShieldAlert } from "lucide-react";
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
  user: { nome: string; perfil: string } | null;
  onLogout: () => void;
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
}: HeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);

  const menuItems = [
    { key: "cidadao", label: "🏠 Início" },
    { key: "abrir", label: "📝 Nova Manifestação" },
    { key: "consultar", label: "🔍 Consultar" },
    ...(user ? [{ key: "dashboard", label: "📊 Dashboard" }] : []),
  ];

  return (
    <header className="w-full flex flex-col font-sans shadow-md z-40 transition-colors duration-300">
      {/* Prime-line Top Bar */}
      <div 
        style={{ backgroundColor: headerColor }}
        className="text-white px-3 md:px-8 py-2.5 flex items-center justify-between min-h-[56px] md:min-h-[64px]"
      >
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Logo badge SE / Customizable */}
          <div className="w-8 h-8 md:w-10 md:h-10 bg-[#FFCD07] rounded-lg flex items-center justify-center font-black text-sm md:text-lg text-[#071D41] flex-shrink-0 shadow-sm">
            {logoText}
          </div>
          <div className="min-w-0">
            {editingTitle ? (
              <input
                id="edit-municipio"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                autoFocus
                className="bg-white/10 text-white border-b border-white outline-none font-bold text-xs md:text-sm px-1 py-0.5 rounded w-32 md:w-64"
              />
            ) : (
              <h1 
                onDoubleClick={() => setEditingTitle(true)}
                title="Clique duplo para editar nome do município"
                className="font-display font-extrabold text-[#FFFCD07] text-[12px] xs:text-sm md:text-base leading-tight tracking-tight hover:underline cursor-pointer"
              >
                {municipio}
              </h1>
            )}
            <p className="text-[10px] md:text-xs text-white/80 font-medium tracking-wide">
              Prefeitura Municipal • Ouvidoria Inteligente
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {user ? (
            <div className="flex items-center gap-1.5 md:gap-2 bg-white/10 px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg border border-white/15 max-w-[120px] sm:max-w-full">
              <span className="text-[10px] md:text-xs text-white/90 font-semibold truncate hidden sm:inline">
                Olá, {user.nome}
              </span>
              <button 
                id="logout-btn"
                onClick={onLogout}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
                title="Sair do sistema"
              >
                <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 md:gap-2">
              <button
                id="view-cadastro"
                onClick={() => setView("cadastro")}
                className={`px-1.5 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${
                  view === "cadastro" ? "bg-white text-[#071D41]" : "text-white hover:bg-white/10"
                }`}
              >
                Cadastro
              </button>
              <button
                id="view-login"
                onClick={() => setView("login")}
                className={`px-1.5 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${
                  view === "login" ? "bg-white text-[#071D41]" : "text-white hover:bg-white/10"
                }`}
              >
                Login
              </button>
              <button
                id="view-admin"
                onClick={() => setView("admin")}
                className={`px-2 md:px-4 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-black transition-all ${
                  view === "admin" || view === "dashboard"
                    ? "bg-[#E52207] text-white shadow-sm ring-2 ring-white/10"
                    : "bg-[#E52207]/20 text-white border border-[#E52207]/40 hover:bg-[#E52207]/40"
                }`}
              >
                Admin
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Second Line: Nav Items */}
      <div 
        style={{ backgroundColor: headerColor }}
        className="opacity-95 text-white/90 px-3 md:px-8 py-1.5 border-t border-white/10 flex items-center justify-between gap-4 overflow-x-auto scrollbar-none"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 flex-nowrap">
          {menuItems.map((item) => {
            const isActive = view === item.key;
            return (
              <button
                id={`nav-${item.key}`}
                key={item.key}
                onClick={() => setView(item.key)}
                className={`px-3 py-1.5 rounded-md text-[11px] md:text-xs font-extrabold text-center whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? "bg-[#FFCD07] text-[#071D41] shadow-sm transform scale-102" 
                    : "text-white/90 hover:bg-white/15"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] font-semibold text-white/50 whitespace-nowrap tracking-wide bg-black/10 px-2 py-0.5 rounded-full hidden xs:block">
          MVP Fase 1
        </div>
      </div>

      {/* Third Line: Cyan/Blue Program Theme Bar */}
      <div 
        style={{ backgroundColor: headerColor }}
        className="text-white px-3 md:px-8 py-1.5 text-[11px] md:text-xs font-semibold flex items-center justify-between gap-2 shadow-inner flex-wrap"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[#FFCD07] uppercase font-bold tracking-wider mr-1">[Programa/IA]</span> 
          <span className="font-bold">{programName}</span>
          <span className="text-white/80 font-normal ml-2 hidden sm:inline">| Transparência e participação cidadã com IA</span>
        </span>
        <span className="text-[10px] text-white/60 select-none hidden md:inline font-mono">v1.0-beta</span>
      </div>
    </header>
  );
}
