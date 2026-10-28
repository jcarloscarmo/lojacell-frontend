import React, { useState } from 'react';
import {
  Smartphone,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  AlertCircle,
  Cloud,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabaseEstaConfigurado } from '@/lib/supabaseClient';

export const LoginPage: React.FC = () => {
  const { entrar, carregandoAuth } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [manterConectado, setManterConectado] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const nuvemAtiva = supabaseEstaConfigurado();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!usuario.trim() || !senha) {
      setErro('Informe o usuário e a senha para acessar o sistema.');
      return;
    }

    const res = await entrar(usuario, senha, manterConectado);
    if (!res.sucesso) {
      setErro(res.erro || 'Credenciais inválidas.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      {/* Efeito de iluminação sutil no fundo */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10">
        {/* Cabeçalho da Loja */}
        <div className="bg-slate-950 px-6 py-7 text-center border-b border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-sky-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-900/50">
            <Smartphone className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">SH LojaCell</h1>
          <p className="text-xs text-sky-400 font-medium mt-0.5">
            Gestão de Assistência Técnica, OS e PDV
          </p>

          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-300">
            <Cloud className={`w-3.5 h-3.5 ${nuvemAtiva ? 'text-emerald-400' : 'text-sky-400'}`} />
            <span>
              {nuvemAtiva
                ? 'Sincronização Supabase Ativa (PC • Celular • Tablet)'
                : 'Acesso Protegido • PC, Celular e Tablet'}
            </span>
          </div>
        </div>

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {erro && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="login-usuario"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Usuário de Acesso
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-usuario"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="Ex: admin"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-senha"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Senha
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-senha"
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full min-h-[48px] pl-11 pr-12 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={manterConectado}
                onChange={(e) => setManterConectado(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Manter conectado neste aparelho</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={carregandoAuth}
            className="w-full min-h-[52px] rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 transition-all cursor-pointer"
          >
            <LogIn className="w-5 h-5" />
            <span>{carregandoAuth ? 'Autenticando...' : 'Entrar no Sistema'}</span>
          </button>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Ambiente seguro • Acesso restrito à equipe autorizada</span>
          </div>
        </form>
      </div>
    </div>
  );
};
