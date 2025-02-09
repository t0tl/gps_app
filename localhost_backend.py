from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import json
import hashlib
import aiofiles
import pydantic
import requests
from dotenv import load_dotenv
import time

load_dotenv()

# Constants
PORT = 3103
OPENAI_VISION_MODEL = "gpt-4o"
GEMINI_MODEL = "google/gemini-2.0-flash-001"
COMPLETIONS_ENDPOINT = "https://api.openai.com/v1/chat/completions"
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
PRE_PROMPT = "Is there anything that might be dangerous or harmful to an individual in the image? Answer in 1024 chars max. If you go beyond that, the user will not be able to see the response."

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # More permissive for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VisionRequest(pydantic.BaseModel):
    imageUrl: str

@app.get("/api/status")
async def status():
    return JSONResponse(content="Server Up!", status_code=200)

@app.options("/api/vision")
async def handle_vision_request(request: VisionRequest):
    return JSONResponse(content="Server Up!", status_code=200)

@app.post("/api/vision")
async def handle_vision_request(request: VisionRequest):
    try:
        print(time.time())
        print("Analyzing image")
        print(request.imageUrl[:30] + "...")
        for i in range(3):
            try:
                response_content = await analyze_image(request.imageUrl, error_prompt=f"Too long message, shorten to 1024 chars max.")
                break
            except Exception as e:
                print(f"Error: {str(e)}")
                if i >= 2:
                    print("Failed to analyze image")
                    return JSONResponse(
                        content={"error": "Internal Server Error"},
                        status_code=500
                    )
        # send response to new endpoint at https://t0tl--gps-backend-fastapi-app.modal.run
        requests.post(
            "https://t0tl--gps-backend-fastapi-app.modal.run/send_sms",
            json={"text": response_content}
        )
        return JSONResponse(content=response_content)
    except Exception as e:
        print(f"Error: {str(e)}")
        return JSONResponse(
            content={"error": "Internal Server Error"},
            status_code=500
        )

async def analyze_image(image_url: str, error_prompt: str):
    # Hash the image URL for caching
    hasher = hashlib.sha256()
    hasher.update(image_url.encode('utf-8'))
    hashed_image_url = hasher.hexdigest()
    if not os.path.exists("./cached_responses"):
        os.makedirs("./cached_responses")
    cache_path = f"./cached_responses/{hashed_image_url}.json"

    # Try to read from cache
    try:
        async with aiofiles.open(cache_path, mode='r') as f:
            cached_response = await f.read()
            return json.loads(cached_response)
    except:
        pass  # Continue if cache miss

    # Prepare request to OpenAI
    token = os.getenv("OPENAI_API_KEY")
    token = os.getenv("OPENROUTER_API_KEY")
    if not token:
        raise Exception("OPENAI_API_KEY not found in environment variables")

    body = {
        "model": GEMINI_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": (PRE_PROMPT + error_prompt) if error_prompt else PRE_PROMPT},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ]
    }

    print("Sending request to Vision model")
    response = requests.post(
        OPENROUTER_ENDPOINT,
        json=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    print(response.json())
    if not response.ok:
        raise Exception(f"API request failed with status: {response.status_code}")

    data = response.json()

    # Save response to cache
    os.makedirs("./public/cached_responses", exist_ok=True)
    async with aiofiles.open(cache_path, mode='w') as f:
        await f.write(json.dumps(data))

    return data["choices"][0]["message"]["content"]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
