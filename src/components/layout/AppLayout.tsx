import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  PlusCircle,
  ShoppingCart,
  Users,
  Package,
  Wallet,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Printer,
  AlertTriangle,
  Maximize2,
  Minimize2,
  ShieldCheck,
  LogOut,
  Cloud,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  configRepo,
  financeiroRepo,
  sincronizarComSupabase,
  assinarRealtimeSupabase,
} from '@/repositories/localStorageRepo';
import { useAuth } from '@/features/auth/AuthContext';
import { supabaseEstaConfigurado } from '@/lib/supabaseClient';
import { GlobalSearchModal } from './GlobalSearchModal';
import { formatarMoeda, formatarDataHora, caixaEhDeDiaAnterior } from '@/utils/formatters';
import { useToast } from '@/components/ui/Toast';

export const AppLayout: React.FC = () => {
  const [recolhido, setRecolhido] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [telaCheia, setTelaCheia] = useState<boolean>(!!document.fullscreenElement);
  const [sincronizadoNuvem, setSincronizadoNuvem] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const { sessao, sair } = useAuth();

  // Sincronização automática e em Tempo Real com o Supabase (PC, Celular e Tablet)
  useEffect(() => {
    if (!supabaseEstaConfigurado()) return;

    let cancelado = false;
    sincronizarComSupabase().then((res) => {
      if (cancelado) return;
      if (res.conectado) {
        setSincronizadoNuvem(true);
        queryClient.invalidateQueries();
      }
    });

    const cancelarRealtime = assinarRealtimeSupabase(() => {
      setSincronizadoNuvem(true);
      queryClient.invalidateQueries();
    });

    return () => {
      cancelado = true;
      cancelarRealtime();
    };
  }, [queryClient]);

  const { data: config } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => configRepo.obterConfiguracoes(),
  });

  const { data: caixaAberto } = useQuery({
    queryKey: ['caixaAberto'],
    queryFn: () => financeiroRepo.obterCaixaAberto(),
  });

  // Monitora mudança do estado de Tela Cheia (Maximizar Aplicação)
  useEffect(() => {
    const onFullscreenChange = () => {
      setTelaCheia(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const alternarTelaCheia = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      notificar('Não foi possível alternar o modo de tela cheia neste navegador.', 'aviso');
    }
  };

  // Motor de Backup Automático a Cada Hora (Respeitando Horário Comercial configurado)
  useEffect(() => {
    if (!config || config.backupAutomaticoAtivo === false) return;

    const verificarEExecutarBackupAuto = async () => {
      const agora = new Date();
      const intervaloMs = (config.backupIntervaloMinutos || 60) * 60 * 1000;

      // Verifica se está dentro do horário comercial (se ativado)
      if (config.backupApenasHorarioComercial !== false) {
        const inicioStr = config.horarioComercialInicio || '08:00';
        const fimStr = config.horarioComercialFim || '19:00';
        const [hIni, mIni] = inicioStr.split(':').map(Number);
        const [hFim, mFim] = fimStr.split(':').map(Number);
        const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
        const minutosInicio = (hIni || 8) * 60 + (mIni || 0);
        const minutosFim = (hFim || 19) * 60 + (mFim || 0);

        if (minutosAgora < minutosInicio || minutosAgora > minutosFim) {
          return; // Fora do horário comercial configurado
        }
      }

      const ultimoTs = config.ultimoBackupAutomaticoEm
        ? new Date(config.ultimoBackupAutomaticoEm).getTime()
        : 0;

      if (agora.getTime() - ultimoTs >= intervaloMs) {
        const horaFormatada = `${String(agora.getHours()).padStart(2, '0')}:${String(
          agora.getMinutes()
        ).padStart(2, '0')}`;
        const ponto = await configRepo.criarPontoBackupAutomatico(
          `Backup Automático (${horaFormatada})`
        );

        // Se o download automático de arquivo JSON também estiver ativo nas configurações
        if (config.backupDownloadAutomatico) {
          const blob = new Blob([JSON.stringify(ponto.dados, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `backup-auto-shlojacell-${agora.toISOString().slice(0, 10)}-${String(
            agora.getHours()
          ).padStart(2, '0')}h.json`;
          a.click();
          URL.revokeObjectURL(url);
        }

        queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
        queryClient.invalidateQueries({ queryKey: ['backupsAutomaticos'] });
        notificar(`Backup automático das ${horaFormatada} salvo com segurança!`, 'info');
      }
    };

    const timerInicial = setTimeout(verificarEExecutarBackupAuto, 4000);
    const intervalo = setInterval(verificarEExecutarBackupAuto, 60 * 1000);
    return () => {
      clearTimeout(timerInicial);
      clearInterval(intervalo);
    };
  }, [config, queryClient, notificar]);

  // Atalhos globais de teclado para uso no balcão com tablet Android + teclado USB
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K -> Busca Global
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscaAberta((prev) => !prev);
      }
      // Alt+N -> Nova OS rápida
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/os/nova');
      }
      // Alt+V -> Nova Venda Balcão (PDV)
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        navigate('/vendas');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const saldoCaixaAtual =
    caixaAberto?.movimentos.reduce((acc, m) => acc + m.valorCentavos, 0) ?? 0;

  const caixaDiaAnterior = caixaEhDeDiaAnterior(caixaAberto?.aberturaData);

  const itensMenu = [
    {
      to: '/',
      label: 'Painel Inicial',
      icone: LayoutDashboard,
      end: true,
    },
    {
      to: '/os/nova',
      label: 'Nova OS',
      icone: PlusCircle,
      atalho: 'Alt+N',
      destaque: true,
    },
    {
      to: '/os',
      label: 'Ordens de Serviço',
      icone: Wrench,
      end: true,
    },
    {
      to: '/vendas',
      label: 'Vendas / Balcão',
      icone: ShoppingCart,
      atalho: 'Alt+V',
    },
    {
      to: '/clientes',
      label: 'Clientes e Aparelhos',
      icone: Users,
    },
    {
      to: '/produtos',
      label: 'Produtos, Peças e Serviços',
      icone: Package,
    },
    {
      to: '/financeiro',
      label: 'Financeiro e Caixa',
      icone: Wallet,
    },
    {
      to: '/configuracoes',
      label: 'Configurações',
      icone: Settings,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-100 text-slate-900">
      {/* Sidebar Lateral (visível em Tablet Landscape e Desktop >= 1024px) */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 text-slate-100 border-r border-slate-800 transition-all duration-200 shrink-0 select-none ${
          recolhido ? 'w-20' : 'w-64'
        }`}
      >
        {/* Cabeçalho da Loja */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shrink-0 shadow-inner">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            {!recolhido && (
              <div className="truncate">
                <h1 className="font-bold text-sm tracking-tight text-white truncate">
                  {config?.nomeLoja || 'SH LojaCell'}
                </h1>
                <span className="text-[11px] text-sky-400 block font-medium">
                  Assistência Técnica
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRecolhido(!recolhido)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title={recolhido ? 'Expandir menu' : 'Recolher menu'}
          >
            {recolhido ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Links de Navegação (alvos >= 48px de altura para toque fácil no tablet) */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {itensMenu.map((item) => {
            const Icone = item.icone;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 min-h-[48px] rounded-xl font-medium text-sm transition-all ${
                    item.destaque
                      ? isActive
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-950'
                        : 'bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600 hover:text-white'
                      : isActive
                      ? 'bg-slate-800 text-white font-semibold border-l-4 border-sky-500'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`
                }
                title={recolhido ? `${item.label} ${item.atalho ? `(${item.atalho})` : ''}` : undefined}
              >
                <Icone className="w-5 h-5 shrink-0" />
                {!recolhido && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.atalho && (
                      <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                        {item.atalho}
                      </kbd>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar com Status do Caixa, Backup Automático e Impressora */}
        <div className="p-3 border-t border-slate-800 space-y-2 text-xs">
          {!recolhido ? (
            <div className="p-3 rounded-xl bg-slate-800/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status do Caixa:</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                    caixaAberto
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {caixaAberto ? 'Aberto' : 'Fechado'}
                </span>
              </div>
              {caixaAberto && (
                <div className="flex items-center justify-between text-slate-200 font-semibold pt-0.5">
                  <span>Saldo em Caixa:</span>
                  <span className="text-emerald-400">{formatarMoeda(saldoCaixaAtual)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/70">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Backup Auto:
                </span>
                <span className="text-slate-300">
                  {config?.backupAutomaticoAtivo !== false
                    ? config?.ultimoBackupAutomaticoEm
                      ? new Date(config.ultimoBackupAutomaticoEm).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Ativo (1h)'
                    : 'Desativado'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/70">
                <span className="flex items-center gap-1">
                  <Cloud className={`w-3.5 h-3.5 ${sincronizadoNuvem ? 'text-emerald-400' : 'text-sky-400'}`} /> Nuvem:
                </span>
                <span className={sincronizadoNuvem ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
                  {sincronizadoNuvem ? 'Supabase Online' : 'Cache Local'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/70">
                <span className="flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5" /> Bobina:
                </span>
                <span>{config?.larguraPapelMm || 80} mm</span>
              </div>
              <div className="pt-2 border-t border-slate-700/70 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-300 font-medium truncate">
                  👤 {sessao?.usuario || 'admin'}
                </span>
                <button
                  type="button"
                  onClick={() => void sair()}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Sair do sistema"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-3 h-3 mx-auto rounded-full ${
                  caixaAberto ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
                title={caixaAberto ? `Caixa Aberto: ${formatarMoeda(saldoCaixaAtual)}` : 'Caixa Fechado'}
              />
              <button
                type="button"
                onClick={() => void sair()}
                className="p-2 rounded-lg text-rose-400 hover:bg-slate-800"
                title="Sair do sistema"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Barra Superior Rápida para Tablet e Desktop */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          {/* Identificação Mobile/Tablet Vertical */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 text-sm truncate max-w-[140px] sm:max-w-xs">
              {config?.nomeLoja || 'SH LojaCell'}
            </span>
          </div>

          {/* Botão de Busca Global (Ctrl+K) */}
          <button
            type="button"
            onClick={() => setBuscaAberta(true)}
            className="flex-1 max-w-xl min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-500 flex items-center gap-3 text-sm transition-colors border border-slate-200/80"
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate flex-1 text-left">
              Buscar OS, cliente, telefone, IMEI ou produto...
            </span>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-white text-slate-600 rounded-md border border-slate-300 shadow-2xs">
              Ctrl+K
            </kbd>
          </button>

          {/* Ações Rápidas de Balcão + Botão de Maximizar Aplicação no Topo */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={alternarTelaCheia}
              title={
                telaCheia
                  ? 'Sair da Tela Cheia (Restaurar)'
                  : 'Maximizar Aplicação (Tela Cheia p/ Tablet)'
              }
              className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                telaCheia
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              {telaCheia ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden md:inline">Restaurar</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span className="hidden md:inline">Maximizar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/os/nova')}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors ${
                location.pathname === '/os/nova'
                  ? 'bg-sky-700 text-white'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Nova OS</span>
              <kbd className="hidden xl:inline text-[10px] bg-sky-800/70 px-1.5 py-0.5 rounded font-mono">
                Alt+N
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => navigate('/vendas')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors shadow-xs"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">PDV Balcão</span>
              <kbd className="hidden xl:inline text-[10px] bg-emerald-800/70 px-1.5 py-0.5 rounded font-mono">
                Alt+V
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => void sair()}
              title="Sair do Sistema"
              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Alerta Global de Trava de Caixa do Dia Anterior */}
        {caixaAberto && caixaDiaAnterior && (
          <div className="bg-rose-600 text-white px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0 animate-bounce" />
              <div className="text-xs sm:text-sm">
                <p className="font-bold uppercase tracking-wide">
                  TRAVA DE SEGURANÇA: Caixa aberto em dia anterior ({formatarDataHora(caixaAberto.aberturaData)})
                </p>
                <p className="text-rose-100">
                  Novas vendas e recebimentos de OS estão bloqueados até que você feche o caixa anterior e abra o caixa de hoje.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/financeiro')}
              className="min-h-[40px] px-4 py-1.5 rounded-xl bg-white text-rose-700 hover:bg-rose-50 font-bold text-xs shrink-0 shadow-xs"
            >
              Fechar Caixa Anterior Agora
            </button>
          </div>
        )}

        {/* Conteúdo da Rota */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Navegação Inferior para Tablet na Vertical (Portrait) e Celulares (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900 text-slate-200 border-t border-slate-800 z-40 grid grid-cols-6 h-16 px-1 select-none">
        {[
          { to: '/', label: 'Painel', icone: LayoutDashboard, end: true },
          { to: '/os', label: 'OS', icone: Wrench },
          { to: '/vendas', label: 'Vendas', icone: ShoppingCart },
          { to: '/clientes', label: 'Clientes', icone: Users },
          { to: '/produtos', label: 'Estoque', icone: Package },
          { to: '/financeiro', label: 'Caixa', icone: Wallet },
        ].map((item) => {
          const Icone = item.icone;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors ${
                  isActive ? 'text-sky-400 bg-slate-800/80 font-semibold' : 'text-slate-400'
                }`
              }
            >
              <Icone className="w-5 h-5" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Modal de Busca Global */}
      <GlobalSearchModal aberto={buscaAberta} aoFechar={() => setBuscaAberta(false)} />
    </div>
  );
};
