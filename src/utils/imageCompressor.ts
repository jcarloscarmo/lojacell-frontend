import { getSupabaseClient } from '@/lib/supabaseClient';
import { gerarId } from './formatters';

export interface ResultadoProcessamentoImagem {
  urlOuBase64: string;
  armazenadoNoStorage: boolean;
  tamanhoBytes: number;
}

/**
 * Redimensiona e comprime imagens de câmera (4K/8MB) para HD (máx 1280px, WebP/JPEG qualidade 0.78),
 * reduzindo o peso em ~98% (para ~60KB-90KB) sem perder nitidez para vistoria de OS.
 * Se o Supabase Storage (bucket 'os-fotos') estiver ativo, faz o upload no Storage de 1GB
 * e retorna apenas a URL pública (economizando 100% dos 500MB do banco de dados).
 */
export async function processarEEnviarImagemOS(
  file: File,
  maxLargura = 1280,
  qualidade = 0.78
): Promise<ResultadoProcessamentoImagem> {
  const { blob, dataUrl } = await comprimirArquivoImagem(file, maxLargura, qualidade);

  const supabase = getSupabaseClient();
  if (supabase && blob) {
    try {
      const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const dataPasta = new Date().toISOString().slice(0, 7); // Ex: 2026-10
      const nomeArquivo = `${dataPasta}/${gerarId()}.${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from('os-fotos')
        .upload(nomeArquivo, blob, {
          contentType: blob.type,
          cacheControl: '31536000',
          upsert: false,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('os-fotos')
          .getPublicUrl(nomeArquivo);

        if (publicUrlData?.publicUrl) {
          return {
            urlOuBase64: publicUrlData.publicUrl,
            armazenadoNoStorage: true,
            tamanhoBytes: blob.size,
          };
        }
      }
    } catch {
      // Fallback silencioso para Base64 já comprimido (~70KB) caso sem internet ou bucket ainda não criado
    }
  }

  return {
    urlOuBase64: dataUrl,
    armazenadoNoStorage: false,
    tamanhoBytes: blob ? blob.size : Math.round(dataUrl.length * 0.75),
  };
}

function comprimirArquivoImagem(
  file: File,
  maxDimensao: number,
  qualidade: number
): Promise<{ blob: Blob | null; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const dataUrlOriginal = reader.result as string;
      // Em ambiente de teste (jsdom) onde Image/Canvas pode não renderizar pixels reais, retorna fallback
      if (typeof document === 'undefined') {
        resolve({ blob: null, dataUrl: dataUrlOriginal });
        return;
      }

      const img = new Image();
      img.onerror = () => resolve({ blob: null, dataUrl: dataUrlOriginal });
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimensao || height > maxDimensao) {
            if (width >= height) {
              height = Math.round((height * maxDimensao) / width);
              width = maxDimensao;
            } else {
              width = Math.round((width * maxDimensao) / height);
              height = maxDimensao;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ blob: null, dataUrl: dataUrlOriginal });
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Tenta WebP primeiro (menor tamanho e melhor qualidade); se o navegador não suportar, usa JPEG
          let mimeType = 'image/webp';
          let comprimidaDataUrl = canvas.toDataURL(mimeType, qualidade);
          if (!comprimidaDataUrl.startsWith('data:image/webp')) {
            mimeType = 'image/jpeg';
            comprimidaDataUrl = canvas.toDataURL(mimeType, qualidade);
          }

          canvas.toBlob(
            (geradoBlob) => {
              resolve({
                blob: geradoBlob,
                dataUrl: comprimidaDataUrl,
              });
            },
            mimeType,
            qualidade
          );
        } catch {
          resolve({ blob: null, dataUrl: dataUrlOriginal });
        }
      };
      img.src = dataUrlOriginal;
    };
    reader.readAsDataURL(file);
  });
}
