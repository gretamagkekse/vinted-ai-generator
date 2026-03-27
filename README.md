# 👗 Vinted AI Generator

**Live Demo:** 👉 [https://vinted-frontend-rnqehl2d5a-ew.a.run.app](https://vinted-frontend-rnqehl2d5a-ew.a.run.app) 👈

Ein intelligenter, KI-gesteuerter Web-Generator, der aus hochgeladenen Fotos (z. B. vom Smartphone) automatisch **geordnete, verkaufsoptimierte Vinted-Listings** erstellt. Nie wieder lange über Titel, Neupreise oder Detailbeschreibungen nachdenken!

---

## ✨ Features

- **📸 Multi-Image Upload (HEIC-Support):** Lade direkt mehrere iPhone/Smartphone-Fotos deines Artikels hoch. Alle Apple `.heic`-Bilder werden im Browser automatisch und blitzschnell zu JPEG konvertiert.
- **🤖 Google Vertex AI (Gemini 2.0 Flash):** Nutzt State-of-the-Art Bilderkennung, um automatisch Marken, Materialien (z. B. "Y2K", "Vintage", "Oversized"), Farben und kleine Makel zu erkennen.
- **🎓 Strikter Vinted-Standard:** Die App zwingt die KI zur Ausgabe eines präzisen 4-Absatz-Formats:
  1. *Detailbeschreibung* (inklusive mind. 3 optimierter Hashtags)
  2. *Geschätzter Neupreis* (bei unbekannter Marke: Schätzung nach Qualitätsmerkmalen)
  3. *Mängel* (automatisch aus den Bildern ausgelesen oder nach Anweisung ergänzt)
  4. *Rechtlicher Disclaimer* (Fester Standard-Satz zum Privatverkauf)
- **🌍 Internationalisierung (14 Sprachen):** Die App bietet Übersetzungen und Ausgaben für **alle Vinted-aktiven Länder** (u.a. EN, FR, ES, IT, PL, PT, CS). Ändere die Dropdown-Struktur und die KI generiert (oder übersetzt) das Listing on-the-fly neu!
- **💬 Interaktive Verfeinerung:** Das erstellte Resultat gefällt dir nicht zu 100 %? Kein Problem! Über eine Chat-Schnittstelle unter dem Ergebnis kannst du der KI einfach Verbesserungs-Kommandos ("Mach es lustiger", "Titel kürzer") mitgeben.

---

## 🏗️ System-Architektur

- **Frontend:** React (Vite)
  - Vollständiges State-Management (Upload-Arrays, Lade-Zustände, i18n Dropdowns).
  - Eigenes schlankes Design aus SVG-Icons und dem typischen Vinted "Teal"-Farb-Schema.
- **Backend:** Python (FastAPI)
  - Bereitet die Bilderpakete auf und füttert sie via API an Google Cloud.
  - Setzt einen robusten Bracket-Parser auf den Output, da KIs oft unerwünschten Gesprächs-Müll generieren. So landet immer exakt bereinigtes Inhalts-JSON beim React-Client.
- **Deployment:** Serverless via **Google Cloud Run**
  - **Docker:** Beide Systemhälften (API & Frontend) sind sauber in Alpine-Containern verpackt.
  - **Nginx Reverse Proxy:** Das Frontend wird über einen echten Nginx ausgeliefert. Dieser fungiert dank Dynamischem Template (`envsubst`) gleichzeitig als Reverse Proxy (`/api/*`), wodurch sämtliche CORS-Fehler elegant umgangen werden.
  - **Große Payload-Toleranz:** Der Nginx Proxy ist auf `client_max_body_size 32M;` hochgezüchtet, um problemlos Bulk-Uploads großer Smartphone-Bilder an die KI weiterzuleiten!

---

## 🚀 Setup & Ausführung (Lokal)

### Voraussetzungen
- Node.js (React)
- Python 3.11+ (FastAPI)
- Google Cloud CLI (`gcloud`) mit aktiviertem Projekt (Vertex AI API Zugriffsrechte)

### 1. Backend Starten
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 main.py
```
*(Das API-Backend lauscht jetzt auf `localhost:8080`)*

### 2. Frontend Starten
```bash
cd frontend
npm install
npm run dev
```
*(Das React Frontend ist auf `localhost:3000` erreichbar und routet `/api`-Aufrufe vollautomatisiert an das Backend)*

### 3. Serverless Cloud Deployment
Das Repository enthält ein zentrales Bash-Skript (`deploy.sh`), das das Build-Vorgang für Backend & Frontend automatisiert und die Cloud Run Nginx-Container dynamisch miteinander verschaltet!

```bash
chmod +x deploy.sh
./deploy.sh
```

---
*Gebaut mit ❤️*
