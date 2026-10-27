# AuraCV

AuraCV is a modern, privacy-first career intelligence studio and CV / Resume builder. It combines the speed of local execution with the intelligence of cloud and local LLMs to help you craft, tailor, evaluate, and export professional profiles. Available as a cross-platform desktop application (Windows, macOS, Linux) or a self-hosted web app.

<img width="1278" height="637" alt="image" src="https://github.com/user-attachments/assets/5a379c2b-4985-4f60-be98-90167390e9c8" />

## Key Features

- **Cross-Platform Desktop & Web:** Run AuraCV as a native desktop application on Windows, macOS, and Linux, or host it as a web service.
- **Multi-Provider AI Engine:** Connect any provider using standard YAML contracts — NVIDIA NIM, OpenAI, Anthropic, Gemini, OpenRouter, or run completely offline with Ollama.
- **Streaming & Deep Thinking:** Native server-sent events (SSE) streaming accumulator and extraction of reasoning/thinking content (`reasoning_content`) for models that support it.
- **Fault-Tolerant CV Tailor:** Multi-pass JSON repair engine for budget or small models, zero-loss live evaluation and reconciliation, and 45s request timeout guards.
- **Privacy-First Local Storage:** Your profiles, job applications, and secrets stay local in a WAL-checkpointed SQLite database (`auracv.db`) with AES-256 encrypted API keys.
- **Seamless In-App Database Management:** Direct in-app database backups and one-click database restore with atomic hot-swapping and confirmation safeguards.
- **Live Preview & Multi-Format Export:** Live visual editing across ATS-friendly, Modern, Minimal, and Classic templates, with pixel-perfect PDF rendering (via headless Chrome) and DOCX export.
- **Dashboard Organization:** Pin critical profiles to the top, search and filter effortlessly, and safely archive older revisions without cluttering active tailoring workflows.

## Tech Stack

- **Desktop Shell:** Electron, TypeScript, electron-builder
- **Frontend:** React 19, TypeScript, Tailwind CSS, Zustand, Vite
- **Backend:** Node.js, Express, Better-SQLite3, Puppeteer, Hugging Face Transformers

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher recommended, v18+ supported)
- [npm](https://www.npmjs.com/) (bundled with Node.js)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/zoebchhatriwala/AuraCV.git
   cd AuraCV
   ```

2. Install dependencies across root, server, and client:

   ```bash
   npm run setup
   ```

### Running Locally

- **Web Mode:**

  ```bash
  npm run dev
  ```

  Runs both the backend server (port `3847`) and frontend Vite client (`http://localhost:5842`).

- **Desktop Mode:**
  ```bash
  npm run desktop
  ```
  Launches the local development server and opens AuraCV inside an Electron window with hot reload.

### Building Desktop Installers

Package production installers for your target operating system:

```bash
# Package for your current operating system
npm run build:desktop

# Package specifically for Windows (.exe / installer)
npm run build:desktop:win

# Package specifically for macOS (.dmg / .zip)
npm run build:desktop:mac

# Package specifically for Linux (.AppImage / .deb)
npm run build:desktop:linux
```

Installers and packages are output to the `release/` directory.

## Configuration & Custom Providers

### Managing API Keys

Configure your AI providers (such as NVIDIA NIM, OpenAI, Anthropic, Gemini, or Ollama) directly in **Settings > AI Providers**. API keys are encrypted at rest with AES-256 and stored locally in your database.

### Provider YAML Contracts & Overrides

Providers in AuraCV are declared via clean YAML specification files located in the `providers/` directory.

To customize existing models, endpoints, or add custom private providers without modifying source code:

- Place custom YAML files in your user data directory (`providers/` inside `~/.auracv/` or the app's user data folder).
- AuraCV automatically merges user directory overrides at runtime, ensuring your custom providers persist across app updates.

## Database Backup & Restore

AuraCV stores all profiles, job applications, AI writing sessions, and configurations in a single SQLite database (`auracv.db`).

### 1. In-App Backup & Restore (Recommended)

- **Export Backup:** Click **Export DB** in the top navigation bar, or navigate to **Settings > Data Backup & Storage** and select **Download Backup File**. This creates a clean `VACUUM INTO` SQLite snapshot.
- **Restore Backup:** Navigate to **Settings > Data Backup & Storage**, expand **Restore Database Backup**, and select your `.db` file. AuraCV safely checkpoints WAL files, performs a live hot-swap, and reloads your workspace with zero command-line steps.

### 2. Manual CLI Restore (Offline Fallback)

If restoring offline or troubleshooting:

1. Stop the running app / server (`Ctrl + C`).
2. Replace `auracv.db` with your backup file and remove lingering WAL journals:

**macOS / Linux:**

```bash
# In the server/ or user data directory:
rm -f auracv.db-wal auracv.db-shm
cp /path/to/backup.db auracv.db
npm run dev
```

**Windows (PowerShell):**

```powershell
# In the server/ or user data directory:
Remove-Item auracv.db-wal, auracv.db-shm -ErrorAction SilentlyContinue
Copy-Item "path\to\backup.db" auracv.db -Force
npm run dev
```

_Tip: For migrating individual profiles between workspaces, you can also use JSON export/import via the **Import / Export** section without replacing the entire database._

## Contributing

Contributions are welcome! Please feel free to submit an issue or pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
