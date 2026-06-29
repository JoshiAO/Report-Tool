<h1 align="center">
  <br>
  <img src="./frontend/public/attachment.png" alt="Report Tool" width="120">
  <br>
  Interactive Report Tool Platform
  <br>
</h1>

<h4 align="center">Automating chaotic Excel ETL pipelines into a streamlined, high-performance local application.</h4>

<p align="center">
  <a href="#key-features--business-impact">Key Features</a> •
  <a href="#technical-marvels--architecture">Architecture</a> •
  <a href="#ux--design-philosophy">UX & Design</a> •
  <a href="#technologies-used">Technologies Used</a>
</p>

An enterprise-grade, fully local **React + FastAPI** desktop application engineered to ingest, transform, and export massive Excel datasets automatically.

This platform was built to solve a critical business problem: the painful, error-prone manual manipulation of Excel data. By centralizing the Extract, Transform, Load (ETL) process locally, this tool securely generates `Net Invoiced`, `Sales Orders`, and `CML` reports instantly.

[**Connect on LinkedIn**](https://www.linkedin.com/in/joshua-ocampo-b67210384) | [**View My Portfolio**](https://eikofisherman.web.app/)

---

## Key Features & Business Impact

*   **Automated Excel Pipelines**: Replaces hours of manual VLOOKUPs and pivots by ingesting raw `.xlsx` files and outputting finalized, styled reports in seconds.
*   **Intelligent Missing Category Editor**: If the script detects new SKUs missing from the reference data, it automatically pauses the ETL and displays an elegant UI for the user to map new categories on the fly.
*   **Hardware-Locked Security (Cloud Core)**: The application utilizes a "Zero-Trust" architecture. A critical internal ETL mapping is stored securely in Firebase Cloud Functions. The software must be activated using a hardware-locked code to fetch this logic, preventing unauthorized usage or distribution.
*   **Standalone Execution**: Compiled seamlessly into a single `ReportTool.exe` file. Non-technical users simply double-click and run, with zero Python or Node setup required!

## Technical Marvels & Architecture

I architected this platform to handle massive enterprise data dumps without breaking a sweat, while keeping proprietary logic incredibly secure.

### 1. The React-FastAPI Monolith
*   **Seamless IPC:** Utilizes asynchronous HTTP polling and WebSockets to establish real-time progress bars and terminal-style streaming logs directly into the React UI.
*   **Embedded Static Files:** The React `frontend/dist` is served directly by the Python `uvicorn` backend, allowing the entire full-stack application to be compiled down into one portable executable.

### 2. Zero-Trust Security & Cloud Core
*   **Hardware-Bound Encryption:** The user's `activation_code` is mathematically encrypted on their hard drive using their unique Windows Machine GUID. The `settings.json` file cannot simply be copied to another machine.
*   **Cloud Function Logic:** The application reaches out to Google Cloud Functions to validate the activation code against Firestore. If valid, the Cloud Function securely returns the crucial column-mapping dictionary required for Pandas to finish the data transformation. Without this Cloud response, the software physically cannot process data.
*   **DDoS Protection:** The Firebase endpoint is strictly wrapped in a 15-minute Rate Limiter to prevent malicious brute-forcing or billing inflation.

## UX & Design Philosophy

*   **Cyberpunk Terminal Aesthetic**: The UI embraces a modern, hacker-inspired dark mode terminal aesthetic, providing real-time data ingestion feedback that makes the user feel in complete control.
*   **Cognitive Load Reduction**: Utilizes progressive disclosure. Complex settings like color customization and path configurations are hidden behind sleek modals.

## Technologies Used

### Frontend
- **React 19 (Vite, TypeScript)**: Lightning-fast UI rendering and bundling.
- **TailwindCSS**: Rapid, responsive, and beautiful utility-first styling.
- **Lucide React**: Clean, modern iconography.

### Backend & Data Processing
- **Python 3.13 (FastAPI)**: Blazing fast, asynchronous local HTTP server.
- **Pandas & OpenPyXL**: Extreme-scale Excel ingestion, pivot tables, and dynamic cell styling.
- **Cryptography (Fernet)**: Local hardware GUID encryption.
- **PyInstaller**: Cross-platform executable compilation.

### Cloud Core
- **Firebase**: BaaS providing Firestore.
- **Firebase Cloud Functions v2**: Node.js 20 serverless environment with Express Rate-Limiting.

## Let's Connect

I specialize in building full-stack applications that solve real business problems with elegant, scalable code. If you are looking for an engineer who understands both deep technical architecture and high-level business impact, I would love to chat.

[**Contact Me via Email**](mailto:joshi.ao@outlook.ph) | [**View My Portfolio**](https://eikofisherman.web.app/)

## License

**All Rights Reserved.**

This repository and its source code are the proprietary property of the author. It is published publicly strictly for educational and portfolio review purposes. You may not copy, reproduce, distribute, compile, or utilize this software for any personal or commercial purposes without explicit written consent from the author. 

---
*Built as a showcase of modern full-stack development, Python data engineering, and Zero-Trust software licensing.*
