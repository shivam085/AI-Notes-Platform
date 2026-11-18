from google import genai
from google.genai import types
from app.config import Settings

s = Settings.from_environment()
print("Model:", s.gemini_model)
print("API key configured:", bool(s.gemini_api_key))
try:
    with genai.Client(
        api_key=s.gemini_api_key,
        http_options=types.HttpOptions(timeout=s.gemini_request_timeout_ms),
    ) as client:
        r = client.models.generate_content(model=s.gemini_model, contents="Say hello in one word.")
        print("Response:", r.text)
except Exception as e:
    print("ERROR:", type(e).__name__, "status code:", getattr(e, "code", None))
