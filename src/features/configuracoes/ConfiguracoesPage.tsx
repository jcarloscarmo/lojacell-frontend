import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store,
  Printer,
  Download,
  Upload,
  RotateCcw,
  Save,
  Usb,
  CheckCircle2,
  AlertCircle,
  FileText,
  Smartphone,
  Users,
  Plus,
  Trash2,
  Edit3,
  Clock,
  ShieldCheck,
  Cloud,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { configRepo, sincronizarComSupabase } from '@/repositories/localStorageRepo';
import {
  obterConfigSupabase,
  salvarConfigSupabaseLocal,
} from '@/lib/supabaseClient';
import { useAuth } from '@/features/auth/AuthContext';
import { ConfiguracoesLoja, BackupCompleto } from '@/types/domain';
import { useToast } from '@/components/ui/Toast';
import {
  aplicarMascaraCep,
  aplicarMascaraCpfCnpj,
  aplicarMascaraTelefone,
  formatarDataHora,
} from '@/utils/formatters';

export const ConfiguracoesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => configRepo.obterConfiguracoes(),
  });

  const { data: backupsAutomaticos = [] } = useQuery({
    queryKey: ['backupsAutomaticos'],
    queryFn: () => configRepo.listarBackupsAutomaticos(),
  });

  const [form, setForm] = useState<ConfiguracoesLoja | null>(null);
  const [novoTecnicoNome, setNovoTecnicoNome] = useState('');
  const [tecnicoEditandoIdx, setTecnicoEditandoIdx] = useState<number | null>(null);
  const [tecnicoEditandoTexto, setTecnicoEditandoTexto] = useState('');
  const [statusWebUsb, setStatusWebUsb] = useState<string>('Não conectada (usando impressão do sistema/RawBT)');
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [mostrarTesteImpressao, setMostrarTesteImpressao] = useState(false);

  // Estado de Conexão Supabase e Login
  const { alterarCredenciaisLocais, obterUsuarioAtualConfigurado } = useAuth();
  const cfgSupabaseInicial = obterConfigSupabase();
  const [supabaseUrl, setSupabaseUrl] = useState(cfgSupabaseInicial?.url || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(cfgSupabaseInicial?.anonKey || '');
  const [sincronizandoNuvem, setSincronizandoNuvem] = useState(false);
  const [novoLoginUsuario, setNovoLoginUsuario] = useState(() => obterUsuarioAtualConfigurado());
  const [novaLoginSenha, setNovaLoginSenha] = useState('');

  React.useEffect(() => {
    if (config && !form) {
      setForm(structuredClone(config));
      if (config.impressoraUsbAutorizada) {
        setStatusWebUsb(`Autorizada: ${config.impressoraUsbAutorizada.nomeDispositivo}`);
      }
    }
  }, [config, form]);

  const salvarMutation = useMutation({
    mutationFn: (dados: Partial<ConfiguracoesLoja>) => configRepo.salvarConfiguracoes(dados),
    onSuccess: (atualizado) => {
      setForm(structuredClone(atualizado));
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      notificar('Configurações da loja salvas com sucesso!', 'sucesso');
    },
  });

  const handleAdicionarTecnico = () => {
    if (!form) return;
    const nome = novoTecnicoNome.trim();
    if (!nome) {
      notificar('Digite o nome do técnico para cadastrar.', 'aviso');
      return;
    }
    if (form.tecnicosAtivos.some((t) => t.toLowerCase() === nome.toLowerCase())) {
      notificar('Este técnico já está cadastrado na lista de ativos.', 'aviso');
      return;
    }
    const novaLista = [...form.tecnicosAtivos, nome];
    const atualizado = { ...form, tecnicosAtivos: novaLista };
    setForm(atualizado);
    setNovoTecnicoNome('');
    salvarMutation.mutate({ tecnicosAtivos: novaLista });
  };

  const handleRemoverTecnico = (nomeTecnico: string) => {
    if (!form) return;
    const novaLista = form.tecnicosAtivos.filter((t) => t !== nomeTecnico);
    const atualizado = { ...form, tecnicosAtivos: novaLista };
    setForm(atualizado);
    salvarMutation.mutate({ tecnicosAtivos: novaLista });
  };

  const handleSalvarEdicaoTecnico = (idx: number) => {
    if (!form) return;
    const limpo = tecnicoEditandoTexto.trim();
    if (!limpo) return;
    const novaLista = form.tecnicosAtivos.map((t, i) => (i === idx ? limpo : t));
    const atualizado = { ...form, tecnicosAtivos: novaLista };
    setForm(atualizado);
    setTecnicoEditandoIdx(null);
    setTecnicoEditandoTexto('');
    salvarMutation.mutate({ tecnicosAtivos: novaLista });
  };

  const handleConectarUsb = async () => {
    const nav = navigator as unknown as {
      usb?: {
        requestDevice: (opts: { filters: unknown[] }) => Promise<{
          vendorId: number;
          productId: number;
          productName?: string;
          open: () => Promise<void>;
        }>;
      };
    };

    if (!nav.usb) {
      notificar(
        'WebUSB não disponível neste navegador.',
        'aviso',
        'No tablet Android, use o Google Chrome em HTTPS/localhost ou imprima via Camada 1 (RawBT/Sistema).'
      );
      return;
    }

    try {
      const device = await nav.usb.requestDevice({ filters: [] });
      const info = {
        vendorId: device.vendorId,
        productId: device.productId,
        nomeDispositivo: device.productName || `Impressora USB (${device.vendorId}:${device.productId})`,
      };
      setStatusWebUsb(`Conectada: ${info.nomeDispositivo}`);
      if (form) {
        const novo = { ...form, impressoraUsbAutorizada: info };
        setForm(novo);
        salvarMutation.mutate(novo);
      }
      notificar(`Impressora ${info.nomeDispositivo} vinculada com sucesso!`, 'sucesso');
    } catch (err) {
      notificar(
        'Nenhum dispositivo USB selecionado.',
        'info',
        'A Camada 1 (impressão padrão do navegador/RawBT) continua ativa normalmente.'
      );
    }
  };

  const handleExportarBackup = async () => {
    const backup = await configRepo.exportarBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dataStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `shlojacell-backup-${dataStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notificar('Backup JSON exportado com sucesso!', 'sucesso');
  };

  const handleImportarBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const json = JSON.parse(texto) as BackupCompleto;
      await configRepo.importarBackup(json);
      queryClient.invalidateQueries();
      const novaConfig = await configRepo.obterConfiguracoes();
      setForm(structuredClone(novaConfig));
      notificar('Backup restaurado com sucesso!', 'sucesso');
    } catch (err) {
      notificar(
        'Erro ao importar arquivo de backup.',
        'erro',
        err instanceof Error ? err.message : 'Verifique se o arquivo JSON é válido.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetarSeed = async () => {
    await configRepo.resetarDadosSeed();
    queryClient.invalidateQueries();
    const novaConfig = await configRepo.obterConfiguracoes();
    setForm(structuredClone(novaConfig));
    setConfirmarReset(false);
    notificar('Dados de exemplo restaurados para o estado inicial!', 'sucesso');
  };

  if (isLoading || !form) {
    return <div className="p-8 text-center text-slate-500">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Configurações do Sistema e Impressora</h2>
          <p className="text-sm text-slate-500">
            Dados da assistência técnica, bobina térmica (58/80 mm), termos de garantia e backup
          </p>
        </div>
        <button
          type="button"
          onClick={() => salvarMutation.mutate(form)}
          disabled={salvarMutation.isPending}
          className="min-h-[48px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Alterações</span>
        </button>
      </div>

      {/* Dados da Assistência Técnica */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Store className="w-5 h-5 text-sky-600" />
          <h3 className="font-bold text-slate-900">1. Identificação da Assistência Técnica</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Fantasia da Loja *
            </label>
            <input
              type="text"
              value={form.nomeLoja}
              onChange={(e) => setForm({ ...form, nomeLoja: e.target.value })}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ</label>
            <input
              type="text"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: aplicarMascaraCpfCnpj(e.target.value) })}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Fixo</label>
            <input
              type="text"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: aplicarMascaraTelefone(e.target.value) })}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp de Atendimento</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: aplicarMascaraTelefone(e.target.value) })}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">CEP</label>
            <input
              type="text"
              value={form.endereco.cep}
              onChange={(e) =>
                setForm({
                  ...form,
                  endereco: { ...form.endereco, cep: aplicarMascaraCep(e.target.value) },
                })
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Rua / Avenida</label>
            <input
              type="text"
              value={form.endereco.rua}
              onChange={(e) =>
                setForm({ ...form, endereco: { ...form.endereco, rua: e.target.value } })
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Número / Compl.</label>
            <input
              type="text"
              value={form.endereco.numero}
              onChange={(e) =>
                setForm({ ...form, endereco: { ...form.endereco, numero: e.target.value } })
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bairro</label>
            <input
              type="text"
              value={form.endereco.bairro}
              onChange={(e) =>
                setForm({ ...form, endereco: { ...form.endereco, bairro: e.target.value } })
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade / UF</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.endereco.cidade}
                onChange={(e) =>
                  setForm({ ...form, endereco: { ...form.endereco, cidade: e.target.value } })
                }
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                maxLength={2}
                value={form.endereco.uf}
                onChange={(e) =>
                  setForm({
                    ...form,
                    endereco: { ...form.endereco, uf: e.target.value.toUpperCase() },
                  })
                }
                className="w-16 min-h-[44px] px-2.5 py-2 rounded-xl border border-slate-300 text-sm text-center uppercase"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Equipe Técnica — Cadastro de Técnicos Ativos */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="font-bold text-slate-900">
                Equipe Técnica — Técnicos Ativos ({form.tecnicosAtivos.length})
              </h3>
              <p className="text-xs text-slate-500">
                Cadastre, edite ou remova os técnicos que aparecem para vínculo nas Ordens de Serviço
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={novoTecnicoNome}
            onChange={(e) => setNovoTecnicoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdicionarTecnico();
              }
            }}
            placeholder="Digite o nome do novo técnico (ex.: Lucas — Microsoldagem)..."
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
          />
          <button
            type="button"
            onClick={handleAdicionarTecnico}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Técnico</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {form.tecnicosAtivos.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Nenhum técnico ativo cadastrado. Adicione acima!
            </div>
          ) : (
            form.tecnicosAtivos.map((tec, idx) => (
              <div
                key={`${tec}-${idx}`}
                className="px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50"
              >
                {tecnicoEditandoIdx === idx ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={tecnicoEditandoTexto}
                      onChange={(e) => setTecnicoEditandoTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSalvarEdicaoTecnico(idx);
                        }
                      }}
                      className="flex-1 min-h-[38px] px-3 py-1 rounded-lg border border-sky-400 text-sm font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => handleSalvarEdicaoTecnico(idx)}
                      className="min-h-[38px] px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setTecnicoEditandoIdx(null)}
                      className="min-h-[38px] px-3 py-1 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="font-bold text-sm text-slate-900">{tec}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTecnicoEditandoIdx(idx);
                          setTecnicoEditandoTexto(tec);
                        }}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoverTecnico(tec)}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Impressora Térmica USB no Tablet Android */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Printer className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="font-bold text-slate-900">
                2. Impressora Térmica de Bobina (Tablet Android via OTG / USB)
              </h3>
              <p className="text-xs text-slate-500">
                Suporte em camadas: Camada 1 (Navegador / RawBT Android) e Camada 2 (WebUSB ESC/POS direto)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Largura da Bobina Térmica
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[58, 80].map((mm) => (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => setForm({ ...form, larguraPapelMm: mm as 58 | 80 })}
                    className={`min-h-[48px] px-4 py-2.5 rounded-xl font-semibold text-sm border flex items-center justify-center gap-2 transition-all ${
                      form.larguraPapelMm === mm
                        ? 'bg-sky-50 border-sky-600 text-sky-800 ring-2 ring-sky-500/20'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Bobina {mm} mm</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-sky-600" /> Status da Conexão USB:
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Pronta p/ Imprimir
                </span>
              </div>
              <p className="text-xs text-slate-600">{statusWebUsb}</p>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConectarUsb}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-2"
                >
                  <Usb className="w-4 h-4" />
                  <span>Conectar Impressora USB (WebUSB)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarTesteImpressao(!mostrarTesteImpressao)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Página de Teste</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pré-visualização de Página de Teste na Bobina */}
          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-500 mb-2">
              Pré-visualização da Bobina ({form.larguraPapelMm} mm)
            </span>
            <div
              id="thermal-print-area"
              className={`bg-white text-black font-mono text-xs p-4 shadow-md border border-slate-300 ${
                form.larguraPapelMm === 58 ? 'w-[220px]' : 'w-[300px]'
              }`}
            >
              <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                <p className="font-bold text-sm uppercase">{form.nomeLoja}</p>
                <p className="text-[10px]">CNPJ: {form.cnpj}</p>
                <p className="text-[10px]">WhatsApp: {form.whatsapp}</p>
              </div>
              <p className="text-center font-bold my-2">*** TESTE DE IMPRESSÃO ***</p>
              <p className="text-[11px]">Dispositivo: Tablet Android USB/OTG</p>
              <p className="text-[11px]">Largura configurada: {form.larguraPapelMm} mm</p>
              <p className="text-[11px]">Data: {new Date().toLocaleString('pt-BR')}</p>
              <div className="border-t border-dashed border-black mt-2 pt-2 text-center text-[10px]">
                <p>{form.rodapeComprovante}</p>
              </div>
            </div>
            {mostrarTesteImpressao && (
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Enviar para Impressora Agora</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Termos de Garantia e Comprovante */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <FileText className="w-5 h-5 text-sky-600" />
          <h3 className="font-bold text-slate-900">3. Termos de Garantia, LGPD e Rodapé do Comprovante</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Prazo de Garantia Padrão de OS (dias)
            </label>
            <input
              type="number"
              value={form.garantiaPadraoOSDias}
              onChange={(e) =>
                setForm({ ...form, garantiaPadraoOSDias: Number(e.target.value) || 90 })
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Frase de Rodapé da Bobina
            </label>
            <input
              type="text"
              value={form.rodapeComprovante}
              onChange={(e) => setForm({ ...form, rodapeComprovante: e.target.value })}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Termos de Garantia Impressos na OS
            </label>
            <textarea
              rows={4}
              value={form.termosGarantiaPadrao}
              onChange={(e) => setForm({ ...form, termosGarantiaPadrao: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Texto de Consentimento LGPD no Comprovante
            </label>
            <textarea
              rows={2}
              value={form.textoConsentimentoLgpd}
              onChange={(e) => setForm({ ...form, textoConsentimentoLgpd: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Backup Automático a Cada Hora (Horário Comercial) + Backup Manual JSON */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900">
                4. Backup Automático a Cada Hora (Horário Comercial) e Restauração
              </h3>
              <p className="text-xs text-slate-500">
                O sistema gera pontos de restauração automaticamente a cada hora dentro do horário comercial configurado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await configRepo.criarPontoBackupAutomatico('Ponto Criado Manualmente');
              queryClient.invalidateQueries({ queryKey: ['backupsAutomaticos'] });
              queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
              notificar('Ponto de backup criado agora com sucesso!', 'sucesso');
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
          >
            <Clock className="w-4 h-4" />
            <span>Criar Ponto de Backup Agora</span>
          </button>
        </div>

        {/* Configurações do Agendamento de Backup Automático */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <label className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.backupAutomaticoAtivo !== false}
                onChange={(e) => {
                  const atualizado = { ...form, backupAutomaticoAtivo: e.target.checked };
                  setForm(atualizado);
                  salvarMutation.mutate({ backupAutomaticoAtivo: e.target.checked });
                }}
                className="w-4 h-4 rounded text-emerald-600"
              />
              <span>Ativar Backup Automático</span>
            </label>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Frequência do Backup
              </label>
              <select
                value={form.backupIntervaloMinutos || 60}
                onChange={(e) => {
                  const val = Number(e.target.value) || 60;
                  setForm({ ...form, backupIntervaloMinutos: val });
                  salvarMutation.mutate({ backupIntervaloMinutos: val });
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value={30}>A cada 30 minutos</option>
                <option value={60}>A cada 1 hora (60 min — Padrão)</option>
                <option value={120}>A cada 2 horas (120 min)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Início do Horário Comercial
              </label>
              <input
                type="time"
                value={form.horarioComercialInicio || '08:00'}
                onChange={(e) => {
                  setForm({ ...form, horarioComercialInicio: e.target.value });
                  salvarMutation.mutate({ horarioComercialInicio: e.target.value });
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fim do Horário Comercial
              </label>
              <input
                type="time"
                value={form.horarioComercialFim || '19:00'}
                onChange={(e) => {
                  setForm({ ...form, horarioComercialFim: e.target.value });
                  salvarMutation.mutate({ horarioComercialFim: e.target.value });
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200/80 text-xs">
            <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.backupApenasHorarioComercial !== false}
                onChange={(e) => {
                  setForm({ ...form, backupApenasHorarioComercial: e.target.checked });
                  salvarMutation.mutate({ backupApenasHorarioComercial: e.target.checked });
                }}
                className="w-4 h-4 rounded text-sky-600"
              />
              <span>Executar apenas dentro do horário comercial ({form.horarioComercialInicio || '08:00'} às {form.horarioComercialFim || '19:00'})</span>
            </label>

            <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form.backupDownloadAutomatico}
                onChange={(e) => {
                  setForm({ ...form, backupDownloadAutomatico: e.target.checked });
                  salvarMutation.mutate({ backupDownloadAutomatico: e.target.checked });
                }}
                className="w-4 h-4 rounded text-sky-600"
              />
              <span>Baixar arquivo .JSON automaticamente no aparelho a cada ciclo</span>
            </label>
          </div>
        </div>

        {/* Lista dos Pontos de Backup Automático de Hora em Hora */}
        {backupsAutomaticos.length > 0 && (
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase text-slate-500">
              Últimos Pontos de Backup Salvos Automaticamente ({backupsAutomaticos.length})
            </span>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
              {backupsAutomaticos.map((ponto) => (
                <div
                  key={ponto.id}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-slate-50"
                >
                  <div>
                    <span className="font-bold text-slate-900">
                      {formatarDataHora(ponto.criadoEm)}
                    </span>
                    <span className="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                      {ponto.motivo}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {ponto.resumo.qtdOS} OS • {ponto.resumo.qtdClientes} clientes •{' '}
                      {ponto.resumo.qtdProdutos} produtos • {ponto.resumo.qtdVendas} vendas
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(ponto.dados, null, 2)], {
                          type: 'application/json',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `backup-ponto-${ponto.criadoEm.slice(0, 16).replace(':', 'h')}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          window.confirm(
                            `Deseja restaurar o sistema para o backup de ${formatarDataHora(ponto.criadoEm)}?`
                          )
                        ) {
                          await configRepo.restaurarPontoBackupAutomatico(ponto.id);
                          queryClient.invalidateQueries();
                          notificar('Sistema restaurado a partir do ponto de backup!', 'sucesso');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold"
                    >
                      Restaurar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleExportarBackup}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Backup Completo (.JSON)</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportarBackup}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Backup (.JSON)</span>
          </button>

          {!confirmarReset ? (
            <button
              type="button"
              onClick={() => setConfirmarReset(true)}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-sm flex items-center gap-2 ml-auto"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Resetar Dados de Exemplo (Seed)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 ml-auto bg-rose-50 p-2 rounded-xl border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-xs font-semibold text-rose-800">
                Confirmar restauração de fábrica?
              </span>
              <button
                type="button"
                onClick={handleResetarSeed}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
              >
                Sim, Resetar
              </button>
              <button
                type="button"
                onClick={() => setConfirmarReset(false)}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 text-xs font-semibold border"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Seção: Banco em Nuvem (Supabase) e Credenciais de Acesso */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Cloud className="w-5 h-5 text-sky-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Sincronização em Nuvem (Supabase) e Login de Acesso
            </h2>
            <p className="text-xs text-slate-500">
              Sincronize PC, Celular e Tablet em tempo real + compressão automática de fotos de OS (~70 KB no Supabase Storage).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bloco 1: Conexão Supabase */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-sky-600" />
              Conexão com o Projeto Supabase
            </h3>
            <p className="text-xs text-slate-600">
              Você pode definir <code className="bg-slate-200 px-1 rounded">VITE_SUPABASE_URL</code> e{' '}
              <code className="bg-slate-200 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> na Vercel ou colar abaixo:
            </p>

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project URL (Supabase)
                </label>
                <input
                  type="url"
                  placeholder="https://seu-projeto.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  API Key (anon / public)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={sincronizandoNuvem}
                onClick={async () => {
                  salvarConfigSupabaseLocal({ url: supabaseUrl, anonKey: supabaseAnonKey });
                  if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
                    notificar('Configuração local do Supabase removida.', 'info');
                    return;
                  }
                  setSincronizandoNuvem(true);
                  const res = await sincronizarComSupabase();
                  setSincronizandoNuvem(false);
                  if (res.conectado) {
                    queryClient.invalidateQueries();
                    notificar(res.mensagem, 'sucesso');
                  } else {
                    notificar(res.mensagem, 'erro');
                  }
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${sincronizandoNuvem ? 'animate-spin' : ''}`} />
                <span>{sincronizandoNuvem ? 'Sincronizando...' : 'Salvar e Sincronizar Nuvem'}</span>
              </button>
            </div>
          </div>

          {/* Bloco 2: Credenciais de Login do Sistema */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              Login de Acesso do Sistema
            </h3>
            <p className="text-xs text-slate-600">
              Padrão configurado: usuário <strong className="text-slate-900">admin</strong> e senha{' '}
              <strong className="text-slate-900">203089!@</strong>. Se desejar alterar futuramente:
            </p>

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Usuário de Login
                </label>
                <input
                  type="text"
                  value={novoLoginUsuario}
                  onChange={(e) => setNovoLoginUsuario(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nova Senha (deixe em branco para manter a atual)
                </label>
                <input
                  type="password"
                  placeholder="Nova senha de acesso"
                  value={novaLoginSenha}
                  onChange={(e) => setNovaLoginSenha(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!novoLoginUsuario.trim()) {
                    notificar('Informe um nome de usuário válido.', 'aviso');
                    return;
                  }
                  alterarCredenciaisLocais(
                    novoLoginUsuario.trim(),
                    novaLoginSenha || '203089!@'
                  );
                  setNovaLoginSenha('');
                  notificar('Credenciais de acesso atualizadas com sucesso!', 'sucesso');
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Atualizar Login / Senha</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
