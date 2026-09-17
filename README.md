# AuraCV

AuraCV is a modern, privacy-first AI resume building studio. It combines the speed of local execution with the intelligence of cloud and local LLMs to help you craft, refine, and export professional resumes.

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
- [Yarn](https://yarnpkg.com/) or npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/auracv.git
   cd auracv
   ```

2. Install dependencies for both the client and server:
   ```bash
   cd server && yarn install
   cd ../client && yarn install
   ```

3. Start the development servers:
   You will need two terminal tabs.
   
   **Terminal 1 (Backend API):**
   ```bash
   cd server
   yarn dev
   ```
   
   **Terminal 2 (Frontend Client):**
   ```bash
   cd client
   yarn dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

## Configuration
Configure your AI providers (like NVIDIA, OpenAI, or Ollama) directly in the **Settings** page of the UI. Your API keys are encrypted and saved locally in your SQLite database (`server/auracv.db`). 

To add or modify providers at a system level, you can edit the YAML files located in the `providers/` directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
