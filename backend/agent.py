"""
Vinted Listing Agent - Vertex AI
================================

Der KI-Agent, der Produktbilder analysiert.
Nutzt Vertex AI (Google Cloud) statt der Consumer API.

Unterschied zu google-generativeai:
- Läuft auf Google Cloud Infrastruktur
- Enterprise-Features (Logging, Monitoring)
- Authentifizierung über Service Account
"""

import os
import json
import base64
import re
from typing import Optional

import vertexai
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig

from prompts import (
    SYSTEM_PROMPT,
    ANALYSIS_PROMPT,
    IMPROVE_SHORTER,
    IMPROVE_LONGER,
    IMPROVE_EMOTIONAL,
    IMPROVE_PROFESSIONAL,
    REVISE_PROMPT,
)


class VintedListingAgent:
    """
    Agent zur Erstellung von Vinted-Listings.
    
    Beispiel:
        agent = VintedListingAgent(project_id="mein-projekt")
        result = agent.analyze_image(image_bytes)
    """
    
    def __init__(
        self, 
        project_id: str,
        location: str = "europe-west1"
    ):
        """
        Initialisiert den Agent mit Vertex AI.
        
        Args:
            project_id: Google Cloud Project ID
            location: Region (europe-west1, us-central1, etc.)
        """
        # Vertex AI initialisieren
        vertexai.init(project=project_id, location=location)
        
        # Gemini Modell laden
        self.model = GenerativeModel(
            model_name="gemini-2.0-flash-001",
            system_instruction=SYSTEM_PROMPT,
            generation_config=GenerationConfig(
                temperature=0.7,
                top_p=0.9,
                max_output_tokens=2048,
            )
        )
        
        self.project_id = project_id
        self.location = location
    
    def _parse_json(self, text: str) -> dict:
        """Extrahiert JSON aus der Antwort durch Klammerzählen."""
        start_idx = text.find('{')
        if start_idx == -1:
            return {"error": "Kein JSON gefunden", "raw": text}
            
        bracket_count = 0
        for i in range(start_idx, len(text)):
            if text[i] == '{':
                bracket_count += 1
            elif text[i] == '}':
                bracket_count -= 1
                
            if bracket_count == 0:
                json_str = text[start_idx:i+1]
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError as e:
                    return {"error": f"JSON Error: {e}", "raw": text}
                    
        return {"error": "JSON ist unvollständig (fehlende schließende Klammer)", "raw": text}
    
    def analyze_image(
        self, 
        images: list, 
        hints: Optional[str] = None,
        lang: str = "de"
    ) -> dict:
        """
        Analysiert mehrere Produktbilder.
        
        Args:
            images: Liste von dicts {"data": bytes, "mime_type": str}
            hints: Optionale Hinweise vom Verkäufer
            
        Returns:
            Dictionary mit Listing-Daten
        """
        try:
            prompt_parts = [ANALYSIS_PROMPT]
            
            for img in images:
                prompt_parts.append(Part.from_data(
                    data=img["data"],
                    mime_type=img["mime_type"]
                ))
            
            if hints and hints.strip():
                prompt_parts.append(
                    f"\n\nBEACHTE DIESE ZUSÄTZLICHEN HINWEISE DES VERKÄUFERS (zwingend in die Beschreibung integrieren!):\n{hints.strip()}"
                )
                
            prompt_parts.append(
                f"\n\nWICHTIGSTE REGEL ZUM SCHLUSS: Übersetze das gesamte generierte Listing, inklusive aller Fließtexte, Mängel, Titel und insbesondere auch den standardisierten rechtlichen Disclaimer am Ende KOMPLETT in die Sprache mit dem Code '{lang.upper()}'. Die JSON-Keys bleiben auf Deutsch (titel, beschreibung etc), aber die Werte MÜSSEN zwingend fließend und authentisch auf {lang.upper()} sein!"
            )
            
            # Anfrage senden
            response = self.model.generate_content(prompt_parts)
            
            # Antwort parsen
            return self._parse_json(response.text)
            
        except Exception as e:
            return {
                "error": str(e),
                "details": "Bildanalyse fehlgeschlagen"
            }
    
    def improve_description(self, description: str, style: str, lang: str = "de") -> str:
        """Verbessert und übersetzt eine bestehende Beschreibung passend zum Stil."""
        try:
            prompts = {
                "shorter": IMPROVE_SHORTER,
                "longer": IMPROVE_LONGER,
                "emotional": IMPROVE_EMOTIONAL,
                "professional": IMPROVE_PROFESSIONAL,
            }
            
            style_instruction = prompts.get(style, style) # Custom oder preset
            
            prompt = f"""
Beschreibung:
"{description}"

Aufgabe:
{style_instruction}

Antworte NUR mit der neuen Beschreibung.
Übersetze die neue Beschreibung ZWINGEND in die Sprache mit dem Code '{lang.upper()}'.
"""
            
            response = self.model.generate_content(prompt)
            return response.text.strip().strip('"')
        except:
            return description
    
    def regenerate_title(self, context: dict, lang: str = "de") -> str:
        """Erstellt einen neuen passenden Titel basierend auf dem Listing und übersetzt ihn auf lang."""
        try:
            prompt = f"""
Erstelle einen Vinted-Titel (max 50 Zeichen):
- Marke: {context.get('marke', '?')}
- Kategorie: {context.get('kategorie', '?')}
- Farbe: {context.get('farbe', '?')}
- Größe: {context.get('groesse', '?')}

Antworte NUR mit dem Titel.
Übersetze den Titel ZWINGEND in die Sprache mit dem Code '{lang.upper()}'.
"""
            response = self.model.generate_content(prompt)
            return response.text.strip().strip('"')
        except:
            return "Artikel zu verkaufen"

    def revise_listing(self, current_listing: dict, instruction: str, lang: str = "de") -> dict:
        """Passt ein gesamtes Listing anhand einer textuellen Nutzeranweisung an und gibt es in der Zielsprache zurück."""
        try:
            # JSON als lesbarer String
            listing_json_str = json.dumps(current_listing, indent=2, ensure_ascii=False)
            
            prompt = REVISE_PROMPT.format(
                current_listing=listing_json_str,
                instruction=instruction
            )
            prompt += f"\n\nÜbersetze das gesamte angepasste Listing, inklusive aller Fließtexte, Mängel, Titel und insbesondere auch den standardisierten rechtlichen Disclaimer am Ende KOMPLETT in die Sprache mit dem Code '{lang.upper()}'. Die JSON-Keys bleiben auf Deutsch (titel, beschreibung etc), aber die Werte MÜSSEN zwingend fließend und authentisch auf {lang.upper()} sein!"
            
            response = self.model.generate_content(prompt)
            return self._parse_json(response.text)
        except Exception as e:
            return {
                "error": str(e),
                "details": "Listing-Anpassung (Revise) fehlgeschlagen"
            }


# =============================================================================
# Test
# =============================================================================

if __name__ == "__main__":
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    
    if not project:
        print("❌ GOOGLE_CLOUD_PROJECT nicht gesetzt!")
        print("   export GOOGLE_CLOUD_PROJECT='dein-projekt'")
        exit(1)
    
    print(f"🧪 Teste Agent mit Projekt: {project}")
    
    agent = VintedListingAgent(project_id=project)
    
    # Test: Beschreibung verbessern
    test_desc = "Schöner Pullover, kaum getragen."
    improved = agent.improve_description(test_desc, "emotional")
    print(f"   Original: {test_desc}")
    print(f"   Verbessert: {improved}")
    
    print("✅ Agent funktioniert!")