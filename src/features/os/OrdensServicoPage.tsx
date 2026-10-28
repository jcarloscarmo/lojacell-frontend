import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusCircle,
  Search,
  LayoutList,
  Kanban,
  Printer,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Clock,
  Save,
  FileBarChart,
  Calendar,
  Lock,
  RotateCcw,
  Edit3,
  Package,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import {
  osRepo,
  clienteRepo,
  aparelhoRepo,
  produtoRepo,
  servicoRepo,
  financeiroRepo,
  configRepo,
} from '@/repositories/localStorageRepo';
import {
  OrdemServico,
  StatusOS,
  FormaPagamentoTipo,
  ItemOS,
} from '@/types/domain';
import {
  formatarMoeda,
  formatarData,
  formatarDataHora,
  formatarNumeroOS,
  gerarId,
  caixaEhDeDiaAnterior,
  formatarAroPeca,
} from '@/utils/formatters';
import { STATUS_OS_LABELS } from '@/features/dashboard/DashboardPage';
import {
  ThermalReceiptModal,
  TipoDocumentoTermico,
} from '@/features/impressao/ThermalReceiptModal';
import { useToast } from '@/components/ui/Toast';
import { isBefore, parseISO, startOfDay, endOfDay, addDays } from 'date-fns';
import { LancadorPecaManualOS } from './LancadorPecaManualOS';
import { RelatorioOSPecasServicos } from './RelatorioOSPecasServicos';

const TODOS_STATUS: StatusOS[] = [
  'aguardando_analise',
  'em_analise',
  'aguardando_aprovacao',
  'aprovada_em_reparo',
  'aguardando_peca',
  'pronta_retirada',
  'entregue',
  'reprovada',
  'cancelada',
];

export type OperadorFiltroDataOS = 'todas' | 'igual' | 'menor' | 'maior' | 'entre';

export const OrdensServicoPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const [visao, setVisao] = useState<'tabela' | 'kanban' | 'relatorio'>(
    searchParams.get('visao') === 'relatorio' ? 'relatorio' : 'tabela'
  );
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>(
    searchParams.get('status') || 'abertas'
  );
  const [apenasAtrasadas, setApenasAtrasadas] = useState(
    searchParams.get('filtro') === 'atrasadas'
  );
  const [tecnicoFiltro, setTecnicoFiltro] = useState('todos');
  const [criandoNovoTecnicoModal, setCriandoNovoTecnicoModal] = useState(false);
  const [novoTecnicoModalTexto, setNovoTecnicoModalTexto] = useState('');
  const [mostrarFiltrosData, setMostrarFiltrosData] = useState(false);

  // Filtro de Data com Operadores (=, <=, >=, entre)
  const [operadorData, setOperadorData] = useState<OperadorFiltroDataOS>('todas');
  const [campoDataFiltro, setCampoDataFiltro] = useState<'entrada' | 'saida'>('entrada');
  const [dataFiltroValor, setDataFiltroValor] = useState<string>('');
  const [dataFiltroFim, setDataFiltroFim] = useState<string>('');

  // OS aberta no Modal de Detalhes / Bancada
  const [osAbertaId, setOsAbertaId] = useState<string | null>(searchParams.get('abrir'));
  const [buscaNovoItem, setBuscaNovoItem] = useState('');
  const [mostrarBuscaCatalogoModal, setMostrarBuscaCatalogoModal] = useState(false);
  const [mostrarHistoricoModal, setMostrarHistoricoModal] = useState(false);
  const [itemOSEmEdicao, setItemOSEmEdicao] = useState<ItemOS | null>(null);
  const [laudoEdit, setLaudoEdit] = useState('');
  const [solucaoEdit, setSolucaoEdit] = useState('');
  const [obsInternaEdit, setObsInternaEdit] = useState('');

  // Modal de Entrega e Recebimento (com escolha do dia em que o pagamento vai entrar)
  const [modalEntregaAberto, setModalEntregaAberto] = useState(false);
  const [formaPagamentoEntrega, setFormaPagamentoEntrega] =
    useState<FormaPagamentoTipo>('pix');
  const [valorPagoEntregaReais, setValorPagoEntregaReais] = useState('0,00');
  const [dataPagamentoEntrega, setDataPagamentoEntrega] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );

  // Modal de Impressão Térmica
  const [impressaoConfig, setImpressaoConfig] = useState<{
    aberto: boolean;
    tipo: TipoDocumentoTermico;
    os?: OrdemServico;
  }>({ aberto: false, tipo: 'entrada_os' });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordensServico'],
    queryFn: () => osRepo.listar(),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => clienteRepo.listar(),
  });

  const { data: aparelhos = [] } = useQuery({
    queryKey: ['aparelhos'],
    queryFn: () => aparelhoRepo.listar(),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => produtoRepo.listar(),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => servicoRepo.listar(),
  });

  const { data: config } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => configRepo.obterConfiguracoes(),
  });

  const { data: caixaAberto } = useQuery({
    queryKey: ['caixaAberto'],
    queryFn: () => financeiroRepo.obterCaixaAberto(),
  });

  const caixaTravadoDiaAnterior = caixaEhDeDiaAnterior(caixaAberto?.aberturaData);

  const osSelecionada = ordens.find((o) => o.id === osAbertaId) || null;
  const osFechada = osSelecionada
    ? ['entregue', 'cancelada', 'reprovada'].includes(osSelecionada.status)
    : false;

  useEffect(() => {
    const abrirParam = searchParams.get('abrir');
    const imprimirParam = searchParams.get('imprimir');
    const visaoParam = searchParams.get('visao');
    if (visaoParam === 'relatorio') {
      setVisao('relatorio');
    }
    if (abrirParam) {
      setOsAbertaId(abrirParam);
      const osAlvo = ordens.find((o) => o.id === abrirParam);
      if (osAlvo) {
        setLaudoEdit(osAlvo.laudoTecnico || '');
        setSolucaoEdit(osAlvo.solucaoAplicada || '');
        setObsInternaEdit(osAlvo.observacoesInternas || '');
        if (imprimirParam === 'entrada') {
          setImpressaoConfig({ aberto: true, tipo: 'entrada_os', os: osAlvo });
        }
      }
    }
  }, [searchParams, ordens]);

  const mapaClientes = new Map(clientes.map((c) => [c.id, c]));
  const mapaAparelhos = new Map(aparelhos.map((a) => [a.id, a]));
  const mapaProdutos = new Map(produtos.map((p) => [p.id, p]));
  const hojeInicio = startOfDay(new Date());

  const qtdOSAbertas = ordens.filter(
    (o) => !['entregue', 'reprovada', 'cancelada'].includes(o.status)
  ).length;

  const ordensFiltradas = ordens.filter((os) => {
    if (statusFiltro === 'abertas') {
      if (['entregue', 'reprovada', 'cancelada'].includes(os.status)) return false;
    } else if (statusFiltro !== 'todos' && os.status !== statusFiltro) {
      return false;
    }
    if (tecnicoFiltro !== 'todos' && os.tecnicoResponsavel !== tecnicoFiltro) return false;
    if (apenasAtrasadas) {
      if (['entregue', 'reprovada', 'cancelada'].includes(os.status) || !os.previsaoEntrega) {
        return false;
      }
      if (!isBefore(parseISO(os.previsaoEntrega), hojeInicio)) return false;
    }

    // Filtro por Data com Operadores (Igual a, Menor que, Maior que, Entre datas)
    if (operadorData !== 'todas' && dataFiltroValor) {
      const dataStrAlvo =
        campoDataFiltro === 'saida' ? os.dataSaida || os.dataEntrada : os.dataEntrada;
      if (!dataStrAlvo) return false;

      const diaOS = startOfDay(parseISO(dataStrAlvo)).getTime();
      const diaFiltro1 = startOfDay(parseISO(dataFiltroValor)).getTime();

      if (operadorData === 'igual') {
        if (diaOS !== diaFiltro1) return false;
      } else if (operadorData === 'menor') {
        if (diaOS > diaFiltro1) return false;
      } else if (operadorData === 'maior') {
        if (diaOS < diaFiltro1) return false;
      } else if (operadorData === 'entre') {
        if (diaOS < diaFiltro1) return false;
        if (dataFiltroFim) {
          const diaFiltro2 = endOfDay(parseISO(dataFiltroFim)).getTime();
          if (parseISO(dataStrAlvo).getTime() > diaFiltro2) return false;
        }
      }
    }

    const q = busca.trim().toLowerCase();
    if (!q) return true;
    const cli = mapaClientes.get(os.clienteId);
    const apa = mapaAparelhos.get(os.aparelhoId);
    return (
      formatarNumeroOS(os.numero).includes(q) ||
      String(os.numero).includes(q) ||
      (cli?.nome.toLowerCase().includes(q) ?? false) ||
      (cli?.telefone.includes(q) ?? false) ||
      (apa?.modelo.toLowerCase().includes(q) ?? false) ||
      (apa?.marca.toLowerCase().includes(q) ?? false) ||
      (apa?.imeiSerial?.toLowerCase().includes(q) ?? false) ||
      os.defeitoRelatado.toLowerCase().includes(q) ||
      os.itens.some((i) => i.descricao.toLowerCase().includes(q))
    );
  });

  // Lógica de Preclusão e Reabertura de Ordem Fechada (Estornando Recebimentos e Estoque)
  const reabrirOSComEstorno = async (os: OrdemServico) => {
    const totalJaPago = os.pagamentos.reduce((acc, p) => acc + p.valorCentavos, 0);
    const dataBaixaFmt = os.dataSaida ? formatarData(os.dataSaida) : 'data do encerramento';

    const confirmou = window.confirm(
      `REABRIR ORDEM #${formatarNumeroOS(os.numero)} (ESTORNO DE PRECLUSÃO)\n\n` +
        `Ao reabrir esta ordem encerrada:\n` +
        `1. Os valores financeiros e de caixa lançados em ${dataBaixaFmt} (${formatarMoeda(
          totalJaPago || os.totalCentavos
        )}) serão ESTORNADOS.\n` +
        `2. A ordem voltará para "Aprovada / Em reparo", permitindo editar peças, valores e encerrar novamente com uma nova data de pagamento.\n\n` +
        `Deseja confirmar o estorno e reabertura da OS?`
    );
    if (!confirmou) return;

    const estorno = await financeiroRepo.estornarRecebimentosOS(os.id);

    let estoqueBaixado = os.estoqueBaixado;
    if (os.estoqueBaixado) {
      for (const item of os.itens) {
        if (item.tipo === 'peca' && !item.manual && mapaProdutos.has(item.referenciaId)) {
          await produtoRepo.ajustarEstoque({
            produtoId: item.referenciaId,
            quantidadeDelta: item.quantidade,
            tipo: 'estorno',
            origemId: os.id,
            motivo: `Estorno por reabertura da OS #${formatarNumeroOS(os.numero)}`,
          });
        }
      }
      estoqueBaixado = false;
    }

    const agora = new Date().toISOString();
    await osRepo.atualizar(os.id, {
      status: 'aprovada_em_reparo',
      dataSaida: undefined,
      fimGarantiaEm: undefined,
      formaPagamento: undefined,
      pagamentos: [],
      estoqueBaixado,
      historicoStatus: [
        ...os.historicoStatus,
        {
          status: 'aprovada_em_reparo',
          dataHora: agora,
          usuario: 'Administrador',
          observacao: `OS reaberta após preclusão. Estornado: ${formatarMoeda(
            estorno.valorTotalEstornadoCentavos
          )} (${estorno.lancamentosEstornados} lançamentos financeiros estornados${
            estorno.datasEstornadas.length > 0
              ? ` das datas: ${estorno.datasEstornadas.map((d) => formatarData(d)).join(', ')}`
              : ''
          }).`,
        },
      ],
    });

    queryClient.invalidateQueries();
    notificar(
      `OS #${formatarNumeroOS(os.numero)} reaberta! Valores estornados (${formatarMoeda(
        estorno.valorTotalEstornadoCentavos
      )}) e edição liberada.`,
      'sucesso'
    );
  };

  // Regra de Negócio Seção 8.2 e 8.3: Mudança de Status + Preclusão + Baixa/Estorno de Estoque
  const alterarStatusOS = async (os: OrdemServico, novoStatus: StatusOS) => {
    if (os.status === novoStatus) return;

    // Regra de Preclusão: Ordem fechada não pode mudar status diretamente sem passar pelo estorno de reabertura
    if (['entregue', 'cancelada', 'reprovada'].includes(os.status)) {
      notificar(
        'Ordem encerrada (Preclusão ativa). Utilize o botão "Reabrir Ordem e Estornar Valores" para liberar edições.',
        'aviso'
      );
      return;
    }

    // Regra: Ao marcar como Entregue, abrir modal de pagamento e escolha da data do pagamento
    if (novoStatus === 'entregue') {
      const jaPago = os.pagamentos.reduce((acc, p) => acc + p.valorCentavos, 0);
      const faltaPagar = Math.max(0, os.totalCentavos - jaPago);
      setValorPagoEntregaReais(((faltaPagar || 0) / 100).toFixed(2).replace('.', ','));
      setDataPagamentoEntrega(new Date().toISOString().slice(0, 10));
      setModalEntregaAberto(true);
      return;
    }

    let estoqueBaixado = os.estoqueBaixado;

    // Regra: Baixar peças do estoque ao entrar em "Aprovada / Em reparo" (apenas peças vinculadas ao estoque)
    if (novoStatus === 'aprovada_em_reparo' && !os.estoqueBaixado) {
      for (const item of os.itens) {
        if (item.tipo === 'peca' && !item.manual && mapaProdutos.has(item.referenciaId)) {
          await produtoRepo.ajustarEstoque({
            produtoId: item.referenciaId,
            quantidadeDelta: -item.quantidade,
            tipo: 'saida_os',
            origemId: os.id,
            motivo: `Baixa automática na aprovação da OS #${formatarNumeroOS(os.numero)}`,
          });
        }
      }
      estoqueBaixado = true;
      notificar('Status aprovado e peças de estoque baixadas!', 'sucesso');
    }

    // Regra: Cancelar uma OS com peças já baixadas devolve as peças ao estoque
    if (novoStatus === 'cancelada' && os.estoqueBaixado) {
      const devolver = window.confirm(
        `A OS #${formatarNumeroOS(os.numero)} possui peças registradas. Confirmar cancelamento e devolução das peças de catálogo ao estoque?`
      );
      if (!devolver) return;
      for (const item of os.itens) {
        if (item.tipo === 'peca' && !item.manual && mapaProdutos.has(item.referenciaId)) {
          await produtoRepo.ajustarEstoque({
            produtoId: item.referenciaId,
            quantidadeDelta: item.quantidade,
            tipo: 'estorno',
            origemId: os.id,
            motivo: `Estorno por cancelamento da OS #${formatarNumeroOS(os.numero)}`,
          });
        }
      }
      estoqueBaixado = false;
      notificar('Peças devolvidas ao estoque após cancelamento da OS.', 'aviso');
    }

    const agora = new Date().toISOString();
    await osRepo.atualizar(os.id, {
      status: novoStatus,
      estoqueBaixado,
      laudoTecnico: laudoEdit || os.laudoTecnico,
      solucaoAplicada: solucaoEdit || os.solucaoAplicada,
      observacoesInternas: obsInternaEdit || os.observacoesInternas,
      historicoStatus: [
        ...os.historicoStatus,
        {
          status: novoStatus,
          dataHora: agora,
          usuario: 'Administrador',
        },
      ],
    });

    queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
    queryClient.invalidateQueries({ queryKey: ['produtos'] });
    queryClient.invalidateQueries({ queryKey: ['movimentacoesEstoque'] });
    notificar(`Status alterado para "${STATUS_OS_LABELS[novoStatus].label}"`, 'sucesso');
  };

  // Concluir Entrega + Escolha da Data em que o Pagamento Entra + Conta a Receber (se parcial) + Fim da Garantia + Trava de Caixa
  const confirmarEntregaOS = async () => {
    if (!osSelecionada) return;
    if (osSelecionada.itens.length === 0) {
      notificar(
        'Adicione pelo menos um serviço ou peça antes de finalizar e entregar a OS.',
        'erro'
      );
      return;
    }

    const limpo = valorPagoEntregaReais
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const valorPagoAgoraCentavos = Math.max(0, Math.round((parseFloat(limpo) || 0) * 100));

    // TRAVA DE CAIXA DO DIA ANTERIOR OU CAIXA FECHADO (quando há recebimento financeiro)
    if (valorPagoAgoraCentavos > 0) {
      if (!caixaAberto) {
        notificar(
          'Caixa Fechado! Abra o caixa de hoje em Financeiro e Caixa antes de receber pagamentos.',
          'erro'
        );
        return;
      }
      if (caixaTravadoDiaAnterior) {
        notificar(
          'TRAVA DE CAIXA: O caixa aberto é de um dia anterior! Feche-o e abra o caixa de hoje para receber.',
          'erro'
        );
        return;
      }
    }

    const jaPagoAntes = osSelecionada.pagamentos.reduce((acc, p) => acc + p.valorCentavos, 0);
    const totalPagoFinal = jaPagoAntes + valorPagoAgoraCentavos;
    const saldoDevedorCentavos = Math.max(0, osSelecionada.totalCentavos - totalPagoFinal);

    const hojeStr = new Date().toISOString().slice(0, 10);
    const agoraISO = new Date().toISOString();
    const dataPagamentoEscolhidaISO =
      dataPagamentoEntrega && dataPagamentoEntrega !== hojeStr
        ? new Date(`${dataPagamentoEntrega}T12:00:00`).toISOString()
        : agoraISO;

    const fimGarantia = addDays(
      parseISO(dataPagamentoEscolhidaISO),
      osSelecionada.garantiaDias || 90
    ).toISOString();
    const cli = mapaClientes.get(osSelecionada.clienteId);

    // Se ainda não baixou estoque, baixa na entrega (apenas peças de estoque)
    let estoqueBaixado = osSelecionada.estoqueBaixado;
    if (!estoqueBaixado) {
      for (const item of osSelecionada.itens) {
        if (item.tipo === 'peca' && !item.manual && mapaProdutos.has(item.referenciaId)) {
          await produtoRepo.ajustarEstoque({
            produtoId: item.referenciaId,
            quantidadeDelta: -item.quantidade,
            tipo: 'saida_os',
            origemId: osSelecionada.id,
            motivo: `Baixa na entrega da OS #${formatarNumeroOS(osSelecionada.numero)}`,
          });
        }
      }
      estoqueBaixado = true;
    }

    const novosPagamentos = [...osSelecionada.pagamentos];
    if (valorPagoAgoraCentavos > 0) {
      novosPagamentos.push({
        id: gerarId(),
        formaPagamento: formaPagamentoEntrega,
        valorCentavos: valorPagoAgoraCentavos,
        dataPagamento: dataPagamentoEscolhidaISO,
      });

      // Lança entrada paga no financeiro na data de pagamento escolhida pelo usuário
      await financeiroRepo.criarLancamento({
        tipo: 'entrada',
        categoria: 'Serviços de Assistência (OS)',
        descricao: `Recebimento OS #${formatarNumeroOS(osSelecionada.numero)} — ${cli?.nome || 'Cliente'}`,
        valorCentavos: valorPagoAgoraCentavos,
        dataVencimento: dataPagamentoEscolhidaISO,
        dataPagamento: dataPagamentoEscolhidaISO,
        status: 'pago',
        formaPagamento: formaPagamentoEntrega,
        origem: 'os',
        origemId: osSelecionada.id,
        clienteId: osSelecionada.clienteId,
      });

      await financeiroRepo.registrarMovimentoCaixa({
        tipo: 'recebimento_os',
        descricao: `OS #${formatarNumeroOS(osSelecionada.numero)} (${cli?.nome || 'Cliente'}) — Data Pgto: ${formatarData(dataPagamentoEscolhidaISO)}`,
        valorCentavos: valorPagoAgoraCentavos,
        formaPagamento: formaPagamentoEntrega,
        origemId: osSelecionada.id,
      });
    }

    // Se houve pagamento parcial, gera Conta a Receber do saldo
    if (saldoDevedorCentavos > 0) {
      await financeiroRepo.criarLancamento({
        tipo: 'entrada',
        categoria: 'Serviços de Assistência (OS)',
        descricao: `Saldo a Receber OS #${formatarNumeroOS(osSelecionada.numero)} — ${cli?.nome || 'Cliente'}`,
        valorCentavos: saldoDevedorCentavos,
        dataVencimento: addDays(parseISO(dataPagamentoEscolhidaISO), 15).toISOString(),
        status: 'pendente',
        origem: 'os',
        origemId: osSelecionada.id,
        clienteId: osSelecionada.clienteId,
      });
    }

    const atualizada = await osRepo.atualizar(osSelecionada.id, {
      status: 'entregue',
      dataSaida: dataPagamentoEscolhidaISO,
      fimGarantiaEm: fimGarantia,
      formaPagamento: formaPagamentoEntrega,
      pagamentos: novosPagamentos,
      estoqueBaixado,
      laudoTecnico: laudoEdit || osSelecionada.laudoTecnico,
      solucaoAplicada: solucaoEdit || osSelecionada.solucaoAplicada,
      observacoesInternas: obsInternaEdit || osSelecionada.observacoesInternas,
      historicoStatus: [
        ...osSelecionada.historicoStatus,
        {
          status: 'entregue',
          dataHora: dataPagamentoEscolhidaISO,
          usuario: 'Administrador',
          observacao:
            saldoDevedorCentavos > 0
              ? `Entregue com pagamento parcial em ${formatarData(dataPagamentoEscolhidaISO)}. Saldo a receber: ${formatarMoeda(saldoDevedorCentavos)}`
              : `Entregue e quitada integralmente (Data do pagamento: ${formatarData(dataPagamentoEscolhidaISO)})`,
        },
      ],
    });

    queryClient.invalidateQueries();
    setModalEntregaAberto(false);
    notificar(
      saldoDevedorCentavos > 0
        ? `OS entregue! Saldo de ${formatarMoeda(saldoDevedorCentavos)} enviado para Contas a Receber.`
        : `OS encerrada com pagamento registrado em ${formatarData(dataPagamentoEscolhidaISO)}!`,
      'sucesso'
    );
    setImpressaoConfig({ aberto: true, tipo: 'entrega_garantia_os', os: atualizada });
  };

  // Adicionar ItemOS completo (seja manual vinculado ao aparelho ou do catálogo) em OS existente
  const adicionarItemCompletoNaOSSelecionada = async (novoItem: ItemOS) => {
    if (!osSelecionada || osFechada) return;

    if (
      osSelecionada.estoqueBaixado &&
      novoItem.tipo === 'peca' &&
      !novoItem.manual &&
      mapaProdutos.has(novoItem.referenciaId)
    ) {
      await produtoRepo.ajustarEstoque({
        produtoId: novoItem.referenciaId,
        quantidadeDelta: -novoItem.quantidade,
        tipo: 'saida_os',
        origemId: osSelecionada.id,
        motivo: `Peça adicionada em OS aprovada #${formatarNumeroOS(osSelecionada.numero)}`,
      });
    }

    const novosItens = [...osSelecionada.itens, novoItem];
    const subtotal = novosItens.reduce(
      (acc, i) => acc + i.quantidade * i.valorUnitarioCentavos - i.descontoCentavos,
      0
    );
    const novoTotal = Math.max(
      0,
      subtotal - osSelecionada.descontoCentavos + osSelecionada.acrescimoCentavos
    );

    await osRepo.atualizar(osSelecionada.id, {
      itens: novosItens,
      totalCentavos: novoTotal,
    });
    setBuscaNovoItem('');
    setMostrarBuscaCatalogoModal(false);
    queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
    queryClient.invalidateQueries({ queryKey: ['produtos'] });
  };

  // Atualizar peça ou serviço já vinculado à OS selecionada
  const atualizarItemNaOSSelecionada = async (itemAtualizado: ItemOS) => {
    if (!osSelecionada || osFechada) return;

    const novosItens = osSelecionada.itens.map((i) =>
      i.id === itemAtualizado.id ? itemAtualizado : i
    );
    const subtotal = novosItens.reduce(
      (acc, i) => acc + i.quantidade * i.valorUnitarioCentavos - i.descontoCentavos,
      0
    );
    const novoTotal = Math.max(
      0,
      subtotal - osSelecionada.descontoCentavos + osSelecionada.acrescimoCentavos
    );

    await osRepo.atualizar(osSelecionada.id, {
      itens: novosItens,
      totalCentavos: novoTotal,
    });
    setItemOSEmEdicao(null);
    queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
  };

  // Adicionar peça ou serviço do catálogo em OS existente
  const adicionarItemNaOSSelecionada = async (item: {
    tipo: 'peca' | 'servico';
    id: string;
    descricao: string;
    valorUnitarioCentavos: number;
    custoUnitarioCentavos: number;
  }) => {
    await adicionarItemCompletoNaOSSelecionada({
      id: gerarId(),
      tipo: item.tipo,
      referenciaId: item.id,
      descricao: item.descricao,
      quantidade: 1,
      valorUnitarioCentavos: item.valorUnitarioCentavos,
      custoUnitarioCentavos: item.custoUnitarioCentavos,
      descontoCentavos: 0,
    });
  };

  const removerItemDaOSSelecionada = async (itemId: string) => {
    if (!osSelecionada || osFechada) return;
    const alvo = osSelecionada.itens.find((i) => i.id === itemId);
    if (!alvo) return;

    if (
      osSelecionada.estoqueBaixado &&
      alvo.tipo === 'peca' &&
      !alvo.manual &&
      mapaProdutos.has(alvo.referenciaId)
    ) {
      await produtoRepo.ajustarEstoque({
        produtoId: alvo.referenciaId,
        quantidadeDelta: alvo.quantidade,
        tipo: 'estorno',
        origemId: osSelecionada.id,
        motivo: `Remoção de peça da OS #${formatarNumeroOS(osSelecionada.numero)}`,
      });
    }

    const novosItens = osSelecionada.itens.filter((i) => i.id !== itemId);
    const subtotal = novosItens.reduce(
      (acc, i) => acc + i.quantidade * i.valorUnitarioCentavos - i.descontoCentavos,
      0
    );
    const novoTotal = Math.max(
      0,
      subtotal - osSelecionada.descontoCentavos + osSelecionada.acrescimoCentavos
    );

    if (itemOSEmEdicao?.id === itemId) {
      setItemOSEmEdicao(null);
    }

    await osRepo.atualizar(osSelecionada.id, {
      itens: novosItens,
      totalCentavos: novoTotal,
    });
    queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
    queryClient.invalidateQueries({ queryKey: ['produtos'] });
  };

  const salvarLaudoOS = async () => {
    if (!osSelecionada || osFechada) return;
    await osRepo.atualizar(osSelecionada.id, {
      laudoTecnico: laudoEdit,
      solucaoAplicada: solucaoEdit,
      observacoesInternas: obsInternaEdit,
    });
    queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
    notificar('Laudo técnico e observações salvos!', 'sucesso');
  };

  // Cálculo de Lucro Interno da OS (Seção 8.3: Total serviços + (preço - custo) das peças - desconto)
  const calcularLucroOS = (os: OrdemServico) => {
    const custoTotalPecas = os.itens
      .filter((i) => i.tipo === 'peca')
      .reduce((acc, i) => acc + i.quantidade * i.custoUnitarioCentavos, 0);
    return os.totalCentavos - custoTotalPecas;
  };

  const resultadosCatalogoModal = buscaNovoItem.trim()
    ? [
        ...servicos
          .filter((s) =>
            s.descricao.toLowerCase().includes(buscaNovoItem.toLowerCase())
          )
          .map((s) => ({
            tipo: 'servico' as const,
            id: s.id,
            descricao: s.descricao,
            valorUnitarioCentavos: s.precoPadraoCentavos,
            custoUnitarioCentavos: 0,
          })),
        ...produtos
          .filter((p) =>
            p.descricao.toLowerCase().includes(buscaNovoItem.toLowerCase()) ||
            p.codigo.toLowerCase().includes(buscaNovoItem.toLowerCase())
          )
          .map((p) => ({
            tipo: 'peca' as const,
            id: p.id,
            descricao: p.descricao,
            valorUnitarioCentavos: p.precoVendaCentavos,
            custoUnitarioCentavos: p.custoCentavos,
          })),
      ].slice(0, 6)
    : [];

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Ordens de Serviço e Bancada</h2>
          <p className="text-sm text-slate-500">
            Acompanhamento de reparos, orçamentos, garantias e impressão térmica
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador Tabela / Kanban / Relatório de Peças e Serviços */}
          <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setVisao('tabela')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                visao === 'tabela' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              <span>Tabela ({ordensFiltradas.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setVisao('kanban')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                visao === 'kanban' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setVisao('relatorio')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                visao === 'relatorio'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-sky-700 hover:bg-sky-50'
              }`}
            >
              <FileBarChart className="w-4 h-4" />
              <span>Relatório de Peças e Serviços</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/os/nova')}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center gap-2 shadow-xs"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Nova OS (Alt+N)</span>
          </button>
        </div>
      </div>

      {/* VISÃO 3: RELATÓRIO DE PEÇAS E SERVIÇOS POR PERÍODO + TOTALIZADOR */}
      {visao === 'relatorio' ? (
        <RelatorioOSPecasServicos
          ordens={ordens}
          clientes={clientes}
          aparelhos={aparelhos}
          aoAbrirOS={(os) => {
            setOsAbertaId(os.id);
            setLaudoEdit(os.laudoTecnico || '');
            setSolucaoEdit(os.solucaoAplicada || '');
            setObsInternaEdit(os.observacoesInternas || '');
          }}
        />
      ) : (
        <>
          {/* Filtros de Busca, Status e Data com Operadores (=, <=, >=, Entre) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nº da OS, cliente, telefone, modelo (ex.: A14), peça ou IMEI..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusFiltro('abertas')}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    statusFiltro === 'abertas'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Em Aberto ({qtdOSAbertas})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFiltro('todos')}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    statusFiltro === 'todos'
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas ({ordens.length})
                </button>
              </div>

              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
              >
                <option value="abertas">Apenas OS em Aberto — Padrão ({qtdOSAbertas})</option>
                <option value="todos">Todos os Status — Histórico ({ordens.length})</option>
                {TODOS_STATUS.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_OS_LABELS[st].label}
                  </option>
                ))}
              </select>

              <select
                value={tecnicoFiltro}
                onChange={(e) => setTecnicoFiltro(e.target.value)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="todos">Todos os Técnicos</option>
                {(config?.tecnicosAtivos || []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <label className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={apenasAtrasadas}
                  onChange={(e) => setApenasAtrasadas(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600"
                />
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Atrasadas</span>
              </label>
              <button
                type="button"
                onClick={() => setMostrarFiltrosData((prev) => !prev)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  operadorData !== 'todas' || mostrarFiltrosData
                    ? 'bg-sky-50 border-sky-300 text-sky-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                <span>Filtro por Data</span>
                {operadorData !== 'todas' && (
                  <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white text-[10px]">
                    Ativo
                  </span>
                )}
              </button>
            </div>

            {/* Linha Colapsável de Filtro por Data (Igual a, Menor que, Maior que, Entre datas) */}
            {(mostrarFiltrosData || operadorData !== 'todas') && (
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>Filtrar por Data:</span>
                </span>

                <select
                  value={campoDataFiltro}
                  onChange={(e) => setCampoDataFiltro(e.target.value as 'entrada' | 'saida')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700"
                >
                  <option value="entrada">Data de Entrada</option>
                  <option value="saida">Data de Entrega / Pagamento</option>
                </select>

                <select
                  value={operadorData}
                  onChange={(e) => {
                    const op = e.target.value as OperadorFiltroDataOS;
                    setOperadorData(op);
                    if (op !== 'todas' && !dataFiltroValor) {
                      setDataFiltroValor(new Date().toISOString().slice(0, 10));
                    }
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-sky-800"
                >
                  <option value="todas">Qualquer data (Sem filtro)</option>
                  <option value="igual">Igual a (=)</option>
                  <option value="menor">Menor ou igual a (&lt;= Até)</option>
                  <option value="maior">Maior ou igual a (&gt;= A partir de)</option>
                  <option value="entre">Período entre datas</option>
                </select>

                {operadorData !== 'todas' && (
                  <>
                    <input
                      type="date"
                      value={dataFiltroValor}
                      onChange={(e) => setDataFiltroValor(e.target.value)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-sky-400 bg-sky-50/40 font-semibold text-slate-900"
                    />

                    {operadorData === 'entre' && (
                      <>
                        <span className="font-semibold text-slate-500">até</span>
                        <input
                          type="date"
                          value={dataFiltroFim}
                          onChange={(e) => setDataFiltroFim(e.target.value)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-sky-400 bg-sky-50/40 font-semibold text-slate-900"
                        />
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setOperadorData('todas');
                        setDataFiltroValor('');
                        setDataFiltroFim('');
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold"
                    >
                      Limpar Data
                    </button>
                  </>
                )}

                <span className="ml-auto text-slate-500 font-semibold">
                  Exibindo <strong>{ordensFiltradas.length}</strong> de {ordens.length} OS
                </span>
              </div>
            )}
          </div>

          {/* VISÃO 1: TABELA DE OS */}
          {visao === 'tabela' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4">Nº OS</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Aparelho</th>
                <th className="py-3.5 px-4">Defeito Relatado</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Entrada / Prev.</th>
                <th className="py-3.5 px-4 text-right">Total</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {ordensFiltradas.map((os) => {
                const cli = mapaClientes.get(os.clienteId);
                const apa = mapaAparelhos.get(os.aparelhoId);
                const st = STATUS_OS_LABELS[os.status];
                return (
                  <tr
                    key={os.id}
                    onClick={() => {
                      setOsAbertaId(os.id);
                      setItemOSEmEdicao(null);
                      setLaudoEdit(os.laudoTecnico || '');
                      setSolucaoEdit(os.solucaoAplicada || '');
                      setObsInternaEdit(os.observacoesInternas || '');
                    }}
                    className="hover:bg-sky-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-700 text-xs">
                      #{formatarNumeroOS(os.numero)}
                      {os.prioridade === 'urgente' && (
                        <span className="block text-[10px] text-rose-600 uppercase">Urgente</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{cli?.nome || '—'}</p>
                      <p className="text-xs text-slate-500">{cli?.telefone}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">
                        {apa ? `${apa.marca} ${apa.modelo}` : '—'}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {apa?.imeiSerial || ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-xs text-slate-700 line-clamp-2">{os.defeitoRelatado}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${st.cor}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      <p>Ent: {formatarData(os.dataEntrada)}</p>
                      <p>
                        {os.dataSaida
                          ? `Baixa: ${formatarData(os.dataSaida)}`
                          : `Prev: ${formatarData(os.previsaoEntrega)}`}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {os.totalCentavos > 0 ? formatarMoeda(os.totalCentavos) : 'Sob análise'}
                    </td>
                    <td
                      className="py-3.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setImpressaoConfig({
                            aberto: true,
                            tipo:
                              os.status === 'aguardando_aprovacao'
                                ? 'orcamento_os'
                                : os.status === 'entregue'
                                ? 'entrega_garantia_os'
                                : 'entrada_os',
                            os,
                          })
                        }
                        className="p-2 rounded-lg text-slate-500 hover:text-sky-700 hover:bg-slate-100"
                        title="Imprimir Comprovante"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* VISÃO 2: KANBAN POR STATUS */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[
            'aguardando_analise',
            'em_analise',
            'aguardando_aprovacao',
            'aprovada_em_reparo',
            'aguardando_peca',
            'pronta_retirada',
            'entregue',
          ].map((stKey) => {
            const st = stKey as StatusOS;
            const info = STATUS_OS_LABELS[st];
            const cards = ordensFiltradas.filter((o) => o.status === st);
            return (
              <div
                key={st}
                className="w-80 shrink-0 bg-slate-200/70 rounded-2xl p-3 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between px-2 py-1">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border ${info.cor}`}
                  >
                    {info.label}
                  </span>
                  <span className="text-xs font-bold text-slate-600">{cards.length}</span>
                </div>

                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  {cards.map((os) => {
                    const cli = mapaClientes.get(os.clienteId);
                    const apa = mapaAparelhos.get(os.aparelhoId);
                    return (
                      <div
                        key={os.id}
                        onClick={() => {
                          setOsAbertaId(os.id);
                          setItemOSEmEdicao(null);
                          setLaudoEdit(os.laudoTecnico || '');
                          setSolucaoEdit(os.solucaoAplicada || '');
                          setObsInternaEdit(os.observacoesInternas || '');
                        }}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-sky-400 cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-sky-700">
                            #{formatarNumeroOS(os.numero)}
                          </span>
                          <span className="font-bold text-xs text-slate-900">
                            {formatarMoeda(os.totalCentavos)}
                          </span>
                        </div>
                        <p className="font-bold text-sm text-slate-900 truncate">
                          {apa ? `${apa.marca} ${apa.modelo}` : 'Aparelho'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{cli?.nome}</p>
                        <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg">
                          {os.defeitoRelatado}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* MODAL COMPLETO DE GESTÃO DA OS (COM LÓGICA DE PRECLUSÃO, EDIÇÃO DE PEÇAS E DATA RETROATIVA) */}
      {osSelecionada && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8">
            {/* Topo do Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-extrabold text-lg text-sky-400">
                    OS #{formatarNumeroOS(osSelecionada.numero)}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      STATUS_OS_LABELS[osSelecionada.status].cor
                    }`}
                  >
                    {STATUS_OS_LABELS[osSelecionada.status].label}
                  </span>
                  {osFechada && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Preclusão Ativa (Encerrada)</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Cliente: <strong>{mapaClientes.get(osSelecionada.clienteId)?.nome}</strong> •
                  Aparelho:{' '}
                  <strong>
                    {mapaAparelhos.get(osSelecionada.aparelhoId)?.marca}{' '}
                    {mapaAparelhos.get(osSelecionada.aparelhoId)?.modelo}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setImpressaoConfig({
                      aberto: true,
                      tipo: 'entrada_os',
                      os: osSelecionada,
                    })
                  }
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-sky-400" />
                  <span>Via Entrada</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setImpressaoConfig({
                      aberto: true,
                      tipo: 'orcamento_os',
                      os: osSelecionada,
                    })
                  }
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Orçamento</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setImpressaoConfig({
                      aberto: true,
                      tipo: 'entrega_garantia_os',
                      os: osSelecionada,
                    })
                  }
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>Garantia</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOsAbertaId(null);
                    setItemOSEmEdicao(null);
                    setSearchParams({});
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
              {/* BANNER DE PRECLUSÃO PARA ORDEM FECHADA OU BOTÕES DE STATUS PARA ORDEM ABERTA */}
              {osFechada ? (
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-amber-900">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        Ordem de Serviço Encerrada ({STATUS_OS_LABELS[osSelecionada.status].label}) — Preclusão Ativa
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Esta ordem foi baixada em{' '}
                      <strong>
                        {osSelecionada.dataSaida
                          ? formatarData(osSelecionada.dataSaida)
                          : formatarData(osSelecionada.dataEntrada)}
                      </strong>{' '}
                      e encontra-se bloqueada para adição/edição de peças ou novo encerramento. Para editar peças, valores ou alterar a data do pagamento, reabra a ordem abaixo (os valores financeiros da baixa serão estornados automaticamente).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => reabrirOSComEstorno(osSelecionada)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold flex items-center justify-center gap-2 shrink-0 shadow-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reabrir Ordem e Estornar Baixa</span>
                  </button>
                </div>
              ) : (
                <div>
                  <span className="block text-xs font-bold uppercase text-slate-500 mb-2">
                    Alterar Status da OS (Registra Histórico e Controla Estoque)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {TODOS_STATUS.map((st) => {
                      const ativo = osSelecionada.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => alterarStatusOS(osSelecionada, st)}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            ativo
                              ? `${STATUS_OS_LABELS[st].cor} ring-2 ring-sky-500/40`
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {STATUS_OS_LABELS[st].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Defeito, Data de Entrada (Retroativa), Técnico Responsável, Laudo Técnico e Solução */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <span className="font-bold uppercase text-slate-500">
                    Defeito Relatado na Entrada
                  </span>
                  <p className="text-slate-900 text-sm font-medium">
                    {osSelecionada.defeitoRelatado}
                  </p>
                  {osSelecionada.condicoesFisicas && (
                    <p className="text-slate-600">
                      <strong>Condições Físicas:</strong> {osSelecionada.condicoesFisicas}
                    </p>
                  )}

                  {/* Data de Entrada da OS (Editável quando aberta para permitir ajuste retroativo) */}
                  <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Data de Entrada da OS:
                      </label>
                      {!osFechada ? (
                        <input
                          type="date"
                          value={osSelecionada.dataEntrada.slice(0, 10)}
                          onChange={async (e) => {
                            if (!e.target.value) return;
                            const novaDataISO = new Date(
                              `${e.target.value}T10:00:00`
                            ).toISOString();
                            await osRepo.atualizar(osSelecionada.id, {
                              dataEntrada: novaDataISO,
                            });
                            queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
                            notificar(
                              `Data de entrada atualizada para ${formatarData(novaDataISO)}!`,
                              'sucesso'
                            );
                          }}
                          className="w-full min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                        />
                      ) : (
                        <p className="min-h-[38px] px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 font-semibold text-slate-700">
                          {formatarData(osSelecionada.dataEntrada)}
                        </p>
                      )}
                    </div>

                    {/* Técnico Responsável editável + Cadastrar Novo Técnico */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Técnico:</label>
                        {!osFechada && (
                          <button
                            type="button"
                            onClick={() => setCriandoNovoTecnicoModal((prev) => !prev)}
                            className="text-[11px] font-bold text-sky-600 hover:underline"
                          >
                            {criandoNovoTecnicoModal ? 'Cancelar' : '+ Novo'}
                          </button>
                        )}
                      </div>
                      {!criandoNovoTecnicoModal ? (
                        <select
                          disabled={osFechada}
                          value={osSelecionada.tecnicoResponsavel}
                          onChange={async (e) => {
                            if (e.target.value === '__NOVO__') {
                              setCriandoNovoTecnicoModal(true);
                              return;
                            }
                            await osRepo.atualizar(osSelecionada.id, {
                              tecnicoResponsavel: e.target.value,
                            });
                            queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
                            notificar(`Técnico alterado para "${e.target.value}"`, 'sucesso');
                          }}
                          className="w-full min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-semibold disabled:bg-slate-100"
                        >
                          {(config?.tecnicosAtivos || ['Carlos Eduardo (Principal)']).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                          <option value="__NOVO__">+ Cadastrar Novo Técnico...</option>
                        </select>
                      ) : (
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={novoTecnicoModalTexto}
                            onChange={(e) => setNovoTecnicoModalTexto(e.target.value)}
                            placeholder="Nome..."
                            className="flex-1 min-h-[38px] px-2.5 py-1 rounded-xl border border-sky-400 bg-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const nomeLimpo = novoTecnicoModalTexto.trim();
                              if (!nomeLimpo) return;
                              const listaAtual = config?.tecnicosAtivos || [
                                'Carlos Eduardo (Principal)',
                              ];
                              const novaLista = Array.from(new Set([...listaAtual, nomeLimpo]));
                              await configRepo.salvarConfiguracoes({ tecnicosAtivos: novaLista });
                              await osRepo.atualizar(osSelecionada.id, {
                                tecnicoResponsavel: nomeLimpo,
                              });
                              queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
                              queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
                              setNovoTecnicoModalTexto('');
                              setCriandoNovoTecnicoModal(false);
                              notificar(
                                `Técnico "${nomeLimpo}" cadastrado e vinculado à OS!`,
                                'sucesso'
                              );
                            }}
                            className="min-h-[38px] px-2.5 py-1 rounded-xl bg-sky-600 text-white text-xs font-bold"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Laudo Técnico / Diagnóstico
                    </label>
                    <textarea
                      rows={2}
                      disabled={osFechada}
                      value={laudoEdit}
                      onChange={(e) => setLaudoEdit(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs disabled:bg-slate-100"
                      placeholder="Diagnóstico técnico da bancada..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={osFechada}
                      value={solucaoEdit}
                      onChange={(e) => setSolucaoEdit(e.target.value)}
                      placeholder="Solução aplicada..."
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs disabled:bg-slate-100"
                    />
                    {!osFechada && (
                      <button
                        type="button"
                        onClick={salvarLaudoOS}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvar Laudo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Peças e Serviços da OS (Com Preclusão, Edição e Progressive Disclosure) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-slate-500">
                    Peças e Serviços Utilizados ({osSelecionada.itens.length})
                  </h4>
                  <span className="text-xs text-slate-500">
                    Estoque baixado:{' '}
                    <strong>{osSelecionada.estoqueBaixado ? 'Sim' : 'Ainda não'}</strong>
                  </span>
                </div>

                {/* Somente exibe botões de adicionar/editar peça se a OS NÃO estiver encerrada (Preclusão) */}
                {!osFechada && (
                  <div className="space-y-2.5">
                    <LancadorPecaManualOS
                      modeloAparelhoPadrao={
                        mapaAparelhos.get(osSelecionada.aparelhoId)
                          ? `${mapaAparelhos.get(osSelecionada.aparelhoId)!.marca} ${
                              mapaAparelhos.get(osSelecionada.aparelhoId)!.modelo
                            }`
                          : ''
                      }
                      aoAdicionarItem={(novoItem) => adicionarItemCompletoNaOSSelecionada(novoItem)}
                      itemEmEdicao={itemOSEmEdicao}
                      aoSalvarEdicao={(itemAtualizado) =>
                        atualizarItemNaOSSelecionada(itemAtualizado)
                      }
                      aoCancelarEdicao={() => setItemOSEmEdicao(null)}
                      desabilitado={osFechada}
                    />

                    <div>
                      <button
                        type="button"
                        onClick={() => setMostrarBuscaCatalogoModal((prev) => !prev)}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Package className="w-3.5 h-3.5 text-slate-600" />
                        <span>
                          {mostrarBuscaCatalogoModal
                            ? 'Fechar Busca do Estoque'
                            : '+ Buscar Peça/Serviço Cadastrado no Estoque'}
                        </span>
                      </button>

                      {mostrarBuscaCatalogoModal && (
                        <div className="mt-2 relative p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <input
                            type="text"
                            autoFocus
                            value={buscaNovoItem}
                            onChange={(e) => setBuscaNovoItem(e.target.value)}
                            placeholder="Digite nome ou código da peça/serviço no estoque..."
                            className="w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                          />
                          {buscaNovoItem.trim() && resultadosCatalogoModal.length > 0 && (
                            <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-lg divide-y divide-slate-100">
                              {resultadosCatalogoModal.map((item) => (
                                <button
                                  key={`${item.tipo}-${item.id}`}
                                  type="button"
                                  onClick={() => adicionarItemNaOSSelecionada(item)}
                                  className="w-full p-2.5 text-left hover:bg-sky-50 flex justify-between text-xs"
                                >
                                  <span>
                                    <strong>[{item.tipo.toUpperCase()}]</strong> {item.descricao}
                                  </span>
                                  <span className="font-bold">
                                    {formatarMoeda(item.valorUnitarioCentavos)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 px-3">Descrição / Detalhes da Peça</th>
                        <th className="py-2 px-3 text-center">Qtd</th>
                        <th className="py-2 px-3 text-right">Valor</th>
                        {!osFechada && <th className="py-2 px-3 text-right w-20">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {osSelecionada.itens.map((i) => (
                        <tr
                          key={i.id}
                          className={
                            itemOSEmEdicao?.id === i.id ? 'bg-amber-50/70' : 'hover:bg-slate-50/60'
                          }
                        >
                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-900">{i.descricao}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  i.tipo === 'peca'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {i.tipo === 'peca' ? 'Peça' : 'Serviço'}
                              </span>
                              {i.modeloAparelho && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                  {i.modeloAparelho}
                                </span>
                              )}
                              {i.qualidadePeca && i.qualidadePeca !== 'N/A' && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                                  {i.qualidadePeca}
                                </span>
                              )}
                              {i.aroPeca && i.aroPeca !== 'na' && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  {formatarAroPeca(i.aroPeca)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-bold">{i.quantidade}</td>
                          <td className="py-2 px-3 text-right font-bold">
                            {formatarMoeda(i.quantidade * i.valorUnitarioCentavos)}
                          </td>
                          {!osFechada && (
                            <td className="py-2 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setItemOSEmEdicao(i)}
                                  title="Editar peça ou serviço vinculado"
                                  className="text-sky-700 hover:bg-sky-50 p-1 rounded"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removerItemDaOSSelecionada(i.id)}
                                  title="Remover item"
                                  className="text-rose-600 hover:bg-rose-50 p-1 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumo Financeiro, Lucro Interno e Ação de Encerrar (Respeitando a Preclusão) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 uppercase font-bold">
                      Total da OS (Cliente)
                    </span>
                    <p className="text-lg font-extrabold text-slate-900">
                      {formatarMoeda(osSelecionada.totalCentavos)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] text-emerald-700 uppercase font-bold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" /> Lucro Líquido Estimado (Visão Interna)
                    </span>
                    <p className="text-lg font-extrabold text-emerald-800">
                      {formatarMoeda(calcularLucroOS(osSelecionada))}
                    </p>
                  </div>

                  {!osFechada ? (
                    <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-sky-700 uppercase font-bold">
                          Encerrar e Entregar
                        </span>
                        <p className="text-xs text-sky-900">Escolher data pgto e garantia</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => alterarStatusOS(osSelecionada, 'entregue')}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                      >
                        Encerrar OS
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-amber-800 uppercase font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Baixada em{' '}
                          {osSelecionada.dataSaida
                            ? formatarData(osSelecionada.dataSaida)
                            : '—'}
                        </span>
                        <p className="text-xs text-amber-900 font-semibold">
                          Reabra acima para alterar pagamento
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Histórico de Mudanças de Status Colapsável (Progressive Disclosure) */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMostrarHistoricoModal((prev) => !prev)}
                  className="w-full flex items-center justify-between py-1.5 text-xs font-bold uppercase text-slate-500 hover:text-slate-800"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Histórico de Status e Movimentações (
                    {osSelecionada.historicoStatus.length})
                  </span>
                  {mostrarHistoricoModal ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {mostrarHistoricoModal && (
                  <div className="space-y-1.5 text-xs mt-2">
                    {osSelecionada.historicoStatus.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70"
                      >
                        <span className="font-semibold text-slate-800">
                          {STATUS_OS_LABELS[h.status].label}{' '}
                          {h.observacao && (
                            <span className="font-normal text-slate-500">— {h.observacao}</span>
                          )}
                        </span>
                        <span className="text-slate-400">
                          {formatarDataHora(h.dataHora)} ({h.usuario})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento e Escolha da Data de Entrada Financeira na Entrega da OS */}
      {modalEntregaAberto && osSelecionada && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-sm">
                  Encerrar e Receber — OS #{formatarNumeroOS(osSelecionada.numero)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalEntregaAberto(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Alerta de Trava de Caixa do Dia Anterior ou Caixa Fechado */}
              {(!caixaAberto || caixaTravadoDiaAnterior) && (
                <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-rose-700">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      {!caixaAberto
                        ? 'CAIXA FECHADO: Não é possível receber valores'
                        : 'TRAVA DE CAIXA DO DIA ANTERIOR ATIVA'}
                    </span>
                  </div>
                  <p>
                    {!caixaAberto
                      ? 'Abra o caixa de hoje antes de registrar o recebimento desta OS.'
                      : `O caixa atual foi aberto em ${formatarDataHora(
                          caixaAberto.aberturaData
                        )}. Feche o caixa do dia anterior e abra o de hoje para liberar recebimentos.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalEntregaAberto(false);
                      navigate('/financeiro');
                    }}
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                  >
                    Ir para Financeiro / Fechar Caixa Anterior
                  </button>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600">Total da OS:</span>
                <span className="text-lg font-extrabold text-slate-900">
                  {formatarMoeda(osSelecionada.totalCentavos)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Dia em que o Pagamento Vai Entrar (Data da Baixa) *</span>
                </label>
                <input
                  type="date"
                  value={dataPagamentoEntrega}
                  onChange={(e) => setDataPagamentoEntrega(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-400 bg-emerald-50/40 text-sm font-bold text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Você pode manter a data de hoje, informar uma data retroativa ou escolher o dia em que o valor cairá no financeiro.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={formaPagamentoEntrega}
                  onChange={(e) =>
                    setFormaPagamentoEntrega(e.target.value as FormaPagamentoTipo)
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Valor Pago (R$) — Se menor que o total, gera Conta a Receber do saldo
                </label>
                <input
                  type="text"
                  value={valorPagoEntregaReais}
                  onChange={(e) => setValorPagoEntregaReais(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-base font-bold"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalEntregaAberto(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!caixaAberto || caixaTravadoDiaAnterior}
                onClick={confirmarEntregaOS}
                className={`min-h-[44px] px-5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 ${
                  !caixaAberto || caixaTravadoDiaAnterior
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Baixa e Imprimir Garantia</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão Térmica */}
      {config && impressaoConfig.os && (
        <ThermalReceiptModal
          aberto={impressaoConfig.aberto}
          aoFechar={() => setImpressaoConfig({ ...impressaoConfig, aberto: false })}
          tipo={impressaoConfig.tipo}
          config={config}
          os={impressaoConfig.os}
          cliente={mapaClientes.get(impressaoConfig.os.clienteId)}
          aparelho={mapaAparelhos.get(impressaoConfig.os.aparelhoId)}
        />
      )}
    </div>
  );
};
