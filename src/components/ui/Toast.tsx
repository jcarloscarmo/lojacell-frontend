import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastTipo = 'sucesso' | 'erro' | 'aviso' | 'info';

interface ToastItem {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: ToastTipo;
}

interface ToastContextData {
  notificar: (titulo: string, tipo?: ToastTipo, descricao?: string) => void;
}

const ToastContext = createContext<ToastContextData>({
  notificar: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removerToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notificar = useCallback(
    (titulo: string, tipo: ToastTipo = 'sucesso', descricao?: string) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, titulo, descricao, tipo }]);
      setTimeout(() => {
        removerToast(id);
      }, 4000);
    },
    [removerToast]
  );

  return (
    <ToastContext.Provider value={{ notificar }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          const estilos = {
            sucesso: 'bg-emerald-900 border-emerald-700 text-white',
            erro: 'bg-rose-900 border-rose-700 text-white',
            aviso: 'bg-amber-900 border-amber-700 text-white',
            info: 'bg-slate-900 border-slate-700 text-white',
          }[t.tipo];

          const Icone = {
            sucesso: CheckCircle2,
            erro: XCircle,
            aviso: AlertTriangle,
            info: Info,
          }[t.tipo];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl transition-all ${estilos}`}
              role="alert"
            >
              <Icone className="w-5 h-5 shrink-0 mt-0.5 opacity-90" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">{t.titulo}</p>
                {t.descricao && <p className="opacity-90 mt-0.5 text-xs">{t.descricao}</p>}
              </div>
              <button
                type="button"
                onClick={() => removerToast(t.id)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
