import {
  Aparelho,
  BackupCompleto,
  Cliente,
  ConfiguracoesLoja,
  Fornecedor,
  LancamentoFinanceiro,
  MarcaModeloCatalogo,
  MovimentacaoEstoque,
  OrdemServico,
  PontoBackupAutomatico,
  Produto,
  Servico,
  SessaoCaixa,
  UUID,
  Venda,
} from '@/types/domain';

export interface BaseRepo<T> {
  listar(): Promise<T[]>;
  obter(id: UUID): Promise<T | undefined>;
  criar(dados: Omit<T, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<T>;
  atualizar(id: UUID, dados: Partial<T>): Promise<T>;
  remover(id: UUID): Promise<void>;
  buscar(termo: string): Promise<T[]>;
}

export interface ClienteRepository extends BaseRepo<Cliente> {
  possuiHistorico(clienteId: UUID): Promise<boolean>;
}

export interface AparelhoRepository extends BaseRepo<Aparelho> {
  listarPorCliente(clienteId: UUID): Promise<Aparelho[]>;
  listarCatalogoMarcas(): Promise<MarcaModeloCatalogo[]>;
  adicionarMarcaModelo(marca: string, modelo?: string): Promise<MarcaModeloCatalogo[]>;
  editarMarca(marcaAntiga: string, marcaNova: string): Promise<MarcaModeloCatalogo[]>;
  removerMarca(marca: string): Promise<MarcaModeloCatalogo[]>;
  editarModelo(
    marcaAntiga: string,
    modeloAntigo: string,
    modeloNovo: string,
    marcaNova?: string
  ): Promise<MarcaModeloCatalogo[]>;
  removerModelo(marca: string, modelo: string): Promise<MarcaModeloCatalogo[]>;
}

export interface OSRepository extends BaseRepo<OrdemServico> {
  obterProximoNumero(): Promise<number>;
  listarPorCliente(clienteId: UUID): Promise<OrdemServico[]>;
  listarPorAparelho(aparelhoId: UUID): Promise<OrdemServico[]>;
}

export interface ProdutoRepository extends BaseRepo<Produto> {
  possuiHistorico(produtoId: UUID): Promise<boolean>;
  ajustarEstoque(params: {
    produtoId: UUID;
    quantidadeDelta: number;
    tipo: MovimentacaoEstoque['tipo'];
    motivo: string;
    custoUnitarioCentavos?: number;
    fornecedorId?: UUID;
    origemId?: UUID;
  }): Promise<Produto>;
  listarMovimentacoes(produtoId?: UUID): Promise<MovimentacaoEstoque[]>;
}

export interface ServicoRepository extends BaseRepo<Servico> {}

export interface FornecedorRepository extends BaseRepo<Fornecedor> {}

export interface VendaRepository extends BaseRepo<Venda> {
  obterProximoNumero(): Promise<number>;
}

export interface FinanceiroRepository {
  listarLancamentos(): Promise<LancamentoFinanceiro[]>;
  criarLancamento(
    dados: Omit<LancamentoFinanceiro, 'id' | 'criadoEm' | 'atualizadoEm'>
  ): Promise<LancamentoFinanceiro>;
  atualizarLancamento(
    id: UUID,
    dados: Partial<LancamentoFinanceiro>
  ): Promise<LancamentoFinanceiro>;
  removerLancamento(id: UUID): Promise<void>;
  estornarRecebimentosOS(osId: UUID): Promise<{
    lancamentosEstornados: number;
    valorTotalEstornadoCentavos: number;
    datasEstornadas: string[];
  }>;

  listarSessoesCaixa(): Promise<SessaoCaixa[]>;
  obterCaixaAberto(): Promise<SessaoCaixa | undefined>;
  abrirCaixa(valorInicialCentavos: number, observacoes?: string): Promise<SessaoCaixa>;
  registrarMovimentoCaixa(
    movimento: Omit<SessaoCaixa['movimentos'][number], 'id' | 'dataHora'>
  ): Promise<SessaoCaixa | undefined>;
  fecharCaixa(
    sessaoId: UUID,
    valorContadoCentavos: number,
    observacoes?: string
  ): Promise<SessaoCaixa>;
  alterarDataAberturaCaixa(sessaoId: UUID, novaDataIso: string): Promise<SessaoCaixa>;
}

export interface ConfigRepository {
  obterConfiguracoes(): Promise<ConfiguracoesLoja>;
  salvarConfiguracoes(dados: Partial<ConfiguracoesLoja>): Promise<ConfiguracoesLoja>;
  exportarBackup(): Promise<BackupCompleto>;
  importarBackup(backup: BackupCompleto): Promise<void>;
  resetarDadosSeed(): Promise<void>;
  listarBackupsAutomaticos(): Promise<PontoBackupAutomatico[]>;
  criarPontoBackupAutomatico(motivo?: string): Promise<PontoBackupAutomatico>;
  restaurarPontoBackupAutomatico(id: string): Promise<void>;
  removerPontoBackupAutomatico(id: string): Promise<void>;
}
