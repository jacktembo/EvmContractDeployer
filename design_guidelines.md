# Design Guidelines: EVM Smart Contract Deployment Platform

## Design Approach

**Professional Developer Tool Aesthetic**
Modern, polished blockchain development platform inspired by industry-leading tools (VS Code, Remix IDE, Etherscan). Emphasizes clarity, trustworthiness, and efficiency for technical users through refined color palette, consistent spacing, and professional typography.

**Core Principle:** Information hierarchy through subtle elevation, consistent card-based layouts, and clear visual separation between code editing, deployment actions, and historical data.

**Updated:** November 2025 - Refined color system with modern blues (#4169E1 primary), improved card backgrounds, professional spacing tokens (gap-6, p-6), and consistent component elevation.

---

## Typography System

**Font Stack:** Inter (primary), JetBrains Mono (code)
- **Headings:** 2xl (section titles), xl (panel headers), lg (subsection headers)
- **Body:** Base (primary text), sm (secondary/meta information)
- **Code:** JetBrains Mono at base size with 1.5 line-height
- **Weights:** Semibold (600) for headings/CTAs, Medium (500) for labels, Regular (400) for body

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8 (p-2, m-4, gap-6, py-8, etc.)

**Page Structure:**
- Fixed header (h-16) with wallet connection and network selector
- Main content area split: 40% code editor panel (left), 60% deployment/results panel (right) on desktop
- Mobile: Stacked single column with tabbed navigation between panels
- Container max-width: max-w-7xl with px-4 on mobile, px-6 on desktop

---

## Component Library

### Header Navigation
- Logo/brand (left) - text-xl font-semibold
- Network selector dropdown (center) - badge-style with chain icon
- Wallet connect button (right) - prominent with connection status indicator
- Height: h-16, sticky positioning, border-b separator

### Code Editor Panel
- Toolbar: Upload button, example contracts dropdown, clear button (h-12, gap-4)
- Monaco-style editor area with line numbers, syntax highlighting
- File tabs if multiple contracts uploaded (h-10 tabs)
- Footer bar: Character count, Solidity version selector (h-8)

### Deployment Panel
- **Configuration Section:**
  - Network selector (large buttons with chain logos in grid-cols-2 md:grid-cols-3)
  - Constructor arguments input fields (if detected)
  - Gas settings collapsible (advanced options)
  
- **Action Section:**
  - Compile button (secondary, full-width)
  - Deploy button (primary, full-width, disabled until compiled)
  - Clear visual state transitions (idle → compiling → ready → deploying)

- **Results Section:**
  - Success/error alerts (p-4, rounded-lg)
  - Contract address (copyable, monospace font)
  - Transaction hash (link to block explorer)
  - ABI display (collapsible code block)
  - Verification instructions (expandable)

### Wallet Connection Modal
- Overlay with centered modal (max-w-md)
- Wallet options grid (grid-cols-2, gap-4)
- Each wallet: Icon, name, "Install" or "Connect" button
- Footer: "What is a wallet?" help link

### Network Selector
- Dropdown or modal with search
- Grouped by mainnet/testnet
- Each option: Chain icon, name, status indicator (connected/available)
- Badge showing current selection in header

---

## Form Elements & Interactions

**Input Fields:**
- Height: h-12, px-4, rounded-lg borders
- Labels: text-sm font-medium, mb-2
- Code inputs: font-mono background treatment
- Validation states: Border changes, inline error messages (text-sm)

**Buttons:**
- Primary (Deploy): h-12, px-6, rounded-lg, font-semibold
- Secondary (Compile, Upload): h-10, px-4, rounded-lg, font-medium
- Icon buttons (Copy, Clear): h-8 w-8, rounded

**Status Indicators:**
- Compilation: Spinner + text label
- Deployment: Progress states with check/error icons
- Connection: Dot indicator (w-2 h-2 rounded-full) in header

---

## Animations

**Minimal, Purposeful:**
- Wallet connect: Fade-in modal (duration-200)
- Deployment progress: Indeterminate progress bar
- Success notifications: Slide-in from top (duration-300)
- No decorative animations

---

## Responsive Behavior

**Desktop (lg+):** Side-by-side panels, full feature visibility
**Tablet (md):** Same layout, narrower margins
**Mobile (base):** 
- Tabbed interface switching between "Code" and "Deploy" views
- Header simplified: Hamburger menu for network/wallet
- Full-width action buttons (h-14 for easier tapping)

---

## Critical UX Patterns

1. **Trust Indicators:** Always show connected wallet address (truncated), current network prominently
2. **Error Prevention:** Disable deploy until compilation succeeds, show gas estimates before transactions
3. **Feedback Loops:** Every action has immediate visual feedback (loading states, success/error messages)
4. **Copyable Data:** All addresses, hashes, ABIs have one-click copy with toast confirmation
5. **Help Context:** Tooltip icons (?) near technical terms, link to documentation

---

## Visual Hierarchy

- **Level 1 (Highest):** Deploy button, wallet connect status, error messages
- **Level 2:** Code editor, network selector, compilation status  
- **Level 3:** Configuration options, gas settings, help text
- **Level 4:** Footer info, version details, external links

This design prioritizes developer efficiency with clear information architecture, minimal cognitive load, and trustworthy transaction flows essential for blockchain applications.