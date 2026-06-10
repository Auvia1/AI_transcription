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
    
    prompt = f"""You are an expert clinical AI scribe. Your task is to transform the provided doctor-patient consultation transcript into a professional, structured, and medically accurate SOAP note in Markdown.

Translate any code-mixed or informal medical dialogue into formal, standard medical English.

Strictly adhere to the following Markdown template structure:

# Clinical SOAP Note

## Subjective (S)
- **Complaint:** [Primary reason for visit]
- **History of Present Illness (HPI):** [Details of symptoms like duration, onset, severity, etc.]
- **Associated Symptoms:** [Other reported symptoms or negative findings]

## Objective (O)
- **Vitals:** [If mentioned, otherwise "Not recorded"]
- **Physical Exam Findings:** [Observable findings if discussed, otherwise "Not examined"]

## Assessment (A)
- **Primary Diagnosis:** [Clinical impression/diagnosis based on symptoms discussed]
- **Differential Diagnosis / Clinical Reasoning:** [Brief reasoning or differentials like viral infection vs. bacterial]

## Plan (P)
- **Medications:** [Prescriptions with dosages and frequency if mentioned]
- **Interventions / Advice:** [Rest, hydration, lifestyle changes discussed]
- **Follow-up:** [When to return or expected recovery timeline]

---

Transcript:
{full_text}

OUTPUT CONSTRAINTS:
1. Do NOT invent or hallucinate any clinical information. If a section is not discussed in the transcript, state "Not discussed" or "None reported".
2. Do NOT output any intro, outro, explanations, thoughts, reasoning tags (like <think> or </think>), or conversational filler. Start directly with `# Clinical SOAP Note` and end with the Plan."""

    response = client.chat.completions(
        model="sarvam-105b", 
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.1,
    )
    
    output = response.choices[0].message.content
    clean_output = output.split('</think>')[-1].strip()
    return {"soap_note": clean_output}

# Add consultation summary as a standard REST endpoint
@app.post("/generate-summary")
async def generate_summary_endpoint(transcript_data: dict):
    full_text = transcript_data.get("transcript", "")
    
    prompt = f"""You are an expert clinical AI scribe. Your task is to summarize the following doctor-patient consultation transcript.
    
Provide a Hills-like concise, professional paragraph summary (3-4 sentences max) highlighting the patient's primary complaints, key discussion points, and immediate next steps.

Do NOT invent or hallucinate any clinical information.
Do NOT output any intro, outro, thoughts, reasoning tags (like <think> or </think>), or conversational filler. Start directly with the summary text.

Transcript:
{full_text}"""

    response = client.chat.completions(
        model="sarvam-105b", 
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.1,
    )
    
    output = response.choices[0].message.content
    clean_output = output.split('</think>')[-1].strip()
    return {"summary": clean_output}

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
