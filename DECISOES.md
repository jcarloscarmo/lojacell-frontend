# Registro de Decisões Técnicas e de Produto (`DECISOES.md`)

Este documento registra as decisões tomadas durante a construção do sistema **SH LojaCell** sempre que o PRD permitiu escolha ou exigiu detalhamento técnico adicional.

---

## 1. Ambiente Principal: Tablet Android com Mouse, Teclado e Impressora USB (Seções 3, 10 e 11)

- **Decisão:** Otimizar toda a interface simultaneamente para **toque em tela de Tablet Android** (botões e áreas clicáveis com `min-h-[44px]` a `min-h-[54px]`, `touch-action: manipulation` para eliminar atraso de 300ms no toque, menu lateral recolhível no modo paisagem e barra inferior fixa no modo retrato) e para **operação com teclado, mouse e leitor de código de barras USB via hub OTG** (`Ctrl+K` para busca global instantânea, `Alt+N` para Nova OS, `Alt+V` para PDV Balcão, `Ctrl+S` para salvar OS).
- **Captura de Fotos da Bancada:** Na Etapa 3 da Nova OS, o input de imagem utiliza `accept="image/*" capture="environment"` convertendo para `base64`, permitindo tirar foto do estado físico do aparelho direto com a câmera traseira do tablet Android ou anexar arquivo.
- **PWA Instalável:** Configurado `manifest.webmanifest` e Service Worker (`sw.js`) para permitir instalar o sistema na tela inicial do tablet Android em modo `standalone` (tela cheia) e funcionar offline sobre os dados locais.

## 2. Persistência e Isolamento da Camada de Dados (Seções 6, 7 e 12)

- **Decisão:** Criada a camada de repositórios assíncronos em `src/repositories/interfaces.ts` e `src/repositories/localStorageRepo.ts` (`clienteRepo`, `aparelhoRepo`, `osRepo`, `produtoRepo`, `servicoRepo`, `fornecedorRepo`, `vendaRepo`, `financeiroRepo`, `configRepo`). Nenhuma tela acessa `localStorage` diretamente.
- **Valores Monetários:** Todos os valores financeiros são armazenados estritamente em **centavos (inteiros)** (`totalCentavos`, `custoCentavos`, `precoVendaCentavos`, `valorCentavos`) para evitar erros de arredondamento de ponto flutuante.
- **Integridade Referencial:** Clientes e produtos que já possuem vínculo com Ordens de Serviço ou Vendas não podem ser excluídos fisicamente, sendo apenas inativados.

## 3. Regras de Negócio da Ordem de Serviço e Estoque (Seção 8)

- **Fluxo em Página Única (< 60 segundos):** A tela `/os/nova` reúne as 4 etapas (Cliente, Aparelho, Defeito/Checklist e Peças/Serviços) na mesma página, permitindo cadastrar um cliente novo em modal rápido ou criar marca/modelo/aparelho novos inline sem perder nada do que já foi digitado.
- **Baixa e Estorno de Estoque:** Peças adicionadas em uma OS têm seu estoque baixado automaticamente quando a OS entra em `"Aprovada / Em reparo"` (ou na entrega, caso tenha ido direto). Se a OS for `"Cancelada"` após a baixa, o sistema solicita confirmação e estorna as peças para o estoque registrando no extrato.
- **Pagamento Parcial na Entrega:** Ao entregar uma OS cujo valor pago no ato seja menor que o total, a diferença gera automaticamente um título pendente em **Contas a Receber** vinculado ao cliente.

## 4. Estratégia de Impressão Térmica no Android (Seção 11)

- **Camada 1 (Base Garantida):** Área dedicada `#thermal-print-area` formatada com `@media print`, fonte monoespaçada, QR Code SVG (`qrcode.react`) e largura selecionável (**58 mm** ou **80 mm**), compatível nativamente com o serviço de impressão do Android e apps de ponte USB/OTG como **RawBT**.
- **Camada 2 (WebUSB Direto):** Suporte a pareamento e envio de comandos ESC/POS via `navigator.usb`, com fallback automático e transparente para a Camada 1 caso o Android bloqueie o acesso direto à interface USB Printer.
