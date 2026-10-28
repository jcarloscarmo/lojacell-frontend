import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Wrench,
  User,
  Smartphone,
  Package,
  X,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';
import {
  clienteRepo,
  aparelhoRepo,
  osRepo,
  produtoRepo,
} from '@/repositories/localStorageRepo';
import { formatarMoeda, formatarNumeroOS } from '@/utils/formatters';

interface GlobalSearchModalProps {
  aberto: boolean;
  aoFechar: () => void;
}

interface ResultadoBusca {
  id: string;
  tipo: 'os' | 'cliente' | 'aparelho' | 'produto';
  titulo: string;
  subtitulo: string;
  rota: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ aberto, aoFechar }) => {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (aberto) {
      setTermo('');
      setIndiceSelecionado(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [aberto]);

  useEffect(() => {
    let ativo = true;
    async function executarBusca() {
      const q = termo.trim().toLowerCase();
      if (!q) {
        setResultados([]);
        return;
      }

      const [clientes, aparelhos, ordens, produtos] = await Promise.all([
        clienteRepo.listar(),
        aparelhoRepo.listar(),
        osRepo.listar(),
        produtoRepo.listar(),
      ]);

      if (!ativo) return;

      const mapaClientes = new Map(clientes.map((c) => [c.id, c]));
      const mapaAparelhos = new Map(aparelhos.map((a) => [a.id, a]));

      const lista: ResultadoBusca[] = [];

      // Buscar OS por número, cliente, aparelho ou defeito
      for (const os of ordens) {
        const numFormatado = formatarNumeroOS(os.numero);
        const cli = mapaClientes.get(os.clienteId);
        const apa = mapaAparelhos.get(os.aparelhoId);
        if (
          numFormatado.includes(q) ||
          String(os.numero).includes(q) ||
          cli?.nome.toLowerCase().includes(q) ||
          cli?.telefone.includes(q) ||
          apa?.modelo.toLowerCase().includes(q) ||
          apa?.imeiSerial?.toLowerCase().includes(q) ||
          os.defeitoRelatado.toLowerCase().includes(q)
        ) {
          lista.push({
            id: `os-${os.id}`,
            tipo: 'os',
            titulo: `OS #${numFormatado} — ${cli?.nome || 'Cliente'}`,
            subtitulo: `${apa ? `${apa.marca} ${apa.modelo}` : ''} • ${os.defeitoRelatado.slice(0, 60)}`,
            rota: `/os?abrir=${os.id}`,
          });
        }
      }

      // Buscar Clientes
      for (const c of clientes) {
        if (
          c.nome.toLowerCase().includes(q) ||
          c.telefone.includes(q) ||
          c.cpfCnpj?.includes(q)
        ) {
          lista.push({
            id: `cli-${c.id}`,
            tipo: 'cliente',
            titulo: c.nome,
            subtitulo: `Tel: ${c.telefone} ${c.cpfCnpj ? `• Doc: ${c.cpfCnpj}` : ''}`,
            rota: `/clientes?clienteId=${c.id}`,
          });
        }
      }

      // Buscar Aparelhos (IMEI/Modelo)
      for (const a of aparelhos) {
        if (
          a.imeiSerial?.toLowerCase().includes(q) ||
          a.modelo.toLowerCase().includes(q) ||
          a.marca.toLowerCase().includes(q)
        ) {
          const dono = mapaClientes.get(a.clienteId);
          lista.push({
            id: `apa-${a.id}`,
            tipo: 'aparelho',
            titulo: `${a.marca} ${a.modelo} ${a.cor ? `(${a.cor})` : ''}`,
            subtitulo: `IMEI/Serial: ${a.imeiSerial || 'N/I'} • Cliente: ${dono?.nome || '—'}`,
            rota: `/clientes?clienteId=${a.clienteId}`,
          });
        }
      }

      // Buscar Produtos
      for (const p of produtos) {
        if (
          p.descricao.toLowerCase().includes(q) ||
          p.codigo.toLowerCase().includes(q) ||
          p.codigoDeBarras?.includes(q)
        ) {
          lista.push({
            id: `prod-${p.id}`,
            tipo: 'produto',
            titulo: `${p.codigo} — ${p.descricao}`,
            subtitulo: `${formatarMoeda(p.precoVendaCentavos)} • Estoque: ${p.estoqueAtual} ${p.unidade}`,
            rota: `/produtos?produtoId=${p.id}`,
          });
        }
      }

      setResultados(lista.slice(0, 12));
      setIndiceSelecionado(0);
    }

    executarBusca();
    return () => {
      ativo = false;
    };
  }, [termo]);

  if (!aberto) return null;

  const selecionarItem = (item: ResultadoBusca) => {
    aoFechar();
    navigate(item.rota);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceSelecionado((prev) => (prev + 1) % Math.max(resultados.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceSelecionado((prev) =>
        prev - 1 < 0 ? Math.max(resultados.length - 1, 0) : prev - 1
      );
    } else if (e.key === 'Enter' && resultados[indiceSelecionado]) {
      e.preventDefault();
      selecionarItem(resultados[indiceSelecionado]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      aoFechar();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-12 px-4"
      onClick={aoFechar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200">
          <Search className="w-5 h-5 text-sky-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar OS (nº), cliente, telefone, CPF, IMEI, peça ou código de barras..."
            className="w-full text-base text-slate-900 placeholder:text-slate-400 bg-transparent border-none focus:ring-0"
          />
          <button
            type="button"
            onClick={aoFechar}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {!termo.trim() ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Digite o número da OS, nome ou telefone do cliente, IMEI do aparelho ou nome da peça.
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                  ↑↓ Navegar
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                  Enter Abrir
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                  Esc Fechar
                </span>
              </div>
            </div>
          ) : resultados.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Nenhum resultado encontrado para <strong>"{termo}"</strong>.
            </div>
          ) : (
            resultados.map((item, idx) => {
              const ativo = idx === indiceSelecionado;
              const Icone = {
                os: Wrench,
                cliente: User,
                aparelho: Smartphone,
                produto: Package,
              }[item.tipo];

              const badgeCor = {
                os: 'bg-sky-100 text-sky-800',
                cliente: 'bg-emerald-100 text-emerald-800',
                aparelho: 'bg-purple-100 text-purple-800',
                produto: 'bg-amber-100 text-amber-800',
              }[item.tipo];

              const badgeTexto = {
                os: 'Ordem de Serviço',
                cliente: 'Cliente',
                aparelho: 'Aparelho / IMEI',
                produto: 'Estoque',
              }[item.tipo];

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selecionarItem(item)}
                  onMouseEnter={() => setIndiceSelecionado(idx)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 text-left transition-colors ${
                    ativo ? 'bg-sky-50/90' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${badgeCor}`}>
                    <Icone className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 truncate">{item.titulo}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${badgeCor}`}>
                        {badgeTexto}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitulo}</p>
                  </div>
                  <div className="text-slate-400 shrink-0">
                    {ativo ? <CornerDownLeft className="w-4 h-4 text-sky-600" /> : <ArrowRight className="w-4 h-4" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
