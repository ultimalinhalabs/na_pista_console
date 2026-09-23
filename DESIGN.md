# Na Pista — Identidade Visual & Design System

**"Na Pista — Ideias em Operação."**

Este documento é normativo, não decorativo: **toda interface do Na Pista — actual ou futura, neste
repositório ou em qualquer Custom UI — deriva desta identidade.** Não é uma sugestão de estilo; é um requisito
de produto, ao mesmo nível de autorização, entitlement ou isolamento de tenant. Novos módulos (Inventory,
Orders, Services, Professionals, Scheduling, Appointments, ...) **herdam esta linguagem — nunca criam uma nova.**

## 1. Na Pista ≠ Última Linha

Última Linha é a empresa/ecossistema (`#1E1E1E` / `#D89B46`). **O Na Pista é um produto com identidade
própria dentro do ecossistema** — não é "o design system da UL com o nome trocado". A logo do Na Pista (ver
`assets/`, `public/brand/`) é a referência visual primária do produto; os tokens abaixo foram extraídos
directamente dela (amostragem de pixel real dos ficheiros PNG oficiais), não inventados.

## 2. A marca

```
assets/
  badge_*        — a marca dentro de um "app icon" (cantos arredondados), 4 variantes de fundo,
                    13 tamanhos cada (16 a 1024px). Usar para favicon/app icons.
  mark_*         — a marca isolada, fundo transparente, 3 variantes de cor, 13 tamanhos cada.
                    Usar dentro da UI (topbar, ecrãs vazios, splash).
  favicon.ico
```

Variantes de cor do `mark`/`badge`:
- **`original`** — a versão a cores completa (off-white + dourado com gradiente até bronze). **Usar por
  omissão** sempre que a marca aparece sozinha (topbar, favicon, estados vazios).
- **`gold`** (mono) — a marca inteira num dourado sólido (`#CE9A5B`). Usar sobre fundos claros/neutros ou
  quando só um tom é aceitável (ex.: impressão a uma cor).
- **`offwhite`** (mono) — a marca inteira em branco quente. Usar sobre fundos escuros muito saturados onde o
  dourado perderia contraste, ou em contextos monocromáticos.

`public/brand/` contém a selecção já usada pela app (favicon, ícones PWA, a marca em dois tamanhos). Os
restantes ficheiros em `assets/` ficam disponíveis para módulos futuros — nunca recriar a marca a partir de
zero; copiar o tamanho/variante certo de `assets/`.

## 3. Tokens de cor

Extraídos por amostragem real dos PNGs oficiais (`assets/badge_*`, `assets/mark_*`); os tons intermédios da
escala de base (`carvão`, `elevated`) foram derivados de forma consistente a partir das duas âncoras reais
(`background` e `graphite`) — nunca escolhidos arbitrariamente.

| Token | Hex | Origem | Uso |
|---|---|---|---|
| `--np-background` | `#0A0908` | amostrado (`badge_original_pretoprofundo`) | fundo da página, "preto profundo" |
| `--np-background-carvao` | `#100E0B` | derivado (entre background e surface) | secções largas alternadas, "carvão" |
| `--np-surface` | `#18150F` | derivado | cards, painéis, topbar |
| `--np-surface-elevated` | `#211C15` | derivado | modais, dropdowns, popovers — acima da surface |
| `--np-surface-graphite` | `#2A2724` | amostrado (`badge_original_grafite`) | hover de superfície, divisores de secção |
| `--np-border` | `#332E27` | derivado de graphite | bordas subtis — nunca a única forma de separar conteúdo |
| `--np-foreground` | `#FAF3E7` | amostrado (`mark_offwhite`) | texto primário, branco quente |
| `--np-foreground-muted` | `#B4AB9C` | derivado (entre foreground e graphite) | texto secundário, labels |
| `--np-foreground-subtle` | `#78705F` | derivado | placeholders, texto desabilitado, metadata |
| `--np-gold` | `#CE9A5B` | amostrado (`mark_gold` mono) | **acção primária, foco, destaque de marca** |
| `--np-gold-hover` | `#E1A860` | amostrado (topo do gradiente do mark original) | hover/active de elementos dourados |
| `--np-gold-pressed` | `#A87A42` | amostrado (base do gradiente do mark original) | pressed state |
| `--np-gold-muted-bg` | `rgba(206,154,91,.12)` | derivado de gold | fundo subtil para realçar sem competir (ex.: item de nav activo) |
| `--np-success` | `#3FAE79` | semântico, harmonizado ao tom quente | sucesso |
| `--np-warning` | `#E0A030` | semântico — **deliberadamente distinto do gold da marca** | aviso |
| `--np-destructive` | `#D1483F` | semântico | erro/destrutivo |

Todos definidos como CSS custom properties em `app/globals.css`. **Nunca usar um hex fora desta tabela
directamente numa página** — se um tom novo for necessário, adiciona-se aqui primeiro, com justificação.

## 4. Regra de utilização do dourado (a mais importante)

> **Dourado comunica importância, acção, estado, foco ou ênfase de marca. Não é uma cor decorativa de uso
> livre.**

Usar `--np-gold` para:
- o botão de acção primária de cada ecrã (nunca mais que um por vista, salvo casos claramente hierárquicos);
- o estado activo/foco de inputs e do item de navegação corrente;
- indicadores de marca (o mark, o badge, um acento pontual num estado vazio).

**Nunca** usar dourado para:
- todos os botões (secundários usam `--np-foreground`/`--np-border`, nunca dourado);
- bordas de cards por omissão (usar `--np-border`, neutro);
- ícones decorativos sem função de estado;
- avisos/erros/sucesso (esses são semânticos — `warning`/`destructive`/`success` — nunca dourado, mesmo que
  visualmente próximos).

## 5. Características visuais obrigatórias

- **Interface escura premium** — fundo `background`/`background-carvao`, nunca branco como base.
- **Tipografia branco-quente** sobre fundos escuros — nunca cinza frio (`#888`), nunca preto puro sobre branco.
- **Dourado restrito** — ver regra acima.
- **Hierarquia visual forte** — tamanho/peso tipográfico e `foreground` vs `foreground-muted`/`subtle`
  comunicam importância antes de qualquer cor.
- **Espaçamento generoso** — nunca comprimir UI para caber mais; preferir scroll/paginação a densidade excessiva.
- **Componentes geométricos e limpos** — cantos consistentes (`--np-radius`), sem enfeites.
- **Bordas subtis** — `--np-border`, nunca bordas fortes/coloridas por omissão.
- **Contraste controlado** — suficiente para acessibilidade, nunca contraste extremo/"neon".
- **Ruído visual mínimo** — sem gradientes decorativos em botões/cards comuns (o gradiente é exclusivo da
  marca); sombras discretas, nunca `box-shadow` pesado.
- **Sensação de produto SaaS moderno**, não de dashboard genérico nem da landing page corporativa da UL.

## 6. Tokens de espaçamento, raio, tipografia

| Categoria | Tokens |
|---|---|
| Spacing | `--np-space-1: 4px` `--np-space-2: 8px` `--np-space-3: 12px` `--np-space-4: 16px` `--np-space-5: 24px` `--np-space-6: 32px` `--np-space-7: 48px` |
| Radius | `--np-radius-sm: 6px` `--np-radius: 10px` `--np-radius-lg: 16px` |
| Typography | `-apple-system, "Segoe UI", Roboto, sans-serif`; corpo `14px/1.5`; títulos de página `20px/600`; secção `15px/600` |
| Shadow | `--np-shadow: 0 4px 16px rgba(0,0,0,.35)` — só em elementos elevados (modais/dropdowns), nunca em cards planos |

## 7. Componentes (contrato, não implementação)

Definidos uma vez em `app/globals.css`, consumidos por classe utilitária em todas as páginas — nunca estilo
inline de cor. Qualquer módulo novo reutiliza estas classes:

- `.btn` / `.btn-primary` (dourado) / `.btn-danger` (destructive)
- `.card`, `.card-elevated`
- `.input`, `.textarea`, `.select` (foco = anel dourado)
- `table` / `th` / `td` (linhas com `--np-border`, sem zebra forte)
- `.badge` (neutro por omissão) + variantes `.badge-success` / `.badge-warning` / `.badge-destructive`
- `.topbar`, `.nav-link` (activo = dourado)
- `.empty-state`, `.error-text`, `.request-ref`

## 8. Aplicação obrigatória

- Esta identidade aplica-se a **todo** o `na-pista-console`, presente e futuro.
- Qualquer nova página/módulo **reutiliza** os tokens e classes acima — não cria paleta própria.
- Uma Custom UI construída por outra equipa (ADR-008) não é obrigada a usar este ficheiro, mas o produto
  **Default UI** da Última Linha é sempre regido por ele.
- Alterações a esta identidade (cor, regra do dourado, tokens) exigem actualizar este documento primeiro —
  nunca um ajuste ad-hoc numa página isolada.
