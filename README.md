# SH LojaCell — Sistema de Ordens de Serviço e PDV para Assistência Técnica de Celulares

Aplicação web moderna em **React + TypeScript + Tailwind CSS**, projetada especificamente para operação rápida no balcão usando **Tablet Android (com mouse, teclado e impressora térmica USB via cabo OTG/hub)**, funcionando também em computadores Windows/Mac, iPads e celulares.

---

## 1. Como Rodar o Projeto

Pré-requisito: **Node.js 18+**.

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o servidor de desenvolvimento (também exposto na rede local para o Tablet Android)
npm run dev

# 3. Rodar os testes automatizados dos fluxos críticos
npm test -- --run

# 4. Gerar build de produção
npm run build
```

Ao abrir `http://localhost:5173` (ou o IP da sua rede Wi-Fi mostrado no terminal, ex.: `http://192.168.x.x:5173`, direto no navegador Chrome do seu **tablet Android**), o sistema carrega automaticamente o banco de dados de demonstração (`seedData.ts`) com:
- **15 clientes** e **25 aparelhos** vinculados (com catálogo extensível de marcas e modelos);
- **40 peças e acessórios** e **15 serviços de mão de obra**;
- **20 Ordens de Serviço** distribuídas nos 9 status da bancada;
- **5 vendas de balcão**, movimentações de estoque, contas a pagar/receber e **sessão de caixa aberta**.

---

## 2. Como Usar e Testar a Impressora Térmica USB no Tablet Android

O sistema implementa a arquitetura de impressão térmica em **camadas** para bobinas de **58 mm** e **80 mm**:

### Opção Recomendada no Tablet Android — Camada 1 (Navegador + App RawBT / Serviço de Impressão)
Muitas impressoras térmicas USB de balcão (Elgin, Bematech, Epson, Xprinter, POS-58, POS-80) conectadas via adaptador **OTG / Hub USB** no Android são reivindicadas pelo sistema operacional como classe `USB Printer`.
1. Conecte a impressora térmica USB ao hub OTG do tablet Android.
2. Caso o Android não exiba a impressora nativamente na janela de impressão do Chrome, instale gratuitamente o aplicativo **RawBT Print Service** na Google Play Store e ative-o como *Serviço de Impressão Padrão* do Android via USB OTG.
3. No **SH LojaCell**, acesse **Configurações** (`/configuracoes`), escolha a largura do papel (**58 mm** ou **80 mm**) e clique em **Imprimir Página de Teste** -> **Enviar para Impressora Agora** (ou clique em **Imprimir (Navegador / RawBT)** em qualquer OS, Venda ou Fechamento de Caixa).
4. O CSS `@media print` formata automaticamente o cupom com margens zero, fonte monoespaçada e **QR Code** do número da OS.

### Opção Direta — Camada 2 (WebUSB ESC/POS no Chrome Android)
1. Abra o sistema no **Google Chrome para Android** (em `localhost` ou `HTTPS`).
2. Em **Configurações**, clique em **Conectar Impressora USB (WebUSB)** e autorize a impressora no pop-up do Chrome.
3. Nos modais de comprovante, o botão **USB Direto (ESC/POS)** envia os bytes ESC/POS diretamente para a impressora. Caso o Android bloqueie a interface USB, o sistema faz **fallback automático** para a Camada 1 sem travar o atendimento.

---

## 3. Atalhos de Teclado para Operação Rápida no Balcão

| Atalho | Ação |
| :--- | :--- |
| `Ctrl + K` | Abre a **Busca Global** (busca OS por nº, cliente por nome/telefone/CPF, aparelho por IMEI ou peça no estoque) |
| `Alt + N` | Abre imediatamente a tela **Nova Ordem de Serviço** |
| `Alt + V` | Abre imediatamente a tela **Vendas de Balcão / PDV** |
| `Ctrl + S` | Salva a **Nova OS** instantaneamente |
| `↑` / `↓` e `Enter` | Navega e seleciona resultados na Busca Global e no leitor de código de barras do PDV |
| `Esc` | Fecha o modal de busca ativa |

---

## 4. Instalação como Aplicativo (PWA) no Tablet Android

O projeto já inclui `manifest.webmanifest` e Service Worker offline (`public/sw.js`). No Google Chrome do tablet Android, toque no menu `⋮` -> **Instalar aplicativo / Adicionar à tela inicial** para usá-lo em tela cheia como aplicativo nativo.
