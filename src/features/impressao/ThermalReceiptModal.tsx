import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Usb, X } from 'lucide-react';
import {
  OrdemServico,
  Cliente,
  Aparelho,
  ConfiguracoesLoja,
  Venda,
  SessaoCaixa,
} from '@/types/domain';
import {
  formatarMoeda,
  formatarDataHora,
  formatarData,
  formatarNumeroOS,
} from '@/utils/formatters';
import { STATUS_OS_LABELS } from '@/features/dashboard/DashboardPage';
import { useToast } from '@/components/ui/Toast';

export type TipoDocumentoTermico =
  | 'entrada_os'
  | 'orcamento_os'
  | 'entrega_garantia_os'
  | 'recibo_venda'
  | 'fechamento_caixa';

interface ThermalReceiptModalProps {
  aberto: boolean;
  aoFechar: () => void;
  tipo: TipoDocumentoTermico;
  config: ConfiguracoesLoja;
  os?: OrdemServico;
  cliente?: Cliente;
  aparelho?: Aparelho;
  venda?: Venda;
  sessaoCaixa?: SessaoCaixa;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  aberto,
  aoFechar,
  tipo,
  config,
  os,
  cliente,
  aparelho,
  venda,
  sessaoCaixa,
}) => {
  const { notificar } = useToast();

  if (!aberto) return null;

  const larguraMm = config.larguraPapelMm || 80;

  const handleImprimirNavegador = () => {
    window.print();
  };

  // Camada 2: Envio ESC/POS via WebUSB com fallback automático para Camada 1
  const handleImprimirEscPosUsb = async () => {
    const nav = navigator as unknown as {
      usb?: {
        getDevices: () => Promise<
          Array<{
            open: () => Promise<void>;
            selectConfiguration: (c: number) => Promise<void>;
            claimInterface: (i: number) => Promise<void>;
            transferOut: (endpoint: number, data: BufferSource) => Promise<unknown>;
          }>
        >;
      };
    };

    if (!nav.usb) {
      notificar(
        'WebUSB indisponível neste modo. Abrindo impressão padrão do sistema (Camada 1)...',
        'info'
      );
      window.print();
      return;
    }

    try {
      const devices = await nav.usb.getDevices();
      if (!devices || devices.length === 0) {
        notificar(
          'Nenhuma impressora USB pareada. Usando impressão do navegador/RawBT (Camada 1)...',
          'info'
        );
        window.print();
        return;
      }

      const device = devices[0];
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      const encoder = new TextEncoder();
      const textoRecibo =
        `\x1B\x40` + // Init ESC/POS
        `${config.nomeLoja}\n` +
        `CNPJ: ${config.cnpj}\n` +
        `--------------------------------\n` +
        (os ? `OS #${formatarNumeroOS(os.numero)}\nDefeito: ${os.defeitoRelatado}\n` : '') +
        `Total: ${formatarMoeda(os?.totalCentavos || venda?.totalCentavos || 0)}\n\n\n` +
        `\x1D\x56\x00`; // Cut paper

      await device.transferOut(1, encoder.encode(textoRecibo));
      notificar('Comprovante enviado direto para a impressora USB!', 'sucesso');
    } catch {
      notificar(
        'Acesso direto USB ocupado pelo Android. Redirecionando para Camada 1 (Navegador/RawBT)...',
        'aviso'
      );
      window.print();
    }
  };

  const tituloDoc = {
    entrada_os: 'COMPROVANTE DE ENTRADA DE OS',
    orcamento_os: 'ORÇAMENTO SEM COMPROMISSO',
    entrega_garantia_os: 'TERMO DE ENTREGA E GARANTIA',
    recibo_venda: 'RECIBO DE VENDA DE BALCÃO',
    fechamento_caixa: 'RELATÓRIO DE FECHAMENTO DE CAIXA',
  }[tipo];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-8">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-sm">Pré-visualização de Impressão Térmica</h3>
              <p className="text-[11px] text-slate-400">Bobina configurada: {larguraMm} mm</p>
            </div>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Área da Bobina Térmica */}
        <div className="p-6 bg-slate-100 max-h-[70vh] overflow-y-auto flex justify-center">
          <div
            id="thermal-print-area"
            className={`bg-white text-black font-mono text-[11px] leading-snug p-4 shadow-md border border-slate-300 ${
              larguraMm === 58 ? 'w-[225px]' : 'w-[310px]'
            }`}
          >
            {/* Cabeçalho da Loja */}
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
              <p className="font-bold text-xs uppercase">{config.nomeLoja}</p>
              <p>CNPJ: {config.cnpj}</p>
              <p>
                {config.endereco.rua}, {config.endereco.numero} - {config.endereco.bairro}
              </p>
              <p>WhatsApp: {config.whatsapp}</p>
            </div>

            <p className="text-center font-bold uppercase py-1 border-b border-dashed border-black mb-2">
              {tituloDoc}
            </p>

            {/* Conteúdo de OS */}
            {os && (
              <div className="space-y-1.5">
                <div className="flex justify-between font-bold text-xs">
                  <span>OS Nº: {formatarNumeroOS(os.numero)}</span>
                  <span>{os.prioridade === 'urgente' ? '[URGENTE]' : ''}</span>
                </div>
                <p>Entrada: {formatarDataHora(os.dataEntrada)}</p>
                {os.previsaoEntrega && <p>Previsão: {formatarData(os.previsaoEntrega)}</p>}
                <p>Status: {STATUS_OS_LABELS[os.status].label}</p>

                <div className="border-t border-dashed border-black pt-1.5 mt-1.5">
                  <p className="font-bold">CLIENTE:</p>
                  <p>{cliente?.nome || 'Consumidor'}</p>
                  <p>Tel: {cliente?.telefone}</p>
                  {cliente?.cpfCnpj && <p>CPF/CNPJ: {cliente.cpfCnpj}</p>}
                </div>

                <div className="border-t border-dashed border-black pt-1.5 mt-1.5">
                  <p className="font-bold">APARELHO:</p>
                  <p>
                    {aparelho?.marca} {aparelho?.modelo} {aparelho?.cor ? `(${aparelho.cor})` : ''}
                  </p>
                  <p>IMEI/Serial: {aparelho?.imeiSerial || 'Não informado'}</p>
                  {aparelho && (
                    <p>
                      Acessórios:{' '}
                      {[
                        aparelho.acessorios.capa && 'Capa',
                        aparelho.acessorios.chip && 'Chip',
                        aparelho.acessorios.bandejaChip && 'Bandeja',
                        aparelho.acessorios.cartaoMemoria && 'SD',
                        aparelho.acessorios.carregador && 'Carregador',
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Nenhum'}
                    </p>
                  )}
                </div>

                <div className="border-t border-dashed border-black pt-1.5 mt-1.5">
                  <p className="font-bold">DEFEITO RELATADO:</p>
                  <p>{os.defeitoRelatado}</p>
                  {os.condicoesFisicas && <p>Cond. Físicas: {os.condicoesFisicas}</p>}
                </div>

                {os.laudoTecnico && (
                  <div className="border-t border-dashed border-black pt-1.5 mt-1.5">
                    <p className="font-bold">LAUDO / SOLUÇÃO:</p>
                    <p>{os.laudoTecnico}</p>
                    {os.solucaoAplicada && <p>Solução: {os.solucaoAplicada}</p>}
                  </div>
                )}

                {os.itens.length > 0 && (
                  <div className="border-t border-dashed border-black pt-1.5 mt-1.5">
                    <p className="font-bold mb-1">ITENS E SERVIÇOS:</p>
                    {os.itens.map((item) => (
                      <div key={item.id} className="flex justify-between gap-1">
                        <span className="truncate">
                          {item.quantidade}x {item.descricao}
                        </span>
                        <span className="shrink-0">
                          {formatarMoeda(item.quantidade * item.valorUnitarioCentavos)}
                        </span>
                      </div>
                    ))}
                    {os.descontoCentavos > 0 && (
                      <div className="flex justify-between">
                        <span>Desconto:</span>
                        <span>-{formatarMoeda(os.descontoCentavos)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-xs border-t border-black pt-1 mt-1">
                      <span>TOTAL:</span>
                      <span>{formatarMoeda(os.totalCentavos)}</span>
                    </div>
                  </div>
                )}

                {tipo === 'entrega_garantia_os' && (
                  <div className="border-t border-dashed border-black pt-1.5 mt-1.5">
                    <p className="font-bold">
                      GARANTIA: {os.garantiaDias} dias (Válida até{' '}
                      {formatarData(os.fimGarantiaEm)})
                    </p>
                  </div>
                )}

                {/* Termos e LGPD */}
                <div className="border-t border-dashed border-black pt-1.5 mt-1.5 text-[9px] space-y-1">
                  <p className="font-bold">TERMOS E CONDIÇÕES:</p>
                  <p className="whitespace-pre-line">
                    {os.termosGarantia || config.termosGarantiaPadrao}
                  </p>
                  <p className="pt-1 italic">{config.textoConsentimentoLgpd}</p>
                </div>

                {/* Assinatura e QR Code */}
                <div className="pt-6 text-center space-y-2">
                  <div className="border-t border-black pt-1">
                    <p>Assinatura do Cliente</p>
                    <p className="text-[10px]">{cliente?.nome}</p>
                  </div>
                  <div className="flex justify-center py-2">
                    <QRCodeSVG
                      value={`SHLOJACELL-OS-${formatarNumeroOS(os.numero)}`}
                      size={76}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo de Venda de Balcão */}
            {venda && (
              <div className="space-y-1.5">
                <p className="font-bold">VENDA Nº: {formatarNumeroOS(venda.numero)}</p>
                <p>Data: {formatarDataHora(venda.data)}</p>
                <p>Cliente: {cliente?.nome || 'Consumidor Final'}</p>
                <div className="border-t border-dashed border-black pt-1.5 mt-1.5">
                  {venda.itens.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="truncate">
                        {item.quantidade}x {item.descricao}
                      </span>
                      <span>{formatarMoeda(item.quantidade * item.valorUnitarioCentavos)}</span>
                    </div>
                  ))}
                  {venda.descontoCentavos > 0 && (
                    <div className="flex justify-between">
                      <span>Desconto:</span>
                      <span>-{formatarMoeda(venda.descontoCentavos)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xs border-t border-black pt-1 mt-1">
                    <span>TOTAL PAGO:</span>
                    <span>{formatarMoeda(venda.totalCentavos)}</span>
                  </div>
                  {venda.trocoCentavos > 0 && (
                    <div className="flex justify-between">
                      <span>Troco:</span>
                      <span>{formatarMoeda(venda.trocoCentavos)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conteúdo de Fechamento de Caixa */}
            {sessaoCaixa && (
              <div className="space-y-1.5">
                <p>Abertura: {formatarDataHora(sessaoCaixa.aberturaData)}</p>
                <p>Fechamento: {formatarDataHora(sessaoCaixa.fechamentoData)}</p>
                <p>Troco Inicial: {formatarMoeda(sessaoCaixa.valorInicialCentavos)}</p>
                <div className="border-t border-dashed border-black pt-1.5 mt-1.5">
                  <p className="font-bold">MOVIMENTOS ({sessaoCaixa.movimentos.length}):</p>
                  {sessaoCaixa.movimentos.map((m) => (
                    <div key={m.id} className="flex justify-between">
                      <span className="truncate">{m.descricao}</span>
                      <span>{formatarMoeda(m.valorCentavos)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-black pt-1 mt-1 font-bold">
                  <p>Esperado: {formatarMoeda(sessaoCaixa.saldoEsperadoCentavos || 0)}</p>
                  <p>Contado: {formatarMoeda(sessaoCaixa.valorContadoCentavos || 0)}</p>
                  <p>Diferença: {formatarMoeda(sessaoCaixa.diferencaCentavos || 0)}</p>
                </div>
              </div>
            )}

            <div className="border-t border-dashed border-black mt-3 pt-2 text-center text-[10px]">
              <p>{config.rodapeComprovante}</p>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImprimirEscPosUsb}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Usb className="w-4 h-4" />
              <span>USB Direto (ESC/POS)</span>
            </button>

            <button
              type="button"
              onClick={handleImprimirNavegador}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir (Navegador / RawBT)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
