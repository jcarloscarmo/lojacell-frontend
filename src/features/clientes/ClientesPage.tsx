import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Search,
  Phone,
  Smartphone,
  Wrench,
  ShoppingCart,
  Edit3,
  Power,
  Trash2,
  X,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Building2,
  User,
} from 'lucide-react';
import {
  clienteRepo,
  aparelhoRepo,
  osRepo,
  vendaRepo,
  financeiroRepo,
} from '@/repositories/localStorageRepo';
import { Cliente, Aparelho } from '@/types/domain';
import {
  formatarMoeda,
  formatarData,
  formatarNumeroOS,
  aplicarMascaraTelefone,
  aplicarMascaraCpfCnpj,
  aplicarMascaraCep,
} from '@/utils/formatters';
import { STATUS_OS_LABELS } from '@/features/dashboard/DashboardPage';
import { SeletorMarcaModelo } from '@/components/ui/SeletorMarcaModelo';
import { useToast } from '@/components/ui/Toast';

export const ClientesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const [busca, setBusca] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(
    searchParams.get('clienteId')
  );
  const [abaDetalhe, setAbaDetalhe] = useState<'dados' | 'aparelhos' | 'historico'>('dados');

  // Modal de Novo/Editar Cliente
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [editandoCliente, setEditandoCliente] = useState<Cliente | null>(null);
  const [formCliente, setFormCliente] = useState({
    nome: '',
    tipoPessoa: 'fisica' as 'fisica' | 'juridica',
    cpfCnpj: '',
    telefone: '',
    whatsapp: true,
    email: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: 'São Paulo',
    uf: 'SP',
    observacoes: '',
    ativo: true,
  });

  // Modal de Novo/Editar Aparelho
  const [modalAparelhoAberto, setModalAparelhoAberto] = useState(false);
  const [editandoAparelho, setEditandoAparelho] = useState<Aparelho | null>(null);
  const [mostrarSenhaAparelho, setMostrarSenhaAparelho] = useState<Record<string, boolean>>({});
  const [novaMarcaInput, setNovaMarcaInput] = useState('');
  const [novoModeloInput, setNovoModeloInput] = useState('');
  const [formAparelho, setFormAparelho] = useState({
    marca: 'Samsung',
    modelo: '',
    cor: '',
    imeiSerial: '',
    senhaOuPadrao: '',
    carregador: false,
    capa: true,
    chip: true,
    cartaoMemoria: false,
    bandejaChip: true,
    observacoes: '',
  });

  useEffect(() => {
    const paramId = searchParams.get('clienteId');
    if (paramId) setClienteSelecionadoId(paramId);
  }, [searchParams]);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => clienteRepo.listar(),
  });

  const { data: aparelhos = [] } = useQuery({
    queryKey: ['aparelhos'],
    queryFn: () => aparelhoRepo.listar(),
  });

  const { data: catalogoMarcas = [] } = useQuery({
    queryKey: ['catalogoMarcas'],
    queryFn: () => aparelhoRepo.listarCatalogoMarcas(),
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordensServico'],
    queryFn: () => osRepo.listar(),
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => vendaRepo.listar(),
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ['lancamentosFinanceiros'],
    queryFn: () => financeiroRepo.listarLancamentos(),
  });

  const clienteSelecionado = clientes.find((c) => c.id === clienteSelecionadoId) || clientes[0];

  const clientesFiltrados = clientes.filter((c) => {
    if (!mostrarInativos && !c.ativo) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    const qDigitos = q.replace(/\D/g, '');
    return (
      c.nome.toLowerCase().includes(q) ||
      c.telefone.toLowerCase().includes(q) ||
      (qDigitos && c.telefone.replace(/\D/g, '').includes(qDigitos)) ||
      (c.cpfCnpj?.toLowerCase().includes(q) ?? false) ||
      (qDigitos && (c.cpfCnpj?.replace(/\D/g, '').includes(qDigitos) ?? false))
    );
  });

  const abrirModalNovoCliente = () => {
    setEditandoCliente(null);
    setFormCliente({
      nome: '',
      tipoPessoa: 'fisica',
      cpfCnpj: '',
      telefone: '',
      whatsapp: true,
      email: '',
      cep: '',
      rua: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: 'São Paulo',
      uf: 'SP',
      observacoes: '',
      ativo: true,
    });
    setModalClienteAberto(true);
  };

  const abrirModalEditarCliente = (cli: Cliente) => {
    setEditandoCliente(cli);
    setFormCliente({
      nome: cli.nome,
      tipoPessoa: cli.tipoPessoa,
      cpfCnpj: cli.cpfCnpj || '',
      telefone: cli.telefone,
      whatsapp: cli.whatsapp,
      email: cli.email || '',
      cep: cli.endereco?.cep || '',
      rua: cli.endereco?.rua || '',
      numero: cli.endereco?.numero || '',
      complemento: cli.endereco?.complemento || '',
      bairro: cli.endereco?.bairro || '',
      cidade: cli.endereco?.cidade || 'São Paulo',
      uf: cli.endereco?.uf || 'SP',
      observacoes: cli.observacoes || '',
      ativo: cli.ativo,
    });
    setModalClienteAberto(true);
  };

  const salvarClienteMutation = useMutation({
    mutationFn: async () => {
      if (!formCliente.nome.trim() || !formCliente.telefone.trim()) {
        throw new Error('Nome e telefone são obrigatórios.');
      }
      const payload: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'> = {
        nome: formCliente.nome.trim(),
        tipoPessoa: formCliente.tipoPessoa,
        cpfCnpj: formCliente.cpfCnpj.trim() || undefined,
        telefone: formCliente.telefone.trim(),
        whatsapp: formCliente.whatsapp,
        email: formCliente.email.trim() || undefined,
        endereco: formCliente.rua.trim()
          ? {
              cep: formCliente.cep,
              rua: formCliente.rua,
              numero: formCliente.numero,
              complemento: formCliente.complemento || undefined,
              bairro: formCliente.bairro,
              cidade: formCliente.cidade,
              uf: formCliente.uf,
            }
          : undefined,
        observacoes: formCliente.observacoes.trim() || undefined,
        ativo: formCliente.ativo,
      };

      if (editandoCliente) {
        return clienteRepo.atualizar(editandoCliente.id, payload);
      }
      return clienteRepo.criar(payload);
    },
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setClienteSelecionadoId(salvo.id);
      setModalClienteAberto(false);
      notificar(
        editandoCliente ? 'Cliente atualizado com sucesso!' : 'Novo cliente cadastrado!',
        'sucesso'
      );
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao salvar cliente', 'erro');
    },
  });

  const handleExcluirOuInativarCliente = async (cli: Cliente) => {
    const temHistorico = await clienteRepo.possuiHistorico(cli.id);
    if (temHistorico) {
      const novoStatus = !cli.ativo;
      await clienteRepo.atualizar(cli.id, { ativo: novoStatus });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      notificar(
        novoStatus
          ? `Cliente ${cli.nome} reativado.`
          : `Cliente possui histórico de OS/vendas e foi apenas inativado (regra de integridade).`,
        'aviso'
      );
    } else {
      if (window.confirm(`Deseja realmente excluir o cadastro de "${cli.nome}"?`)) {
        await clienteRepo.remover(cli.id);
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
        setClienteSelecionadoId(null);
        notificar('Cliente excluído com sucesso.', 'sucesso');
      }
    }
  };

  // Aparelhos do cliente selecionado
  const aparelhosDoCliente = clienteSelecionado
    ? aparelhos.filter((a) => a.clienteId === clienteSelecionado.id)
    : [];

  const osDoCliente = clienteSelecionado
    ? ordens.filter((o) => o.clienteId === clienteSelecionado.id)
    : [];

  const vendasDoCliente = clienteSelecionado
    ? vendas.filter((v) => v.clienteId === clienteSelecionado.id)
    : [];

  const pendenciasDoCliente = clienteSelecionado
    ? lancamentos.filter(
        (l) =>
          l.clienteId === clienteSelecionado.id &&
          l.tipo === 'entrada' &&
          (l.status === 'pendente' || l.status === 'vencido')
      )
    : [];

  const totalGastoCliente =
    osDoCliente
      .filter((o) => o.status === 'entregue')
      .reduce((acc, o) => acc + o.totalCentavos, 0) +
    vendasDoCliente
      .filter((v) => v.status === 'concluida')
      .reduce((acc, v) => acc + v.totalCentavos, 0);

  const abrirModalNovoAparelho = () => {
    if (!clienteSelecionado) return;
    setEditandoAparelho(null);
    const primeiraMarca = catalogoMarcas[0]?.marca || 'Samsung';
    const primeiroModelo = catalogoMarcas[0]?.modelos[0] || '';
    setFormAparelho({
      marca: primeiraMarca,
      modelo: primeiroModelo,
      cor: '',
      imeiSerial: '',
      senhaOuPadrao: '',
      carregador: false,
      capa: true,
      chip: true,
      cartaoMemoria: false,
      bandejaChip: true,
      observacoes: '',
    });
    setNovaMarcaInput('');
    setNovoModeloInput('');
    setModalAparelhoAberto(true);
  };

  const abrirModalEditarAparelho = (apa: Aparelho) => {
    setEditandoAparelho(apa);
    setFormAparelho({
      marca: apa.marca,
      modelo: apa.modelo,
      cor: apa.cor || '',
      imeiSerial: apa.imeiSerial || '',
      senhaOuPadrao: apa.senhaOuPadrao || '',
      carregador: apa.acessorios.carregador,
      capa: apa.acessorios.capa,
      chip: apa.acessorios.chip,
      cartaoMemoria: apa.acessorios.cartaoMemoria,
      bandejaChip: apa.acessorios.bandejaChip,
      observacoes: apa.observacoes || '',
    });
    setNovaMarcaInput('');
    setNovoModeloInput('');
    setModalAparelhoAberto(true);
  };

  const salvarAparelhoMutation = useMutation({
    mutationFn: async () => {
      if (!clienteSelecionado) throw new Error('Selecione um cliente');
      const marcaFinal = novaMarcaInput.trim() || formAparelho.marca.trim();
      const modeloFinal = novoModeloInput.trim() || formAparelho.modelo.trim();
      if (!marcaFinal || !modeloFinal) {
        throw new Error('Informe a marca e o modelo do aparelho.');
      }

      // Garante que marca e modelo novos entrem para o catálogo para as próximas buscas
      await aparelhoRepo.adicionarMarcaModelo(marcaFinal, modeloFinal);

      const payload: Omit<Aparelho, 'id' | 'criadoEm' | 'atualizadoEm'> = {
        clienteId: clienteSelecionado.id,
        marca: marcaFinal,
        modelo: modeloFinal,
        cor: formAparelho.cor.trim() || undefined,
        imeiSerial: formAparelho.imeiSerial.trim() || undefined,
        senhaOuPadrao: formAparelho.senhaOuPadrao.trim() || undefined,
        acessorios: {
          carregador: formAparelho.carregador,
          capa: formAparelho.capa,
          chip: formAparelho.chip,
          cartaoMemoria: formAparelho.cartaoMemoria,
          bandejaChip: formAparelho.bandejaChip,
        },
        observacoes: formAparelho.observacoes.trim() || undefined,
      };

      if (editandoAparelho) {
        return aparelhoRepo.atualizar(editandoAparelho.id, payload);
      }
      return aparelhoRepo.criar(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aparelhos'] });
      queryClient.invalidateQueries({ queryKey: ['catalogoMarcas'] });
      setModalAparelhoAberto(false);
      notificar(
        editandoAparelho ? 'Aparelho atualizado!' : 'Aparelho cadastrado e vinculado ao cliente!',
        'sucesso'
      );
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao salvar aparelho', 'erro');
    },
  });

  const modelosDaMarcaSelecionada =
    catalogoMarcas.find((m) => m.marca === formAparelho.marca)?.modelos || [];

  return (
    <div className="space-y-5">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Clientes, Aparelhos e Histórico</h2>
          <p className="text-sm text-slate-500">
            {clientes.length} clientes e {aparelhos.length} aparelhos cadastrados
          </p>
        </div>
        <button
          type="button"
          onClick={abrirModalNovoCliente}
          className="min-h-[48px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Layout Mestre-Detalhe para Tablet e Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Coluna Esquerda: Lista de Clientes */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(e) => setMostrarInativos(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 w-4 h-4"
              />
              <span>Mostrar clientes inativos</span>
            </label>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {clientesFiltrados.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Nenhum cliente encontrado. Cadastre o primeiro botão acima.
              </div>
            ) : (
              clientesFiltrados.map((cli) => {
                const selecionado = clienteSelecionado?.id === cli.id;
                const qtdAparelhos = aparelhos.filter((a) => a.clienteId === cli.id).length;
                const qtdOS = ordens.filter((o) => o.clienteId === cli.id).length;

                return (
                  <button
                    key={cli.id}
                    type="button"
                    onClick={() => {
                      setClienteSelecionadoId(cli.id);
                      setSearchParams({ clienteId: cli.id });
                    }}
                    className={`w-full p-4 text-left transition-colors flex items-center justify-between gap-3 ${
                      selecionado
                        ? 'bg-sky-50/90 border-l-4 border-sky-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {cli.nome}
                        </span>
                        {!cli.ativo && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cli.telefone}</span>
                        {cli.cpfCnpj && <span className="text-slate-400">• {cli.cpfCnpj}</span>}
                      </p>
                      {cli.endereco && (cli.endereco.rua || cli.endereco.bairro) && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          📍 {cli.endereco.rua}
                          {cli.endereco.numero ? `, ${cli.endereco.numero}` : ''}
                          {cli.endereco.bairro ? ` - ${cli.endereco.bairro}` : ''}
                        </p>
                      )}
                      {cli.observacoes && (
                        <p className="text-[11px] text-amber-700 truncate mt-0.5">
                          💬 Obs: {cli.observacoes}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                        {qtdAparelhos} {qtdAparelhos === 1 ? 'aparelho' : 'aparelhos'}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">{qtdOS} OS</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna Direita: Ficha Completa do Cliente Selecionado */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {!clienteSelecionado ? (
            <div className="p-12 text-center text-slate-500">
              Selecione um cliente na lista ao lado para visualizar seus aparelhos e histórico.
            </div>
          ) : (
            <div>
              {/* Cabeçalho do Cliente */}
              <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center shrink-0">
                    {clienteSelecionado.tipoPessoa === 'juridica' ? (
                      <Building2 className="w-6 h-6" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold">{clienteSelecionado.nome}</h3>
                      {clienteSelecionado.whatsapp && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          WhatsApp
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">
                      Tel: {clienteSelecionado.telefone}{' '}
                      {clienteSelecionado.cpfCnpj && `• CPF/CNPJ: ${clienteSelecionado.cpfCnpj}`}
                    </p>
                    {clienteSelecionado.endereco &&
                      (clienteSelecionado.endereco.rua || clienteSelecionado.endereco.bairro) && (
                        <p className="text-xs text-slate-300">
                          <strong>Endereço:</strong> {clienteSelecionado.endereco.rua}
                          {clienteSelecionado.endereco.numero
                            ? `, ${clienteSelecionado.endereco.numero}`
                            : ''}
                          {clienteSelecionado.endereco.complemento
                            ? ` (${clienteSelecionado.endereco.complemento})`
                            : ''}
                          {clienteSelecionado.endereco.bairro
                            ? ` — ${clienteSelecionado.endereco.bairro}`
                            : ''}
                          {clienteSelecionado.endereco.cidade
                            ? ` - ${clienteSelecionado.endereco.cidade}/${
                                clienteSelecionado.endereco.uf || 'SP'
                              }`
                            : ''}
                        </p>
                      )}
                    {clienteSelecionado.observacoes && (
                      <p className="text-xs text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 rounded-lg inline-block">
                        <strong>Observações:</strong> {clienteSelecionado.observacoes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/os/nova?clienteId=${clienteSelecionado.id}`)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Abrir OS p/ Cliente</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirModalEditarCliente(clienteSelecionado)}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluirOuInativarCliente(clienteSelecionado)}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-semibold flex items-center gap-1.5"
                    title="Inativar ou excluir"
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Resumo Financeiro do Cliente */}
              <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50 text-center py-3">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Total Gasto na Loja
                  </span>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {formatarMoeda(totalGastoCliente)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    OS Realizadas
                  </span>
                  <p className="text-sm font-extrabold text-sky-700 mt-0.5">
                    {osDoCliente.length} ordens
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Saldo Pendente
                  </span>
                  <p
                    className={`text-sm font-extrabold mt-0.5 ${
                      pendenciasDoCliente.length > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatarMoeda(
                      pendenciasDoCliente.reduce((acc, p) => acc + p.valorCentavos, 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Abas da Ficha */}
              <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2">
                {[
                  { id: 'aparelhos', label: `Aparelhos (${aparelhosDoCliente.length})` },
                  {
                    id: 'historico',
                    label: `Histórico OS & Vendas (${osDoCliente.length + vendasDoCliente.length})`,
                  },
                  { id: 'dados', label: 'Dados Cadastrais' },
                ].map((aba) => (
                  <button
                    key={aba.id}
                    type="button"
                    onClick={() => setAbaDetalhe(aba.id as typeof abaDetalhe)}
                    className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                      abaDetalhe === aba.id
                        ? 'border-sky-600 text-sky-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {aba.label}
                  </button>
                ))}
              </div>

              {/* Conteúdo da Aba */}
              <div className="p-5">
                {abaDetalhe === 'aparelhos' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Aparelhos vinculados a este cliente para abertura rápida de OS
                      </p>
                      <button
                        type="button"
                        onClick={abrirModalNovoAparelho}
                        className="min-h-[42px] px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Cadastrar Aparelho</span>
                      </button>
                    </div>

                    {aparelhosDoCliente.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
                        Nenhum aparelho cadastrado para este cliente.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {aparelhosDoCliente.map((apa) => {
                          const senhaVisivel = !!mostrarSenhaAparelho[apa.id];
                          return (
                            <div
                              key={apa.id}
                              className="p-4 rounded-xl border border-slate-200 hover:border-sky-300 bg-slate-50/60 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Smartphone className="w-5 h-5 text-sky-600 shrink-0" />
                                  <div>
                                    <h4 className="font-bold text-sm text-slate-900">
                                      {apa.marca} {apa.modelo}
                                    </h4>
                                    <span className="text-xs text-slate-500">
                                      Cor: {apa.cor || 'Não informada'}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => abrirModalEditarAparelho(apa)}
                                  className="p-2 rounded-lg text-slate-500 hover:text-sky-700 hover:bg-white"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="text-xs space-y-1 pt-1 border-t border-slate-200/80">
                                <p className="font-mono text-slate-700">
                                  <strong>IMEI/Serial:</strong> {apa.imeiSerial || 'Não informado'}
                                </p>
                                {apa.senhaOuPadrao && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-600">
                                      <strong>Senha/Padrão:</strong>{' '}
                                      {senhaVisivel ? apa.senhaOuPadrao : '••••••'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMostrarSenhaAparelho((prev) => ({
                                          ...prev,
                                          [apa.id]: !prev[apa.id],
                                        }))
                                      }
                                      className="text-sky-600 hover:underline inline-flex items-center gap-1"
                                    >
                                      {senhaVisivel ? (
                                        <EyeOff className="w-3.5 h-3.5" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                )}
                                {apa.observacoes && (
                                  <p className="text-slate-500 italic">{apa.observacoes}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {abaDetalhe === 'historico' && (
                  <div className="space-y-5">
                    {pendenciasDoCliente.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-rose-800 text-xs">
                          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                          <div>
                            <p className="font-bold">Cliente possui valores em aberto</p>
                            <p>{pendenciasDoCliente[0].descricao}</p>
                          </div>
                        </div>
                        <span className="font-bold text-sm text-rose-700">
                          {formatarMoeda(
                            pendenciasDoCliente.reduce((acc, p) => acc + p.valorCentavos, 0)
                          )}
                        </span>
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                        Ordens de Serviço ({osDoCliente.length})
                      </h4>
                      {osDoCliente.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhuma OS registrada.</p>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                          {osDoCliente.map((os) => {
                            const apa = aparelhos.find((a) => a.id === os.aparelhoId);
                            const st = STATUS_OS_LABELS[os.status];
                            return (
                              <div
                                key={os.id}
                                onClick={() => navigate(`/os?abrir=${os.id}`)}
                                className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-xs text-sky-700">
                                      #{formatarNumeroOS(os.numero)}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-900">
                                      {apa ? `${apa.marca} ${apa.modelo}` : 'Aparelho'}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.cor}`}
                                    >
                                      {st.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1">
                                    {os.defeitoRelatado}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-bold text-sm text-slate-900">
                                    {formatarMoeda(os.totalCentavos)}
                                  </p>
                                  <p className="text-[11px] text-slate-400">
                                    {formatarData(os.dataEntrada)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                        Compras de Balcão ({vendasDoCliente.length})
                      </h4>
                      {vendasDoCliente.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhuma compra avulsa registrada.</p>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                          {vendasDoCliente.map((v) => (
                            <div
                              key={v.id}
                              className="p-3.5 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-800">
                                  Venda #{formatarNumeroOS(v.numero)}
                                </span>
                                <p className="text-slate-500 mt-0.5">
                                  {v.itens.map((i) => `${i.quantidade}x ${i.descricao}`).join(', ')}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-900">
                                  {formatarMoeda(v.totalCentavos)}
                                </span>
                                <p className="text-slate-400">{formatarData(v.data)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {abaDetalhe === 'dados' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-xs text-slate-500 block">E-mail</span>
                      <strong className="text-slate-900">
                        {clienteSelecionado.email || 'Não informado'}
                      </strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-xs text-slate-500 block">Cadastrado em</span>
                      <strong className="text-slate-900">
                        {formatarData(clienteSelecionado.criadoEm)}
                      </strong>
                    </div>
                    <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-xs text-slate-500 block">Endereço Completo</span>
                      <strong className="text-slate-900">
                        {clienteSelecionado.endereco
                          ? `${clienteSelecionado.endereco.rua}, ${clienteSelecionado.endereco.numero} ${
                              clienteSelecionado.endereco.complemento || ''
                            } — ${clienteSelecionado.endereco.bairro}, ${
                              clienteSelecionado.endereco.cidade
                            }/${clienteSelecionado.endereco.uf} (CEP: ${
                              clienteSelecionado.endereco.cep
                            })`
                          : 'Não cadastrado'}
                      </strong>
                    </div>
                    <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-xs text-slate-500 block">Observações do Cliente</span>
                      <p className="text-slate-800 mt-0.5">
                        {clienteSelecionado.observacoes || 'Nenhuma observação.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cadastro/Edição de Cliente */}
      {modalClienteAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900">
                {editandoCliente ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
              </h3>
              <button
                type="button"
                onClick={() => setModalClienteAberto(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo / Razão Social *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={formCliente.nome}
                    onChange={(e) => setFormCliente({ ...formCliente, nome: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    placeholder="Ex.: Maria Aparecida Silva"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Pessoa
                  </label>
                  <select
                    value={formCliente.tipoPessoa}
                    onChange={(e) =>
                      setFormCliente({
                        ...formCliente,
                        tipoPessoa: e.target.value as 'fisica' | 'juridica',
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="fisica">Pessoa Física</option>
                    <option value="juridica">Pessoa Jurídica</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / Celular *
                  </label>
                  <input
                    type="text"
                    value={formCliente.telefone}
                    onChange={(e) =>
                      setFormCliente({
                        ...formCliente,
                        telefone: aplicarMascaraTelefone(e.target.value),
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    value={formCliente.cpfCnpj}
                    onChange={(e) =>
                      setFormCliente({
                        ...formCliente,
                        cpfCnpj: aplicarMascaraCpfCnpj(e.target.value),
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formCliente.email}
                    onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formCliente.whatsapp}
                  onChange={(e) => setFormCliente({ ...formCliente, whatsapp: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-600"
                />
                <span>Este número possui WhatsApp</span>
              </label>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">
                  Endereço e Observações (Opcional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">CEP</label>
                    <input
                      type="text"
                      value={formCliente.cep}
                      onChange={(e) =>
                        setFormCliente({ ...formCliente, cep: aplicarMascaraCep(e.target.value) })
                      }
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Rua</label>
                    <input
                      type="text"
                      value={formCliente.rua}
                      onChange={(e) => setFormCliente({ ...formCliente, rua: e.target.value })}
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Número</label>
                    <input
                      type="text"
                      value={formCliente.numero}
                      onChange={(e) => setFormCliente({ ...formCliente, numero: e.target.value })}
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={formCliente.bairro}
                      onChange={(e) => setFormCliente({ ...formCliente, bairro: e.target.value })}
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={formCliente.cidade}
                      onChange={(e) => setFormCliente({ ...formCliente, cidade: e.target.value })}
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    value={formCliente.observacoes}
                    onChange={(e) =>
                      setFormCliente({ ...formCliente, observacoes: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalClienteAberto(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => salvarClienteMutation.mutate()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Cliente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro/Edição de Aparelho + Catálogo Dinâmico de Marca/Modelo */}
      {modalAparelhoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900">
                {editandoAparelho ? 'Editar Aparelho' : 'Vincular Novo Aparelho'}
              </h3>
              <button
                type="button"
                onClick={() => setModalAparelhoAberto(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <SeletorMarcaModelo
                    marca={formAparelho.marca}
                    modelo={formAparelho.modelo}
                    onChange={(novaMarca, novoModelo) => {
                      setFormAparelho({
                        ...formAparelho,
                        marca: novaMarca,
                        modelo: novoModelo,
                      });
                      setNovaMarcaInput('');
                      setNovoModeloInput('');
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cor</label>
                  <input
                    type="text"
                    value={formAparelho.cor}
                    onChange={(e) => setFormAparelho({ ...formAparelho, cor: e.target.value })}
                    placeholder="Ex.: Preto, Grafite, Azul..."
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    IMEI ou Número de Série
                  </label>
                  <input
                    type="text"
                    value={formAparelho.imeiSerial}
                    onChange={(e) =>
                      setFormAparelho({ ...formAparelho, imeiSerial: e.target.value })
                    }
                    placeholder="Digite ou leia com leitor USB"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Senha ou Padrão de Desbloqueio (Opcional — Dado Sensível)
                  </label>
                  <input
                    type="text"
                    value={formAparelho.senhaOuPadrao}
                    onChange={(e) =>
                      setFormAparelho({ ...formAparelho, senhaOuPadrao: e.target.value })
                    }
                    placeholder="Ex.: PIN 123456 ou Padrão L invertido"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50/40 text-sm"
                  />
                  <span className="text-[11px] text-amber-700 mt-0.5 block">
                    Aviso: campo sensível usado apenas pelo técnico para testar o aparelho na bancada.
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Acessórios deixados com o aparelho
                </span>
                <div className="flex flex-wrap gap-3 text-xs">
                  {[
                    { k: 'capa', label: 'Capa' },
                    { k: 'chip', label: 'Chip SIM' },
                    { k: 'bandejaChip', label: 'Gaveta do Chip' },
                    { k: 'cartaoMemoria', label: 'Cartão SD' },
                    { k: 'carregador', label: 'Carregador' },
                  ].map((item) => (
                    <label
                      key={item.k}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(formAparelho[item.k as keyof typeof formAparelho])}
                        onChange={(e) =>
                          setFormAparelho({ ...formAparelho, [item.k]: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-sky-600"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalAparelhoAberto(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => salvarAparelhoMutation.mutate()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Aparelho</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
