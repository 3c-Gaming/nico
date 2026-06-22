# AI_CONTEXT.md — Projeto Nico

> **Instrução para o OpenCode:** Leia este documento integralmente antes de escrever qualquer linha de código. Siga à risca as decisões de stack, estrutura de dados, componentes e estilo. Quando encontrar `[INTEGRATION PENDING]`, crie stubs com `TODO` comentado e tipagem correta — as integrações reais serão documentadas internamente depois. O objetivo é um **one-shot funcional**: UI completa, rotas de API estruturadas, lógica de negócio implementada, zero componentes externos de UI.

---

## 1. Visão Geral do Produto

**Nome:** Nico  
**Tagline:** Gestão de esteiras de disparo WhatsApp — do D1 ao D7, tudo sob controle.

Nico é uma ferramenta interna de operação para gerenciar **campanhas de marketing via WhatsApp** em parceria com provedores de envio. O app **não realiza os disparos** — ele prepara bases, organiza agendamentos, monitora números e valida ODDs/links antes de cada envio.

### O que o app faz:
- Cria **esteiras de disparos** automáticas: um D1 gera automaticamente entradas de D3, D5 e D7 na agenda, respeitando o intervalo de D+2.
- Permite criar **disparos pontuais** fora da esteira padrão.
- Faz download de bases CSV via endpoint do LeadHub.
- Busca templates de destino disponíveis na DAXX.
- Associa números e chatbots da Sendpulse a cada disparo.
- Exibe uma **visão de calendário/timeline horizontal** mostrando todos os disparos passados e futuros, agrupados por esteira, filtrável e editável.

### O que o app NÃO faz (MVP):
- Não autentica usuários (sem login).
- Não executa disparos.
- Não cria templates na DAXX ou Sendpulse.

---

## 2. Stack Tecnológica

```
Framework:       Next.js 15+ (App Router)
Linguagem:       TypeScript (strict mode)
Estilo:          Tailwind CSS v4 (via template oficial, sem configuração adicional)
Backend:         API Routes do próprio Next.js (pasta app/api/)
Persistência:    localStorage + JSON (MVP — sem banco de dados externo)
Componentes UI:  100% feitos do zero — NENHUMA lib externa de UI (sem shadcn, radix, headlessui, etc.)
Ícones:          lucide-react (único pacote de UI permitido)
Linting:         ESLint + Prettier (padrão Next.js)
```

> **Atenção ao OpenCode:** Não instale `shadcn/ui`, `radix-ui`, `@headlessui`, `react-aria`, `daisyui` nem qualquer biblioteca de componentes. Todo dropdown, modal, tooltip e input deve ser implementado com HTML + Tailwind + React state.

### Inicialização do projeto:
```bash
npx create-next-app@latest nico \
  --typescript \
  --tailwind \
  --app \
  --eslint \
  --src-dir \
  --import-alias "@/*"
```

---

## 3. Design System

### Filosofia Visual
O Nico é uma ferramenta de operação. O design deve transmitir **controle, densidade de informação e clareza operacional** — não um SaaS colorido. Pense em um painel de monitoramento de operações: fundo escuro, tipografia monospace para dados críticos, cores funcionais (não decorativas).

### Paleta de Cores (Tailwind 4 — definir como CSS custom properties em `app/globals.css`)
```css
:root {
  --bg-base:        #0D0F12;   /* fundo principal */
  --bg-surface:     #14171C;   /* cards, painéis */
  --bg-elevated:    #1C2028;   /* modais, dropdowns */
  --border:         #252A33;   /* bordas sutis */
  --border-strong:  #2E3540;   /* bordas de foco/hover */

  --text-primary:   #E8ECF0;   /* texto principal */
  --text-secondary: #7A8599;   /* labels, metadata */
  --text-muted:     #4A5568;   /* placeholders, desabilitados */

  /* Cores funcionais para tipos de disparo */
  --d1:             #3B82F6;   /* azul — D1 (base nova) */
  --d3:             #8B5CF6;   /* roxo — D3 */
  --d5:             #F59E0B;   /* âmbar — D5 */
  --d7:             #10B981;   /* verde — D7 */
  --pontual:        #EC4899;   /* rosa — disparo pontual */

  /* Estados */
  --success:        #10B981;
  --warning:        #F59E0B;
  --error:          #EF4444;
  --info:           #3B82F6;
}
```

### Tipografia
- **Display/Headings:** `font-sans` — Inter (padrão Next.js, já disponível)
- **Dados/Códigos/Nomenclaturas:** `font-mono` — `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`
- **Escala:**
  - `text-xs / text-[11px]`: metadata, labels de eixo do calendário
  - `text-sm`: body padrão, inputs
  - `text-base`: headings de card
  - `text-lg / text-xl`: títulos de seção
  - `text-2xl`: título de página

### Princípios de Layout
- Sidebar fixa à esquerda (240px) com navegação
- Área de conteúdo principal (`flex-1`, `overflow-hidden`)
- Border-radius pequeno: `rounded` (4px) ou `rounded-md` (6px) — nunca `rounded-xl` ou `rounded-2xl`
- Sem sombras excessivas — usar bordas para separação
- Densidade: espaçamento interno padrão `p-3` ou `p-4`, nunca `p-8` em componentes operacionais

---

## 4. Modelos de Dados (TypeScript)

Criar em `src/types/index.ts`:

```typescript
// Tipos de disparo
export type TipoDisparo = 'D1' | 'D3' | 'D5' | 'D7' | 'PONTUAL'

// Status do ciclo de vida de um disparo
export type StatusDisparo =
  | 'rascunho'      // criado, faltam dados
  | 'pronto'        // tudo configurado, aguardando data
  | 'em_validacao'  // dia do disparo, validando links/ODDs
  | 'executado'     // marcado como enviado
  | 'cancelado'

// Status do download da base CSV
export type StatusBase = 'pendente' | 'baixando' | 'disponivel' | 'erro'

// Casa de apostas (tag)
export interface CasaAposta {
  id: string
  nome: string         // ex: "SuperBet", "BetMGM", "EsportivaBet"
  slug: string         // ex: "superbet", "betmgm"
  cor: string          // hex, definida pelo usuário ou gerada automaticamente
}

// Template da DAXX
export interface TemplateDaxx {
  id: string
  nome: string
  descricao?: string
  url?: string
}

// Número/Chatbot da Sendpulse
export interface NumeroSendpulse {
  id: string
  numero: string       // ex: "+5511999990000"
  chatbotId: string
  descricao?: string   // label amigável, ex: "SB Receptivo ODD 100x"
}

// Base CSV (gerenciada pelo LeadHub)
export interface BaseCSV {
  leadhubId?: string         // ID no LeadHub [INTEGRATION PENDING]
  nomeArquivo?: string
  totalRegistros?: number
  status: StatusBase
  baixadoEm?: string         // ISO date
  caminhoLocal?: string      // path relativo se salvo localmente
  erro?: string
}

// Um disparo individual
export interface Disparo {
  id: string
  tipo: TipoDisparo
  nomenclatura: string       // ex: "[21/06] D7 22/06 BASE SB"
  status: StatusDisparo
  casasAposta: string[]      // array de CasaAposta.id
  dataDisparo: string        // ISO date string, ex: "2025-06-22"
  horarioDisparo: string     // ex: "09:30"
  base: BaseCSV
  templateDaxx?: TemplateDaxx
  numeroSendpulse?: NumeroSendpulse
  esteiraPaiId?: string      // ID da Esteira, se faz parte de uma
  criadoEm: string           // ISO datetime
  atualizadoEm: string
  notas?: string
}

// Esteira: conjunto de disparos D1→D3→D5→D7
export interface Esteira {
  id: string
  nome: string               // baseado no D1 por padrão
  casasAposta: string[]
  disparos: {
    d1: string               // Disparo.id
    d3?: string
    d5?: string
    d7?: string
  }
  criadaEm: string
  atualizadoEm: string
  ativa: boolean
}

// Estado global da aplicação (persistido no localStorage)
export interface AppState {
  disparos: Record<string, Disparo>
  esteiras: Record<string, Esteira>
  casasAposta: Record<string, CasaAposta>
  numerosDisponiveis: NumeroSendpulse[]      // cache da Sendpulse [INTEGRATION PENDING]
  templatesDisponiveis: TemplateDaxx[]       // cache da DAXX [INTEGRATION PENDING]
  ultimaSync?: string
}
```

---

## 5. Estrutura de Arquivos

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx              # Layout raiz com sidebar + area principal
│   ├── page.tsx                # Redirect para /calendario
│   │
│   ├── calendario/
│   │   └── page.tsx            # Página principal: timeline horizontal
│   │
│   ├── disparos/
│   │   ├── page.tsx            # Lista de todos os disparos
│   │   ├── novo/
│   │   │   └── page.tsx        # Formulário criação D1 / pontual
│   │   └── [id]/
│   │       └── page.tsx        # Detalhe/edição de disparo
│   │
│   ├── esteiras/
│   │   └── page.tsx            # Visão de esteiras ativas
│   │
│   └── api/
│       ├── disparos/
│       │   ├── route.ts        # GET (lista) / POST (criar)
│       │   └── [id]/
│       │       └── route.ts    # GET / PUT / DELETE
│       ├── esteiras/
│       │   └── route.ts        # GET / POST
│       ├── leadhub/
│       │   ├── bases/
│       │   │   └── route.ts    # GET: lista bases disponíveis [INTEGRATION PENDING]
│       │   └── download/
│       │       └── route.ts    # POST: dispara download de CSV [INTEGRATION PENDING]
│       ├── daxx/
│       │   └── templates/
│       │       └── route.ts    # GET: lista templates [INTEGRATION PENDING]
│       └── sendpulse/
│           └── numeros/
│               └── route.ts   # GET: lista números/chatbots [INTEGRATION PENDING]
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── PageHeader.tsx
│   │
│   ├── calendario/             # ⭐ Componente principal — feito do zero
│   │   ├── CalendarioTimeline.tsx   # Container com scroll horizontal
│   │   ├── ColunaData.tsx           # Uma coluna = um dia
│   │   ├── CardDisparo.tsx          # Card de disparo dentro da coluna
│   │   ├── CalendarioFiltros.tsx    # Filtros: casa, tipo, status, período
│   │   ├── LegendaTipos.tsx         # Legenda D1/D3/D5/D7/Pontual
│   │   └── useCalendario.ts         # Hook: lógica de scroll, range, filtros
│   │
│   ├── disparos/
│   │   ├── FormNovoDisparo.tsx      # Formulário multi-step de criação
│   │   ├── StepBase.tsx             # Step 1: dados básicos + casa
│   │   ├── StepCSV.tsx              # Step 2: seleção base LeadHub
│   │   ├── StepTemplate.tsx         # Step 3: template DAXX
│   │   ├── StepNumero.tsx           # Step 4: número Sendpulse
│   │   ├── StepAgendamento.tsx      # Step 5: data, hora e revisão
│   │   ├── PreviewNomenclatura.tsx  # Mostra nomenclatura gerada em tempo real
│   │   ├── EsteiraPreview.tsx       # Preview da esteira D1→D7
│   │   └── ListaDisparos.tsx        # Tabela/lista geral de disparos
│   │
│   └── ui/                     # Primitivos de UI zero-dep
│       ├── Badge.tsx            # Badge de status/tipo
│       ├── Button.tsx
│       ├── Chip.tsx             # Tag de casa de aposta
│       ├── Dropdown.tsx         # Dropdown customizado
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Select.tsx
│       ├── Spinner.tsx
│       ├── StatusDot.tsx        # Indicador colorido de status
│       ├── TagInput.tsx         # Input de tags com autocomplete (para casas)
│       ├── TimePicker.tsx
│       ├── Toast.tsx            # Notificações
│       └── Tooltip.tsx
│
├── lib/
│   ├── store.ts                # Funções de leitura/escrita no localStorage
│   ├── nomenclatura.ts         # Gerador de nomenclatura padrão
│   ├── esteira.ts              # Lógica de criação automática de D3/D5/D7
│   ├── datas.ts                # Helpers de data (sem date-fns — implementar nativamente)
│   └── integrações/
│       ├── leadhub.ts          # Cliente LeadHub [INTEGRATION PENDING]
│       ├── daxx.ts             # Cliente DAXX [INTEGRATION PENDING]
│       └── sendpulse.ts        # Cliente Sendpulse [INTEGRATION PENDING]
│
├── hooks/
│   ├── useDisparos.ts
│   ├── useEsteiras.ts
│   └── useCasasAposta.ts
│
└── types/
    └── index.ts
```

---

## 6. Lógica de Negócio Core

### 6.1 Geração de Nomenclatura

Arquivo: `src/lib/nomenclatura.ts`

A nomenclatura segue o padrão: `[DD/MM] D{N} DD/MM BASE {SIGLA_CASA}`

- `[DD/MM]` = data de criação do D1 (sempre a mesma em toda a esteira)
- `D{N}` = tipo do disparo (D1, D3, D5, D7)
- `DD/MM` = data em que ESTE disparo será executado
- `BASE` = literal "BASE" seguido da sigla da casa de aposta
- Sigla da casa = primeiras letras maiúsculas (ex: SuperBet → SB, BetMGM → MGM)

```typescript
// Exemplo de output para uma esteira criada em 21/06, D7 rodando em 28/06 para SuperBet:
// "[21/06] D7 28/06 BASE SB"

export function gerarNomenclatura(params: {
  dataCriacao: Date
  tipoDisparo: TipoDisparo
  dataDisparo: Date
  casas: CasaAposta[]
  sufixo?: string
}): string
```

O campo de nomenclatura é **editável** no formulário — a geração automática é um ponto de partida, não obrigatória.

### 6.2 Criação de Esteira (D+2)

Arquivo: `src/lib/esteira.ts`

Quando um D1 é criado, a função `criarEsteira(disparoD1: Disparo): Esteira` deve:
1. Criar automaticamente os registros de D3, D5 e D7 como **rascunhos**
2. Calcular as datas: D3 = D1 + 2 dias, D5 = D1 + 4 dias, D7 = D1 + 6 dias
3. Herdar `casasAposta`, `base`, `templateDaxx` e `numeroSendpulse` do D1 (podem ser editados depois)
4. Gerar nomenclatura automática para cada filho
5. Retornar a Esteira com referências aos IDs de todos os disparos

```typescript
export function calcularDataFilho(dataD1: Date, tipo: 'D3' | 'D5' | 'D7'): Date {
  const offset = { D3: 2, D5: 4, D7: 6 }
  // adicionar offset[tipo] dias à dataD1
}
```

### 6.3 Persistência (localStorage)

Arquivo: `src/lib/store.ts`

```typescript
const STORAGE_KEY = 'nico_app_state'

export function getState(): AppState
export function setState(state: AppState): void
export function patchDisparos(disparos: Partial<Record<string, Disparo>>): void
export function patchEsteiras(esteiras: Partial<Record<string, Esteira>>): void
export function addCasaAposta(casa: CasaAposta): void
export function deletarDisparo(id: string): void
// etc.
```

Toda mutação deve disparar um evento `storage` customizado para que os hooks reajam reativamente.

---

## 7. Componente Calendário/Timeline — Especificação Detalhada

> Este é o **componente principal do app**. Deve ser criado 100% do zero. Nenhuma lib de calendário, timeline ou scheduler deve ser usada.

### 7.1 Layout Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Filtros: Casa ▾] [Tipo ▾] [Status ▾]      [< Hoje >]   [Semana/Mês ▾]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Legenda: ■ D1  ■ D3  ■ D5  ■ D7  ■ Pontual                               │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  SEG 19  │  TER 20  │  QUA 21  │  QUI 22* │  SEX 23  │  SAB 24  │  DOM 25  │
│──────────│──────────│──────────│──────────│──────────│──────────│──────────│
│          │ ┌──────┐ │          │ ┌──────┐ │ ┌──────┐ │          │          │
│          │ │ D1   │ │          │ │ D3   │ │ │ D5   │ │          │          │
│          │ │ SB   │ │          │ │ SB   │ │ │ SB   │ │          │          │
│          │ │09:30 │ │          │ │09:30 │ │ │09:30 │ │          │          │
│          │ └──────┘ │          │ └──────┘ │ └──────┘ │          │          │
│          │          │          │ ┌──────┐ │          │          │          │
│          │          │          │ │ D1   │ │          │          │          │
│          │          │          │ │ MGM  │ │          │          │          │
│          │          │          │ │11:00 │ │          │          │          │
│          │          │          │ └──────┘ │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

- **Scroll horizontal nativo** — o container é `overflow-x-auto` com scroll suave
- **Coluna "hoje"** tem destaque visual (borda superior colorida, fundo levemente diferente)
- **Colunas de fim de semana** têm fundo levemente diferente para diferenciar
- **Largura de cada coluna:** 160px fixo (garantindo que vários dias apareçam sem comprimir)
- **Altura das colunas:** auto, crescendo com o conteúdo (sem altura máxima no MVP)

### 7.2 Navegação Temporal

- Botão `< Anterior` e `Próximo >` movem o período visível em 7 dias
- Botão `Hoje` centraliza o scroll na coluna do dia atual
- O componente deve inicializar mostrando **3 dias antes de hoje até 14 dias após hoje** (janela de 17 dias)
- O scroll deve funcionar manualmente também (arrastar)

### 7.3 CardDisparo

Cada card dentro de uma coluna exibe:
```
┌─────────────────────────────┐
│ ■ D1                        │  ← tipo (cor = variável CSS --d1/--d3/etc)
│ [SB] [MGM]                  │  ← chips das casas de aposta
│ [21/06] D1 21/06 BASE SB    │  ← nomenclatura (font-mono, text-xs, truncate)
│ 09:30 · pronto ●            │  ← horário + status dot
└─────────────────────────────┘
```
- Clique no card abre modal de detalhe/edição inline
- Hover: borda esquerda colada + fundo levemente iluminado
- Cards de uma mesma esteira devem ter uma linha de conexão visual sutil entre colunas (CSS border/pseudo-element, não SVG — usar uma linha horizontal fina abaixo do card se o próximo na esteira estiver na próxima coluna visível)

### 7.4 Filtros

```typescript
interface FiltrosCalendario {
  casas: string[]          // IDs de CasaAposta, vazio = todas
  tipos: TipoDisparo[]     // vazio = todos
  status: StatusDisparo[]  // vazio = todos
  apenasEsteiras: boolean  // oculta disparos pontuais
}
```

Os filtros ficam persistidos no estado local do componente (não no localStorage).

### 7.5 Hook `useCalendario`

```typescript
// src/components/calendario/useCalendario.ts

export function useCalendario() {
  // - Gera array de Date para o range visível
  // - Filtra disparos por data e filtros ativos
  // - Agrupa disparos por data (Map<string, Disparo[]>)
  // - Fornece handlers para navegar
  // - Retorna ref para o container (para scroll programático ao clicar "Hoje")
  return {
    diasVisiveis: Date[],
    disparosPorDia: Map<string, Disparo[]>,
    filtros: FiltrosCalendario,
    setFiltros: (f: Partial<FiltrosCalendario>) => void,
    irParaHoje: () => void,
    avancar: () => void,
    recuar: () => void,
    containerRef: RefObject<HTMLDivElement>
  }
}
```

---

## 8. Formulário de Criação de Disparo — Especificação Detalhada

### 8.1 Multi-step com progress indicator

```
① Básico → ② Base CSV → ③ Template → ④ Número → ⑤ Agendamento
```

O progress indicator fica no topo do formulário (linha horizontal com círculos numerados). Cada step é um componente separado montado/desmontado conforme o usuário avança.

### 8.2 Step 1 — Básico

Campos:
- **Tipo** (Radio cards grandes): `D1 — Base Nova` | `Pontual — Sem esteira`
  - Se D1, mostrar preview da esteira que será gerada (D3/D5/D7 e as datas calculadas)
  - Se Pontual, ocultar preview
- **Casas de Aposta** (TagInput): digita o nome da casa, pressiona Enter → cria chip. Autocomplete com casas já cadastradas.
- **Notas** (textarea, opcional): campo livre para observações

### 8.3 Step 2 — Base CSV (LeadHub)

- **Seletor de base:** lista bases disponíveis via GET `/api/leadhub/bases` [INTEGRATION PENDING]
  - Enquanto carrega: skeleton loader
  - Cada item mostra: nome da base, total de registros, data de criação
- **Botão "Baixar Base":** chama POST `/api/leadhub/download` e mostra progress inline
- Estado da base (StatusBase) visível com ícone + texto

> **Stub para desenvolvimento:** se a API não responder, exibir dados mockados e um banner amarelo "Modo offline — integração LeadHub pendente"

### 8.4 Step 3 — Template DAXX

- **Lista de templates** via GET `/api/daxx/templates` [INTEGRATION PENDING]
  - Card clicável por template com nome e botão "Ver destino" (abre URL em nova aba)
  - Seleção única (radio)
- **Campo manual:** input de fallback para colar ID/URL do template manualmente

> **Stub:** mesma lógica de mock + banner

### 8.5 Step 4 — Número Sendpulse

- **Lista de números** via GET `/api/sendpulse/numeros` [INTEGRATION PENDING]
  - Cada item: número formatado, descrição, chatbot ID
  - Seleção única (radio)
- **Campo manual:** fallback para inserir número e chatbot ID manualmente

> **Stub:** mesma lógica de mock + banner

### 8.6 Step 5 — Agendamento e Revisão

- **Data** (date input nativo estilizado com Tailwind)
- **Horário** (time input nativo estilizado ou TimePicker custom simples)
- **Preview da nomenclatura** gerada em tempo real com base nos dados do step 1 + data
  - Campo editável caso o usuário queira customizar
- **Preview da Esteira** (se D1):
  - Tabela compacta mostrando D1, D3, D5, D7 com datas calculadas e nomenclaturas
- **Botão "Criar Disparo"** → salva no store + redireciona ao calendário centralizando na data do D1

---

## 9. Rotas de API — Contratos

### `POST /api/disparos`
```typescript
// Body
{ disparo: Omit<Disparo, 'id' | 'criadoEm' | 'atualizadoEm'>, criarEsteira: boolean }

// Response
{ disparo: Disparo, esteira?: Esteira }
```

### `GET /api/disparos`
```typescript
// Query params: ?casa=sb&tipo=D1&status=pronto&from=2025-06-01&to=2025-06-30
// Response
{ disparos: Disparo[] }
```

### `PUT /api/disparos/[id]`
```typescript
// Body: Partial<Disparo>
// Response: { disparo: Disparo }
```

### `DELETE /api/disparos/[id]`
```typescript
// Se o disparo faz parte de uma esteira, perguntar: "Apagar só este ou toda a esteira?"
// Response: { deleted: string[] }  // IDs apagados
```

### `GET /api/leadhub/bases` [INTEGRATION PENDING]
```typescript
// TODO: implementar com credenciais do LeadHub
// Stub response:
{ bases: Array<{ id: string, nome: string, totalRegistros: number, criadoEm: string }> }
```

### `POST /api/leadhub/download` [INTEGRATION PENDING]
```typescript
// Body: { baseId: string }
// TODO: chamar endpoint de download do LeadHub e salvar CSV
// Stub response:
{ status: 'ok', caminhoLocal: '/tmp/base_mock.csv', totalRegistros: 4821 }
```

### `GET /api/daxx/templates` [INTEGRATION PENDING]
```typescript
// TODO: buscar via endpoint/scraping da DAXX
// Stub response:
{ templates: Array<{ id: string, nome: string, url: string }> }
```

### `GET /api/sendpulse/numeros` [INTEGRATION PENDING]
```typescript
// TODO: buscar via Sendpulse API
// Stub response:
{ numeros: Array<{ id: string, numero: string, chatbotId: string, descricao: string }> }
```

---

## 10. Navegação (Sidebar)

```
┌──────────────┐
│  nico        │  ← logo/nome, font-mono, text-white
│──────────────│
│ ▦ Calendário │  ← rota /calendario (default)
│ ≡ Disparos   │  ← rota /disparos
│ ⇄ Esteiras   │  ← rota /esteiras
│──────────────│
│ + Novo D1    │  ← botão de ação principal → /disparos/novo
└──────────────┘
```

- Sidebar fixa, 240px, fundo `--bg-surface`
- Link ativo com fundo `--bg-elevated` e borda esquerda `2px` colorida
- Botão "Novo D1" em destaque: fundo `--d1`, texto branco, `rounded-md`

---

## 11. Página de Disparos — Lista

Tabela com colunas:
| # | Nomenclatura | Tipo | Casa | Data | Horário | Status | Base | Ações |
|---|---|---|---|---|---|---|---|---|

- Ordenável por Data e Status
- Filtro de busca por nomenclatura (input de texto)
- Filtro por tipo (chips clicáveis)
- Linha clicável → abre modal de edição
- Ícone de esteira na coluna # para disparos que fazem parte de uma esteira

---

## 12. Página de Esteiras

Grid de cards, uma esteira por card:
```
┌────────────────────────────────────────────┐
│ Esteira: [21/06] SB + MGM                  │
│ Criada em: 21/06/2025                       │
│                                             │
│ D1 ──────── D3 ──────── D5 ──────── D7    │
│ 21/06       23/06       25/06       27/06   │
│ ● pronto    ○ rascunho  ○ rascunho  ○ rascunho│
└────────────────────────────────────────────┘
```
- A linha D1→D3→D5→D7 é um mini-timeline horizontal em CSS puro
- Clique em cada nó abre o detalhe do disparo

---

## 13. Componentes UI Primitivos — Guia de Implementação

### Badge.tsx
```tsx
// Variantes: tipo (d1/d3/d5/d7/pontual) e status (rascunho/pronto/executado/etc)
// Usa CSS custom properties para cor
// text-xs, font-medium, px-2 py-0.5, rounded
```

### TagInput.tsx
```tsx
// Input controlado que ao pressionar Enter ou vírgula:
// - Verifica se a tag já existe nas casasAposta do store
// - Se sim, usa a existente
// - Se não, cria nova com cor gerada automaticamente (hsl baseado em hash do nome)
// - Renderiza chips com botão ×
// - Autocomplete: dropdown com sugestões filtrando pelo texto atual
```

### Modal.tsx
```tsx
// Backdrop com onClick={onClose}
// Container com role="dialog" aria-modal
// Esc fecha o modal
// Sem animação excessiva — só opacity transition suave
```

### Toast.tsx
```tsx
// Fixed bottom-right
// Fila de toasts empilhados
// Auto-dismiss após 4s
// Variantes: success, error, warning, info
```

---

## 14. Helpers de Data (sem date-fns)

Arquivo: `src/lib/datas.ts`

Implementar as seguintes funções usando apenas JavaScript nativo:

```typescript
export function formatarData(date: Date, formato: 'DD/MM' | 'DD/MM/YYYY' | 'YYYY-MM-DD'): string
export function adicionarDias(date: Date, dias: number): Date
export function isMesmaData(a: Date, b: Date): boolean
export function isHoje(date: Date): boolean
export function isFimDeSemana(date: Date): boolean
export function gerarRangeDias(inicio: Date, fim: Date): Date[]
export function parsearDataISO(isoString: string): Date
export function formatarHorario(date: Date): string  // "HH:MM"
export function diaDaSemanaAbreviado(date: Date): string  // "SEG", "TER", etc em PT-BR
```

---

## 15. Detalhes de Implementação e Armadilhas

1. **Hidratação SSR:** O localStorage só existe no client. Usar `useEffect` para carregar o estado inicial, com um estado de loading para evitar hydration mismatch.

2. **Tailwind 4:** A configuração de cores customizadas é via CSS custom properties em `globals.css` e referenciadas com `var(--nome)` inline ou via `style` prop quando necessário. Não tentar configurar no `tailwind.config.js` (pode não existir no v4).

3. **Scroll do calendário:** Usar `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })` no ref da coluna "hoje" ao montar o componente.

4. **IDs únicos:** Usar `crypto.randomUUID()` (disponível no Node 19+ e em todos os browsers modernos) para gerar IDs.

5. **Timezone:** Todas as datas devem ser tratadas em horário local do usuário. Não usar UTC para cálculos de D+2 (evitar bugs de DST).

6. **Cores das casas:** Gerar automaticamente via HSL com hash do nome: `hsl(${(hashCode(nome) % 360)}, 65%, 55%)`.

---

## 16. Instruções Finais para o OpenCode

1. **Implemente tudo em uma única passada.** Não pare para perguntar sobre integrações — use os stubs especificados.
2. **O componente CalendarioTimeline é a prioridade máxima** — deve funcionar com dados mockados desde o início.
3. **Não instale nenhuma biblioteca de UI** além de `lucide-react` e o que vem por padrão no template Next.js.
4. **Popule com dados seed** no primeiro load do localStorage para que o calendário não apareça vazio:
   - 2 esteiras ativas com disparos em datas próximas ao dia atual
   - 1 disparo pontual
   - 3 casas de aposta pré-cadastradas: SuperBet, BetMGM, EsportivaBet
5. **Garanta responsividade mínima:** a sidebar colapsa em mobile (ícones apenas ou overlay).
6. **Commits organizados** por feature: [feat] calendario, [feat] form-disparo, [feat] store, etc.
7. Os arquivos de integração em `src/lib/integrações/` devem ter comentários `// TODO: [INTEGRATION PENDING]` claros com a assinatura esperada das funções.