import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ConfiguracoesPage } from '@/features/configuracoes/ConfiguracoesPage';
import { ClientesPage } from '@/features/clientes/ClientesPage';
import { ProdutosServicosPage } from '@/features/produtos/ProdutosServicosPage';
import { NovaOSPage } from '@/features/os/NovaOSPage';
import { OrdensServicoPage } from '@/features/os/OrdensServicoPage';
import { VendasPage } from '@/features/vendas/VendasPage';
import { FinanceiroPage } from '@/features/financeiro/FinanceiroPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,
      refetchOnWindowFocus: false,
    },
  },
});

const RotasProtegidas: React.FC = () => {
  const { sessao } = useAuth();

  if (!sessao) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/produtos" element={<ProdutosServicosPage />} />
          <Route path="/os/nova" element={<NovaOSPage />} />
          <Route path="/os" element={<OrdensServicoPage />} />
          <Route path="/vendas" element={<VendasPage />} />
          <Route path="/financeiro" element={<FinanceiroPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RotasProtegidas />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
