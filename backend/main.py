"""
Vinted Listing Agent - API Server
=================================

Lokaler Start:
    export GOOGLE_CLOUD_PROJECT="dein-projekt"
    uvicorn main:app --reload --port 8080

API Docs:
    http://localhost:8080/docs
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List

from agent import VintedListingAgent


# =============================================================================
# Config
# =============================================================================

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "europe-west1")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# Request Models
# =============================================================================

class ImproveRequest(BaseModel):
    description: str = Field(..., description="Die aktuelle Beschreibung")
    style: str = Field(default="shorter", description="Der gewünschte Stil (shorter, longer, emotional, professional)")
    lang: str = Field(default="de", description="Zielsprache (de, en, fr...)")


class RegenerateRequest(BaseModel):
    context: dict = Field(..., description="Die bisher generierten Daten des Listings (Kategorie, Marke, Farbe etc.)")
    lang: str = Field(default="de", description="Zielsprache (de, en, fr...)")

class ReviseRequest(BaseModel):
    current_listing: dict = Field(..., description="Das gesamte aktuelle Vinted-Listing im JSON-Format")
    instruction: str = Field(..., description="Nutzer-Anweisung zur Änderung (z.B. 'Mache den Titel kürzer')")
    lang: str = Field(default="de", description="Zielsprache (de, en, fr...)")


# =============================================================================
# App
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup & Shutdown."""
    if not PROJECT_ID:
        raise ValueError(
            "GOOGLE_CLOUD_PROJECT nicht gesetzt!\n"
            "export GOOGLE_CLOUD_PROJECT='dein-projekt'"
        )
    
    logger.info(f"🚀 Starte mit Projekt: {PROJECT_ID}, Region: {LOCATION}")
    app.state.agent = VintedListingAgent(project_id=PROJECT_ID, location=LOCATION)
    logger.info("✅ Agent bereit")
    
    yield
    
    logger.info("👋 Server beendet")


app = FastAPI(
    title="Vinted Listing Agent",
    description="KI-Agent für optimierte Vinted-Listings",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
allowed_origin = os.getenv("ALLOWED_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin] if allowed_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/")
async def root():
    return {
        "name": "Vinted Listing Agent",
        "status": "running",
        "project": PROJECT_ID
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/analyze")
async def analyze(request: Request, files: List[UploadFile] = File(...), hints: Optional[str] = Form(None), lang: str = Form("de")):
    """
    Analysiert mehrere Produktbilder und erzwingt die Ausgabe in `lang`.
    """
    # Validierung
    image_list = []
    
    if len(files) > 10:
        raise HTTPException(400, "Maximal 10 Bilder erlaubt.")
        
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            continue # Ignoriere falsche typen leise oder wirf Fehler. Hier: Ignorieren, wenn es versehentlich PDFs etc sind, oder einfach restriktiver sein.
            
        contents = await file.read()
        
        if len(contents) > MAX_FILE_SIZE:
             raise HTTPException(400, "Eine Datei ist zu groß (max 10MB)")
             
        image_list.append({"data": contents, "mime_type": file.content_type})
    
    if not image_list:
        raise HTTPException(400, f"Kein gültiges Bild gefunden. Erlaubt: {ALLOWED_TYPES}")
        
    logger.info(f"📸 Analysiere {len(image_list)} Bilder")
    
    try:
        agent: VintedListingAgent = request.app.state.agent
        result = agent.analyze_image(image_list, hints, lang)
        
        if "error" in result:
            raise HTTPException(500, result["error"])
        
        logger.info(f"✅ Fertig: {result.get('titel', '?')}")
        return JSONResponse(result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Fehler bei Analyse")
        raise HTTPException(500, str(e))


@app.post("/improve")
async def improve(request: Request, data: ImproveRequest):
    """Verbessert eine Beschreibung."""
    if not data.description:
        raise HTTPException(400, "Keine Beschreibung")
    
    try:
        agent: VintedListingAgent = request.app.state.agent
        improved_text = agent.improve_description(data.description, data.style, data.lang)
        
        if "Fehler bei der" in improved_text:
            raise HTTPException(500, improved_text)
        
        return {
            "original": data.description,
            "improved": improved_text,
            "style": data.style,
            "lang": data.lang
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/regenerate")
async def regenerate(request: Request, data: RegenerateRequest):
    """Generiert Titel oder Hashtags neu."""
    try:
        agent: VintedListingAgent = request.app.state.agent
        
        if data.field == "title":
            result = agent.regenerate_title(data.context)
        else:
            raise HTTPException(400, "Nur 'title' unterstützt")
        
        return {"field": data.field, "value": result}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/revise")
async def revise(request: Request, data: ReviseRequest):
    """Nimmt das aktuelle Listing-JSON und einen Änderungswunsch entgegen."""
    if not data.instruction:
        raise HTTPException(400, "Keine Anweisung")
    
    try:
        agent: VintedListingAgent = request.app.state.agent
        result = agent.revise_listing(data.current_listing, data.instruction, data.lang)
        
        if "error" in result:
            raise HTTPException(500, result["error"])
            
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8080))
    
    print(f"""
╔═══════════════════════════════════════════════╗
║     🏷️  Vinted Listing Agent                  ║
╠═══════════════════════════════════════════════╣
║  Server:  http://localhost:{port}              ║
║  Docs:    http://localhost:{port}/docs         ║
║  Projekt: {PROJECT_ID or 'NICHT GESETZT!'}
╚═══════════════════════════════════════════════╝
    """)
    
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)