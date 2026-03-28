import os
print("Testing vertexai SDK...")
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel, Tool, grounding, GenerationConfig
    vertexai.init()
    
    # Try different tools combinations
    tools = []
    try:
        tools = [Tool.from_google_search_retrieval(grounding.GoogleSearch())]
        print("Success evaluating Tool.from_google_search_retrieval(grounding.GoogleSearch())")
    except Exception as e:
        print("Failed grounding.GoogleSearch():", e)
        
    try:
        tools = [Tool.from_google_search_retrieval(grounding.GoogleSearchRetrieval())]
    except Exception as e:
        print("Failed grounding.GoogleSearchRetrieval():", e)
        
    model = GenerativeModel(
        model_name="gemini-2.0-flash-001",
        tools=tools
    )
    print("Executing generate_content...")
    response = model.generate_content("Was ist der Preis eines iPhone 15 Pro?")
    print("Vertex AI Response:", response.text[:50])
except Exception as e:
    print("Vertex AI Exception:", e)

print("\n----------------\nTesting google-genai SDK...")
try:
    from google import genai
    from google.genai import types
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    client = genai.Client(vertexai=True, project=project, location="europe-west1")
    config = types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    )
    res = client.models.generate_content(
        model="gemini-2.0-flash-001",
        contents="Was ist der Preis eines iPhone 15 Pro Max?",
        config=config
    )
    print("GenAI Response:", res.text[:50])
except Exception as e:
    print("GenAI Exception:", e)
