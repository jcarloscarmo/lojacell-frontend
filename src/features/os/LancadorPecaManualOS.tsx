import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Wrench, Plus, Check, X, ChevronUp, Save, Edit3 } from 'lucide-react';
import { AroPecaTipo, ItemOS } from '@/types/domain';
import { aparelhoRepo } from '@/repositories/localStorageRepo';
import {
  gerarId,
  montarDescricaoPecaManual,
  formatarMoeda,
} from '@/utils/formatters';
import { SeletorMarcaModelo } from '@/components/ui/SeletorMarcaModelo';
import { useToast } from '@/components/ui/Toast';

const TIPOS_PECA_RAPIDOS = [
  'Tela',
  'Bateria',
  'Conector de Carga',
  'Tampa Traseira',
  'Câmera / Lente',
  'Alto-Falante / Auricular',
  'Flex Power / Volume',
  'Vidro / Touch',
  'Outra Peça',
];

const QUALIDADES_PECA = [
  'OLED',
  'Incell',
  'Original',
  'Nacional',
  'Premium',
  'China / Comum',
  'N/A',
];

const OPCOES_ARO: { valor: AroPecaTipo; label: string }[] = [
  { valor: 'com_aro', label: 'Com Aro' },
  { valor: 'sem_aro', label: 'Sem Aro' },
  { valor: 'na', label: 'Não se aplica (N/A)' },
];

interface LancadorPecaManualOSProps {
  modeloAparelhoPadrao: string;
  aoAdicionarItem: (item: ItemOS) => void;
  itemEmEdicao?: ItemOS | null;
  aoSalvarEdicao?: (itemAtualizado: ItemOS) => void;
  aoCancelarEdicao?: () => void;
  desabilitado?: boolean;
}

export const LancadorPecaManualOS: React.FC<LancadorPecaManualOSProps> = ({
  modeloAparelhoPadrao,
  aoAdicionarItem,
  itemEmEdicao = null,
  aoSalvarEdicao,
  aoCancelarEdicao,
  desabilitado = false,
}) => {
  const { notificar } = useToast();

  const { data: catalogoMarcas = [] } = useQuery({
    queryKey: ['catalogoMarcas'],
    queryFn: () => aparelhoRepo.listarCatalogoMarcas(),
  });

  // Painel recolhido por padrão para manter o layout limpo (Progressive Disclosure)
  const [painelAberto, setPainelAberto] = useState<boolean>(false);
  const [modo, setModo] = useState<'peca' | 'servico'>('peca');

  const [pecaSelecionada, setPecaSelecionada] = useState<string>('Tela');
  const [outraPecaTexto, setOutraPecaTexto] = useState<string>('');
  const [marcaAparelho, setMarcaAparelho] = useState<string>('Samsung');
  const [modeloAparelho, setModeloAparelho] = useState<string>(modeloAparelhoPadrao);
  const [qualidadePeca, setQualidadePeca] = useState<string>('OLED');
  const [aroPeca, setAroPeca] = useState<AroPecaTipo>('com_aro');
  const [valorCobradoReais, setValorCobradoReais] = useState<string>('');
  const [custoPecaReais, setCustoPecaReais] = useState<string>('');
  const [quantidade, setQuantidade] = useState<number>(1);

  // Estado para Serviço Manual
  const [descricaoServico, setDescricaoServico] = useState<string>(
    'Mão de Obra — Substituição de Componente'
  );
  const [valorServicoReais, setValorServicoReais] = useState<string>('');

  const extrairMarcaEModelo = (textoModelo: string) => {
    const padrao = textoModelo.trim();
    if (!padrao) return { marca: 'Samsung', modelo: '' };
    const marcaEncontrada = catalogoMarcas.find((cat) =>
      padrao.toLowerCase().startsWith(cat.marca.toLowerCase())
    );
    if (marcaEncontrada) {
      const restoModelo = padrao.slice(marcaEncontrada.marca.length).trim();
      return {
        marca: marcaEncontrada.marca,
        modelo: restoModelo || padrao,
      };
    }
    return { marca: 'Samsung', modelo: padrao };
  };

  // Sincroniza quando o aparelho da OS muda (apenas se não estiver editando um item específico)
  useEffect(() => {
    if (itemEmEdicao) return;
    const { marca, modelo } = extrairMarcaEModelo(modeloAparelhoPadrao);
    setMarcaAparelho(marca);
    setModeloAparelho(modelo);
  }, [modeloAparelhoPadrao, catalogoMarcas, itemEmEdicao]);

  // Quando o usuário clica em "Editar" numa peça/serviço existente na OS, abre o painel preenchido
  useEffect(() => {
    if (!itemEmEdicao) return;
    setPainelAberto(true);
    if (itemEmEdicao.tipo === 'peca') {
      setModo('peca');
      const tipoSalvo = itemEmEdicao.pecaTipo || 'Tela';
      if (TIPOS_PECA_RAPIDOS.includes(tipoSalvo)) {
        setPecaSelecionada(tipoSalvo);
        setOutraPecaTexto('');
      } else {
        setPecaSelecionada('Outra Peça');
        setOutraPecaTexto(tipoSalvo);
      }
      const { marca, modelo } = extrairMarcaEModelo(
        itemEmEdicao.modeloAparelho || modeloAparelhoPadrao
      );
      setMarcaAparelho(marca);
      setModeloAparelho(modelo);
      setQualidadePeca(itemEmEdicao.qualidadePeca || 'OLED');
      setAroPeca(itemEmEdicao.aroPeca || 'na');
      setValorCobradoReais(
        (itemEmEdicao.valorUnitarioCentavos / 100).toFixed(2).replace('.', ',')
      );
      setCustoPecaReais(
        itemEmEdicao.custoUnitarioCentavos > 0
          ? (itemEmEdicao.custoUnitarioCentavos / 100).toFixed(2).replace('.', ',')
          : ''
      );
      setQuantidade(itemEmEdicao.quantidade || 1);
    } else {
      setModo('servico');
      setDescricaoServico(itemEmEdicao.descricao);
      setValorServicoReais(
        (itemEmEdicao.valorUnitarioCentavos / 100).toFixed(2).replace('.', ',')
      );
      setQuantidade(itemEmEdicao.quantidade || 1);
    }
  }, [itemEmEdicao]);

  const selecionarTipoPeca = (tipo: string) => {
    setPecaSelecionada(tipo);
    if (tipo === 'Tela') {
      setAroPeca('com_aro');
      if (qualidadePeca === 'N/A') setQualidadePeca('OLED');
    } else {
      setAroPeca('na');
      if (qualidadePeca === 'OLED' || qualidadePeca === 'Incell') {
        setQualidadePeca('Original');
      }
    }
  };

  const converterReaisParaCentavos = (txt: string): number => {
    const limpo = txt.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  const pecaFinalNome =
    pecaSelecionada === 'Outra Peça'
      ? outraPecaTexto.trim() || 'Peça'
      : pecaSelecionada;

  const modeloCompletoFormatado = (() => {
    const m = marcaAparelho.trim();
    const mod = modeloAparelho.trim();
    if (!mod) return m || 'Aparelho da OS';
    if (m && !mod.toLowerCase().startsWith(m.toLowerCase())) {
      return `${m} ${mod}`;
    }
    return mod;
  })();

  const descricaoPreview = montarDescricaoPecaManual({
    pecaTipo: pecaFinalNome,
    modeloAparelho: modeloCompletoFormatado,
    qualidadePeca,
    aroPeca,
  });

  const fecharPainel = () => {
    setPainelAberto(false);
    if (itemEmEdicao && aoCancelarEdicao) {
      aoCancelarEdicao();
    }
  };

  const handleConfirmarPeca = () => {
    const valorCentavos = converterReaisParaCentavos(valorCobradoReais);
    if (valorCentavos <= 0) {
      notificar('Informe o valor cobrado pela peça (R$).', 'aviso');
      return;
    }
    const custoCentavos = converterReaisParaCentavos(custoPecaReais);
    const modeloFinal = modeloCompletoFormatado;

    const itemMontado: ItemOS = {
      id: itemEmEdicao ? itemEmEdicao.id : gerarId(),
      tipo: 'peca',
      referenciaId: itemEmEdicao ? itemEmEdicao.referenciaId : `manual-peca-${Date.now()}`,
      descricao: montarDescricaoPecaManual({
        pecaTipo: pecaFinalNome,
        modeloAparelho: modeloFinal,
        qualidadePeca,
        aroPeca,
      }),
      quantidade: Math.max(1, Number(quantidade) || 1),
      valorUnitarioCentavos: valorCentavos,
      custoUnitarioCentavos: custoCentavos,
      descontoCentavos: itemEmEdicao ? itemEmEdicao.descontoCentavos : 0,
      manual: true,
      pecaTipo: pecaFinalNome,
      modeloAparelho: modeloFinal,
      qualidadePeca,
      aroPeca,
    };

    if (itemEmEdicao && aoSalvarEdicao) {
      aoSalvarEdicao(itemMontado);
      notificar(`Peça "${itemMontado.descricao}" atualizada com sucesso!`, 'sucesso');
    } else {
      aoAdicionarItem(itemMontado);
      notificar(
        `Peça "${itemMontado.descricao}" adicionada por ${formatarMoeda(valorCentavos)}!`,
        'sucesso'
      );
    }

    setValorCobradoReais('');
    setCustoPecaReais('');
    setQuantidade(1);
    // Fecha automaticamente o painel após adicionar/editar para deixar a tela limpa
    setPainelAberto(false);
  };

  const handleConfirmarServico = () => {
    if (!descricaoServico.trim()) {
      notificar('Informe a descrição do serviço.', 'aviso');
      return;
    }
    const valorCentavos = converterReaisParaCentavos(valorServicoReais);
    if (valorCentavos <= 0) {
      notificar('Informe o valor do serviço (R$).', 'aviso');
      return;
    }

    const itemMontado: ItemOS = {
      id: itemEmEdicao ? itemEmEdicao.id : gerarId(),
      tipo: 'servico',
      referenciaId: itemEmEdicao ? itemEmEdicao.referenciaId : `manual-srv-${Date.now()}`,
      descricao: descricaoServico.trim(),
      quantidade: Math.max(1, Number(quantidade) || 1),
      valorUnitarioCentavos: valorCentavos,
      custoUnitarioCentavos: 0,
      descontoCentavos: itemEmEdicao ? itemEmEdicao.descontoCentavos : 0,
      manual: true,
      modeloAparelho: modeloCompletoFormatado || undefined,
    };

    if (itemEmEdicao && aoSalvarEdicao) {
      aoSalvarEdicao(itemMontado);
      notificar(`Serviço "${itemMontado.descricao}" atualizado!`, 'sucesso');
    } else {
      aoAdicionarItem(itemMontado);
      notificar(`Serviço "${itemMontado.descricao}" adicionado na OS!`, 'sucesso');
    }

    setValorServicoReais('');
    setQuantidade(1);
    setPainelAberto(false);
  };

  if (desabilitado) {
    return null;
  }

  // Estado Recolhido (Limpo e Direto): apenas os botões de ação rápida
  if (!painelAberto) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/90">
        <button
          type="button"
          onClick={() => {
            setModo('peca');
            setPainelAberto(true);
          }}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-2 shadow-2xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <Cpu className="w-4 h-4" />
          <span>Adicionar Peça no Aparelho</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setModo('servico');
            setPainelAberto(true);
          }}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4 text-sky-600" />
          <Wrench className="w-4 h-4 text-sky-600" />
          <span>Adicionar Mão de Obra / Serviço</span>
        </button>

        <span className="text-[11px] text-slate-500 ml-auto hidden sm:inline">
          Toque para abrir o lançador — fecha automaticamente após adicionar
        </span>
      </div>
    );
  }

  // Estado Expandido (Aberto apenas durante a adição ou edição da peça/serviço)
  return (
    <div
      className={`rounded-2xl border-2 p-4 space-y-3.5 transition-all shadow-sm ${
        itemEmEdicao
          ? 'border-amber-400 bg-amber-50/40'
          : 'border-sky-300 bg-sky-50/40'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          {itemEmEdicao ? (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editando Item Vinculado ao Aparelho</span>
            </span>
          ) : (
            <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setModo('peca')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  modo === 'peca'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Peça do Aparelho</span>
              </button>
              <button
                type="button"
                onClick={() => setModo('servico')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  modo === 'servico'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Serviço / Mão de Obra</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={fecharPainel}
          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold flex items-center gap-1"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          <span>Fechar Painel</span>
          <X className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>

      {modo === 'peca' ? (
        <div className="space-y-3">
          {/* 1. O que foi trocado? */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              1. Peça trocada:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_PECA_RAPIDOS.map((tipo) => {
                const ativo = pecaSelecionada === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => selecionarTipoPeca(tipo)}
                    className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                      ativo
                        ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-sky-400'
                    }`}
                  >
                    {ativo && <Check className="w-3.5 h-3.5" />}
                    <span>{tipo}</span>
                  </button>
                );
              })}
            </div>
            {pecaSelecionada === 'Outra Peça' && (
              <input
                type="text"
                value={outraPecaTexto}
                onChange={(e) => setOutraPecaTexto(e.target.value)}
                placeholder="Digite qual peça foi trocada (ex.: Subplaca, Sensor Biometria)..."
                className="mt-2 w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />
            )}
          </div>

          {/* 2. Qualidade e Aro na mesma linha */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                2. Qualidade:
              </label>
              <div className="flex flex-wrap gap-1">
                {QUALIDADES_PECA.map((qual) => {
                  const ativo = qualidadePeca === qual;
                  return (
                    <button
                      key={qual}
                      type="button"
                      onClick={() => setQualidadePeca(qual)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        ativo
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {qual}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                3. Aro:
              </label>
              <div className="flex flex-wrap gap-1">
                {OPCOES_ARO.map((op) => {
                  const ativo = aroPeca === op.valor;
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => setAroPeca(op.valor)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        ativo
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {op.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Seleção de Marca e Modelo */}
          <SeletorMarcaModelo
            marca={marcaAparelho}
            modelo={modeloAparelho}
            onChange={(novaMarca, novoModelo) => {
              setMarcaAparelho(novaMarca);
              setModeloAparelho(novoModelo);
            }}
            labelMarca="4. Marca do Aparelho"
            labelModelo="5. Modelo Vinculado (+ Novo Modelo no fim da lista)"
            compacto
          />

          {/* 6. Valor Manual + Custo + Quantidade + Botão Confirmar */}
          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end pt-1">
            <div className="col-span-1 sm:col-span-4">
              <label className="block text-xs font-bold text-emerald-800 mb-1">
                Valor Cobrado (R$) *
              </label>
              <input
                type="text"
                autoFocus
                value={valorCobradoReais}
                onChange={(e) => setValorCobradoReais(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmarPeca();
                  }
                }}
                placeholder="Ex.: 240,00"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border-2 border-emerald-400 text-sm font-extrabold bg-white text-slate-900"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Custo (R$)
              </label>
              <input
                type="text"
                value={custoPecaReais}
                onChange={(e) => setCustoPecaReais(e.target.value)}
                placeholder="Opcional"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-700"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Qtd
              </label>
              <input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-center font-bold"
              />
            </div>

            <div className="col-span-1 sm:col-span-4">
              <button
                type="button"
                onClick={handleConfirmarPeca}
                className={`w-full min-h-[42px] px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs ${
                  itemEmEdicao
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {itemEmEdicao ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alteração</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar e Fechar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-white/80 border border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600">
            <span>
              Resumo: <strong className="text-slate-900">{descricaoPreview}</strong>
            </span>
            {converterReaisParaCentavos(valorCobradoReais) > 0 && (
              <strong className="text-emerald-700">
                {formatarMoeda(converterReaisParaCentavos(valorCobradoReais))}
              </strong>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              'Mão de Obra — Substituição de Tela',
              'Mão de Obra — Troca de Bateria',
              'Mão de Obra — Troca de Conector de Carga',
              'Desoxidação / Banho Químico',
              'Reparo em Placa Lógica',
              'Formatação / Software',
            ].map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setDescricaoServico(sug)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  descricaoServico === sug
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {sug}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-6">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Descrição do Serviço / Mão de Obra *
              </label>
              <input
                type="text"
                value={descricaoServico}
                onChange={(e) => setDescricaoServico(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-emerald-800 mb-1">
                Valor do Serviço (R$) *
              </label>
              <input
                type="text"
                autoFocus
                value={valorServicoReais}
                onChange={(e) => setValorServicoReais(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmarServico();
                  }
                }}
                placeholder="Ex.: 80,00"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border-2 border-emerald-400 text-sm font-extrabold bg-white"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleConfirmarServico}
                className={`w-full min-h-[42px] px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs ${
                  itemEmEdicao
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {itemEmEdicao ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Serviço</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Adicionar e Fechar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
