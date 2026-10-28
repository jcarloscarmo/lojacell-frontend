import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Wrench,
  Truck,
  History,
  Plus,
  Search,
  Edit3,
  ArrowUpDown,
  AlertTriangle,
  Download,
  X,
  Save,
  Power,
  Smartphone,
} from 'lucide-react';
import {
  produtoRepo,
  servicoRepo,
  fornecedorRepo,
  aparelhoRepo,
} from '@/repositories/localStorageRepo';
import { CategoriaProduto, Produto, Servico, Fornecedor } from '@/types/domain';
import {
  formatarMoeda,
  formatarDataHora,
  aplicarMascaraCpfCnpj,
  aplicarMascaraTelefone,
} from '@/utils/formatters';
import { useToast } from '@/components/ui/Toast';
import { MarcasModelosSection } from './MarcasModelosSection';

const CATEGORIAS_LABELS: Record<CategoriaProduto, string> = {
  tela: 'Tela / Frontal',
  bateria: 'Bateria',
  conector: 'Conector / Subplaca',
  camera: 'Câmera / Lente',
  alto_falante: 'Auricular / Alto-Falante',
  tampa_traseira: 'Tampa Traseira / Carcaça',
  pelicula: 'Película',
  capa: 'Capa',
  cabo: 'Cabo USB',
  carregador: 'Fonte / Carregador',
  fone: 'Fone de Ouvido',
  outros: 'Outros / Insumos',
};

export const ProdutosServicosPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const [aba, setAba] = useState<
    'produtos' | 'servicos' | 'marcas_modelos' | 'fornecedores' | 'extrato'
  >(searchParams.get('aba') === 'marcas_modelos' ? 'marcas_modelos' : 'produtos');
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [apenasEstoqueBaixo, setApenasEstoqueBaixo] = useState(
    searchParams.get('filtro') === 'estoque_baixo'
  );

  // Modal de Produto
  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [editandoProduto, setEditandoProduto] = useState<Produto | null>(null);
  const [formProduto, setFormProduto] = useState({
    codigo: '',
    codigoDeBarras: '',
    descricao: '',
    categoria: 'tela' as CategoriaProduto,
    marcaCompativel: 'Samsung',
    modelosCompativeisTexto: '',
    unidade: 'UN' as Produto['unidade'],
    custoReais: '0,00',
    precoVendaReais: '0,00',
    estoqueAtual: 0,
    estoqueMinimo: 2,
    fornecedorId: '',
    localizacao: '',
    ativo: true,
  });

  // Modal de Entrada / Ajuste de Estoque
  const [modalEstoqueAberto, setModalEstoqueAberto] = useState(false);
  const [produtoEstoqueAlvo, setProdutoEstoqueAlvo] = useState<Produto | null>(null);
  const [formEstoque, setFormEstoque] = useState({
    tipo: 'entrada' as 'entrada' | 'ajuste',
    quantidadeDelta: 1,
    custoUnitarioReais: '',
    fornecedorId: '',
    motivo: 'Compra de reposição de estoque',
  });

  // Modal de Serviço
  const [modalServicoAberto, setModalServicoAberto] = useState(false);
  const [editandoServico, setEditandoServico] = useState<Servico | null>(null);
  const [formServico, setFormServico] = useState({
    codigo: '',
    descricao: '',
    precoReais: '80,00',
    tempoEstimadoMinutos: 60,
    garantiaPadraoDias: 90,
    ativo: true,
  });

  // Modal de Fornecedor
  const [modalFornecedorAberto, setModalFornecedorAberto] = useState(false);
  const [editandoFornecedor, setEditandoFornecedor] = useState<Fornecedor | null>(null);
  const [formFornecedor, setFormFornecedor] = useState({
    nome: '',
    cnpj: '',
    telefone: '',
    email: '',
    observacoes: '',
    ativo: true,
  });

  useEffect(() => {
    if (searchParams.get('filtro') === 'estoque_baixo') {
      setApenasEstoqueBaixo(true);
      setAba('produtos');
    } else if (searchParams.get('aba') === 'marcas_modelos') {
      setAba('marcas_modelos');
    }
  }, [searchParams]);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => produtoRepo.listar(),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => servicoRepo.listar(),
  });

  const { data: catalogoMarcas = [] } = useQuery({
    queryKey: ['catalogoMarcas'],
    queryFn: () => aparelhoRepo.listarCatalogoMarcas(),
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => fornecedorRepo.listar(),
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoesEstoque'],
    queryFn: () => produtoRepo.listarMovimentacoes(),
  });

  const converterReaisParaCentavos = (txt: string) => {
    const limpo = txt.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  const converterCentavosParaInput = (centavos: number) =>
    ((centavos || 0) / 100).toFixed(2).replace('.', ',');

  // Filtros
  const produtosFiltrados = produtos.filter((p) => {
    if (categoriaFiltro !== 'todas' && p.categoria !== categoriaFiltro) return false;
    if (apenasEstoqueBaixo && p.estoqueAtual > p.estoqueMinimo) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (
      p.descricao.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) ||
      (p.codigoDeBarras?.includes(q) ?? false) ||
      (p.marcaCompativel?.toLowerCase().includes(q) ?? false)
    );
  });

  const servicosFiltrados = servicos.filter((s) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return s.descricao.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q);
  });

  const fornecedoresFiltrados = fornecedores.filter((f) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return f.nome.toLowerCase().includes(q) || (f.cnpj?.includes(q) ?? false);
  });

  // Exportar CSV de Produtos
  const exportarProdutosCsv = () => {
    const cabecalho = 'Codigo;CodigoBarras;Descricao;Categoria;Custo;PrecoVenda;EstoqueAtual;EstoqueMinimo;Localizacao\n';
    const linhas = produtos
      .map(
        (p) =>
          `${p.codigo};${p.codigoDeBarras || ''};"${p.descricao}";${p.categoria};${(
            p.custoCentavos / 100
          ).toFixed(2)};${(p.precoVendaCentavos / 100).toFixed(2)};${p.estoqueAtual};${
            p.estoqueMinimo
          };"${p.localizacao || ''}"`
      )
      .join('\n');

    const blob = new Blob(['\ufeff' + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoque-shlojacell-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notificar('Planilha CSV de estoque exportada!', 'sucesso');
  };

  // Ações de Produto
  const abrirNovoProduto = () => {
    setEditandoProduto(null);
    setFormProduto({
      codigo: `PRD-${String(produtos.length + 1).padStart(3, '0')}`,
      codigoDeBarras: `7891000000${String(produtos.length + 1).padStart(3, '0')}`,
      descricao: '',
      categoria: 'tela',
      marcaCompativel: 'Samsung',
      modelosCompativeisTexto: '',
      unidade: 'UN',
      custoReais: '100,00',
      precoVendaReais: '220,00',
      estoqueAtual: 2,
      estoqueMinimo: 1,
      fornecedorId: fornecedores[0]?.id || '',
      localizacao: 'Gaveta A1',
      ativo: true,
    });
    setModalProdutoAberto(true);
  };

  const abrirEditarProduto = (p: Produto) => {
    setEditandoProduto(p);
    setFormProduto({
      codigo: p.codigo,
      codigoDeBarras: p.codigoDeBarras || '',
      descricao: p.descricao,
      categoria: p.categoria,
      marcaCompativel: p.marcaCompativel || '',
      modelosCompativeisTexto: p.modelosCompativeis.join(', '),
      unidade: p.unidade,
      custoReais: converterCentavosParaInput(p.custoCentavos),
      precoVendaReais: converterCentavosParaInput(p.precoVendaCentavos),
      estoqueAtual: p.estoqueAtual,
      estoqueMinimo: p.estoqueMinimo,
      fornecedorId: p.fornecedorId || '',
      localizacao: p.localizacao || '',
      ativo: p.ativo,
    });
    setModalProdutoAberto(true);
  };

  const salvarProdutoMutation = useMutation({
    mutationFn: async () => {
      if (!formProduto.descricao.trim() || !formProduto.codigo.trim()) {
        throw new Error('Código e descrição são obrigatórios.');
      }
      const payload: Omit<Produto, 'id' | 'criadoEm' | 'atualizadoEm'> = {
        codigo: formProduto.codigo.trim().toUpperCase(),
        codigoDeBarras: formProduto.codigoDeBarras.trim() || undefined,
        descricao: formProduto.descricao.trim(),
        categoria: formProduto.categoria,
        marcaCompativel: formProduto.marcaCompativel.trim() || undefined,
        modelosCompativeis: formProduto.modelosCompativeisTexto
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        unidade: formProduto.unidade,
        custoCentavos: converterReaisParaCentavos(formProduto.custoReais),
        precoVendaCentavos: converterReaisParaCentavos(formProduto.precoVendaReais),
        estoqueAtual: Number(formProduto.estoqueAtual) || 0,
        estoqueMinimo: Number(formProduto.estoqueMinimo) || 0,
        fornecedorId: formProduto.fornecedorId || undefined,
        localizacao: formProduto.localizacao.trim() || undefined,
        ativo: formProduto.ativo,
      };

      if (editandoProduto) {
        return produtoRepo.atualizar(editandoProduto.id, payload);
      }
      return produtoRepo.criar(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setModalProdutoAberto(false);
      notificar(editandoProduto ? 'Produto atualizado!' : 'Novo produto cadastrado!', 'sucesso');
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao salvar produto', 'erro');
    },
  });

  // Entrada / Ajuste de Estoque
  const abrirModalMovimentarEstoque = (p: Produto) => {
    setProdutoEstoqueAlvo(p);
    setFormEstoque({
      tipo: 'entrada',
      quantidadeDelta: 5,
      custoUnitarioReais: converterCentavosParaInput(p.custoCentavos),
      fornecedorId: p.fornecedorId || fornecedores[0]?.id || '',
      motivo: 'Entrada de nota / reposição de estoque',
    });
    setModalEstoqueAberto(true);
  };

  const ajustarEstoqueMutation = useMutation({
    mutationFn: async () => {
      if (!produtoEstoqueAlvo) throw new Error('Produto inválido');
      const qtd = Number(formEstoque.quantidadeDelta);
      if (!qtd || qtd === 0) throw new Error('Informe uma quantidade diferente de zero.');
      return produtoRepo.ajustarEstoque({
        produtoId: produtoEstoqueAlvo.id,
        quantidadeDelta: qtd,
        tipo: formEstoque.tipo,
        motivo: formEstoque.motivo.trim() || 'Ajuste manual',
        custoUnitarioCentavos: converterReaisParaCentavos(formEstoque.custoUnitarioReais),
        fornecedorId: formEstoque.fornecedorId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoesEstoque'] });
      setModalEstoqueAberto(false);
      notificar('Estoque atualizado e registrado no extrato!', 'sucesso');
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao movimentar estoque', 'erro');
    },
  });

  // Serviços CRUD
  const salvarServicoMutation = useMutation({
    mutationFn: async () => {
      if (!formServico.descricao.trim()) throw new Error('Descrição é obrigatória.');
      const payload: Omit<Servico, 'id' | 'criadoEm' | 'atualizadoEm'> = {
        codigo: formServico.codigo.trim().toUpperCase() || 'SRV',
        descricao: formServico.descricao.trim(),
        precoPadraoCentavos: converterReaisParaCentavos(formServico.precoReais),
        tempoEstimadoMinutos: Number(formServico.tempoEstimadoMinutos) || 60,
        garantiaPadraoDias: Number(formServico.garantiaPadraoDias) || 90,
        ativo: formServico.ativo,
      };
      if (editandoServico) {
        return servicoRepo.atualizar(editandoServico.id, payload);
      }
      return servicoRepo.criar(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      setModalServicoAberto(false);
      notificar('Serviço salvo com sucesso!', 'sucesso');
    },
  });

  // Fornecedores CRUD
  const salvarFornecedorMutation = useMutation({
    mutationFn: async () => {
      if (!formFornecedor.nome.trim()) throw new Error('Nome do fornecedor é obrigatório.');
      const payload: Omit<Fornecedor, 'id' | 'criadoEm' | 'atualizadoEm'> = {
        nome: formFornecedor.nome.trim(),
        cnpj: formFornecedor.cnpj.trim() || undefined,
        telefone: formFornecedor.telefone.trim(),
        email: formFornecedor.email.trim() || undefined,
        observacoes: formFornecedor.observacoes.trim() || undefined,
        ativo: formFornecedor.ativo,
      };
      if (editandoFornecedor) {
        return fornecedorRepo.atualizar(editandoFornecedor.id, payload);
      }
      return fornecedorRepo.criar(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setModalFornecedorAberto(false);
      notificar('Fornecedor salvo com sucesso!', 'sucesso');
    },
  });

  const mapaProdutos = new Map(produtos.map((p) => [p.id, p]));

  return (
    <div className="space-y-5">
      {/* Cabeçalho e Abas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Produtos, Peças, Serviços e Catálogo de Modelos
            </h2>
            <p className="text-sm text-slate-500">
              Cadastre produtos (capas, películas, cabos, peças), controle margem de lucro, serviços e marcas/modelos
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {aba === 'produtos' && (
              <button
                type="button"
                onClick={exportarProdutosCsv}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Exportar CSV</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setAba('produtos');
                abrirNovoProduto();
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Produto</span>
            </button>

            {aba === 'servicos' && (
              <button
                type="button"
                onClick={() => {
                  setEditandoServico(null);
                  setFormServico({
                    codigo: `SRV-${servicos.length + 1}`,
                    descricao: '',
                    precoReais: '80,00',
                    tempoEstimadoMinutos: 60,
                    garantiaPadraoDias: 90,
                    ativo: true,
                  });
                  setModalServicoAberto(true);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Serviço (Mão de Obra)</span>
              </button>
            )}

            {aba === 'fornecedores' && (
              <button
                type="button"
                onClick={() => {
                  setEditandoFornecedor(null);
                  setFormFornecedor({
                    nome: '',
                    cnpj: '',
                    telefone: '',
                    email: '',
                    observacoes: '',
                    ativo: true,
                  });
                  setModalFornecedorAberto(true);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Fornecedor</span>
              </button>
            )}
          </div>
        </div>

        {/* Abas Superiores */}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {[
            { id: 'produtos', label: `Produtos e Peças (${produtos.length})`, icone: Package },
            { id: 'servicos', label: `Serviços / Mão de Obra (${servicos.length})`, icone: Wrench },
            {
              id: 'marcas_modelos',
              label: `Marcas e Modelos (${catalogoMarcas.length} marcas)`,
              icone: Smartphone,
            },
            { id: 'fornecedores', label: `Fornecedores (${fornecedores.length})`, icone: Truck },
            {
              id: 'extrato',
              label: `Extrato de Estoque (${movimentacoes.length})`,
              icone: History,
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

      {/* ABA DE MARCAS E MODELOS */}
      {aba === 'marcas_modelos' && <MarcasModelosSection />}

      {/* Barra de Busca e Filtros */}
      {aba !== 'extrato' && aba !== 'marcas_modelos' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição, código interno ou código de barras (leitor USB)..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          {aba === 'produtos' && (
            <>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="todas">Todas as categorias</option>
                {Object.entries(CATEGORIAS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>

              <label className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={apenasEstoqueBaixo}
                  onChange={(e) => setApenasEstoqueBaixo(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600"
                />
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Apenas Estoque Baixo</span>
              </label>
            </>
          )}
        </div>
      )}

      {/* ABA 1: PRODUTOS */}
      {aba === 'produtos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4">Código / Local</th>
                <th className="py-3.5 px-4">Produto / Peça / Acessório</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4 text-right">Custo</th>
                <th className="py-3.5 px-4 text-right">Venda</th>
                <th className="py-3.5 px-4 text-right">Lucro / Margem</th>
                <th className="py-3.5 px-4 text-center">Estoque</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {produtosFiltrados.map((p) => {
                const baixo = p.estoqueAtual <= p.estoqueMinimo;
                const lucroUnit = p.precoVendaCentavos - p.custoCentavos;
                const margemPct =
                  p.custoCentavos > 0 ? Math.round((lucroUnit / p.custoCentavos) * 100) : 100;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-xs">
                      <span className="font-bold text-slate-800 block">{p.codigo}</span>
                      <span className="text-slate-400">{p.localizacao || 'Balcão'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{p.descricao}</p>
                      <p className="text-xs text-slate-500">
                        {p.marcaCompativel || 'Universal'}
                        {p.modelosCompativeis.length > 0 &&
                          ` • ${p.modelosCompativeis.join(', ')}`}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {CATEGORIAS_LABELS[p.categoria]}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 text-xs">
                      {formatarMoeda(p.custoCentavos)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatarMoeda(p.precoVendaCentavos)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs">
                      <span className="font-bold text-emerald-700 block">
                        +{formatarMoeda(lucroUnit)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        ({margemPct}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          p.estoqueAtual === 0
                            ? 'bg-rose-100 text-rose-800'
                            : baixo
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.estoqueAtual} {p.unidade}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirModalMovimentarEstoque(p)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold inline-flex items-center gap-1"
                          title="Entrada ou Ajuste de Estoque"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                          <span>Estoque</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEditarProduto(p)}
                          className="min-h-[38px] p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Editar Produto"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Exibindo {produtosFiltrados.length} de {produtos.length} produtos cadastrados
            </span>
            <button
              type="button"
              onClick={abrirNovoProduto}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cadastrar Novo Produto</span>
            </button>
          </div>
        </div>
      )}

      {/* ABA 2: SERVIÇOS */}
      {aba === 'servicos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Descrição do Serviço (Mão de Obra)</th>
                <th className="py-3.5 px-4 text-center">Tempo Estimado</th>
                <th className="py-3.5 px-4 text-center">Garantia Padrão</th>
                <th className="py-3.5 px-4 text-right">Preço Padrão</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {servicosFiltrados.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-700">
                    {s.codigo}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{s.descricao}</td>
                  <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                    {s.tempoEstimadoMinutos} min
                  </td>
                  <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                    {s.garantiaPadraoDias} dias
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {formatarMoeda(s.precoPadraoCentavos)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoServico(s);
                        setFormServico({
                          codigo: s.codigo,
                          descricao: s.descricao,
                          precoReais: converterCentavosParaInput(s.precoPadraoCentavos),
                          tempoEstimadoMinutos: s.tempoEstimadoMinutos,
                          garantiaPadraoDias: s.garantiaPadraoDias,
                          ativo: s.ativo,
                        });
                        setModalServicoAberto(true);
                      }}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 3: FORNECEDORES */}
      {aba === 'fornecedores' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {fornecedoresFiltrados.map((f) => (
            <div
              key={f.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900">{f.nome}</h3>
                  <p className="text-xs text-slate-500">CNPJ: {f.cnpj || 'Não informado'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditandoFornecedor(f);
                    setFormFornecedor({
                      nome: f.nome,
                      cnpj: f.cnpj || '',
                      telefone: f.telefone,
                      email: f.email || '',
                      observacoes: f.observacoes || '',
                      ativo: f.ativo,
                    });
                    setModalFornecedorAberto(true);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-800"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-700">
                <strong>Telefone:</strong> {f.telefone}
              </p>
              {f.email && (
                <p className="text-xs text-slate-700">
                  <strong>E-mail:</strong> {f.email}
                </p>
              )}
              {f.observacoes && (
                <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                  {f.observacoes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ABA 4: EXTRATO DE MOVIMENTAÇÕES DE ESTOQUE */}
      {aba === 'extrato' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4">Data / Hora</th>
                <th className="py-3.5 px-4">Produto</th>
                <th className="py-3.5 px-4">Tipo</th>
                <th className="py-3.5 px-4 text-center">Qtd</th>
                <th className="py-3.5 px-4 text-center">Saldo Final</th>
                <th className="py-3.5 px-4">Motivo / Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {movimentacoes.map((m) => {
                const prod = mapaProdutos.get(m.produtoId);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {formatarDataHora(m.criadoEm)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {prod?.descricao || m.produtoId}
                    </td>
                    <td className="py-3 px-4 text-xs uppercase font-bold">
                      {m.tipo.replace('_', ' ')}
                    </td>
                    <td
                      className={`py-3 px-4 text-center font-bold ${
                        m.quantidade > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-mono">
                      {m.saldoPosterior}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{m.motivo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Produto */}
      {modalProdutoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">
                {editandoProduto ? 'Editar Produto / Peça' : 'Cadastrar Novo Produto ou Peça'}
              </h3>
              <button
                type="button"
                onClick={() => setModalProdutoAberto(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código Interno / SKU *
                </label>
                <input
                  type="text"
                  value={formProduto.codigo}
                  onChange={(e) => setFormProduto({ ...formProduto, codigo: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código de Barras (EAN)
                </label>
                <input
                  type="text"
                  value={formProduto.codigoDeBarras}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, codigoDeBarras: e.target.value })
                  }
                  placeholder="Opcional — para leitura no PDV"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome / Descrição do Produto *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={formProduto.descricao}
                  onChange={(e) => setFormProduto({ ...formProduto, descricao: e.target.value })}
                  placeholder="Ex.: Película 3D Vidro Temperado A14, Carregador Turbo 20W..."
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                <select
                  value={formProduto.categoria}
                  onChange={(e) =>
                    setFormProduto({
                      ...formProduto,
                      categoria: e.target.value as CategoriaProduto,
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {Object.entries(CATEGORIAS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Marca Compatível
                </label>
                <input
                  type="text"
                  value={formProduto.marcaCompativel}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, marcaCompativel: e.target.value })
                  }
                  placeholder="Ex.: Samsung, Apple, Universal"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Localização (Gaveta/Vitrine)
                </label>
                <input
                  type="text"
                  value={formProduto.localizacao}
                  onChange={(e) => setFormProduto({ ...formProduto, localizacao: e.target.value })}
                  placeholder="Ex.: Gaveta A1, Painel..."
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Modelos Compatíveis (Separados por vírgula — Opcional)
                </label>
                <input
                  type="text"
                  value={formProduto.modelosCompativeisTexto}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, modelosCompativeisTexto: e.target.value })
                  }
                  placeholder="Ex.: Galaxy A14, Galaxy A15, iPhone 13..."
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preço de Custo (R$)
                </label>
                <input
                  type="text"
                  value={formProduto.custoReais}
                  onChange={(e) => setFormProduto({ ...formProduto, custoReais: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preço de Venda (R$) *
                </label>
                <input
                  type="text"
                  value={formProduto.precoVendaReais}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, precoVendaReais: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estoque Atual / Mínimo
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formProduto.estoqueAtual}
                    onChange={(e) =>
                      setFormProduto({ ...formProduto, estoqueAtual: Number(e.target.value) })
                    }
                    title="Estoque Atual"
                    className="w-1/2 min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <input
                    type="number"
                    value={formProduto.estoqueMinimo}
                    onChange={(e) =>
                      setFormProduto({ ...formProduto, estoqueMinimo: Number(e.target.value) })
                    }
                    title="Estoque Mínimo p/ Alerta"
                    className="w-1/2 min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Resumo de Margem de Lucro em Tempo Real */}
              {(() => {
                const custoC = converterReaisParaCentavos(formProduto.custoReais);
                const vendaC = converterReaisParaCentavos(formProduto.precoVendaReais);
                const lucroC = vendaC - custoC;
                const margemP = custoC > 0 ? Math.round((lucroC / custoC) * 100) : 100;
                return (
                  <div className="sm:col-span-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-emerald-900 block">
                        Resumo de Margem e Lucro Unitário
                      </span>
                      <span className="text-emerald-700">
                        Calculado automaticamente sobre o custo e preço de venda informados
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-emerald-800 block">
                        Lucro: {formatarMoeda(lucroC)} / un.
                      </span>
                      <span className="font-bold text-emerald-700">
                        Margem Estimada: {margemP}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalProdutoAberto(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => salvarProdutoMutation.mutate()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Produto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Entrada / Ajuste de Estoque */}
      {modalEstoqueAberto && produtoEstoqueAlvo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Movimentar Estoque</h3>
              <button
                type="button"
                onClick={() => setModalEstoqueAberto(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-slate-100 text-xs">
                <p className="font-bold text-slate-900">{produtoEstoqueAlvo.descricao}</p>
                <p className="text-slate-600 mt-0.5">
                  Saldo atual: <strong>{produtoEstoqueAlvo.estoqueAtual}</strong>{' '}
                  {produtoEstoqueAlvo.unidade}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Movimento
                  </label>
                  <select
                    value={formEstoque.tipo}
                    onChange={(e) =>
                      setFormEstoque({
                        ...formEstoque,
                        tipo: e.target.value as 'entrada' | 'ajuste',
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="entrada">Entrada (Compra)</option>
                    <option value="ajuste">Ajuste Manual (+/-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantidade (+/-)
                  </label>
                  <input
                    type="number"
                    value={formEstoque.quantidadeDelta}
                    onChange={(e) =>
                      setFormEstoque({ ...formEstoque, quantidadeDelta: Number(e.target.value) })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Novo Custo Unitário (R$)
                </label>
                <input
                  type="text"
                  value={formEstoque.custoUnitarioReais}
                  onChange={(e) =>
                    setFormEstoque({ ...formEstoque, custoUnitarioReais: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo / Observação da Movimentação
                </label>
                <input
                  type="text"
                  value={formEstoque.motivo}
                  onChange={(e) => setFormEstoque({ ...formEstoque, motivo: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalEstoqueAberto(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => ajustarEstoqueMutation.mutate()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold"
              >
                Confirmar Movimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Serviço */}
      {modalServicoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">
                {editandoServico ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>
              <button
                type="button"
                onClick={() => setModalServicoAberto(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código</label>
                <input
                  type="text"
                  value={formServico.codigo}
                  onChange={(e) => setFormServico({ ...formServico, codigo: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição do Serviço *
                </label>
                <input
                  type="text"
                  value={formServico.descricao}
                  onChange={(e) => setFormServico({ ...formServico, descricao: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    value={formServico.precoReais}
                    onChange={(e) => setFormServico({ ...formServico, precoReais: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tempo (min)
                  </label>
                  <input
                    type="number"
                    value={formServico.tempoEstimadoMinutos}
                    onChange={(e) =>
                      setFormServico({
                        ...formServico,
                        tempoEstimadoMinutos: Number(e.target.value),
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Garantia (dias)
                  </label>
                  <input
                    type="number"
                    value={formServico.garantiaPadraoDias}
                    onChange={(e) =>
                      setFormServico({
                        ...formServico,
                        garantiaPadraoDias: Number(e.target.value),
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalServicoAberto(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => salvarServicoMutation.mutate()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold"
              >
                Salvar Serviço
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Fornecedor */}
      {modalFornecedorAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">
                {editandoFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button
                type="button"
                onClick={() => setModalFornecedorAberto(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razão Social / Nome *
                </label>
                <input
                  type="text"
                  value={formFornecedor.nome}
                  onChange={(e) => setFormFornecedor({ ...formFornecedor, nome: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={formFornecedor.cnpj}
                    onChange={(e) =>
                      setFormFornecedor({
                        ...formFornecedor,
                        cnpj: aplicarMascaraCpfCnpj(e.target.value),
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formFornecedor.telefone}
                    onChange={(e) =>
                      setFormFornecedor({
                        ...formFornecedor,
                        telefone: aplicarMascaraTelefone(e.target.value),
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={formFornecedor.observacoes}
                  onChange={(e) =>
                    setFormFornecedor({ ...formFornecedor, observacoes: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalFornecedorAberto(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => salvarFornecedorMutation.mutate()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold"
              >
                Salvar Fornecedor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
