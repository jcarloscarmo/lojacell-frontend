import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PlusCircle,
  ShoppingCart,
  Users,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Wallet,
  Package,
  CalendarClock,
  ArrowRight,
  Settings,
} from 'lucide-react';
import {
  osRepo,
  produtoRepo,
  financeiroRepo,
  clienteRepo,
  aparelhoRepo,
} from '@/repositories/localStorageRepo';
import { formatarMoeda, formatarData, formatarNumeroOS } from '@/utils/formatters';
import { isToday, isSameMonth, parseISO, isBefore, startOfDay } from 'date-fns';
import { StatusOS } from '@/types/domain';

export const STATUS_OS_LABELS: Record<StatusOS, { label: string; cor: string }> = {
  aguardando_analise: {
    label: 'Aguardando análise',
    cor: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  em_analise: {
    label: 'Em análise',
    cor: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  aguardando_aprovacao: {
    label: 'Aguardando aprovação',
    cor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  aprovada_em_reparo: {
    label: 'Aprovada / Em reparo',
    cor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  aguardando_peca: {
    label: 'Aguardando peça',
    cor: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  pronta_retirada: {
    label: 'Pronta para retirada',
    cor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  entregue: {
    label: 'Entregue / Finalizada',
    cor: 'bg-teal-100 text-teal-900 border-teal-300',
  },
  reprovada: {
    label: 'Reprovada',
    cor: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  cancelada: {
    label: 'Cancelada',
    cor: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  },
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordensServico'],
    queryFn: () => osRepo.listar(),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => produtoRepo.listar(),
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ['lancamentosFinanceiros'],
    queryFn: () => financeiroRepo.listarLancamentos(),
  });

  const { data: caixaAberto } = useQuery({
    queryKey: ['caixaAberto'],
    queryFn: () => financeiroRepo.obterCaixaAberto(),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => clienteRepo.listar(),
  });

  const { data: aparelhos = [] } = useQuery({
    queryKey: ['aparelhos'],
    queryFn: () => aparelhoRepo.listar(),
  });

  const hojeInicio = startOfDay(new Date());

  // Métricas de OS
  const osAbertasHoje = ordens.filter((os) => {
    try {
      return isToday(parseISO(os.dataEntrada));
    } catch {
      return false;
    }
  });

  const osProntasRetirada = ordens.filter((os) => os.status === 'pronta_retirada');
  const osAguardandoAprovacao = ordens.filter((os) => os.status === 'aguardando_aprovacao');

  const statusFinalizados: StatusOS[] = ['entregue', 'reprovada', 'cancelada'];
  const osAtrasadas = ordens.filter((os) => {
    if (statusFinalizados.includes(os.status) || !os.previsaoEntrega) return false;
    try {
      return isBefore(parseISO(os.previsaoEntrega), hojeInicio);
    } catch {
      return false;
    }
  });

  // Métricas Financeiras
  const entradasPagas = lancamentos.filter((l) => l.tipo === 'entrada' && l.status === 'pago');

  const faturamentoDia = entradasPagas
    .filter((l) => l.dataPagamento && isToday(parseISO(l.dataPagamento)))
    .reduce((acc, l) => acc + l.valorCentavos, 0);

  const faturamentoMes = entradasPagas
    .filter((l) => l.dataPagamento && isSameMonth(parseISO(l.dataPagamento), new Date()))
    .reduce((acc, l) => acc + l.valorCentavos, 0);

  const saldoCaixa =
    caixaAberto?.movimentos.reduce((acc, m) => acc + m.valorCentavos, 0) ?? 0;

  const contasVencendoOuVencidas = lancamentos.filter(
    (l) => l.tipo === 'saida' && (l.status === 'pendente' || l.status === 'vencido')
  );

  // Estoque baixo
  const produtosEstoqueBaixo = produtos.filter(
    (p) => p.ativo && p.estoqueAtual <= p.estoqueMinimo
  );

  const mapaClientes = new Map(clientes.map((c) => [c.id, c]));
  const mapaAparelhos = new Map(aparelhos.map((a) => [a.id, a]));

  const osRecentesBancada = ordens
    .filter((os) => !statusFinalizados.includes(os.status))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Atalhos Grandes de Balcão */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Painel de Atendimento e Bancada</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão rápida da assistência técnica • Operável por toque ou atalhos de teclado
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/os/nova')}
            className="min-h-[52px] px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <PlusCircle className="w-5 h-5 shrink-0" />
            <span>Nova OS</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/vendas')}
            className="min-h-[52px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <ShoppingCart className="w-5 h-5 shrink-0" />
            <span>Nova Venda</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/clientes')}
            className="min-h-[52px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Users className="w-5 h-5 shrink-0" />
            <span>Clientes</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/configuracoes')}
            className="min-h-[52px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 border border-slate-300 transition-all"
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span>Ajustes / USB</span>
          </button>
        </div>
      </div>

      {/* 8 Cards de Indicadores (Seção 9.5 do PRD) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: OS Abertas Hoje */}
        <button
          type="button"
          onClick={() => navigate('/os')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-sky-400 text-left transition-all shadow-2xs flex items-start justify-between"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              OS Abertas Hoje
            </span>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{osAbertasHoje.length}</p>
            <span className="text-xs text-sky-600 font-medium mt-1 inline-block">
              {ordens.length} OS no total →
            </span>
          </div>
          <div className="p-3 rounded-xl bg-sky-50 text-sky-600">
            <Wrench className="w-6 h-6" />
          </div>
        </button>

        {/* Card 2: Prontas para Retirada */}
        <button
          type="button"
          onClick={() => navigate('/os?status=pronta_retirada')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 text-left transition-all shadow-2xs flex items-start justify-between"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Prontas p/ Retirada
            </span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">
              {osProntasRetirada.length}
            </p>
            <span className="text-xs text-emerald-700 font-medium mt-1 inline-block">
              Aguardando cliente buscar →
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </button>

        {/* Card 3: OS Atrasadas */}
        <button
          type="button"
          onClick={() => navigate('/os?filtro=atrasadas')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-rose-400 text-left transition-all shadow-2xs flex items-start justify-between"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              OS Atrasadas
            </span>
            <p
              className={`text-3xl font-extrabold mt-1 ${
                osAtrasadas.length > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {osAtrasadas.length}
            </p>
            <span className="text-xs text-rose-600 font-medium mt-1 inline-block">
              Prazo vencido na bancada →
            </span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </button>

        {/* Card 4: Aguardando Aprovação */}
        <button
          type="button"
          onClick={() => navigate('/os?status=aguardando_aprovacao')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-400 text-left transition-all shadow-2xs flex items-start justify-between"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Aguard. Aprovação
            </span>
            <p className="text-3xl font-extrabold text-amber-600 mt-1">
              {osAguardandoAprovacao.length}
            </p>
            <span className="text-xs text-amber-700 font-medium mt-1 inline-block">
              Orçamentos enviados →
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </button>

        {/* Card 5: Faturamento Dia / Mês */}
        <button
          type="button"
          onClick={() => navigate('/financeiro')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-sky-400 text-left transition-all shadow-2xs flex items-start justify-between"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Faturamento Hoje
            </span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {formatarMoeda(faturamentoDia)}
            </p>
            <span className="text-xs text-slate-500 font-medium mt-1 inline-block">
              No mês: <strong className="text-slate-800">{formatarMoeda(faturamentoMes)}</strong>
            </span>
          </div>
          <div className="p-3 rounded-xl bg-sky-50 text-sky-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </button>

        {/* Card 6: Saldo do Caixa */}
        <button
          type="button"
          onClick={() => navigate('/financeiro')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 text-left transition-all shadow-2xs flex items-start justify-between"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Saldo do Caixa
            </span>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {formatarMoeda(saldoCaixa)}
            </p>
            <span className="text-xs text-slate-500 font-medium mt-1 inline-block">
              Status: <strong>{caixaAberto ? 'Caixa Aberto' : 'Caixa Fechado'}</strong>
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <Wallet className="w-6 h-6" />
          </div>
        </button>

        {/* Card 7: Contas Vencendo / Vencidas */}
        <button
          type="button"
          onClick={() => navigate('/financeiro')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-400 text-left transition-all shadow-2xs flex items-start justify-between"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contas a Pagar
            </span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {contasVencendoOuVencidas.length} pendentes
            </p>
            <span className="text-xs text-rose-600 font-medium mt-1 inline-block">
              Total:{' '}
              {formatarMoeda(
                contasVencendoOuVencidas.reduce((acc, c) => acc + c.valorCentavos, 0)
              )}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <CalendarClock className="w-6 h-6" />
          </div>
        </button>

        {/* Card 8: Produtos com Estoque Baixo */}
        <button
          type="button"
          onClick={() => navigate('/produtos?filtro=estoque_baixo')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-rose-400 text-left transition-all shadow-2xs flex items-start justify-between"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estoque Mínimo
            </span>
            <p
              className={`text-2xl font-extrabold mt-1 ${
                produtosEstoqueBaixo.length > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {produtosEstoqueBaixo.length} itens
            </p>
            <span className="text-xs text-slate-500 font-medium mt-1 inline-block">
              Abaixo ou igual ao mínimo →
            </span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
            <Package className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* Listas Rápidas: Bancada Ativa e Alertas de Estoque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ordens em Andamento na Bancada */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Ordens de Serviço na Bancada</h3>
              <p className="text-xs text-slate-500">Aparelhos aguardando análise, peça, aprovação ou retirada</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/os')}
              className="text-sm font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {osRecentesBancada.map((os) => {
              const cli = mapaClientes.get(os.clienteId);
              const apa = mapaAparelhos.get(os.aparelhoId);
              const st = STATUS_OS_LABELS[os.status];
              return (
                <div
                  key={os.id}
                  onClick={() => navigate(`/os?abrir=${os.id}`)}
                  className="px-5 py-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-sky-700">
                        #{formatarNumeroOS(os.numero)}
                      </span>
                      {os.prioridade === 'urgente' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-rose-100 text-rose-700">
                          Urgente
                        </span>
                      )}
                      <span className="font-semibold text-slate-900 text-sm truncate">
                        {cli?.nome || 'Cliente'}
                      </span>
                      <span className="text-xs text-slate-500">
                        • {apa ? `${apa.marca} ${apa.modelo}` : 'Aparelho'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-1">{os.defeitoRelatado}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${st.cor}`}
                      >
                        {st.label}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Prev: {formatarData(os.previsaoEntrega)} •{' '}
                        <strong className="text-slate-800">
                          {os.totalCentavos > 0 ? formatarMoeda(os.totalCentavos) : 'Sob análise'}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alertas de Estoque Baixo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Alerta de Reposição</h3>
              <p className="text-xs text-slate-500">Peças e acessórios no estoque mínimo</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/produtos')}
              className="text-sm font-semibold text-sky-600 hover:text-sky-700"
            >
              Estoque
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {produtosEstoqueBaixo.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Todas as peças estão com estoque acima do mínimo.
              </div>
            ) : (
              produtosEstoqueBaixo.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/produtos?produtoId=${p.id}`)}
                  className="px-5 py-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{p.descricao}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cód: {p.codigo} • Local: {p.localizacao || 'Balcão'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        p.estoqueAtual === 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.estoqueAtual} {p.unidade}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Mín: {p.estoqueMinimo}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
