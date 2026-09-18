# AuraCV

AuraCV is a modern, privacy-first AI resume building studio. It combines the speed of local execution with the intelligence of cloud and local LLMs to help you craft, refine, and export professional resumes.

<img width="2559" height="1270" alt="image" src="https://github.com/user-attachments/assets/e175e843-962a-46d6-a3a9-b7756708ae31" />


## Features

- **Multi-Provider AI Engine:** Bring your own API keys for NVIDIA NIM, OpenAI, Anthropic, Gemini, OpenRouter, or run completely offline with Ollama.
- **AI-Powered Editing:** Highlight text to instantly rewrite, redline, or expand bullet points with AI Copilot.
- **Privacy-First:** Your data stays in your local SQLite database. Keys are AES-256 encrypted.
- **Live Preview:** Instantly see how your resume looks across multiple professional templates (ATS-friendly, Classic, Modern, Minimal, etc).
- **Import/Export:** Import existing resumes and export your finished work to pixel-perfect PDF or DOCX formats.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Zustand, Vite
- **Backend:** Node.js, Express, Better-SQLite3, Puppeteer (for PDF generation)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (bundled with Node.js)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/zoebchhatriwala/AuraCV.git
   cd AuraCV
   ```

2. Install dependencies (installs root, server, and client packages):

   ```bash
   npm run setup
   ```

3. Start the development environment:

   ```bash
   npm run dev
   ```

   This runs both the backend server (port 3847) and frontend client concurrently with a single command.

4. Open your browser and navigate to `http://localhost:5842`.

## Configuration

Configure your AI providers (like NVIDIA, OpenAI, or Ollama) directly in the **Settings** page of the UI. Your API keys are encrypted and saved locally in your SQLite database (`server/auracv.db`).

To add or modify providers at a system level, you can edit the YAML files located in the `providers/` directory.

## Database Backup & Restore

AuraCV stores all resumes, custom sections, AI writing sessions, and configurations in a single SQLite database (`server/auracv.db`).

### Exporting Database (.db)
- Click **Export DB** in the Dashboard top bar, or navigate to **Settings > Database & Data Storage** and click **Export Database (.db)**.
- This creates a consolidated SQLite snapshot using `VACUUM INTO` that can be queried or stored offline.

### Restoring Database (.db)
1. Stop the server (`Ctrl + C` in the running terminal).
2. Copy your exported backup file to `server/auracv.db` (overwrite existing).
3. Delete `server/auracv.db-wal` and `server/auracv.db-shm` if they exist to prevent journal mismatch.
4. Restart the server (`npm run dev`). All resumes, sections, and settings will be restored.

**macOS / Linux (Bash or Zsh):**
```bash
# In the server/ directory:
rm -f auracv.db-wal auracv.db-shm
cp /path/to/your_backup.db auracv.db
cd .. && npm run dev
```

**Windows (PowerShell):**
```powershell
# In the server/ directory:
Remove-Item auracv.db-wal, auracv.db-shm -ErrorAction SilentlyContinue
Copy-Item "path\to\your_backup.db" auracv.db -Force
cd ..; npm run dev
```

*Note: For single resume backups, you can also use JSON export/import via the **Import** page without replacing the database.*

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
