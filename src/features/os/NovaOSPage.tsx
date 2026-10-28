import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Smartphone,
  Wrench,
  Package,
  Search,
  Plus,
  CheckCircle2,
  Printer,
  FileText,
  Trash2,
  Camera,
  AlertTriangle,
  Save,
  X,
  ArrowLeft,
  Edit3,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import {
  clienteRepo,
  aparelhoRepo,
  osRepo,
  produtoRepo,
  servicoRepo,
  configRepo,
} from '@/repositories/localStorageRepo';
import {
  Cliente,
  Aparelho,
  ChecklistEntrada,
  ItemOS,
  OrdemServico,
  PrioridadeOS,
} from '@/types/domain';
import {
  formatarMoeda,
  formatarNumeroOS,
  aplicarMascaraTelefone,
  aplicarMascaraCpfCnpj,
  gerarId,
  formatarAroPeca,
} from '@/utils/formatters';
import { useToast } from '@/components/ui/Toast';
import { SeletorMarcaModelo } from '@/components/ui/SeletorMarcaModelo';
import { processarEEnviarImagemOS } from '@/utils/imageCompressor';
import { LancadorPecaManualOS } from './LancadorPecaManualOS';

const FRASES_DEFEITO_COMUNS = [
  'Não liga',
  'Tela quebrada / trincada',
  'Touch não funciona / fantasma',
  'Não carrega / mau contato no cabo',
  'Bateria viciada / descarregando rápido',
  'Caiu na água / molhou',
  'Sem áudio / microfone baixo',
  'Travando / reiniciando no logo',
];

const CHECKLIST_ITENS: { key: keyof ChecklistEntrada; label: string }[] = [
  { key: 'liga', label: 'Aparelho Liga' },
  { key: 'telaTrincada', label: 'Tela Trincada' },
  { key: 'touchOk', label: 'Touch OK' },
  { key: 'carrega', label: 'Carrega' },
  { key: 'camerasOk', label: 'Câmeras OK' },
  { key: 'audioOk', label: 'Áudio / Mic OK' },
  { key: 'wifiBluetoothOk', label: 'Wi-Fi / BT OK' },
  { key: 'botoesOk', label: 'Botões Físicos OK' },
  { key: 'biometriaOk', label: 'Biometria / Face ID' },
  { key: 'chipOk', label: 'Reconhece Chip / Rede' },
  { key: 'sinalOxidacao', label: 'Sinal de Oxidação / Líquido' },
];

export const NovaOSPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const buscaClienteRef = useRef<HTMLInputElement>(null);
  const defeitoRef = useRef<HTMLTextAreaElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Dados dos repositórios
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

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => produtoRepo.listar(),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => servicoRepo.listar(),
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordensServico'],
    queryFn: () => osRepo.listar(),
  });

  const { data: config } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => configRepo.obterConfiguracoes(),
  });

  // Etapa 1: Cliente
  const [termoCliente, setTermoCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const [novoClienteForm, setNovoClienteForm] = useState({
    nome: '',
    telefone: '',
    cpfCnpj: '',
    whatsapp: true,
    enderecoRua: '',
    enderecoNumero: '',
    enderecoBairro: '',
    enderecoCidade: '',
    observacoes: '',
  });

  // Etapa 2: Aparelho
  const [aparelhoSelecionado, setAparelhoSelecionado] = useState<Aparelho | null>(null);
  const [modoNovoAparelho, setModoNovoAparelho] = useState(false);
  const [novaMarcaTexto, setNovaMarcaTexto] = useState('');
  const [novoModeloTexto, setNovoModeloTexto] = useState('');
  const [novoAparelhoForm, setNovoAparelhoForm] = useState({
    marca: 'Samsung',
    modelo: 'Galaxy A54 5G',
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

  // Etapa 3: Defeito e Entrada (Suporta Data de Entrada Retroativa)
  const hojeStr = new Date().toISOString().slice(0, 10);
  const amanhaStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [dataEntradaData, setDataEntradaData] = useState(hojeStr);
  const [defeitoRelatado, setDefeitoRelatado] = useState('');
  const [condicoesFisicas, setCondicoesFisicas] = useState('');
  const [senhaDesbloqueio, setSenhaDesbloqueio] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeOS>('normal');
  const [previsaoEntregaData, setPrevisaoEntregaData] = useState(amanhaStr);
  const [tecnicoResponsavel, setTecnicoResponsavel] = useState(
    'Carlos Eduardo (Principal)'
  );
  const [criandoNovoTecnico, setCriandoNovoTecnico] = useState(false);
  const [novoTecnicoNome, setNovoTecnicoNome] = useState('');
  const [observacoesInternas, setObservacoesInternas] = useState('');
  const [fotosBase64, setFotosBase64] = useState<string[]>([]);
  const [checklistAberto, setChecklistAberto] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistEntrada>({
    liga: true,
    telaTrincada: false,
    touchOk: true,
    carrega: true,
    camerasOk: true,
    audioOk: true,
    wifiBluetoothOk: true,
    botoesOk: true,
    biometriaOk: true,
    chipOk: true,
    sinalOxidacao: false,
  });

  // Etapa 4: Peças e Serviços (Progressive Disclosure + Edição de Peça)
  const [buscaItem, setBuscaItem] = useState('');
  const [mostrarBuscaEstoque, setMostrarBuscaEstoque] = useState(false);
  const [mostrarAjustesFinanceiros, setMostrarAjustesFinanceiros] = useState(false);
  const [itensOS, setItensOS] = useState<ItemOS[]>([]);
  const [itemEmEdicao, setItemEmEdicao] = useState<ItemOS | null>(null);
  const [descontoGeralReais, setDescontoGeralReais] = useState('0,00');
  const [acrescimoGeralReais, setAcrescimoGeralReais] = useState('0,00');

  // Estado de Sucesso Pós-Salvamento
  const [osCriada, setOsCriada] = useState<OrdemServico | null>(null);

  // Pré-selecionar cliente se vier por query param (?clienteId=...)
  useEffect(() => {
    const cid = searchParams.get('clienteId');
    if (cid && clientes.length > 0 && !clienteSelecionado) {
      const encontrado = clientes.find((c) => c.id === cid);
      if (encontrado) {
        selecionarCliente(encontrado);
      }
    }
  }, [searchParams, clientes]);

  // Foco inicial no campo de busca de cliente
  useEffect(() => {
    buscaClienteRef.current?.focus();
  }, []);

  const selecionarCliente = (cli: Cliente) => {
    setClienteSelecionado(cli);
    setTermoCliente('');
    const aparelhosDele = aparelhos.filter((a) => a.clienteId === cli.id);
    if (aparelhosDele.length > 0) {
      setAparelhoSelecionado(aparelhosDele[0]);
      setSenhaDesbloqueio(aparelhosDele[0].senhaOuPadrao || '');
      setModoNovoAparelho(false);
    } else {
      setAparelhoSelecionado(null);
      setModoNovoAparelho(true);
    }
  };

  const resultadosClientes = termoCliente.trim()
    ? clientes
        .filter((c) => {
          const q = termoCliente.toLowerCase();
          const qDig = q.replace(/\D/g, '');
          return (
            c.nome.toLowerCase().includes(q) ||
            c.telefone.toLowerCase().includes(q) ||
            (qDig && c.telefone.replace(/\D/g, '').includes(qDig)) ||
            (c.cpfCnpj?.toLowerCase().includes(q) ?? false)
          );
        })
        .slice(0, 6)
    : [];

  // Criar cliente rápido sem sair da OS
  const criarClienteRapidoMutation = useMutation({
    mutationFn: async () => {
      if (!novoClienteForm.nome.trim() || !novoClienteForm.telefone.trim()) {
        throw new Error('Preencha Nome e Telefone do cliente.');
      }
      const temEndereco =
        novoClienteForm.enderecoRua.trim() ||
        novoClienteForm.enderecoNumero.trim() ||
        novoClienteForm.enderecoBairro.trim() ||
        novoClienteForm.enderecoCidade.trim();

      return clienteRepo.criar({
        nome: novoClienteForm.nome.trim(),
        tipoPessoa: 'fisica',
        telefone: novoClienteForm.telefone.trim(),
        cpfCnpj: novoClienteForm.cpfCnpj.trim() || undefined,
        whatsapp: novoClienteForm.whatsapp,
        endereco: temEndereco
          ? {
              cep: '',
              rua: novoClienteForm.enderecoRua.trim(),
              numero: novoClienteForm.enderecoNumero.trim(),
              bairro: novoClienteForm.enderecoBairro.trim(),
              cidade: novoClienteForm.enderecoCidade.trim() || 'São Paulo',
              uf: 'SP',
            }
          : undefined,
        observacoes: novoClienteForm.observacoes.trim() || undefined,
        ativo: true,
      });
    },
    onSuccess: (novoCli) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setModalNovoCliente(false);
      setClienteSelecionado(novoCli);
      setAparelhoSelecionado(null);
      setModoNovoAparelho(true);
      notificar(`Cliente ${novoCli.nome} cadastrado e selecionado!`, 'sucesso');
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao criar cliente', 'erro');
    },
  });

  // Cadastrar novo técnico ativo direto na OS
  const adicionarNovoTecnicoMutation = useMutation({
    mutationFn: async () => {
      const nomeLimpo = novoTecnicoNome.trim();
      if (!nomeLimpo) throw new Error('Informe o nome do técnico.');
      const listaAtual = config?.tecnicosAtivos || ['Carlos Eduardo (Principal)'];
      const novaLista = Array.from(new Set([...listaAtual, nomeLimpo]));
      await configRepo.salvarConfiguracoes({ tecnicosAtivos: novaLista });
      return nomeLimpo;
    },
    onSuccess: (nomeSalvo) => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      setTecnicoResponsavel(nomeSalvo);
      setNovoTecnicoNome('');
      setCriandoNovoTecnico(false);
      notificar(`Técnico "${nomeSalvo}" cadastrado nos técnicos ativos!`, 'sucesso');
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao cadastrar técnico', 'erro');
    },
  });

  // Criar aparelho vinculado na hora
  const salvarNovoAparelhoInline = async (): Promise<Aparelho> => {
    if (!clienteSelecionado) throw new Error('Selecione o cliente primeiro.');
    const marcaFinal = novaMarcaTexto.trim() || novoAparelhoForm.marca.trim();
    const modeloFinal = novoModeloTexto.trim() || novoAparelhoForm.modelo.trim();
    if (!marcaFinal || !modeloFinal) {
      throw new Error('Informe a marca e o modelo do aparelho na Etapa 2.');
    }
    await aparelhoRepo.adicionarMarcaModelo(marcaFinal, modeloFinal);
    const criado = await aparelhoRepo.criar({
      clienteId: clienteSelecionado.id,
      marca: marcaFinal,
      modelo: modeloFinal,
      cor: novoAparelhoForm.cor.trim() || undefined,
      imeiSerial: novoAparelhoForm.imeiSerial.trim() || undefined,
      senhaOuPadrao: senhaDesbloqueio.trim() || novoAparelhoForm.senhaOuPadrao.trim() || undefined,
      acessorios: {
        carregador: novoAparelhoForm.carregador,
        capa: novoAparelhoForm.capa,
        chip: novoAparelhoForm.chip,
        cartaoMemoria: novoAparelhoForm.cartaoMemoria,
        bandejaChip: novoAparelhoForm.bandejaChip,
      },
      observacoes: novoAparelhoForm.observacoes.trim() || undefined,
    });
    queryClient.invalidateQueries({ queryKey: ['aparelhos'] });
    queryClient.invalidateQueries({ queryKey: ['catalogoMarcas'] });
    return criado;
  };

  // Upload de Fotos com compressão automática (~70KB WebP/JPEG) e envio ao Supabase Storage (1GB)
  const handleAdicionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resultado = await processarEEnviarImagemOS(file);
      setFotosBase64((prev) => [...prev, resultado.urlOuBase64]);
      const kb = Math.max(1, Math.round(resultado.tamanhoBytes / 1024));
      notificar(
        resultado.armazenadoNoStorage
          ? `Foto comprimida (${kb} KB) e salva no Supabase Storage!`
          : `Foto otimizada (${kb} KB) anexada à OS!`,
        'sucesso'
      );
    } catch {
      notificar('Não foi possível processar a imagem selecionada.', 'erro');
    } finally {
      e.target.value = '';
    }
  };

  // Busca de peças e serviços na Etapa 4
  const resultadosCatalogo = buscaItem.trim()
    ? [
        ...servicos
          .filter(
            (s) =>
              s.ativo &&
              (s.descricao.toLowerCase().includes(buscaItem.toLowerCase()) ||
                s.codigo.toLowerCase().includes(buscaItem.toLowerCase()))
          )
          .map((s) => ({
            tipo: 'servico' as const,
            id: s.id,
            codigo: s.codigo,
            descricao: s.descricao,
            valorUnitarioCentavos: s.precoPadraoCentavos,
            custoUnitarioCentavos: 0,
            estoqueAtual: null as number | null,
          })),
        ...produtos
          .filter(
            (p) =>
              p.ativo &&
              (p.descricao.toLowerCase().includes(buscaItem.toLowerCase()) ||
                p.codigo.toLowerCase().includes(buscaItem.toLowerCase()) ||
                (p.codigoDeBarras?.includes(buscaItem) ?? false))
          )
          .map((p) => ({
            tipo: 'peca' as const,
            id: p.id,
            codigo: p.codigo,
            descricao: p.descricao,
            valorUnitarioCentavos: p.precoVendaCentavos,
            custoUnitarioCentavos: p.custoCentavos,
            estoqueAtual: p.estoqueAtual,
          })),
      ].slice(0, 8)
    : [];

  const adicionarItemNaOS = (item: (typeof resultadosCatalogo)[number]) => {
    if (item.tipo === 'peca' && item.estoqueAtual !== null && item.estoqueAtual <= 0) {
      notificar(
        `Atenção: A peça "${item.descricao}" está com estoque zerado!`,
        'aviso',
        'Você ainda pode incluí-la para orçamento ou aguardar peça.'
      );
    }
    setItensOS((prev) => [
      ...prev,
      {
        id: gerarId(),
        tipo: item.tipo,
        referenciaId: item.id,
        descricao: item.descricao,
        quantidade: 1,
        valorUnitarioCentavos: item.valorUnitarioCentavos,
        custoUnitarioCentavos: item.custoUnitarioCentavos,
        descontoCentavos: 0,
      },
    ]);
    setBuscaItem('');
    setMostrarBuscaEstoque(false);
  };

  const converterReaisParaCentavos = (txt: string) => {
    const limpo = txt.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  const subtotalCentavos = itensOS.reduce(
    (acc, item) => acc + item.quantidade * item.valorUnitarioCentavos - item.descontoCentavos,
    0
  );
  const descontoGeralCentavos = converterReaisParaCentavos(descontoGeralReais);
  const acrescimoGeralCentavos = converterReaisParaCentavos(acrescimoGeralReais);
  const totalFinalCentavos = Math.max(
    0,
    subtotalCentavos - descontoGeralCentavos + acrescimoGeralCentavos
  );

  // Salvar OS (Normal ou Rascunho) com suporte a Data de Entrada Retroativa
  const salvarOSMutation = useMutation({
    mutationFn: async (comoRascunho: boolean) => {
      if (!clienteSelecionado) {
        throw new Error('Etapa 1: Selecione ou cadastre um cliente.');
      }

      let aparelhoFinal = aparelhoSelecionado;
      if (modoNovoAparelho || !aparelhoFinal) {
        aparelhoFinal = await salvarNovoAparelhoInline();
        setAparelhoSelecionado(aparelhoFinal);
        setModoNovoAparelho(false);
      }

      if (!comoRascunho && !defeitoRelatado.trim()) {
        defeitoRef.current?.focus();
        throw new Error('Etapa 3: Informe o defeito relatado pelo cliente.');
      }

      const proximoNumero = await osRepo.obterProximoNumero();
      const agoraISO = new Date().toISOString();
      const dataEntradaFinalISO =
        dataEntradaData && dataEntradaData !== hojeStr
          ? new Date(`${dataEntradaData}T10:00:00`).toISOString()
          : agoraISO;

      const novaOS = await osRepo.criar({
        numero: proximoNumero,
        rascunho: comoRascunho,
        clienteId: clienteSelecionado.id,
        aparelhoId: aparelhoFinal.id,
        dataEntrada: dataEntradaFinalISO,
        previsaoEntrega: previsaoEntregaData
          ? new Date(`${previsaoEntregaData}T18:00:00`).toISOString()
          : undefined,
        status: 'aguardando_analise',
        prioridade,
        defeitoRelatado: defeitoRelatado.trim() || '(Rascunho sem defeito preenchido)',
        checklistEntrada: checklist,
        condicoesFisicas: condicoesFisicas.trim() || undefined,
        itens: itensOS,
        descontoCentavos: descontoGeralCentavos,
        acrescimoCentavos: acrescimoGeralCentavos,
        totalCentavos: totalFinalCentavos,
        pagamentos: [],
        garantiaDias: config?.garantiaPadraoOSDias || 90,
        termosGarantia: config?.termosGarantiaPadrao,
        fotos: fotosBase64,
        tecnicoResponsavel,
        observacoesInternas: observacoesInternas.trim() || undefined,
        estoqueBaixado: false,
        historicoStatus: [
          {
            status: 'aguardando_analise',
            dataHora: dataEntradaFinalISO,
            usuario: 'Administrador',
            observacao: comoRascunho
              ? 'Salva como rascunho'
              : dataEntradaData !== hojeStr
              ? `Abertura de OS com data retroativa (${dataEntradaData})`
              : 'Abertura de OS no balcão',
          },
        ],
      });

      return novaOS;
    },
    onSuccess: (criada) => {
      queryClient.invalidateQueries({ queryKey: ['ordensServico'] });
      setOsCriada(criada);
      notificar(
        `OS #${formatarNumeroOS(criada.numero)} aberta com sucesso!`,
        'sucesso'
      );
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao salvar OS', 'erro');
    },
  });

  // Atalho Ctrl+S para salvar a OS rapidamente
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!osCriada && !salvarOSMutation.isPending) {
          salvarOSMutation.mutate(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const aparelhosDoCliente = clienteSelecionado
    ? aparelhos.filter((a) => a.clienteId === clienteSelecionado.id)
    : [];

  const osAnterioresDoCliente = clienteSelecionado
    ? ordens.filter((o) => o.clienteId === clienteSelecionado.id).length
    : 0;

  const modelosDaMarca =
    catalogoMarcas.find((m) => m.marca === novoAparelhoForm.marca)?.modelos || [];

  // TELA DE SUCESSO APÓS SALVAR A OS (Seção 8.1 do PRD)
  if (osCriada) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-lg space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 uppercase">
            Status: Aguardando Análise
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-3">
            OS #{formatarNumeroOS(osCriada.numero)} registrada!
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Cliente: <strong>{clienteSelecionado?.nome}</strong> • Aparelho:{' '}
            <strong>
              {aparelhoSelecionado?.marca} {aparelhoSelecionado?.modelo}
            </strong>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(`/os?abrir=${osCriada.id}&imprimir=entrada`)}
            className="min-h-[52px] px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md"
          >
            <Printer className="w-5 h-5" />
            <span>Imprimir Comprovante</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/os?abrir=${osCriada.id}`)}
            className="min-h-[52px] px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5" />
            <span>Abrir Ficha da OS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOsCriada(null);
              setClienteSelecionado(null);
              setAparelhoSelecionado(null);
              setDefeitoRelatado('');
              setCondicoesFisicas('');
              setItensOS([]);
            }}
            className="min-h-[52px] px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Nova OS</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Cabeçalho Rápido */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/os')}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600"
            title="Voltar para Lista de OS"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Abertura Rápida de Ordem de Serviço (Balcão)
            </h2>
            <p className="text-xs text-slate-500">
              Preencha as 4 etapas na mesma página • Atalho <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border">Ctrl+S</kbd> salva imediatamente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => salvarOSMutation.mutate(true)}
            className="min-h-[46px] px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            Salvar Rascunho
          </button>
          <button
            type="button"
            onClick={() => salvarOSMutation.mutate(false)}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>Salvar OS</span>
          </button>
        </div>
      </div>

      {/* ETAPA 1 – CLIENTE */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="font-bold text-slate-900">Cliente</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setNovoClienteForm({
                nome: termoCliente,
                telefone: '',
                cpfCnpj: '',
                whatsapp: true,
                enderecoRua: '',
                enderecoNumero: '',
                enderecoBairro: '',
                enderecoCidade: '',
                observacoes: '',
              });
              setModalNovoCliente(true);
            }}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Cliente</span>
          </button>
        </div>

        {!clienteSelecionado ? (
          <div className="relative">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={buscaClienteRef}
                type="text"
                value={termoCliente}
                onChange={(e) => setTermoCliente(e.target.value)}
                placeholder="Digite nome, telefone ou CPF/CNPJ do cliente para buscar..."
                className="w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            {termoCliente.trim() && (
              <div className="mt-2 border border-slate-200 rounded-xl bg-white shadow-lg divide-y divide-slate-100 overflow-hidden">
                {resultadosClientes.length === 0 ? (
                  <div className="p-4 flex items-center justify-between text-sm text-slate-600">
                    <span>Nenhum cliente encontrado com "{termoCliente}".</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNovoClienteForm({
                          nome: termoCliente,
                          telefone: '',
                          cpfCnpj: '',
                          whatsapp: true,
                          enderecoRua: '',
                          enderecoNumero: '',
                          enderecoBairro: '',
                          enderecoCidade: '',
                          observacoes: '',
                        });
                        setModalNovoCliente(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold"
                    >
                      + Cadastrar "{termoCliente}" Agora
                    </button>
                  </div>
                ) : (
                  resultadosClientes.map((cli) => (
                    <button
                      key={cli.id}
                      type="button"
                      onClick={() => selecionarCliente(cli)}
                      className="w-full p-3.5 text-left hover:bg-sky-50 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-900">{cli.nome}</p>
                        <p className="text-xs text-slate-500">
                          Tel: {cli.telefone} {cli.cpfCnpj && `• Doc: ${cli.cpfCnpj}`}
                          {cli.endereco?.rua &&
                            ` • End: ${cli.endereco.rua}${
                              cli.endereco.numero ? `, ${cli.endereco.numero}` : ''
                            }`}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-sky-600">Selecionar →</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-900 text-base">{clienteSelecionado.nome}</h4>
                <p className="text-xs text-slate-600">
                  Telefone: <strong>{clienteSelecionado.telefone}</strong> •{' '}
                  {osAnterioresDoCliente} OS anteriores • {aparelhosDoCliente.length} aparelhos
                  vinculados
                </p>
                {clienteSelecionado.endereco &&
                  (clienteSelecionado.endereco.rua || clienteSelecionado.endereco.bairro) && (
                    <p className="text-xs text-slate-700">
                      <strong>Endereço:</strong> {clienteSelecionado.endereco.rua}
                      {clienteSelecionado.endereco.numero
                        ? `, ${clienteSelecionado.endereco.numero}`
                        : ''}
                      {clienteSelecionado.endereco.bairro
                        ? ` - ${clienteSelecionado.endereco.bairro}`
                        : ''}
                      {clienteSelecionado.endereco.cidade
                        ? ` (${clienteSelecionado.endereco.cidade})`
                        : ''}
                    </p>
                  )}
                {clienteSelecionado.observacoes && (
                  <p className="text-xs text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded inline-block mt-1">
                    <strong>Obs. do Cliente:</strong> {clienteSelecionado.observacoes}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setClienteSelecionado(null);
                setAparelhoSelecionado(null);
                setTimeout(() => buscaClienteRef.current?.focus(), 50);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Trocar Cliente
            </button>
          </div>
        )}
      </section>

      {/* ETAPA 2 – APARELHO */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="font-bold text-slate-900">Aparelho do Cliente</h3>
          </div>

          {clienteSelecionado && (
            <button
              type="button"
              onClick={() => {
                setModoNovoAparelho(!modoNovoAparelho);
                if (!modoNovoAparelho) setAparelhoSelecionado(null);
              }}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4" />
              <span>
                {modoNovoAparelho && aparelhosDoCliente.length > 0
                  ? 'Escolher Aparelho Existente'
                  : '+ Novo Aparelho'}
              </span>
            </button>
          )}
        </div>

        {!clienteSelecionado ? (
          <p className="text-sm text-slate-400">
            Selecione um cliente na Etapa 1 para escolher ou cadastrar o aparelho.
          </p>
        ) : !modoNovoAparelho && aparelhosDoCliente.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aparelhosDoCliente.map((apa) => {
              const ativo = aparelhoSelecionado?.id === apa.id;
              return (
                <button
                  key={apa.id}
                  type="button"
                  onClick={() => {
                    setAparelhoSelecionado(apa);
                    setSenhaDesbloqueio(apa.senhaOuPadrao || '');
                    defeitoRef.current?.focus();
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    ativo
                      ? 'bg-sky-50 border-sky-600 ring-2 ring-sky-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      {apa.marca} {apa.modelo}
                    </span>
                    {ativo && <CheckCircle2 className="w-4 h-4 text-sky-600" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cor: {apa.cor || '—'} • IMEI: {apa.imeiSerial || 'Não informado'}
                  </p>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setModoNovoAparelho(true);
                setAparelhoSelecionado(null);
              }}
              className="p-4 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-100/70 text-sky-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors min-h-[72px]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cadastrar Outro Aparelho / Modelo</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <SeletorMarcaModelo
                  marca={novoAparelhoForm.marca}
                  modelo={novoAparelhoForm.modelo}
                  onChange={(novaMarca, novoModelo) => {
                    setNovoAparelhoForm({
                      ...novoAparelhoForm,
                      marca: novaMarca,
                      modelo: novoModelo,
                    });
                    setNovaMarcaTexto('');
                    setNovoModeloTexto('');
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cor</label>
                <input
                  type="text"
                  value={novoAparelhoForm.cor}
                  onChange={(e) =>
                    setNovoAparelhoForm({ ...novoAparelhoForm, cor: e.target.value })
                  }
                  placeholder="Ex.: Preto, Azul..."
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IMEI / Nº de Série
                </label>
                <input
                  type="text"
                  value={novoAparelhoForm.imeiSerial}
                  onChange={(e) =>
                    setNovoAparelhoForm({ ...novoAparelhoForm, imeiSerial: e.target.value })
                  }
                  placeholder="35..."
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700">Acessórios deixados:</span>
              {[
                { k: 'capa', label: 'Capa' },
                { k: 'chip', label: 'Chip SIM' },
                { k: 'bandejaChip', label: 'Bandeja Chip' },
                { k: 'cartaoMemoria', label: 'Cartão SD' },
                { k: 'carregador', label: 'Carregador' },
              ].map((ac) => (
                <label
                  key={ac.k}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(novoAparelhoForm[ac.k as keyof typeof novoAparelhoForm])}
                    onChange={(e) =>
                      setNovoAparelhoForm({ ...novoAparelhoForm, [ac.k]: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-sky-600"
                  />
                  <span>{ac.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ETAPA 3 – DEFEITO E DADOS DE ENTRADA */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
              3
            </span>
            <h3 className="font-bold text-slate-900">Defeito Relatado e Dados de Entrada</h3>
          </div>

          {dataEntradaData !== hojeStr && (
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Abertura com Data Retroativa: {dataEntradaData}</span>
            </span>
          )}
        </div>

        {/* Frases rápidas de defeito */}
        <div>
          <span className="block text-xs font-semibold text-slate-600 mb-2">
            Atalhos rápidos de defeito (toque para inserir):
          </span>
          <div className="flex flex-wrap gap-2">
            {FRASES_DEFEITO_COMUNS.map((frase) => (
              <button
                key={frase}
                type="button"
                onClick={() =>
                  setDefeitoRelatado((prev) => (prev ? `${prev}. ${frase}` : frase))
                }
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 text-xs font-medium transition-colors"
              >
                + {frase}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Defeito Relatado pelo Cliente *
          </label>
          <textarea
            ref={defeitoRef}
            rows={3}
            value={defeitoRelatado}
            onChange={(e) => setDefeitoRelatado(e.target.value)}
            placeholder="Descreva o que o cliente relatou no balcão..."
            className="w-full p-3.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>Data de Entrada da OS (Permite Retroativa)</span>
            </label>
            <input
              type="date"
              value={dataEntradaData}
              onChange={(e) => setDataEntradaData(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-sky-300 bg-sky-50/30 font-semibold text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Previsão de Entrega
            </label>
            <input
              type="date"
              value={previsaoEntregaData}
              onChange={(e) => setPrevisaoEntregaData(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Técnico Responsável
              </label>
              <button
                type="button"
                onClick={() => setCriandoNovoTecnico((prev) => !prev)}
                className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>{criandoNovoTecnico ? 'Cancelar' : 'Novo Técnico'}</span>
              </button>
            </div>
            {!criandoNovoTecnico ? (
              <select
                value={tecnicoResponsavel}
                onChange={(e) => {
                  if (e.target.value === '__NOVO__') {
                    setCriandoNovoTecnico(true);
                  } else {
                    setTecnicoResponsavel(e.target.value);
                  }
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
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
                  value={novoTecnicoNome}
                  onChange={(e) => setNovoTecnicoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      adicionarNovoTecnicoMutation.mutate();
                    }
                  }}
                  placeholder="Nome do técnico..."
                  className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-sky-400 text-sm"
                />
                <button
                  type="button"
                  onClick={() => adicionarNovoTecnicoMutation.mutate()}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shrink-0"
                >
                  Salvar
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Condições Físicas (Trincas, Arranhões)
            </label>
            <input
              type="text"
              value={condicoesFisicas}
              onChange={(e) => setCondicoesFisicas(e.target.value)}
              placeholder="Ex.: Aro amassado, tampa trincada..."
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Senha / Padrão (Opcional — Sensível)
            </label>
            <input
              type="text"
              value={senhaDesbloqueio}
              onChange={(e) => setSenhaDesbloqueio(e.target.value)}
              placeholder="PIN ou desenho para testes"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/40 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as PrioridadeOS)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="normal">Normal</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fotos ({fotosBase64.length})
              </label>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleAdicionarFoto}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4 text-sky-600" />
                <span>Câmera</span>
              </button>
            </div>
          </div>
        </div>

        {/* Checklist Físico de Entrada Colapsável (Progressive Disclosure UX) */}
        <div className="pt-1">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-sky-600" />
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Checklist Físico de Entrada do Aparelho
                </p>
                <p className="text-[11px] text-slate-500">
                  {CHECKLIST_ITENS.filter((i) => checklist[i.key] === true).length} de{' '}
                  {CHECKLIST_ITENS.length} itens marcados como OK
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChecklistAberto((prev) => !prev)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 border border-slate-300 text-xs font-bold text-sky-700 flex items-center gap-1.5"
            >
              <span>{checklistAberto ? 'Fechar Checklist' : 'Abrir / Editar Checklist'}</span>
              {checklistAberto ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {checklistAberto && (
            <div className="mt-2 p-4 rounded-xl bg-slate-50/70 border border-sky-200 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {CHECKLIST_ITENS.map((item) => {
                  const marcado = checklist[item.key] === true;
                  return (
                    <label
                      key={item.key}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2.5 cursor-pointer select-none transition-colors ${
                        marcado
                          ? 'bg-sky-50 border-sky-400 text-sky-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={(e) =>
                          setChecklist({ ...checklist, [item.key]: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-sky-600"
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setChecklistAberto(false)}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold"
                >
                  Concluir Checklist e Recolher
                </button>
              </div>
            </div>
          )}
        </div>

        {fotosBase64.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {fotosBase64.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border">
                <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    setFotosBase64((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ETAPA 4 – PEÇAS E SERVIÇOS (LAYOUT LIMPO COM PROGRESSIVE DISCLOSURE) */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
              4
            </span>
            <div>
              <h3 className="font-bold text-slate-900">
                Peças e Serviços do Aparelho
              </h3>
              <p className="text-[11px] text-slate-500">
                Clique para adicionar peça ou serviço; o painel fecha sozinho após confirmar
              </p>
            </div>
          </div>
          <span className="text-lg font-extrabold text-sky-700">
            Total: {formatarMoeda(totalFinalCentavos)}
          </span>
        </div>

        {/* Barra de Ações Limpa: Lançador Colapsável + Botão de Buscar no Estoque */}
        <div className="space-y-3">
          <LancadorPecaManualOS
            modeloAparelhoPadrao={
              aparelhoSelecionado && !modoNovoAparelho
                ? `${aparelhoSelecionado.marca} ${aparelhoSelecionado.modelo}`
                : `${novaMarcaTexto.trim() || novoAparelhoForm.marca} ${
                    novoModeloTexto.trim() || novoAparelhoForm.modelo
                  }`.trim()
            }
            aoAdicionarItem={(novoItem) => setItensOS((prev) => [...prev, novoItem])}
            itemEmEdicao={itemEmEdicao}
            aoSalvarEdicao={(itemAtualizado) => {
              setItensOS((prev) =>
                prev.map((i) => (i.id === itemAtualizado.id ? itemAtualizado : i))
              );
              setItemEmEdicao(null);
            }}
            aoCancelarEdicao={() => setItemEmEdicao(null)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarBuscaEstoque((prev) => !prev)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <Package className="w-3.5 h-3.5 text-slate-600" />
              <span>
                {mostrarBuscaEstoque
                  ? 'Fechar Busca do Catálogo'
                  : '+ Buscar Peça/Serviço Cadastrado no Estoque'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMostrarAjustesFinanceiros((prev) => !prev)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>
                {mostrarAjustesFinanceiros
                  ? 'Ocultar Desconto / Acréscimo / Obs.'
                  : '+ Desconto, Taxa ou Observação Interna'}
              </span>
              {(descontoGeralCentavos > 0 ||
                acrescimoGeralCentavos > 0 ||
                observacoesInternas.trim()) && (
                <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                  Preenchido
                </span>
              )}
            </button>
          </div>

          {mostrarBuscaEstoque && (
            <div className="relative p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={buscaItem}
                  onChange={(e) => setBuscaItem(e.target.value)}
                  placeholder="Digite nome, código ou leitor de barras para buscar no estoque..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                />
              </div>

              {buscaItem.trim() && resultadosCatalogo.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-xl bg-white shadow-lg divide-y divide-slate-100 overflow-hidden">
                  {resultadosCatalogo.map((item) => (
                    <button
                      key={`${item.tipo}-${item.id}`}
                      type="button"
                      onClick={() => adicionarItemNaOS(item)}
                      className="w-full p-3 text-left hover:bg-sky-50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] mr-2 ${
                            item.tipo === 'peca'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {item.tipo === 'peca' ? 'Peça' : 'Serviço'}
                        </span>
                        <strong className="text-slate-900">{item.descricao}</strong>
                        {item.tipo === 'peca' && (
                          <span
                            className={`ml-2 font-semibold ${
                              (item.estoqueAtual ?? 0) <= 0 ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            (Estoque: {item.estoqueAtual})
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatarMoeda(item.valorUnitarioCentavos)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {itensOS.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <th className="py-2.5 px-3">Item / Detalhes da Peça</th>
                  <th className="py-2.5 px-3 text-center w-24">Qtd</th>
                  <th className="py-2.5 px-3 text-right w-32">Unitário (R$)</th>
                  <th className="py-2.5 px-3 text-right w-32">Subtotal</th>
                  <th className="py-2.5 px-3 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itensOS.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={
                      itemEmEdicao?.id === item.id ? 'bg-amber-50/70' : 'hover:bg-slate-50/60'
                    }
                  >
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900">{item.descricao}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.tipo === 'peca'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {item.tipo === 'peca' ? 'Peça' : 'Serviço'}
                        </span>
                        {item.modeloAparelho && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            Modelo: {item.modeloAparelho}
                          </span>
                        )}
                        {item.qualidadePeca && item.qualidadePeca !== 'N/A' && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                            Qualidade: {item.qualidadePeca}
                          </span>
                        )}
                        {item.aroPeca && item.aroPeca !== 'na' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {formatarAroPeca(item.aroPeca)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => {
                          const nova = [...itensOS];
                          nova[idx].quantidade = Math.max(1, Number(e.target.value) || 1);
                          setItensOS(nova);
                        }}
                        className="w-16 text-center py-1 rounded border border-slate-300"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatarMoeda(item.valorUnitarioCentavos)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatarMoeda(item.quantidade * item.valorUnitarioCentavos)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setItemEmEdicao(item)}
                          title="Editar peça/serviço vinculado"
                          className="p-1.5 text-sky-700 hover:bg-sky-50 rounded"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (itemEmEdicao?.id === item.id) setItemEmEdicao(null);
                            setItensOS(itensOS.filter((i) => i.id !== item.id));
                          }}
                          title="Remover item"
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mostrarAjustesFinanceiros && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Desconto Geral (R$)
              </label>
              <input
                type="text"
                value={descontoGeralReais}
                onChange={(e) => setDescontoGeralReais(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Acréscimo / Taxa (R$)
              </label>
              <input
                type="text"
                value={acrescimoGeralReais}
                onChange={(e) => setAcrescimoGeralReais(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Observações Internas (Não sai no comprovante)
              </label>
              <input
                type="text"
                value={observacoesInternas}
                onChange={(e) => setObservacoesInternas(e.target.value)}
                placeholder="Anotação restrita à bancada..."
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>
          </div>
        )}
      </section>

      {/* Botão Final Grande para Toque no Tablet */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => salvarOSMutation.mutate(true)}
          className="min-h-[52px] px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-sm"
        >
          Salvar como Rascunho
        </button>
        <button
          type="button"
          onClick={() => salvarOSMutation.mutate(false)}
          className="min-h-[52px] px-8 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-base flex items-center gap-2 shadow-md"
        >
          <Save className="w-5 h-5" />
          <span>Concluir e Abrir Ordem de Serviço (Ctrl+S)</span>
        </button>
      </div>

      {/* Modal Rápido de Novo Cliente sem sair da OS */}
      {modalNovoCliente && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Cadastro Rápido de Cliente</h3>
              <button
                type="button"
                onClick={() => setModalNovoCliente(false)}
                className="p-2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={novoClienteForm.nome}
                  onChange={(e) =>
                    setNovoClienteForm({ ...novoClienteForm, nome: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    value={novoClienteForm.telefone}
                    onChange={(e) =>
                      setNovoClienteForm({
                        ...novoClienteForm,
                        telefone: aplicarMascaraTelefone(e.target.value),
                      })
                    }
                    placeholder="(11) 99999-9999"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CPF / CNPJ (Opcional)
                  </label>
                  <input
                    type="text"
                    value={novoClienteForm.cpfCnpj}
                    onChange={(e) =>
                      setNovoClienteForm({
                        ...novoClienteForm,
                        cpfCnpj: aplicarMascaraCpfCnpj(e.target.value),
                      })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Endereço do Cliente */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Endereço do Cliente
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rua / Logradouro
                    </label>
                    <input
                      type="text"
                      value={novoClienteForm.enderecoRua}
                      onChange={(e) =>
                        setNovoClienteForm({
                          ...novoClienteForm,
                          enderecoRua: e.target.value,
                        })
                      }
                      placeholder="Ex.: Rua das Flores"
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Número
                    </label>
                    <input
                      type="text"
                      value={novoClienteForm.enderecoNumero}
                      onChange={(e) =>
                        setNovoClienteForm({
                          ...novoClienteForm,
                          enderecoNumero: e.target.value,
                        })
                      }
                      placeholder="Ex.: 123"
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={novoClienteForm.enderecoBairro}
                      onChange={(e) =>
                        setNovoClienteForm({
                          ...novoClienteForm,
                          enderecoBairro: e.target.value,
                        })
                      }
                      placeholder="Ex.: Centro"
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={novoClienteForm.enderecoCidade}
                      onChange={(e) =>
                        setNovoClienteForm({
                          ...novoClienteForm,
                          enderecoCidade: e.target.value,
                        })
                      }
                      placeholder="Ex.: São Paulo"
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Observações do Cliente */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações do Cliente
                </label>
                <textarea
                  rows={2}
                  value={novoClienteForm.observacoes}
                  onChange={(e) =>
                    setNovoClienteForm({
                      ...novoClienteForm,
                      observacoes: e.target.value,
                    })
                  }
                  placeholder="Preferências de contato, recado, referências..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalNovoCliente(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => criarClienteRapidoMutation.mutate()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold"
              >
                Salvar e Selecionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
