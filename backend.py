import modal
import os
import json
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
import googlemaps
import pydantic
from enum import Enum
import uuid
import requests

VERIFY_TOKEN = None
gmaps_client = None

class NavigationModes(str, Enum):
    WALKING = "walking"
    DRIVING = "driving"
    BICYCLING = "bicycling"
    TRANSIT = "transit"

web_app = FastAPI()

image = modal.Image.debian_slim(python_version="3.10").pip_install_from_requirements("requirements.txt")

app = modal.App(name="gps_backend")

class DirectionsRequest(pydantic.BaseModel):
    origin: list[float]  # latitude, longitude
    destination: str # name of destination "Los Angeles, CA"
    mode: NavigationModes = NavigationModes.WALKING

class LocationUpdate(pydantic.BaseModel):
    latitude: float
    longitude: float
    navigation_id: str  # To identify which navigation session this belongs to

# Store active navigation sessions
active_navigations = modal.Dict.from_name("active_navigations", create_if_missing=True)


def send_message(recipient_id: str, message_text: str):
    """Sends a message back to the Facebook user"""
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": message_text}
    }
    headers = {"Content-Type": "application/json"}
    params = {"access_token": PAGE_ACCESS_TOKEN}
    response = requests.post(FB_GRAPH_API_URL, json=payload, headers=headers, params=params)
    if response.status_code != 200:
        print("Error sending message:", response.text)


@web_app.get("/meta_webhook")
async def meta_webhook(r: Request):
    challenge = r.query_params.get("hub.challenge")
    token = r.query_params.get("hub.verify_token")
    mode = r.query_params.get("hub.mode")
    print(challenge, mode)

    if token != VERIFY_TOKEN:
        return JSONResponse(status_code=403, content={"error": "Verification failed"})
    if mode == "subscribe":
        return PlainTextResponse(content=challenge, status_code=200)
    return JSONResponse(status_code=400, content={"error": "Invalid mode"})

@web_app.post("/meta_webhook")
async def meta_webhook(request: Request):
    data = await request.json()
    print(data)
    if "object" in data and data["object"] == "page":
        for entry in data.get("entry", []):
            for messaging_event in entry.get("messaging", []):
                sender_id = messaging_event["sender"]["id"]
                if "message" in messaging_event:
                    message_text = messaging_event["message"].get("text", "")
                    send_message(sender_id, f"You said: {message_text}")
    return JSONResponse(status_code=200, content={"message": "Webhook received"})

@web_app.post("/directions")
async def directions(r: DirectionsRequest):
    # Request directions
    directions_result = gmaps_client.directions(r.origin, r.destination, mode=r.mode)
    
    if not directions_result:
        return JSONResponse(status_code=404, content={"error": "No directions found"})

    # Generate a unique navigation ID
    navigation_id = str(uuid.uuid4())
    
    # Store the navigation session
    active_navigations[navigation_id] = {
        "directions": directions_result[0],
        "current_leg_index": 0,
        "current_step_index": 0,
        "legs": directions_result[0]["legs"][0],
        "completed": False,
        "mode": r.mode  # Add the mode to the stored session
    }

    print(active_navigations)
    return {
        "navigation_id": navigation_id,
        "directions": directions_result,
        "next_instruction": directions_result[0]["legs"][0]["steps"][0]["html_instructions"]
    }

@web_app.post("/location_update")
async def update_location(location: LocationUpdate):
    if location.navigation_id not in active_navigations:
        return JSONResponse(status_code=404, content={"error": "Navigation session not found"})
    
    nav_session = active_navigations.get(location.navigation_id)
    if nav_session["completed"]:
        return {"status": "Navigation completed"}
    
    current_location = (location.latitude, location.longitude)
    legs = nav_session["legs"]
    current_step = legs["steps"][nav_session["current_step_index"]]
    
    # Check if user has reached the next step
    next_step_location = current_step["end_location"]
    distance_to_next = gmaps_client.distance_matrix(
        current_location,
        (next_step_location["lat"], next_step_location["lng"]),
        mode=nav_session["mode"]
    )
    
    # If within 30 meters of next step
    if distance_to_next["rows"][0]["elements"][0]["distance"]["value"] < 30:
        nav_session["current_step_index"] += 1
        
        # Check if we've completed all steps in current leg
        if nav_session["current_step_index"] >= len(legs["steps"]):
            nav_session["completed"] = True
            active_navigations.delete(location.navigation_id)
            return {
                "status": "Navigation completed",
                "instruction": "You have reached your destination"
            }
        
        # Get next instruction
        next_step = legs["steps"][nav_session["current_step_index"]]
        return {
            "status": "New instruction",
            "instruction": next_step["html_instructions"]
        }
    
    return {
        "status": "Continue",
        "instruction": current_step["html_instructions"]
    }

@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("googlecloud-secret"),
        modal.Secret.from_name("meta-secret"),
    ],
    allow_concurrent_inputs=20
    )
@modal.asgi_app()
def fastapi_app():
    print("🔹 Starting FastAPI app")
    global gmaps_client, VERIFY_TOKEN
    gmaps_client = googlemaps.Client(key=os.environ["MAPS_API_KEY"])
    VERIFY_TOKEN = os.environ["META_VERIFY_TOKEN"]
    return web_app
