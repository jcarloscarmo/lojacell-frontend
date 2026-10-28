import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileDown,
  Printer,
  Calendar,
  Cpu,
  Wrench,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { startOfDay, endOfDay, parseISO, subDays, startOfMonth, format } from 'date-fns';
import { Aparelho, Cliente, OrdemServico, StatusOS } from '@/types/domain';
import {
  formatarMoeda,
  formatarData,
  formatarNumeroOS,
  formatarAroPeca,
} from '@/utils/formatters';

interface RelatorioOSPecasServicosProps {
  ordens: OrdemServico[];
  clientes: Cliente[];
  aparelhos: Aparelho[];
  aoAbrirOS?: (os: OrdemServico) => void;
}

const STATUS_LABELS: Record<StatusOS, string> = {
  aguardando_analise: 'Aguardando Análise',
  em_analise: 'Em Análise',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovada_em_reparo: 'Em Reparo',
  aguardando_peca: 'Aguardando Peça',
  pronta_retirada: 'Pronta p/ Retirada',
  entregue: 'Entregue',
  reprovada: 'Reprovada',
  cancelada: 'Cancelada',
};

export const RelatorioOSPecasServicos: React.FC<RelatorioOSPecasServicosProps> = ({
  ordens,
  clientes,
  aparelhos,
  aoAbrirOS,
}) => {
  const hojeStr = format(new Date(), 'yyyy-MM-dd');
  const trintaDiasAtrasStr = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const [dataInicio, setDataInicio] = useState<string>(trintaDiasAtrasStr);
  const [dataFim, setDataFim] = useState<string>(hojeStr);
  const [campoData, setCampoData] = useState<'entrada' | 'saida'>('entrada');
  const [filtroStatusGrupo, setFiltroStatusGrupo] = useState<
    'validas' | 'entregues' | 'aprovadas_prontas_entregues' | 'todas'
  >('validas');
  const [filtroTipoItem, setFiltroTipoItem] = useState<'todos' | 'peca' | 'servico'>('todos');
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  const mapaClientes = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const mapaAparelhos = useMemo(() => new Map(aparelhos.map((a) => [a.id, a])), [aparelhos]);

  const aplicarAtalhoPeriodo = (dias: number | 'mes' | 'tudo' | 'hoje') => {
    const agora = new Date();
    if (dias === 'hoje') {
      const h = format(agora, 'yyyy-MM-dd');
      setDataInicio(h);
      setDataFim(h);
    } else if (dias === 'mes') {
      setDataInicio(format(startOfMonth(agora), 'yyyy-MM-dd'));
      setDataFim(format(agora, 'yyyy-MM-dd'));
    } else if (dias === 'tudo') {
      setDataInicio('');
      setDataFim('');
    } else {
      setDataInicio(format(subDays(agora, dias), 'yyyy-MM-dd'));
      setDataFim(format(agora, 'yyyy-MM-dd'));
    }
  };

  // Filtra as OS do período e extrai todas as linhas de Peças e Serviços
  const dadosRelatorio = useMemo(() => {
    const inicioMs = dataInicio ? startOfDay(parseISO(dataInicio)).getTime() : null;
    const fimMs = dataFim ? endOfDay(parseISO(dataFim)).getTime() : null;

    const osNoPeriodo = ordens.filter((os) => {
      if (os.rascunho) return false;

      // Filtro de Status
      if (filtroStatusGrupo === 'validas') {
        if (os.status === 'cancelada' || os.status === 'reprovada') return false;
      } else if (filtroStatusGrupo === 'entregues') {
        if (os.status !== 'entregue') return false;
      } else if (filtroStatusGrupo === 'aprovadas_prontas_entregues') {
        if (
          os.status !== 'aprovada_em_reparo' &&
          os.status !== 'pronta_retirada' &&
          os.status !== 'entregue'
        ) {
          return false;
        }
      }

      // Filtro de Data
      const dataAlvoStr = campoData === 'saida' ? os.dataSaida || os.dataEntrada : os.dataEntrada;
      if (!dataAlvoStr) return false;
      const dataMs = parseISO(dataAlvoStr).getTime();
      if (inicioMs !== null && dataMs < inicioMs) return false;
      if (fimMs !== null && dataMs > fimMs) return false;

      return true;
    });

    interface LinhaItemRelatorio {
      os: OrdemServico;
      clienteNome: string;
      aparelhoModeloCompleto: string;
      itemId: string;
      tipo: 'peca' | 'servico';
      pecaTipo?: string;
      descricao: string;
      qualidadePeca?: string;
      aroPeca?: 'com_aro' | 'sem_aro' | 'na';
      quantidade: number;
      valorUnitarioCentavos: number;
      custoUnitarioCentavos: number;
      subtotalValorCentavos: number;
      subtotalCustoCentavos: number;
    }

    const linhas: LinhaItemRelatorio[] = [];
    let totalDescontosOSCentavos = 0;
    const osComItensIds = new Set<string>();

    for (const os of osNoPeriodo) {
      const cli = mapaClientes.get(os.clienteId);
      const apa = mapaAparelhos.get(os.aparelhoId);
      const modeloPadraoOS = apa ? `${apa.marca} ${apa.modelo}` : 'Aparelho não identificado';

      for (const item of os.itens) {
        if (filtroTipoItem !== 'todos' && item.tipo !== filtroTipoItem) continue;

        const modeloVinculado = item.modeloAparelho || modeloPadraoOS;
        const q = buscaTexto.trim().toLowerCase();
        if (q) {
          const bate =
            item.descricao.toLowerCase().includes(q) ||
            modeloVinculado.toLowerCase().includes(q) ||
            (item.pecaTipo?.toLowerCase().includes(q) ?? false) ||
            (item.qualidadePeca?.toLowerCase().includes(q) ?? false) ||
            (cli?.nome.toLowerCase().includes(q) ?? false) ||
            formatarNumeroOS(os.numero).includes(q);
          if (!bate) continue;
        }

        osComItensIds.add(os.id);
        const subtotalValor =
          item.quantidade * item.valorUnitarioCentavos - (item.descontoCentavos || 0);
        const subtotalCusto = item.quantidade * (item.custoUnitarioCentavos || 0);

        linhas.push({
          os,
          clienteNome: cli?.nome || 'Cliente Removido',
          aparelhoModeloCompleto: modeloVinculado,
          itemId: item.id,
          tipo: item.tipo,
          pecaTipo: item.pecaTipo,
          descricao: item.descricao,
          qualidadePeca: item.qualidadePeca,
          aroPeca: item.aroPeca,
          quantidade: item.quantidade,
          valorUnitarioCentavos: item.valorUnitarioCentavos,
          custoUnitarioCentavos: item.custoUnitarioCentavos || 0,
          subtotalValorCentavos: subtotalValor,
          subtotalCustoCentavos: subtotalCusto,
        });
      }

      if (osComItensIds.has(os.id)) {
        totalDescontosOSCentavos += os.descontoCentavos || 0;
      }
    }

    // Totalizadores
    let qtdPecas = 0;
    let valorTotalPecasCentavos = 0;
    let custoTotalPecasCentavos = 0;

    let qtdServicos = 0;
    let valorTotalServicosCentavos = 0;

    for (const l of linhas) {
      if (l.tipo === 'peca') {
        qtdPecas += l.quantidade;
        valorTotalPecasCentavos += l.subtotalValorCentavos;
        custoTotalPecasCentavos += l.subtotalCustoCentavos;
      } else {
        qtdServicos += l.quantidade;
        valorTotalServicosCentavos += l.subtotalValorCentavos;
      }
    }

    const valorBrutoItensCentavos = valorTotalPecasCentavos + valorTotalServicosCentavos;
    const descontoAplicado =
      filtroTipoItem === 'todos' ? totalDescontosOSCentavos : 0;
    const valorLiquidoTotalCentavos = Math.max(
      0,
      valorBrutoItensCentavos - descontoAplicado
    );
    const lucroLiquidoEstimadoCentavos =
      valorLiquidoTotalCentavos - custoTotalPecasCentavos;

    return {
      linhas,
      qtdOSComItens: osComItensIds.size,
      qtdPecas,
      valorTotalPecasCentavos,
      custoTotalPecasCentavos,
      qtdServicos,
      valorTotalServicosCentavos,
      descontoAplicado,
      valorBrutoItensCentavos,
      valorLiquidoTotalCentavos,
      lucroLiquidoEstimadoCentavos,
    };
  }, [
    ordens,
    mapaClientes,
    mapaAparelhos,
    dataInicio,
    dataFim,
    campoData,
    filtroStatusGrupo,
    filtroTipoItem,
    buscaTexto,
  ]);

  const exportarRelatorioCsv = () => {
    const cabecalho =
      'OS;Data;Status;Cliente;ModeloAparelho;TipoItem;PecaTipo;Descricao;Qualidade;Aro;Quantidade;CustoTotal;ValorCobrado\n';
    const linhasCsv = dadosRelatorio.linhas
      .map(
        (l) =>
          `${formatarNumeroOS(l.os.numero)};${formatarData(l.os.dataEntrada)};${
            STATUS_LABELS[l.os.status]
          };"${l.clienteNome}";"${l.aparelhoModeloCompleto}";${
            l.tipo === 'peca' ? 'PECA' : 'SERVICO'
          };"${l.pecaTipo || ''}";"${l.descricao}";"${l.qualidadePeca || ''}";"${
            l.aroPeca ? formatarAroPeca(l.aroPeca) : ''
          }";${l.quantidade};${(l.subtotalCustoCentavos / 100).toFixed(2)};${(
            l.subtotalValorCentavos / 100
          ).toFixed(2)}`
      )
      .join('\n');

    const blob = new Blob(['\ufeff' + cabecalho + linhasCsv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-os-pecas-servicos-${dataInicio || 'inicio'}-a-${
      dataFim || 'hoje'
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gerarRelatorioPdf = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const periodoTexto = `${dataInicio ? formatarData(dataInicio) : 'Início'} até ${
      dataFim ? formatarData(dataFim) : 'Hoje'
    }`;

    // Cabeçalho escuro
    doc.setFillColor(15, 23, 42);
    doc.rect(10, 10, 277, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(
      'SH LOJACELL — RELATÓRIO DE PEÇAS E SERVIÇOS EXECUTADOS EM OS',
      15,
      19
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `Período filtrado: ${periodoTexto}   |   OS com itens: ${
        dadosRelatorio.qtdOSComItens
      }   |   Emitido em: ${new Date().toLocaleString('pt-BR')}`,
      15,
      26
    );

    // Resumo Totalizador em 4 blocos
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(10, 33, 277, 18, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      `PEÇAS TROCADAS (${dadosRelatorio.qtdPecas} un.): ${formatarMoeda(
        dadosRelatorio.valorTotalPecasCentavos
      )}`,
      14,
      40
    );
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Custo Total Peças: ${formatarMoeda(dadosRelatorio.custoTotalPecasCentavos)}`,
      14,
      46
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      `SERVIÇOS / MÃO DE OBRA (${dadosRelatorio.qtdServicos}): ${formatarMoeda(
        dadosRelatorio.valorTotalServicosCentavos
      )}`,
      85,
      40
    );
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Descontos concedidos: ${formatarMoeda(dadosRelatorio.descontoAplicado)}`,
      85,
      46
    );

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text(
      `TOTALIZADOR LÍQUIDO: ${formatarMoeda(dadosRelatorio.valorLiquidoTotalCentavos)}`,
      165,
      40
    );
    doc.setTextColor(3, 105, 161);
    doc.text(
      `LUCRO BRUTO ESTIMADO: ${formatarMoeda(
        dadosRelatorio.lucroLiquidoEstimadoCentavos
      )}`,
      165,
      46
    );

    // Tabela de itens
    const corpoTabela = dadosRelatorio.linhas.map((l) => {
      const qualAro = [
        l.qualidadePeca && l.qualidadePeca !== 'N/A' ? l.qualidadePeca : '',
        l.aroPeca && l.aroPeca !== 'na' ? formatarAroPeca(l.aroPeca) : '',
      ]
        .filter(Boolean)
        .join(' • ');

      return [
        `#${formatarNumeroOS(l.os.numero)}`,
        formatarData(l.os.dataEntrada),
        l.clienteNome,
        l.aparelhoModeloCompleto,
        l.tipo === 'peca' ? 'PEÇA' : 'SERVIÇO',
        l.descricao,
        qualAro || '—',
        String(l.quantidade),
        l.tipo === 'peca' ? formatarMoeda(l.subtotalCustoCentavos) : '—',
        formatarMoeda(l.subtotalValorCentavos),
      ];
    });

    autoTable(doc, {
      startY: 54,
      margin: { left: 10, right: 10 },
      head: [
        [
          'OS',
          'Data',
          'Cliente',
          'Modelo Aparelho',
          'Tipo',
          'Peça / Serviço Executado',
          'Qualidade / Aro',
          'Qtd',
          'Custo',
          'Valor Cobrado',
        ],
      ],
      body: corpoTabela,
      foot: [
        [
          'TOTALIZADOR',
          `${dadosRelatorio.qtdOSComItens} OS`,
          '',
          '',
          `${dadosRelatorio.qtdPecas} Peça(s) / ${dadosRelatorio.qtdServicos} Serv.`,
          `Descontos nas OS: -${formatarMoeda(dadosRelatorio.descontoAplicado)}`,
          `Lucro: ${formatarMoeda(dadosRelatorio.lucroLiquidoEstimadoCentavos)}`,
          String(dadosRelatorio.qtdPecas + dadosRelatorio.qtdServicos),
          formatarMoeda(dadosRelatorio.custoTotalPecasCentavos),
          formatarMoeda(dadosRelatorio.valorLiquidoTotalCentavos),
        ],
      ],
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
      },
      headStyles: {
        fillColor: [2, 132, 199],
        textColor: 255,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        7: { halign: 'center' },
        8: { halign: 'right' },
        9: { halign: 'right', fontStyle: 'bold' },
      },
    });

    doc.save(
      `relatorio-os-pecas-servicos-${dataInicio || 'inicio'}-a-${
        dataFim || 'hoje'
      }.pdf`
    );
  };

  return (
    <div className="space-y-5">
      {/* Painel de Filtros de Período do Relatório */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-600" />
              <span>Relatório de Peças e Serviços Executados em OS por Período</span>
            </h3>
            <p className="text-xs text-slate-500">
              Consulte todas as peças utilizadas (com modelo, qualidade e aro) e serviços feitos no período com totalizador completo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => aplicarAtalhoPeriodo('hoje')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => aplicarAtalhoPeriodo(7)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => aplicarAtalhoPeriodo(30)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              Últimos 30 dias
            </button>
            <button
              type="button"
              onClick={() => aplicarAtalhoPeriodo('mes')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => aplicarAtalhoPeriodo('tudo')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              Tudo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Data Inicial (De)
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Data Final (Até)
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Filtrar Data Por
            </label>
            <select
              value={campoData}
              onChange={(e) => setCampoData(e.target.value as 'entrada' | 'saida')}
              className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value="entrada">Data de Entrada da OS</option>
              <option value="saida">Data de Entrega / Saída</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Status das OS
            </label>
            <select
              value={filtroStatusGrupo}
              onChange={(e) =>
                setFiltroStatusGrupo(e.target.value as typeof filtroStatusGrupo)
              }
              className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value="validas">Ativas + Entregues (Sem Canceladas)</option>
              <option value="entregues">Somente OS Entregues</option>
              <option value="aprovadas_prontas_entregues">
                Em Reparo + Prontas + Entregues
              </option>
              <option value="todas">Todas as OS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tipo de Item
            </label>
            <select
              value={filtroTipoItem}
              onChange={(e) => setFiltroTipoItem(e.target.value as typeof filtroTipoItem)}
              className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value="todos">Peças + Serviços (Todos)</option>
              <option value="peca">Somente Peças Trocadas</option>
              <option value="servico">Somente Serviços (Mão de Obra)</option>
            </select>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={gerarRelatorioPdf}
              className="flex-1 min-h-[42px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs"
              title="Gerar e baixar Relatório em PDF"
            >
              <FileDown className="w-4 h-4" />
              <span>Gerar PDF</span>
            </button>
            <button
              type="button"
              onClick={exportarRelatorioCsv}
              className="min-h-[42px] px-2.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1"
              title="Exportar planilha CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[42px] px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center"
              title="Imprimir Relatório"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Busca dentro do relatório */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            placeholder="Filtrar no relatório por modelo (ex.: A14, iPhone 13), peça (ex.: Tela, Bateria), qualidade (OLED, Incell) ou cliente..."
            className="w-full min-h-[42px] pl-10 pr-4 py-1.5 rounded-xl border border-slate-300 text-xs"
          />
        </div>
      </div>

      {/* CARDS DO TOTALIZADOR DO PERÍODO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-amber-700">
            <span>Total de Peças Utilizadas</span>
            <Cpu className="w-4 h-4" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {formatarMoeda(dadosRelatorio.valorTotalPecasCentavos)}
          </p>
          <p className="text-xs text-slate-500">
            <strong>{dadosRelatorio.qtdPecas} peça(s)</strong> no período • Custo:{' '}
            {formatarMoeda(dadosRelatorio.custoTotalPecasCentavos)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-sky-700">
            <span>Total de Serviços (Mão de Obra)</span>
            <Wrench className="w-4 h-4" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {formatarMoeda(dadosRelatorio.valorTotalServicosCentavos)}
          </p>
          <p className="text-xs text-slate-500">
            <strong>{dadosRelatorio.qtdServicos} serviço(s)</strong> realizados em{' '}
            {dadosRelatorio.qtdOSComItens} OS
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-emerald-700">
            <span>Totalizador Geral (Peças + Serviços)</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">
            {formatarMoeda(dadosRelatorio.valorLiquidoTotalCentavos)}
          </p>
          <p className="text-xs text-slate-500">
            Bruto: {formatarMoeda(dadosRelatorio.valorBrutoItensCentavos)} • Descontos:{' '}
            {formatarMoeda(dadosRelatorio.descontoAplicado)}
          </p>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl text-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-sky-400">
            <span>Margem / Lucro Líquido OS</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-2xl font-extrabold text-white">
            {formatarMoeda(dadosRelatorio.lucroLiquidoEstimadoCentavos)}
          </p>
          <p className="text-xs text-slate-400">
            Total Faturado menos Custo de Peças ({formatarMoeda(dadosRelatorio.custoTotalPecasCentavos)})
          </p>
        </div>
      </div>

      {/* TABELA DETALHADA DE PEÇAS E SERVIÇOS DAS OS NO PERÍODO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-sky-600" />
            <span>
              Detalhamento de Peças e Serviços Executados ({dadosRelatorio.linhas.length}{' '}
              lançamentos)
            </span>
          </span>
          <span className="text-xs text-slate-500">
            Período: {dataInicio ? formatarData(dataInicio) : 'Início'} até{' '}
            {dataFim ? formatarData(dataFim) : 'Hoje'}
          </span>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase text-slate-500">
              <th className="py-3 px-4">OS / Data</th>
              <th className="py-3 px-4">Cliente</th>
              <th className="py-3 px-4">Modelo do Aparelho</th>
              <th className="py-3 px-4">Tipo</th>
              <th className="py-3 px-4">Peça ou Serviço Executado</th>
              <th className="py-3 px-4">Qualidade / Aro</th>
              <th className="py-3 px-4 text-center">Qtd</th>
              <th className="py-3 px-4 text-right">Custo</th>
              <th className="py-3 px-4 text-right">Valor Cobrado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {dadosRelatorio.linhas.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-400">
                  Nenhuma peça ou serviço encontrado para o período e filtros selecionados.
                </td>
              </tr>
            ) : (
              dadosRelatorio.linhas.map((linha) => (
                <tr
                  key={`${linha.os.id}-${linha.itemId}`}
                  onClick={() => aoAbrirOS && aoAbrirOS(linha.os)}
                  className={`hover:bg-sky-50/50 transition-colors ${
                    aoAbrirOS ? 'cursor-pointer' : ''
                  }`}
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-sky-700 block text-xs">
                      #{formatarNumeroOS(linha.os.numero)}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {formatarData(linha.os.dataEntrada)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900 text-xs">
                      {linha.clienteNome}
                    </p>
                    <span className="text-[10px] text-slate-500">
                      {STATUS_LABELS[linha.os.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 text-xs">
                      {linha.aparelhoModeloCompleto}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        linha.tipo === 'peca'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {linha.tipo === 'peca' ? 'Peça' : 'Serviço'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900 text-xs">
                      {linha.descricao}
                    </p>
                    {linha.pecaTipo && (
                      <span className="text-[11px] text-slate-500">
                        Componente: {linha.pecaTipo}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {linha.tipo === 'peca' ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {linha.qualidadePeca && linha.qualidadePeca !== 'N/A' ? (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                            {linha.qualidadePeca}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                        {linha.aroPeca && linha.aroPeca !== 'na' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {formatarAroPeca(linha.aroPeca)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Mão de Obra</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-xs">
                    {linha.quantidade}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-slate-500">
                    {linha.subtotalCustoCentavos > 0
                      ? formatarMoeda(linha.subtotalCustoCentavos)
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatarMoeda(linha.subtotalValorCentavos)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {dadosRelatorio.linhas.length > 0 && (
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-xs">
                <td colSpan={6} className="py-3.5 px-4 text-right uppercase tracking-wide">
                  Totalizador do Período ({dadosRelatorio.qtdPecas} peças +{' '}
                  {dadosRelatorio.qtdServicos} serviços):
                </td>
                <td className="py-3.5 px-4 text-center">
                  {dadosRelatorio.qtdPecas + dadosRelatorio.qtdServicos}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-amber-300">
                  {formatarMoeda(dadosRelatorio.custoTotalPecasCentavos)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-emerald-400 text-sm">
                  {formatarMoeda(dadosRelatorio.valorBrutoItensCentavos)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
