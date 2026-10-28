-- ============================================================================
-- SH LOJACELL — SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS E IMAGENS (SUPABASE)
-- ============================================================================
-- Como usar:
-- 1. No painel do Supabase, clique em "SQL Editor" no menu lateral esquerdo.
-- 2. Clique em "New query", cole todo este conteúdo e clique em "Run".
-- ============================================================================

-- 1. Tabela principal sincronizada em Tempo Real (PC, Celular e Tablet)
CREATE TABLE IF NOT EXISTS public.shlojacell_store_state (
  id TEXT PRIMARY KEY DEFAULT 'loja_principal',
  dados JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por TEXT DEFAULT 'admin'
);

-- 2. Tabela de Pontos de Backup Automático na Nuvem
CREATE TABLE IF NOT EXISTS public.shlojacell_auto_backups (
  id TEXT PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  motivo TEXT NOT NULL,
  resumo JSONB NOT NULL,
  dados JSONB NOT NULL
);

-- 3. Habilitar Row Level Security (RLS) e Políticas de Acesso da Loja
ALTER TABLE public.shlojacell_store_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shlojacell_auto_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso completo para aplicacao ShLojacell" ON public.shlojacell_store_state;
CREATE POLICY "Acesso completo para aplicacao ShLojacell"
  ON public.shlojacell_store_state
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso completo para backups ShLojacell" ON public.shlojacell_auto_backups;
CREATE POLICY "Acesso completo para backups ShLojacell"
  ON public.shlojacell_auto_backups
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Habilitar Realtime na tabela principal (atualiza PC, Celular e Tablet na hora)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shlojacell_store_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shlojacell_store_state;
  END IF;
END $$;

-- 5. Criar Bucket de Storage separado para Fotos de OS (1 GB Gratuito no Supabase Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('os-fotos', 'os-fotos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Leitura publica de fotos OS" ON storage.objects;
CREATE POLICY "Leitura publica de fotos OS"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'os-fotos');

DROP POLICY IF EXISTS "Upload de fotos OS pela loja" ON storage.objects;
CREATE POLICY "Upload de fotos OS pela loja"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'os-fotos');

DROP POLICY IF EXISTS "Exclusao de fotos OS pela loja" ON storage.objects;
CREATE POLICY "Exclusao de fotos OS pela loja"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'os-fotos');
