from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import json
import hashlib
import aiofiles
from datetime import datetime
import pydantic
import requests

# Constants
PORT = 3103
GPT_VISION_MODEL = "gpt-4-vision-preview"
COMPLETIONS_ENDPOINT = "https://api.openai.com/v1/chat/completions"
SAVED_DATA = "saved_data.json"
PRE_PROMPT = "Describe this image in detail"

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

@app.post("/api/gpt-4-vision")
async def handle_vision_request(request: VisionRequest):
    try:
        response_content = await analyze_image(request.imageUrl)
        await save_data(request.imageUrl, response_content)
        return JSONResponse(content=response_content)
    except Exception as e:
        print(f"Error: {str(e)}")
        return JSONResponse(
            content={"error": "Internal Server Error"},
            status_code=500
        )

async def analyze_image(image_url: str):
    # Hash the image URL for caching
    hasher = hashlib.sha256()
    hasher.update(image_url.encode('utf-8'))
    hashed_image_url = hasher.hexdigest()
    cache_path = f"./public/cached_responses/{hashed_image_url}.json"

    # Try to read from cache
    try:
        async with aiofiles.open(cache_path, mode='r') as f:
            cached_response = await f.read()
            return json.loads(cached_response)
    except:
        pass  # Continue if cache miss

    # Prepare request to OpenAI
    token = os.getenv("OPENAI_API_KEY")
    if not token:
        raise Exception("OPENAI_API_KEY not found in environment variables")

    body = {
        "model": GPT_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PRE_PROMPT},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ]
    }

    print("Sending request to GPT4 Vision")
    response = requests.post(
        COMPLETIONS_ENDPOINT,
        json=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )

    if not response.ok:
        raise Exception(f"API request failed with status: {response.status_code}")

    data = response.json()

    # Save response to cache
    os.makedirs("./public/cached_responses", exist_ok=True)
    async with aiofiles.open(cache_path, mode='w') as f:
        await f.write(json.dumps(data))

    return data["choices"][0]["message"]["content"]

async def save_data(image_url: str, description: str):
    print("Saving data")
    created_object = {
        "time": datetime.now().isoformat(),
        "imageDescription": description,
        "imageUrl": image_url
    }

    try:
        data = []
        try:
            print("Reading stored data")
            async with aiofiles.open(SAVED_DATA, mode='r') as f:
                stored_data = await f.read()
                data = json.loads(stored_data)
        except:
            print("Creating new data file")

        data.append(created_object)
        print("Writing new data")
        async with aiofiles.open(SAVED_DATA, mode='w') as f:
            await f.write(json.dumps(data))
    except Exception as e:
        raise Exception(f"Failed to write to file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
