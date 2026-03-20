<div align="center">
  <img src="logo.svg" width="250" alt="CashwaysPass Logo"/>
</div>

# Apresentação do Projeto: CashwaysPass

Bem-vindo ao repositório do **CashwaysPass** (também referenciado como Pass 2.0). Este é um sistema robusto de gerenciamento de saldos, turmas e escolas, projetado para fornecer aos administradores e consultores uma visão transparente e detalhada sobre o engajamento financeiro e educacional da plataforma.

## 🚀 Visão Geral Funcional
O projeto funciona como uma plataforma analítica e gerencial, capaz de processar dados em tempo real, gerando relatórios precisos acerca da distribuição de saldos ("Livre" e "Propósitos") das escolas cadastradas. Possui painéis interativos adaptados a funções corporativas específicas.

### ✨ Principais Funcionalidades

1. **Dashboard Administrativo**: Uma interface premium contendo KPIs essenciais diários, semanais e mensais. Analisa e detalha o "Total Investido" vs "Total Gasto", através de gráficos de rosca e barras customizados.
2. **Gerenciamento de Escolas**: Plataforma para cadastrar novas escolas, vincular turmas ativas e associar balanços financeiros específicos a elas.
3. **Módulo de Relatórios**: Exportação em um clique do painel administrativo totalmente formatado em `.pdf` (utilizando extensões de autotable nativas) para apresentações e comprovação de relatórios impressos.
4. **Visão de Transações e Tabela Analítica**: Cada escola lista suas turmas de forma independente (5º ano, 6º ano, etc.), rastreando quantos alunos participam e monitorando seus saldos unitários com indicadores em linha.
5. **Autenticação Segura de Usuários/Consultores**: Fluxo de login reformulado baseando-se em permissões sólidas de usuários e gestão de modais de resgate sob demanda.

---

## 🛠 Arquitetura Técnica

O projeto segue um padrão arquitetural de repositório inteligente segmentado em dois super nós de processamento (*Monorepo Ready* para plataformas de automação CL/CD como a Vercel).

### Frontend (Aplicação do Cliente)
Desenvolvido inteiramente como um Single Page Application altamente performático.
- **Framework**: **Angular**
- **Estilização**: **Tailwind CSS**. Implementado com a rigorosa regra de `@apply` no escopo do componente, visando manter as tags HTML limpas de marcação excessiva e adotando um estilo UI Moderno de alto contraste (Glassmorphism e tipografias dinâmicas com "Inter").
- **Ícones**: **Lucide Icons** utilizados em harmonia com ícones renderizados nativamente em base SVG.
- **Gráficos Core**: Gráficos complexos renderizados puramente através da semântica de `<svg>`, eliminando a latência de bibliotecas de terceiros como Chart.js, permitindo animações customizáveis (ex. `clip-path` octagonal interativo).

### Backend (Processador de APIs e Serviços)
Desenvolvido focado em estabilidade concorrencial para chamadas massivas.
- **Framework**: **NestJS** modular e de fácil escalabilidade horizontal.
- **Camada de Banco de Dados**: **Supabase** via PostgreSQL, centralizando e validando integridades complexas como a tabela de `eventos`, dependência `grau_escolaridade` e tabelas de mapeamento de usuário.
- **Autenticação**: Supabase Auth acoplado a middleware de restrição do Nest (Validando rotas entre Admins, Escolas e Consultores).

---

## 💻 Estrutura de Diretórios
```text
/
├── backend-nest/           # APIs, Controladores Módulos de Integração Supabase
├── frontend/               # Aplicação Angular, Telas de visualização
│   ├── src/app/features    # Lógica de tela base (Admin Dashboard, Escolas, Carteira, Perfil)
│   ├── src/app/core        # Serviços Injectables (API, ExportSettings, Relatórios)
│   └── src/assets/         # Assets visuais estáticos, fontes globais e ícones SVG customizados
└── README.md
```

## 📋 Próximas Implementações Estruturais
A plataforma se encontra em um processo constante de otimização evolutiva de regras de negócio de acordo com a visão do produto. Este repositório está devidamente versionado com Git para acompanhamento direto da evolução linear de telas de Resgate de Consultores e melhorias contínuas.
