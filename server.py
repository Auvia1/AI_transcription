import asyncio
import json
import os
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import websockets
from dotenv import load_dotenv
from sarvamai import SarvamAI

load_dotenv()
API_KEY = os.getenv("SARVAM_API_KEY")
SARVAM_WS_URL = "wss://api.sarvam.ai/speech-to-text/ws"

app = FastAPI()

# Allow your friend's frontend to communicate with your backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change this to your friend's frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = SarvamAI(api_subscription_key=API_KEY)

@app.websocket("/ws/transcribe")
async def websocket_endpoint(client_ws: WebSocket):
    """Acts as a bridge between the Frontend and Sarvam AI."""
    await client_ws.accept()
    print("🟢 Frontend connected to WebSocket.")
    
    headers = {"api-subscription-key": API_KEY}
    query_params = "language-code=en-IN&input_audio_codec=pcm_s16le&sample_rate=16000"
    url = f"{SARVAM_WS_URL}?{query_params}"
    
    try:
        async with websockets.connect(url, additional_headers=headers) as sarvam_ws:
            
            # Task 1: Receive audio bytes from Frontend -> Send to Sarvam
            async def frontend_to_sarvam():
                try:
                    while True:
                        # Frontend sends raw PCM bytes
                        audio_data = await client_ws.receive_bytes()
                        
                        data_b64 = base64.b64encode(audio_data).decode('utf-8')
                        msg = {
                            "audio": {
                                "data": data_b64,
                                "sample_rate": 16000,
                                "encoding": "audio/wav"
                            }
                        }
                        await sarvam_ws.send(json.dumps(msg))
                except WebSocketDisconnect:
                    print("🔴 Frontend disconnected.")
                    # Tell Sarvam we are done
                    await sarvam_ws.send(json.dumps({"type": "flush"}))

            # Task 2: Receive transcripts from Sarvam -> Send to Frontend
            async def sarvam_to_frontend():
                try:
                    async for message in sarvam_ws:
                        response = json.loads(message)
                        
                        if response.get("type") == "data":
                            data = response.get("data", {})
                            text = data.get("transcript", "").strip()
                            
                            if text:
                                # Send clean JSON back to your friend's UI. Since Sarvam returns 
                                # completed segments on "data" events, we mark is_final as True.
                                payload = {"transcript": text, "is_final": True}
                                await client_ws.send_json(payload)
                                
                except websockets.exceptions.ConnectionClosed:
                    print("⚠️ Sarvam connection closed.")

            # Run both tasks simultaneously
            await asyncio.gather(frontend_to_sarvam(), sarvam_to_frontend())
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        await client_ws.close()

# Add your SOAP generation as a standard REST endpoint
@app.post("/generate-soap")
async def generate_soap_endpoint(transcript_data: dict):
    full_text = transcript_data.get("transcript", "")
    
    response = client.chat.completions(
        model="sarvam-105b", 
        messages=[
            {
                "role": "system",
                "content": "You are an expert clinical AI scribe. Translate the transcript into a markdown SOAP note."
            },
            {
                "role": "user",
                "content": f"Transcript:\n\n{full_text}"
            }
        ],
        temperature=0.1,
    )
    
    import re
    output = response.choices[0].message.content
    clean_output = re.sub(r'<think>.*?</think>', '', output, flags=re.DOTALL).strip()
    return {"soap_note": clean_output}

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)