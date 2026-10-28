import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

const AUTH_SESSION_KEY = 'shlojacell_auth_session_v1';
const AUTH_CRED_KEY = 'shlojacell_auth_credentials_v1';

const USUARIO_PADRAO = 'admin';
const SENHA_PADRAO = '203089!@';

export interface UsuarioSessao {
  usuario: string;
  nomeExibicao: string;
  autenticadoEm: string;
  modo: 'credencial_loja' | 'supabase_auth';
}

interface CredenciaisLojaSalvas {
  usuario: string;
  senha: string;
}

interface AuthContextValue {
  sessao: UsuarioSessao | null;
  carregandoAuth: boolean;
  entrar: (
    usuarioOuEmail: string,
    senha: string,
    manterConectado?: boolean
  ) => Promise<{ sucesso: boolean; erro?: string }>;
  sair: () => Promise<void>;
  alterarCredenciaisLocais: (novoUsuario: string, novaSenha: string) => void;
  obterUsuarioAtualConfigurado: () => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function lerCredenciaisConfiguradas(): CredenciaisLojaSalvas {
  try {
    const raw = localStorage.getItem(AUTH_CRED_KEY);
    if (!raw) {
      return { usuario: USUARIO_PADRAO, senha: SENHA_PADRAO };
    }
    const parsed = JSON.parse(raw) as Partial<CredenciaisLojaSalvas>;
    return {
      usuario: parsed.usuario?.trim() || USUARIO_PADRAO,
      senha: parsed.senha || SENHA_PADRAO,
    };
  } catch {
    return { usuario: USUARIO_PADRAO, senha: SENHA_PADRAO };
  }
}

function lerSessaoSalva(): UsuarioSessao | null {
  try {
    const rawLocal = localStorage.getItem(AUTH_SESSION_KEY);
    const rawSession = sessionStorage.getItem(AUTH_SESSION_KEY);
    const raw = rawLocal || rawSession;
    if (!raw) return null;
    return JSON.parse(raw) as UsuarioSessao;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessao, setSessao] = useState<UsuarioSessao | null>(() => lerSessaoSalva());
  const [carregandoAuth, setCarregandoAuth] = useState<boolean>(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user && !lerSessaoSalva()) {
        const novaSessao: UsuarioSessao = {
          usuario: data.session.user.email || 'admin',
          nomeExibicao: 'Administrador (Supabase)',
          autenticadoEm: new Date().toISOString(),
          modo: 'supabase_auth',
        };
        setSessao(novaSessao);
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(novaSessao));
      }
    });
  }, []);

  const salvarSessaoStorage = (novaSessao: UsuarioSessao, manterConectado: boolean) => {
    setSessao(novaSessao);
    if (manterConectado) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(novaSessao));
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(novaSessao));
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  };

  const entrar = async (
    usuarioOuEmail: string,
    senha: string,
    manterConectado = true
  ): Promise<{ sucesso: boolean; erro?: string }> => {
    setCarregandoAuth(true);
    try {
      const loginLimpo = usuarioOuEmail.trim();
      const credenciaisLoja = lerCredenciaisConfiguradas();

      // 1. Validação direta com o login padrão da loja (admin / 203089!@ ou customizado)
      const bateUsuarioPadrao =
        loginLimpo.toLowerCase() === credenciaisLoja.usuario.toLowerCase() ||
        (loginLimpo.toLowerCase() === USUARIO_PADRAO && senha === SENHA_PADRAO);

      const bateSenhaPadrao =
        (loginLimpo.toLowerCase() === credenciaisLoja.usuario.toLowerCase() &&
          senha === credenciaisLoja.senha) ||
        (loginLimpo.toLowerCase() === USUARIO_PADRAO && senha === SENHA_PADRAO);

      if (bateUsuarioPadrao && bateSenhaPadrao) {
        const novaSessao: UsuarioSessao = {
          usuario: loginLimpo.toLowerCase(),
          nomeExibicao: loginLimpo.toLowerCase() === 'admin' ? 'Administrador' : loginLimpo,
          autenticadoEm: new Date().toISOString(),
          modo: 'credencial_loja',
        };
        salvarSessaoStorage(novaSessao, manterConectado);
        return { sucesso: true };
      }

      // 2. Se digitou um e-mail e o Supabase estiver configurado, tenta autenticar também no Supabase Auth
      const supabase = getSupabaseClient();
      if (supabase && loginLimpo.includes('@')) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginLimpo,
          password: senha,
        });

        if (!error && data.user) {
          const novaSessao: UsuarioSessao = {
            usuario: data.user.email || loginLimpo,
            nomeExibicao: data.user.email?.split('@')[0] || 'Administrador',
            autenticadoEm: new Date().toISOString(),
            modo: 'supabase_auth',
          };
          salvarSessaoStorage(novaSessao, manterConectado);
          return { sucesso: true };
        }
      }

      return {
        sucesso: false,
        erro: 'Usuário ou senha incorretos. Verifique os dados informados.',
      };
    } finally {
      setCarregandoAuth(false);
    }
  };

  const sair = async () => {
    setSessao(null);
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
  };

  const alterarCredenciaisLocais = (novoUsuario: string, novaSenha: string) => {
    localStorage.setItem(
      AUTH_CRED_KEY,
      JSON.stringify({
        usuario: novoUsuario.trim() || USUARIO_PADRAO,
        senha: novaSenha || SENHA_PADRAO,
      })
    );
  };

  const obterUsuarioAtualConfigurado = () => lerCredenciaisConfiguradas().usuario;

  return (
    <AuthContext.Provider
      value={{
        sessao,
        carregandoAuth,
        entrar,
        sair,
        alterarCredenciaisLocais,
        obterUsuarioAtualConfigurado,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return ctx;
}
