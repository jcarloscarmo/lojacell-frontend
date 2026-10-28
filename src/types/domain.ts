export type UUID = string;

export interface RegistroBase {
  id: UUID;
  criadoEm: string; // ISO 8601
  atualizadoEm: string; // ISO 8601
}

export interface Endereco {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface Cliente extends RegistroBase {
  nome: string;
  tipoPessoa: 'fisica' | 'juridica';
  cpfCnpj?: string;
  telefone: string;
  whatsapp: boolean;
  email?: string;
  endereco?: Endereco;
  observacoes?: string;
  ativo: boolean;
}

export interface AcessorioAparelho {
  carregador: boolean;
  capa: boolean;
  chip: boolean;
  cartaoMemoria: boolean;
  bandejaChip: boolean;
  outros?: string;
}

export interface Aparelho extends RegistroBase {
  clienteId: UUID;
  marca: string;
  modelo: string;
  cor?: string;
  imeiSerial?: string;
  senhaOuPadrao?: string;
  acessorios: AcessorioAparelho;
  observacoes?: string;
}

export interface MarcaModeloCatalogo {
  marca: string;
  modelos: string[];
}

export type StatusOS =
  | 'aguardando_analise'
  | 'em_analise'
  | 'aguardando_aprovacao'
  | 'aprovada_em_reparo'
  | 'aguardando_peca'
  | 'pronta_retirada'
  | 'entregue'
  | 'reprovada'
  | 'cancelada';

export type PrioridadeOS = 'normal' | 'urgente';

export interface ChecklistEntrada {
  liga: boolean | null;
  telaTrincada: boolean | null;
  touchOk: boolean | null;
  carrega: boolean | null;
  camerasOk: boolean | null;
  audioOk: boolean | null;
  wifiBluetoothOk: boolean | null;
  botoesOk: boolean | null;
  biometriaOk: boolean | null;
  chipOk: boolean | null;
  sinalOxidacao: boolean | null;
}

export type AroPecaTipo = 'com_aro' | 'sem_aro' | 'na';

export interface ItemOS {
  id: UUID;
  tipo: 'peca' | 'servico';
  referenciaId: UUID;
  descricao: string;
  quantidade: number;
  valorUnitarioCentavos: number;
  custoUnitarioCentavos: number;
  descontoCentavos: number;
  // Campos para peça manual vinculada ao modelo do aparelho na OS
  manual?: boolean;
  pecaTipo?: string; // Ex.: 'Tela', 'Bateria', 'Conector de Carga', etc.
  modeloAparelho?: string; // Ex.: 'Samsung Galaxy A14 5G'
  qualidadePeca?: string; // Ex.: 'Original', 'OLED', 'Incell', 'Nacional', 'Premium', 'China'
  aroPeca?: AroPecaTipo; // 'com_aro' | 'sem_aro' | 'na'
}

export type FormaPagamentoTipo =
  | 'dinheiro'
  | 'pix'
  | 'cartao_debito'
  | 'cartao_credito'
  | 'outro';

export interface PagamentoRegistro {
  id: UUID;
  formaPagamento: FormaPagamentoTipo;
  valorCentavos: number;
  parcelas?: number;
  dataPagamento: string;
  observacao?: string;
}

export interface HistoricoStatusOS {
  status: StatusOS;
  dataHora: string;
  usuario: string;
  observacao?: string;
}

export interface OrdemServico extends RegistroBase {
  numero: number; // exibido como 000123
  rascunho?: boolean;
  clienteId: UUID;
  aparelhoId: UUID;
  dataEntrada: string;
  previsaoEntrega?: string;
  dataSaida?: string;
  status: StatusOS;
  prioridade: PrioridadeOS;
  defeitoRelatado: string;
  checklistEntrada: ChecklistEntrada;
  condicoesFisicas?: string;
  laudoTecnico?: string;
  solucaoAplicada?: string;
  itens: ItemOS[];
  descontoCentavos: number;
  acrescimoCentavos: number;
  totalCentavos: number;
  formaPagamento?: FormaPagamentoTipo;
  pagamentos: PagamentoRegistro[];
  garantiaDias: number;
  fimGarantiaEm?: string;
  termosGarantia?: string;
  fotos: string[]; // base64
  tecnicoResponsavel: string;
  observacoesInternas?: string;
  estoqueBaixado: boolean;
  historicoStatus: HistoricoStatusOS[];
}

export type CategoriaProduto =
  | 'tela'
  | 'bateria'
  | 'conector'
  | 'camera'
  | 'alto_falante'
  | 'tampa_traseira'
  | 'pelicula'
  | 'capa'
  | 'cabo'
  | 'carregador'
  | 'fone'
  | 'outros';

export interface Produto extends RegistroBase {
  codigo: string;
  codigoDeBarras?: string;
  descricao: string;
  categoria: CategoriaProduto;
  marcaCompativel?: string;
  modelosCompativeis: string[];
  unidade: 'UN' | 'PC' | 'KIT' | 'PAR';
  custoCentavos: number;
  precoVendaCentavos: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  fornecedorId?: UUID;
  localizacao?: string;
  ativo: boolean;
}

export interface MovimentacaoEstoque extends RegistroBase {
  produtoId: UUID;
  tipo: 'entrada' | 'saida_os' | 'saida_venda' | 'estorno' | 'ajuste';
  quantidade: number; // positivo ou negativo conforme movimento
  saldoAnterior: number;
  saldoPosterior: number;
  custoUnitarioCentavos?: number;
  fornecedorId?: UUID;
  origemId?: UUID;
  motivo: string;
  usuario: string;
}

export interface Servico extends RegistroBase {
  codigo: string;
  descricao: string;
  precoPadraoCentavos: number;
  tempoEstimadoMinutos: number;
  garantiaPadraoDias: number;
  ativo: boolean;
}

export interface ItemVenda {
  id: UUID;
  tipo: 'produto' | 'servico';
  referenciaId: UUID;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitarioCentavos: number;
  custoUnitarioCentavos: number;
  descontoCentavos: number;
}

export interface Venda extends RegistroBase {
  numero: number;
  data: string;
  clienteId?: UUID;
  itens: ItemVenda[];
  descontoCentavos: number;
  totalCentavos: number;
  pagamentos: PagamentoRegistro[];
  trocoCentavos: number;
  status: 'concluida' | 'cancelada';
  motivoCancelamento?: string;
  observacoes?: string;
}

export interface Fornecedor extends RegistroBase {
  nome: string;
  cnpj?: string;
  telefone: string;
  email?: string;
  observacoes?: string;
  ativo: boolean;
}

export type OrigemFinanceiro = 'os' | 'venda' | 'manual' | 'compra';
export type StatusLancamento = 'pendente' | 'pago' | 'vencido' | 'cancelado';

export interface LancamentoFinanceiro extends RegistroBase {
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valorCentavos: number;
  dataVencimento: string;
  dataPagamento?: string;
  status: StatusLancamento;
  formaPagamento?: FormaPagamentoTipo;
  origem: OrigemFinanceiro;
  origemId?: UUID;
  clienteId?: UUID;
  fornecedorId?: UUID;
  recorrenteMensal?: boolean;
  observacoes?: string;
}

export interface MovimentoCaixa {
  id: UUID;
  dataHora: string;
  tipo: 'abertura' | 'venda' | 'recebimento_os' | 'suprimento' | 'sangria' | 'despesa';
  descricao: string;
  valorCentavos: number; // positivo para entrada, negativo para saída
  formaPagamento: FormaPagamentoTipo;
  origemId?: UUID;
}

export interface SessaoCaixa extends RegistroBase {
  status: 'aberto' | 'fechado';
  aberturaData: string;
  valorInicialCentavos: number;
  fechamentoData?: string;
  valorContadoCentavos?: number;
  saldoEsperadoCentavos?: number;
  diferencaCentavos?: number;
  movimentos: MovimentoCaixa[];
  observacoes?: string;
}

export interface ConfiguracoesLoja {
  nomeLoja: string;
  cnpj: string;
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: Endereco;
  logoUrl?: string;
  termosGarantiaPadrao: string;
  textoConsentimentoLgpd: string;
  rodapeComprovante: string;
  larguraPapelMm: 58 | 80;
  prefixoOS: string;
  garantiaPadraoOSDias: number;
  tecnicosAtivos: string[];
  formasPagamentoAtivas: FormaPagamentoTipo[];
  categoriasReceita: string[];
  categoriasDespesa: string[];
  impressoraUsbAutorizada?: {
    vendorId: number;
    productId: number;
    nomeDispositivo: string;
  };
  backupAutomaticoAtivo?: boolean;
  backupIntervaloMinutos?: number;
  backupApenasHorarioComercial?: boolean;
  horarioComercialInicio?: string;
  horarioComercialFim?: string;
  backupDownloadAutomatico?: boolean;
  ultimoBackupAutomaticoEm?: string;
}

export interface PontoBackupAutomatico {
  id: string;
  criadoEm: string;
  motivo: string;
  resumo: {
    qtdOS: number;
    qtdClientes: number;
    qtdProdutos: number;
    qtdVendas: number;
  };
  dados: BackupCompleto;
}

export interface BackupCompleto {
  versao: string;
  exportadoEm: string;
  configuracoes: ConfiguracoesLoja;
  catalogoMarcas: MarcaModeloCatalogo[];
  clientes: Cliente[];
  aparelhos: Aparelho[];
  ordensServico: OrdemServico[];
  produtos: Produto[];
  movimentacoesEstoque: MovimentacaoEstoque[];
  servicos: Servico[];
  vendas: Venda[];
  fornecedores: Fornecedor[];
  lancamentosFinanceiros: LancamentoFinanceiro[];
  sessoesCaixa: SessaoCaixa[];
}
