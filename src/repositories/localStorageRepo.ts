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
  RegistroBase,
  Servico,
  SessaoCaixa,
  UUID,
  Venda,
} from '@/types/domain';
import {
  AparelhoRepository,
  ClienteRepository,
  ConfigRepository,
  FinanceiroRepository,
  FornecedorRepository,
  OSRepository,
  ProdutoRepository,
  ServicoRepository,
  VendaRepository,
} from './interfaces';
import { backupInicialSeed } from './seedData';
import { gerarId, caixaEhDeDiaAnterior } from '@/utils/formatters';
import { getSupabaseClient } from '@/lib/supabaseClient';

const STORAGE_KEY = 'shlojacell_db_v1';
const AUTO_BACKUP_STORAGE_KEY = 'shlojacell_auto_backups_v1';
const MAX_PONTOS_BACKUP_AUTO = 12;
const SUPABASE_STORE_ROW_ID = 'loja_principal';

let ultimoTimestampSalvoLocal = 0;

// Simula latência pequena (60ms) para testar estados de carregamento sem atrasar o balcão
const delay = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

function carregarBanco(): BackupCompleto {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const inicial = structuredClone(backupInicialSeed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inicial));
      return inicial;
    }
    return JSON.parse(raw) as BackupCompleto;
  } catch (err) {
    console.error('Erro ao ler localStorage, restaurando seed inicial:', err);
    const inicial = structuredClone(backupInicialSeed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inicial));
    return inicial;
  }
}

function salvarBanco(db: BackupCompleto): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  ultimoTimestampSalvoLocal = Date.now();
  void enviarBancoParaSupabase(db);
}

async function enviarBancoParaSupabase(db: BackupCompleto): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  try {
    const agora = new Date().toISOString();
    const { error } = await supabase.from('shlojacell_store_state').upsert(
      {
        id: SUPABASE_STORE_ROW_ID,
        dados: db,
        atualizado_em: agora,
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn('Aviso ao sincronizar com Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Falha de rede ao sincronizar com Supabase:', err);
    return false;
  }
}

/**
 * Sincroniza o banco entre o aparelho atual (PC, Celular ou Tablet) e o Supabase.
 * - Se já existir banco salvo no Supabase, atualiza o cache local deste aparelho.
 * - Se a tabela do Supabase estiver vazia (primeiro acesso), envia os dados atuais para a nuvem.
 */
export async function sincronizarComSupabase(): Promise<{
  conectado: boolean;
  origem: 'nuvem' | 'enviado_local' | 'offline';
  mensagem: string;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      conectado: false,
      origem: 'offline',
      mensagem: 'Supabase ainda não configurado neste ambiente.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('shlojacell_store_state')
      .select('dados, atualizado_em')
      .eq('id', SUPABASE_STORE_ROW_ID)
      .maybeSingle();

    if (error) {
      return {
        conectado: false,
        origem: 'offline',
        mensagem: `Erro ao consultar tabela no Supabase: ${error.message}. Verifique se executou o script supabase_schema.sql no SQL Editor.`,
      };
    }

    if (data && data.dados) {
      const bancoNuvem = data.dados as BackupCompleto;
      if (Array.isArray(bancoNuvem.clientes) && Array.isArray(bancoNuvem.ordensServico)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bancoNuvem));
        return {
          conectado: true,
          origem: 'nuvem',
          mensagem: 'Dados sincronizados da nuvem (Supabase) com sucesso!',
        };
      }
    }

    // Se a nuvem ainda não tem registro, sobe o banco atual deste aparelho para inicializar a nuvem
    const bancoLocal = carregarBanco();
    const enviou = await enviarBancoParaSupabase(bancoLocal);
    if (enviou) {
      return {
        conectado: true,
        origem: 'enviado_local',
        mensagem: 'Banco inicial enviado para o Supabase com sucesso!',
      };
    }

    return {
      conectado: false,
      origem: 'offline',
      mensagem: 'Não foi possível gravar o estado inicial no Supabase.',
    };
  } catch (err) {
    return {
      conectado: false,
      origem: 'offline',
      mensagem: err instanceof Error ? err.message : 'Erro de conexão com o Supabase.',
    };
  }
}

/**
 * Escuta alterações em tempo real vindas de outros aparelhos (PC, Celular ou Tablet)
 * e atualiza automaticamente a tela sem precisar dar F5.
 */
export function assinarRealtimeSupabase(aoAtualizarDaNuvem: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel('shlojacell-realtime-sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shlojacell_store_state',
        filter: `id=eq.${SUPABASE_STORE_ROW_ID}`,
      },
      (payload) => {
        // Evita reprocessar o próprio salvamento feito há menos de 1.5s neste mesmo aparelho
        if (Date.now() - ultimoTimestampSalvoLocal < 1500) return;

        const novoRegistro = payload.new as { dados?: BackupCompleto } | undefined;
        if (
          novoRegistro?.dados &&
          Array.isArray(novoRegistro.dados.clientes) &&
          Array.isArray(novoRegistro.dados.ordensServico)
        ) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(novoRegistro.dados));
          aoAtualizarDaNuvem();
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

function criarHelperCrud<T extends RegistroBase>(
  selecionarLista: (db: BackupCompleto) => T[],
  atualizarLista: (db: BackupCompleto, novaLista: T[]) => void,
  filtrarBusca: (item: T, termoMinusculo: string) => boolean
) {
  return {
    async listar(): Promise<T[]> {
      await delay();
      const db = carregarBanco();
      return selecionarLista(db);
    },
    async obter(id: UUID): Promise<T | undefined> {
      await delay(30);
      const db = carregarBanco();
      return selecionarLista(db).find((item) => item.id === id);
    },
    async criar(dados: Omit<T, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<T> {
      await delay();
      const db = carregarBanco();
      const lista = selecionarLista(db);
      const agora = new Date().toISOString();
      const novo = {
        ...dados,
        id: gerarId(),
        criadoEm: agora,
        atualizadoEm: agora,
      } as T;
      atualizarLista(db, [novo, ...lista]);
      salvarBanco(db);
      return novo;
    },
    async atualizar(id: UUID, dados: Partial<T>): Promise<T> {
      await delay();
      const db = carregarBanco();
      const lista = selecionarLista(db);
      const idx = lista.findIndex((item) => item.id === id);
      if (idx === -1) throw new Error('Registro não encontrado');
      const atualizado: T = {
        ...lista[idx],
        ...dados,
        id,
        atualizadoEm: new Date().toISOString(),
      };
      lista[idx] = atualizado;
      atualizarLista(db, lista);
      salvarBanco(db);
      return atualizado;
    },
    async remover(id: UUID): Promise<void> {
      await delay();
      const db = carregarBanco();
      const lista = selecionarLista(db);
      atualizarLista(
        db,
        lista.filter((item) => item.id !== id)
      );
      salvarBanco(db);
    },
    async buscar(termo: string): Promise<T[]> {
      await delay(30);
      const db = carregarBanco();
      const lista = selecionarLista(db);
      const limpo = termo.trim().toLowerCase();
      if (!limpo) return lista;
      return lista.filter((item) => filtrarBusca(item, limpo));
    },
  };
}

export const clienteRepo: ClienteRepository = {
  ...criarHelperCrud<Cliente>(
    (db) => db.clientes,
    (db, lista) => {
      db.clientes = lista;
    },
    (c, q) =>
      c.nome.toLowerCase().includes(q) ||
      c.telefone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '___') ||
      c.telefone.toLowerCase().includes(q) ||
      (c.cpfCnpj?.toLowerCase().includes(q) ?? false) ||
      (c.cpfCnpj?.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '___') ?? false)
  ),
  async possuiHistorico(clienteId: UUID): Promise<boolean> {
    const db = carregarBanco();
    const temOS = db.ordensServico.some((os) => os.clienteId === clienteId);
    const temVenda = db.vendas.some((v) => v.clienteId === clienteId);
    return temOS || temVenda;
  },
};

export const aparelhoRepo: AparelhoRepository = {
  ...criarHelperCrud<Aparelho>(
    (db) => db.aparelhos,
    (db, lista) => {
      db.aparelhos = lista;
    },
    (a, q) =>
      a.marca.toLowerCase().includes(q) ||
      a.modelo.toLowerCase().includes(q) ||
      (a.imeiSerial?.toLowerCase().includes(q) ?? false)
  ),
  async listarPorCliente(clienteId: UUID): Promise<Aparelho[]> {
    await delay(30);
    const db = carregarBanco();
    return db.aparelhos.filter((a) => a.clienteId === clienteId);
  },
  async listarCatalogoMarcas(): Promise<MarcaModeloCatalogo[]> {
    await delay(20);
    const db = carregarBanco();
    return db.catalogoMarcas;
  },
  async adicionarMarcaModelo(marca: string, modelo?: string): Promise<MarcaModeloCatalogo[]> {
    await delay(30);
    const db = carregarBanco();
    const marcaLimpa = marca.trim();
    const modeloLimpo = modelo?.trim();
    let entrada = db.catalogoMarcas.find(
      (m) => m.marca.toLowerCase() === marcaLimpa.toLowerCase()
    );
    if (!entrada) {
      entrada = { marca: marcaLimpa, modelos: modeloLimpo ? [modeloLimpo] : [] };
      db.catalogoMarcas.push(entrada);
    } else if (
      modeloLimpo &&
      !entrada.modelos.some((mod) => mod.toLowerCase() === modeloLimpo.toLowerCase())
    ) {
      entrada.modelos.push(modeloLimpo);
    }
    salvarBanco(db);
    return db.catalogoMarcas;
  },
  async editarMarca(marcaAntiga: string, marcaNova: string): Promise<MarcaModeloCatalogo[]> {
    await delay(30);
    const db = carregarBanco();
    const limpaAntiga = marcaAntiga.trim();
    const limpaNova = marcaNova.trim();
    if (!limpaNova) throw new Error('O nome da marca é obrigatório.');

    const idxAntiga = db.catalogoMarcas.findIndex(
      (m) => m.marca.toLowerCase() === limpaAntiga.toLowerCase()
    );
    if (idxAntiga === -1) throw new Error('Marca não encontrada.');

    const idxExistente = db.catalogoMarcas.findIndex(
      (m, i) => i !== idxAntiga && m.marca.toLowerCase() === limpaNova.toLowerCase()
    );

    if (idxExistente !== -1) {
      // Mescla os modelos na marca já existente
      const modelosParaMesclar = db.catalogoMarcas[idxAntiga].modelos;
      for (const mod of modelosParaMesclar) {
        if (
          !db.catalogoMarcas[idxExistente].modelos.some(
            (m) => m.toLowerCase() === mod.toLowerCase()
          )
        ) {
          db.catalogoMarcas[idxExistente].modelos.push(mod);
        }
      }
      db.catalogoMarcas.splice(idxAntiga, 1);
    } else {
      db.catalogoMarcas[idxAntiga].marca = limpaNova;
    }

    // Atualiza aparelhos cadastrados que usavam o nome antigo da marca
    db.aparelhos.forEach((ap) => {
      if (ap.marca.toLowerCase() === limpaAntiga.toLowerCase()) {
        ap.marca = limpaNova;
      }
    });

    salvarBanco(db);
    return db.catalogoMarcas;
  },
  async removerMarca(marca: string): Promise<MarcaModeloCatalogo[]> {
    await delay(30);
    const db = carregarBanco();
    const limpa = marca.trim().toLowerCase();
    db.catalogoMarcas = db.catalogoMarcas.filter((m) => m.marca.toLowerCase() !== limpa);
    salvarBanco(db);
    return db.catalogoMarcas;
  },
  async editarModelo(
    marcaAntiga: string,
    modeloAntigo: string,
    modeloNovo: string,
    marcaNova?: string
  ): Promise<MarcaModeloCatalogo[]> {
    await delay(30);
    const db = carregarBanco();
    const mAntiga = marcaAntiga.trim();
    const mNova = (marcaNova || marcaAntiga).trim();
    const modAntigo = modeloAntigo.trim();
    const modNovo = modeloNovo.trim();
    if (!modNovo) throw new Error('O nome do modelo é obrigatório.');

    const entradaAntiga = db.catalogoMarcas.find(
      (m) => m.marca.toLowerCase() === mAntiga.toLowerCase()
    );
    if (!entradaAntiga) throw new Error('Marca de origem não encontrada.');

    if (mAntiga.toLowerCase() === mNova.toLowerCase()) {
      const idxMod = entradaAntiga.modelos.findIndex(
        (mod) => mod.toLowerCase() === modAntigo.toLowerCase()
      );
      if (idxMod !== -1) {
        entradaAntiga.modelos[idxMod] = modNovo;
      } else if (!entradaAntiga.modelos.some((m) => m.toLowerCase() === modNovo.toLowerCase())) {
        entradaAntiga.modelos.push(modNovo);
      }
    } else {
      // Remove da marca antiga e adiciona na marca nova
      entradaAntiga.modelos = entradaAntiga.modelos.filter(
        (mod) => mod.toLowerCase() !== modAntigo.toLowerCase()
      );
      let entradaNova = db.catalogoMarcas.find(
        (m) => m.marca.toLowerCase() === mNova.toLowerCase()
      );
      if (!entradaNova) {
        entradaNova = { marca: mNova, modelos: [modNovo] };
        db.catalogoMarcas.push(entradaNova);
      } else if (!entradaNova.modelos.some((m) => m.toLowerCase() === modNovo.toLowerCase())) {
        entradaNova.modelos.push(modNovo);
      }
    }

    // Atualiza aparelhos cadastrados que usavam o modelo antigo
    db.aparelhos.forEach((ap) => {
      if (
        ap.marca.toLowerCase() === mAntiga.toLowerCase() &&
        ap.modelo.toLowerCase() === modAntigo.toLowerCase()
      ) {
        ap.marca = mNova;
        ap.modelo = modNovo;
      }
    });

    salvarBanco(db);
    return db.catalogoMarcas;
  },
  async removerModelo(marca: string, modelo: string): Promise<MarcaModeloCatalogo[]> {
    await delay(30);
    const db = carregarBanco();
    const entrada = db.catalogoMarcas.find(
      (m) => m.marca.toLowerCase() === marca.trim().toLowerCase()
    );
    if (entrada) {
      entrada.modelos = entrada.modelos.filter(
        (mod) => mod.toLowerCase() !== modelo.trim().toLowerCase()
      );
      salvarBanco(db);
    }
    return db.catalogoMarcas;
  },
};

export const osRepo: OSRepository = {
  ...criarHelperCrud<OrdemServico>(
    (db) => db.ordensServico,
    (db, lista) => {
      db.ordensServico = lista;
    },
    (os, q) =>
      String(os.numero).padStart(6, '0').includes(q) ||
      os.defeitoRelatado.toLowerCase().includes(q)
  ),
  async obterProximoNumero(): Promise<number> {
    const db = carregarBanco();
    const maior = db.ordensServico.reduce((max, os) => (os.numero > max ? os.numero : max), 100);
    return maior + 1;
  },
  async listarPorCliente(clienteId: UUID): Promise<OrdemServico[]> {
    await delay(30);
    const db = carregarBanco();
    return db.ordensServico.filter((os) => os.clienteId === clienteId);
  },
  async listarPorAparelho(aparelhoId: UUID): Promise<OrdemServico[]> {
    await delay(30);
    const db = carregarBanco();
    return db.ordensServico.filter((os) => os.aparelhoId === aparelhoId);
  },
};

export const produtoRepo: ProdutoRepository = {
  ...criarHelperCrud<Produto>(
    (db) => db.produtos,
    (db, lista) => {
      db.produtos = lista;
    },
    (p, q) =>
      p.descricao.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) ||
      (p.codigoDeBarras?.includes(q) ?? false) ||
      (p.marcaCompativel?.toLowerCase().includes(q) ?? false)
  ),
  async possuiHistorico(produtoId: UUID): Promise<boolean> {
    const db = carregarBanco();
    const emOS = db.ordensServico.some((os) =>
      os.itens.some((i) => i.tipo === 'peca' && i.referenciaId === produtoId)
    );
    const emVenda = db.vendas.some((v) =>
      v.itens.some((i) => i.tipo === 'produto' && i.referenciaId === produtoId)
    );
    return emOS || emVenda;
  },
  async ajustarEstoque({
    produtoId,
    quantidadeDelta,
    tipo,
    motivo,
    custoUnitarioCentavos,
    fornecedorId,
    origemId,
  }): Promise<Produto> {
    await delay(40);
    const db = carregarBanco();
    const idx = db.produtos.findIndex((p) => p.id === produtoId);
    if (idx === -1) throw new Error('Produto não encontrado');
    const prod = db.produtos[idx];
    const saldoAnterior = prod.estoqueAtual;
    const saldoPosterior = saldoAnterior + quantidadeDelta;
    const agora = new Date().toISOString();

    const atualizado: Produto = {
      ...prod,
      estoqueAtual: saldoPosterior,
      custoCentavos:
        custoUnitarioCentavos !== undefined && custoUnitarioCentavos > 0
          ? custoUnitarioCentavos
          : prod.custoCentavos,
      fornecedorId: fornecedorId || prod.fornecedorId,
      atualizadoEm: agora,
    };
    db.produtos[idx] = atualizado;

    const mov: MovimentacaoEstoque = {
      id: gerarId(),
      produtoId,
      tipo,
      quantidade: quantidadeDelta,
      saldoAnterior,
      saldoPosterior,
      custoUnitarioCentavos,
      fornecedorId,
      origemId,
      motivo,
      usuario: 'Administrador',
      criadoEm: agora,
      atualizadoEm: agora,
    };
    db.movimentacoesEstoque = [mov, ...db.movimentacoesEstoque];
    salvarBanco(db);
    return atualizado;
  },
  async listarMovimentacoes(produtoId?: UUID): Promise<MovimentacaoEstoque[]> {
    await delay(30);
    const db = carregarBanco();
    if (!produtoId) return db.movimentacoesEstoque;
    return db.movimentacoesEstoque.filter((m) => m.produtoId === produtoId);
  },
};

export const servicoRepo: ServicoRepository = criarHelperCrud<Servico>(
  (db) => db.servicos,
  (db, lista) => {
    db.servicos = lista;
  },
  (s, q) => s.descricao.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q)
);

export const fornecedorRepo: FornecedorRepository = criarHelperCrud<Fornecedor>(
  (db) => db.fornecedores,
  (db, lista) => {
    db.fornecedores = lista;
  },
  (f, q) => f.nome.toLowerCase().includes(q) || (f.cnpj?.includes(q) ?? false)
);

export const vendaRepo: VendaRepository = {
  ...criarHelperCrud<Venda>(
    (db) => db.vendas,
    (db, lista) => {
      db.vendas = lista;
    },
    (v, q) => String(v.numero).padStart(6, '0').includes(q)
  ),
  async obterProximoNumero(): Promise<number> {
    const db = carregarBanco();
    const maior = db.vendas.reduce((max, v) => (v.numero > max ? v.numero : max), 0);
    return maior + 1;
  },
};

export const financeiroRepo: FinanceiroRepository = {
  async listarLancamentos(): Promise<LancamentoFinanceiro[]> {
    await delay(40);
    const db = carregarBanco();
    return db.lancamentosFinanceiros;
  },
  async criarLancamento(dados): Promise<LancamentoFinanceiro> {
    await delay(40);
    const db = carregarBanco();
    const agora = new Date().toISOString();
    const novo: LancamentoFinanceiro = {
      ...dados,
      id: gerarId(),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    db.lancamentosFinanceiros = [novo, ...db.lancamentosFinanceiros];
    salvarBanco(db);
    return novo;
  },
  async atualizarLancamento(id, dados): Promise<LancamentoFinanceiro> {
    await delay(40);
    const db = carregarBanco();
    const idx = db.lancamentosFinanceiros.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error('Lançamento não encontrado');
    const atualizado: LancamentoFinanceiro = {
      ...db.lancamentosFinanceiros[idx],
      ...dados,
      id,
      atualizadoEm: new Date().toISOString(),
    };
    db.lancamentosFinanceiros[idx] = atualizado;
    salvarBanco(db);
    return atualizado;
  },
  async removerLancamento(id): Promise<void> {
    await delay(40);
    const db = carregarBanco();
    db.lancamentosFinanceiros = db.lancamentosFinanceiros.filter((l) => l.id !== id);
    salvarBanco(db);
  },
  async estornarRecebimentosOS(osId): Promise<{
    lancamentosEstornados: number;
    valorTotalEstornadoCentavos: number;
    datasEstornadas: string[];
  }> {
    await delay(40);
    const db = carregarBanco();
    const alvos = db.lancamentosFinanceiros.filter(
      (l) => l.origem === 'os' && l.origemId === osId
    );
    const valorTotalEstornadoCentavos = alvos.reduce((acc, l) => acc + l.valorCentavos, 0);
    const datasEstornadas = Array.from(
      new Set(
        alvos
          .map((l) => (l.dataPagamento || l.dataVencimento || '').slice(0, 10))
          .filter(Boolean)
      )
    );

    // Remove os lançamentos financeiros originados por essa OS
    db.lancamentosFinanceiros = db.lancamentosFinanceiros.filter(
      (l) => !(l.origem === 'os' && l.origemId === osId)
    );

    // Estorna/remove os movimentos de recebimento dessa OS nas sessões de caixa
    db.sessoesCaixa = db.sessoesCaixa.map((sessao) => ({
      ...sessao,
      movimentos: sessao.movimentos.filter((m) => m.origemId !== osId),
    }));

    salvarBanco(db);
    return {
      lancamentosEstornados: alvos.length,
      valorTotalEstornadoCentavos,
      datasEstornadas,
    };
  },

  async listarSessoesCaixa(): Promise<SessaoCaixa[]> {
    await delay(30);
    const db = carregarBanco();
    return db.sessoesCaixa;
  },
  async obterCaixaAberto(): Promise<SessaoCaixa | undefined> {
    await delay(20);
    const db = carregarBanco();
    return db.sessoesCaixa.find((c) => c.status === 'aberto');
  },
  async abrirCaixa(valorInicialCentavos, observacoes): Promise<SessaoCaixa> {
    await delay(40);
    const db = carregarBanco();
    const jaAberto = db.sessoesCaixa.find((c) => c.status === 'aberto');
    if (jaAberto) throw new Error('Já existe um caixa aberto.');
    const agora = new Date().toISOString();
    const novaSessao: SessaoCaixa = {
      id: gerarId(),
      status: 'aberto',
      aberturaData: agora,
      valorInicialCentavos,
      observacoes,
      movimentos: [
        {
          id: gerarId(),
          dataHora: agora,
          tipo: 'abertura',
          descricao: 'Fundo de troco na abertura do caixa',
          valorCentavos: valorInicialCentavos,
          formaPagamento: 'dinheiro',
        },
      ],
      criadoEm: agora,
      atualizadoEm: agora,
    };
    db.sessoesCaixa = [novaSessao, ...db.sessoesCaixa];
    salvarBanco(db);
    return novaSessao;
  },
  async registrarMovimentoCaixa(movimento): Promise<SessaoCaixa | undefined> {
    await delay(30);
    const db = carregarBanco();
    const idx = db.sessoesCaixa.findIndex((c) => c.status === 'aberto');
    if (idx === -1) return undefined;
    if (caixaEhDeDiaAnterior(db.sessoesCaixa[idx].aberturaData)) {
      throw new Error(
        'Operação bloqueada: O caixa aberto pertence a um dia anterior. Feche o caixa anterior antes de registrar novas vendas ou movimentações.'
      );
    }
    const agora = new Date().toISOString();
    db.sessoesCaixa[idx].movimentos.push({
      ...movimento,
      id: gerarId(),
      dataHora: agora,
    });
    db.sessoesCaixa[idx].atualizadoEm = agora;
    salvarBanco(db);
    return db.sessoesCaixa[idx];
  },
  async fecharCaixa(sessaoId, valorContadoCentavos, observacoes): Promise<SessaoCaixa> {
    await delay(40);
    const db = carregarBanco();
    const idx = db.sessoesCaixa.findIndex((c) => c.id === sessaoId);
    if (idx === -1) throw new Error('Sessão de caixa não encontrada');
    const sessao = db.sessoesCaixa[idx];
    const saldoEsperadoCentavos = sessao.movimentos.reduce((acc, m) => acc + m.valorCentavos, 0);
    const diferencaCentavos = valorContadoCentavos - saldoEsperadoCentavos;
    const agora = new Date().toISOString();
    const fechada: SessaoCaixa = {
      ...sessao,
      status: 'fechado',
      fechamentoData: agora,
      valorContadoCentavos,
      saldoEsperadoCentavos,
      diferencaCentavos,
      observacoes: observacoes ?? sessao.observacoes,
      atualizadoEm: agora,
    };
    db.sessoesCaixa[idx] = fechada;
    salvarBanco(db);
    return fechada;
  },
  async alterarDataAberturaCaixa(sessaoId, novaDataIso): Promise<SessaoCaixa> {
    await delay(20);
    const db = carregarBanco();
    const idx = db.sessoesCaixa.findIndex((c) => c.id === sessaoId);
    if (idx === -1) throw new Error('Sessão de caixa não encontrada');
    db.sessoesCaixa[idx] = {
      ...db.sessoesCaixa[idx],
      aberturaData: novaDataIso,
      atualizadoEm: new Date().toISOString(),
    };
    salvarBanco(db);
    return db.sessoesCaixa[idx];
  },
};

function carregarListaBackupsAuto(): PontoBackupAutomatico[] {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PontoBackupAutomatico[];
  } catch {
    return [];
  }
}

function salvarListaBackupsAuto(lista: PontoBackupAutomatico[]): void {
  localStorage.setItem(
    AUTO_BACKUP_STORAGE_KEY,
    JSON.stringify(lista.slice(0, MAX_PONTOS_BACKUP_AUTO))
  );
}

export const configRepo: ConfigRepository = {
  async obterConfiguracoes(): Promise<ConfiguracoesLoja> {
    await delay(20);
    const db = carregarBanco();
    return {
      backupAutomaticoAtivo: true,
      backupIntervaloMinutos: 60,
      backupApenasHorarioComercial: true,
      horarioComercialInicio: '08:00',
      horarioComercialFim: '19:00',
      backupDownloadAutomatico: false,
      ...db.configuracoes,
    };
  },
  async salvarConfiguracoes(dados): Promise<ConfiguracoesLoja> {
    await delay(40);
    const db = carregarBanco();
    db.configuracoes = {
      ...db.configuracoes,
      ...dados,
    };
    salvarBanco(db);
    return db.configuracoes;
  },
  async exportarBackup(): Promise<BackupCompleto> {
    await delay(20);
    const db = carregarBanco();
    return {
      ...db,
      exportadoEm: new Date().toISOString(),
    };
  },
  async importarBackup(backup: BackupCompleto): Promise<void> {
    await delay(50);
    if (!backup || !Array.isArray(backup.clientes) || !Array.isArray(backup.ordensServico)) {
      throw new Error('Arquivo de backup inválido ou incompatível.');
    }
    salvarBanco(backup);
  },
  async resetarDadosSeed(): Promise<void> {
    await delay(50);
    const inicial = structuredClone(backupInicialSeed);
    salvarBanco(inicial);
  },
  async listarBackupsAutomaticos(): Promise<PontoBackupAutomatico[]> {
    await delay(15);
    return carregarListaBackupsAuto();
  },
  async criarPontoBackupAutomatico(
    motivo = 'Backup Automático Horário'
  ): Promise<PontoBackupAutomatico> {
    await delay(20);
    const db = carregarBanco();
    const agora = new Date().toISOString();
    db.configuracoes = {
      ...db.configuracoes,
      ultimoBackupAutomaticoEm: agora,
    };
    salvarBanco(db);

    const ponto: PontoBackupAutomatico = {
      id: gerarId(),
      criadoEm: agora,
      motivo,
      resumo: {
        qtdOS: db.ordensServico.length,
        qtdClientes: db.clientes.length,
        qtdProdutos: db.produtos.length,
        qtdVendas: db.vendas.length,
      },
      dados: {
        ...structuredClone(db),
        exportadoEm: agora,
      },
    };

    const listaAtual = carregarListaBackupsAuto();
    salvarListaBackupsAuto([ponto, ...listaAtual]);
    return ponto;
  },
  async restaurarPontoBackupAutomatico(id: string): Promise<void> {
    await delay(40);
    const lista = carregarListaBackupsAuto();
    const alvo = lista.find((p) => p.id === id);
    if (!alvo) throw new Error('Ponto de backup automático não encontrado.');
    salvarBanco(alvo.dados);
  },
  async removerPontoBackupAutomatico(id: string): Promise<void> {
    await delay(20);
    const lista = carregarListaBackupsAuto().filter((p) => p.id !== id);
    salvarListaBackupsAuto(lista);
  },
};
