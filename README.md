# NapTrap

A non-camera driver fatigue detection prototype, built as an AP with WE Service Capstone project.

## What it does

NapTrap monitors a driver's heart rate variability (HRV) in real time and flags rising fatigue before it becomes dangerous — without using a camera. Most existing fatigue-detection tools track eye movement and blinking through a camera pointed at the driver's face (a method called PERCLOS). NapTrap takes a different approach: it measures how a driver's heart rate pattern drifts from their own resting baseline, which HRV research literature links to fatigue.

The system is a working end-to-end prototype:
- A wearable sensor (simulating a smartwatch) streams heartbeat data in real time
- A backend calculates HRV and classifies fatigue into four levels (Fresh → Mild → Moderate → Severe)
- A live dashboard shows the driver their current fatigue level and triggers a full-screen alert if it crosses a threshold

For the full writeup — the research behind this project, the design decisions, and the obstacles we ran into — see our project report.

## Tech stack

| Layer | Technology |
|---|---|
| Hardware | ESP32 + MAX30102 optical heart rate sensor |
| Firmware | Arduino (C++), WebSocketsClient |
| Backend | FastAPI, SQLAlchemy (async), PostgreSQL (production) / SQLite (local) |
| HRV calculation | Java subprocess (`HRVCalculator.java`), called from the Python backend |
| Frontend | React + TypeScript, Zustand, Recharts, Vite |
| Deployment | Railway (Nixpacks) |

## Project structure

```
NapTrap/
├── backend/              FastAPI backend — API routes, WebSocket handling,
│                          HRV pipeline runner, database models
├── frontend/              React + TypeScript dashboard (Vite, Zustand, Recharts)
├── firmware/              ESP32 Arduino firmware (naptrap_sensor.ino)
├── HRVCalculator.java     Java program that calculates RMSSD, called as a
│                          subprocess from the Python backend
├── hrv_pipeline.py        Python pipeline — builds sliding windows, calls
│                          Java, classifies the fatigue level
├── requirements.txt       Python dependencies
├── nixpacks.toml          Railway build configuration
├── railway.toml           Railway deployment configuration
└── 000.txt                Sample RR-interval data used by Demo mode
```

## Getting started

### Prerequisites
- Python 3.11
- JDK 17+
- Node.js (for the frontend)

### Backend

```bash
pip install -r requirements.txt

# Compile the Java HRV calculator
javac --release 17 HRVCalculator.java

# Start the backend (development mode)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # development server
npm run build    # production build, output to frontend/dist/
```

### Environment variables

The backend reads configuration from a `.env` file in the project root. The variables it expects:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Database connection string (SQLite locally, PostgreSQL in production) |
| `SECRET_KEY` | Signs authentication tokens — must be set to a real secret value, never left as the placeholder default |
| `ALGORITHM` | JWT signing algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | How long a login session stays valid |
| `JAVA_DIR` | Folder containing the compiled `HRVCalculator.class` |
| `DEMO_RR_FILE` | Path to the sample RR-interval file used by Demo mode |

No `.env` file is included in this repository — create your own and fill in real values before running the backend.

## Status

This is a working prototype built for a school Capstone project, not a production-ready product. The fatigue thresholds are based on HRV research literature rather than real driving-fatigue data, and the system hasn't been tested in an actual moving vehicle. See our project report for a full discussion of what's implemented, what's simplified, and what we'd do with more time.

## Team

Built by Edwin, Kaki, and Richard as part of an AP with WE Service Capstone project on fatigue driving.
