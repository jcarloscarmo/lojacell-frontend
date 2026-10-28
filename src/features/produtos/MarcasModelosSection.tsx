import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone,
  Tag,
  Plus,
  Edit3,
  Trash2,
  Search,
  X,
  Save,
  Filter,
} from 'lucide-react';
import { aparelhoRepo } from '@/repositories/localStorageRepo';
import { useToast } from '@/components/ui/Toast';

export const MarcasModelosSection: React.FC = () => {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const [subAba, setSubAba] = useState<'modelos' | 'marcas'>('modelos');
  const [marcaSelecionadaFiltro, setMarcaSelecionadaFiltro] = useState<string>('todas');
  const [busca, setBusca] = useState('');

  // Modal de Marca (igual ao BrandModal do lojacell-frontend)
  const [modalMarcaAberto, setModalMarcaAberto] = useState(false);
  const [marcaEditandoOriginal, setMarcaEditandoOriginal] = useState<string | null>(null);
  const [nomeMarcaForm, setNomeMarcaForm] = useState('');

  // Modal de Modelo (igual ao DeviceModelModal do lojacell-frontend)
  const [modalModeloAberto, setModalModeloAberto] = useState(false);
  const [modeloEditandoOriginal, setModeloEditandoOriginal] = useState<{
    marca: string;
    modelo: string;
  } | null>(null);
  const [marcaModeloForm, setMarcaModeloForm] = useState('');
  const [nomeModeloForm, setNomeModeloForm] = useState('');

  const { data: catalogoMarcas = [] } = useQuery({
    queryKey: ['catalogoMarcas'],
    queryFn: () => aparelhoRepo.listarCatalogoMarcas(),
  });

  // Mutations de Marca
  const salvarMarcaMutation = useMutation({
    mutationFn: async () => {
      const nomeLimpo = nomeMarcaForm.trim();
      if (!nomeLimpo) throw new Error('Informe o nome da marca.');
      if (marcaEditandoOriginal) {
        return aparelhoRepo.editarMarca(marcaEditandoOriginal, nomeLimpo);
      }
      return aparelhoRepo.adicionarMarcaModelo(nomeLimpo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogoMarcas'] });
      queryClient.invalidateQueries({ queryKey: ['aparelhos'] });
      setModalMarcaAberto(false);
      notificar(
        marcaEditandoOriginal ? 'Marca atualizada com sucesso!' : 'Nova marca cadastrada!',
        'sucesso'
      );
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao salvar marca', 'erro');
    },
  });

  const excluirMarcaMutation = useMutation({
    mutationFn: (marca: string) => aparelhoRepo.removerMarca(marca),
    onSuccess: (_, marcaRemovida) => {
      queryClient.invalidateQueries({ queryKey: ['catalogoMarcas'] });
      if (marcaSelecionadaFiltro === marcaRemovida) {
        setMarcaSelecionadaFiltro('todas');
      }
      notificar('Marca excluída com sucesso!', 'info');
    },
  });

  // Mutations de Modelo
  const salvarModeloMutation = useMutation({
    mutationFn: async () => {
      const marcaLimpa = marcaModeloForm.trim();
      const modeloLimpo = nomeModeloForm.trim();
      if (!marcaLimpa) throw new Error('Selecione uma marca.');
      if (!modeloLimpo) throw new Error('Informe o nome do modelo.');

      if (modeloEditandoOriginal) {
        return aparelhoRepo.editarModelo(
          modeloEditandoOriginal.marca,
          modeloEditandoOriginal.modelo,
          modeloLimpo,
          marcaLimpa
        );
      }
      return aparelhoRepo.adicionarMarcaModelo(marcaLimpa, modeloLimpo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogoMarcas'] });
      queryClient.invalidateQueries({ queryKey: ['aparelhos'] });
      setModalModeloAberto(false);
      notificar(
        modeloEditandoOriginal
          ? 'Modelo de aparelho atualizado!'
          : 'Novo modelo de aparelho cadastrado!',
        'sucesso'
      );
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao salvar modelo', 'erro');
    },
  });

  const excluirModeloMutation = useMutation({
    mutationFn: ({ marca, modelo }: { marca: string; modelo: string }) =>
      aparelhoRepo.removerModelo(marca, modelo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogoMarcas'] });
      notificar('Modelo excluído com sucesso!', 'info');
    },
  });

  // Abrir modais
  const abrirNovaMarca = () => {
    setMarcaEditandoOriginal(null);
    setNomeMarcaForm('');
    setModalMarcaAberto(true);
  };

  const abrirEditarMarca = (marca: string) => {
    setMarcaEditandoOriginal(marca);
    setNomeMarcaForm(marca);
    setModalMarcaAberto(true);
  };

  const abrirNovoModelo = () => {
    setModeloEditandoOriginal(null);
    const marcaPadrao =
      marcaSelecionadaFiltro !== 'todas'
        ? marcaSelecionadaFiltro
        : catalogoMarcas[0]?.marca || 'Samsung';
    setMarcaModeloForm(marcaPadrao);
    setNomeModeloForm('');
    setModalModeloAberto(true);
  };

  const abrirEditarModelo = (marca: string, modelo: string) => {
    setModeloEditandoOriginal({ marca, modelo });
    setMarcaModeloForm(marca);
    setNomeModeloForm(modelo);
    setModalModeloAberto(true);
  };

  // Listas filtradas
  const marcasFiltradas = catalogoMarcas.filter((item) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (
      item.marca.toLowerCase().includes(q) ||
      item.modelos.some((m) => m.toLowerCase().includes(q))
    );
  });

  const todosModelosPlanos = catalogoMarcas.flatMap((cat) =>
    cat.modelos.map((modelo) => ({
      marca: cat.marca,
      modelo,
    }))
  );

  const modelosFiltrados = todosModelosPlanos.filter((item) => {
    if (marcaSelecionadaFiltro !== 'todas' && item.marca !== marcaSelecionadaFiltro) {
      return false;
    }
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (
      item.modelo.toLowerCase().includes(q) || item.marca.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Barra de Controle de Marcas e Modelos */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubAba('modelos')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              subAba === 'modelos'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Modelos de Aparelhos ({todosModelosPlanos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubAba('marcas')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              subAba === 'marcas'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Marcas ({catalogoMarcas.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={abrirNovaMarca}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-sm font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Marca</span>
          </button>

          <button
            type="button"
            onClick={abrirNovoModelo}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Modelo</span>
          </button>
        </div>
      </div>

      {/* Filtros (Busca + Filtro por Marca na visão de Modelos) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {subAba === 'modelos' && (
          <div className="flex items-center gap-2 min-w-[240px]">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={marcaSelecionadaFiltro}
              onChange={(e) => {
                if (e.target.value === '__nova_marca__') {
                  abrirNovaMarca();
                  return;
                }
                setMarcaSelecionadaFiltro(e.target.value);
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white text-slate-800"
            >
              <option value="todas">Todas as Marcas ({catalogoMarcas.length})</option>
              {catalogoMarcas.map((cat) => (
                <option key={cat.marca} value={cat.marca}>
                  {cat.marca} ({cat.modelos.length} modelos)
                </option>
              ))}
              <option value="__nova_marca__">+ Nova Marca...</option>
            </select>
          </div>
        )}

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              subAba === 'modelos'
                ? 'Buscar modelo ou marca (ex.: Galaxy A14, iPhone 13, Redmi Note 12)...'
                : 'Buscar marca cadastrada...'
            }
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
          />
        </div>
      </div>

      {/* SUB-ABA 1: MODELOS DE APARELHOS (DeviceModelListPage) */}
      {subAba === 'modelos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4 w-20">#</th>
                <th className="py-3.5 px-4">Nome do Modelo</th>
                <th className="py-3.5 px-4">Marca</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {modelosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Nenhum modelo encontrado para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                modelosFiltrados.map((item, index) => (
                  <tr key={`${item.marca}-${item.modelo}`} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">
                      {String(index + 1).padStart(3, '0')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.modelo}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {item.marca}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirEditarModelo(item.marca, item.modelo)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Tem certeza que deseja excluir o modelo "${item.modelo}" da marca "${item.marca}"?`
                              )
                            ) {
                              excluirModeloMutation.mutate({
                                marca: item.marca,
                                modelo: item.modelo,
                              });
                            }
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Botão "+ Novo Modelo" no fim da lista */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              onClick={abrirNovoModelo}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 hover:bg-sky-100 text-sky-700 text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>
                Novo Modelo{' '}
                {marcaSelecionadaFiltro !== 'todas' ? `(${marcaSelecionadaFiltro})` : ''}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-ABA 2: MARCAS DE APARELHOS (BrandListPage) */}
      {subAba === 'marcas' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4 w-20">#</th>
                <th className="py-3.5 px-4">Nome da Marca</th>
                <th className="py-3.5 px-4">Modelos Cadastrados</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {marcasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Nenhuma marca encontrada.
                  </td>
                </tr>
              ) : (
                marcasFiltradas.map((cat, index) => (
                  <tr key={cat.marca} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{cat.marca}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                          {cat.modelos.length} modelos
                        </span>
                        <span className="text-xs text-slate-500 truncate max-w-md">
                          {cat.modelos.slice(0, 5).join(', ')}
                          {cat.modelos.length > 5 ? '...' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setMarcaSelecionadaFiltro(cat.marca);
                            setSubAba('modelos');
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold"
                        >
                          Ver Modelos
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEditarMarca(cat.marca)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Tem certeza que deseja excluir a marca "${cat.marca}" e seus ${cat.modelos.length} modelos do catálogo?`
                              )
                            ) {
                              excluirMarcaMutation.mutate(cat.marca);
                            }
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Botão "+ Nova Marca" no fim da lista */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              onClick={abrirNovaMarca}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 hover:bg-sky-100 text-sky-700 text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Marca</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Marca (BrandModal) */}
      {modalMarcaAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">
                {marcaEditandoOriginal ? 'Editar Marca' : 'Adicionar Nova Marca'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMarcaAberto(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                salvarMarcaMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Marca *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nomeMarcaForm}
                  onChange={(e) => setNomeMarcaForm(e.target.value)}
                  placeholder="Ex.: Samsung, Apple, Motorola, Xiaomi, Realme..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMarcaAberto(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvarMarcaMutation.isPending}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Marca</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Modelo de Aparelho (DeviceModelModal) */}
      {modalModeloAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">
                {modeloEditandoOriginal
                  ? 'Editar Modelo de Aparelho'
                  : 'Adicionar Novo Modelo de Aparelho'}
              </h3>
              <button
                type="button"
                onClick={() => setModalModeloAberto(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                salvarModeloMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Marca *
                </label>
                <select
                  required
                  value={marcaModeloForm}
                  onChange={(e) => setMarcaModeloForm(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                >
                  <option value="" disabled>
                    Selecione uma marca
                  </option>
                  {catalogoMarcas.map((cat) => (
                    <option key={cat.marca} value={cat.marca}>
                      {cat.marca}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Modelo *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nomeModeloForm}
                  onChange={(e) => setNomeModeloForm(e.target.value)}
                  placeholder="Ex.: Galaxy A14 5G, iPhone 13 Pro Max, Moto G54..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalModeloAberto(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvarModeloMutation.isPending}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Modelo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
