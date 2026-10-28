import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Plus,
  Check,
  Search,
  Tag,
  Smartphone,
  X,
} from 'lucide-react';
import { aparelhoRepo } from '@/repositories/localStorageRepo';
import { useToast } from '@/components/ui/Toast';

interface SeletorMarcaModeloProps {
  marca: string;
  modelo: string;
  onChange: (novaMarca: string, novoModelo: string) => void;
  labelMarca?: string;
  labelModelo?: string;
  compacto?: boolean;
  permitirVazio?: boolean;
}

export const SeletorMarcaModelo: React.FC<SeletorMarcaModeloProps> = ({
  marca,
  modelo,
  onChange,
  labelMarca = 'Marca do Aparelho *',
  labelModelo = 'Modelo do Aparelho *',
  compacto = false,
  permitirVazio = false,
}) => {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const [menuMarcaAberto, setMenuMarcaAberto] = useState(false);
  const [menuModeloAberto, setMenuModeloAberto] = useState(false);

  const [buscaMarca, setBuscaMarca] = useState('');
  const [buscaModelo, setBuscaModelo] = useState('');

  const [criandoNovaMarca, setCriandoNovaMarca] = useState(false);
  const [novaMarcaInput, setNovaMarcaInput] = useState('');

  const [criandoNovoModelo, setCriandoNovoModelo] = useState(false);
  const [novoModeloInput, setNovoModeloInput] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputNovaMarcaRef = useRef<HTMLInputElement | null>(null);
  const inputNovoModeloRef = useRef<HTMLInputElement | null>(null);

  const { data: catalogoMarcas = [] } = useQuery({
    queryKey: ['catalogoMarcas'],
    queryFn: () => aparelhoRepo.listarCatalogoMarcas(),
  });

  // Fecha menus ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuMarcaAberto(false);
        setMenuModeloAberto(false);
        setCriandoNovaMarca(false);
        setCriandoNovoModelo(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const marcasFiltradas = catalogoMarcas.filter((cat) =>
    cat.marca.toLowerCase().includes(buscaMarca.toLowerCase().trim())
  );

  const entradaMarcaAtual = catalogoMarcas.find(
    (cat) => cat.marca.toLowerCase() === marca.toLowerCase()
  );

  // Lista de modelos: se houver marca selecionada, mostra os modelos da marca; senão mostra todos
  const modelosDisponiveis: { marca: string; modelo: string }[] = entradaMarcaAtual
    ? entradaMarcaAtual.modelos.map((m) => ({ marca: entradaMarcaAtual.marca, modelo: m }))
    : catalogoMarcas.flatMap((cat) =>
        cat.modelos.map((m) => ({ marca: cat.marca, modelo: m }))
      );

  const modelosFiltrados = modelosDisponiveis.filter(
    (item) =>
      item.modelo.toLowerCase().includes(buscaModelo.toLowerCase().trim()) ||
      item.marca.toLowerCase().includes(buscaModelo.toLowerCase().trim())
  );

  // Mutation para cadastrar nova Marca
  const criarMarcaMutation = useMutation({
    mutationFn: async (nomeMarca: string) => {
      const limpo = nomeMarca.trim();
      if (!limpo) throw new Error('Digite o nome da nova marca.');
      await aparelhoRepo.adicionarMarcaModelo(limpo, '');
      return limpo;
    },
    onSuccess: (marcaCriada) => {
      queryClient.invalidateQueries({ queryKey: ['catalogoMarcas'] });
      onChange(marcaCriada, '');
      setNovaMarcaInput('');
      setCriandoNovaMarca(false);
      setMenuMarcaAberto(false);
      notificar(`Marca "${marcaCriada}" adicionada! Agora selecione ou crie o modelo.`, 'sucesso');
      // Abre automaticamente o seletor de modelo no modo de novo modelo
      setTimeout(() => {
        setMenuModeloAberto(true);
        setCriandoNovoModelo(true);
        setTimeout(() => inputNovoModeloRef.current?.focus(), 50);
      }, 80);
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao criar marca', 'erro');
    },
  });

  // Mutation para cadastrar novo Modelo na marca atual
  const criarModeloMutation = useMutation({
    mutationFn: async (nomeModelo: string) => {
      const limpo = nomeModelo.trim();
      if (!limpo) throw new Error('Digite o nome do novo modelo.');
      const marcaAlvo = marca.trim() || catalogoMarcas[0]?.marca || 'Geral';
      await aparelhoRepo.adicionarMarcaModelo(marcaAlvo, limpo);
      return { marcaAlvo, modeloCriado: limpo };
    },
    onSuccess: ({ marcaAlvo, modeloCriado }) => {
      queryClient.invalidateQueries({ queryKey: ['catalogoMarcas'] });
      onChange(marcaAlvo, modeloCriado);
      setNovoModeloInput('');
      setCriandoNovoModelo(false);
      setMenuModeloAberto(false);
      notificar(`Modelo "${modeloCriado}" cadastrado em ${marcaAlvo} e selecionado!`, 'sucesso');
    },
    onError: (err) => {
      notificar(err instanceof Error ? err.message : 'Erro ao criar modelo', 'erro');
    },
  });

  const alturaBotao = compacto ? 'min-h-[42px] py-1.5 text-xs' : 'min-h-[44px] py-2 text-sm';

  return (
    <div ref={containerRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* COLUNA 1: SELETOR DE MARCA COM BOTÃO "+ NOVA MARCA" NO FIM DA LISTA */}
      <div className="relative">
        <label className="block text-xs font-bold text-slate-700 mb-1">
          {labelMarca}
        </label>
        <button
          type="button"
          onClick={() => {
            setMenuMarcaAberto((prev) => !prev);
            setMenuModeloAberto(false);
            setCriandoNovaMarca(false);
          }}
          className={`w-full ${alturaBotao} px-3 rounded-xl border border-slate-300 bg-white hover:border-sky-500 text-left flex items-center justify-between gap-2 transition-colors`}
        >
          <span className="flex items-center gap-2 truncate">
            <Tag className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className={marca ? 'font-bold text-slate-900' : 'text-slate-400'}>
              {marca || 'Selecione a marca...'}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {menuMarcaAberto && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl border-2 border-slate-200 shadow-2xl overflow-hidden">
            {/* Busca rápida de marca */}
            <div className="p-2 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaMarca}
                  onChange={(e) => setBuscaMarca(e.target.value)}
                  placeholder="Filtrar marca..."
                  className="w-full min-h-[36px] pl-8 pr-3 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
            </div>

            {/* Lista de Marcas */}
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
              {permitirVazio && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('', '');
                    setMenuMarcaAberto(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-slate-500 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>Todas / Não especificar</span>
                </button>
              )}

              {marcasFiltradas.map((cat) => {
                const selecionada = cat.marca.toLowerCase() === marca.toLowerCase();
                return (
                  <button
                    key={cat.marca}
                    type="button"
                    onClick={() => {
                      const primeiroModelo = cat.modelos[0] || '';
                      onChange(cat.marca, primeiroModelo);
                      setMenuMarcaAberto(false);
                      setBuscaMarca('');
                    }}
                    className={`w-full min-h-[42px] px-3.5 py-2.5 text-left text-xs flex items-center justify-between transition-colors ${
                      selecionada
                        ? 'bg-sky-50 text-sky-900 font-bold'
                        : 'text-slate-800 hover:bg-slate-50 font-semibold'
                    }`}
                  >
                    <span>{cat.marca}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {cat.modelos.length} mod.
                      </span>
                      {selecionada && <Check className="w-4 h-4 text-sky-600" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* BOTÃO NO FIM DA LISTA DE MARCAS: "+ Nova Marca" */}
            {!criandoNovaMarca ? (
              <button
                type="button"
                onClick={() => {
                  setCriandoNovaMarca(true);
                  setNovaMarcaInput(buscaMarca.trim());
                  setTimeout(() => inputNovaMarcaRef.current?.focus(), 50);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold text-xs flex items-center justify-center gap-1.5 border-t-2 border-sky-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Novo / Cadastrar Nova Marca</span>
              </button>
            ) : (
              <div className="p-3 bg-sky-50 border-t-2 border-sky-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-sky-900">
                    Cadastrar Nova Marca
                  </span>
                  <button
                    type="button"
                    onClick={() => setCriandoNovaMarca(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    ref={inputNovaMarcaRef}
                    type="text"
                    value={novaMarcaInput}
                    onChange={(e) => setNovaMarcaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        criarMarcaMutation.mutate(novaMarcaInput);
                      }
                    }}
                    placeholder="Ex.: Realme, Infinix..."
                    className="flex-1 min-h-[38px] px-2.5 py-1 rounded-lg border border-sky-300 text-xs bg-white font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => criarMarcaMutation.mutate(novaMarcaInput)}
                    className="min-h-[38px] px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shrink-0"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* COLUNA 2: SELETOR DE MODELO COM BOTÃO "+ NOVO MODELO" NO FIM DA LISTA */}
      <div className="relative">
        <label className="block text-xs font-bold text-slate-700 mb-1">
          {labelModelo}
        </label>
        <button
          type="button"
          onClick={() => {
            setMenuModeloAberto((prev) => !prev);
            setMenuMarcaAberto(false);
            setCriandoNovoModelo(false);
          }}
          className={`w-full ${alturaBotao} px-3 rounded-xl border border-slate-300 bg-white hover:border-sky-500 text-left flex items-center justify-between gap-2 transition-colors`}
        >
          <span className="flex items-center gap-2 truncate">
            <Smartphone className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className={modelo ? 'font-bold text-slate-900' : 'text-slate-400'}>
              {modelo || 'Selecione o modelo...'}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {menuModeloAberto && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl border-2 border-slate-200 shadow-2xl overflow-hidden">
            {/* Busca rápida de modelo */}
            <div className="p-2 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaModelo}
                  onChange={(e) => setBuscaModelo(e.target.value)}
                  placeholder={
                    marca ? `Buscar modelo de ${marca}...` : 'Buscar modelo...'
                  }
                  className="w-full min-h-[36px] pl-8 pr-3 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
            </div>

            {/* Lista de Modelos */}
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
              {modelosFiltrados.length === 0 ? (
                <div className="px-3.5 py-4 text-center text-xs text-slate-400">
                  Nenhum modelo listado com esse filtro. Clique abaixo em{' '}
                  <strong className="text-sky-700">+ Novo Modelo</strong> para cadastrar!
                </div>
              ) : (
                modelosFiltrados.map((item) => {
                  const selecionado =
                    item.modelo.toLowerCase() === modelo.toLowerCase();
                  return (
                    <button
                      key={`${item.marca}-${item.modelo}`}
                      type="button"
                      onClick={() => {
                        onChange(item.marca, item.modelo);
                        setMenuModeloAberto(false);
                        setBuscaModelo('');
                      }}
                      className={`w-full min-h-[42px] px-3.5 py-2.5 text-left text-xs flex items-center justify-between transition-colors ${
                        selecionado
                          ? 'bg-sky-50 text-sky-900 font-bold'
                          : 'text-slate-800 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <div>
                        <span>{item.modelo}</span>
                        {!entradaMarcaAtual && (
                          <span className="ml-1.5 text-[10px] text-slate-400">
                            ({item.marca})
                          </span>
                        )}
                      </div>
                      {selecionado && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* BOTÃO NO FIM DA LISTA DE MODELOS: "+ Novo Modelo" */}
            {!criandoNovoModelo ? (
              <button
                type="button"
                onClick={() => {
                  setCriandoNovoModelo(true);
                  setNovoModeloInput(buscaModelo.trim());
                  setTimeout(() => inputNovoModeloRef.current?.focus(), 50);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold text-xs flex items-center justify-center gap-1.5 border-t-2 border-sky-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>
                  Novo Modelo {marca ? `(${marca})` : ''}
                </span>
              </button>
            ) : (
              <div className="p-3 bg-sky-50 border-t-2 border-sky-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-sky-900">
                    Novo Modelo em {marca || catalogoMarcas[0]?.marca || 'Geral'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCriandoNovoModelo(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    ref={inputNovoModeloRef}
                    type="text"
                    value={novoModeloInput}
                    onChange={(e) => setNovoModeloInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        criarModeloMutation.mutate(novoModeloInput);
                      }
                    }}
                    placeholder="Ex.: Galaxy A14 5G, iPhone 16..."
                    className="flex-1 min-h-[38px] px-2.5 py-1 rounded-lg border border-sky-300 text-xs bg-white font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => criarModeloMutation.mutate(novoModeloInput)}
                    className="min-h-[38px] px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shrink-0"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
