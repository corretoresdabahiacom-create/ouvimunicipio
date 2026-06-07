/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { Header } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { 
  MOCK_MANIFESTACOES, 
  COLORS, 
  BAIRROS_PADRAO, 
  SECRETARIAS_PADRAO 
} from "./data/mockData";
import { Manifestacao, Usuario, SecretariaItem, ClassifyResponse, SimulatedEmailLog } from "./types";
import { 
  ArrowLeft, Check, AlertTriangle, HelpCircle, 
  Trash2, ShieldAlert, Users, Landmark, 
  Layers, Plus, Download, RefreshCw, Sparkles, FileText, FileCheck, CheckCircle2,
  Mail, Bell, Lock, LogIn, UserPlus, Upload, Camera,
  MapPin, Flame, Sliders, MessageSquare, AlertCircle, Map, Activity, Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { 
  db, 
  auth, 
  googleProvider, 
  isConfigPlaceholder 
} from "./lib/firebase";
import { 
  bootstrapCollectionIfEmpty, 
  subscribeToCollection, 
  saveDocument, 
  deleteDocument 
} from "./lib/firestoreSync";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";

export default function App() {
  const lastManifestationsRef = useRef<Record<string, string>>({});
  const [view, setView] = useState<string>("cidadao");
  const [user, setUser] = useState<{ nome: string; perfil: string; email: string; secretaria?: string; ocupacao?: string; permissoes?: Usuario["permissoes"] } | null>(null);

  function isAuthorizedForAgentesEFuncoes(u: typeof user) {
    if (!u) return false;
    const perfil = u.perfil?.toLowerCase() || "";
    const ocupacao = u.ocupacao?.toLowerCase() || "";
    const email = u.email?.toLowerCase() || "";

    // Admin checks
    if (perfil === "admin" || email === "admin@municipio.gov.br") return true;

    // Secretário / Secretaria checks
    if (perfil === "secretaria" || ocupacao.includes("secretário") || ocupacao.includes("secretária")) return true;

    // Procurador checks
    if (perfil === "procurador" || ocupacao.includes("procurador") || email.includes("procurador") || email.includes("procuradoria")) return true;

    return false;
  }
  const [manifestacoes, setManifestacoes] = useState<Manifestacao[]>(MOCK_MANIFESTACOES);
  const [municipio, setMunicipio] = useState<string>("Prefeitura Municipal de Rio Preto");
  const [headerColor, setHeaderColor] = useState<string>("#1351B4");
  const [logoText, setLogoText] = useState<string>("PM");
  const [logoImageUrl, setLogoImageUrl] = useState<string>("/src/assets/images/temple_monument_icon_1780005398797.png");
  const [programName, setProgramName] = useState<string>("Ouvidoria Inteligente IA (Conformidade Completa LGPD)");
  const [configOpen, setConfigOpen] = useState<boolean>(false);

  // States for Advertisement Spaces ("Propagandas") in all views
  const [propagandas, setPropagandas] = useState<{ id: number; titulo: string; link: string; imagem: string; ativa: boolean; telaDestino?: string; posicao?: "superior" | "inferior" | "ambas"; noticiaCompleta?: string; textoBotao?: string }[]>([
    { 
      id: 1, 
      titulo: "Campanha de Vacinação Contra a Gripe - Sábado na UBS Central em Rio Preto", 
      link: "https://www.saude.gov.br", 
      imagem: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=600&auto=format&fit=crop", 
      ativa: true, 
      telaDestino: "inicio", 
      posicao: "superior",
      noticiaCompleta: "A Secretaria Municipal de Saúde de [Cidade] convoca toda a população para o Dia D de Vacinação contra a Gripe neste sábado. Todas as unidades básicas de saúde estarão abertas das 08h às 17h para imunizar idosos, crianças, gestantes e demais grupos prioritários. Proteja sua família contra a Gripe!",
      textoBotao: "Saiba mais"
    },
    { 
      id: 2, 
      titulo: "IPTU Premiado 2026 - Pague em dia e concorra a prêmios incríveis em Rio Preto!", 
      link: "#", 
      imagem: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=600&auto=format&fit=crop", 
      ativa: true, 
      telaDestino: "abrir", 
      posicao: "inferior",
      noticiaCompleta: "A promoção do IPTU Premiado incentiva o desenvolvimento de [Cidade]! Ao quitar sua parcela única ou manter em dia os vencimentos mensais, você concorre de forma totalmente automatizada a prêmios em sorteios públicos transmitidos ao vivo pelos canais municipais no final de cada trimestre.",
      textoBotao: "Saiba mais"
    },
    { 
      id: 3, 
      titulo: "Faça seu cadastro no Portal da Prefeitura de Rio Preto - Transparência Pública Total", 
      link: "#", 
      imagem: "https://images.unsplash.com/photo-1450133064473-71024230f91b?q=80&w=600&auto=format&fit=crop", 
      ativa: true, 
      telaDestino: "consultar", 
      posicao: "ambas",
      noticiaCompleta: "Firme no compromisso da Lei de Acesso à Informação, a Prefeitura de [Cidade] disponibiliza consulta em tempo real de notas fiscais emitidas, relatórios quadrimestrais da lei de responsabilidade fiscal e salários de todos os servidores concursados, comissionados e agentes políticos municipais.",
      textoBotao: "Saiba mais"
    }
  ]);
  const [novaPropaganda, setNovaPropaganda] = useState({ titulo: "", link: "", imagem: "", telaDestino: "todas", posicao: "ambas", noticiaCompleta: "", textoBotao: "Saiba mais" });
  const [activeAdIndex, setActiveAdIndex] = useState<number>(0);
  const [selectedAdForModal, setSelectedAdForModal] = useState<any>(null);

  const getNormalizedCityName = (fullMunicipio: string): string => {
    let cleaned = fullMunicipio;
    cleaned = cleaned.replace(/Prefeitura Municipal de/gi, "").trim();
    cleaned = cleaned.replace(/Câmara Municipal de/gi, "").trim();
    cleaned = cleaned.replace(/Prefeitura de/gi, "").trim();
    cleaned = cleaned.replace(/Câmara de/gi, "").trim();
    cleaned = cleaned.replace(/Município de/gi, "").trim();
    return cleaned || "Rio Preto";
  };

  const formatAdText = (inputText: string) => {
    if (!inputText) return "";
    const cityName = getNormalizedCityName(municipio);
    return inputText
      .replace(/\[Cidade\]/gi, cityName)
      .replace(/\[Municipio\]/gi, cityName)
      .replace(/\[Município\]/gi, cityName)
      .replace(/\[municipio\]/gi, cityName)
      .replace(/\[cidade\]/gi, cityName)
      .replace(/Rio Preto/gi, cityName);
  };

  // Auto rotate publicities every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAdIndex(prev => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Administrative views and controls
  const [dashboardTab, setDashboardTab] = useState<string>("painel");
  const [filtro, setFiltro] = useState({ secretaria: "", status: "", prioridade: "", bairro: "" });
  const [selectedManif, setSelectedManif] = useState<Manifestacao | null>(null);
  const [targetForwardSec, setTargetForwardSec] = useState<string>("");

  // Cabinet advanced forward / delegation options
  const [selectedForwardRole, setSelectedForwardRole] = useState<string>("Servidor");
  const [manualAgentName, setManualAgentName] = useState<string>("");
  const [manualAgentEmail, setManualAgentEmail] = useState<string>("");
  const [selectedPredefinedAgent, setSelectedPredefinedAgent] = useState<PublicAgent | null>(null);

  // Despacho custom text state and generation loading
  const [despachoText, setDespachoText] = useState<string>("");
  const [isGeneratingDespacho, setIsGeneratingDespacho] = useState<boolean>(false);

  useEffect(() => {
    if (selectedManif) {
      setDespachoText(selectedManif.despacho || "");
    } else {
      setDespachoText("");
    }
  }, [selectedManif]);

  // Interactive Heatmap system states
  const [selectedMapBairro, setSelectedMapBairro] = useState<string>("");
  const [selectedMapManif, setSelectedMapManif] = useState<Manifestacao | null>(null);
  const [mapFilterType, setMapFilterType] = useState<string>("todas");
  const [mapFilterPriority, setMapFilterPriority] = useState<string>("todas");
  const [mapShowHeat, setMapShowHeat] = useState<boolean>(true);
  const [mapShowPins, setMapShowPins] = useState<boolean>(true);
  const [mapSearchQuery, setMapSearchQuery] = useState<string>("");
  const [citizenToasts, setCitizenToasts] = useState<{ id: string; titulo: string; protocolo: string; status: string; data: string }[]>([]);

  // States for live report and diligence preview inside Admin/Secretaria Dashboard
  const [reportSecretaria, setReportSecretaria] = useState<string>("");
  const [showReportPreview, setShowReportPreview] = useState<boolean>(false);
  const [diligenciadoName, setDiligenciadoName] = useState<string>("");
  const [customDiligenciadoName, setCustomDiligenciadoName] = useState<string>("");

  // Simulated Email Notification System states
  const [emailLogs, setEmailLogs] = useState<SimulatedEmailLog[]>([]);
  const [emailToasts, setEmailToasts] = useState<{ id: string; email: string; subject: string; body: string; protocol: string; stAntigo: string; stNovo: string }[]>([]);
  const [selectedEmailForModal, setSelectedEmailForModal] = useState<SimulatedEmailLog | null>(null);


  // Manage custom users & secretariats inside state
  const [usuarios, setUsuarios] = useState<Usuario[]>([
    {
      id: 1,
      nome: "Admin do Sistema",
      email: "admin@municipio.gov.br",
      perfil: "admin",
      secretaria: "Ouvidoria",
      ativo: true,
      email_alternativo: "admin.backup@municipio.gov.br",
      permissoes: {
        visualizarRelatorios: true,
        responderChamados: true,
        gerenciarPublicidade: true,
        gerenciarSecretarias: true,
        alterarCores: true
      }
    },
    {
      id: 5,
      nome: "Dr. Orestes Prata (Prefeito)",
      email: "prefeito@municipio.gov.br",
      perfil: "prefeito",
      secretaria: "Ouvidoria",
      ativo: true,
      email_alternativo: "orestes.prata.pessoal@gmail.com",
      permissoes: {
        visualizarRelatorios: true,
        responderChamados: true,
        gerenciarPublicidade: true,
        gerenciarSecretarias: true,
        alterarCores: true
      }
    },
    { 
      id: 2, 
      nome: "João Santos", 
      email: "joao@municipio.gov.br", 
      perfil: "Secretaria", 
      secretaria: "Infraestrutura", 
      ativo: true,
      email_alternativo: "joao.santos.pessoal@gmail.com",
      permissoes: {
        visualizarRelatorios: true,
        responderChamados: true,
        gerenciarPublicidade: false,
        gerenciarSecretarias: false,
        alterarCores: false
      }
    },
    { 
      id: 3, 
      nome: "Dr. Lins", 
      email: "lins@municipio.gov.br", 
      perfil: "Secretaria", 
      secretaria: "Infraestrutura", 
      ativo: true,
      email_alternativo: "lins.infra.pessoal@hotmail.com",
      permissoes: {
        visualizarRelatorios: true,
        responderChamados: true,
        gerenciarPublicidade: false,
        gerenciarSecretarias: false,
        alterarCores: false
      }
    },
    { 
      id: 4, 
      nome: "Dr. Arthur Viana", 
      email: "arthur.viana@procuradoria.gov.br", 
      perfil: "Procurador", 
      secretaria: "Ouvidoria", 
      ativo: true,
      email_alternativo: "arthur.viana.pessoal@outlook.com",
      permissoes: {
        visualizarRelatorios: true,
        responderChamados: true,
        gerenciarPublicidade: false,
        gerenciarSecretarias: true,
        alterarCores: false
      }
    },
  ]);

  // Controle de aceitação dos termos com bloqueio de tela
  const [termosRecusados, setTermosRecusados] = useState(false);

  const hasAcceptedTerms = useMemo(() => {
    if (!user) return true;
    const emailKey = user.email.toLowerCase();
    
    // Check localStorage first
    if (localStorage.getItem(`termos_aceitos_${emailKey}`) === "true") {
      return true;
    }
    
    // Check database state from usuarios
    const matchingProfile = usuarios.find(u => u.email.toLowerCase() === emailKey);
    if (matchingProfile?.termos_aceitos) {
      localStorage.setItem(`termos_aceitos_${emailKey}`, "true");
      return true;
    }
    return false;
  }, [user, usuarios]);

  const handleAceptTermos = () => {
    if (!user) return;
    const emailKey = user.email.toLowerCase();
    localStorage.setItem(`termos_aceitos_${emailKey}`, "true");
    setTermosRecusados(false);
    
    // Persist status inside the matching profile
    const matchingProfile = usuarios.find(u => u.email.toLowerCase() === emailKey);
    if (matchingProfile) {
      const updatedUser: Usuario = {
        ...matchingProfile,
        termos_aceitos: true,
        termos_data_aceito: new Date().toISOString()
      };
      setUsuarios(prev => prev.map(u => u.email.toLowerCase() === emailKey ? updatedUser : u));
      saveDocument("usuarios", emailKey, updatedUser);
    }
    alert("Excelente! Você aceitou e consentiu com os Termos e Condições Gerais e de Proteção Legal. Seu acesso ao portal está totalmente desbloqueado!");
  };

  const [secretarias, setSecretarias] = useState<SecretariaItem[]>(() => {
    const defaultDescriptions: Record<string, string> = {
      "Infraestrutura": "Gerenciamento de asfalto, pavimentação, tapa-buracos, postes de iluminação pública e bueiros.",
      "Serviços Públicos": "Coleta de lixo, varrição de ruas, entulho clandestino, capina de mato e conservação de praças públicas.",
      "Saúde": "Regulação e atendimento médico em postos UBS, vacinas, exames e agendamento de consultas.",
      "Saneamento": "Vazamento de água, encanamento na rua, tratamento de esgoto e redes de saneamento.",
      "Educação": "Escolas municipais, creches, merenda escolar, matriculas e transporte escolar.",
      "Segurança": "Atendimento da Guarda Municipal, câmeras de segurança, patrulhamento e vandalismo."
    };
    return SECRETARIAS_PADRAO.map((s, i) => ({
      id: i + 1,
      nome: s,
      email: `${s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")}@pref.gov.br`,
      responsavel: "A definir",
      funcoes: defaultDescriptions[s] || "Problemas gerais e encaminhamentos."
    }));
  });

  // real-time synchronization hook for Firebase/Firestore and authentication state
  useEffect(() => {
    const bootstrapAndSubscribe = async () => {
      if (!isConfigPlaceholder && db) {
        try {
          await bootstrapCollectionIfEmpty("manifestacoes", MOCK_MANIFESTACOES);
          await bootstrapCollectionIfEmpty("usuarios", usuarios);
          await bootstrapCollectionIfEmpty("secretarias", secretarias);
          await bootstrapCollectionIfEmpty("propagandas", propagandas);
          console.log("Firestore Collections Bootstrapped successfully with pre-filled mock records.");
        } catch (err) {
          console.warn("Bootstrap error (potential permission lag or offline mode):", err);
        }
      }
    };
    bootstrapAndSubscribe();

    const unsubManifestacoes = subscribeToCollection<Manifestacao>(
      "manifestacoes",
      setManifestacoes,
      MOCK_MANIFESTACOES,
      (item) => item.protocolo
    );

    const unsubUsuarios = subscribeToCollection<Usuario>(
      "usuarios",
      setUsuarios,
      usuarios,
      (item) => item.email
    );

    const unsubSecretarias = subscribeToCollection<SecretariaItem>(
      "secretarias",
      setSecretarias,
      secretarias,
      (item) => item.id
    );

    const unsubPropagandas = subscribeToCollection<any>(
      "propagandas",
      setPropagandas,
      propagandas,
      (item) => item.id
    );

    const unsubEmailLogs = subscribeToCollection<SimulatedEmailLog>(
      "emails_simulados",
      setEmailLogs,
      [],
      (item) => item.id
    );

    return () => {
      unsubManifestacoes();
      unsubUsuarios();
      unsubSecretarias();
      unsubPropagandas();
      unsubEmailLogs();
    };
  }, []);

  // Firebase auth state observer
  useEffect(() => {
    if (auth && !isConfigPlaceholder) {
      const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const matchedAgent = usuarios.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
          if (matchedAgent) {
            setUser({
              nome: firebaseUser.displayName || matchedAgent.nome,
              perfil: matchedAgent.perfil,
              email: firebaseUser.email || matchedAgent.email,
              secretaria: matchedAgent.secretaria,
              ocupacao: matchedAgent.ocupacao || matchedAgent.perfil,
              permissoes: matchedAgent.permissoes
            });
            setView("dashboard");
          } else {
            setUser({
              nome: firebaseUser.displayName || "Cidadão Autenticado",
              perfil: "cidadao",
              email: firebaseUser.email || "",
              ocupacao: "Cidadão"
            });
          }
        }
      });
      return () => unsubAuth();
    }
  }, [usuarios]);

  function triggerSimulatedEmail(manif: Manifestacao, statusAntigo: string, statusNovo: string) {
    if (statusAntigo === statusNovo) return;
    const destEmail = `manifestante.${manif.protocolo}@ouvidoria.gov.br`;
    const emailSubject = `[${municipio}] Atualização de Status: Protocolo nº ${manif.protocolo}`;
    
    const emailBody = `Prezado(a) cidadão(ã),

Gostaríamos de informar que a sua manifestação (Protocolo nº ${manif.protocolo}) referente a "${manif.tipo}" direcionada para a secretaria de ${manif.secretaria} teve uma alteração de status.

* Histórico de Movimentação do Chamado:
• Status Anterior: [${statusAntigo}]
• Novo Status: [${statusNovo}]
• Data do Evento: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
• Responsável pela Alteração: ${user?.nome ? `${user.nome} (${user.perfil})` : 'Agente Público'}

* Resumo da Demanda Original:
"${manif.descricao.length > 120 ? manif.descricao.substring(0, 117) + "..." : manif.descricao}"

Agradecemos por contribuir para o aprimoramento dos serviços públicos em nosso município. Para realizar o acompanhamento online, utilize a consulta de protocolo do sistema com o código inserido.

Atenciosamente,
Gabinete de Ouvidoria Integrada
${municipio}`;

    const newLog: SimulatedEmailLog = {
      id: `EMAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      protocolo: manif.protocolo,
      destinatario: destEmail,
      assunto: emailSubject,
      conteudo: emailBody,
      timestamp: new Date().toISOString(),
      statusAntigo,
      statusNovo
    };

    setEmailLogs(prev => [newLog, ...prev]);
    saveDocument("emails_simulados", newLog.id, newLog);

    const toastId = `TOAST-${Date.now()}`;
    const newToast = {
      id: toastId,
      email: destEmail,
      subject: emailSubject,
      body: emailBody,
      protocol: manif.protocolo,
      stAntigo: statusAntigo,
      stNovo: statusNovo
    };
    setEmailToasts(prev => [newToast, ...prev].slice(0, 5));

    setTimeout(() => {
      setEmailToasts(prev => prev.filter(t => t.id !== toastId));
    }, 8000);
  }

  function triggerForwardSimulatedEmail(manif: Manifestacao, antigaSec: string, novaSec: string) {
    const destEmail = `manifestante.${manif.protocolo}@ouvidoria.gov.br`;
    const emailSubject = `[${municipio}] Trâmite Interno: Protocolo nº ${manif.protocolo}`;
    
    const emailBody = `Prezado(a) cidadão(ã),

Gostaríamos de informar que a sua manifestação (Protocolo nº ${manif.protocolo}) referente a "${manif.tipo}" foi transferida/encaminhada internamente para melhor atendimento às suas necessidades.

* Histórico de Trâmite do Chamado:
• Secretaria de Origem: [${antigaSec}]
• Secretaria de Destino: [${novaSec}]
• Data do Trâmite: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
• Agente de Encaminhamento: ${user?.nome ? `${user.nome} (${user.perfil})` : 'Agente Público'}

A nova secretaria está ciente da demanda e dará continuidade à resolução do seu chamado.

Atenciosamente,
Gabinete de Ouvidoria Integrada
${municipio}`;

    const newLog: SimulatedEmailLog = {
      id: `EMAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      protocolo: manif.protocolo,
      destinatario: destEmail,
      assunto: emailSubject,
      conteudo: emailBody,
      timestamp: new Date().toISOString(),
      statusAntigo: manif.status,
      statusNovo: manif.status
    };

    setEmailLogs(prev => [newLog, ...prev]);
    saveDocument("emails_simulados", newLog.id, newLog);

    const toastId = `TOAST-${Date.now()}`;
    const newToast = {
      id: toastId,
      email: destEmail,
      subject: emailSubject,
      body: emailBody,
      protocol: manif.protocolo,
      stAntigo: `De: ${antigaSec}`,
      stNovo: `Para: ${novaSec}`
    };
    setEmailToasts(prev => [newToast, ...prev].slice(0, 5));

    setTimeout(() => {
      setEmailToasts(prev => prev.filter(t => t.id !== toastId));
    }, 8000);
  }

  // -----------------------------------------------------------------
  // ROLES & DELEGATIONS IN CONFORMITY WITH CABINET STATUTES
  // -----------------------------------------------------------------
  interface PublicAgent {
    nome: string;
    cargo: string; // "Secretário", "Servidor", "Diretor", "Assessor", "Coordenador", "Prefeito", "Procurador"
    email: string;
    departamento: string;
    atribuicoes: string;
  }

  const PUBLIC_AGENTS_DATABASE: PublicAgent[] = [
    { nome: "Dr. Arthur Viana", cargo: "Procurador", email: "arthur.viana@procuradoria.gov.br", departamento: "Procuradoria Geral do Município (PGM)", atribuicoes: "Defesa jurídica, pareceres regulatórios formais de legalidade e integridade normativa do gabinete." },
    { nome: "Dr. Fernando Abreu", cargo: "Procurador", email: "fernando.abreu@procuradoria.gov.br", departamento: "Procuradoria de Assuntos Fiscais", atribuicoes: "Controle de legalidade fiscal, convênios de infraestrutura e contratos de licitação." },
    
    { nome: "Mariana Silva", cargo: "Prefeito", email: "prefeito@municipio.gov.br", departamento: "Gabinete Executivo Municipal", atribuicoes: "Chefe do Executivo. Decisões estratégicas de alto escalão e homologação final de intervenções urbanas de grande porte." },
    
    { nome: "Maria Silva", cargo: "Secretário", email: "maria.social@municipio.gov.br", departamento: "Ação Social", atribuicoes: "Planejamento e coordenação transversal de programas de auxílio social e cidadania no município." },
    { nome: "Paulo Souza", cargo: "Secretário", email: "paulo.servicos@municipio.gov.br", departamento: "Serviços Públicos", atribuicoes: "Gerenciamento de iluminação pública, conservação de parques, cemitérios e coleta seletiva de lixo municipal." },
    { nome: "Dr. Lins", cargo: "Secretário", email: "lins@municipio.gov.br", departamento: "Infraestrutura", atribuicoes: "Gabinete de Infraestrutura municipal, pavimentação, obras rodoviárias e planejamento estrutural." },
    
    { nome: "Regina Rocha", cargo: "Diretor", email: "regina.obras@municipio.gov.br", departamento: "Diretoria de Obras Hidráulicas", atribuicoes: "Supervisão direta e vistorias em canteiros de obras de drenagem, asfalto e manutenção corretiva." },
    { nome: "Roberto Ramos", cargo: "Diretor", email: "roberto.transporte@municipio.gov.br", departamento: "Diretoria de Mobilidade e Transportes", atribuicoes: "Sinalização urbana horizontal/vertical e planejamento técnico de linhas e abrigos de ônibus públicos." },
    
    { nome: "Eduardo Lima", cargo: "Assessor", email: "eduardo.obras@municipio.gov.br", departamento: "Gabinete de Infraestrutura", atribuicoes: "Suporte corporativo direto de engenharia de tráfego, interface técnica de controle técnico prioritário." },
    { nome: "Fernanda Neves", cargo: "Assessor", email: "fernanda.parlamentar@infra.gov.br", departamento: "Gabinete de Relações Institucionais", atribuicoes: "Assessoria parlamentar, interface direta com vereadores e acompanhamento legislativo prioritário." },
    
    { nome: "Gisele Pires", cargo: "Coordenador", email: "gisele.seguranca@municipio.gov.br", departamento: "Coordenadoria de Defesa Civil", atribuicoes: "Planejamento de contingência emergencial, fiscalização de encostas e interdição de áreas de risco elevado." },
    { nome: "Milena Sales", cargo: "Coordenador", email: "milena.pavimentacao@infra.gov.br", departamento: "Coordenadoria de Recapeamento e Operações", atribuicoes: "Gestão das equipes operacionais de tapa-buracos, pavimentação asfáltica primária e maquinário." },
    
    { nome: "João Santos", cargo: "Servidor", email: "joao@municipio.gov.br", departamento: "Infraestrutura", atribuicoes: "Agente técnico operacional. Condução de vistorias técnicas presençais de campo e redação de ordens de serviço primárias." },
    { nome: "Alana Santos", cargo: "Servidor", email: "alana.saneamento@infra.gov.br", departamento: "Vigilância de Saneamento", atribuicoes: "Servidora de carreira integrada. Emite vistorias sobre vazamentos de águas fluviais secundárias e bueiros." }
  ];

  const ROLE_ATTRIBUTIONS: Record<string, string> = {
    "Procurador": "Exame e emissão de pareceres jurídicos formais sobre legalidade de obras, licitações municipais, conformidade administrativa e termos contratuais de parcerias.",
    "Prefeito": "Instância executiva máxima para resoluções de grande impacto estratégico, liberação de fundos contingenciais e coordenação intersetorial de crises e obras macro.",
    "Secretário": "Planejamento político do gabinete, gestão transversal de convênios federais/estaduais e ordenação de despesas regulatórias setoriais.",
    "Diretor": "Direção técnica direta das repartições de controle de obras físicas, vistorias complexas, medições contratuais preliminares e fiscalização de convênios.",
    "Assessor": "Serviços internos de assessoria de gabinete, pareceres imediatos de tráfego, articulação institucional com o legislativo municipal e vereadores.",
    "Coordenador": "Supervisão e distribuição direta das frentes de serviço, equipes táticas de campo, maquinário público e controle interno de prazos imediatos.",
    "Servidor": "Vistorias in loco de rotina, fiscalização preliminar de posturas urbanas, produção de laudos fotográficos ordinários e execução manual."
  };

  function triggerAgentForwardSimulatedEmail(manif: Manifestacao, agentName: string, agentRole: string, agentEmail: string, designRationale: string) {
    // 1. Resolve Receiver's Alternative Email
    const receiverUser = usuarios.find(u => u.email.toLowerCase() === agentEmail.toLowerCase());
    const receiverDest = receiverUser?.email_alternativo || agentEmail;

    // 2. Resolve Sender's Alternative Email (current logged-in agent)
    const senderUser = usuarios.find(u => u.email.toLowerCase() === user?.email?.toLowerCase());
    const senderDest = senderUser?.email_alternativo || user?.email || "gabinete@ouvidoria.gov.br";

    const emailSubject = `[Atribuição Oficial] Chamado de Ouvidoria #${manif.protocolo} Encaminhado para Resolução`;
    const emailBody = `Prezado(a) ${agentRole} ${agentName},

Por determinação do Gabinete da Secretaria de ${manif.secretaria || "Ouvidoria Geral"}, a manifestação protocolada sob o número #${manif.protocolo} referente a "${manif.tipo}" foi oficialmente atribuída e encaminhada à sua alçada funcional para providências de resolução.

Atribuição Regimental correspondente ao seu cargo de [${agentRole}]:
"${designRationale}"

* Detalhes do Chamado:
• Resumo: ${manif.descricao}
• Localidade: Bairro ${manif.bairro}
• Prioridade Estipulada: ${manif.prioridade}
• Data de Abertura: ${manif.data}

Por favor, proceda com o acolhimento técnico desta demanda e providencie a alimentação das ações correspondentes no sistema da Ouvidoria Municipal em conformidade com as metas do plano plurianual de gestão.

*(Este despacho foi recebido no seu e-mail alternativo de notificação: ${receiverDest} e pelo painel oficial do app)*

Atenciosamente,
Gabinete de Controle Governamental do Município`;

    // A. Log primary email sent to receiver
    const newLog: SimulatedEmailLog = {
      id: `EMAIL-${Date.now()}-REC-${Math.floor(Math.random() * 1000)}`,
      protocolo: manif.protocolo,
      destinatario: receiverDest,
      assunto: emailSubject,
      conteudo: emailBody,
      timestamp: new Date().toISOString(),
      statusAntigo: manif.status,
      statusNovo: "Atribuído"
    };

    setEmailLogs(prev => [newLog, ...prev]);
    saveDocument("emails_simulados", newLog.id, newLog);

    // Toast alert on app screen
    const toastId = `TOAST-${Date.now()}`;
    setEmailToasts(prev => [
      {
        id: toastId,
        email: receiverDest,
        subject: emailSubject,
        body: emailBody,
        protocol: manif.protocolo,
        stAntigo: `Para: ${agentName}`,
        stNovo: `E-mail: ${receiverDest}`
      },
      ...prev
    ].slice(0, 5));
    setTimeout(() => {
      setEmailToasts(prev => prev.filter(t => t.id !== toastId));
    }, 8000);

    // B. Send copy to Sender's alternative email as Proof of attribution/knowledge!
    if (senderDest) {
      const proofSubject = `[CÓPIA DE PROVA] Atribuição de Demanda para #${manif.protocolo}`;
      const proofBody = `PROVA RECONHECIDA DE ATRIBUIÇÃO DE DEMANDA

Este e-mail serve de prova oficial registrada de que você, ${user?.nome || "Agente Público"}, delegou o chamado #${manif.protocolo} ao agente público ${agentName} (${agentRole}) no dia ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}.

O agente receptor foi notificado oficialmente no e-mail alternativo dele: ${receiverDest}

* Detalhes da atribuição provada:
• Secretaria: ${manif.secretaria}
• Diretriz regimental do despacho: "${designRationale}"

* Detalhes do Chamado:
• Descrição da Ocorrência: "${manif.descricao}"

Gabinete de Governança Digital e Transparência
${municipio}`;

      const proofLog: SimulatedEmailLog = {
        id: `EMAIL-${Date.now()}-PROOF-${Math.floor(Math.random() * 1000)}`,
        protocolo: manif.protocolo,
        destinatario: senderDest,
        assunto: proofSubject,
        conteudo: proofBody,
        timestamp: new Date().toISOString(),
        statusAntigo: manif.status,
        statusNovo: "Prova de Atribuição"
      };

      setEmailLogs(prev => [proofLog, ...prev]);
      saveDocument("emails_simulados", proofLog.id, proofLog);

      // We can also trigger a secondary toast indicating proof is emailed!
      const toastProofId = `TOAST-PROOF-${Date.now()}`;
      setEmailToasts(prev => [
        {
          id: toastProofId,
          email: senderDest,
          subject: proofSubject,
          body: proofBody,
          protocol: manif.protocolo,
          stAntigo: `Prova Enviada`,
          stNovo: `E-mail: ${senderDest}`
        },
        ...prev
      ].slice(0, 5));
      setTimeout(() => {
        setEmailToasts(prev => prev.filter(t => t.id !== toastProofId));
      }, 8000);
    }
  }

  function triggerDispatchSimulatedEmail(manif: Manifestacao, despachoText: string) {
    if (!manif.responsavel_email) return;

    // 1. Resolve Receiver's Alternative Email (the responsible agent)
    const receiverUser = usuarios.find(u => u.email.toLowerCase() === manif.responsavel_email!.toLowerCase());
    const receiverDest = receiverUser?.email_alternativo || manif.responsavel_email!;

    // 2. Resolve Sender's Alternative Email (current logged-in agent)
    const senderUser = usuarios.find(u => u.email.toLowerCase() === user?.email?.toLowerCase());
    const senderDest = senderUser?.email_alternativo || user?.email || "gabinete@ouvidoria.gov.br";

    const emailSubject = `[Novo Despacho Oficial] Atualização de Providência no Chamado #${manif.protocolo}`;
    const emailBody = `Prezado(a) ${manif.responsavel_nome || "Agente Responsável"},

Um novo despacho oficial de atribuição ou cobrança de providência foi emitido pelo Gabinete no chamado de Ouvidoria #${manif.protocolo} sob os seus cuidados.

* Histórico do Despacho Homologado:
• Autor do Despacho: ${user?.nome || "Gabinete Ouvidoria"} (${user?.ocupacao || user?.perfil || "Servidor"})
• Texto do Despacho: "${despachoText}"
• Data e Hora: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}

Por favor, analise a instrução e dê o devido andamento à resolução no painel do sistema.

*(Este despacho foi transmitido ao seu e-mail alternativo: ${receiverDest})*

Atenciosamente,
Gabinete de Ouvidoria Integrada
${municipio}`;

    // A. Log simulated email sent to receiver
    const newLog: SimulatedEmailLog = {
      id: `EMAIL-${Date.now()}-DESP-${Math.floor(Math.random() * 1000)}`,
      protocolo: manif.protocolo,
      destinatario: receiverDest,
      assunto: emailSubject,
      conteudo: emailBody,
      timestamp: new Date().toISOString(),
      statusAntigo: manif.status,
      statusNovo: "Despachado"
    };

    setEmailLogs(prev => [newLog, ...prev]);
    saveDocument("emails_simulados", newLog.id, newLog);

    const toastId = `TOAST-${Date.now()}`;
    setEmailToasts(prev => [
      {
        id: toastId,
        email: receiverDest,
        subject: emailSubject,
        body: emailBody,
        protocol: manif.protocolo,
        stAntigo: `Despacho para: ${manif.responsavel_nome || "Responsável"}`,
        stNovo: `E-mail: ${receiverDest}`
      },
      ...prev
    ].slice(0, 5));
    setTimeout(() => {
      setEmailToasts(prev => prev.filter(t => t.id !== toastId));
    }, 8000);

    // B. Send copy to Sender's alternative email as Proof of dispatch/attribution!
    if (senderDest) {
      const proofSubject = `[CÓPIA DE PROVA] Despacho Homologado para a Demanda #${manif.protocolo}`;
      const proofBody = `PROVA RECONHECIDA DE ATRIBUIÇÃO / DESPACHO OFICIAL

Este e-mail serve de prova oficial registrada de que você, ${user?.nome || "Agente Público"}, emitiu um despacho oficial e notificou o responsável ${manif.responsavel_nome || "agente subordinado"} sobre o chamado #${manif.protocolo} no dia ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}.

O agente responsável recebeu esta notificação de providências em seu e-mail alternativo: ${receiverDest}

* Detalhes do Despacho de Prova:
• Destinatário: ${manif.responsavel_nome} (${manif.responsavel_email})
• Teor Oficial do Despacho: "${despachoText}"

Gabinete de Governança Digital e Transparência
${municipio}`;

      const proofLog: SimulatedEmailLog = {
        id: `EMAIL-${Date.now()}-DESP-PROOF-${Math.floor(Math.random() * 1000)}`,
        protocolo: manif.protocolo,
        destinatario: senderDest,
        assunto: proofSubject,
        conteudo: proofBody,
        timestamp: new Date().toISOString(),
        statusAntigo: manif.status,
        statusNovo: "Prova de Despacho"
      };

      setEmailLogs(prev => [proofLog, ...prev]);
      saveDocument("emails_simulados", proofLog.id, proofLog);

      const toastProofId = `TOAST-DESP-PROOF-${Date.now()}`;
      setEmailToasts(prev => [
        {
          id: toastProofId,
          email: senderDest,
          subject: proofSubject,
          body: proofBody,
          protocol: manif.protocolo,
          stAntigo: `Prova do Despacho`,
          stNovo: `E-mail: ${senderDest}`
        },
        ...prev
      ].slice(0, 5));
      setTimeout(() => {
        setEmailToasts(prev => prev.filter(t => t.id !== toastProofId));
      }, 8000);
    }
  }

  async function handleAIDespachoAction(acao: "suggest" | "improve") {
    if (!selectedManif) return;
    setIsGeneratingDespacho(true);
    try {
      const response = await fetch("/api/despacho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolo: selectedManif.protocolo,
          tipo: selectedManif.tipo,
          descricao: selectedManif.descricao,
          rascunho: despachoText,
          agenteNome: user?.nome || "Agente de Gabinete",
          agenteCargo: user?.ocupacao || user?.perfil || "Servidor",
          acao
        })
      });
      const data = await response.json();
      if (data.despacho) {
        setDespachoText(data.despacho);
      }
    } catch (err) {
      console.error("Erro ao processar despacho com IA:", err);
      alert("Houve uma falha ao acionar o assistente de despacho municipal.");
    } finally {
      setIsGeneratingDespacho(false);
    }
  }

  // Sub-forms for administrative inserts
  const [novoUsuario, setNovoUsuario] = useState({ 
    nome: "", 
    email: "", 
    perfil: "Ouvidoria", 
    secretaria: "",
    email_alternativo: "",
    visualizarRelatorios: true,
    responderChamados: true,
    gerenciarPublicidade: false,
    gerenciarSecretarias: false,
    alterarCores: false
  });
  const [novaSecretaria, setNovaSecretaria] = useState({ nome: "", email: "", responsavel: "", funcoes: "" });

  // Creation Wizard states
  const [form, setForm] = useState({
    tipo: "Reclamação",
    descricao: "",
    bairro: "",
    foto: false,
    localizacao: false,
    consentimento: false,
  });
  const [step, setStep] = useState<number>(1);
  const [iaResponse, setIaResponse] = useState<ClassifyResponse | null>(null);
  const [createdProtocol, setCreatedProtocol] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);

  // Tracker states
  const [searchProtocol, setSearchProtocol] = useState("");
  const [searchResult, setSearchResult] = useState<Manifestacao | null>(null);
  const [searchError, setSearchError] = useState("");

  // Registration & Member Login
  const [cadastroForm, setCadastroForm] = useState({
    nome: "", endereco: "", telefone: "", email: "", cpf: "", senha: "", consentimento: false, ocupacao: "Cidadão"
  });
  const [usuariosCadastrados, setUsuariosCadastrados] = useState<any[]>([
    { nome: "Mariana Silva", email: "mariana@email.com", senha: "123", ocupacao: "Vereador" },
    { nome: "Jefferson Santos", email: "jefferson@email.com", senha: "123", ocupacao: "Cidadão" }
  ]);
  const [cadastroSucesso, setCadastroSucesso] = useState(false);
  const [loginForm, setLoginForm] = useState({ login: "", senha: "" });
  const [loginErro, setLoginErro] = useState("");
  const [isForgotPass, setIsForgotPass] = useState(false);

  async function handleGoogleSignIn() {
    if (!auth || isConfigPlaceholder) {
      alert("Para utilizar a autenticação real do Google, conecte seu projeto Firebase real ou use as credenciais de simulação técnica disponibilizadas abaixo.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Erro no Google Sign-In:", err);
      alert(`Falha na autenticação com o Google: ${err.message || err.toString()}`);
    }
  }

  async function handleLogout() {
    if (auth && !isConfigPlaceholder) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("Erro ao fazer logout:", err);
      }
    }
    setUser(null);
    setView("cidadao");
  }

  // Submit description to the server for AI categorization
  async function handleAnalyzeDescription() {
    if (!form.descricao) return;
    setIsClassifying(true);
    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: form.descricao, tipo: form.tipo, secretarias: secretarias }),
      });
      if (response.ok) {
        const data: ClassifyResponse = await response.json();
        setIaResponse(data);
        setStep(2);
      } else {
        throw new Error("Erro de conexão com a API.");
      }
    } catch (err) {
      console.error(err);
      // Fallback classification client-side if server is unreachable
      const fallbackData = classifyFallbackClient(form.descricao, form.tipo);
      setIaResponse(fallbackData);
      setStep(2);
    } finally {
      setIsClassifying(false);
    }
  }

  // Client-side rule classifier in case API goes wrong
  function classifyFallbackClient(texto: string, tipo: string): ClassifyResponse {
    const t = texto.toLowerCase();
    let categoria = "Geral";
    let secretaria = "Ouvidoria";
    let prioridade = "Média";
    let resposta = "Sua manifestação foi registrada e já foi enviada para triagem inicial pela equipe responsável.";

    // Tenta encontrar por funções da secretaria se houver
    let foundSec = "";
    for (const sec of secretarias) {
      if (sec.funcoes) {
        const funcoesLower = sec.funcoes.toLowerCase();
        const tokens = t.split(/[\s,.;:!?\/()_\-]+/).filter(w => w.length > 3);
        for (const token of tokens) {
          if (funcoesLower.includes(token)) {
            foundSec = sec.nome;
            break;
          }
        }
      }
      if (foundSec) break;
    }

    if (foundSec) {
      secretaria = foundSec;
      categoria = foundSec;
      prioridade = "Média";
      resposta = `Agradecemos por registrar seu relato. Com base nas competências dadas, sua solicitação foi pré-direcionada para a secretaria comunitária de "${foundSec}".`;
    } else if (t.includes("buraco") || t.includes("pavimento") || t.includes("asfalto") || t.includes("rua") || t.includes("cratera")) {
      categoria = "Pavimentação";
      secretaria = "Infraestrutura";
      prioridade = "Alta";
      resposta = "Triamos sua manifestação com foco em Pavimentação asfáltica. Ela foi enviada com ALTA prioridade para a Secretaria de Infraestrutura.";
    } else if (t.includes("luz") || t.includes("poste") || t.includes("ilumin") || t.includes("escuro")) {
      categoria = "Iluminação Pública";
      secretaria = "Infraestrutura";
      prioridade = "Média";
      resposta = "Assunto catalogado como Iluminação Pública. O chamado foi enviado para a Secretaria de Infraestrutura.";
    } else if (t.includes("lixo") || t.includes("limpeza") || t.includes("entulho") || t.includes("capina")) {
      categoria = "Limpeza Urbana";
      secretaria = "Serviços Públicos";
      prioridade = "Alta";
      resposta = "Pedido encaminhado para a Secretaria de Serviços Públicos na divisão de Limpeza Urbana para recolhimento rápido.";
    } else if (t.includes("água") || t.includes("esgoto") || t.includes("vazamento") || t.includes("saneamento")) {
      categoria = "Saneamento";
      secretaria = "Saneamento";
      prioridade = "Alta";
      resposta = "Sua reclamação de Saneamento foi enviada como prioritária para os canais de engenharia ambiental.";
    }

    if (tipo === "Denúncia" && prioridade !== "Alta") {
      prioridade = "Urgente";
    }

    return {
      categoria,
      secretaria,
      prioridade,
      resposta,
      is_ai: false
    };
  }

  function handleConfirmAndPublish() {
    if (!iaResponse) return;
    const currentYear = new Date().getFullYear();
    const sequenceNumber = String(manifestacoes.length + 1).padStart(3, "0");
    const uniqueProtocol = `${currentYear}${sequenceNumber}`;

    const isVereador = user?.ocupacao === "Vereador";

    const novaManif: Manifestacao = {
      id: manifestacoes.length + 1,
      protocolo: uniqueProtocol,
      tipo: form.tipo,
      descricao: form.descricao,
      status: isVereador ? "Urgente" : (form.tipo === "Denúncia" ? "Urgente" : "Pendente"),
      prioridade: isVereador ? "Alta" : iaResponse.prioridade,
      secretaria: iaResponse.secretaria,
      bairro: form.bairro || "Não informado",
      data: new Date().toISOString().split("T")[0],
      ia_categoria: iaResponse.categoria,
      resposta_ia: isVereador 
        ? "🚨 [Prioridade Parlamentar] Esta manifestação foi enviada por um membro da Câmara de Vereadores. Triagem de atendimento prioritária em regime de urgência regimental municipal ativada." 
        : iaResponse.resposta,
      autor_nome: user?.nome || "Cidadão Anonimizado",
      autor_ocupacao: user?.ocupacao || "Cidadão",
      destacado: isVereador
    };

    setManifestacoes((prev) => [novaManif, ...prev]);
    saveDocument("manifestacoes", uniqueProtocol, novaManif);
    
    // Save to local list of watched protocols
    try {
      const myProtocolsStr = localStorage.getItem("meus_protocolos") || "[]";
      const myProtocols = JSON.parse(myProtocolsStr);
      if (!myProtocols.includes(uniqueProtocol)) {
        myProtocols.push(uniqueProtocol);
        localStorage.setItem("meus_protocolos", JSON.stringify(myProtocols));
      }
    } catch (e) {}

    setCreatedProtocol(uniqueProtocol);
    setStep(3);
  }

  function handleSearchProtocol() {
    setSearchError("");
    setSearchResult(null);
    const trimmed = searchProtocol.trim();
    if (!trimmed) {
      setSearchError("Por favor, digite um número de protocolo.");
      return;
    }
    const found = manifestacoes.find(m => m.protocolo === trimmed);
    if (found) {
      setSearchResult(found);
      
      // Save searched protocol to local watched list
      try {
        const myProtocolsStr = localStorage.getItem("meus_protocolos") || "[]";
        const myProtocols = JSON.parse(myProtocolsStr);
        if (!myProtocols.includes(found.protocolo)) {
          myProtocols.push(found.protocolo);
          localStorage.setItem("meus_protocolos", JSON.stringify(myProtocols));
        }
      } catch (e) {}
    } else {
      setSearchError("Protocolo não encontrado. Verifique se digitou todos os números.");
    }
  }

  function handleLoginSubmit() {
    setLoginErro("");
    const loginVal = loginForm.login.trim();
    const senhaVal = loginForm.senha;

    if (!loginVal || !senhaVal) {
      setLoginErro("Preencha o e-mail e a senha corretos.");
      return;
    }

    if (loginVal === "admin@municipio.gov.br" && senhaVal === "admin123") {
      setUser({ nome: "Admin do Sistema", perfil: "admin", email: loginVal, ocupacao: "Administrador" });
      setView("dashboard");
      return;
    }

    if (loginVal === "prefeito@municipio.gov.br" && senhaVal === "prefeito123") {
      setUser({ 
        nome: "Dr. Orestes Prata (Prefeito)", 
        perfil: "prefeito", 
        email: loginVal, 
        ocupacao: "Prefeito do Município",
        permissoes: {
          visualizarRelatorios: true,
          responderChamados: true,
          gerenciarPublicidade: true,
          gerenciarSecretarias: true,
          alterarCores: true
        }
      });
      setView("dashboard");
      return;
    }

    // Procura na lista de servidores/usuários cadastrados
    const foundUser = usuarios.find(u => u.email.toLowerCase() === loginVal.toLowerCase());
    if (foundUser) {
      if (foundUser.email.toLowerCase() === "lins@municipio.gov.br" && senhaVal !== "lins123") {
        setLoginErro("Senha incorreta para o Secretário.");
        return;
      }
      if (!foundUser.ativo) {
        setLoginErro("Esta conta de servidor está desativada.");
        return;
      }
      setUser({ 
        nome: foundUser.nome, 
        perfil: foundUser.perfil, 
        email: foundUser.email, 
        secretaria: foundUser.secretaria,
        ocupacao: foundUser.email.toLowerCase() === "lins@municipio.gov.br" 
          ? "Secretário de Infraestrutura" 
          : (foundUser.perfil?.toLowerCase() === "procurador"
              ? "Procurador"
              : (foundUser.perfil?.toLowerCase() === "secretaria"
                  ? "Secretário"
                  : "Servidor Público"
                )
            ),
        permissoes: foundUser.permissoes
      });
      setView("dashboard");
      return;
    }

    // Procura na lista de cidadãos cadastrados por nós
    const foundCidadao = usuariosCadastrados.find(
      c => c.email.toLowerCase() === loginVal.toLowerCase() && c.senha === senhaVal
    );
    if (foundCidadao) {
      setUser({
        nome: foundCidadao.nome,
        perfil: "cidadao",
        email: foundCidadao.email,
        ocupacao: foundCidadao.ocupacao
      });
      setView("cidadao");
      return;
    }

    setLoginErro("Dados de login incorretos ou conta de cidadão não encontrada. Por favor, cadastre sua conta primeiro!");
  }

  function handleUserRegister() {
    if (!cadastroForm.nome || !cadastroForm.email || !cadastroForm.senha) {
      alert("Preencha todos os campos obrigatórios (*).");
      return;
    }
    if (!cadastroForm.consentimento) {
      alert("É necessário consentir com termos LGPD para prosseguir.");
      return;
    }

    // Salva o novo cidadão no banco local do estado
    const novoCidadao = {
      nome: cadastroForm.nome,
      email: cadastroForm.email,
      senha: cadastroForm.senha,
      telefone: cadastroForm.telefone,
      cpf: cadastroForm.cpf,
      endereco: cadastroForm.endereco,
      ocupacao: cadastroForm.ocupacao || "Cidadão"
    };

    setUsuariosCadastrados(prev => [...prev, novoCidadao]);
    setCadastroSucesso(true);
  }

  // Se o usuário logado for de uma secretaria específica, filtramos as manifestações para ela antes de computar estáticas e listas
  const manifestacoesParaUsuario = manifestacoes.filter(m => {
    if (user && user.perfil === "Secretaria" && user.secretaria) {
      return m.secretaria?.toLowerCase().trim() === user.secretaria?.toLowerCase().trim();
    }
    return true;
  });

  // Filter manifestations for map by mapSearchQuery (case insensitive on neighborhood name or protocolo)
  const mapFilteredManifestacoes = useMemo(() => {
    let items = manifestacoesParaUsuario;
    if (mapSearchQuery.trim()) {
      const q = mapSearchQuery.toLowerCase().trim();
      items = items.filter(m => 
        (m.bairro || "").toLowerCase().includes(q) || 
        (m.protocolo || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [manifestacoesParaUsuario, mapSearchQuery]);

  // Real-time status change detection and citizen toasts
  useEffect(() => {
    if (manifestacoes && manifestacoes.length > 0) {
      manifestacoes.forEach(m => {
        const prevStatus = lastManifestationsRef.current[m.protocolo];
        if (prevStatus && prevStatus !== m.status) {
          if (m.status === "Resolvido" || m.status === "Em Andamento") {
            const myProtocolsStr = localStorage.getItem("meus_protocolos") || "[]";
            let myProtocols: string[] = [];
            try {
              myProtocols = JSON.parse(myProtocolsStr);
            } catch (e) {}

            const isMine = 
              myProtocols.includes(m.protocolo) || 
              (user && user.nome && m.autor_nome === user.nome);

            if (isMine) {
              const toastId = `C_TOAST-${Date.now()}-${m.protocolo}`;
              setCitizenToasts(prev => [
                {
                  id: toastId,
                  titulo: m.tipo,
                  protocolo: m.protocolo,
                  status: m.status,
                  data: new Date().toLocaleTimeString()
                },
                ...prev
              ]);

              // Auto remove after 8 seconds
              setTimeout(() => {
                setCitizenToasts(prev => prev.filter(t => t.id !== toastId));
              }, 8000);
            }
          }
        }
        lastManifestationsRef.current[m.protocolo] = m.status;
      });
    }
  }, [manifestacoes, user]);

  // Dashboard calculations using the allowed/scoped manifestações
  const totalManifestacoes = manifestacoesParaUsuario.length;
  const pendentesCount = manifestacoesParaUsuario.filter(m => m.status === "Pendente" || m.status === "Urgente").length;
  const resolvidosCount = manifestacoesParaUsuario.filter(m => m.status === "Resolvido").length;
  const andamentoCount = manifestacoesParaUsuario.filter(m => m.status === "Em Andamento").length;

  const filteredAdmList = manifestacoesParaUsuario.filter(m => {
    return (!filtro.secretaria || m.secretaria === filtro.secretaria) &&
           (!filtro.status || m.status === filtro.status) &&
           (!filtro.prioridade || m.prioridade === filtro.prioridade) &&
           (!filtro.bairro || m.bairro === filtro.bairro);
  });

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-stone-900 flex flex-col font-sans antialiased pb-12">
      {/* Dynamic injection of the theme style rules */}
      <style>{`
        :root {
          --primary-color: ${headerColor};
          --primary-light: ${headerColor}1e;
          --primary-border: ${headerColor}33;
        }
        ::selection {
          background-color: ${headerColor} !important;
          color: #ffffff !important;
        }
        .text-\\[\\#1351B4\\] {
          color: ${headerColor} !important;
        }
        .bg-\\[\\#1351B4\\] {
          background-color: ${headerColor} !important;
        }
        .bg-\\[\\#1351B4\\]\\/5 {
          background-color: ${headerColor}0d !important;
        }
        .bg-\\[\\#1351B4\\]\\/10 {
          background-color: ${headerColor}1a !important;
        }
        .hover\\:bg-blue-700:hover, .hover\\:bg-blue-750:hover, .hover\\:bg-blue-800:hover {
          background-color: ${headerColor} !important;
          filter: brightness(0.88) !important;
        }
        .border-\\[\\#1351B4\\] {
          border-color: ${headerColor} !important;
        }
        .border-t-\\[\\#1351B4\\] {
          border-top-color: ${headerColor} !important;
        }
        .bg-blue-50, .bg-blue-50\\/70, .bg-blue-100 {
          background-color: ${headerColor}1e !important;
        }
        .border-blue-100 {
          border-color: ${headerColor}33 !important;
        }
        .selection\\:bg-\\[\\#1351B4\\]::selection {
          background-color: ${headerColor} !important;
          color: #ffffff !important;
        }
        .text-blue-600 {
          color: ${headerColor} !important;
        }
        .text-indigo-600 {
          color: ${headerColor} !important;
        }
        .text-blue-750 {
          color: ${headerColor} !important;
        }
        .bg-blue-750 {
          background-color: ${headerColor} !important;
          filter: brightness(0.9) !important;
        }
        .focus\\:ring-blue-600:focus {
          --tw-ring-color: ${headerColor} !important;
        }
      `}</style>

      {/* Dynamic Header Component */}
      <Header 
        municipio={municipio}
        setMunicipio={setMunicipio}
        headerColor={headerColor}
        setHeaderColor={setHeaderColor}
        logoText={logoText}
        setLogoText={setLogoText}
        programName={programName}
        setProgramName={setProgramName}
        view={view}
        setView={setView}
        user={user}
        onLogout={handleLogout}
        logoImageUrl={logoImageUrl}
        setLogoImageUrl={setLogoImageUrl}
      />

      {/* Main Body Layout container styled with positive margin & responsive grids */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6">
        
        {/* ESPAÇO DE PROPAGANDAS E CAMPANHAS OFICIAIS (Inserido pelo Admin - Escolha de Tela Individual) - Compacto e Elegante */}
        {(() => {
          const activeAds = propagandas.filter(ad => {
            if (!ad.ativa) return false;
            // Admin selects individually where to place the ad
            let matchesScreen = false;
            if (!ad.telaDestino || ad.telaDestino === "todas") {
              matchesScreen = true;
            } else if (view === "cidadao" && ad.telaDestino === "inicio") {
              matchesScreen = true;
            } else if (view === "abrir" && ad.telaDestino === "abrir") {
              matchesScreen = true;
            } else if (view === "consultar" && ad.telaDestino === "consultar") {
              matchesScreen = true;
            } else if (view === "dashboard" && ad.telaDestino === "admin") {
              matchesScreen = true;
            }

            if (!matchesScreen) return false;

            // Filter by position (defaults to "ambas" if unspecified)
            const pos = ad.posicao || "ambas";
            return pos === "superior" || pos === "ambas";
          });
          if (activeAds.length === 0) return null;
          const adsToShow = activeAds.slice(0, 5);
          const currentAd = adsToShow[activeAdIndex % adsToShow.length];
          return (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 overflow-hidden rounded-xl bg-gradient-to-r from-amber-50/90 to-orange-50/90 border border-amber-200 p-2.5 md:py-2.5 md:px-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between"
            >
              <div className="flex gap-3 items-center w-full sm:w-auto">
                <div className="relative w-11 h-11 md:w-12 md:h-12 shrink-0 overflow-hidden rounded-lg border border-amber-200 shadow-2xs">
                  <img 
                    src={currentAd.imagem} 
                    alt="" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-0.5 left-0.5 bg-[#D4AF37] text-white font-mono text-[7px] font-black tracking-widest uppercase px-1 py-0.2 rounded shadow-2xs">
                    Ad
                  </div>
                </div>
                
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded-full">
                      📢 utilidade pública
                    </span>
                    <span className="text-[9px] text-stone-450 font-bold hidden xs:inline">• Patrocínio Legislativo</span>
                  </div>
                  <h4 className="font-display font-bold text-[#071D41] text-xs leading-tight">
                    {formatAdText(currentAd.titulo)}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end shrink-0 border-t border-amber-100 sm:border-t-0 pt-2 sm:pt-0">
                <div className="flex items-center bg-white/90 border border-amber-150 p-0.5 rounded-lg shadow-3xs">
                  <button
                    type="button"
                    onClick={() => setActiveAdIndex(prev => (prev - 1 + adsToShow.length) % adsToShow.length)}
                    className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-amber-900 border border-amber-100/30 hover:border-amber-200/50 bg-amber-50 hover:bg-amber-100/80 rounded-md transition-colors cursor-pointer"
                    title="Campanha Anterior"
                  >
                    ←
                  </button>
                  <span className="text-[9px] font-mono font-bold text-amber-900/80 px-1.5 min-w-[32px] text-center">
                    {(activeAdIndex % adsToShow.length) + 1}/{adsToShow.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveAdIndex(prev => (prev + 1) % adsToShow.length)}
                    className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-amber-900 border border-amber-100/30 hover:border-amber-200/50 bg-amber-50 hover:bg-amber-100/80 rounded-md transition-colors cursor-pointer"
                    title="Próxima Campanha"
                  >
                    →
                  </button>
                </div>

                <button
                  onClick={() => setSelectedAdForModal(currentAd)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-[10px] md:text-xs font-bold rounded-lg shadow-xs active:scale-95 transition-all text-center cursor-pointer uppercase tracking-tight"
                >
                  {formatAdText(currentAd.textoBotao || "Saiba Mais")}
                </button>
              </div>
            </motion.div>
          );
        })()}

        <AnimatePresence mode="wait">
          
          {/* VIEW: CITIZEN HUB */}
          {view === "cidadao" && (
            <HomeView setView={setView} headerColor={headerColor} municipio={municipio} />
          )}

          {/* VIEW: MANIFESTATION WIZARD */}
          {view === "abrir" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 max-w-2xl mx-auto"
            >
              <button 
                id="btn-back-cidadao"
                onClick={() => { setView("cidadao"); setStep(1); }} 
                className="mb-6 flex items-center gap-2 text-stone-500 hover:text-stone-800 text-sm font-bold bg-white px-4 py-2 rounded-xl border border-stone-200 cursor-pointer shadow-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar ao Início
              </button>

              <div id="form-manifestacao-wizard-card" className="bg-white rounded-2xl border border-stone-200/80 shadow-md p-6 md:p-8">
                {!user ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100 animate-pulse">
                      <Lock className="w-7 h-7 text-amber-500" />
                    </div>
                    <h3 id="blocked-wizard-title" className="font-display font-black text-xl text-[#071D41] mb-2">Identificação Requerida</h3>
                    <p id="blocked-wizard-desc" className="text-stone-500 text-xs md:text-sm max-w-sm mx-auto mb-6 leading-relaxed">
                      Sua segurança e privacidade são nossa prioridade. Para escolher, protocolar e enviar uma manifestação oficialmente, você precisa possuir uma conta de Cidadão ativa e estar conectado no sistema.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-xs mx-auto">
                      <button
                        id="btn-block-goto-login"
                        onClick={() => setView("login")}
                        className="flex-1 bg-[#1351B4] hover:bg-blue-700 text-white text-xs font-bold py-3.5 px-4 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <LogIn className="w-4 h-4 rotate-180" />
                        <span>Entrar / Login</span>
                      </button>
                      <button
                        id="btn-block-goto-cadastro"
                        onClick={() => setView("cadastro")}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3.5 px-4 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Criar Conta</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Wizard Stepper Banner */}
                    <div className="flex items-center gap-2 mb-8 justify-between border-b pb-4">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-blue-100 text-[#1351B4] rounded-lg text-lg">📝</span>
                        <h3 className="font-display font-black text-xl text-[#071D41]">Nova Manifestação</h3>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 font-bold">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono ${step >= 1 ? "bg-[#1351B4] text-white" : "bg-stone-100 text-stone-400"}`}>1</span>
                        <span>→</span>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono ${step >= 2 ? "bg-[#1351B4] text-white" : "bg-stone-100 text-stone-400"}`}>2</span>
                        <span>→</span>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono ${step >= 3 ? "bg-[#1351B4] text-white" : "bg-stone-100 text-stone-400"}`}>3</span>
                      </div>
                    </div>

                    {/* STEP 1: FILL FORM FIELDS */}
                    {step === 1 && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <label id="lbl-manifest-tipo" className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                        Tipo de Manifestação *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                        {["Reclamação", "Sugestão", "Elogio", "Denúncia"].map((t) => {
                          const isSelected = form.tipo === t;
                          return (
                            <button
                              id={`option-tipo-${t}`}
                              type="button"
                              key={t}
                              onClick={() => setForm(prev => ({ ...prev, tipo: t }))}
                              className={`py-2 px-1.5 rounded-lg text-[11px] xs:text-xs font-black transition-all cursor-pointer border text-center whitespace-nowrap block truncate ${
                                isSelected 
                                  ? "bg-[#1351B4] text-white border-[#1351B4] shadow-sm transform scale-[1.02]" 
                                  : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                              }`}
                            >
                              {t === "Reclamação" ? "👎 Reclamação" :
                               t === "Sugestão" ? "💡 Sugestão" :
                               t === "Elogio" ? "👏 Elogio" : "🚨 Denúncia"}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="input-descricao" className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                        Descrição do Relato *
                      </label>
                      <textarea
                        id="input-descricao"
                        rows={5}
                        placeholder="Insira detalhes completos como endereços próximos, referências ou nomes de ruas para que nossa Inteligência Artificial classifique sua demanda..."
                        value={form.descricao}
                        onChange={(e) => setForm(p => ({ ...p, descricao: e.target.value }))}
                        className="w-full text-sm px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none font-sans"
                      />
                      <p className="text-[10px] text-stone-400/90 font-medium mt-1">
                        Dica: Digite palavras como "buraco", "asfalto", "vazamento", "limpeza" ou "poste" para o motor IA auxiliar perfeitamente.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="select-bairro" className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                        Bairro do Ocorrido
                      </label>
                      <select
                        id="select-bairro"
                        value={form.bairro}
                        onChange={(e) => setForm(p => ({ ...p, bairro: e.target.value }))}
                        className="w-full text-xs px-4 py-3 border border-stone-200 rounded-xl outline-none bg-white font-semibold cursor-pointer"
                      >
                        <option value="">Selecione o Bairro (Opcional)</option>
                        {BAIRROS_PADRAO.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* Multimedia Attachment controls */}
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📸</span>
                        <span className="text-xs font-bold text-stone-700">Evidências Digitais (Opcional)</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-600 select-none">
                          <input 
                            id="check-foto"
                            type="checkbox"
                            checked={form.foto}
                            onChange={(e) => setForm(p => ({ ...p, foto: e.target.checked }))}
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                          Anexar Foto de Evidência
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-600 select-none">
                          <input 
                            id="check-loc"
                            type="checkbox"
                            checked={form.localizacao}
                            onChange={(e) => setForm(p => ({ ...p, localizacao: e.target.checked }))}
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                          Compartilhar Localização exata por GPS
                        </label>
                      </div>
                      {form.localizacao && (
                        <p className="text-[10.5px] text-[#1351B4] bg-blue-50/70 py-1.5 px-2.5 rounded-md border border-blue-100 font-medium leading-relaxed">
                          📌 Georreferenciamento ativado. O sistema capturará as coordenadas correspondentes ao relato para auxiliar as equipes técnicas.
                        </p>
                      )}
                    </div>

                    {/* LGPD Safety consent terms block */}
                    <div className="bg-[#E8F5E9] border border-[#A5D6A7] rounded-xl p-4">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          id="check-consentimento"
                          type="checkbox"
                          checked={form.consentimento}
                          onChange={(e) => setForm(p => ({ ...p, consentimento: e.target.checked }))}
                          className="w-4 h-4 text-emerald-700 rounded mt-1 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-emerald-900 mb-0.5">Consentimento LGPD</h4>
                          <p className="text-[10.5px] text-emerald-800 leading-relaxed font-sans">
                            Autorizo o tratamento dos meus dados pessoais fornecidos nesta manifestação para a Ouvidoria Municipal e a Secretaria de Planejamento, conforme a <strong>Lei nº 13.709/2018</strong>. Meus registros residirão em banco seguro para fins exclusivos de atendimento.
                          </p>
                        </div>
                      </label>
                    </div>

                    <button
                      id="btn-confirm-step1"
                      disabled={!form.descricao || !form.consentimento || isClassifying}
                      onClick={handleAnalyzeDescription}
                      className="w-full bg-[#1351B4] hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-extrabold py-3.5 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isClassifying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Analisando Relato com IA da Ouvidoria...
                        </>
                      ) : (
                        <>
                          Analisar Manifestação com IA →
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* STEP 2: SHOW IA CATEGORIZATION CONFIRMATION */}
                {step === 2 && iaResponse && (
                  <div className="flex flex-col gap-6">
                    <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-xl p-4 flex gap-3 text-stone-800 items-start">
                      <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">Classificação Inteligente</h4>
                        <p className="text-xs leading-relaxed text-amber-850 font-medium">
                          Nossa Inteligência Artificial mapeou as palavras do seu relato e autocompletou o direcionamento administrativo. Por favor, confirme as informações do chamado:
                        </p>
                      </div>
                    </div>

                    {user?.ocupacao === "Vereador" && (
                      <div id="alerta-diferenciado-wizard-vereador" className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/5 border-l-4 border-l-amber-500 rounded-r-xl p-4 flex gap-3 text-amber-950 items-start shadow-xs animate-shake">
                        <span className="text-2xl shrink-0">🏛️</span>
                        <div>
                          <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider leading-none mb-1.5 flex items-center gap-1">
                            <span>🚨 ALERTA DIFERENCIADO ATIVO:</span> CANAL PARLAMENTAR PRIORIZADO
                          </h4>
                          <p className="text-[10.5px] leading-relaxed text-amber-950 font-bold">
                            Identificamos sua conta como membro do parlamento legislativo (Vereador). Por prerrogativa, seu chamado possui <strong>Prioridade Máxima de Tramitação Urgente</strong> na Ouvidoria Municipal de {municipio}.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
                        <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Categoria Estimada</span>
                        <span className="font-display font-extrabold text-sm text-[#071D41] block mt-1">{iaResponse.categoria}</span>
                      </div>
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
                        <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Secretaria Competente</span>
                        <span className="font-display font-extrabold text-sm text-[#071D41] block mt-1">{iaResponse.secretaria}</span>
                      </div>
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
                        <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Nível de Prioridade</span>
                        <span className={`font-display font-extrabold text-xs inline-block px-2.5 py-1 rounded-full mt-1 ${
                          user?.ocupacao === "Vereador" || iaResponse.prioridade === "Alta" || iaResponse.prioridade === "Urgente" 
                            ? "bg-red-100 text-red-800 border-2 border-red-300 font-black animate-pulse" 
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {user?.ocupacao === "Vereador" ? "Alta (Prioridade Parlamentar Máxima)" : iaResponse.prioridade}
                        </span>
                      </div>
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
                        <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Tipo de Envio</span>
                        <span className="font-display font-extrabold text-sm text-[#071D41] block mt-1">{form.tipo}</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-tr from-blue-50/60 to-indigo-50 border border-blue-200/80 rounded-xl p-5">
                      <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                        <FileCheck className="w-4 h-4 text-[#1351B4]" /> Resposta Inicial Pré-Autorizada pela IA:
                      </h4>
                      <p className="text-xs md:text-sm text-[#071D41] leading-relaxed italic bg-white p-3.5 rounded-lg border border-blue-100/70 font-sans shadow-xs">
                        "{user?.ocupacao === "Vereador" 
                          ? "🚨 [Prioridade Parlamentar] Esta manifestação foi enviada por um membro da Câmara de Vereadores. Triagem de atendimento prioritária em regime de urgência regimental municipal ativada." 
                          : iaResponse.resposta}"
                      </p>
                      <div className="text-[9.5px] text-blue-700 font-bold mt-2 flex items-center gap-1">
                        <span>🤖 Classificador:</span>
                        <span>{user?.ocupacao === "Vereador" ? "Triador Regimental de Prerrogativa Pública" : (iaResponse.is_ai ? "Gemini 3.5 Flash Engine Ativo" : "Express Rule-Based Fallback Engine")}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end border-t pt-4">
                      <button
                        id="btn-edit-wizard"
                        onClick={() => setStep(1)}
                        className="py-2.5 px-4 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 transition-all border border-stone-300 shadow-xs cursor-pointer text-stone-700"
                      >
                        ← Editar Relato
                      </button>
                      <button
                        id="btn-confirm-wizard"
                        onClick={handleConfirmAndPublish}
                        className="py-2.5 px-6 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:scale-101 active:scale-99 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        Confirmar e Registrar Chamado ✓
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: CREATED PROTOCOL DISPLAY */}
                {step === 3 && createdProtocol && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="font-display font-black text-2xl text-emerald-800 mb-2">Manifestação Registrada!</h3>
                    <p className="text-stone-600 text-sm max-w-sm mx-auto mb-6">
                      Seu chamado já está disponível para consulta com as secretarias. Por favor salve este código identificador:
                    </p>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 max-w-sm mx-auto mb-6 shadow-inner">
                      <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest block mb-1">CÓDIGO DE PROTOCOLO</span>
                      <strong className="font-mono text-3xl md:text-4xl text-[#1351B4] tracking-wider block select-all select-text">
                        #{createdProtocol}
                      </strong>
                    </div>

                    <div className="flex gap-3 justify-center">
                      <button
                        id="btn-track-now"
                        onClick={() => { setView("consultar"); setSearchProtocol(createdProtocol); handleSearchProtocol(); }}
                        className="py-3 px-5 text-xs font-extrabold bg-[#1351B4] hover:bg-blue-700 text-white rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        Acompanhar Chamado
                      </button>
                      <button
                        id="btn-create-another"
                        onClick={() => {
                          setStep(1);
                          setForm({
                            tipo: "Reclamação",
                            descricao: "",
                            bairro: "",
                            foto: false,
                            localizacao: false,
                            consentimento: false,
                          });
                        }}
                        className="py-3 px-5 text-xs font-bold border border-stone-200 hover:bg-stone-50 rounded-xl transition-all cursor-pointer text-stone-700"
                      >
                        Nova Ouvidoria
                      </button>
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: CONSULT PROTOCOL */}
          {view === "consultar" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 max-w-2xl mx-auto"
            >
              <button 
                id="btn-back-track"
                onClick={() => setView("cidadao")} 
                className="mb-6 flex items-center gap-2 text-stone-500 hover:text-stone-800 text-sm font-bold bg-white px-4 py-2 rounded-xl border border-stone-200 cursor-pointer shadow-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar ao Início
              </button>

              <div className="bg-white rounded-2xl p-6 md:p-8 border border-stone-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                  <span className="text-xl">🔍</span>
                  <h3 className="font-display font-black text-xl text-[#071D41]">Acompanhar Manifestação</h3>
                </div>

                <div className="flex gap-2.5 mb-6">
                  <input
                    id="search-input-protocolo"
                    placeholder="Digite o número de protocolo (Ex: 2024001, 2024002...)"
                    value={searchProtocol}
                    onChange={(e) => setSearchProtocol(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchProtocol()}
                    className="flex-1 text-sm bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    id="search-btn-action"
                    onClick={handleSearchProtocol}
                    className="bg-[#1351B4] hover:bg-blue-700 text-white font-bold text-xs py-3 px-5 rounded-xl block transition-all active:scale-98 cursor-pointer shadow-md"
                  >
                    Buscar
                  </button>
                </div>

                {searchError && (
                  <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl text-xs font-medium flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {searchError}
                  </div>
                )}

                {searchResult ? (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="border-t pt-5"
                  >
                    <div className="bg-[#E7F5E8] border border-[#A8D5AB] text-emerald-950 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 mb-5">
                      <Check className="w-4 h-4 text-emerald-600" /> Registro de ouvidoria encontrado com sucesso!
                    </div>

                    <div className="flex-col flex gap-2.5">
                      <div className="flex justify-between items-center py-2.5 border-b border-stone-100">
                        <span className="text-xs font-bold text-stone-500">NÚMERO DE PROTOCOLO</span>
                        <span className="font-mono font-black text-sm text-[#071D41]">#{searchResult.protocolo}</span>
                      </div>

                      <div className="flex justify-between items-center py-2.5 border-b border-stone-100">
                        <span className="text-xs font-bold text-stone-500">TIPO DE CHAMADO</span>
                        <span className="font-display font-extrabold text-xs text-stone-700 bg-stone-100 px-2.5 py-1 rounded-full">
                          {searchResult.tipo}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2.5 border-b border-stone-100">
                        <span className="text-xs font-bold text-stone-500">CATEGORIA TEMÁTICA</span>
                        <span className="font-display font-extrabold text-xs text-[#1351B4] bg-blue-50 px-2.5 py-1 rounded-full">
                          {searchResult.ia_categoria}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2.5 border-b border-stone-100">
                        <span className="text-xs font-bold text-stone-500">SECRETARIA ATRIBUÍDA</span>
                        <span className="font-display font-black text-xs text-stone-800">{searchResult.secretaria}</span>
                      </div>

                      <div className="flex justify-between items-center py-2.5 border-b border-stone-100">
                        <span className="text-xs font-bold text-stone-500">LOCALIDADES (BAIRRO)</span>
                        <span className="font-display font-bold text-xs text-stone-700">{searchResult.bairro}</span>
                      </div>

                      <div className="flex justify-between items-center py-2.5 border-b border-stone-100">
                        <span className="text-xs font-bold text-stone-500">DATA DE ABERTURA</span>
                        <span className="font-mono text-xs text-stone-600">{searchResult.data}</span>
                      </div>

                      <div className="flex justify-between items-center py-2.5 border-b border-stone-100">
                        <span className="text-xs font-bold text-stone-500">STATUS DA DEMANDA</span>
                        <span className={`font-display font-black text-xs px-2.5 py-1 rounded-full ${
                          searchResult.status === "Resolvido" ? "bg-emerald-100 text-emerald-800" :
                          searchResult.status === "Em Andamento" ? "bg-blue-100 text-blue-800" :
                          searchResult.status === "Urgente" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>{searchResult.status}</span>
                      </div>

                      <div className="flex justify-between items-center py-2.5 border-b border-stone-100">
                        <span className="text-xs font-bold text-stone-500">GRAVIDADE / PRIORIDADE</span>
                        <span className={`font-display font-black text-xs px-2.5 py-1 rounded-full ${
                          searchResult.prioridade === "Alta" || searchResult.prioridade === "Urgente" 
                            ? "bg-red-100/80 text-red-800 border border-red-200" 
                            : "bg-stone-100 text-stone-700"
                        }`}>{searchResult.prioridade}</span>
                      </div>
                    </div>

                    <div className="mt-5 bg-stone-50 border rounded-xl p-4">
                      <span className="text-[10px] font-black text-stone-500 block mb-1">DETALHAMENTO DO CIDADÃO:</span>
                      <p className="text-xs text-stone-800 leading-relaxed font-sans">{searchResult.descricao}</p>
                    </div>

                    {searchResult.resposta_ia && (
                      <div className="mt-4 bg-blue-50/50 border border-blue-200/60 rounded-xl p-4">
                        <span className="text-[10px] font-black text-[#1351B4] block mb-1 flex items-center gap-1">
                          🤖 Resposta de Ouvidoria Integrada:
                        </span>
                        <p className="text-xs text-blue-950 leading-relaxed font-sans italic">
                          "{searchResult.resposta_ia}"
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="mt-10 text-center py-8 bg-stone-50/50 rounded-2xl border-2 border-dashed border-stone-200">
                    <span className="text-3xl block mb-2">📋</span>
                    <h4 className="text-sm font-bold text-stone-600 mb-1">Nenhum chamado buscado</h4>
                    <p className="text-stone-400 text-xs">Insira o código do protocolo acima para puxar os dados oficiais.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: CADASTRO CITIZEN */}
          {view === "cadastro" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 max-w-sm mx-auto"
            >
              <div className="bg-white rounded-2xl p-6 md:p-8 border border-stone-200/85 shadow-md">
                {cadastroSucesso ? (
                  <div className="text-center py-4">
                    <span className="text-4xl block mb-2">🎉</span>
                    <h3 className="font-display font-black text-xl text-emerald-800 mb-2">Cadastro concluído!</h3>
                    <p className="text-stone-600 text-xs mb-6 leading-relaxed">
                      Sua conta já está ativada de forma segura na prefeitura. Você pode fazer o login imediatamente.
                    </p>
                    <button
                      id="btn-success-goto-login"
                      onClick={() => { setCadastroSucesso(false); setView("login"); }}
                      className="w-full bg-[#1351B4] hover:bg-blue-700 text-white text-xs font-bold py-3.5 px-4 rounded-xl transition-all cursor-pointer"
                    >
                      Ir para Tela de Login
                    </button>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-display font-black text-xl text-[#071D41] mb-2">Criar Nova Conta</h3>
                    <p className="text-stone-500 text-xs mb-6">Cadastre-se de forma simples para controlar seus chamados com segurança jurídica.</p>

                    <div className="flex flex-col gap-4">
                      <div>
                        <label htmlFor="reg-nome" className="block text-xs font-bold text-stone-600 mb-1">Nome Completo *</label>
                        <input
                          id="reg-nome"
                          value={cadastroForm.nome}
                          onChange={(e) => setCadastroForm(p => ({ ...p, nome: e.target.value }))}
                          className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="reg-email" className="block text-xs font-bold text-stone-600 mb-1">E-mail de Contato *</label>
                        <input
                          id="reg-email"
                          type="email"
                          value={cadastroForm.email}
                          onChange={(e) => setCadastroForm(p => ({ ...p, email: e.target.value }))}
                          className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="reg-tel" className="block text-xs font-bold text-stone-600 mb-1">Telefone (DDD) *</label>
                          <input
                            id="reg-tel"
                            value={cadastroForm.telefone}
                            onChange={(e) => setCadastroForm(p => ({ ...p, telefone: e.target.value }))}
                            className="w-full text-xs px-3 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="reg-cpf" className="block text-xs font-bold text-stone-600 mb-1">CPF (Opcional)</label>
                          <input
                            id="reg-cpf"
                            value={cadastroForm.cpf}
                            onChange={(e) => setCadastroForm(p => ({ ...p, cpf: e.target.value }))}
                            className="w-full text-xs px-3 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="reg-end" className="block text-xs font-bold text-stone-600 mb-1">Endereço Residencial *</label>
                        <input
                          id="reg-end"
                          value={cadastroForm.endereco}
                          onChange={(e) => setCadastroForm(p => ({ ...p, endereco: e.target.value }))}
                          className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="reg-ocupacao" className="block text-xs font-bold text-stone-600 mb-1">Ocupação / Cargo *</label>
                        <select
                          id="reg-ocupacao"
                          value={cadastroForm.ocupacao}
                          onChange={(e) => setCadastroForm(p => ({ ...p, ocupacao: e.target.value }))}
                          className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none bg-white cursor-pointer font-medium text-stone-800"
                        >
                          <option value="Cidadão">Cidadão / Outro</option>
                          <option value="Vereador">Vereador(a) 🏛️</option>
                          <option value="Comerciante">Comerciante</option>
                          <option value="Servidor Público">Servidor Público</option>
                          <option value="Líder Comunitário">Líder Comunitário</option>
                        </select>
                        {cadastroForm.ocupacao === "Vereador" && (
                          <div id="alerta-parlamentar-cadastro" className="mt-2 p-2.5 bg-amber-50 border border-amber-250 rounded-lg text-[10.5px] text-amber-950 font-semibold leading-relaxed">
                            🏛️ <strong>Acesso Parlamentar Ativado:</strong> As manifestações abertas por esta conta serão encaminhadas em regime de urgência prioritária para a Ouvidoria Municipal.
                          </div>
                        )}
                      </div>

                      <div>
                        <label htmlFor="reg-senha" className="block text-xs font-bold text-stone-600 mb-1">Senha Secreta *</label>
                        <input
                          id="reg-senha"
                          type="password"
                          value={cadastroForm.senha}
                          onChange={(e) => setCadastroForm(p => ({ ...p, senha: e.target.value }))}
                          className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                      </div>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none py-1">
                        <input
                          id="reg-check-lgpd"
                          type="checkbox"
                          checked={cadastroForm.consentimento}
                          onChange={(e) => setCadastroForm(p => ({ ...p, consentimento: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 rounded mt-0.5"
                        />
                        <span className="text-[10.5px] text-stone-500 leading-relaxed">
                          Aceito termos de coleta de dados primários da prefeitura para a triagem. Em conformidade absoluta com a LGPD federal.
                        </span>
                      </label>

                      <button
                        id="btn-trigger-register"
                        onClick={handleUserRegister}
                        className="w-full bg-[#1351B4] hover:bg-blue-700 text-white text-xs font-bold py-3.5 px-4 rounded-xl mt-2 transition-all cursor-pointer"
                      >
                        Cadastrar Conta
                      </button>

                      <button
                        id="btn-register-back-login"
                        onClick={() => setView("login")}
                        className="w-full bg-white text-stone-600 hover:text-stone-850 text-xs font-semibold py-2.5 px-4 outline-none transition-colors border rounded-xl"
                      >
                        Já possuo conta — Fazer Login
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: CITIZEN MEMBER LOGIN & ADMIN FALLBACK */}
          {(view === "login" || view === "admin") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 max-w-sm mx-auto"
            >
              <div className="bg-white rounded-2xl p-6 md:p-8 border border-stone-200/85 shadow-md">
                {isForgotPass ? (
                  <div>
                    <h3 className="font-display font-black text-xl text-[#071D41] mb-1.5">Esqueci minha senha</h3>
                    <p className="text-stone-500 text-xs mb-5">Insira o e-mail cadastrado e enviaremos um código de recuperação.</p>

                    <div className="flex flex-col gap-3">
                      <div>
                        <label htmlFor="reg-recovery-email" className="block text-xs font-bold text-stone-600 mb-1">E-mail Cadastrado</label>
                        <input
                          id="reg-recovery-email"
                          placeholder="seuemail@exemplo.com"
                          className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                      </div>
                      <button
                        id="btn-send-recovery"
                        onClick={() => { alert("Se o e-mail digitado estiver em nosso cadastro principal, você receberá instruções de redefinição de senha em alguns minutos."); setIsForgotPass(false); }}
                        className="w-full bg-[#1351B4] hover:bg-blue-700 text-white text-xs font-bold py-3 px-4 rounded-xl mt-3 transition-all cursor-pointer"
                      >
                        Enviar Código de Redefinição
                      </button>
                      <button
                        id="btn-cancel-recovery"
                        onClick={() => setIsForgotPass(false)}
                        className="w-full bg-white text-stone-500 hover:text-stone-700 font-semibold text-xs py-2"
                      >
                        Voltar ao Login
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-display font-black text-xl text-[#071D41] mb-1.5">
                      {view === "admin" ? "Faça o login" : "Acesso à Ouvidoria"}
                    </h3>
                    <p className="text-stone-500 text-xs mb-5">
                      {view === "admin" 
                        ? "Utilize as credenciais de teste para visualizar os painéis administrativos superiores." 
                        : "Acompanhe e reabra chamados diretamente pelo seu painel."}
                    </p>

                    {loginErro && (
                      <div className="bg-red-50 text-red-700 border border-red-200 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 mb-4 animate-shake">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {loginErro}
                      </div>
                    )}

                    <div className="flex flex-col gap-4">
                      <div>
                        <label htmlFor="log-email" className="block text-xs font-bold text-stone-600 mb-1">E-mail Cadastrado</label>
                        <input
                          id="log-email"
                          placeholder="Ex: admin@municipio.gov.br"
                          value={loginForm.login}
                          onChange={(e) => setLoginForm(p => ({ ...p, login: e.target.value }))}
                          className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="log-pass" className="block text-xs font-bold text-stone-600 mb-1">Senha Secreta</label>
                        <input
                          id="log-pass"
                          type="password"
                          placeholder="Ex: admin123"
                          value={loginForm.senha}
                          onChange={(e) => setLoginForm(p => ({ ...p, senha: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && handleLoginSubmit()}
                          className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                      </div>

                      <div className="flex justify-between items-center py-1">
                        <button
                          id="btn-forgot-pwd"
                          type="button"
                          onClick={() => setIsForgotPass(true)}
                          className="text-[#1351B4] hover:underline font-bold text-[11px] cursor-pointer"
                        >
                          Esqueceu a senha?
                        </button>
                      </div>

                      <button
                        id="btn-login-submit"
                        onClick={handleLoginSubmit}
                        className="w-full bg-[#1351B4] hover:bg-blue-700 text-white text-xs font-bold py-3 px-4 rounded-xl transition-all cursor-pointer shadow-md"
                      >
                        Entrar no Sistema
                      </button>

                      <div className="relative my-1">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-stone-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-stone-400 font-bold text-[9px]">ou alternativemente</span>
                        </div>
                      </div>

                      <button
                        id="btn-login-google"
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="w-full bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-xs shadow-xs"
                      >
                        <Lock className="w-4 h-4 text-emerald-600" />
                        Acessar com o Google (Firebase)
                      </button>

                      <div className="text-center py-2.5 px-3 bg-stone-50 border border-stone-150 rounded-xl text-[11px] text-stone-500 font-semibold leading-relaxed">
                        🔐 O cadastro de novos servidores ou usuários é gerenciado de forma centralizada. Solicite suas credenciais diretamente ao Administrador Geral do Município.
                      </div>
                    </div>

                    <div className="mt-5 p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-stone-600 leading-relaxed shadow-sm">
                      💡 <strong>Ambiente de Demonstração Técnico:</strong><br />
                      • <strong>Administrador Geral:</strong> <span className="font-mono text-[#071D41]">admin@municipio.gov.br</span> (senha: <span className="font-mono text-[#071D41]">admin123</span>)<br />
                      • <strong>Prefeito do Município:</strong> <span className="font-mono text-[#071D41]">prefeito@municipio.gov.br</span> (senha: <span className="font-mono text-[#071D41]">prefeito123</span>)<br />
                      • <strong>Secretário de Infraestrutura (Lins):</strong> <span className="font-mono text-[#071D41]">lins@municipio.gov.br</span> (senha: <span className="font-mono text-[#071D41]">lins123</span>)<br />
                      • <strong>Procurador do Município:</strong> <span className="font-mono text-[#071D41]">arthur.viana@procuradoria.gov.br</span> (qualquer senha)<br />
                      • <strong>Servidor Público (Vê apenas Infraestrutura):</strong> <span className="font-mono text-[#071D41]">joao@municipio.gov.br</span> (qualquer senha)<br />
                      <span className="text-stone-500">• <em>Dica: Crie novas secretarias e servidores nas abas administrativas para testar o direcionamento inteligente e a restrição de visualização!</em></span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: ADMINISTRATIVE DASHBOARD */}
          {view === "dashboard" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8"
            >
              {/* Top Banner stats and tab navigations */}
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-2xl p-4 md:p-6 border border-stone-200 shadow-xs">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4 mb-5">
                    <div>
                      <h2 className="font-display font-extrabold text-[#071D41] text-xl md:text-2xl tracking-tight">
                        🏛️ Ouvidoria Inteligente do Município
                      </h2>
                      <p className="text-stone-500 text-xs md:text-sm">Controle de Ouvidoria, Métricas Gerais e Configurações de IA</p>
                    </div>
                    {/* Secondary system operations */}
                    <div className="flex gap-2 self-stretch md:self-auto flex-wrap md:flex-nowrap">
                      {(user?.perfil === "admin" || user?.perfil === "prefeito" || user?.permissoes?.alterarCores) && (
                        <button
                          onClick={() => setDashboardTab("configuracoes")}
                          className="flex-1 md:flex-initial py-2 px-3 text-xs font-black text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center justify-center gap-1 border border-amber-200 transition-all cursor-pointer text-center"
                          title="Alterar Cores Padrões, Nomes e Logotipo do Sistema"
                        >
                          ⚙️ Configurações (Cores)
                        </button>
                      )}
                      {(user?.perfil === "admin" || user?.perfil === "prefeito" || user?.permissoes?.gerenciarPublicidade) && (
                        <button
                          onClick={() => setDashboardTab("propaganda")}
                          className="flex-1 md:flex-initial py-2 px-3 text-xs font-black text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1 border border-blue-200 transition-all cursor-pointer text-center"
                          title="Gerenciar e Direcionar Publicidade Individualmente por Tela"
                        >
                          📢 Publicidade (Telas)
                        </button>
                      )}
                      <button
                        id="btn-csv-export"
                        onClick={() => { alert("Exportando dados consolidados de ouvidoria para formato CSV..."); }}
                        className="flex-1 md:flex-initial py-2 px-3 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 border border-stone-300 transition-all cursor-pointer text-center justify-center"
                      >
                        <Download className="w-3.5 h-3.5" /> Exportar Planilha
                      </button>
                    </div>
                  </div>

                  {/* Tabs navigators */}
                  <div className="flex border-b border-stone-200 gap-1 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
                    {[
                      { key: "painel", label: "📊 Painel Geral" },
                      { key: "chamados", label: "📋 Chamados" },
                      { key: "mapa", label: "🗺️ Mapa Bairros" },
                      ...(isAuthorizedForAgentesEFuncoes(user) ? [
                        { key: "usuarios", label: "👥 Servidores / Usuários" }
                      ] : []),
                      ...(isAuthorizedForAgentesEFuncoes(user) ? [
                        { key: "secretarias", label: "🏢 Secretarias" }
                      ] : []),
                      ...((user?.perfil === "admin" || user?.perfil === "prefeito" || user?.permissoes?.gerenciarPublicidade) ? [
                        { key: "propaganda", label: "📢 Publicidade" }
                      ] : []),
                      ...((user?.perfil === "admin" || user?.perfil === "prefeito" || user?.permissoes?.visualizarRelatorios) ? [
                        { key: "relatorios", label: "📈 Relatórios" }
                      ] : []),
                      { key: "notificacoes", label: "✉️ Notificações (E-mails)" },
                      ...((user?.perfil === "admin" || user?.perfil === "prefeito" || user?.permissoes?.alterarCores) ? [
                        { key: "configuracoes", label: "⚙️ Configurações (Cores)" }
                      ] : [])
                    ].map((tab) => {
                      const isActive = dashboardTab === tab.key;
                      return (
                        <button
                          id={`dash-tab-${tab.key}`}
                          key={tab.key}
                          onClick={() => setDashboardTab(tab.key)}
                          className={`py-2 px-3 md:px-4 text-[11px] md:text-xs font-extrabold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                            isActive 
                              ? "border-[#1351B4] text-[#1351B4] bg-[#1351B4]/5 rounded-t-lg font-black" 
                              : "border-transparent text-stone-500 hover:text-stone-800"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TAB CONTENT: PANELS AND CARDS */}
                {dashboardTab === "painel" && (
                  <div className="flex flex-col gap-6">
                    {/* Exclusive Cabinet Folder Notice for Secretary */}
                    {user && user.perfil === "Secretaria" && (
                      <div className="bg-gradient-to-r from-blue-950 to-[#071D41] text-white rounded-2xl p-5 md:p-6 shadow-md border border-blue-800 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <span className="text-3xl p-2.5 bg-white/10 rounded-xl leading-none">📁</span>
                            <div>
                              <h4 className="font-display font-black text-sm md:text-base tracking-tight text-[#FFCD07]">
                                PORTAL DE FLUXO EXCLUSIVO: PASTA DE {user.secretaria?.toUpperCase()}
                              </h4>
                              <p className="text-stone-300 text-[11px] md:text-xs leading-relaxed mt-1">
                                Sua visão operacional está restrita à pasta de competência de <strong>{user.secretaria}</strong>. Todas as métricas, chamados e diligências deste terminal referem-se estritamente à sua área. Você possui competência delegada para tramitar processos, designar encarregados e encaminhar pareceres para assessores, diretores, coordenadores, outros secretários, procuradores ou prefeito.
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-row md:flex-col gap-2 items-start md:items-end">
                            <span className="text-[9.5px] inline-flex items-center gap-1 bg-[#1351B4] text-white font-mono uppercase font-black px-2.5 py-1 rounded-lg border border-blue-400 shadow-sm">
                              ● STATUS: SECRETÁRIO ATIVO
                            </span>
                            <span className="text-[10.5px] text-stone-300 font-semibold block uppercase tracking-wider">
                              Autonomia de Despacho
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Numerical summary block */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
                      <div className="bg-[#1351B4] rounded-2xl p-3.5 xs:p-5 text-white shadow-xs">
                        <span className="text-2xl xs:text-3xl font-black block leading-none mb-1.5">{totalManifestacoes}</span>
                        <span className="text-[9px] xs:text-[10px] text-white/70 font-semibold uppercase tracking-wider block">Total Geral</span>
                      </div>
                      <div className="bg-[#FF9100] rounded-2xl p-3.5 xs:p-5 text-white shadow-xs">
                        <span className="text-2xl xs:text-3xl font-black block leading-none mb-1.5">{pendentesCount}</span>
                        <span className="text-[9px] xs:text-[10px] text-white/70 font-semibold uppercase tracking-wider block">Pendente Triagem</span>
                      </div>
                      <div className="bg-[#2670E8] rounded-2xl p-3.5 xs:p-5 text-white shadow-xs">
                        <span className="text-2xl xs:text-3xl font-black block leading-none mb-1.5">{andamentoCount}</span>
                        <span className="text-[9px] xs:text-[10px] text-white/70 font-semibold uppercase tracking-wider block">Em Resolução</span>
                      </div>
                      <div className="bg-[#168821] rounded-2xl p-3.5 xs:p-5 text-white shadow-xs">
                        <span className="text-2xl xs:text-3xl font-black block leading-none mb-1.5">{resolvidosCount}</span>
                        <span className="text-[9px] xs:text-[10px] text-white/70 font-semibold uppercase tracking-wider block">Casos Resolvidos</span>
                      </div>
                    </div>

                    {/* CARD DIRECIONADO: SEGURANÇA E REGISTRO DE E-MAIL ALTERNATIVO PARA DESPACHOS */}
                    {user && (
                      <div className="bg-white rounded-2xl p-5 md:p-6 border border-stone-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-5 animate-fade-in bg-gradient-to-br from-white to-stone-50">
                        <div className="flex items-start gap-4 flex-1">
                          <span className="text-3xl p-3 bg-[#1351B4]/10 rounded-2xl text-[#1351B4] leading-none shrink-0 font-bold">✉️</span>
                          <div>
                            <h4 className="font-display font-extrabold text-[#071D41] text-base mb-1">
                              Seu E-mail Alternativo de Notificação (Recebimento de Despachos & Prova Técnica)
                            </h4>
                            <p className="text-stone-500 text-xs leading-relaxed max-w-2xl">
                              Conforme a regulamentação do sistema de transparência, todos os servidores e agentes públicos cadastram um e-mail alternativo. Nele, você receberá alertas formais sobre novos despachos/atribuições além das notificações do painel do aplicativo. 
                              Adicionalmente, <span className="font-bold text-[#1351B4]">todo despacho oficial ou delegação que você enviar para outro servidor enviará um comprovante técnico para o seu e-mail alternativo</span>, servindo como prova jurídica automática da respectiva transferência de atribuições de posturas.
                            </p>
                          </div>
                        </div>

                        {/* Interactive Edit Action inside Panel */}
                        <div className="shrink-0 w-full lg:w-auto bg-stone-100 p-3.5 rounded-xl border border-stone-200 flex flex-col gap-2">
                          <label htmlFor="agent-alt-email" className="text-[9px] font-black text-stone-500 uppercase tracking-widest block font-bold">E-mail Alternativo Cadastrado</label>
                          {(() => {
                            const matchingProfile = usuarios.find(u => u.email.toLowerCase() === user.email.toLowerCase());
                            const currentAltVal = matchingProfile?.email_alternativo || "";
                            return (
                              <div className="flex flex-col gap-2">
                                <input
                                  id="agent-alt-email"
                                  type="email"
                                  placeholder="seu.pessoal@servidor.com"
                                  defaultValue={currentAltVal}
                                  onBlur={(e) => {
                                    const emailVal = e.target.value.trim();
                                    if (matchingProfile) {
                                      const updatedUserProfile: Usuario = {
                                        ...matchingProfile,
                                        email_alternativo: emailVal
                                      };
                                      saveDocument("usuarios", matchingProfile.email.toLowerCase(), updatedUserProfile);
                                    }
                                  }}
                                  className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:ring-1 focus:ring-blue-600 outline-none w-full lg:w-60 font-bold text-stone-850"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const inputEl = document.getElementById("agent-alt-email") as HTMLInputElement;
                                    const val = inputEl?.value.trim();
                                    if (!val) {
                                      alert("Por favor, preencha um e-mail alternativo válido.");
                                      return;
                                    }
                                    if (matchingProfile) {
                                      const updatedUserProfile: Usuario = {
                                        ...matchingProfile,
                                        email_alternativo: val
                                      };
                                      saveDocument("usuarios", matchingProfile.email.toLowerCase(), updatedUserProfile);
                                      alert(`Excelente! Seu e-mail alternativo foi registrado como "${val}". Você receberá cópias de comprovação e alertas nesse e-mail!`);
                                    } else {
                                      alert("Seu perfil de usuário oficial não foi localizado na coleção para salvamento.");
                                    }
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase py-1.5 px-3 rounded-lg text-center cursor-pointer tracking-wider"
                                >
                                  ✓ Confirmar / Atualizar E-mail
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Admin Secretariat Registration capability directly in the general Panel */}
                    {user?.perfil === "admin" && (
                      <div className="bg-white rounded-2xl p-5 md:p-6 border border-emerald-500/30 shadow-xs animate-fade-in flex flex-col gap-4">
                        <div>
                          <h4 className="font-display font-extrabold text-[#071D41] text-base mb-1 flex items-center gap-2">
                            <Landmark className="w-5 h-5 text-[#168821]" /> Cadastrar Nova Secretaria Municipal (Painel Admin)
                          </h4>
                          <p className="text-stone-500 text-[11px] font-medium leading-relaxed">
                            Adicione novas pastas e órgãos do executivo diretamente pelo seu Painel Geral. A inteligência artificial incorporará imediatamente este novo órgão ao mapeamento de decisões, classificando os chamados para ele de acordo com suas atribuições.
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label htmlFor="painel-sec-add-nome" className="block text-xs font-bold text-stone-600 mb-1">Nome da Secretaria *</label>
                            <input
                              id="painel-sec-add-nome"
                              placeholder="Ex: Secretaria de Esportes"
                              value={novaSecretaria.nome}
                              onChange={(e) => setNovaSecretaria(p => ({ ...p, nome: e.target.value }))}
                              className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none font-medium text-stone-800"
                            />
                          </div>

                          <div>
                            <label htmlFor="painel-sec-add-email" className="block text-xs font-bold text-stone-600 mb-1">E-mail Oficial (@pref) *</label>
                            <input
                              id="painel-sec-add-email"
                              placeholder="esportes@pref.gov.br"
                              value={novaSecretaria.email}
                              onChange={(e) => setNovaSecretaria(p => ({ ...p, email: e.target.value }))}
                              className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none font-medium text-stone-800"
                            />
                          </div>

                          <div>
                            <label htmlFor="painel-sec-add-resp" className="block text-xs font-bold text-stone-600 mb-1">Secretário / Responsável *</label>
                            <input
                              id="painel-sec-add-resp"
                              placeholder="Ex: Cláudio Souza"
                              value={novaSecretaria.responsavel}
                              onChange={(e) => setNovaSecretaria(p => ({ ...p, responsavel: e.target.value }))}
                              className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none font-medium text-stone-800"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="painel-sec-add-funcoes" className="block text-xs font-bold text-stone-600 mb-1">Atribuições e Funções do Órgão * <span className="font-normal text-stone-500">(Crucial para triagem por IA)</span></label>
                          <textarea
                            id="painel-sec-add-funcoes"
                            placeholder="Ex: Gerenciamento e manutenção de campos de futebol públicos, agendamento de ginásios, campeonatos de várzea, incentivo de bolsas desportivas múnicipais."
                            rows={2}
                            value={novaSecretaria.funcoes}
                            onChange={(e) => setNovaSecretaria(p => ({ ...p, funcoes: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none font-sans font-medium text-stone-800"
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              if (!novaSecretaria.nome || !novaSecretaria.email || !novaSecretaria.funcoes) {
                                alert("Por favor, preencha todos os campos obrigatórios (*), incluindo as Atribuições/Funções da secretaria.");
                                return;
                              }
                              const added: SecretariaItem = {
                                id: secretarias.length + 1,
                                nome: novaSecretaria.nome,
                                email: novaSecretaria.email,
                                responsavel: novaSecretaria.responsavel || "A definir",
                                funcoes: novaSecretaria.funcoes
                              };
                              setSecretarias(p => [...p, added]);
                              alert(`Sucesso! Secretaria Municipal "${novaSecretaria.nome}" cadastrada com êxito!`);
                              setNovaSecretaria({ nome: "", email: "", responsavel: "", funcoes: "" });
                            }}
                            className="bg-[#168821] hover:bg-green-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                          >
                            ➕ Cadastrar Secretaria Municipal
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Secretariat load block - Only available for Admin or Ouvidoria */}
                      {(user?.perfil === "admin" || user?.perfil === "Ouvidoria") ? (
                        <div className="bg-white rounded-2xl p-5 md:p-6 border border-stone-200 animate-fade-in">
                          <h4 className="font-display font-extrabold text-[#071D41] text-base mb-4 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-600" /> Cargas por Secretaria Municipal
                          </h4>
                          <div className="flex flex-col gap-3">
                            {secretarias.map((s) => {
                              const calls = manifestacoes.filter(m => m.secretaria === s.nome).length;
                              const pct = totalManifestacoes ? (calls / totalManifestacoes) * 100 : 0;
                              return (
                                <div key={s.id} className="group">
                                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                                    <span className="text-stone-700">{s.nome}</span>
                                    <span className="text-stone-900">{calls} chamados</span>
                                  </div>
                                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                                    <div 
                                      className="bg-[#1351B4] rounded-full h-1.5 transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* Status workload lists */}
                      <div className={`bg-white rounded-2xl p-5 md:p-6 border border-[#2670E8]/20 shadow-sm ${
                        (user?.perfil === "admin" || user?.perfil === "Ouvidoria") ? "" : "md:col-span-2"
                      }`}>
                        <h4 className="font-display font-extrabold text-[#071D41] text-base mb-4 flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-red-650" /> Resolução de Manifestações {user?.perfil === "Secretaria" ? `(${user.secretaria})` : ""}
                        </h4>
                        <div className="flex flex-col gap-3">
                          {["Pendente", "Em Andamento", "Resolvido", "Urgente"].map((status) => {
                            const count = manifestacoesParaUsuario.filter(m => m.status === status).length;
                            return (
                              <div key={status} className="flex justify-between items-center py-2.5 border-b border-stone-100 last:border-none">
                                <span className={`font-display font-black text-xs px-3 py-1 rounded-full ${
                                  status === "Resolvido" ? "bg-emerald-100 text-emerald-850" :
                                  status === "Em Andamento" ? "bg-blue-100 text-blue-850" :
                                  status === "Urgente" ? "bg-red-100 text-red-850" : "bg-amber-100 text-amber-850"
                                }`}>{status}</span>
                                <span className="text-xs font-black text-stone-850">{count} Manifestações</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: DETAILED DATATABLE LIST */}
                {dashboardTab === "chamados" && (
                  <div className="bg-white rounded-2xl p-4 md:p-6 border border-stone-200">
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-5">
                      <h4 className="font-display font-extrabold text-stone-800 text-base">Manifestações Recebidas</h4>
                      
                      {/* Interactive filtering selectors */}
                      <div className="flex flex-wrap gap-2">
                        {user?.perfil === "Secretaria" ? (
                          <div className="text-xs font-extrabold px-3 py-2 border rounded-lg bg-stone-100 text-[#071D41]">
                            Secretaria: {user.secretaria}
                          </div>
                        ) : (
                          <select
                            id="filter-sec"
                            value={filtro.secretaria}
                            onChange={(e) => setFiltro(p => ({ ...p, secretaria: e.target.value }))}
                            className="text-xs font-semibold px-3 py-2 border rounded-lg outline-none bg-stone-50 cursor-pointer"
                          >
                            <option value="">Todas as Secretarias</option>
                            {secretarias.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                          </select>
                        )}

                        <select
                          id="filter-status"
                          value={filtro.status}
                          onChange={(e) => setFiltro(p => ({ ...p, status: e.target.value }))}
                          className="text-xs font-semibold px-3 py-2 border rounded-lg outline-none bg-stone-50 cursor-pointer"
                        >
                          <option value="">Todos os Status</option>
                          {["Pendente", "Em Andamento", "Resolvido", "Urgente"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>


                      </div>
                    </div>

                    <div className="overflow-x-auto w-full rounded-xl border border-stone-150">
                      <div className="block sm:hidden text-[10px] bg-slate-50 text-stone-500 py-1.5 px-3 border-b text-center font-bold">
                        ↔ Deslize para ver mais ou clique em "Ver Detalhes"
                      </div>
                      <table className="w-full text-xs text-left text-stone-700 select-none">
                        <thead className="text-[11px] uppercase text-white bg-[#071D41]">
                          <tr>
                            <th className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold">Protocolo</th>
                            <th className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold">Tipo</th>
                            <th className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold">Categoria (IA)</th>
                            <th className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold hidden sm:table-cell">Secretaria</th>
                            <th className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold hidden md:table-cell">Bairro</th>
                            <th className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold">Status</th>
                            <th className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold hidden sm:table-cell">Data</th>
                            <th className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-150">
                          {filteredAdmList.length > 0 ? (
                            filteredAdmList.map((m) => {
                              const isManifVereador = m.autor_ocupacao === "Vereador" || m.destacado;
                              return (
                                <tr 
                                  key={m.id} 
                                  className={`transition-colors ${
                                    isManifVereador 
                                      ? "bg-amber-50 hover:bg-amber-100/80 border-l-4 border-l-amber-500 font-medium" 
                                      : "hover:bg-stone-50/80"
                                  }`}
                                >
                                  <td className="px-2.5 py-3 md:px-4 md:py-3.5 font-mono font-bold text-stone-900">
                                    <div className="flex flex-col gap-1">
                                      <span>#{m.protocolo}</span>
                                      {isManifVereador && (
                                        <span className="inline-flex items-center gap-0.5 bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider w-max animate-pulse">
                                          🏛️ Vereador
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                <td className="px-2.5 py-3 md:px-4 md:py-3.5 font-medium">
                                  <span className="block font-bold">{m.tipo}</span>
                                  {m.responsavel_nome && (
                                    <span className="inline-flex items-center gap-1 bg-stone-100 border border-stone-200 text-stone-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md mt-1 animate-fade-in" title={`Delegado para: ${m.responsavel_email}`}>
                                      👤 {m.responsavel_nome} • <span className="text-stone-500">{m.responsavel_cargo}</span>
                                    </span>
                                  )}
                                </td>
                                <td className="px-2.5 py-3 md:px-4 md:py-3.5 font-semibold text-[#1351B4]">{m.ia_categoria}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-3.5 font-bold text-stone-800 hidden sm:table-cell">{m.secretaria}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-3.5 hidden md:table-cell">{m.bairro}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-3.5">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                    m.status === "Resolvido" ? "bg-emerald-100 text-emerald-700" :
                                    m.status === "Em Andamento" ? "bg-blue-100 text-blue-700" :
                                    m.status === "Urgente" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                  }`}>{m.status}</span>
                                </td>
                                <td className="px-2.5 py-3 md:px-4 md:py-3.5 font-mono hidden sm:table-cell">{m.data}</td>
                                <td className="px-2.5 py-3 md:px-4 md:py-3.5 text-center">
                                  <button
                                    id={`view-detail-manifest-${m.id}`}
                                    onClick={() => setSelectedManif(m)}
                                    className="bg-[#1351B4] hover:bg-blue-700 text-white font-extrabold text-[10px] md:text-[11px] px-2.5 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                                  >
                                    Ver Detalhes
                                  </button>
                                </td>
                              </tr>
                            );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8} className="px-4 py-12 text-center text-stone-400 font-bold text-sm bg-stone-50/50">
                                Sem manifestações correspondentes aos filtros selecionados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {dashboardTab === "mapa" && (
                  <div className="flex flex-col gap-6">
                    {/* Header with Role Status Info */}
                    <div className="bg-gradient-to-r from-[#071D41] to-[#1351B4] rounded-2xl p-5 md:p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="bg-white/10 text-emerald-300 border border-emerald-400/20 text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Activity className="w-3 h-3 animate-pulse" /> Monitoramento Georreferenciado Ativo
                          </span>
                        </div>
                        <h3 className="font-display font-black text-lg md:text-xl tracking-tight">
                          🗺️ Centro de Inteligência Urbana e Mapeamento de Calor
                        </h3>
                        <p className="text-white/70 text-xs mt-1 font-medium max-w-2xl leading-relaxed">
                          Visualização espacial em tempo real de demandas e mensagens enviadas pelos cidadãos. 
                          {user?.perfil === "Secretaria" ? (
                            <span className="text-amber-300 font-bold block mt-1">
                              • Perfil Secretaria: Exibindo apenas demandas designadas à pasta de "{user.secretaria}".
                            </span>
                          ) : (
                            <span className="text-emerald-300 font-bold block mt-1">
                              • Perfil {user?.perfil === "prefeito" ? "Gabinete do Prefeito" : "Gestor Geral"}: Exibindo todo o território municipal com consolidação integrada.
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 bg-white/10 p-2 text-xs font-bold rounded-lg border border-white/10">
                        <span className="text-[#93C5FD]">Total de Pontos no Filtro Atual:</span>
                        <span className="text-white bg-[#071D41] px-2 py-1 rounded font-black text-sm">
                          {(() => {
                            let items = mapFilteredManifestacoes;
                            if (selectedMapBairro) {
                              items = items.filter(m => m.bairro === selectedMapBairro);
                            }
                            if (mapFilterType !== "todas") {
                              items = items.filter(m => m.tipo === mapFilterType);
                            }
                            if (mapFilterPriority !== "todas") {
                              items = items.filter(m => m.status === mapFilterPriority || (mapFilterPriority === "Urgente" && m.status === "Urgente") || (mapFilterPriority === "Alta" && m.status === "Pendente" && m.tipo === "Denúncia"));
                            }
                            return items.length;
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Integrated Top Search Panel of 'Mapa Bairros' Tab */}
                    <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
                      <div className="relative flex-1 w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          id="map-loc-search"
                          type="text"
                          placeholder="Buscar chamados por nome do bairro (Ex: Centro, Vila Nova) ou número de protocolo..."
                          value={mapSearchQuery}
                          onChange={(e) => {
                            setMapSearchQuery(e.target.value);
                            setSelectedMapManif(null); // Clear individual focus when typing
                          }}
                          className="w-full text-xs font-bold pl-9 pr-4 py-2.5 bg-stone-50 hover:bg-stone-100 focus:bg-white text-stone-800 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-[#1351B4] transition-all"
                        />
                      </div>
                      {mapSearchQuery && (
                        <button
                          onClick={() => {
                            setMapSearchQuery("");
                            setSelectedMapManif(null);
                          }}
                          className="text-[11px] font-extrabold text-red-650 bg-red-50 hover:bg-red-100 border border-red-250 px-3.5 py-2.5 rounded-xl shrink-0 cursor-pointer active:scale-95 transition-all w-full sm:w-auto text-center"
                        >
                          Limpar Busca
                        </button>
                      )}
                    </div>

                    {/* Slicers and Layout Panels */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* Left Column: Interactive Map (lg:col-span-8) */}
                      <div className="lg:col-span-8 bg-white rounded-3xl p-4 border border-stone-200 flex flex-col gap-4">
                        
                        {/* Map Utilities Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5">
                          <div className="flex items-center gap-2">
                            <Map className="w-4 h-4 text-[#1351B4]" />
                            <span className="text-xs font-black text-[#071D41] uppercase tracking-wider">Painel Geográfico Integrado</span>
                          </div>
                          
                          {/* Map Toggles / Layers */}
                          <div className="flex items-center gap-4 text-xs font-semibold text-stone-600">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-stone-900 transition-colors">
                              <input 
                                type="checkbox" 
                                checked={mapShowHeat} 
                                onChange={(e) => setMapShowHeat(e.target.checked)}
                                className="rounded text-[#1351B4] focus:ring-[#1351B4]" 
                              />
                              <span>Ondas de Calor (Densidade)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-stone-900 transition-colors">
                              <input 
                                type="checkbox" 
                                checked={mapShowPins} 
                                onChange={(e) => setMapShowPins(e.target.checked)}
                                className="rounded text-[#1351B4] focus:ring-[#1351B4]" 
                              />
                              <span>Alfinetes Individuais (Pins)</span>
                            </label>
                          </div>
                        </div>

                        {/* The Actual Digital Blueprint GIS Canvas */}
                        <div className="relative w-full h-[450px] bg-[#0c192e] rounded-2xl overflow-hidden border border-stone-900 select-none shadow-inner group">
                          
                          {/* Grid Overlay Pattern */}
                          <div 
                            className="absolute inset-0 pointer-events-none opacity-10" 
                            style={{ 
                              backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", 
                              backgroundSize: "20px 20px" 
                            }} 
                          />

                          {/* Beautiful SVG City Anatomy Background */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
                            {/* Blue River cutting across town */}
                            <path d="M -50,150 C 150,100 250,380 400,320 C 500,280 650,450 900,380" stroke="#0ea5e9" strokeWidth="24" strokeLinecap="round" fill="none" />
                            <path d="M -50,150 C 150,100 250,380 400,320 C 500,280 650,450 900,380" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" fill="none" />
                            
                            {/* Green Parks */}
                            <rect x="15%" y="45%" width="80" height="50" rx="10" fill="#10b981" />
                            <rect x="68%" y="12%" width="110" height="70" rx="12" fill="#10b981" />
                            
                            {/* Avenues & Roads (Dashed grid lines) */}
                            <line x1="0" y1="300" x2="100%" y2="300" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="6 4" />
                            <line x1="400" y1="0" x2="400" y2="100%" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="6 4" />
                            <path d="M0,50 Q450,450 900,250" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 3" />
                            
                            {/* Typography Street labels */}
                            <text x="45%" y="62%" fill="#ffffff" fontSize="9" fontWeight="bold" letterSpacing="1" opacity="0.6">AV. PRINCIPAL</text>
                            <text x="70%" y="15%" fill="#ffffff" fontSize="8" fontWeight="bold" letterSpacing="0.5" opacity="0.5">PARQUE ECOLÓGICO ESTADUAL</text>
                            <text x="10" y="165%" fill="#ffffff" fontSize="8" fontWeight="bold" transform="rotate(-15, 10, 160)" opacity="0.5">CÓRREGO SÃO JOÃO</text>
                          </svg>

                          {/* Interactive Bairros Regions Hotspots Trigger Layers */}
                          {BAIRROS_PADRAO.map((b) => {
                            // Coordinate mappings
                            const coords: { x: number; y: number } = (() => {
                              switch (b) {
                                case "Centro": return { x: 50, y: 50 };
                                case "Jardim América": return { x: 30, y: 32 };
                                case "Vila Nova": return { x: 74, y: 26 };
                                case "Santa Luzia": return { x: 26, y: 70 };
                                case "Boa Vista": return { x: 72, y: 72 };
                                default: return { x: 50, y: 50 };
                              }
                            })();

                            // Manifestations within filter in this region
                            let regionManifests = mapFilteredManifestacoes.filter(m => m.bairro === b);
                            if (mapFilterType !== "todas") {
                              regionManifests = regionManifests.filter(m => m.tipo === mapFilterType);
                            }
                            if (mapFilterPriority !== "todas") {
                              regionManifests = regionManifests.filter(m => m.status === mapFilterPriority || (mapFilterPriority === "Urgente" && m.status === "Urgente") || (mapFilterPriority === "Alta" && m.status === "Pendente" && m.tipo === "Denúncia"));
                            }
                            const densityCount = regionManifests.length;

                            // Scale factors
                            const glowSize = Math.min(40 + densityCount * 30, 160);
                            const glowPulseDuration = densityCount >= 4 ? "1.5s" : densityCount >= 2 ? "3s" : "4.5s";

                            // Hot wave opacity and color
                            const themeColor = densityCount >= 4 ? "239, 68, 68"  // Intense Red
                                             : densityCount >= 2 ? "249, 115, 22" // Warning Orange
                                             : densityCount >= 1 ? "234, 179, 8"  // Soft Yellow
                                             : "59, 130, 246";                    // Fine Blue

                            const isSelected = selectedMapBairro === b;

                            return (
                              <div key={b}>
                                {/* Wave Ring Radiance Backdrop (Animated Heat Zone) */}
                                {mapShowHeat && densityCount > 0 && (
                                  <div 
                                    className="absolute rounded-full pointer-events-none transition-all duration-700 flex items-center justify-center animate-pulse"
                                    style={{
                                      left: `${coords.x}%`,
                                      top: `${coords.y}%`,
                                      width: `${glowSize}px`,
                                      height: `${glowSize}px`,
                                      transform: "translate(-50%, -50%)",
                                      background: `radial-gradient(circle, rgba(${themeColor}, 0.22) 0%, rgba(${themeColor}, 0.03) 70%, transparent 100%)`,
                                      animationDuration: glowPulseDuration
                                    }}
                                  >
                                    {/* Concentric radar circle if extremely critical */}
                                    {densityCount >= 4 && (
                                      <div 
                                        className="rounded-full border border-red-500/30 animate-ping absolute inset-0"
                                        style={{ animationDuration: "1.8s" }}
                                      />
                                    )}
                                  </div>
                                )}

                                {/* Clicking region trigger center dot */}
                                <button
                                  onClick={() => {
                                    setSelectedMapBairro(selectedMapBairro === b ? "" : b);
                                    setSelectedMapManif(null);
                                  }}
                                  className={`absolute group/btn p-2 rounded-xl text-center outline-none cursor-pointer transition-all ${
                                    isSelected 
                                      ? "bg-[#1351B4] text-white ring-2 ring-white scale-110 shadow-lg z-20" 
                                      : "bg-black/40 text-stone-300 hover:bg-stone-800/80 hover:text-white z-10"
                                  }`}
                                  style={{
                                    left: `${coords.x}%`,
                                    top: `${coords.y}%`,
                                    transform: "translate(-50%, -50%)"
                                  }}
                                >
                                  <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black truncate max-w-[85px] tracking-wide block uppercase">
                                      {b}
                                    </span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        densityCount >= 4 ? "bg-red-500 animate-pulse" :
                                        densityCount >= 2 ? "bg-orange-500" :
                                        densityCount >= 1 ? "bg-yellow-500" : "bg-blue-400"
                                      }`} />
                                      <span className="text-[9px] font-bold">
                                        {densityCount} chamados
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              </div>
                            );
                          })}

                          {/* Render Individual Physical Pushpins (Complaints and Messages) */}
                          {mapShowPins && (
                            (() => {
                              let points = mapFilteredManifestacoes;
                              if (selectedMapBairro) {
                                points = points.filter(m => m.bairro === selectedMapBairro);
                              }
                              if (mapFilterType !== "todas") {
                                points = points.filter(m => m.tipo === mapFilterType);
                              }
                              if (mapFilterPriority !== "todas") {
                                points = points.filter(m => m.status === mapFilterPriority || (mapFilterPriority === "Urgente" && m.status === "Urgente") || (mapFilterPriority === "Alta" && m.status === "Pendente" && m.tipo === "Denúncia"));
                              }

                              return points.map((m) => {
                                // Deterministic coordinates spreading matching neighborhood hubs
                                const base: { x: number; y: number } = (() => {
                                  switch (m.bairro) {
                                    case "Centro": return { x: 50, y: 50 };
                                    case "Jardim América": return { x: 30, y: 32 };
                                    case "Vila Nova": return { x: 74, y: 26 };
                                    case "Santa Luzia": return { x: 26, y: 70 };
                                    case "Boa Vista": return { x: 72, y: 72 };
                                    default: return { x: 50, y: 50 };
                                  }
                                })();

                                const seedX = Math.sin(m.id * 1845.24) * 9; // -9 to +9% deviation
                                const seedY = Math.cos(m.id * 854.76) * 9;  // -9 to +9% deviation
                                const x = Math.max(8, Math.min(92, base.x + seedX));
                                const y = Math.max(12, Math.min(88, base.y + seedY));

                                // Colors based on priority
                                const isUrgent = m.status === "Urgente" || m.tipo === "Denúncia";
                                const pinColor = isUrgent ? "text-red-500" 
                                               : m.status === "Em Andamento" ? "text-blue-400"
                                               : m.status === "Resolvido" ? "text-emerald-400" 
                                               : "text-amber-400";

                                const isSpecificSelected = selectedMapManif?.id === m.id;

                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => {
                                      setSelectedMapManif(m);
                                      setSelectedMapBairro(""); // focus on the pin
                                    }}
                                    className={`absolute cursor-pointer transition-all duration-300 z-10 ${
                                      isSpecificSelected 
                                        ? "scale-140 z-30 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
                                        : "hover:scale-125 hover:z-20"
                                    }`}
                                    style={{
                                      left: `${x}%`,
                                      top: `${y}%`,
                                      transform: "translate(-50%, -50%)"
                                    }}
                                  >
                                    <div className="relative group/pin flex flex-col items-center">
                                      {/* Mini Beacon glow if critical/Urgent */}
                                      {isUrgent && (
                                        <span className="absolute top-1 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-60" />
                                      )}
                                      
                                      <MapPin className={`w-5 h-5 ${pinColor} fill-current`} />
                                      
                                      {/* Micro tooltip on click/hover */}
                                      <div className="absolute bottom-6 hidden group-hover/pin:flex flex-col bg-stone-900 border border-stone-700 text-white rounded-lg p-2 text-[9px] font-bold w-44 pointer-events-none shadow-xl leading-normal z-[100] transition-opacity">
                                        <div className="flex justify-between items-center border-b border-stone-700 pb-1 mb-1">
                                          <span className="text-[8px] font-mono text-stone-400">#{m.protocolo}</span>
                                          <span className="text-[7px] uppercase font-black text-rose-400">{m.tipo}</span>
                                        </div>
                                        <p className="truncate text-stone-200">{m.categoria || m.descricao}</p>
                                        <div className="flex justify-between mt-1 text-[7.5px] text-stone-400 italic">
                                          <span>{m.bairro}</span>
                                          <span className="font-extrabold text-white">{m.status}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              });
                            })()
                          )}

                          {/* Interactive GIS Legend Layer */}
                          <div className="absolute bottom-2.5 left-2.5 bg-[#091424]/90 border border-stone-800 text-white px-3 py-2.5 rounded-xl text-[9.5px] font-bold leading-normal flex flex-col gap-1.5 shadow-lg backdrop-blur-md">
                            <span className="text-stone-400 uppercase tracking-widest text-[8px] font-black border-b border-stone-800 pb-1">Escala Termo-Social</span>
                            <div className="flex items-center gap-1.5 text-stone-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-red-500/50 animate-pulse" />
                              <span>Zona Crítica (&ge; 4 Demandas)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-stone-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-orange-400/50" />
                              <span>Zona de Alerta (2-3 Demandas)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-stone-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-yellow-400/50" />
                              <span>Zona Moderada (1 Demanda)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-stone-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-400/50" />
                              <span>Região Equilibrada (0 Demandas)</span>
                            </div>
                          </div>

                          {/* Reset Button on Map */}
                          {(selectedMapBairro || selectedMapManif) && (
                            <button
                              onClick={() => {
                                setSelectedMapBairro("");
                                setSelectedMapManif(null);
                              }}
                              className="absolute top-2.5 right-2.5 bg-red-600 hover:bg-red-700 text-white text-[9.5px] font-black px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-lg"
                            >
                              🧯 Limpar Seleção do Mapa
                            </button>
                          )}
                        </div>

                        {/* Top Neighborhood List Overview Panel below the Map */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-2">
                          {BAIRROS_PADRAO.map((b) => {
                            const regionManifests = mapFilteredManifestacoes.filter(m => m.bairro === b);
                            const activeCount = regionManifests.length;
                            const isSel = selectedMapBairro === b;

                            return (
                              <button
                                key={b}
                                onClick={() => {
                                  setSelectedMapBairro(isSel ? "" : b);
                                  setSelectedMapManif(null);
                                }}
                                className={`p-2.5 border rounded-xl text-center cursor-pointer transition-all ${
                                  isSel 
                                    ? "bg-[#1351B4]/10 border-[#1351B4] text-[#1351B4] shadow-xs scale-102 font-black" 
                                    : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700 text-xs font-semibold"
                                }`}
                              >
                                <span className="block text-[10.5px] leading-tight truncate">{b}</span>
                                <span className={`text-[12px] font-black block mt-0.5 ${
                                  activeCount >= 4 ? "text-red-600" : 
                                  activeCount >= 2 ? "text-orange-600" : "text-stone-800"
                                }`}>
                                  {activeCount} demand{activeCount === 1 ? "a" : "as"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right Column: command details sidebar (lg:col-span-4) */}
                      <div className="lg:col-span-4 flex flex-col gap-5">
                        
                        {/* Control Box: Slicers Filters */}
                        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs flex flex-col gap-4">
                          <div className="flex items-center gap-2 border-b pb-2">
                            <Sliders className="w-4 h-4 text-[#1351B4]" />
                            <h4 className="font-display font-extrabold text-[#071D41] text-xs uppercase tracking-wider">
                              Filtros do Mapa Térmico
                            </h4>
                          </div>

                          {/* Map Filter type dropdown */}
                          <div>
                            <label htmlFor="map-filt-tipo" className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Tipo de Demanda</label>
                            <select
                              id="map-filt-tipo"
                              value={mapFilterType}
                              onChange={(e) => {
                                setMapFilterType(e.target.value);
                                setSelectedMapManif(null);
                              }}
                              className="w-full text-xs font-bold px-3 py-2 border rounded-lg cursor-pointer outline-none bg-stone-50 text-stone-700"
                            >
                              <option value="todas">🎯 Todas as Demandas/Mensagens</option>
                              <option value="Reclamação">⚠️ Reclamações</option>
                              <option value="Denúncia">🚨 Denúncias de Emergência</option>
                              <option value="Sugestão">💡 Sugestões de Cidadãos</option>
                              <option value="Elogio">🌸 Elogios de Gratidão</option>
                            </select>
                          </div>

                          {/* Map Filter priority/status */}
                          <div>
                            <label htmlFor="map-filt-prio" className="block text-[10px] font-bold text-stone-500 uppercase mb-1">Status Atribuído</label>
                            <select
                              id="map-filt-prio"
                              value={mapFilterPriority}
                              onChange={(e) => {
                                setMapFilterPriority(e.target.value);
                                setSelectedMapManif(null);
                              }}
                              className="w-full text-xs font-bold px-3 py-2 border rounded-lg cursor-pointer outline-none bg-stone-50 text-stone-700"
                            >
                              <option value="todas">🚦 Todos os Estados Públicos</option>
                              <option value="Pendente">🟡 Pendente (Sem Resposta)</option>
                              <option value="Em Andamento">🔵 Em Andamento e Diligência</option>
                              <option value="Resolvido">🟢 Resolvido e Protocolado</option>
                              <option value="Urgente">🔴 Classificação Urgente</option>
                            </select>
                          </div>

                          {/* Active state display bar */}
                          <div className="bg-stone-50 p-3 rounded-xl border text-[11px] leading-relaxed text-stone-600">
                            <strong>Indicadores Vigentes:</strong><br />
                            • Mostrando somente manifestações ativas de acordo com os filtros selecionados. Clique sobre qualquer <strong>bairro</strong> ou <strong>alfinete (pin)</strong> no mapa para obter aprofundamento operacional detalhado.
                          </div>
                        </div>

                        {/* Interactive Selection Details Box */}
                        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs flex-1 flex flex-col min-h-[300px]">
                          
                          {/* Case 1: Individual pin selected */}
                          {selectedMapManif ? (
                            <div className="flex flex-col gap-4 h-full animate-fade-in">
                              <div className="flex justify-between items-start border-b pb-2">
                                <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-rose-100">
                                  {selectedMapManif.tipo}
                                </span>
                                <span className="font-mono text-stone-400 text-[11px] font-bold">Prot: {selectedMapManif.protocolo}</span>
                              </div>

                              <div>
                                <h4 className="text-xs font-black text-[#071D41] uppercase tracking-wide mb-1 leading-normal flex items-center gap-1">
                                  <MessageSquare className="w-3.5 h-3.5 text-[#1351B4]" />
                                  Detalhes da Mensagem / Demanda
                                </h4>
                                <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl text-stone-700 text-xs italic leading-relaxed max-h-48 overflow-y-auto">
                                  "{selectedMapManif.descricao}"
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
                                <div className="bg-stone-50 p-2 border rounded-lg">
                                  <span className="text-[9px] text-stone-400 block font-bold">BAIRRO</span>
                                  <span className="text-stone-800 font-bold">{selectedMapManif.bairro}</span>
                                </div>
                                <div className="bg-stone-50 p-2 border rounded-lg">
                                  <span className="text-[9px] text-stone-400 block font-bold">PASTA DESIGNADA</span>
                                  <span className="text-stone-800 font-bold truncate block" title={selectedMapManif.secretaria}>
                                    {selectedMapManif.secretaria || "Gabinete Geral"}
                                  </span>
                                </div>
                                <div className="bg-stone-50 p-2 border rounded-lg">
                                  <span className="text-[9px] text-stone-400 block font-bold">SITUAÇÃO ATUAL</span>
                                  <span className={`font-black uppercase tracking-wider ${
                                    selectedMapManif.status === "Resolvido" ? "text-emerald-700" :
                                    selectedMapManif.status === "Em Andamento" ? "text-blue-700" :
                                    selectedMapManif.status === "Urgente" ? "text-red-700 animate-pulse" : "text-amber-700"
                                  }`}>
                                    {selectedMapManif.status}
                                  </span>
                                </div>
                                <div className="bg-stone-50 p-2 border rounded-lg">
                                  <span className="text-[9px] text-stone-400 block font-bold">INTELIGÊNCIA ARTIFICIAL</span>
                                  <span className="text-indigo-700 font-bold uppercase tracking-wide block">Classificado</span>
                                </div>
                              </div>

                              {/* AI Response snippet if present */}
                              {selectedMapManif.resposta_ia && (
                                <div className="bg-blue-50/50 p-2 rounded-xl text-[10.5px] leading-relaxed border border-blue-200 text-[#071D41]">
                                  <span className="font-extrabold text-[9px] block text-stone-400 uppercase tracking-widest mb-0.5">Retórica da IA</span>
                                  "{selectedMapManif.resposta_ia}"
                                </div>
                              )}

                              {/* Action: Dispatch from map */}
                              <div className="border-t pt-3 mt-auto">
                                <span className="text-[10px] text-stone-500 block font-black uppercase mb-2 text-center tracking-wider text-xs">Ações de Resolução de Gabinete</span>
                                <div className="flex flex-col gap-1.5">
                                  {["Em Andamento", "Resolvido", "Urgente"].map((st) => {
                                    if (selectedMapManif.status === st) return null;
                                    
                                    const label = st === "Resolvido" ? "✔️ Concluir chamado (Resolvido)" :
                                                  st === "Urgente" ? "🚨 Marcar como Urgente" :
                                                  "⚙️ Iniciar diligência (Em Andamento)";

                                    return (
                                      <button
                                        key={st}
                                        onClick={() => {
                                          triggerSimulatedEmail(selectedMapManif, selectedMapManif.status, st);
                                          const updatedM = { ...selectedMapManif, status: st };
                                          setManifestacoes(prev => prev.map(m => m.id === selectedMapManif.id ? updatedM : m));
                                          setSelectedMapManif(prev => prev ? { ...prev, status: st } : null);
                                          saveDocument("manifestacoes", selectedMapManif.protocolo, updatedM);
                                          alert(`Canal geográfico atualizado! Protocolo #${selectedMapManif.protocolo} modificado para "${st}".`);
                                        }}
                                        className={`w-full py-2 px-3 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all ${
                                          st === "Resolvido" ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-left" :
                                          st === "Urgente" ? "bg-red-50 text-red-800 hover:bg-red-100 border-red-200 text-left animate-pulse" :
                                          "bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200 text-left"
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ) : selectedMapBairro ? (
                            /* Case 2: Neigborhood is selected */
                            <div className="flex flex-col gap-4 animate-fade-in h-full">
                              <div className="border-b pb-2 flex justify-between items-center">
                                <h4 className="font-display font-extrabold text-[#071D41] text-xs uppercase tracking-wider">
                                  Demandas em: {selectedMapBairro}
                                </h4>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black border border-indigo-150">
                                  {
                                    mapFilteredManifestacoes.filter(m => {
                                      let ok = m.bairro === selectedMapBairro;
                                      if (mapFilterType !== "todas") ok = ok && m.tipo === mapFilterType;
                                      if (mapFilterPriority !== "todas") ok = ok && (m.status === mapFilterPriority || (mapFilterPriority === "Urgente" && m.status === "Urgente"));
                                      return ok;
                                    }).length
                                  } registros
                                </span>
                              </div>

                              <div className="flex-1 overflow-y-auto max-h-[310px] flex flex-col gap-2.5 pr-1">
                                {(() => {
                                  let neighborhoodList = mapFilteredManifestacoes.filter(m => m.bairro === selectedMapBairro);
                                  if (mapFilterType !== "todas") {
                                    neighborhoodList = neighborhoodList.filter(m => m.tipo === mapFilterType);
                                  }
                                  if (mapFilterPriority !== "todas") {
                                    neighborhoodList = neighborhoodList.filter(m => m.status === mapFilterPriority || (mapFilterPriority === "Urgente" && m.status === "Urgente") || (mapFilterPriority === "Alta" && m.status === "Pendente" && m.tipo === "Denúncia"));
                                  }

                                  if (neighborhoodList.length === 0) {
                                    return (
                                      <div className="text-center py-10 text-stone-400 font-semibold text-xs leading-normal">
                                        Nenhum registro encontrado para este bairro com os filtros selecionados.
                                      </div>
                                    );
                                  }

                                  return neighborhoodList.map((m) => (
                                    <button
                                      key={m.id}
                                      onClick={() => setSelectedMapManif(m)}
                                      className="text-left p-3 border border-stone-200 hover:border-blue-300 rounded-xl bg-stone-50 hover:bg-white transition-all w-full cursor-pointer flex flex-col gap-1 items-stretch group"
                                    >
                                      <div className="flex justify-between items-center text-[9px] font-bold border-b border-stone-150 pb-1 opacity-70">
                                        <span>Prot: {m.protocolo}</span>
                                        <span className={`uppercase font-black ${
                                          m.status === "Resolvido" ? "text-emerald-700" :
                                          m.status === "Em Andamento" ? "text-blue-700" :
                                          m.status === "Urgente" ? "text-red-700" : "text-amber-700"
                                        }`}>{m.status}</span>
                                      </div>
                                      <span className="text-xs font-black text-stone-850 truncate group-hover:text-[#1351B4] leading-tight block mt-1">
                                        {m.categoria || m.tipo}
                                      </span>
                                      <p className="text-[11px] text-stone-500 truncate leading-relaxed">
                                        {m.descricao}
                                      </p>
                                    </button>
                                  ));
                                })()}
                              </div>
                            </div>
                          ) : (
                            /* Case 3: Nothing specifically selected, general instruction representation */
                            <div className="flex flex-col items-center justify-center text-center my-auto px-4 py-8">
                              <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200/50 flex items-center justify-center mb-4">
                                <AlertCircle className="w-7 h-7 text-[#1351B4]" />
                              </div>
                              <h4 className="font-display font-extrabold text-stone-800 text-sm mb-1.5 uppercase tracking-wide">
                                Seletor de Inteligência
                              </h4>
                              <p className="text-stone-500 text-xs leading-relaxed max-w-[240px]">
                                Clique em uma zona térmica (bairro) ou em um alfinete de ocorrência individual (pin) no mapa para carregar as métricas de acompanhamento.
                              </p>
                            </div>
                          )}

                        </div>

                      </div>

                    </div>
                  </div>
                )}

                {/* TAB CONTENT: MUN USER MANAGEMENT */}
                {dashboardTab === "usuarios" && isAuthorizedForAgentesEFuncoes(user) && (
                  <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-2xl p-5 md:p-6 border border-stone-200">
                      <h4 className="font-display font-extrabold text-[#071D41] text-base mb-4 flex items-center gap-1.5">
                        <Users className="w-5 h-5 text-[#1351B4]" /> Cadastro de Servidor Público
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                          <label htmlFor="usr-add-nome" className="block text-xs font-bold text-stone-600 mb-1">Nome do Servidor *</label>
                          <input
                            id="usr-add-nome"
                            value={novoUsuario.nome}
                            onChange={(e) => setNovoUsuario(p => ({ ...p, nome: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                          />
                        </div>

                        <div>
                          <label htmlFor="usr-add-email" className="block text-xs font-bold text-stone-600 mb-1">E-mail Corporativo (@gov) *</label>
                          <input
                            id="usr-add-email"
                            placeholder="servidor@municipio.gov.br"
                            value={novoUsuario.email}
                            onChange={(e) => setNovoUsuario(p => ({ ...p, email: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                          />
                        </div>

                        <div>
                          <label htmlFor="usr-add-alt-email" className="block text-xs font-bold text-stone-600 mb-1">E-mail Alternativo (para Despachos/Provas)</label>
                          <input
                            id="usr-add-alt-email"
                            placeholder="servidor.pessoal@pessoal.com"
                            value={novoUsuario.email_alternativo || ""}
                            onChange={(e) => setNovoUsuario(p => ({ ...p, email_alternativo: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none animate-fade-in"
                          />
                        </div>

                        <div>
                          <label htmlFor="usr-add-perfil" className="block text-xs font-bold text-stone-600 mb-1">Perfil Administrativo</label>
                          <select
                            id="usr-add-perfil"
                            value={novoUsuario.perfil}
                            onChange={(e) => setNovoUsuario(p => ({ ...p, perfil: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg outline-none bg-white font-semibold cursor-pointer"
                          >
                            <option value="Ouvidoria">Ouvidoria Geral</option>
                            <option value="Secretaria">Secretaria Responsável (Secretário)</option>
                            <option value="Procurador">Procurador do Município</option>
                            <option value="admin">Administrador Geral</option>
                            <option value="prefeito">Prefeito do Município</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor="usr-add-sec" className="block text-xs font-bold text-stone-600 mb-1">Secretaria Correspondente</label>
                          <select
                            id="usr-add-sec"
                            value={novoUsuario.secretaria}
                            onChange={(e) => setNovoUsuario(p => ({ ...p, secretaria: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg outline-none bg-white font-semibold cursor-pointer"
                          >
                            <option value="">Nenhuma / Ouvidoria Geral</option>
                            {secretarias.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                          </select>
                        </div>

                        <div className="sm:col-span-2 border-t pt-4 mt-2">
                          <h5 className="text-xs font-bold text-[#071D41] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            🛡️ Funções e Permissões Atribuídas no App
                          </h5>
                          <p className="text-stone-500 text-[11px] mb-3">Atribua manualmente quais funções do aplicativo este servidor ou usuário poderá acessar e gerenciar.</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                            <label className="flex items-center gap-2.5 text-xs text-stone-700 font-semibold cursor-pointer py-1 hover:text-stone-900">
                              <input
                                type="checkbox"
                                checked={novoUsuario.visualizarRelatorios}
                                onChange={(e) => setNovoUsuario(p => ({ ...p, visualizarRelatorios: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>📈 Visualizar Relatórios e Estatísticas Gerais</span>
                            </label>

                            <label className="flex items-center gap-2.5 text-xs text-stone-700 font-semibold cursor-pointer py-1 hover:text-stone-900">
                              <input
                                type="checkbox"
                                checked={novoUsuario.responderChamados}
                                onChange={(e) => setNovoUsuario(p => ({ ...p, responderChamados: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>📋 Responder / Alterar Status de Manifestações</span>
                            </label>

                            <label className="flex items-center gap-2.5 text-xs text-stone-700 font-semibold cursor-pointer py-1 hover:text-stone-900">
                              <input
                                type="checkbox"
                                checked={novoUsuario.gerenciarPublicidade}
                                onChange={(e) => setNovoUsuario(p => ({ ...p, gerenciarPublicidade: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>📢 Gerenciar e Publicar Campanhas de Publicidade</span>
                            </label>

                            <label className="flex items-center gap-2.5 text-xs text-stone-700 font-semibold cursor-pointer py-1 hover:text-stone-900">
                              <input
                                type="checkbox"
                                checked={novoUsuario.gerenciarSecretarias}
                                onChange={(e) => setNovoUsuario(p => ({ ...p, gerenciarSecretarias: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>🏢 Cadastrar e Editar Secretarias Municipais</span>
                            </label>

                            <label className="flex items-center gap-2.5 text-xs text-stone-700 font-semibold cursor-pointer py-1 hover:text-stone-900 sm:col-span-2 md:col-span-1">
                              <input
                                type="checkbox"
                                checked={novoUsuario.alterarCores}
                                onChange={(e) => setNovoUsuario(p => ({ ...p, alterarCores: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>⚙️ Alterar Cores e Customização Visual do Sistema</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <button
                        id="btn-register-new-user"
                        onClick={() => {
                          if (!novoUsuario.nome || !novoUsuario.email) {
                            alert("Preencha o nome e e-mail do funcionário.");
                            return;
                          }
                          const added: Usuario = {
                            id: usuarios.length + 1,
                            nome: novoUsuario.nome,
                            email: novoUsuario.email,
                            perfil: novoUsuario.perfil,
                            secretaria: novoUsuario.secretaria || "Ouvidoria",
                            ativo: true,
                            email_alternativo: novoUsuario.email_alternativo || "",
                            permissoes: {
                              visualizarRelatorios: novoUsuario.visualizarRelatorios,
                              responderChamados: novoUsuario.responderChamados,
                              gerenciarPublicidade: novoUsuario.gerenciarPublicidade,
                              gerenciarSecretarias: novoUsuario.gerenciarSecretarias,
                              alterarCores: novoUsuario.alterarCores
                            }
                          };
                          setUsuarios(p => [added, ...p]);
                          saveDocument("usuarios", added.email.toLowerCase(), added);
                          setNovoUsuario({ 
                            nome: "", 
                            email: "", 
                            perfil: "Ouvidoria", 
                            secretaria: "",
                            email_alternativo: "",
                            visualizarRelatorios: true,
                            responderChamados: true,
                            gerenciarPublicidade: false,
                            gerenciarSecretarias: false,
                            alterarCores: false
                          });
                        }}
                        className="bg-[#168821] hover:bg-green-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg cursor-pointer"
                      >
                        Registrar Credencial Oficial
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl p-4 md:p-6 border border-stone-200">
                      <h4 className="font-display font-extrabold text-stone-850 text-base mb-4">Funcionários Ativos</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-stone-150 rounded-lg overflow-hidden">
                          <thead className="bg-[#071D41] text-white">
                            <tr>
                              <th className="px-3 py-2.5 font-bold">Nome</th>
                              <th className="px-3 py-2.5 font-bold hidden sm:table-cell">E-mail</th>
                              <th className="px-3 py-2.5 font-bold">Perfil & funções autorizadas</th>
                              <th className="px-3 py-2.5 font-bold hidden xs:table-cell">Secretaria Associada</th>
                              <th className="px-3 py-2.5 font-bold text-center">Controles</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-stone-700">
                            {usuarios.map(u => (
                              <tr key={u.id} className="hover:bg-stone-50">
                                <td className="px-3 py-2.5 font-bold text-stone-900">{u.nome}</td>
                                <td className="px-3 py-2.5 font-mono hidden sm:table-cell text-left">
                                  <div className="font-bold text-stone-700">{u.email}</div>
                                  {u.email_alternativo ? (
                                    <div className="text-[10px] text-[#1351B4] font-semibold mt-0.5">Alt: {u.email_alternativo}</div>
                                  ) : (
                                    <div className="text-[10px] text-rose-550 font-semibold italic mt-0.5">Sem e-mail alternativo</div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-stone-800">{u.perfil}</span>
                                    {u.permissoes && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {u.permissoes.visualizarRelatorios && <span className="bg-blue-50 text-[#1351B4] text-[9px] px-1.5 py-0.5 rounded font-black border border-blue-100">📈 Relatórios</span>}
                                        {u.permissoes.responderChamados && <span className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded font-black border border-emerald-100">📋 Responder</span>}
                                        {u.permissoes.gerenciarPublicidade && <span className="bg-purple-50 text-purple-700 text-[9px] px-1.5 py-0.5 rounded font-black border border-purple-100">📢 Publicidade</span>}
                                        {u.permissoes.gerenciarSecretarias && <span className="bg-amber-50 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-black border border-amber-100">🏢 Secretarias</span>}
                                        {u.permissoes.alterarCores && <span className="bg-rose-50 text-rose-700 text-[9px] px-1.5 py-0.5 rounded font-black border border-rose-100">⚙️ Cores</span>}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-semibold text-stone-800 hidden xs:table-cell">{u.secretaria}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <button
                                    id={`btn-remove-usr-${u.id}`}
                                    onClick={() => {
                                      setUsuarios(p => p.filter(x => x.id !== u.id));
                                      deleteDocument("usuarios", u.email.toLowerCase());
                                    }}
                                    className="text-red-650 hover:text-red-800 font-bold cursor-pointer text-[11px]"
                                  >
                                    Remover
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: SEC CUSTOMIZER */}
                {dashboardTab === "secretarias" && isAuthorizedForAgentesEFuncoes(user) && (
                  <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-2xl p-5 md:p-6 border border-stone-200">
                      <h4 className="font-display font-extrabold text-[#071D41] text-base mb-4 flex items-center gap-1.5">
                        <Landmark className="w-5 h-5 text-[#1351B4]" /> Adicionar Nova Secretaria Municipal
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label htmlFor="sec-add-nome" className="block text-xs font-bold text-stone-600 mb-1">Nome da Secretaria *</label>
                          <input
                            id="sec-add-nome"
                            placeholder="Ex: Secretaria de Esportes"
                            value={novaSecretaria.nome}
                            onChange={(e) => setNovaSecretaria(p => ({ ...p, nome: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                          />
                        </div>

                        <div>
                          <label htmlFor="sec-add-email" className="block text-xs font-bold text-stone-600 mb-1">E-mail Oficial (@pref) *</label>
                          <input
                            id="sec-add-email"
                            placeholder="contato@pref.gov.br"
                            value={novaSecretaria.email}
                            onChange={(e) => setNovaSecretaria(p => ({ ...p, email: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                          />
                        </div>

                        <div>
                          <label htmlFor="sec-add-resp" className="block text-xs font-bold text-stone-600 mb-1">Secretário / Responsável *</label>
                          <input
                            id="sec-add-resp"
                            placeholder="Ex: Cláudio Souza"
                            value={novaSecretaria.responsavel}
                            onChange={(e) => setNovaSecretaria(p => ({ ...p, responsavel: e.target.value }))}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                          />
                        </div>
                      </div>

                      <div className="mb-5">
                        <label htmlFor="sec-add-funcoes" className="block text-xs font-bold text-stone-600 mb-1">Atribuições e Funções da Secretaria * <span className="font-normal text-stone-500">(Essencial para IA classificar e direcionar corretamente os chamados)</span></label>
                        <textarea
                          id="sec-add-funcoes"
                          placeholder="Ex: Responsável por gerenciar quadras esportivas municipais, campeonatos escolares, eventos esportivos e manutenção de playgrounds."
                          rows={2}
                          value={novaSecretaria.funcoes}
                          onChange={(e) => setNovaSecretaria(p => ({ ...p, funcoes: e.target.value }))}
                          className="w-full text-xs px-3.5 py-2 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none font-sans"
                        />
                      </div>

                      <button
                        id="btn-register-new-sec"
                        onClick={() => {
                          if (!novaSecretaria.nome || !novaSecretaria.email || !novaSecretaria.funcoes) {
                            alert("Por favor, preencha todos os campos obrigatórios (*), incluindo as Atribuições/Funções da secretaria.");
                            return;
                          }
                          const added: SecretariaItem = {
                            id: secretarias.length + 1,
                            nome: novaSecretaria.nome,
                            email: novaSecretaria.email,
                            responsavel: novaSecretaria.responsavel || "A definir",
                            funcoes: novaSecretaria.funcoes
                          };
                          setSecretarias(p => [...p, added]);
                          saveDocument("secretarias", String(added.id), added);
                          setNovaSecretaria({ nome: "", email: "", responsavel: "", funcoes: "" });
                        }}
                        className="bg-[#1351B4] hover:bg-blue-750 text-white font-bold text-xs py-2.5 px-6 rounded-lg cursor-pointer"
                      >
                        Salvar Secretaria
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl p-4 md:p-6 border border-stone-200">
                      <h4 className="font-display font-extrabold text-stone-850 text-base mb-4">Secretarias Ativas</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-stone-150 rounded-lg overflow-hidden">
                          <thead className="bg-[#071D41] text-white">
                            <tr>
                              <th className="px-3 py-2.5 font-bold hidden xs:table-cell">Id</th>
                              <th className="px-3 py-2.5 font-bold">Nome & Atribuições</th>
                              <th className="px-3 py-2.5 font-bold hidden sm:table-cell">E-mail de Contato</th>
                              <th className="px-3 py-2.5 font-bold hidden xs:table-cell">Secretário Competente</th>
                              <th className="px-3 py-2.5 font-bold text-center">Processamentos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-stone-700">
                            {secretarias.map(s => {
                              const loads = manifestacoes.filter(m => m.secretaria?.toLowerCase().trim() === s.nome?.toLowerCase().trim()).length;
                              return (
                                <tr key={s.id} className="hover:bg-stone-50">
                                  <td className="px-3 py-2.5 font-mono hidden xs:table-cell">{s.id}</td>
                                  <td className="px-3 py-2.5 max-w-sm">
                                    <div className="font-bold text-stone-900">{s.nome}</div>
                                    <div className="text-[10px] text-stone-500 font-medium leading-relaxed mt-1 bg-stone-50 border border-stone-150 p-1.5 rounded">
                                      <strong className="text-blue-750">Foco IA:</strong> {s.funcoes || "Não especificado"}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono hidden sm:table-cell">{s.email}</td>
                                  <td className="px-3 py-2.5 hidden xs:table-cell">{s.responsavel}</td>
                                  <td className="px-3 py-2.5 text-center font-bold text-[#1351B4]">{loads} chamados</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: MUNICIPAL REPORTS WORKFLOW */}
                {dashboardTab === "relatorios" && (() => {
                  const activeReportSec = reportSecretaria || (user?.perfil === "Secretaria" ? user?.secretaria : (secretarias[0]?.nome || "Infraestrutura"));
                  
                  // Filter manifestations for this specific secretariat
                  const filteredReportManifs = manifestacoes.filter(m => m.secretaria?.toLowerCase().trim() === activeReportSec?.toLowerCase().trim());
                  
                  const reportTotal = filteredReportManifs.length;
                  const reportLidas = filteredReportManifs.filter(m => m.status !== "Pendente").length;
                  const reportResolvidas = filteredReportManifs.filter(m => m.status === "Resolvido").length;
                  const reportPendentes = filteredReportManifs.filter(m => m.status === "Pendente" || m.status === "Urgente").length;

                  // Find available public servants for this secretariat
                  const servidoresDisponiveis = usuarios.filter(u => u.secretaria?.toLowerCase().trim() === activeReportSec?.toLowerCase().trim());

                  return (
                    <div className="bg-white rounded-2xl p-5 md:p-6 border border-stone-200 animate-fade-in">
                      <div className="pb-4 border-b mb-6">
                        <h4 className="font-display font-extrabold text-[#071D41] text-base flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-600" /> Relatório Executivo de Resolução e Diligência
                        </h4>
                        <p className="text-stone-500 text-xs">
                          Gere e visualize o relatório mensal, determine o encarregado pela diligência e acompanhe as métricas de conclusão de chamados.
                        </p>
                      </div>

                      {/* Selection of respective secretariats if admin or ouvidoria */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 bg-stone-50 p-4 md:p-5 rounded-xl border border-stone-200">
                        <div>
                          <label className="block text-xs font-black text-stone-750 mb-1.5">Secretaria Municipal Requerida</label>
                          {user?.perfil === "Secretaria" ? (
                            <div className="px-3.5 py-2.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-[#071D41]">
                              🏛️ {user.secretaria}
                            </div>
                          ) : (
                            <select
                              id="report-sec-select"
                              value={activeReportSec}
                              onChange={(e) => {
                                setReportSecretaria(e.target.value);
                                setDiligenciadoName("");
                              }}
                              className="w-full text-xs px-3.5 py-2.5 border rounded-lg bg-white outline-none font-bold cursor-pointer text-[#071D41]"
                            >
                              {secretarias.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                            </select>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-black text-stone-750 mb-1.5">Para quem encaminhou a diligência de resolver?</label>
                          <div className="flex flex-col gap-1.5">
                            {servidoresDisponiveis.length > 0 ? (
                              <select
                                id="report-serv-select"
                                value={diligenciadoName}
                                onChange={(e) => setDiligenciadoName(e.target.value)}
                                className="w-full text-xs px-3.5 py-2.5 border rounded-lg bg-white outline-none font-semibold cursor-pointer"
                              >
                                <option value="">Selecione um servidor desta secretaria...</option>
                                {servidoresDisponiveis.map(u => (
                                  <option key={u.id} value={u.nome}>{u.nome} ({u.email})</option>
                                ))}
                                <option value="Outro">Outro (Digitar Nome customizado)...</option>
                              </select>
                            ) : null}

                            {(servidoresDisponiveis.length === 0 || diligenciadoName === "Outro") && (
                              <input
                                id="report-serv-input-custom"
                                type="text"
                                placeholder="Nome do responsável pela diligência técnica..."
                                value={customDiligenciadoName}
                                onChange={(e) => setCustomDiligenciadoName(e.target.value)}
                                className="w-full text-xs px-3.5 py-2.5 border bg-white rounded-lg outline-none font-medium text-stone-800"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Small Quick View metrics cards in tab */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        <div className="p-4 border rounded-xl bg-blue-50/50 text-center">
                          <span className="text-[10px] text-stone-500 font-bold block uppercase mb-1">Total Recebido</span>
                          <span className="text-xl font-black text-[#1351B4] block">{reportTotal} chamados</span>
                          <span className="text-[9px] text-stone-400 font-medium block mt-1">Este escopo / mês</span>
                        </div>
                        <div className="p-4 border rounded-xl bg-orange-50/50 text-center">
                          <span className="text-[10px] text-stone-500 font-bold block uppercase mb-1">Encaminhados / Lidos</span>
                          <span className="text-xl font-black text-amber-700 block">{reportLidas} chamados</span>
                          <span className="text-[9px] text-stone-400 font-medium block mt-1">Taxa: {reportTotal ? Math.round((reportLidas / reportTotal) * 100) : 0}%</span>
                        </div>
                        <div className="p-4 border rounded-xl bg-emerald-50/50 text-center">
                          <span className="text-[10px] text-stone-500 font-bold block uppercase mb-1">Resolvidos</span>
                          <span className="text-xl font-black text-emerald-700 block">{reportResolvidas} chamados</span>
                          <span className="text-[9px] text-stone-400 font-medium block mt-1">Concluídos municipais</span>
                        </div>
                        <div className="p-4 border rounded-xl bg-red-50/50 text-center">
                          <span className="text-[10px] text-stone-500 font-bold block uppercase mb-1">Pendentes</span>
                          <span className="text-xl font-black text-red-650 block">{reportPendentes} chamados</span>
                          <span className="text-[9px] text-stone-400 font-medium block mt-1">Aguardando atendimento</span>
                        </div>
                      </div>

                      {/* Live Data Visualisation charts using 'recharts' */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* CHART 1: Volume can be filtered by secretariat */}
                        <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/30 shadow-xs flex flex-col gap-4">
                          <div className="border-b pb-2">
                            <h5 className="font-display font-extrabold text-[#071D41] text-xs uppercase tracking-wider">
                              📊 Distribuição de Demandas por Secretaria
                            </h5>
                            <p className="text-[10px] text-stone-500 font-medium mt-0.5">
                              Totais absolutos divididos pelas pastas municipais
                            </p>
                          </div>
                          {(() => {
                            const counts: Record<string, number> = {};
                            manifestacoesParaUsuario.forEach(m => {
                              const s = m.secretaria || "Não informada";
                              counts[s] = (counts[s] || 0) + 1;
                            });
                            const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

                            if (data.length === 0) {
                              return (
                                <div className="h-60 flex items-center justify-center text-xs font-bold text-stone-400">
                                  Nenhum registro no banco de dados para ilustrar.
                                </div>
                              );
                            }

                            return (
                              <div className="w-full h-60">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={data} margin={{ top: 12, right: 10, left: -26, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F9" vertical={false} />
                                    <XAxis 
                                      dataKey="name" 
                                      tick={{ fontSize: 9, fontWeight: "bold", fill: "#52525B" }}
                                      axisLine={{ stroke: "#E4E4E7" }} 
                                    />
                                    <YAxis 
                                      allowDecimals={false} 
                                      tick={{ fontSize: 9, fontWeight: "bold", fill: "#52525B" }}
                                      axisLine={{ stroke: "#E4E4E7" }} 
                                    />
                                    <Tooltip 
                                      contentStyle={{ fontSize: "11px", borderRadius: "10px", border: "1px solid #E2E8F0", fontWeight: "bold" }} 
                                    />
                                    <Bar dataKey="value" fill="#1351B4" radius={[4, 4, 0, 0]}>
                                      {(() => {
                                        const chartColors = ["#071D41", "#1351B4", "#168821", "#FFCD07", "#2670E8", "#E52207", "#888888"];
                                        return data.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length] || "#1351B4"} />
                                        ));
                                      })()}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()}
                        </div>

                        {/* CHART 2: Volume by Operational Status */}
                        <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/30 shadow-xs flex flex-col gap-4">
                          <div className="border-b pb-2">
                            <h5 className="font-display font-extrabold text-[#071D41] text-xs uppercase tracking-wider">
                              🔄 Volume por Status Operacional
                            </h5>
                            <p className="text-[10px] text-stone-500 font-medium mt-0.5">
                              Percentual e quantidades consolidadas na Ouvidoria
                            </p>
                          </div>
                          {(() => {
                            const counts: Record<string, number> = {};
                            manifestacoesParaUsuario.forEach(m => {
                              const s = m.status || "Pendente";
                              counts[s] = (counts[s] || 0) + 1;
                            });
                            const data = Object.entries(counts).map(([name, value]) => {
                              let color = "#D97706";
                              if (name === "Em Andamento") color = "#2563EB";
                              if (name === "Resolvido") color = "#059669";
                              if (name === "Urgente") color = "#DC2626";
                              return { name, value, color };
                            });

                            if (data.length === 0) {
                              return (
                                <div className="h-60 flex items-center justify-center text-xs font-bold text-stone-400">
                                  Sem chamados ativos para análise.
                                </div>
                              );
                            }

                            return (
                              <div className="w-full h-60">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={data}
                                      cx="50%"
                                      cy="47%"
                                      innerRadius={50}
                                      outerRadius={80}
                                      paddingAngle={4}
                                      dataKey="value"
                                    >
                                      {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip 
                                      contentStyle={{ fontSize: "11px", borderRadius: "10px", border: "1px solid #E2E8F0", fontWeight: "bold" }} 
                                    />
                                    <Legend 
                                      verticalAlign="bottom" 
                                      height={36} 
                                      iconType="circle"
                                      wrapperStyle={{ fontSize: "9px", fontWeight: "bold" }}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 pt-4 border-t">
                        <button
                          id="btn-trigger-preview-report"
                          onClick={() => {
                            const finalName = diligenciadoName === "Outro" || !diligenciadoName ? customDiligenciadoName : diligenciadoName;
                            if (!finalName.trim()) {
                              alert("Antes de exportar ou encaminhar, por favor determine o encarregado responsável pela diligência de resolver no formulário acima.");
                              return;
                            }
                            setShowReportPreview(true);
                          }}
                          className="py-3 px-5 text-xs font-black text-white bg-[#1351B4] hover:brightness-110 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-98"
                        >
                          <FileText className="w-4 h-4" /> Visualizar Relatório de Desempenho antes de Enviar
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* TAB CONTENT: EMAIL DISPATCH LOG MODULE */}
                {dashboardTab === "notificacoes" && (
                  <div className="bg-white rounded-2xl p-5 md:p-6 border border-stone-200 animate-fade-in">
                    <div className="pb-4 border-b mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-display font-extrabold text-[#071D41] text-base flex items-center gap-2">
                          <Mail className="w-5 h-5 text-indigo-600" /> Servidor de E-mails Enviados (logs simulados)
                        </h4>
                        <p className="text-stone-500 text-xs">
                          Relatório de transparência de alertas automáticos encaminhados para a caixa de e-mail dos cidadãos conforme a mudança de status.
                        </p>
                      </div>
                      {emailLogs.length > 0 && (
                        <button
                          id="btn-clear-email-logs"
                          onClick={() => {
                            if (window.confirm("Deseja realmente limpar todos os logs de envio de e-mails simulados?")) {
                              setEmailLogs([]);
                            }
                          }}
                          className="text-[11px] font-bold text-red-650 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 self-start sm:self-auto cursor-pointer"
                        >
                          Limpar Histórico
                        </button>
                      )}
                    </div>

                    {emailLogs.length === 0 ? (
                      <div className="text-center py-10 px-4 border border-dashed border-stone-200 rounded-2xl">
                        <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Mail className="w-5 h-5 text-stone-400" />
                        </div>
                        <h5 className="font-bold text-[#071D41] text-xs uppercase mb-1">Nenhum Alerte de E-mail Enviado</h5>
                        <p className="text-stone-500 text-[11px] max-w-sm mx-auto leading-relaxed">
                          Para simular o disparo automático do e-mail, mude de aba para <strong className="text-stone-700">"📋 Chamados"</strong>, selecione qualquer protocolo pendente e <strong className="text-stone-700">altere o status operacional</strong> dele (Ex: Em Andamento ou Resolvido).
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="bg-[#1351B4]/5 border border-[#1351B4]/20 p-4 rounded-xl flex items-start gap-2.5 mb-2">
                          <Bell className="w-4 h-4 text-[#1351B4] shrink-0 mt-0.5" />
                          <p className="text-[11px] text-[#071D41] leading-relaxed">
                            <strong>Simulação de SMTP ativa:</strong> Cada log abaixo representa uma transação de e-mail realizada em tempo real. O cidadão recebe uma cópia idêntica da notificação diretamente na sua caixa postal fictícia.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-1">
                          {emailLogs.map((log) => (
                            <div 
                              key={log.id} 
                              className="p-4 border border-stone-200 rounded-xl hover:border-stone-300 bg-stone-50/50 hover:bg-white transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 bg-[#1351B4]/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                                  <Mail className="w-4 h-4 text-[#1351B4]" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <span className="text-[11px] font-bold text-stone-850 truncate max-w-[200px] sm:max-w-xs">{log.destinatario}</span>
                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-stone-200 text-stone-700 rounded-md">Protocolo #{log.protocolo}</span>
                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">STATUS: ENVIADO ✓</span>
                                  </div>
                                  <p className="text-xs font-black text-[#071D41] truncate leading-tight mb-1">{log.assunto}</p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-semibold font-mono">
                                    <span>Transição:</span>
                                    <span className="line-through text-stone-400">{log.statusAntigo}</span>
                                    <span className="text-stone-700">➔ {log.statusNovo}</span>
                                    <span className="mx-1">•</span>
                                    <span>{new Date(log.timestamp).toLocaleDateString('pt-BR')} às {new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                id={`btn-view-mail-${log.id}`}
                                onClick={() => setSelectedEmailForModal(log)}
                                className="text-xs font-black text-[#1351B4] hover:bg-stone-100 py-2 px-3 border border-stone-200 rounded-lg whitespace-nowrap self-stretch md:self-auto text-center cursor-pointer transition-colors"
                              >
                                Visualizar Mensagem
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT: ADVERTISEMENT MANAGER */}
                {dashboardTab === "propaganda" && (user?.perfil === "admin" || user?.permissoes?.gerenciarPublicidade) && (
                  <div className="bg-white rounded-2xl p-5 md:p-6 border border-stone-200 animate-fade-in flex flex-col gap-6">
                    <div>
                      <h4 className="font-display font-extrabold text-[#071D41] text-base mb-1.5 flex items-center gap-2">
                        📢 Portal de Gestão de Campanhas & Anúncios Oficiais
                      </h4>
                      <p className="text-stone-500 text-xs">
                        Insira, ative/desative ou exclua propagandas e campanhas públicas para exibição imediata em todas as telas da Ouvidoria.
                      </p>
                    </div>

                    {/* Add Advertisement Form */}
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                      <h5 className="font-semibold text-stone-850 text-xs mb-3">Adicionar Novo Anúncio Publicitário</h5>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1 col-span-1 md:col-span-2">
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500">Título / Texto da Campanha *</label>
                          <input
                            type="text"
                            value={novaPropaganda.titulo}
                            onChange={(e) => setNovaPropaganda(p => ({ ...p, titulo: e.target.value }))}
                            placeholder="Vacinação contra Sarampo neste Sábado!"
                            className="bg-white border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500">Imagem de Destaque (URL)</label>
                          <input
                            type="text"
                            value={novaPropaganda.imagem}
                            onChange={(e) => setNovaPropaganda(p => ({ ...p, imagem: e.target.value }))}
                            placeholder="https://images.unsplash.com/..."
                            className="bg-white border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500">Link de Ação</label>
                          <input
                            type="text"
                            value={novaPropaganda.link}
                            onChange={(e) => setNovaPropaganda(p => ({ ...p, link: e.target.value }))}
                            placeholder="https://saude.pref.gov"
                            className="bg-white border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500">Tela de Destino / Exibição Individual *</label>
                          <select
                            value={novaPropaganda.telaDestino}
                            onChange={(e) => setNovaPropaganda(p => ({ ...p, telaDestino: e.target.value }))}
                            className="bg-white border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-600 font-bold text-stone-700"
                          >
                            <option value="todas">Qualquer Tela / Exibir em Todas</option>
                            <option value="inicio">Página Inicial / Início (Ouvidoria Geral)</option>
                            <option value="abrir">Nova Manifestação (Abertura de Chamado)</option>
                            <option value="consultar">Consultar Protocolo (Rastreamento)</option>
                            <option value="admin">Painel Administrativo de Ouvidoria</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-1">
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500">Posição de Exibição *</label>
                          <select
                            value={novaPropaganda.posicao}
                            onChange={(e) => setNovaPropaganda(p => ({ ...p, posicao: e.target.value }))}
                            className="bg-white border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-600 font-bold text-stone-700"
                          >
                            <option value="ambas">↕️ Ambos (Superior e Inferior)</option>
                            <option value="superior">⬆️ Apenas Parte Superior</option>
                            <option value="inferior">⬇️ Apenas Parte Inferior</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-1">
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500">Texto do Botão (Ação) *</label>
                          <input
                            type="text"
                            value={novaPropaganda.textoBotao}
                            onChange={(e) => setNovaPropaganda(p => ({ ...p, textoBotao: e.target.value }))}
                            placeholder="Ex: Saiba mais, Ver Postos, Regulamento..."
                            className="bg-white border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-4">
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500">Notícia Completa / Conteúdo Informativo Detalhado *</label>
                          <textarea
                            value={novaPropaganda.noticiaCompleta}
                            onChange={(e) => setNovaPropaganda(p => ({ ...p, noticiaCompleta: e.target.value }))}
                            placeholder="Escreva os detalhes e informações completas desta campanha pública de utilidade que serão abertas ao clicar em saiba mais... Dica: Você pode digitar [Cidade] ou [Município] para referenciar dinamicamente a cidade do cabeçalho."
                            rows={3}
                            className="bg-white border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!novaPropaganda.titulo.trim()) {
                            alert("Por favor, preencha o Título do Anúncio.");
                            return;
                          }
                          const newAdItem = {
                            id: Date.now(),
                            titulo: novaPropaganda.titulo,
                            link: novaPropaganda.link || "#",
                            imagem: novaPropaganda.imagem || "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?q=80&w=600&auto=format&fit=crop",
                            ativa: true,
                            telaDestino: novaPropaganda.telaDestino || "todas",
                            posicao: novaPropaganda.posicao as "superior" | "inferior" | "ambas" || "ambas",
                            noticiaCompleta: novaPropaganda.noticiaCompleta || "",
                            textoBotao: novaPropaganda.textoBotao || "Saiba mais"
                          };
                          setPropagandas(p => [newAdItem, ...p]);
                          saveDocument("propagandas", String(newAdItem.id), newAdItem);
                          setNovaPropaganda({ titulo: "", link: "", imagem: "", telaDestino: "todas", posicao: "ambas", noticiaCompleta: "", textoBotao: "Saiba mais" });
                          
                          const posFormatted = 
                            newAdItem.posicao === "ambas" ? "Ambas as Posições (Superior + Inferior)" :
                            newAdItem.posicao === "superior" ? "Parte Superior (Topo)" :
                            "Parte Inferior (Rodapé)";

                          const destFormatted = 
                            newAdItem.telaDestino === "todas" ? "Todas as Telas" : 
                            newAdItem.telaDestino === "inicio" ? "Página Inicial" : 
                            newAdItem.telaDestino === "abrir" ? "Abertura de Chamado" : 
                            newAdItem.telaDestino === "consultar" ? "Consulta de Chamado" : 
                            "Painel Admin";

                          alert(`Anúncio publicado com sucesso!\n📍 Tela: ${destFormatted}\n↕️ Posição: ${posFormatted}`);
                        }}
                        className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg select-none transition-colors cursor-pointer"
                      >
                        Publicar Anúncio Direcionado
                      </button>
                    </div>

                    {/* List Existing Ads */}
                    <div className="flex flex-col gap-3">
                      <span className="text-xs font-black text-stone-700">Anúncios Ativos e Históricos ({propagandas.length})</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {propagandas.map((ad) => (
                          <div key={ad.id} className="border rounded-xl p-3.5 bg-white shadow-xs flex gap-3 items-start justify-between">
                            <div className="flex gap-3 items-center min-w-0">
                              <img src={ad.imagem} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0 border border-stone-200" referrerPolicy="no-referrer" />
                              <div className="flex flex-col gap-1.5 min-w-0">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block w-fit ${ad.ativa ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
                                    {ad.ativa ? "Ativo" : "Inativo"}
                                  </span>
                                  <span className="text-[9px] font-extrabold text-[#1351B4] bg-[#1351B4]/5 border border-[#1351B4]/10 px-2 py-0.5 rounded-full w-fit">
                                    📍 {ad.telaDestino === "todas" ? "Todas as Telas" : 
                                        ad.telaDestino === "inicio" ? "Página Inicial" : 
                                        ad.telaDestino === "abrir" ? "Nova Manifestação" : 
                                        ad.telaDestino === "consultar" ? "Consultar Protocolo" : 
                                        ad.telaDestino === "admin" ? "Painel Admin" : "Todas as Telas"}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-stone-850 leading-snug truncate max-w-[200px]" title={formatAdText(ad.titulo)}>{formatAdText(ad.titulo)}</p>
                                <div className="text-[10px] text-stone-650 font-semibold truncate max-w-[200px]">
                                  <strong>Botão:</strong> "{formatAdText(ad.textoBotao || "Saiba mais")}"
                                </div>
                                {ad.noticiaCompleta && (
                                  <p className="text-[10px] text-stone-500 truncate max-w-[200px] leading-relaxed" title={formatAdText(ad.noticiaCompleta)}>
                                    <strong>Detalhes:</strong> {formatAdText(ad.noticiaCompleta)}
                                  </p>
                                )}
                                <a href={ad.link} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline transition-all block max-w-[180px] truncate">{ad.link}</a>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5 justify-end shrink-0">
                              <button
                                onClick={() => {
                                  const updatedAd = { ...ad, ativa: !ad.ativa };
                                  setPropagandas(p => p.map(x => x.id === ad.id ? updatedAd : x));
                                  saveDocument("propagandas", String(ad.id), updatedAd);
                                }}
                                className={`text-[10px] font-black px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-center ${ad.ativa ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"}`}
                              >
                                {ad.ativa ? "Desativar" : "Ativar"}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm("Deseja realmente remover este anúncio publicitário?")) {
                                    setPropagandas(p => p.filter(x => x.id !== ad.id));
                                    deleteDocument("propagandas", String(ad.id));
                                  }
                                }}
                                className="text-[10px] font-black bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-center"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: APPLICATION CUSTOMIZATION (ONLY ADMIN) */}
                {dashboardTab === "configuracoes" && (user?.perfil === "admin" || user?.permissoes?.alterarCores) && (
                  <div className="bg-white rounded-2xl p-5 md:p-6 border border-stone-200 animate-fade-in divide-y divide-stone-100">
                    <div className="pb-5">
                      <h4 className="font-display font-extrabold text-[#071D41] text-base mb-2 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-amber-500" /> Configuração Visual do Sistema
                      </h4>
                      <p className="text-stone-500 text-xs">
                        Defina o nome da cidade, sigla de identificação e as cores institucionais do portal de Ouvidoria Inteligente.
                      </p>
                    </div>

                    <div className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-4">
                        <div>
                          <label htmlFor="adm-municipio" className="block text-xs font-bold text-stone-600 mb-1">Nome do Município (Exibição no Cabeçalho)</label>
                          <input
                            id="adm-municipio"
                            type="text"
                            value={municipio}
                            onChange={(e) => setMunicipio(e.target.value)}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                            placeholder="Ex: Prefeitura de São Exemplo"
                          />
                        </div>

                        <div>
                          <label htmlFor="adm-sigla" className="block text-xs font-bold text-stone-600 mb-1">Sigla do Estado</label>
                          <input
                            id="adm-sigla"
                            type="text"
                            maxLength={3}
                            value={logoText}
                            onChange={(e) => setLogoText(e.target.value.toUpperCase())}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none font-mono"
                            placeholder="Ex: SP"
                          />
                        </div>

                        <div>
                          <label htmlFor="adm-logo-url" className="block text-xs font-bold text-stone-600 mb-1">Imagem da Logomarca (Cabeçalho)</label>
                          <div className="flex flex-col gap-2">
                            <input
                              id="adm-logo-url"
                              type="text"
                              value={logoImageUrl}
                              onChange={(e) => setLogoImageUrl(e.target.value)}
                              className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none text-left"
                              placeholder="URL ou Base64 (Ex: https://...)"
                            />
                            <div className="flex items-center gap-2">
                              <label 
                                htmlFor="adm-logo-file-upload"
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-stone-100/80 hover:bg-stone-200/90 text-stone-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-stone-300 shadow-xs shrink-0 select-none"
                              >
                                <Upload className="w-3.5 h-3.5 text-stone-600" />
                                <span>Anexar Foto ou Imagem</span>
                              </label>
                              <input 
                                id="adm-logo-file-upload" 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      if (typeof reader.result === "string") {
                                        setLogoImageUrl(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              {logoImageUrl && logoImageUrl.startsWith("data:image/") && (
                                <button
                                  type="button"
                                  onClick={() => setLogoImageUrl("https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?q=80&w=150&auto=format&fit=crop")}
                                  className="text-red-650 hover:underline text-[11px] font-black cursor-pointer ml-auto"
                                >
                                  Restaurar Padrão
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="adm-programa" className="block text-xs font-bold text-stone-600 mb-1">Nome do Programa de IA</label>
                          <input
                            id="adm-programa"
                            type="text"
                            value={programName}
                            onChange={(e) => setProgramName(e.target.value)}
                            className="w-full text-xs px-3.5 py-2.5 border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none"
                            placeholder="Ex: OuviCidade IA — Ouvidoria Municipal Inteligente"
                          />
                        </div>
                      </div>

                      <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                        <label className="block text-xs font-bold text-stone-700 mb-2">Selecione a Cor Geral do Tema</label>
                        <p className="text-[11px] text-stone-500 mb-4 leading-relaxed">
                          Ao alterar a cor do tema, o menu, os botões, links e destaques visuais do sistema serão atualizados instantaneamente.
                        </p>
                        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 pb-2">
                          {[
                            { name: "Azul Oficial", hex: "#071D41" },
                            { name: "Azul Royal", hex: "#1351B4" },
                            { name: "Verde Governo", hex: "#168821" },
                            { name: "Vinho Real", hex: "#880000" },
                            { name: "Vermelho Urgência", hex: "#E52207" },
                            { name: "Roxo Imperial", hex: "#4A148C" },
                            { name: "Preto Nobre", hex: "#263238" },
                            { name: "Laranja Alerta", hex: "#E65100" },
                          ].map((color) => {
                            const isSelected = headerColor === color.hex;
                            return (
                              <button
                                key={color.hex}
                                id={`set-color-${color.hex}`}
                                onClick={() => setHeaderColor(color.hex)}
                                className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                                  isSelected 
                                    ? "bg-white border-stone-900 shadow-md ring-2 ring-stone-900/10 scale-102" 
                                    : "bg-white hover:bg-stone-50 border-stone-200"
                                }`}
                              >
                                <span 
                                  className="w-4 h-4 rounded-full block border border-black/10" 
                                  style={{ backgroundColor: color.hex }}
                                />
                                <span className="text-[9.5px] tracking-tight">{color.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* OVERLAY COMPONENT DETAILED MODAL */}
      {selectedManif && (
        <div 
          onClick={() => setSelectedManif(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
          >
            {/* Header detail */}
            <div className="p-5 text-white bg-[#071D41] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-md">🏛️</span>
                <h3 className="font-display font-extrabold text-sm md:text-base leading-none">
                  Controle Chamado #{selectedManif.protocolo}
                </h3>
              </div>
              <button 
                id="btn-close-manif-detail"
                onClick={() => setSelectedManif(null)} 
                className="text-white hover:text-[#FFCD07] font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {(selectedManif.autor_ocupacao === "Vereador" || selectedManif.destacado) && (
                <div id="alerta-diferenciado-modal-manif" className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-2 border-amber-400 rounded-xl p-4.5 flex gap-3.5 text-amber-950 items-start shadow-xs animate-shake">
                  <span className="text-2xl shrink-0">🏛️</span>
                  <div>
                    <h4 className="text-[11px] font-black text-amber-900 uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1">
                      <span>🚨</span> ALERTA DIFERENCIADO • PRIORIDADE PARLAMENTAR
                    </h4>
                    <p className="text-[10.5px] leading-relaxed text-amber-900 font-bold">
                      Este chamado foi registrado pelo(a) Vereador(a) <strong className="underline decoration-amber-500 decoration-2">{selectedManif.autor_nome || "Mariana Silva"}</strong>. A Prefeitura e a Ouvidoria Municipal priorizam e destacam este canal de acompanhamento.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-stone-50 rounded-xl p-3 border">
                  <span className="text-[10px] text-stone-500 font-bold block uppercase">Tipo registrado</span>
                  <span className="text-xs font-extrabold text-stone-800 block mt-1">{selectedManif.tipo}</span>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 border">
                  <span className="text-[10px] text-stone-500 font-bold block uppercase">Categoria IA</span>
                  <span className="text-xs font-extrabold text-stone-800 block mt-1">{selectedManif.ia_categoria}</span>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 border">
                  <span className="text-[10px] text-stone-500 font-bold block uppercase">Prioridade</span>
                  <span className="text-xs font-extrabold text-stone-800 block mt-1">{selectedManif.prioridade}</span>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 border">
                  <span className="text-[10px] text-stone-500 font-bold block uppercase">Bairro</span>
                  <span className="text-xs font-extrabold text-stone-800 block mt-1">{selectedManif.bairro}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-stone-500 font-bold block uppercase mb-1">Descrição fornecida:</span>
                <p className="text-xs text-stone-800 leading-relaxed font-sans bg-stone-50 p-3 rounded-lg border border-stone-200">
                  {selectedManif.descricao}
                </p>
              </div>

              {selectedManif.resposta_ia && (
                <div>
                  <span className="text-[10px] text-stone-500 font-bold block uppercase mb-1">Resposta Inicial da IA:</span>
                  <p className="text-xs text-[#071D41] italic leading-relaxed font-sans bg-blue-50/50 p-3 rounded-lg border border-blue-200">
                    "{selectedManif.resposta_ia}"
                  </p>
                </div>
              )}

              {selectedManif.despacho && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mt-3 animate-fade-in shadow-xs text-stone-800">
                  <span className="text-[10px] text-amber-850 font-black uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    📜 Despacho de Gabinete Ativo e Homologado
                  </span>
                  <p className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-white border border-amber-100 p-2.5 rounded-lg">
                    {selectedManif.despacho}
                  </p>
                  {selectedManif.despacho_autor && (
                    <div className="text-[10px] text-stone-500 font-extrabold block mt-2 text-right">
                      ✍️ Autenticado por: <span className="text-[#071D41]">{selectedManif.despacho_autor}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Administrative status changing triggers */}
              <div className="border-t pt-4">
                <span className="text-[10.5px] text-stone-500 font-bold block uppercase mb-2">Alternar Status Governamental</span>
                <div className="flex flex-wrap gap-2">
                  {["Pendente", "Em Andamento", "Resolvido", "Urgente"].map((st) => (
                    <button
                      id={`btn-change-status-${st}`}
                      key={st}
                      onClick={() => {
                        triggerSimulatedEmail(selectedManif, selectedManif.status, st);
                        const updatedM = { ...selectedManif, status: st };
                        setManifestacoes(prev => prev.map(m => m.id === selectedManif.id ? updatedM : m));
                        saveDocument("manifestacoes", selectedManif.protocolo, updatedM);
                        setSelectedManif(null);
                      }}
                      className={`text-[10.5px] font-black px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                        selectedManif.status === st 
                          ? "bg-[#1351B4] text-white border-[#1351B4]" 
                          : "bg-white text-stone-700 hover:bg-stone-50 border-stone-200"
                      }`}
                    >
                      → {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Painel de Despacho e Atribuição de Competências */}
              <div className="border-t pt-4">
                <span className="text-[11px] text-[#071D41] font-black block uppercase mb-1 flex items-center gap-1.5">
                  💼 Despacho de Gabinete e Distribuição de Competências
                </span>
                <p className="text-[10.5px] text-stone-500 mb-3 leading-normal">
                  Como autoridade administrativa, delegue responsabilidades, designe encarregados ou encaminhe para pareceres formais em outras esferas municipais.
                </p>

                {/* Custom Despacho Editor with AI Assistance */}
                {user && user.perfil !== "cidadao" ? (
                  <div className="bg-amber-50/10 border border-stone-250 rounded-xl p-3.5 mb-4 animate-fade-in shadow-xs">
                    <span className="text-[10px] text-stone-700 font-extrabold uppercase block mb-1.5 flex items-center gap-1">
                      ✍️ Redigir Despacho Ordinário de Gabinete
                    </span>
                    <p className="text-[10px] text-stone-500 mb-2 leading-relaxed">
                      Insira o teor formal da decisão administrativa. A Inteligência Artificial pode sugerir um despacho sob medida para este chamado ou lapidar seu rascunho de forma oficial.
                    </p>

                    <div className="relative">
                      <textarea
                        value={despachoText}
                        onChange={(e) => setDespachoText(e.target.value)}
                        placeholder="Ex: Determino que a Secretaria de Infraestrutura envie uma equipe técnica no local indicado para execução dos reparos em caráter de urgência..."
                        rows={5}
                        className="w-full text-xs px-2.5 py-2 bg-white border border-stone-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-all text-stone-850 font-mono"
                        disabled={isGeneratingDespacho}
                      />
                      {isGeneratingDespacho && (
                        <div className="absolute inset-0 bg-white/75 flex flex-col items-center justify-center rounded-lg animate-fade-in">
                          <span className="w-5 h-5 border-2 border-[#1351B4] border-t-transparent rounded-full animate-spin mb-1"></span>
                          <span className="text-[9px] text-[#1351B4] font-black uppercase tracking-wider">Ajustando teor com IA...</span>
                        </div>
                      )}
                    </div>

                    {/* AI Assistance Control Actions */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleAIDespachoAction("suggest")}
                        disabled={isGeneratingDespacho}
                        className="flex items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-black py-1.5 px-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-50"
                        title="A IA analisará a descrição do chamado para redigir uma sugestão de despacho específica para o seu cargo."
                      >
                        ✨ Sugerir com IA
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleAIDespachoAction("improve")}
                        disabled={isGeneratingDespacho || !despachoText.trim()}
                        className="flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#1351B4] text-[10px] font-black py-1.5 px-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="A IA reescreverá o texto que você inseriu acima, tornando-o extremamente formal e gramaticalmente polido."
                      >
                        🪄 Polir com IA
                      </button>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const updatedM = {
                            ...selectedManif,
                            despacho: despachoText.trim(),
                            despacho_autor: `${user?.nome || "Agente Público"} (${user?.ocupacao || user?.perfil || "Servidor"})`
                          };
                          setManifestacoes(prev => prev.map(m => m.id === selectedManif.id ? updatedM : m));
                          setSelectedManif(prev => prev ? {
                            ...prev,
                            despacho: despachoText.trim(),
                            despacho_autor: `${user?.nome || "Agente Público"} (${user?.ocupacao || user?.perfil || "Servidor"})`
                          } : null);
                          saveDocument("manifestacoes", selectedManif.protocolo, updatedM);
                          triggerDispatchSimulatedEmail(updatedM, despachoText.trim());
                          alert("Despacho oficial de gabinete homologado e registrado com sucesso. Foi enviada uma cópia comprobatória ao seu e-mail alternativo e uma notificação direta ao e-mail alternativo do responsável delegado.");
                        }}
                        disabled={!despachoText.trim() || isGeneratingDespacho}
                        className="bg-[#1351B4] hover:bg-[#114093] disabled:bg-stone-100 text-white disabled:text-stone-400 font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed border border-blue-700 disabled:border-stone-200 animate-fade-in"
                      >
                        💾 Homologar Despacho no Protocolo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 mb-4 text-[10.5px] text-stone-500 font-bold text-center">
                    🔒 O registro de despachos oficiais restringe-se a agentes públicos identificados.
                  </div>
                )}

                {/* Status de Atribuição Atual */}
                {selectedManif.responsavel_nome ? (
                  <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-3 mb-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl leading-none">🟢</span>
                      <div>
                        <span className="text-[10px] text-emerald-800 font-extrabold uppercase block leading-none mb-1">Diligência Ativa Destinada</span>
                        <span className="text-xs font-black text-stone-800 block">
                          {selectedManif.responsavel_nome} ({selectedManif.responsavel_cargo})
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono block">{selectedManif.responsavel_email}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const updatedM = {
                          ...selectedManif,
                          responsavel_nome: "",
                          responsavel_cargo: "",
                          responsavel_email: ""
                        };
                        setManifestacoes(prev => prev.map(m => m.id === selectedManif.id ? updatedM : m));
                        setSelectedManif(prev => prev ? { ...prev, responsavel_nome: undefined, responsavel_cargo: undefined, responsavel_email: undefined } : null);
                        saveDocument("manifestacoes", selectedManif.protocolo, updatedM);
                        alert("Atribuição de responsabilidade revogada com sucesso.");
                      }}
                      className="text-[9px] font-black text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-red-200"
                    >
                      Remover Atribuição
                    </button>
                  </div>
                ) : (
                  <div className="bg-stone-50 border border-stone-200 border-dashed rounded-xl p-3 text-center mb-4 text-[10.5px] text-stone-500 font-bold">
                    ⚠️ Nenhum agente público responsável designado para este chamado atualmente.
                  </div>
                )}

                {/* Filtro de Perfis / Atribuições */}
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-150 mb-4 flex flex-col gap-3">
                  <div>
                    <span className="text-[9.5px] text-stone-500 font-extrabold uppercase block mb-1.5">1. Selecione o Cargo Regulamentar</span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                      {["Servidor", "Coordenador", "Assessor", "Diretor", "Secretário", "Prefeito", "Procurador"].map((cargo) => {
                        const isSelected = selectedForwardRole === cargo;
                        return (
                          <button
                            key={cargo}
                            onClick={() => {
                              setSelectedForwardRole(cargo);
                              setSelectedPredefinedAgent(null);
                              setManualAgentName("");
                              setManualAgentEmail("");
                            }}
                            className={`py-1 rounded-lg text-center font-extrabold text-[9.5px] cursor-pointer transition-all ${
                              isSelected 
                                ? "bg-[#1351B4] text-white shadow-xs" 
                                : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
                            }`}
                          >
                            {cargo}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalhes Curriculares da Atribuição Funcional */}
                  <div className="bg-white rounded-lg p-2.5 border border-stone-200/60 text-[10px] leading-relaxed">
                    <span className="font-extrabold text-[#071D41] block uppercase text-[9px] mb-0.5">📜 Competência Funcional Ordinária:</span>
                    <span className="text-stone-600">
                      {ROLE_ATTRIBUTIONS[selectedForwardRole] || "Competências descritas regimentalmente e integradas aos fluxos ordinários de controle."}
                    </span>
                  </div>
                </div>

                {/* Seleção do Agente de Destino */}
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-[9.5px] text-stone-500 font-extrabold uppercase block mb-1.5">
                      2. Escolha o Agente de Governo ({selectedForwardRole}) ou Cadastre Manualmente
                    </span>
                    
                    {/* Lista Pré-cadastrada correspondente ao cargo */}
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1 border rounded-lg p-2 bg-white mb-2.5 scrollbar-thin">
                      {PUBLIC_AGENTS_DATABASE.filter(a => a.cargo === selectedForwardRole).map((agent) => {
                        const isChosen = selectedPredefinedAgent?.email === agent.email;
                        return (
                          <div 
                            key={agent.email}
                            onClick={() => {
                              setSelectedPredefinedAgent(agent);
                              setManualAgentName(agent.nome);
                              setManualAgentEmail(agent.email);
                            }}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex justify-between items-center ${
                              isChosen 
                                ? "bg-blue-50/70 border-[#1351B4]" 
                                : "border-stone-150 hover:bg-stone-50"
                            }`}
                          >
                            <div className="leading-tight">
                              <span className="text-xs font-black text-stone-800 block">{agent.nome}</span>
                              <span className="text-[9.5px] text-stone-500 block">{agent.departamento} • {agent.email}</span>
                            </div>
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                              isChosen ? "border-blue-600 bg-blue-600 text-white" : "border-stone-300"
                            }`}>
                              {isChosen && "✓"}
                            </span>
                          </div>
                        );
                      })}

                      {/* Manual input trigger */}
                      <div 
                        onClick={() => {
                          setSelectedPredefinedAgent(null);
                          setManualAgentName("");
                          setManualAgentEmail("");
                        }}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex justify-between items-center ${
                          selectedPredefinedAgent === null && manualAgentName === "" 
                            ? "bg-stone-50 border-stone-300" 
                            : "border-stone-150 hover:bg-stone-50"
                        }`}
                      >
                        <div className="leading-tight">
                          <span className="text-xs font-bold text-stone-700 block">Outro Agente público...</span>
                          <span className="text-[9.5px] text-stone-400 block">Especificar nome e correio manualmente abaixo</span>
                        </div>
                        <span className="text-stone-400 text-xs">✏️</span>
                      </div>
                    </div>

                    {/* Inputs manually toggled */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 mb-0.5 uppercase">Nome Completo</label>
                        <input
                          type="text"
                          value={manualAgentName}
                          onChange={(e) => {
                            setSelectedPredefinedAgent(null);
                            setManualAgentName(e.target.value);
                          }}
                          placeholder="Ex: Dr. Antenor Ferreira"
                          className="w-full text-xs px-2.5 py-1.5 bg-white border rounded-lg outline-none focus:ring-1 focus:ring-blue-600 transition-all text-stone-700 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 mb-0.5 uppercase">E-mail Corporativo</label>
                        <input
                          type="text"
                          value={manualAgentEmail}
                          onChange={(e) => {
                            setSelectedPredefinedAgent(null);
                            setManualAgentEmail(e.target.value);
                          }}
                          placeholder="Ex: antenor.obras@municipio.gov.br"
                          className="w-full text-xs px-2.5 py-1.5 bg-white border rounded-lg outline-none focus:ring-1 focus:ring-blue-600 transition-all text-stone-700 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirmação e Despacho */}
                <div className="mt-4 pt-3.5 border-t flex flex-col gap-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <span className="text-[9.5px] text-amber-900 leading-normal font-bold">
                      📌 <strong>Impacto Territorial:</strong> Se você encaminhar para outro departamento/secretária (ou para outro secretário), o chamado sairá automaticamente da pasta restrita do seu gabinete atual.
                    </span>
                  </div>

                  <button
                    disabled={!manualAgentName.trim() || !manualAgentEmail.trim()}
                    onClick={() => {
                      if (!manualAgentName.trim() || !manualAgentEmail.trim()) return;
                      
                      const finalName = manualAgentName.trim();
                      const finalEmail = manualAgentEmail.trim();
                      const finalCargo = selectedForwardRole;
                      const antigaSec = selectedManif.secretaria || "Ouvidoria";
                      
                      // Buscamos se esse agente pertence a outro departamento
                      const matchPredefined = PUBLIC_AGENTS_DATABASE.find(a => a.email.toLowerCase() === finalEmail.toLowerCase());
                      
                      let novaSec = antigaSec;
                      // Se for outro Secretário ou perfil, e tiver um departamento diferente especificado, atualizamos a secretaria do chamado!
                      if (matchPredefined && matchPredefined.departamento && !matchPredefined.departamento.toLowerCase().includes(antigaSec.toLowerCase())) {
                        const possibleSecs = ["Infraestrutura", "Saúde", "Educação", "Ação Social", "Serviços Públicos", "Cultura", "Esportes"];
                        const matchedSec = possibleSecs.find(sec => matchPredefined.departamento.toLowerCase().includes(sec.toLowerCase()) || matchPredefined.nome.toLowerCase().includes(sec.toLowerCase()));
                        if (matchedSec) {
                          novaSec = matchedSec;
                        } else if (matchPredefined.cargo === "Secretário") {
                          novaSec = matchPredefined.departamento.replace("Secretaria de", "").trim();
                        }
                      }

                      // Se o destino é outra secretaria externa ou se o cargo é de outro Secretário associado a outro departamento
                      if (finalCargo === "Secretário" && finalName !== "Dr. Lins" && antigaSec === "Infraestrutura") {
                        if (finalName.includes("Maria")) novaSec = "Ação Social";
                        else if (finalName.includes("Paulo")) novaSec = "Serviços Públicos";
                        else novaSec = "Serviços Públicos";
                      }

                      const designRationale = ROLE_ATTRIBUTIONS[finalCargo] || "Atribuição ordinária de competências do gabinete de ouvidoria inteligente.";
                      triggerAgentForwardSimulatedEmail(selectedManif, finalName, finalCargo, finalEmail, designRationale);

                      // Update the manifestations list
                      const updatedM = {
                        ...selectedManif,
                        responsavel_nome: finalName,
                        responsavel_cargo: finalCargo,
                        responsavel_email: finalEmail,
                        secretaria: novaSec
                      };
                      setManifestacoes(prev => prev.map(m => m.id === selectedManif.id ? updatedM : m));
                      saveDocument("manifestacoes", selectedManif.protocolo, updatedM);

                      if (novaSec !== antigaSec) {
                        alert(`Sucesso! Chamado #${selectedManif.protocolo} encaminhado oficialmente de "${antigaSec}" para a pasta de "${novaSec}" sob os cuidados de ${finalName} (${finalCargo}). O chamado saiu automaticamente da sua pasta do gabinete.`);
                      } else {
                        alert(`Sucesso! Chamado #${selectedManif.protocolo} delegado internamente para ${finalName} (${finalCargo}) para diligências imediatas no âmbito da pasta de ${antigaSec}.`);
                      }

                      // Reset states and close modal
                      setManualAgentName("");
                      setManualAgentEmail("");
                      setSelectedPredefinedAgent(null);
                      setSelectedManif(null);
                    }}
                    className={`w-full py-2.5 rounded-xl text-xs font-black transition-all text-center select-none cursor-pointer flex items-center justify-center gap-1.5 ${
                      manualAgentName.trim() && manualAgentEmail.trim()
                        ? "bg-[#1351B4] hover:bg-[#114093] text-white shadow-md active:scale-98"
                        : "bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed"
                    }`}
                  >
                    🚀 Atribuir Competência Executiva e Confirmar Despacho
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t flex justify-end">
              <button
                id="btn-cancel-modal-manif"
                onClick={() => setSelectedManif(null)}
                className="bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold py-2 px-4 rounded-lg cursor-pointer"
              >
                Voltar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* REPORT PREVIEW MODAL */}
      {showReportPreview && (() => {
        const activeReportSec = reportSecretaria || (user?.perfil === "Secretaria" ? user?.secretaria : (secretarias[0]?.nome || "Infraestrutura"));
        const filteredReportManifs = manifestacoes.filter(m => m.secretaria?.toLowerCase().trim() === activeReportSec?.toLowerCase().trim());
        const reportTotal = filteredReportManifs.length;
        const reportLidas = filteredReportManifs.filter(m => m.status !== "Pendente").length;
        const reportResolvidas = filteredReportManifs.filter(m => m.status === "Resolvido").length;
        const reportPendentes = filteredReportManifs.filter(m => m.status === "Pendente" || m.status === "Urgente").length;
        const finalDiligencia = (diligenciadoName && diligenciadoName !== "Outro") ? diligenciadoName : (customDiligenciadoName || "Não designado");

        return (
          <div 
            onClick={() => setShowReportPreview(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-250 overflow-hidden"
            >
              {/* Document Header preview */}
              <div className="p-4 md:p-5 text-white bg-slate-800 flex justify-between items-center border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-extrabold text-sm md:text-base tracking-tight leading-none uppercase">
                    Visualização Prévia: Relatório Oficial de Ouvidoria
                  </h3>
                </div>
                <button 
                  id="btn-close-report-preview"
                  onClick={() => setShowReportPreview(false)} 
                  className="text-white hover:text-amber-400 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Document body simulating a PDF printed paper with letterhead */}
              <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto bg-stone-50 font-sans">
                <div className="bg-white p-6 md:p-8 border border-stone-300 shadow-md rounded-lg relative overflow-hidden flex flex-col gap-5">
                  
                  {/* Municipal letterhead header decor */}
                  <div className="border-b-4 border-double border-stone-400 pb-4 text-center">
                    <span className="text-[10px] md:text-[11px] font-black tracking-widest text-[#071D41] uppercase block">República Federativa do Brasil</span>
                    <h2 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">{municipio}</h2>
                    <span className="text-[10px] font-bold text-stone-500 uppercase">Sistema Municipal de Ouvidoria Inteligente e Controle Interno</span>
                  </div>

                  {/* Document Title / Meta block */}
                  <div className="flex justify-between items-start text-xs border-b pb-3 border-stone-200">
                    <div>
                      <p className="font-black text-stone-700 uppercase">Documento: <span className="font-normal text-stone-400 font-mono">RE-OUV-{logoText}-2026-05</span></p>
                      <p className="font-black text-stone-700 uppercase">Período: <span className="font-normal text-stone-500">Maio de 2026</span></p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-stone-700 uppercase">Secretaria: <span className="text-[#1351B4] font-bold">{activeReportSec}</span></p>
                      <p className="font-semibold text-stone-500 text-[10px]">Data Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* Summary Narrative paragraph */}
                  <div className="text-xs text-stone-700 leading-relaxed text-justify indent-8 flex flex-col gap-3">
                    <p>
                      O presente expediente técnico do conselho de controle da Ouvidoria Municipal consolida, de forma analítica e sob regimento da Lei de Acesso à Informação (LAI), o mapeamento de demandas públicas, classificações e ações de contingência operacional relativas à pasta municipal de <strong>{activeReportSec}</strong>.
                    </p>
                  </div>

                  {/* Real-time stats section as an official table style */}
                  <div>
                    <h4 className="text-xs font-bold text-[#071D41] uppercase tracking-wider mb-2">I. Indicadores de Volume Operacional</h4>
                    <div className="border border-stone-300 rounded overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-stone-100 border-b border-stone-300 text-stone-700 uppercase font-bold text-[10px]">
                            <th className="px-3 py-2 border-r border-stone-300">Metrificação da Pasta</th>
                            <th className="px-3 py-2 text-center">Contagem Quantitativa</th>
                            <th className="px-3 py-2 text-right">Porcentagem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          <tr>
                            <td className="px-3 py-2 border-r border-[#e0e0e0] font-medium text-stone-700">A. Demandas Recebidas no Período</td>
                            <td className="px-3 py-2 text-center font-black">{reportTotal}</td>
                            <td className="px-3 py-2 text-right font-mono">100%</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 border-r border-[#e0e0e0] font-medium text-stone-700">B. Demandas Triadas / Lidas</td>
                            <td className="px-3 py-2 text-center font-black">{reportLidas}</td>
                            <td className="px-3 py-2 text-right font-mono">{reportTotal ? Math.round((reportLidas / reportTotal) * 100) : 0}%</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 border-r border-[#e0e0e0] font-medium text-stone-700 text-emerald-850">C. Demandas Resolvidas com Sucesso</td>
                            <td className="px-3 py-2 text-center font-black text-emerald-800">{reportResolvidas}</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-800">{reportTotal ? Math.round((reportResolvidas / reportTotal) * 100) : 0}%</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 border-r border-[#e0e0e0] font-medium text-stone-700 text-amber-700">D. Pendências aguardando Resolução</td>
                            <td className="px-3 py-2 text-center font-black text-amber-700">{reportPendentes}</td>
                            <td className="px-3 py-2 text-right font-mono text-amber-700">{reportTotal ? Math.round((reportPendentes / reportTotal) * 100) : 0}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Forward Diligence technical designation section */}
                  <div className="bg-amber-50/50 p-4 rounded border border-amber-250">
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                      ⚖️ II. Designação e Diligência Técnica
                    </h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      Em resposta às demandas listadas acima, o gabinete de Ouvidoria formalizou a portaria de diligência técnica urgente, instruindo a mobilização e resolução imediata sob responsabilidade do servidor designado:
                    </p>
                    <p className="text-xs font-black text-stone-900 bg-white border border-amber-200 mt-2.5 p-2 rounded text-center">
                      Encarregado Designado: {finalDiligencia}
                    </p>
                  </div>

                  {/* Signatures simulation */}
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-dashed border-stone-300 text-center text-[10px] text-stone-600 font-bold uppercase">
                    <div>
                      <div className="w-36 h-0.5 bg-stone-300 mx-auto mb-1.5" />
                      <span>{user?.nome || "Ouvidor Municipal"}</span>
                      <p className="text-[8.5px] text-stone-400 font-normal">Gabinete de Ouvidoria Geral</p>
                    </div>
                    <div>
                      <div className="w-36 h-0.5 bg-stone-300 mx-auto mb-1.5" />
                      <span>{finalDiligencia}</span>
                      <p className="text-[8.5px] text-stone-400 font-normal">Gestor Técnico de Diligência</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal controls */}
              <div className="p-4 bg-stone-100 border-t border-stone-200 flex justify-between items-center gap-2">
                <button
                  id="btn-dismiss-report-preview"
                  onClick={() => setShowReportPreview(false)}
                  className="bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-black py-2.5 px-4 rounded-xl cursor-pointer select-none transition-all"
                >
                  Fechar Visualização
                </button>

                <button
                  id="btn-confirm-report-export"
                  onClick={() => {
                    alert(`Relatório institucional da secretaria [${activeReportSec}] enviado e diligência encaminhada com sucesso para [${finalDiligencia}]! Os registros desta ação foram persistidos com sucesso.`);
                    setShowReportPreview(false);
                  }}
                  className="py-2.5 px-5 text-xs font-black text-white bg-emerald-650 hover:bg-emerald-700 rounded-xl transition-all shadow-md cursor-pointer select-none font-sans"
                >
                  Confirmar e Encaminhar Diligência
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* REALTIME CITIZEN TOAST OVERLAY */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {citizenToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, x: -100 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border-2 border-emerald-100 overflow-hidden pointer-events-auto p-4 flex flex-col gap-2 cursor-pointer hover:border-emerald-250 transition-all"
            >
              <div className="flex items-start gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  toast.status === "Resolvido" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                }`}>
                  {toast.status === "Resolvido" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      {toast.status === "Resolvido" ? "✔️ Manifestação Resolvida" : "⚡ Em Andamento"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCitizenToasts(prev => prev.filter(t => t.id !== toast.id));
                      }}
                      className="text-stone-400 hover:text-stone-700 text-xs font-bold font-sans"
                    >
                      ✕
                    </button>
                  </div>
                  <h5 className="text-[11.5px] font-black text-[#071D41] mt-0.5 truncate leading-snug">
                    Protocolo: #{toast.protocolo}
                  </h5>
                  <p className="text-[10px] text-stone-500 font-bold truncate mt-0.5">
                    Tipo: {toast.titulo}
                  </p>
                  <p className="text-[10.5px] text-stone-600 mt-1 leading-relaxed bg-stone-50 p-2 rounded border border-stone-150">
                    O status da sua manifestação foi atualizado para <strong className={toast.status === "Resolvido" ? "text-emerald-700" : "text-blue-700"}>{toast.status}</strong> em tempo real!
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* SIMULATED EMAIL TOAST OVERLAY */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {emailToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, x: 100 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border-2 border-indigo-150 overflow-hidden pointer-events-auto p-4 flex flex-col gap-2 cursor-pointer hover:border-indigo-250 transition-all group"
              onClick={() => {
                const foundLog = emailLogs.find(l => l.protocolo === toast.protocol);
                if (foundLog) setSelectedEmailForModal(foundLog);
              }}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-110 transition-transform">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">E-mail automático disparado</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEmailToasts(prev => prev.filter(t => t.id !== toast.id));
                      }}
                      className="text-stone-450 hover:text-stone-700 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <h5 className="text-[11.5px] font-black text-[#071D41] mt-0.5 truncate leading-snug">
                    {toast.subject}
                  </h5>
                  <p className="text-[10px] text-stone-500 font-bold truncate mt-0.5">
                    Para: {toast.email}
                  </p>
                  <p className="text-[10px] text-stone-450 mt-1 line-clamp-2 leading-relaxed bg-stone-50 p-1.5 rounded border">
                    {toast.body.split("\n").slice(2, 5).join(" ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] font-extrabold border-t pt-2 border-stone-100 mt-1 text-stone-500">
                <span>Transição: {toast.stAntigo} ➔ {toast.stNovo}</span>
                <span className="text-[#1351B4] hover:underline">Ver na Íntegra ➔</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* SIMULATED EMAIL DETAILS VIEWER MODAL */}
      {selectedEmailForModal && (
        <div 
          onClick={() => setSelectedEmailForModal(null)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-250 font-sans"
          >
            {/* Header simulating standard email client bar */}
            <div className="bg-[#1c2438] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide">Mensagem de Notificação Enviada</h4>
                  <p className="text-[9.5px] text-stone-300">Serviço de Alertas Digitais • SMTP Ativo</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmailForModal(null)}
                className="text-white hover:text-amber-400 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Email visual envelope structure */}
            <div className="p-5 border-b border-stone-150 bg-stone-50 flex flex-col gap-2.5">
              <div className="grid grid-cols-6 items-center text-xs">
                <span className="col-span-1 text-stone-400 font-bold">De:</span>
                <span className="col-span-5 text-stone-700 font-bold">Ouvidoria Geral - {municipio} &lt;nao-responder@ouvidoria.gov.br&gt;</span>
              </div>
              <div className="grid grid-cols-6 items-center text-xs">
                <span className="col-span-1 text-stone-400 font-bold">Para:</span>
                <span className="col-span-5 text-[#1351B4] font-black">{selectedEmailForModal.destinatario}</span>
              </div>
              <div className="grid grid-cols-6 items-center text-xs">
                <span className="col-span-1 text-stone-400 font-bold">Assunto:</span>
                <span className="col-span-5 text-stone-900 font-extrabold">{selectedEmailForModal.assunto}</span>
              </div>
              <div className="grid grid-cols-6 items-center text-xs">
                <span className="col-span-1 text-stone-400 font-bold">Data:</span>
                <span className="col-span-1 text-stone-500 font-mono">
                  {new Date(selectedEmailForModal.timestamp).toLocaleDateString('pt-BR')}
                </span>
                <span className="col-span-1 text-stone-400 text-right font-bold">Horário:</span>
                <span className="col-span-3 text-stone-500 font-mono pl-1">
                  {new Date(selectedEmailForModal.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Email Message Content Body */}
            <div className="p-6 max-h-[350px] overflow-y-auto bg-white border-b">
              <div className="border p-4 rounded-xl bg-stone-50/50 text-xs text-stone-700 leading-relaxed font-mono whitespace-pre-wrap">
                {selectedEmailForModal.conteudo}
              </div>
            </div>

            {/* Simulated actions bar */}
            <div className="p-3 bg-stone-100 flex justify-between items-center text-[10px] text-stone-500 font-bold">
              <span className="flex items-center gap-1 text-emerald-650">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping" />
                Entrega Confirmada pelo Servidor Local (Código 250 OK)
              </span>
              <button
                onClick={() => setSelectedEmailForModal(null)}
                className="bg-[#1351B4] text-white py-1.5 px-3 rounded-lg text-xs font-black cursor-pointer shadow-xs active:scale-98"
              >
                Fechar Alerta
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: NOTÍCIA COMPLETA DA CAMPANHA DE UTILIDADE PÚBLICA */}
      {selectedAdForModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-once">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-250 overflow-hidden flex flex-col max-h-[90vh] font-sans"
          >
            {/* Header */}
            <div className="p-4 md:p-5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-stone-200 flex justify-between items-center text-[#071D41]">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-white text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md">
                  Campanha de Utilidade Pública
                </span>
                <span className="text-[10px] sm:text-xs font-black text-stone-600 uppercase tracking-wider">
                  Oficial: {getNormalizedCityName(municipio)}
                </span>
              </div>
              <button
                onClick={() => setSelectedAdForModal(null)}
                className="text-stone-400 hover:text-stone-700 font-bold text-lg cursor-pointer h-7 w-7 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
                title="Fechar Notícia"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 md:p-7 overflow-y-auto flex flex-col gap-5">
              {selectedAdForModal.imagem && (
                <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden border border-stone-200 shadow-xs relative shrink-0">
                  <img
                    src={selectedAdForModal.imagem}
                    alt={selectedAdForModal.titulo}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="flex flex-col gap-3">
                <h3 className="font-display font-black text-[#071D41] text-lg sm:text-2xl leading-tight">
                  {formatAdText(selectedAdForModal.titulo)}
                </h3>
                
                <div className="w-12 h-1 bg-amber-500 rounded-full" />
                
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-medium text-justify mt-1">
                  {formatAdText(
                    selectedAdForModal.noticiaCompleta || 
                    "Mais detalhes sobre esta utilidade pública estarão disponíveis em breve nos canais oficiais de comunicação do município. Fique atento às atualizações do gabinete oficial da prefeitura."
                  )}
                </p>
              </div>
            </div>

            {/* Footer with actions */}
            <div className="p-4 bg-stone-50 border-t border-stone-150 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
              <span className="text-[10px] text-stone-500 font-semibold italic text-center sm:text-left">
                Campanha patrocinada pela Ouvidoria Municipal de {getNormalizedCityName(municipio)}
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {selectedAdForModal.link && selectedAdForModal.link !== "#" && (
                  <a
                    href={selectedAdForModal.link}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-4 py-2 bg-[#1351B4] hover:bg-blue-700 text-white text-[11px] font-black rounded-lg transition-all shadow-xs text-center uppercase tracking-wider text-inherit"
                    style={{ color: "white" }}
                  >
                    Acessar Link Externo
                  </a>
                )}
                <button
                  onClick={() => setSelectedAdForModal(null)}
                  className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 text-[11px] font-bold rounded-lg border border-stone-200 transition-colors cursor-pointer text-center"
                >
                  Fechar Notícia
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ESPAÇO DE MENSAGENS INSTITUCIONAIS E PUBLICIDADE DE UTILIDADE PÚBLICA (ACIMA DO RODAPÉ) */}
      <section className="mt-8 mb-4 max-w-2xl mx-auto px-4 w-full">
        <div className="bg-white/95 border-2 border-stone-200 rounded-xl p-4.5 shadow-sm hover:border-[#1351B4]/30 transition-all">
          {(() => {
            const activeAds = propagandas.filter(ad => {
              if (!ad.ativa) return false;
              // Filter by screen destination
              let matchesScreen = false;
              if (!ad.telaDestino || ad.telaDestino === "todas") {
                matchesScreen = true;
              } else if (view === "cidadao" && ad.telaDestino === "inicio") {
                matchesScreen = true;
              } else if (view === "abrir" && ad.telaDestino === "abrir") {
                matchesScreen = true;
              } else if (view === "consultar" && ad.telaDestino === "consultar") {
                matchesScreen = true;
              } else if (view === "dashboard" && ad.telaDestino === "admin") {
                matchesScreen = true;
              }

              if (!matchesScreen) return false;

              // Filter by position (defaults to "ambas" if unspecified)
              const pos = ad.posicao || "ambas";
              return pos === "inferior" || pos === "ambas";
            });

            if (activeAds.length === 0) {
              // Default beautiful institutional message of the municipality!
              return (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg text-[#1351B4] shrink-0">
                      <Landmark size={18} />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#1351B4] block mb-0.5">Mensagem Institucional</span>
                      <p className="text-xs text-stone-600 font-medium leading-relaxed">
                        Prefeitura de {getNormalizedCityName(municipio)} • Ouvidoria em total conformidade com a LGPD e a Lei Federal nº 13.460/2017 para o pleno exercício da sua cidadania.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      alert(`Ouvidoria Inteligente - Canal oficial do município em plena conformidade regulatória. Seus dados estão seguros conosco.`);
                    }}
                    className="shrink-0 text-[10px] text-[#1351B4] hover:text-blue-800 font-extrabold border-b border-dashed border-blue-300 hover:border-[#1351B4] transition-all py-0.5 cursor-pointer"
                  >
                    Saber mais sobre conformidade &rarr;
                  </button>
                </div>
              );
            }

            const adsToShow = activeAds.slice(0, 5);
            const currentAd = adsToShow[activeAdIndex % adsToShow.length];

            return (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3 w-full sm:max-w-[65%]">
                  <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 shrink-0">
                    <Sparkles size={18} className="animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="bg-amber-600 text-white text-[7px] font-black tracking-widest uppercase px-1.5 py-0.2 rounded leading-normal">
                        Utilidade Pública
                      </span>
                      <span className="text-[10px] text-stone-400 font-bold hidden xs:inline">• Informativo Municipal</span>
                    </div>
                    <p className="text-xs font-bold text-stone-800 leading-snug break-words">
                      {formatAdText(currentAd.titulo)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3.5 w-full sm:w-auto border-t border-stone-100 sm:border-t-0 pt-3 sm:pt-0 shrink-0">
                  {/* Selector circles or arrows */}
                  <div className="flex items-center bg-stone-50 border border-stone-200 p-0.5 rounded-lg shadow-3xs">
                    <button
                      type="button"
                      onClick={() => setActiveAdIndex(prev => (prev - 1 + adsToShow.length) % adsToShow.length)}
                      className="w-5.5 h-5.5 flex items-center justify-center text-[9px] font-black text-stone-700 bg-white hover:bg-stone-100 rounded-md border border-stone-150 transition-colors cursor-pointer shadow-3xs"
                      title="Anterior"
                    >
                      ←
                    </button>
                    <span className="text-[9.5px] font-mono font-bold text-stone-600 px-2 min-w-[24px] text-center">
                      {(activeAdIndex % adsToShow.length) + 1}/{adsToShow.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveAdIndex(prev => (prev + 1) % adsToShow.length)}
                      className="w-5.5 h-5.5 flex items-center justify-center text-[9px] font-black text-stone-700 bg-white hover:bg-stone-100 rounded-md border border-stone-150 transition-colors cursor-pointer shadow-3xs"
                      title="Próximo"
                    >
                      →
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAdForModal(currentAd)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-[#1351B4] to-blue-700 hover:from-blue-750 hover:to-blue-800 text-white text-[10px] uppercase tracking-wider font-extrabold rounded-lg shadow-sm active:scale-97 cursor-pointer text-center text-inherit leading-normal"
                    style={{ color: 'white' }}
                  >
                    {formatAdText(currentAd.textoBotao || "Saiba mais")}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto pt-6 pb-6 text-center">
        <p className="text-[11px] text-stone-500 font-semibold tracking-wide">
          {programName} © 2026 • Conforme LGPD Lei nº 13.709/2018
        </p>
      </footer>

      {/* TELA DE TERMOS E CONDIÇÕES - PRIMEIRO LOGIN COM BLOQUEIO DE TELA */}
      {user && !hasAcceptedTerms && (
        <div id="terms-and-conditions-overlay" className="fixed inset-0 bg-[#071D41]/95 backdrop-blur-md flex items-center justify-center z-[99999] p-4 text-left antialiased animate-fade-in overflow-y-auto">
          {termosRecusados ? (
            <div id="terms-blocked-card" className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border-t-8 border-rose-600 animate-fade-in text-center flex flex-col items-center">
              <span className="text-6xl mb-4 leading-none" id="blocked-warning-icon">⚠️</span>
              <h2 className="font-display font-extrabold text-[#071D41] text-2xl mb-2" id="blocked-title">
                Acesso Temporariamente Bloqueado
              </h2>
              <p className="text-stone-600 text-sm leading-relaxed mb-6" id="blocked-description">
                Sua conta de <span className="font-bold text-[#1351B4]">{user.perfil === "cidadao" ? "Cidadador" : "Agente Público"}</span> está conectada, mas <span className="font-bold text-rose-600">o acesso ao portal foi bloqueado</span> porque você recusou os Termos e Condições Gerais de Uso.
              </p>
              <div className="bg-rose-50 text-rose-800 p-4 rounded-xl border border-rose-250 text-xs text-left mb-6 font-bold leading-relaxed" id="blocked-legal-reason">
                <p className="mb-2 font-extrabold">⚠️ Razão de Conformidade Legal:</p>
                Sob regulamentação da Lei Geral de Proteção de Dados (LGPD) e diretrizes de governança da Prefeitura, o sistema exige consentimento expresso e inequívoco para controle de localização GPS e uploads de mídias de irregularidades, além de assunção de autoria jurídica sobre as mensagens transmitidas.
              </div>
              <div className="flex flex-col gap-2 w-full">
                <button
                  id="btn-re-review-terms"
                  type="button"
                  onClick={() => setTermosRecusados(false)}
                  className="w-full bg-[#1351B4] hover:bg-[#114093] text-white font-extrabold py-3 px-5 rounded-xl shadow-lg transition-all text-xs uppercase cursor-pointer"
                >
                  🔄 Revisar e Aceitar Termos
                </button>
                <button
                  id="btn-logout-from-terms"
                  type="button"
                  onClick={handleLogout}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 px-5 rounded-xl text-xs transition-all cursor-pointer border border-stone-200"
                >
                  Sair da Conta
                </button>
              </div>
            </div>
          ) : (
            <div id="terms-consent-card" className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 flex flex-col my-8 overflow-hidden animate-fade-in max-h-[90vh]">
              {/* Modal Header */}
              <div className="bg-[#071D41] text-white p-5 md:p-6 shrink-0 relative flex items-center gap-3.5 border-b border-[#1351B4]/20" id="terms-header">
                <span className="text-3xl leading-none">🛡️</span>
                <div>
                  <h2 className="font-display font-black text-xs uppercase tracking-wider text-blue-400">{municipio}</h2>
                  <h3 className="font-display font-extrabold text-base md:text-lg">Termos de Uso, Privacidade e Proteção Legal</h3>
                </div>
              </div>

              {/* Modal Scrollable Terms Text */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-5 text-stone-700 text-xs md:text-sm leading-relaxed border-b border-stone-100" id="terms-scroll-body">
                <div className="p-4 bg-blue-50/50 border border-[#1351B4]/10 rounded-xl" id="terms-greeting-banner">
                  <p className="font-bold text-[#071D41] text-xs">
                    Prezado(a) <span className="text-[#1351B4] underline font-black">{user.nome}</span> ({user.email}),
                  </p>
                  <p className="mt-1 text-stone-600 text-[11px] leading-relaxed">
                    Antes de ingressar e utilizar quaisquer funcionalidades do aplicativo, leia com atenção os termos legais abaixo que regulam o tratamento dos seus dados, salvaguardas tecnológicas dos desenvolvedores e responsabilidade civil de suas postagens públicas.
                  </p>
                </div>

                <div id="terms-section-1">
                  <h4 className="font-bold text-[#071D41] flex items-center gap-1.5 uppercase text-xs tracking-wider mb-1.5">
                    <span className="text-[#1351B4]">1.</span> Consentimento LGPD - Captura e Localização GPS
                  </h4>
                  <p className="text-stone-600 text-xs leading-relaxed">
                    Você declara possuir plena ciência e <span className="font-bold text-[#1351B4]">autoriza expressamente</span> o aplicativo a solicitar e acessar recursos de hardware do seu dispositivo móvel ou computador, incluindo **câmera de fotos, gravação de vídeos, galeria de imagens** e **dados de geolocalização exata (GPS)**. O usuário compreende e consente que tais dados são cruciais para a coleta de provas físicas de infrações urbanas e zeladoria em campo e serão processados em concordância com a LGPD.
                  </p>
                </div>

                <div id="terms-section-2">
                  <h4 className="font-bold text-[#071D41] flex items-center gap-1.5 uppercase text-xs tracking-wider mb-1.5">
                    <span className="text-[#1351B4]">2.</span> Responsabilidade Integral do Usuário pelas Mensagens
                  </h4>
                  <p className="text-stone-600 text-xs leading-relaxed">
                    O usuário assume **responsabilidade integral, direta, pessoal, civil, administrativa e criminal** por todas as manifestações, descrições textuais, dados, imagens, arquivos ou mídias anexadas transmitidos através do presente sistema público. Garante-se expressamente que os relatos são verdadeiros e lícitos, ficando o responsável sujeito às cominações de calúnia, injúria, difamação ou denúncia caluniosa sob os regramentos jurídicos nacionais vigentes.
                  </p>
                </div>

                <div id="terms-section-3">
                  <h4 className="font-bold text-[#071D41] flex items-center gap-1.5 uppercase text-xs tracking-wider mb-1.5">
                    <span className="text-[#1351B4]">3.</span> Isenção de Responsabilidade do Desenvolvedor e Fornecedora
                  </h4>
                  <p className="text-stone-600 text-xs leading-relaxed">
                    Como cláusula pétrea de fomento comercial e proteção tecnológica, **o profissional desenvolvedor autônomo e a empresa licenciadora proprietária do software ficam expressa e integralmente isentos de qualquer responsabilidade civil ou obrigação indenizatória** legal decorrente de interrupções operacionais do serviço, atos ilícitos ou desvios de conduta praticados por terceiros, cidadãos ou clientes. O software é disponibilizado em formato "as-is" (como está) e seu uso ocorre por conta e risco e sob jurisdição local própria.
                  </p>
                </div>

                <div className="p-3 bg-stone-50 border rounded-lg text-[10px] text-stone-500 font-mono flex justify-between items-center" id="terms-metadata-block">
                  <span>ID-REGISTRO: LGPD-AISTUDIO-2026</span>
                  <span>DATA: {new Date().toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Modal Buttons Footer */}
              <div className="bg-stone-50 p-4 md:p-6 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-200" id="terms-footer">
                <p className="text-[10px] text-stone-500 text-center sm:text-left leading-tight sm:max-w-[45%]">
                  Ao clicar em <b>"Sim, aceito e concordo"</b>, você concede as autorizações LGPD requeridas e desbloqueia o seu acesso sob conformidade estrita da lei.
                </p>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    id="btn-refuse-terms"
                    type="button"
                    onClick={() => setTermosRecusados(true)}
                    className="px-4 py-2.5 rounded-xl border border-rose-250 text-rose-700 bg-rose-50/30 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer w-1/2 sm:w-auto text-center"
                  >
                    Recusar / Bloquear
                  </button>
                  <button
                    id="btn-accept-terms"
                    type="button"
                    onClick={handleAceptTermos}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer w-1/2 sm:w-auto text-center shadow-lg shadow-emerald-600/10"
                  >
                    Sim, aceito e concordo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
