# AI-Powered Exam Platform (Local LAN)

This project provides a LAN-accessible exam platform with React (Vite + Tailwind) frontend and FastAPI backend with AI scoring using sentence-transformers (all-MiniLM-L6-v2).

## Features
- Student and Admin roles
- JWT auth (signup/login)
- Create questions (Admin)
- Take exam with timer, anti-cheat (copy/paste blocked, tab switch detection)
- AI semantic scoring using sentence-transformers
- Results listing and CSV export (Admin)
- LAN access from other devices

## Prerequisites
- Python 3.10+
- Node.js 18+

## Backend Setup
1. Create/activate a virtual environment (Windows PowerShell):
```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
2. Install dependencies:
```
pip install -r backend/requirements.txt
```
3. Run FastAPI with Uvicorn on all interfaces for LAN:
```
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend Setup
1. Install dependencies:
```
cd frontend
npm install
```
2. Start Vite dev server on all interfaces:
```
npm run dev
```
Vite is configured with `server.host` to allow LAN access. It will be available on your PC IP at port 5173.

## Find your local IP
Windows PowerShell:
```
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi","Ethernet" | Where-Object {$_.IPAddress -notlike '169.*'} | Select-Object -First 1).IPAddress
```
Example IP: `192.168.0.101`
- Backend: http://192.168.0.101:8000
- Frontend: http://192.168.0.101:5173

Ensure Windows Defender Firewall allows inbound connections for `python.exe` and `node.exe` or open ports 8000 and 5173.

## Default Flow
- Sign up as Admin (choose admin role) and create questions.
- Sign up as Student and take the exam.
- Submit to get AI-scored results.
- Admin can view and export results.

## Production Build (optional)
To build static frontend:
```
cd frontend
npm run build
npm run preview
```
`npm run preview` also binds to all interfaces.

## Notes
- The first AI scoring may take longer to download the model. Subsequent runs are cached.
- For real deployments, set a strong `SECRET_KEY` via environment variable and restrict CORS.
