import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3,
  Plus,
  Lock,
  Unlock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  X,
  TrendingUp,
  FileSpreadsheet,
  History,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  financeiroRepo,
  osRepo,
  vendaRepo,
  configRepo,
} from '@/repositories/localStorageRepo';
import {
  FormaPagamentoTipo,
  SessaoCaixa,
  LancamentoFinanceiro,
} from '@/types/domain';
import {
  formatarMoeda,
  formatarData,
  formatarDataHora,
  caixaEhDeDiaAnterior,
} from '@/utils/formatters';
import { STATUS_OS_LABELS } from '@/features/dashboard/DashboardPage';
import { ThermalReceiptModal } from '@/features/impressao/ThermalReceiptModal';
import { useToast } from '@/components/ui/Toast';
import { addMonths, parseISO, differenceInHours, subDays } from 'date-fns';

const CORES_GRAFICO = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

export const FinanceiroPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const [aba, setAba] = useState<'caixa' | 'receber' | 'pagar' | 'relatorios'>('caixa');

  // Estado Abertura / Fechamento / Sangria / Suprimento de Caixa
  const [valorInicialReais, setValorInicialReais] = useState('200,00');
  const [modalMovimentoCaixa, setModalMovimentoCaixa] = useState<
    'suprimento' | 'sangria' | null
  >(null);
  const [valorMovimentoReais, setValorMovimentoReais] = useState('');
  const [descMovimentoCaixa, setDescMovimentoCaixa] = useState('');

  const [modalFecharCaixa, setModalFecharCaixa] = useState(false);
  const [valorContadoReais, setValorContadoReais] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');
  const [sessaoParaImprimir, setSessaoParaImprimir] = useState<SessaoCaixa | null>(
    null
  );

  // Modal de Novo Lançamento (Conta a Pagar ou Receber)
  const [modalLancamentoTipo, setModalLancamentoTipo] = useState<
    'entrada' | 'saida' | null
  >(null);
  const [formLancamento, setFormLancamento] = useState({
    categoria: '',
    descricao: '',
    valorReais: '',
    dataVencimento: new Date().toISOString().slice(0, 10),
    recorrenteMensal: false,
    pagoAgora: false,
    formaPagamento: 'pix' as FormaPagamentoTipo,
  });

  const { data: caixaAberto } = useQuery({
    queryKey: ['caixaAberto'],
    queryFn: () => financeiroRepo.obterCaixaAberto(),
  });

  const { data: sessoesCaixa = [] } = useQuery({
    queryKey: ['sessoesCaixa'],
    queryFn: () => financeiroRepo.listarSessoesCaixa(),
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ['lancamentosFinanceiros'],
    queryFn: () => financeiroRepo.listarLancamentos(),
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordensServico'],
    queryFn: () => osRepo.listar(),
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => vendaRepo.listar(),
  });

  const { data: config } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => configRepo.obterConfiguracoes(),
  });

  const converterReaisParaCentavos = (txt: string) => {
    const limpo = txt.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  // Cálculo do Caixa Atual e Trava de Dia Anterior
  const caixaDiaAnterior = Boolean(
    caixaAberto && caixaEhDeDiaAnterior(caixaAberto.aberturaData)
  );

  const saldoCaixaAtual =
    caixaAberto?.movimentos.reduce((acc, m) => acc + m.valorCentavos, 0) ?? 0;

  const saldoDinheiroGaveta =
    caixaAberto?.movimentos
      .filter((m) => m.formaPagamento === 'dinheiro')
      .reduce((acc, m) => acc + m.valorCentavos, 0) ?? 0;

  // Simular ou Restaurar Data de Abertura (para testar trava de dia anterior com 1 toque)
  const alternarDataCaixaMutation = useMutation({
    mutationFn: async () => {
      if (!caixaAberto) throw new Error('Nenhum caixa aberto');
      const novaData = caixaDiaAnterior
        ? new Date().toISOString()
        : subDays(new Date(), 1).toISOString();
      return financeiroRepo.alterarDataAberturaCaixa(caixaAberto.id, novaData);
    },
    onSuccess: (atualizado) => {
      queryClient.invalidateQueries();
      if (caixaEhDeDiaAnterior(atualizado.aberturaData)) {
        notificar(
          'Simulação ativada: O caixa atual agora consta como aberto ONTEM. Vendas e recebimentos foram bloqueados até o fechamento!',
          'aviso'
        );
      } else {
        notificar('Data de abertura do caixa restaurada para hoje.', 'sucesso');
      }
    },
  });

  // Abrir Caixa
  const abrirCaixaMutation = useMutation({
    mutationFn: () =>
      financeiroRepo.abrirCaixa(
        converterReaisParaCentavos(valorInicialReais),
        'Abertura de turno no balcão'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries();
      notificar('Caixa aberto com sucesso!', 'sucesso');
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao abrir caixa', 'erro');
    },
  });

  // Sangria ou Suprimento
  const registrarSangriaSuprimentoMutation = useMutation({
    mutationFn: async () => {
      if (caixaDiaAnterior) {
        throw new Error(
          'Trava de Caixa: Feche o caixa do dia anterior antes de lançar suprimentos ou sangrias.'
        );
      }
      const centavos = converterReaisParaCentavos(valorMovimentoReais);
      if (centavos <= 0) throw new Error('Informe um valor válido.');
      const ehSangria = modalMovimentoCaixa === 'sangria';
      return financeiroRepo.registrarMovimentoCaixa({
        tipo: ehSangria ? 'sangria' : 'suprimento',
        descricao:
          descMovimentoCaixa.trim() ||
          (ehSangria ? 'Sangria de valores em espécie' : 'Suprimento de troco'),
        valorCentavos: ehSangria ? -centavos : centavos,
        formaPagamento: 'dinheiro',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setModalMovimentoCaixa(null);
      setValorMovimentoReais('');
      setDescMovimentoCaixa('');
      notificar('Movimento registrado no caixa!', 'sucesso');
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao registrar movimento', 'erro');
    },
  });

  // Fechar Caixa
  const fecharCaixaMutation = useMutation({
    mutationFn: async () => {
      if (!caixaAberto) throw new Error('Nenhum caixa aberto.');
      const contado = converterReaisParaCentavos(valorContadoReais);
      return financeiroRepo.fecharCaixa(caixaAberto.id, contado, obsFechamento);
    },
    onSuccess: (fechada) => {
      queryClient.invalidateQueries();
      setModalFecharCaixa(false);
      setSessaoParaImprimir(fechada);
      notificar('Caixa fechado! Confira o comprovante de fechamento.', 'sucesso');
    },
  });

  // Baixar Conta a Receber ou Conta a Pagar
  const baixarLancamento = async (
    lanc: LancamentoFinanceiro,
    forma: FormaPagamentoTipo = 'pix'
  ) => {
    if (!caixaAberto) {
      notificar('Abra o caixa do dia antes de dar baixa em títulos.', 'erro');
      return;
    }
    if (caixaDiaAnterior) {
      notificar(
        'Trava de Caixa: O caixa aberto pertence a um dia anterior. Feche o caixa anterior antes de dar baixa em títulos!',
        'erro'
      );
      return;
    }

    const agora = new Date().toISOString();
    await financeiroRepo.atualizarLancamento(lanc.id, {
      status: 'pago',
      dataPagamento: agora,
      formaPagamento: forma,
    });

    // Alimenta o caixa aberto
    await financeiroRepo.registrarMovimentoCaixa({
      tipo: lanc.tipo === 'entrada' ? 'recebimento_os' : 'despesa',
      descricao: `Baixa: ${lanc.descricao}`,
      valorCentavos: lanc.tipo === 'entrada' ? lanc.valorCentavos : -lanc.valorCentavos,
      formaPagamento: forma,
      origemId: lanc.id,
    });

    // Se for despesa recorrente mensal, já cria a do próximo mês
    if (lanc.tipo === 'saida' && lanc.recorrenteMensal) {
      const proxVenc = addMonths(parseISO(lanc.dataVencimento), 1).toISOString();
      await financeiroRepo.criarLancamento({
        tipo: 'saida',
        categoria: lanc.categoria,
        descricao: lanc.descricao,
        valorCentavos: lanc.valorCentavos,
        dataVencimento: proxVenc,
        status: 'pendente',
        origem: 'manual',
        recorrenteMensal: true,
      });
    }

    queryClient.invalidateQueries();
    notificar('Título baixado e lançado no caixa!', 'sucesso');
  };

  // Criar Novo Lançamento Manual
  const criarLancamentoMutation = useMutation({
    mutationFn: async () => {
      if (!modalLancamentoTipo) throw new Error('Tipo inválido');
      const valorCentavos = converterReaisParaCentavos(formLancamento.valorReais);
      if (!formLancamento.descricao.trim() || valorCentavos <= 0) {
        throw new Error('Preencha descrição e valor.');
      }
      if (formLancamento.pagoAgora) {
        if (!caixaAberto) {
          throw new Error('Abra o caixa do dia antes de registrar um título já pago/recebido.');
        }
        if (caixaDiaAnterior) {
          throw new Error(
            'Trava de Caixa: O caixa aberto é de um dia anterior. Feche o caixa anterior antes de movimentar valores.'
          );
        }
      }
      const agora = new Date().toISOString();
      const vencIso = new Date(`${formLancamento.dataVencimento}T12:00:00`).toISOString();

      const criado = await financeiroRepo.criarLancamento({
        tipo: modalLancamentoTipo,
        categoria:
          formLancamento.categoria ||
          (modalLancamentoTipo === 'entrada' ? 'Outros Recebimentos' : 'Outras Despesas'),
        descricao: formLancamento.descricao.trim(),
        valorCentavos,
        dataVencimento: vencIso,
        dataPagamento: formLancamento.pagoAgora ? agora : undefined,
        status: formLancamento.pagoAgora ? 'pago' : 'pendente',
        formaPagamento: formLancamento.pagoAgora
          ? formLancamento.formaPagamento
          : undefined,
        origem: 'manual',
        recorrenteMensal: formLancamento.recorrenteMensal,
      });

      if (formLancamento.pagoAgora) {
        await financeiroRepo.registrarMovimentoCaixa({
          tipo: modalLancamentoTipo === 'entrada' ? 'suprimento' : 'despesa',
          descricao: criado.descricao,
          valorCentavos:
            modalLancamentoTipo === 'entrada' ? valorCentavos : -valorCentavos,
          formaPagamento: formLancamento.formaPagamento,
          origemId: criado.id,
        });
      }
      return criado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setModalLancamentoTipo(null);
      notificar('Lançamento financeiro registrado!', 'sucesso');
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao criar lançamento', 'erro');
    },
  });

  // Dados para Relatórios (Seção 9.4)
  const entradasPagas = lancamentos.filter(
    (l) => l.tipo === 'entrada' && l.status === 'pago'
  );
  const saidasPagas = lancamentos.filter(
    (l) => l.tipo === 'saida' && l.status === 'pago'
  );
  const totalEntradasPagas = entradasPagas.reduce((acc, l) => acc + l.valorCentavos, 0);
  const totalSaidasPagas = saidasPagas.reduce((acc, l) => acc + l.valorCentavos, 0);

  const inadimplenciaCentavos = lancamentos
    .filter(
      (l) =>
        l.tipo === 'entrada' && (l.status === 'pendente' || l.status === 'vencido')
    )
    .reduce((acc, l) => acc + l.valorCentavos, 0);

  // Faturamento por Forma de Pagamento
  const faturamentoPorForma = [
    { nome: 'Pix', tipo: 'pix' },
    { nome: 'Dinheiro', tipo: 'dinheiro' },
    { nome: 'Débito', tipo: 'cartao_debito' },
    { nome: 'Crédito', tipo: 'cartao_credito' },
  ].map((f) => ({
    name: f.nome,
    valor:
      entradasPagas
        .filter((l) => l.formaPagamento === f.tipo)
        .reduce((acc, l) => acc + l.valorCentavos, 0) / 100,
  }));

  // OS por Status
  const osPorStatusDados = Object.entries(STATUS_OS_LABELS)
    .map(([key, info]) => ({
      name: info.label,
      quantidade: ordens.filter((o) => o.status === key).length,
    }))
    .filter((d) => d.quantidade > 0);

  // Serviços mais executados e Produtos mais vendidos
  const mapaContagemServicos = new Map<string, { descricao: string; qtd: number; receita: number }>();
  const mapaContagemProdutos = new Map<string, { descricao: string; qtd: number; receita: number }>();

  for (const os of ordens.filter((o) => o.status !== 'cancelada' && o.status !== 'reprovada')) {
    for (const item of os.itens) {
      const alvo = item.tipo === 'servico' ? mapaContagemServicos : mapaContagemProdutos;
      const atual = alvo.get(item.descricao) || { descricao: item.descricao, qtd: 0, receita: 0 };
      atual.qtd += item.quantidade;
      atual.receita += item.quantidade * item.valorUnitarioCentavos;
      alvo.set(item.descricao, atual);
    }
  }

  for (const v of vendas.filter((vnd) => vnd.status === 'concluida')) {
    for (const item of v.itens) {
      const alvo = item.tipo === 'servico' ? mapaContagemServicos : mapaContagemProdutos;
      const atual = alvo.get(item.descricao) || { descricao: item.descricao, qtd: 0, receita: 0 };
      atual.qtd += item.quantidade;
      atual.receita += item.quantidade * item.valorUnitarioCentavos;
      alvo.set(item.descricao, atual);
    }
  }

  const topServicos = Array.from(mapaContagemServicos.values()).sort(
    (a, b) => b.receita - a.receita
  );
  const topProdutos = Array.from(mapaContagemProdutos.values()).sort(
    (a, b) => b.receita - a.receita
  );

  // Tempo médio de reparo (OS entregues)
  const osEntregues = ordens.filter((o) => o.status === 'entregue' && o.dataSaida);
  const mediaHorasReparo =
    osEntregues.length > 0
      ? Math.round(
          osEntregues.reduce(
            (acc, o) =>
              acc +
              Math.max(
                1,
                differenceInHours(parseISO(o.dataSaida!), parseISO(o.dataEntrada))
              ),
            0
          ) / osEntregues.length
        )
      : 24;

  // Lucro Estimado Total (Receita OS/Vendas - Custos de Peças - Despesas Pagas)
  const custoPecasOS = ordens
    .filter((o) => o.status === 'entregue')
    .reduce(
      (acc, o) =>
        acc +
        o.itens
          .filter((i) => i.tipo === 'peca')
          .reduce((s, i) => s + i.quantidade * i.custoUnitarioCentavos, 0),
      0
    );

  const custoProdutosVendas = vendas
    .filter((v) => v.status === 'concluida')
    .reduce(
      (acc, v) =>
        acc +
        v.itens.reduce((s, i) => s + i.quantidade * i.custoUnitarioCentavos, 0),
      0
    );

  const lucroBrutoOperacional =
    totalEntradasPagas - custoPecasOS - custoProdutosVendas;

  return (
    <div className="space-y-5">
      {/* Topo e Navegação de Abas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Gestão Financeira, Sessão de Caixa e Relatórios
            </h2>
            <p className="text-sm text-slate-500">
              Controle diário de gaveta, contas a receber, despesas fixas/variáveis e indicadores
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/os?visao=relatorio')}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Relatório Peças/Serviços OS</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFormLancamento({
                  categoria: config?.categoriasReceita[0] || 'Outros Recebimentos',
                  descricao: '',
                  valorReais: '',
                  dataVencimento: new Date().toISOString().slice(0, 10),
                  recorrenteMensal: false,
                  pagoAgora: false,
                  formaPagamento: 'pix',
                });
                setModalLancamentoTipo('entrada');
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Receita</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFormLancamento({
                  categoria: config?.categoriasDespesa[0] || 'Outras Despesas',
                  descricao: '',
                  valorReais: '',
                  dataVencimento: new Date().toISOString().slice(0, 10),
                  recorrenteMensal: false,
                  pagoAgora: false,
                  formaPagamento: 'pix',
                });
                setModalLancamentoTipo('saida');
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Despesa / Conta</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {[
            { id: 'caixa', label: 'Caixa do Dia (Gaveta)', icone: Wallet },
            { id: 'receber', label: 'Contas a Receber', icone: ArrowUpCircle },
            { id: 'pagar', label: 'Contas a Pagar', icone: ArrowDownCircle },
            {
              id: 'relatorios',
              label: 'Fluxo de Caixa e Relatórios',
              icone: BarChart3,
            },
          ].map((item) => {
            const Icone = item.icone;
            const ativa = aba === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id as typeof aba)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                  ativa
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Icone className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ABA 1: SESSÃO DE CAIXA DO DIA */}
      {aba === 'caixa' && (
        <div className="space-y-5">
          {!caixaAberto ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
                <Unlock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">O Caixa Está Fechado</h3>
              <p className="text-xs text-slate-500">
                Informe o fundo de troco inicial em dinheiro para abrir o caixa do dia.
              </p>
              <input
                type="text"
                value={valorInicialReais}
                onChange={(e) => setValorInicialReais(e.target.value)}
                className="w-full min-h-[46px] px-4 py-2 rounded-xl border border-slate-300 text-center font-bold text-base"
              />
              <button
                type="button"
                onClick={() => abrirCaixaMutation.mutate()}
                className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
              >
                Abrir Caixa Agora
              </button>
            </div>
          ) : (
            <>
              {/* BANNER DE TRAVA DE CAIXA DO DIA ANTERIOR */}
              {caixaDiaAnterior && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-rose-950">
                        TRAVA DE SEGURANÇA ATIVA: Caixa Aberto em Dia Anterior!
                      </h3>
                      <p className="text-xs text-rose-800 mt-1">
                        Esta sessão foi aberta em{' '}
                        <strong className="underline">
                          {formatarDataHora(caixaAberto.aberturaData)}
                        </strong>
                        . Novas Vendas no PDV, Entregas de OS e Suprimentos/Sangrias estão{' '}
                        <strong>bloqueados</strong> até que você realize o fechamento deste
                        caixa anterior e abra o caixa de hoje.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setValorContadoReais(
                        (saldoCaixaAtual / 100).toFixed(2).replace('.', ',')
                      );
                      setModalFecharCaixa(true);
                    }}
                    className="min-h-[46px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shrink-0 shadow-xs"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Fechar Caixa Anterior Agora</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      Saldo Total da Sessão
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        caixaDiaAnterior
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {caixaDiaAnterior ? 'Dia Anterior (Bloqueado)' : 'Caixa do Dia Ativo'}
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                    {formatarMoeda(saldoCaixaAtual)}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-xs text-slate-500">
                      Aberto em {formatarDataHora(caixaAberto.aberturaData)}
                    </span>
                    <button
                      type="button"
                      onClick={() => alternarDataCaixaMutation.mutate()}
                      className="text-[11px] font-semibold text-sky-700 hover:underline"
                      title="Permite simular um caixa esquecido aberto no dia anterior para validar a trava de vendas"
                    >
                      {caixaDiaAnterior
                        ? 'Restaurar p/ Hoje'
                        : 'Simular Caixa de Ontem'}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold uppercase text-slate-400">
                    Dinheiro Físico na Gaveta
                  </span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {formatarMoeda(saldoDinheiroGaveta)}
                  </p>
                  <span className="text-xs text-slate-500">
                    Troco inicial: {formatarMoeda(caixaAberto.valorInicialCentavos)}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={caixaDiaAnterior}
                    onClick={() => setModalMovimentoCaixa('suprimento')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 disabled:opacity-40 text-sky-700 text-xs font-bold"
                  >
                    + Suprimento
                  </button>
                  <button
                    type="button"
                    disabled={caixaDiaAnterior}
                    onClick={() => setModalMovimentoCaixa('sangria')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 text-xs font-bold"
                  >
                    - Sangria
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setValorContadoReais(
                        (saldoCaixaAtual / 100).toFixed(2).replace('.', ',')
                      );
                      setModalFecharCaixa(true);
                    }}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 ${
                      caixaDiaAnterior
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {caixaDiaAnterior ? 'Fechar Caixa Anterior' : 'Fechar Caixa'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-900">
                  Movimentações da Sessão Atual ({caixaAberto.movimentos.length})
                </div>
                <div className="divide-y divide-slate-100 text-sm">
                  {caixaAberto.movimentos.map((m) => (
                    <div
                      key={m.id}
                      className="px-5 py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{m.descricao}</p>
                        <p className="text-xs text-slate-400">
                          {formatarDataHora(m.dataHora)} • Forma: {m.formaPagamento.toUpperCase()}
                        </p>
                      </div>
                      <span
                        className={`font-bold ${
                          m.valorCentavos >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatarMoeda(m.valorCentavos)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Histórico de Fechamentos Anteriores */}
          {sessoesCaixa.filter((s) => s.status === 'fechado').length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 font-bold text-sm text-slate-900">
                <History className="w-4 h-4 text-slate-500" />
                <span>Histórico de Fechamentos de Caixa</span>
              </div>
              <div className="divide-y divide-slate-100 text-sm">
                {sessoesCaixa
                  .filter((s) => s.status === 'fechado')
                  .map((s) => (
                    <div
                      key={s.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          Abertura: {formatarDataHora(s.aberturaData)} • Fechamento:{' '}
                          {s.fechamentoData ? formatarDataHora(s.fechamentoData) : '-'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Esperado: {formatarMoeda(s.saldoEsperadoCentavos ?? 0)} • Contado:{' '}
                          <strong>{formatarMoeda(s.valorContadoCentavos ?? 0)}</strong> •
                          Diferença:{' '}
                          <span
                            className={
                              (s.diferencaCentavos ?? 0) < 0
                                ? 'text-rose-600 font-bold'
                                : 'text-emerald-600 font-bold'
                            }
                          >
                            {formatarMoeda(s.diferencaCentavos ?? 0)}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSessaoParaImprimir(s)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Comprovante</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: CONTAS A RECEBER */}
      {aba === 'receber' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4">Descrição / Origem</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lancamentos
                .filter((l) => l.tipo === 'entrada')
                .map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {l.descricao}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{l.categoria}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {formatarData(l.dataVencimento)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          l.status === 'pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {l.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">
                      {formatarMoeda(l.valorCentavos)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {l.status !== 'pago' && (
                        <button
                          type="button"
                          onClick={() => baixarLancamento(l, 'pix')}
                          className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                        >
                          Dar Baixa (Receber)
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 3: CONTAS A PAGAR */}
      {aba === 'pagar' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4">Despesa / Fornecedor</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lancamentos
                .filter((l) => l.tipo === 'saida')
                .map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900">{l.descricao}</span>
                      {l.recorrenteMensal && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                          Mensal
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{l.categoria}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {formatarData(l.dataVencimento)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          l.status === 'pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.status === 'vencido'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {l.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600">
                      {formatarMoeda(l.valorCentavos)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {l.status !== 'pago' && (
                        <button
                          type="button"
                          onClick={() => baixarLancamento(l, 'pix')}
                          className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold"
                        >
                          Pagar Agora
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 4: FLUXO DE CAIXA E RELATÓRIOS GERENCIAIS (SEÇÃO 9.4 DO PRD) */}
      {aba === 'relatorios' && (
        <div className="space-y-6">
          {/* Cards de Resumo Gerencial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold uppercase text-slate-400">
                Receitas Recebidas
              </span>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                {formatarMoeda(totalEntradasPagas)}
              </p>
              <span className="text-xs text-slate-500">
                Despesas pagas: {formatarMoeda(totalSaidasPagas)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold uppercase text-slate-400">
                Lucro Operacional (S/ Custo Peça)
              </span>
              <p className="text-2xl font-extrabold text-sky-700 mt-1">
                {formatarMoeda(lucroBrutoOperacional)}
              </p>
              <span className="text-xs text-slate-500">
                Descontando custo das peças usadas
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold uppercase text-slate-400">
                Tempo Médio de Reparo
              </span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {mediaHorasReparo} horas
              </p>
              <span className="text-xs text-slate-500">
                Baseado em {osEntregues.length} OS finalizadas
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold uppercase text-slate-400">
                Inadimplência / A Receber
              </span>
              <p className="text-2xl font-extrabold text-rose-600 mt-1">
                {formatarMoeda(inadimplenciaCentavos)}
              </p>
              <span className="text-xs text-slate-500">
                Saldos pendentes de clientes
              </span>
            </div>
          </div>

          {/* Gráficos Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm mb-4">
                Faturamento por Forma de Pagamento (R$)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faturamentoPorForma}>
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(val: number) => `R$ ${val.toFixed(2)}`} />
                    <Bar dataKey="valor" fill="#0284c7" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm mb-4">
                Distribuição de OS por Status
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={osPorStatusDados}
                      dataKey="quantidade"
                      nameKey="name"
                      outerRadius={80}
                      label
                    >
                      {osPorStatusDados.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Rankings: Serviços Mais Executados e Produtos Mais Vendidos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 font-bold text-sm">
                Serviços Mais Executados na Bancada
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {topServicos.slice(0, 6).map((srv, idx) => (
                  <div
                    key={idx}
                    className="px-5 py-3 flex items-center justify-between"
                  >
                    <span className="font-semibold text-slate-800">
                      {srv.qtd}x — {srv.descricao}
                    </span>
                    <strong className="text-sky-700">{formatarMoeda(srv.receita)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 font-bold text-sm">
                Peças e Acessórios Mais Vendidos
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {topProdutos.slice(0, 6).map((prd, idx) => (
                  <div
                    key={idx}
                    className="px-5 py-3 flex items-center justify-between"
                  >
                    <span className="font-semibold text-slate-800">
                      {prd.qtd}x — {prd.descricao}
                    </span>
                    <strong className="text-emerald-700">
                      {formatarMoeda(prd.receita)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sangria / Suprimento */}
      {modalMovimentoCaixa && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm uppercase">
                {modalMovimentoCaixa === 'sangria'
                  ? 'Registrar Sangria do Caixa'
                  : 'Registrar Suprimento (Troco)'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMovimentoCaixa(null)}
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Valor (R$) *</label>
                <input
                  type="text"
                  autoFocus
                  value={valorMovimentoReais}
                  onChange={(e) => setValorMovimentoReais(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  placeholder="50,00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Motivo / Observação</label>
                <input
                  type="text"
                  value={descMovimentoCaixa}
                  onChange={(e) => setDescMovimentoCaixa(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => registrarSangriaSuprimentoMutation.mutate()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa */}
      {modalFecharCaixa && caixaAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Conferência e Fechamento de Caixa</h3>
              <button type="button" onClick={() => setModalFecharCaixa(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-100 flex justify-between text-sm">
                <span>Saldo Esperado pelo Sistema:</span>
                <strong>{formatarMoeda(saldoCaixaAtual)}</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Valor Total Contado na Conferência (R$)
                </label>
                <input
                  type="text"
                  value={valorContadoReais}
                  onChange={(e) => setValorContadoReais(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-base font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Observações</label>
                <input
                  type="text"
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => fecharCaixaMutation.mutate()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                Encerrar Turno e Imprimir Fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Lançamento Financeiro */}
      {modalLancamentoTipo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm">
                {modalLancamentoTipo === 'entrada'
                  ? 'Nova Conta a Receber / Receita'
                  : 'Nova Conta a Pagar / Despesa'}
              </h3>
              <button type="button" onClick={() => setModalLancamentoTipo(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Descrição *</label>
                <input
                  type="text"
                  autoFocus
                  value={formLancamento.descricao}
                  onChange={(e) =>
                    setFormLancamento({ ...formLancamento, descricao: e.target.value })
                  }
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Valor (R$) *</label>
                  <input
                    type="text"
                    value={formLancamento.valorReais}
                    onChange={(e) =>
                      setFormLancamento({ ...formLancamento, valorReais: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Vencimento</label>
                  <input
                    type="date"
                    value={formLancamento.dataVencimento}
                    onChange={(e) =>
                      setFormLancamento({
                        ...formLancamento,
                        dataVencimento: e.target.value,
                      })
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={formLancamento.pagoAgora}
                  onChange={(e) =>
                    setFormLancamento({ ...formLancamento, pagoAgora: e.target.checked })
                  }
                  className="w-4 h-4 rounded"
                />
                <span>Já foi pago / recebido hoje (lançar direto no Caixa)</span>
              </label>
              {modalLancamentoTipo === 'saida' && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formLancamento.recorrenteMensal}
                    onChange={(e) =>
                      setFormLancamento({
                        ...formLancamento,
                        recorrenteMensal: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span>Despesa fixa com recorrência mensal</span>
                </label>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => criarLancamentoMutation.mutate()}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
              >
                Salvar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão Térmica de Fechamento de Caixa */}
      {config && sessaoParaImprimir && (
        <ThermalReceiptModal
          aberto={!!sessaoParaImprimir}
          aoFechar={() => setSessaoParaImprimir(null)}
          tipo="fechamento_caixa"
          config={config}
          sessaoCaixa={sessaoParaImprimir}
        />
      )}
    </div>
  );
};
