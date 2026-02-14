# Itrate Workflow 🎙️🤖

A next-generation **Voice AI & Workflow Automation** platform. Build, simulate, and deploy sophisticated AI agents with a powerful visual node-based editor.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?style=flat-square&logo=prisma)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)

---

## ✨ Key Features

- **Visual Workflow Editor**: Drag-and-drop interface for building AI logic using `@xyflow/react`.
- **Multimodal AI Support**: Seamlessly integrate with OpenAI, Anthropic, and Google Gemini.
- **Voice Intelligence**: High-quality Text-to-Speech (TTS) via ElevenLabs and real-time Speech-to-Text (STT).
- **Live Simulator**: Test and debug your workflows in real-time with an interactive chat and trace viewer.
- **Workflow Versioning**: Save snapshots of your designs and restore any previous version.
- **Encrypted Credentials**: Securely store and manage your AI provider API keys.
- **Background Processing**: Reliable task execution powered by Inngest.

## 🚀 Quick Start

Follow these steps to get the application running on your local machine.

### 1. Prerequisites

- Node.js (v20 or higher)
- npm or pnpm
- PostgreSQL database (Neon.tech recommended)
- [Inngest CLI](https://www.inngest.com/docs/local-development) (recommended for local testing)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone <your-repo-url>
cd voice-ai
npm install
```

### 3. Environment Setup

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: A secure random string for authentication.
- `ENCRYPTION_KEY`: A 32-byte hex string for encrypting provider credentials.

### 4. Database Initialization

Sync your database schema with Prisma:

```bash
npx prisma db push
```

### 5. Start Developing

Run the development server:

```bash
npm run dev
```

In a separate terminal, start the Inngest dev server to handle background functions:

```bash
npx inngest-cli@latest dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).
The Inngest UI will be at [http://localhost:8288](http://localhost:8288).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Visuals**: [@xyflow/react](https://reactflow.dev/) (React Flow)
- **API**: [tRPC](https://trpc.io/) for end-to-end typesafe APIs.
- **Auth**: [Better Auth](https://better-auth.com/) for modern authentication.
- **Database**: [Prisma](https://www.prisma.io/) with PostgreSQL.
- **Logic**: [Inngest](https://www.inngest.com/) for event-driven workflows.
- **UI Components**: Radix UI & Lucide Icons.

## 📖 Architecture

- `src/app`: Next.js pages and layouts.
- `src/components`: Reusable UI components.
- `src/lib/engine`: Core workflow execution engine logic.
- `src/server`: Backend logic, tRPC routers, and Inngest functions.
- `prisma/`: Database schema and migrations.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
