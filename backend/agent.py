"""
Vinted Listing Agent - Vertex AI
================================

Der KI-Agent, der Produktbilder analysiert.
Nutzt das NEUE google-genai SDK für Google Cloud (Vertex AI),
da das alte vertexai-SDK die google_search_retrieval API veraltet hat.
"""

import os
import json
from typing import Optional

from google import genai
from google.genai import types

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
    Agent zur Erstellung von Vinted-Listings mit Live-Websuche.
    """
    
    def __init__(
        self, 
        project_id: str,
        location: str = "europe-west1"
    ):
        """
        Initialisiert den Agent mit google-genai (Vertex AI Modus).
        """
        self.project_id = project_id
        self.location = location
        self.client = genai.Client(vertexai=True, project=project_id, location=location)
        self.model_name = "gemini-2.0-flash-001"
        
        # Standardkonfiguration inkl. Google Search Tool
        self.default_config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
            top_p=0.9,
            max_output_tokens=2048,
            tools=[types.Tool(google_search=types.GoogleSearch())]
        )
    
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
                    return json.loads(json_str, strict=False)
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
        """
        try:
            # text blocks and Parts
            contents = []
            contents.append(ANALYSIS_PROMPT)
            
            for img in images:
                contents.append(
                    types.Part.from_bytes(
                        data=img["data"],
                        mime_type=img["mime_type"]
                    )
                )
            
            if hints and hints.strip():
                contents.append(
                    f"\n\nBEACHTE DIESE ZUSÄTZLICHEN HINWEISE DES VERKÄUFERS (zwingend in die Beschreibung integrieren!):\n{hints.strip()}"
                )
                
            contents.append(
                f"\n\nWICHTIGSTE REGEL ZUM SCHLUSS: Übersetze das GESAMTE generierte Listing KOMPLETT in die Sprache mit dem Code '{lang.upper()}'.\n"
                f"Die JSON-Keys ('titel', 'beschreibung', 'kategorie', 'marke', 'farbe' etc.) bleiben EXAKT wie vorgegeben auf Deutsch, damit mein Code sie lesen kann.\n"
                f"Aber ALLE dazugehörigen Werte (inklusive Titel, kompletter Beschreibung mit Disclaimer, Haupt-/Unterkategorie, Zustand, Farbe, Material und Hashtags) MÜSSEN zwingend und authentisch auf {lang.upper()} sein!\n"
                f"Beispiel: Wenn Sprache 'EN' ist, lautet der Wert für Zustand nicht 'Sehr gut', sondern 'Used - Excellent'. Die Farbe nicht 'Schwarz', sondern 'Black'."
            )
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=self.default_config
            )
            
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
            
            style_instruction = prompts.get(style, style)
            
            prompt = f"""
Beschreibung:
"{description}"

Aufgabe:
{style_instruction}

Antworte NUR mit der neuen Beschreibung.
Übersetze die neue Beschreibung ZWINGEND in die Sprache mit dem Code '{lang.upper()}'.
"""
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=self.default_config
            )
            return response.text.strip().strip('"')
        except:
            return description

    def revise_listing(self, current_listing: dict, instruction: str, lang: str = "de") -> dict:
        """Passt ein gesamtes Listing anhand einer textuellen Nutzeranweisung an und gibt es in der Zielsprache zurück."""
        try:
            listing_json_str = json.dumps(current_listing, indent=2, ensure_ascii=False)
            
            prompt = REVISE_PROMPT.format(
                current_listing=listing_json_str,
                instruction=instruction
            )
            prompt += f"\n\nÜbersetze das gesamte angepasste Listing, inklusive aller Fließtexte, Mängel, Titel und insbesondere auch den standardisierten rechtlichen Disclaimer am Ende KOMPLETT in die Sprache mit dem Code '{lang.upper()}'. Die JSON-Keys bleiben auf Deutsch (titel, beschreibung etc), aber die Werte MÜSSEN zwingend fließend und authentisch auf {lang.upper()} sein!"
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=self.default_config
            )
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
        exit(1)
    
    print(f"🧪 Teste Agent mit Projekt: {project} via google-genai SDK")
    
    agent = VintedListingAgent(project_id=project)
    
    test_desc = "Schöner Pullover, kaum getragen."
    improved = agent.improve_description(test_desc, "emotional")
    print(f"   Original: {test_desc}")
    print(f"   Verbessert (mit Search Access): {improved}")
    
    print("✅ GenAI Agent funktioniert fehlerfrei!")