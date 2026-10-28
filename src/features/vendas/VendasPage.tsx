import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  XCircle,
  History,
  DollarSign,
  CreditCard,
  QrCode,
  User,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import {
  produtoRepo,
  servicoRepo,
  vendaRepo,
  clienteRepo,
  financeiroRepo,
  configRepo,
} from '@/repositories/localStorageRepo';
import {
  ItemVenda,
  FormaPagamentoTipo,
  PagamentoRegistro,
  Venda,
  CategoriaProduto,
} from '@/types/domain';
import {
  formatarMoeda,
  formatarDataHora,
  formatarNumeroOS,
  gerarId,
  caixaEhDeDiaAnterior,
} from '@/utils/formatters';
import { ThermalReceiptModal } from '@/features/impressao/ThermalReceiptModal';
import { useToast } from '@/components/ui/Toast';

const FORMAS_LABELS: Record<FormaPagamentoTipo, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão de Débito',
  cartao_credito: 'Cartão de Crédito',
  outro: 'Outro',
};

export const VendasPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const buscaRef = useRef<HTMLInputElement>(null);

  const [aba, setAba] = useState<'pdv' | 'historico'>('pdv');

  // Estado do PDV
  const [termoBusca, setTermoBusca] = useState('');
  const [clienteId, setClienteId] = useState<string>('');
  const [carrinho, setCarrinho] = useState<ItemVenda[]>([]);
  const [descontoGeralReais, setDescontoGeralReais] = useState('0,00');

  // Modal de Cadastro Rápido de Produto no PDV
  const [modalNovoProdutoPDV, setModalNovoProdutoPDV] = useState(false);
  const [novoProdutoPDVForm, setNovoProdutoPDVForm] = useState({
    descricao: '',
    categoria: 'pelicula' as CategoriaProduto,
    custoReais: '10,00',
    precoVendaReais: '35,00',
    estoqueAtual: 10,
  });

  // Múltiplas formas de pagamento
  const [pagamentos, setPagamentos] = useState<
    Array<{
      id: string;
      formaPagamento: FormaPagamentoTipo;
      valorReais: string;
      parcelas: number;
    }>
  >([{ id: 'pag-1', formaPagamento: 'pix', valorReais: '0,00', parcelas: 1 }]);

  // Histórico de Vendas e Filtros
  const [filtroForma, setFiltroForma] = useState<string>('todas');
  const [vendaParaImprimir, setVendaParaImprimir] = useState<Venda | null>(null);

  useEffect(() => {
    if (aba === 'pdv') {
      buscaRef.current?.focus();
    }
  }, [aba]);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => produtoRepo.listar(),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => servicoRepo.listar(),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => clienteRepo.listar(),
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => vendaRepo.listar(),
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
  const vendaBloqueadaPorCaixa = !caixaAberto || caixaTravadoDiaAnterior;

  const converterReaisParaCentavos = (txt: string) => {
    const limpo = txt.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  const subtotalCentavos = carrinho.reduce(
    (acc, item) => acc + item.quantidade * item.valorUnitarioCentavos - item.descontoCentavos,
    0
  );
  const descontoCentavos = converterReaisParaCentavos(descontoGeralReais);
  const totalVendaCentavos = Math.max(0, subtotalCentavos - descontoCentavos);

  // Sincroniza automaticamente o valor da 1ª forma de pagamento quando há apenas 1 forma
  useEffect(() => {
    if (pagamentos.length === 1) {
      setPagamentos([
        {
          ...pagamentos[0],
          valorReais: (totalVendaCentavos / 100).toFixed(2).replace('.', ','),
        },
      ]);
    }
  }, [totalVendaCentavos]);

  const totalInformadoPagamentosCentavos = pagamentos.reduce(
    (acc, p) => acc + converterReaisParaCentavos(p.valorReais),
    0
  );

  const trocoCentavos = Math.max(0, totalInformadoPagamentosCentavos - totalVendaCentavos);
  const faltaPagarCentavos = Math.max(
    0,
    totalVendaCentavos - totalInformadoPagamentosCentavos
  );

  // Adicionar produto ou serviço ao carrinho
  const adicionarAoCarrinho = (item: {
    tipo: 'produto' | 'servico';
    id: string;
    codigo: string;
    descricao: string;
    valorUnitarioCentavos: number;
    custoUnitarioCentavos: number;
  }) => {
    setCarrinho((prev) => {
      const idx = prev.findIndex(
        (i) => i.tipo === item.tipo && i.referenciaId === item.id
      );
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = { ...copia[idx], quantidade: copia[idx].quantidade + 1 };
        return copia;
      }
      return [
        ...prev,
        {
          id: gerarId(),
          tipo: item.tipo,
          referenciaId: item.id,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade: 1,
          valorUnitarioCentavos: item.valorUnitarioCentavos,
          custoUnitarioCentavos: item.custoUnitarioCentavos,
          descontoCentavos: 0,
        },
      ];
    });
    setTermoBusca('');
    buscaRef.current?.focus();
  };

  // Suporte a leitor de código de barras USB (envia Enter após os dígitos)
  const handleKeyDownBusca = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && termoBusca.trim()) {
      e.preventDefault();
      const q = termoBusca.trim().toLowerCase();
      const exatoBarra = produtos.find(
        (p) => p.ativo && (p.codigoDeBarras === q || p.codigo.toLowerCase() === q)
      );
      if (exatoBarra) {
        adicionarAoCarrinho({
          tipo: 'produto',
          id: exatoBarra.id,
          codigo: exatoBarra.codigo,
          descricao: exatoBarra.descricao,
          valorUnitarioCentavos: exatoBarra.precoVendaCentavos,
          custoUnitarioCentavos: exatoBarra.custoCentavos,
        });
        return;
      }
      if (resultadosBusca.length > 0) {
        adicionarAoCarrinho(resultadosBusca[0]);
      }
    }
  };

  const resultadosBusca = termoBusca.trim()
    ? [
        ...produtos
          .filter(
            (p) =>
              p.ativo &&
              (p.descricao.toLowerCase().includes(termoBusca.toLowerCase()) ||
                p.codigo.toLowerCase().includes(termoBusca.toLowerCase()) ||
                (p.codigoDeBarras?.includes(termoBusca) ?? false))
          )
          .map((p) => ({
            tipo: 'produto' as const,
            id: p.id,
            codigo: p.codigo,
            descricao: p.descricao,
            valorUnitarioCentavos: p.precoVendaCentavos,
            custoUnitarioCentavos: p.custoCentavos,
            estoque: p.estoqueAtual,
          })),
        ...servicos
          .filter(
            (s) =>
              s.ativo &&
              (s.descricao.toLowerCase().includes(termoBusca.toLowerCase()) ||
                s.codigo.toLowerCase().includes(termoBusca.toLowerCase()))
          )
          .map((s) => ({
            tipo: 'servico' as const,
            id: s.id,
            codigo: s.codigo,
            descricao: s.descricao,
            valorUnitarioCentavos: s.precoPadraoCentavos,
            custoUnitarioCentavos: 0,
            estoque: null as number | null,
          })),
      ].slice(0, 8)
    : [];

  // Produtos rápidos de balcão (Películas, Capas, Cabos, Carregadores, Fones)
  const atalhosBalcao = produtos
    .filter((p) =>
      ['pelicula', 'capa', 'cabo', 'carregador', 'fone'].includes(p.categoria)
    )
    .slice(0, 8);

  // Concluir Venda (com Trava de Caixa do Dia Anterior)
  const concluirVendaMutation = useMutation({
    mutationFn: async () => {
      if (!caixaAberto) {
        throw new Error(
          'Caixa Fechado! Abra o caixa de hoje em Financeiro e Caixa antes de realizar vendas.'
        );
      }
      if (caixaTravadoDiaAnterior) {
        throw new Error(
          'TRAVA DE CAIXA: O caixa aberto é de um dia anterior! Feche o caixa anterior e abra o caixa de hoje para vender.'
        );
      }
      if (carrinho.length === 0) {
        throw new Error('Adicione pelo menos 1 produto ao carrinho.');
      }
      if (faltaPagarCentavos > 0) {
        throw new Error(
          `Ainda faltam ${formatarMoeda(faltaPagarCentavos)} para completar o valor da venda.`
        );
      }

      const numero = await vendaRepo.obterProximoNumero();
      const agora = new Date().toISOString();

      // Prepara pagamentos ajustando eventual troco no dinheiro
      const listaPagamentos: PagamentoRegistro[] = pagamentos.map((p, idx) => {
        const bruto = converterReaisParaCentavos(p.valorReais);
        const liquido =
          idx === 0 && trocoCentavos > 0 ? Math.max(0, bruto - trocoCentavos) : bruto;
        return {
          id: gerarId(),
          formaPagamento: p.formaPagamento,
          valorCentavos: liquido,
          parcelas: p.formaPagamento === 'cartao_credito' ? p.parcelas : undefined,
          dataPagamento: agora,
        };
      });

      const novaVenda = await vendaRepo.criar({
        numero,
        data: agora,
        clienteId: clienteId || undefined,
        itens: carrinho,
        descontoCentavos,
        totalCentavos: totalVendaCentavos,
        pagamentos: listaPagamentos,
        trocoCentavos,
        status: 'concluida',
      });

      // Baixa automática de estoque de cada produto vendido
      for (const item of carrinho) {
        if (item.tipo === 'produto') {
          await produtoRepo.ajustarEstoque({
            produtoId: item.referenciaId,
            quantidadeDelta: -item.quantidade,
            tipo: 'saida_venda',
            origemId: novaVenda.id,
            motivo: `Venda de Balcão #${formatarNumeroOS(numero)}`,
          });
        }
      }

      // Lançamento no Financeiro e Sessão de Caixa por forma de pagamento
      for (const pag of listaPagamentos) {
        if (pag.valorCentavos > 0) {
          await financeiroRepo.criarLancamento({
            tipo: 'entrada',
            categoria: 'Venda de Acessórios e Peças',
            descricao: `Venda de Balcão #${formatarNumeroOS(numero)} (${FORMAS_LABELS[pag.formaPagamento]})`,
            valorCentavos: pag.valorCentavos,
            dataVencimento: agora,
            dataPagamento: agora,
            status: 'pago',
            formaPagamento: pag.formaPagamento,
            origem: 'venda',
            origemId: novaVenda.id,
            clienteId: clienteId || undefined,
          });

          await financeiroRepo.registrarMovimentoCaixa({
            tipo: 'venda',
            descricao: `Venda #${formatarNumeroOS(numero)} (${FORMAS_LABELS[pag.formaPagamento]})`,
            valorCentavos: pag.valorCentavos,
            formaPagamento: pag.formaPagamento,
            origemId: novaVenda.id,
          });
        }
      }

      return novaVenda;
    },
    onSuccess: (vendaConcluida) => {
      queryClient.invalidateQueries();
      setCarrinho([]);
      setDescontoGeralReais('0,00');
      setClienteId('');
      setPagamentos([
        { id: gerarId(), formaPagamento: 'pix', valorReais: '0,00', parcelas: 1 },
      ]);
      setVendaParaImprimir(vendaConcluida);
      notificar(
        `Venda #${formatarNumeroOS(vendaConcluida.numero)} concluída! Estoque e caixa atualizados.`,
        'sucesso'
      );
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao finalizar venda', 'erro');
    },
  });

  // Cancelar venda com motivo e estornar estoque + financeiro (Seção 9.3)
  const handleCancelarVenda = async (venda: Venda) => {
    if (venda.status === 'cancelada') return;
    const motivo = window.prompt(
      `Informe o motivo do cancelamento da Venda #${formatarNumeroOS(venda.numero)} (o estoque e o caixa serão estornados):`
    );
    if (!motivo || !motivo.trim()) return;

    await vendaRepo.atualizar(venda.id, {
      status: 'cancelada',
      motivoCancelamento: motivo.trim(),
    });

    // Devolve produtos ao estoque
    for (const item of venda.itens) {
      if (item.tipo === 'produto') {
        await produtoRepo.ajustarEstoque({
          produtoId: item.referenciaId,
          quantidadeDelta: item.quantidade,
          tipo: 'estorno',
          origemId: venda.id,
          motivo: `Estorno por cancelamento da Venda #${formatarNumeroOS(venda.numero)}: ${motivo}`,
        });
      }
    }

    // Estorna movimento no caixa
    await financeiroRepo.registrarMovimentoCaixa({
      tipo: 'despesa',
      descricao: `Estorno Cancelamento Venda #${formatarNumeroOS(venda.numero)}`,
      valorCentavos: -venda.totalCentavos,
      formaPagamento: venda.pagamentos[0]?.formaPagamento || 'dinheiro',
      origemId: venda.id,
    });

    queryClient.invalidateQueries();
    notificar(
      `Venda #${formatarNumeroOS(venda.numero)} cancelada. Estoque e caixa estornados.`,
      'aviso'
    );
  };

  const vendasFiltradas = vendas.filter((v) => {
    if (filtroForma === 'todas') return true;
    return v.pagamentos.some((p) => p.formaPagamento === filtroForma);
  });

  const mapaClientes = new Map(clientes.map((c) => [c.id, c]));

  return (
    <div className="space-y-5">
      {/* Topo e Alternador PDV / Histórico */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Vendas de Balcão / PDV Rápido
          </h2>
          <p className="text-sm text-slate-500">
            Leitor de código de barras USB, múltiplas formas de pagamento, cálculo de troco e recibo térmico
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setNovoProdutoPDVForm({
                descricao: termoBusca,
                categoria: 'pelicula',
                custoReais: '10,00',
                precoVendaReais: '35,00',
                estoqueAtual: 10,
              });
              setModalNovoProdutoPDV(true);
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Produto</span>
          </button>

          <button
            type="button"
            onClick={() => setAba('pdv')}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 ${
              aba === 'pdv'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Frente de Caixa (PDV)</span>
          </button>

          <button
            type="button"
            onClick={() => setAba('historico')}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 ${
              aba === 'historico'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Vendas ({vendas.length})</span>
          </button>
        </div>
      </div>

      {aba === 'pdv' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Coluna Esquerda: Busca por Código de Barras + Atalhos de Balcão + Carrinho */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="relative">
                <Barcode className="w-5 h-5 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={buscaRef}
                  type="text"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  onKeyDown={handleKeyDownBusca}
                  placeholder="Bipe o código de barras ou digite nome da película, capa, cabo, carregador..."
                  className="w-full min-h-[50px] pl-11 pr-4 py-2.5 rounded-xl border-2 border-emerald-500/70 focus:border-emerald-600 text-sm font-medium"
                />

                {termoBusca.trim() && (
                  <div className="mt-2 border border-slate-200 rounded-xl bg-white shadow-xl divide-y divide-slate-100 overflow-hidden">
                    {resultadosBusca.map((item) => (
                      <button
                        key={`${item.tipo}-${item.id}`}
                        type="button"
                        onClick={() => adicionarAoCarrinho(item)}
                        className="w-full p-3.5 text-left hover:bg-emerald-50 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono text-xs text-slate-500 mr-2">
                            {item.codigo}
                          </span>
                          <strong className="text-sm text-slate-900">{item.descricao}</strong>
                          {item.estoque !== null && (
                            <span className="ml-2 text-xs text-slate-500">
                              (Est: {item.estoque})
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-emerald-700 text-sm">
                          {formatarMoeda(item.valorUnitarioCentavos)}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setNovoProdutoPDVForm({
                          descricao: termoBusca,
                          categoria: 'pelicula',
                          custoReais: '10,00',
                          precoVendaReais: '35,00',
                          estoqueAtual: 10,
                        });
                        setModalNovoProdutoPDV(true);
                      }}
                      className="w-full p-3 text-left bg-sky-50/70 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-between"
                    >
                      <span>+ Cadastrar "{termoBusca}" como Novo Produto no Estoque...</span>
                      <span>Criar Agora →</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Grade de Produtos Rápidos de Balcão (Toque no Tablet Android) */}
              <div>
                <span className="block text-xs font-bold uppercase text-slate-400 mb-2">
                  Itens Mais Vendidos no Balcão (Toque Rápido)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {atalhosBalcao.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() =>
                        adicionarAoCarrinho({
                          tipo: 'produto',
                          id: prod.id,
                          codigo: prod.codigo,
                          descricao: prod.descricao,
                          valorUnitarioCentavos: prod.precoVendaCentavos,
                          custoUnitarioCentavos: prod.custoCentavos,
                        })
                      }
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all flex flex-col justify-between min-h-[72px]"
                    >
                      <span className="text-xs font-semibold text-slate-800 line-clamp-2">
                        {prod.descricao}
                      </span>
                      <span className="text-xs font-extrabold text-emerald-700 mt-1">
                        {formatarMoeda(prod.precoVendaCentavos)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Itens no Carrinho */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">
                  Itens da Venda ({carrinho.length})
                </h3>
                {carrinho.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCarrinho([])}
                    className="text-xs text-rose-600 font-semibold hover:underline"
                  >
                    Limpar Carrinho
                  </button>
                )}
              </div>

              {carrinho.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">
                  Nenhum item adicionado. Bipe o código de barras ou toque em um produto acima.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {carrinho.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-slate-900 truncate">
                          {item.descricao}
                        </p>
                        <p className="text-xs text-slate-500">
                          Unitário: {formatarMoeda(item.valorUnitarioCentavos)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => {
                              const copia = [...carrinho];
                              if (copia[idx].quantidade > 1) {
                                copia[idx].quantidade -= 1;
                                setCarrinho(copia);
                              }
                            }}
                            className="p-2 text-slate-600 hover:text-slate-900"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-3 font-bold text-sm">{item.quantidade}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const copia = [...carrinho];
                              copia[idx].quantidade += 1;
                              setCarrinho(copia);
                            }}
                            className="p-2 text-slate-600 hover:text-slate-900"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <span className="font-extrabold text-sm text-slate-900 w-24 text-right">
                          {formatarMoeda(item.quantidade * item.valorUnitarioCentavos)}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setCarrinho(carrinho.filter((c) => c.id !== item.id))
                          }
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Fechamento, Múltiplas Formas de Pagamento e Troco */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
            <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-3">
              Pagamento e Fechamento
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cliente (Opcional — Padrão: Consumidor Final)
              </label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="">Consumidor Final (Balcão)</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — {c.telefone}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subtotal
                </label>
                <div className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                  {formatarMoeda(subtotalCentavos)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Desconto (R$)
                </label>
                <input
                  type="text"
                  value={descontoGeralReais}
                  onChange={(e) => setDescontoGeralReais(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">TOTAL A PAGAR:</span>
              <span className="text-2xl font-extrabold text-emerald-400">
                {formatarMoeda(totalVendaCentavos)}
              </span>
            </div>

            {/* Múltiplas Formas de Pagamento */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Formas de Pagamento
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPagamentos([
                      ...pagamentos,
                      {
                        id: gerarId(),
                        formaPagamento: 'dinheiro',
                        valorReais: ((faltaPagarCentavos || 0) / 100)
                          .toFixed(2)
                          .replace('.', ','),
                        parcelas: 1,
                      },
                    ])
                  }
                  className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Dividir em +1 Forma
                </button>
              </div>

              {pagamentos.map((pag, idx) => (
                <div
                  key={pag.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-6">
                    <select
                      value={pag.formaPagamento}
                      onChange={(e) => {
                        const copia = [...pagamentos];
                        copia[idx].formaPagamento = e.target.value as FormaPagamentoTipo;
                        setPagamentos(copia);
                      }}
                      className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                    >
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div className="col-span-5">
                    <input
                      type="text"
                      value={pag.valorReais}
                      onChange={(e) => {
                        const copia = [...pagamentos];
                        copia[idx].valorReais = e.target.value;
                        setPagamentos(copia);
                      }}
                      className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-right bg-white"
                      placeholder="0,00"
                    />
                  </div>

                  <div className="col-span-1 text-right">
                    {pagamentos.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPagamentos(pagamentos.filter((p) => p.id !== pag.id))
                        }
                        className="text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Troco ou Valor Restante */}
            {trocoCentavos > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900">
                <span className="text-xs font-bold uppercase">Troco a Devolver:</span>
                <span className="text-lg font-extrabold">{formatarMoeda(trocoCentavos)}</span>
              </div>
            )}

            {/* Alerta de Trava de Caixa do Dia Anterior ou Caixa Fechado */}
            {vendaBloqueadaPorCaixa && (
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-900 space-y-2.5">
                <div className="flex items-center gap-2 font-extrabold text-xs uppercase text-rose-700">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    {!caixaAberto
                      ? 'Venda Bloqueada: Caixa Fechado'
                      : 'Trava de Segurança: Caixa do Dia Anterior!'}
                  </span>
                </div>
                <p className="text-xs text-rose-800">
                  {!caixaAberto
                    ? 'Você precisa abrir o caixa de hoje antes de registrar vendas no PDV.'
                    : `O caixa atual foi aberto em ${formatarDataHora(
                        caixaAberto.aberturaData
                      )}. Não é permitido vender com caixa do dia anterior aberto.`}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/financeiro')}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    {!caixaAberto
                      ? 'Ir para Financeiro e Abrir Caixa'
                      : 'Fechar Caixa Anterior Agora'}
                  </span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => concluirVendaMutation.mutate()}
              disabled={
                carrinho.length === 0 ||
                concluirVendaMutation.isPending ||
                vendaBloqueadaPorCaixa
              }
              className="w-full min-h-[54px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-base flex items-center justify-center gap-2 shadow-md transition-all"
            >
              {vendaBloqueadaPorCaixa ? (
                <>
                  <Lock className="w-5 h-5" />
                  <span>
                    {!caixaAberto
                      ? 'Abra o Caixa para Vender'
                      : 'Bloqueado (Caixa Dia Anterior)'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Concluir Venda e Imprimir Recibo</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ABA 2: HISTÓRICO DE VENDAS E CANCELAMENTO COM ESTORNO */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Vendas Realizadas</h3>
            <select
              value={filtroForma}
              onChange={(e) => setFiltroForma(e.target.value)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="todas">Todas as Formas de Pagamento</option>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="cartao_credito">Cartão de Crédito</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3.5 px-4">Nº Venda</th>
                  <th className="py-3.5 px-4">Data / Hora</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Itens</th>
                  <th className="py-3.5 px-4">Pagamento</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendasFiltradas.map((v) => {
                  const cli = v.clienteId ? mapaClientes.get(v.clienteId) : undefined;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-slate-800">
                        #{formatarNumeroOS(v.numero)}
                        {v.status === 'cancelada' && (
                          <span className="block text-[10px] text-rose-600 uppercase">
                            Cancelada
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {formatarDataHora(v.data)}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                        {cli?.nome || 'Consumidor Final'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {v.itens.map((i) => `${i.quantidade}x ${i.descricao}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {v.pagamentos
                          .map((p) => `${FORMAS_LABELS[p.formaPagamento]} (${formatarMoeda(p.valorCentavos)})`)
                          .join(' + ')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatarMoeda(v.totalCentavos)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setVendaParaImprimir(v)}
                            className="p-2 rounded-lg text-slate-500 hover:text-sky-700 hover:bg-slate-100"
                            title="Reimprimir Recibo"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {v.status === 'concluida' && (
                            <button
                              type="button"
                              onClick={() => handleCancelarVenda(v)}
                              className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                              title="Cancelar Venda e Estornar Estoque"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Cadastro Rápido de Produto no PDV */}
      {modalNovoProdutoPDV && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Cadastrar Novo Produto</h3>
              <button
                type="button"
                onClick={() => setModalNovoProdutoPDV(false)}
                className="p-2 text-slate-400 hover:text-slate-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome / Descrição do Produto *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={novoProdutoPDVForm.descricao}
                  onChange={(e) =>
                    setNovoProdutoPDVForm({
                      ...novoProdutoPDVForm,
                      descricao: e.target.value,
                    })
                  }
                  placeholder="Ex.: Película 3D A14, Cabo Tipo-C Turbo..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={novoProdutoPDVForm.categoria}
                    onChange={(e) =>
                      setNovoProdutoPDVForm({
                        ...novoProdutoPDVForm,
                        categoria: e.target.value as CategoriaProduto,
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="pelicula">Película</option>
                    <option value="capa">Capa / Case</option>
                    <option value="cabo">Cabo</option>
                    <option value="carregador">Carregador / Fonte</option>
                    <option value="fone">Fone / Áudio</option>
                    <option value="tela">Tela / Frontal</option>
                    <option value="bateria">Bateria</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estoque Inicial
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={novoProdutoPDVForm.estoqueAtual}
                    onChange={(e) =>
                      setNovoProdutoPDVForm({
                        ...novoProdutoPDVForm,
                        estoqueAtual: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="text"
                    value={novoProdutoPDVForm.custoReais}
                    onChange={(e) =>
                      setNovoProdutoPDVForm({
                        ...novoProdutoPDVForm,
                        custoReais: e.target.value,
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="text"
                    value={novoProdutoPDVForm.precoVendaReais}
                    onChange={(e) =>
                      setNovoProdutoPDVForm({
                        ...novoProdutoPDVForm,
                        precoVendaReais: e.target.value,
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-400 bg-emerald-50/30 text-sm font-bold"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalNovoProdutoPDV(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const desc = novoProdutoPDVForm.descricao.trim();
                  if (!desc) {
                    notificar('Informe a descrição do produto.', 'erro');
                    return;
                  }
                  const vendaC = converterReaisParaCentavos(novoProdutoPDVForm.precoVendaReais);
                  const custoC = converterReaisParaCentavos(novoProdutoPDVForm.custoReais);
                  const novoProd = await produtoRepo.criar({
                    codigo: `PRD-${String(produtos.length + 1).padStart(3, '0')}`,
                    descricao: desc,
                    categoria: novoProdutoPDVForm.categoria,
                    modelosCompativeis: [],
                    unidade: 'UN',
                    custoCentavos: custoC,
                    precoVendaCentavos: vendaC,
                    estoqueAtual: novoProdutoPDVForm.estoqueAtual,
                    estoqueMinimo: 2,
                    localizacao: 'Balcão',
                    ativo: true,
                  });
                  queryClient.invalidateQueries({ queryKey: ['produtos'] });
                  adicionarAoCarrinho({
                    tipo: 'produto',
                    id: novoProd.id,
                    codigo: novoProd.codigo,
                    descricao: novoProd.descricao,
                    valorUnitarioCentavos: novoProd.precoVendaCentavos,
                    custoUnitarioCentavos: novoProd.custoCentavos,
                  });
                  setModalNovoProdutoPDV(false);
                  notificar(`Produto "${novoProd.descricao}" cadastrado e adicionado ao carrinho!`, 'sucesso');
                }}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold"
              >
                Salvar e Adicionar na Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recibo Térmico da Venda */}
      {config && vendaParaImprimir && (
        <ThermalReceiptModal
          aberto={!!vendaParaImprimir}
          aoFechar={() => setVendaParaImprimir(null)}
          tipo="recibo_venda"
          config={config}
          venda={vendaParaImprimir}
          cliente={
            vendaParaImprimir.clienteId
              ? mapaClientes.get(vendaParaImprimir.clienteId)
              : undefined
          }
        />
      )}
    </div>
  );
};
