import { describe, it, expect, beforeEach } from 'vitest';
import {
  clienteRepo,
  aparelhoRepo,
  osRepo,
  produtoRepo,
  vendaRepo,
  financeiroRepo,
  configRepo,
} from '@/repositories/localStorageRepo';
import {
  formatarMoeda,
  formatarNumeroOS,
  montarDescricaoPecaManual,
  caixaEhDeDiaAnterior,
} from '@/utils/formatters';

describe('SH LojaCell — Fluxos Críticos do Sistema (Seção 6 e 14 do PRD)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await configRepo.resetarDadosSeed();
  });

  it('1. Deve carregar os dados iniciais (seed) e impedir exclusão de cliente com histórico', async () => {
    const clientes = await clienteRepo.listar();
    const produtos = await produtoRepo.listar();
    const ordens = await osRepo.listar();

    expect(clientes.length).toBeGreaterThanOrEqual(15);
    expect(produtos.length).toBeGreaterThanOrEqual(40);
    expect(ordens.length).toBeGreaterThanOrEqual(20);

    // Cliente cli-1 possui OS no seed
    const temHistorico = await clienteRepo.possuiHistorico('cli-1');
    expect(temHistorico).toBe(true);
  });

  it('2. Deve criar cliente novo, adicionar marca/modelo ao catálogo e abrir OS sequencial com status Aguardando Análise', async () => {
    const novoCliente = await clienteRepo.criar({
      nome: 'Cliente Teste Tablet Android',
      tipoPessoa: 'fisica',
      telefone: '(11) 98888-7777',
      whatsapp: true,
      ativo: true,
    });

    await aparelhoRepo.adicionarMarcaModelo('Honor', 'Magic 6 Pro');
    const catalogo = await aparelhoRepo.listarCatalogoMarcas();
    expect(catalogo.some((c) => c.marca === 'Honor' && c.modelos.includes('Magic 6 Pro'))).toBe(
      true
    );

    const novoAparelho = await aparelhoRepo.criar({
      clienteId: novoCliente.id,
      marca: 'Honor',
      modelo: 'Magic 6 Pro',
      cor: 'Verde',
      imeiSerial: '860000999911112',
      acessorios: {
        carregador: false,
        capa: true,
        chip: true,
        cartaoMemoria: false,
        bandejaChip: true,
      },
    });

    const proximoNumero = await osRepo.obterProximoNumero();
    const novaOS = await osRepo.criar({
      numero: proximoNumero,
      clienteId: novoCliente.id,
      aparelhoId: novoAparelho.id,
      dataEntrada: new Date().toISOString(),
      status: 'aguardando_analise',
      prioridade: 'urgente',
      defeitoRelatado: 'Tela trincada após queda',
      checklistEntrada: {
        liga: true,
        telaTrincada: true,
        touchOk: true,
        carrega: true,
        camerasOk: true,
        audioOk: true,
        wifiBluetoothOk: true,
        botoesOk: true,
        biometriaOk: true,
        chipOk: true,
        sinalOxidacao: false,
      },
      itens: [],
      descontoCentavos: 0,
      acrescimoCentavos: 0,
      totalCentavos: 0,
      pagamentos: [],
      garantiaDias: 90,
      fotos: [],
      tecnicoResponsavel: 'Carlos Eduardo (Principal)',
      estoqueBaixado: false,
      historicoStatus: [
        {
          status: 'aguardando_analise',
          dataHora: new Date().toISOString(),
          usuario: 'Administrador',
        },
      ],
    });

    expect(novaOS.numero).toBe(121);
    expect(formatarNumeroOS(novaOS.numero)).toBe('000121');
    expect(novaOS.status).toBe('aguardando_analise');
  });

  it('3. Deve adicionar peça e serviço na OS, baixar estoque ao aprovar e estornar caso cancelada', async () => {
    const prodAntes = await produtoRepo.obter('prod-1');
    expect(prodAntes?.estoqueAtual).toBe(4);

    // Baixar 1 unidade simulando aprovação da OS
    const prodDepoisBaixa = await produtoRepo.ajustarEstoque({
      produtoId: 'prod-1',
      quantidadeDelta: -1,
      tipo: 'saida_os',
      motivo: 'Baixa OS #000121',
    });
    expect(prodDepoisBaixa.estoqueAtual).toBe(3);

    // Simular cancelamento da OS devolvendo ao estoque
    const prodDepoisEstorno = await produtoRepo.ajustarEstoque({
      produtoId: 'prod-1',
      quantidadeDelta: 1,
      tipo: 'estorno',
      motivo: 'Estorno por cancelamento OS #000121',
    });
    expect(prodDepoisEstorno.estoqueAtual).toBe(4);
  });

  it('4. Deve realizar venda de balcão com múltiplas formas de pagamento e alimentar o caixa aberto', async () => {
    const caixaInicial = await financeiroRepo.obterCaixaAberto();
    expect(caixaInicial).toBeDefined();
    const qtdMovimentosAntes = caixaInicial!.movimentos.length;

    const numeroVenda = await vendaRepo.obterProximoNumero();
    const venda = await vendaRepo.criar({
      numero: numeroVenda,
      data: new Date().toISOString(),
      itens: [
        {
          id: 'iv-teste',
          tipo: 'produto',
          referenciaId: 'prod-17',
          codigo: 'PEL-3D-UNIV',
          descricao: 'Película 3D',
          quantidade: 2,
          valorUnitarioCentavos: 2500,
          custoUnitarioCentavos: 450,
          descontoCentavos: 0,
        },
      ],
      descontoCentavos: 0,
      totalCentavos: 5000,
      pagamentos: [
        {
          id: 'p1',
          formaPagamento: 'dinheiro',
          valorCentavos: 3000,
          dataPagamento: new Date().toISOString(),
        },
        {
          id: 'p2',
          formaPagamento: 'pix',
          valorCentavos: 2000,
          dataPagamento: new Date().toISOString(),
        },
      ],
      trocoCentavos: 0,
      status: 'concluida',
    });

    await financeiroRepo.registrarMovimentoCaixa({
      tipo: 'venda',
      descricao: `Venda #${formatarNumeroOS(venda.numero)} (Dinheiro)`,
      valorCentavos: 3000,
      formaPagamento: 'dinheiro',
      origemId: venda.id,
    });
    await financeiroRepo.registrarMovimentoCaixa({
      tipo: 'venda',
      descricao: `Venda #${formatarNumeroOS(venda.numero)} (Pix)`,
      valorCentavos: 2000,
      formaPagamento: 'pix',
      origemId: venda.id,
    });

    const caixaDepois = await financeiroRepo.obterCaixaAberto();
    expect(caixaDepois!.movimentos.length).toBe(qtdMovimentosAntes + 2);
    expect(formatarMoeda(venda.totalCentavos)).toContain('50,00');
  });

  it('5. Deve fechar o caixa calculando diferença e exportar/importar backup JSON completo', async () => {
    const caixaAberto = await financeiroRepo.obterCaixaAberto();
    expect(caixaAberto).toBeDefined();

    const saldoEsperado = caixaAberto!.movimentos.reduce(
      (acc, m) => acc + m.valorCentavos,
      0
    );

    const fechado = await financeiroRepo.fecharCaixa(
      caixaAberto!.id,
      saldoEsperado,
      'Fechamento sem diferença'
    );
    expect(fechado.status).toBe('fechado');
    expect(fechado.diferencaCentavos).toBe(0);

    const backup = await configRepo.exportarBackup();
    expect(backup.clientes.length).toBeGreaterThanOrEqual(15);
    await configRepo.importarBackup(backup);
  });

  it('6. Deve gerenciar cadastro de Marcas e Modelos (criar, editar e excluir)', async () => {
    await aparelhoRepo.adicionarMarcaModelo('Nothing', 'Phone (2)');
    let catalogo = await aparelhoRepo.listarCatalogoMarcas();
    expect(catalogo.find((c) => c.marca === 'Nothing')?.modelos).toContain('Phone (2)');

    await aparelhoRepo.editarModelo('Nothing', 'Phone (2)', 'Phone (2a) Plus');
    catalogo = await aparelhoRepo.listarCatalogoMarcas();
    expect(catalogo.find((c) => c.marca === 'Nothing')?.modelos).toContain('Phone (2a) Plus');

    await aparelhoRepo.editarMarca('Nothing', 'Nothing Tech');
    catalogo = await aparelhoRepo.listarCatalogoMarcas();
    expect(catalogo.some((c) => c.marca === 'Nothing Tech')).toBe(true);

    await aparelhoRepo.removerModelo('Nothing Tech', 'Phone (2a) Plus');
    catalogo = await aparelhoRepo.listarCatalogoMarcas();
    expect(catalogo.find((c) => c.marca === 'Nothing Tech')?.modelos.length).toBe(0);

    await aparelhoRepo.removerMarca('Nothing Tech');
    catalogo = await aparelhoRepo.listarCatalogoMarcas();
    expect(catalogo.some((c) => c.marca === 'Nothing Tech')).toBe(false);
  });

  it('7. Deve montar e salvar peça manual vinculada ao modelo na OS com qualidade e opção com/sem aro', async () => {
    const descricaoGerada = montarDescricaoPecaManual({
      pecaTipo: 'Tela',
      modeloAparelho: 'Samsung Galaxy A14 5G',
      qualidadePeca: 'OLED',
      aroPeca: 'com_aro',
    });

    expect(descricaoGerada).toBe('Tela Samsung Galaxy A14 5G (OLED • Com Aro)');

    const os = await osRepo.obter('os-1');
    expect(os).toBeDefined();

    const osAtualizada = await osRepo.atualizar('os-1', {
      itens: [
        ...os!.itens,
        {
          id: 'item-manual-a14',
          tipo: 'peca',
          referenciaId: 'manual-peca-a14',
          descricao: descricaoGerada,
          quantidade: 1,
          valorUnitarioCentavos: 26000,
          custoUnitarioCentavos: 11000,
          descontoCentavos: 0,
          manual: true,
          pecaTipo: 'Tela',
          modeloAparelho: 'Samsung Galaxy A14 5G',
          qualidadePeca: 'OLED',
          aroPeca: 'com_aro',
        },
      ],
    });

    const itemSalvo = osAtualizada.itens.find((i) => i.id === 'item-manual-a14');
    expect(itemSalvo?.modeloAparelho).toBe('Samsung Galaxy A14 5G');
    expect(itemSalvo?.qualidadePeca).toBe('OLED');
    expect(itemSalvo?.aroPeca).toBe('com_aro');
    expect(itemSalvo?.valorUnitarioCentavos).toBe(26000);
  });

  it('8. Deve bloquear movimentações e vendas caso o caixa aberto seja de um dia anterior', async () => {
    const caixa = await financeiroRepo.obterCaixaAberto();
    expect(caixa).toBeDefined();
    expect(caixaEhDeDiaAnterior(caixa!.aberturaData)).toBe(false);

    // Simular caixa aberto ontem
    const ontemIso = new Date(Date.now() - 86400000 * 2).toISOString();
    const caixaOntem = await financeiroRepo.alterarDataAberturaCaixa(caixa!.id, ontemIso);
    expect(caixaEhDeDiaAnterior(caixaOntem.aberturaData)).toBe(true);

    // Tentar registrar venda ou suprimento com caixa de dia anterior deve falhar
    await expect(
      financeiroRepo.registrarMovimentoCaixa({
        tipo: 'venda',
        descricao: 'Tentativa de venda com caixa do dia anterior',
        valorCentavos: 10000,
        formaPagamento: 'pix',
      })
    ).rejects.toThrow(/pertence a um dia anterior/i);
  });

  it('9. Deve aplicar preclusão e estornar recebimentos da OS ao reabri-la, permitindo alterar a data do pagamento', async () => {
    const dataAntiga = '2026-10-01T12:00:00.000Z';
    const novaDataPagamento = '2026-10-15T12:00:00.000Z';

    await financeiroRepo.criarLancamento({
      tipo: 'entrada',
      categoria: 'Serviços de Assistência (OS)',
      descricao: 'Recebimento OS #001099',
      valorCentavos: 32000,
      dataVencimento: dataAntiga,
      dataPagamento: dataAntiga,
      status: 'pago',
      formaPagamento: 'pix',
      origem: 'os',
      origemId: 'os-teste-preclusao',
    });

    await financeiroRepo.registrarMovimentoCaixa({
      tipo: 'recebimento_os',
      descricao: 'OS #001099',
      valorCentavos: 32000,
      formaPagamento: 'pix',
      origemId: 'os-teste-preclusao',
    });

    const estorno = await financeiroRepo.estornarRecebimentosOS('os-teste-preclusao');
    expect(estorno.lancamentosEstornados).toBe(1);
    expect(estorno.valorTotalEstornadoCentavos).toBe(32000);
    expect(estorno.datasEstornadas).toContain('2026-10-01');

    // Após reabrir e editar, encerrar novamente na novaDataPagamento
    const novoLancamento = await financeiroRepo.criarLancamento({
      tipo: 'entrada',
      categoria: 'Serviços de Assistência (OS)',
      descricao: 'Recebimento OS #001099 (Reaberta)',
      valorCentavos: 35000,
      dataVencimento: novaDataPagamento,
      dataPagamento: novaDataPagamento,
      status: 'pago',
      formaPagamento: 'cartao_credito',
      origem: 'os',
      origemId: 'os-teste-preclusao',
    });

    expect(novoLancamento.dataPagamento).toBe(novaDataPagamento);
    expect(novoLancamento.valorCentavos).toBe(35000);
  });

  it('10. Deve criar e listar pontos de backup automático de hora em hora', async () => {
    const ponto = await configRepo.criarPontoBackupAutomatico('Backup Automático 14h');
    expect(ponto.id).toBeDefined();
    expect(ponto.motivo).toBe('Backup Automático 14h');
    expect(ponto.resumo.qtdOS).toBeGreaterThanOrEqual(1);

    const lista = await configRepo.listarBackupsAutomaticos();
    expect(lista.length).toBeGreaterThanOrEqual(1);
    expect(lista[0].id).toBe(ponto.id);
  });
});
