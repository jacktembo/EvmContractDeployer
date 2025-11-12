# EVM Smart Contract Deployment Platform

## Overview

This project is a professional web-based platform designed for deploying Solidity smart contracts to various EVM-compatible blockchain networks. It offers a comprehensive suite of tools including a Monaco-based code editor, OpenZeppelin integration, server-side compilation, universal wallet integration for deployment, and automatic contract verification on block explorers. The platform streamlines the smart contract development and deployment workflow, providing advanced blockchain development capabilities to a broad user base. Key capabilities include a contract templates library, ABI and bytecode viewers, and an interactive interface for contract testing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a React 18 with TypeScript single-page application, built with Vite. It utilizes Wouter for routing and Shadcn/ui components (Radix UI primitives with Tailwind CSS), supporting light/dark modes. State management is handled by TanStack Query for server state. The UI emphasizes a professional developer tool aesthetic with a responsive 4-panel layout, prioritizing the code editor, and includes a Monaco Editor, Deployment Panel, Deployment History, Contract Interaction, and Template Gallery. Default panel sizing is optimized for an improved user experience.

### Backend Architecture

The backend is developed using Express.js, TypeScript, and Node.js. It features a compilation service leveraging `solc` for server-side Solidity compilation, with automatic OpenZeppelin contract resolution. A contract verification service integrates with the Etherscan V2 API for automatic source code verification across supported networks, including contract flattening and handling of optimization settings and constructor arguments. The API is RESTful, uses Zod for validation, and manages data persistence with a PostgreSQL database and Drizzle ORM, supporting websockets.

### System Design Choices

- **UI/UX**: Professional developer tool aesthetic with a modern color system, card-based layouts, consistent spacing, responsive design, light/dark modes, and real blockchain network icons.
- **Technical Implementations**: React 18, TypeScript, Vite, Wouter, Shadcn/ui, Tailwind CSS, Monaco Editor, Express.js, Node.js, `solc`, Drizzle ORM, PostgreSQL.
- **Feature Specifications**: Server-side compilation, automatic contract verification (including optimization settings and constructor argument encoding), universal wallet integration (Reown AppKit), ABI and bytecode viewers, interactive contract testing, comprehensive deployment history, contract template library, and workspace-based IDE with multi-file editing. Workspace management includes inline rename, delete with confirmation, and owner-only access. Deployments are automatically associated with the selected workspace, with a bulk association feature available for historical deployments.
- **Security**: Zod schema validation, structured error handling, session-based authentication for deployment management, and secure ABI encoding for constructor arguments.
- **Layout**: Resizable 3-panel desktop layout (FileExplorer/Templates, Monaco Editor, DeploymentPanel/History) with a collapsible left panel, and a tab-based mobile interface.

## External Dependencies

- **Blockchain Integration**:
    - **Reown AppKit**: Universal wallet connection.
    - **Wagmi**: React hooks for Ethereum wallet management, network switching, and transaction signing.
    - **ethers.js v6**: Contract deployment and interaction.
    - **@reown/appkit-adapter-wagmi**: Wagmi adapter for Reown AppKit.
    - Supports 12 EVM networks: Ethereum (Mainnet & Sepolia), BNB Smart Chain (Mainnet & Testnet), Polygon (Mainnet & Amoy), Arbitrum (One & Sepolia), Optimism (Mainnet & Sepolia), Avalanche (C-Chain & Fuji).
- **Development Tools**:
    - **Monaco Editor**: Code editor component.
    - **solc**: Solidity compiler.
    - **OpenZeppelin Contracts**: Dynamically fetched from GitHub.
- **Database**:
    - **Drizzle ORM**: For PostgreSQL.
    - **@neondatabase/serverless**: PostgreSQL driver.
    - **ws**: WebSocket package.
- **UI Libraries**:
    - **Radix UI**: Headless component primitives.
    - **react-dropzone**: File upload.
    - **react-hook-form** with **@hookform/resolvers**: Form validation.
    - **Zod**: Runtime schema validation.
    - **date-fns**: Date manipulation.
    - **lucide-react** & **react-icons**: Icon libraries.
    - **react-resizable-panels**: For panel resizing.
- **Build & Development**:
    - **Vite**: Frontend build tool.
    - **esbuild**: Server-side bundling.
    - **tsx**: TypeScript execution.
    - **Tailwind CSS**, **PostCSS**, **Autoprefixer**: CSS processing.
    - **TypeScript**: Type safety.