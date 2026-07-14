import asyncio
import json
import os
import base64
import urllib.request
import urllib.error
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import websockets
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("SMALLEST_API_KEY") or os.getenv("SARVAM_API_KEY")
SMALLEST_WS_URL = "wss://api.smallest.ai/waves/v1/stt/live?model=pulse&language=hi&encoding=linear16&sample_rate=16000&diarize=true"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def call_smallest_llm(prompt: str) -> str:
    url = "https://api.smallest.ai/waves/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "electron",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }
    
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode("utf-8"), 
            headers=headers, 
            method="POST"
        )
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            choices = res_json.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "").strip()
            return "Error: Empty choices returned by Smallest AI model."
    except urllib.error.HTTPError as e:
        error_info = e.read().decode("utf-8")
        print(f"HTTP Error: {e.code} - {error_info}")
        return f"Error: Smallest AI API returned HTTP {e.code}. Details: {error_info}"
    except Exception as e:
        print(f"LLM Error: {e}")
        return f"Error calling Smallest AI API: {str(e)}"

def split_transcript_by_speaker(response: dict) -> list:
    words = response.get("words", [])
    if not words:
        text = response.get("transcript", "").strip()
        speaker = response.get("speaker")
        if speaker is None:
            speaker = 0
        return [{"transcript": text, "speaker": speaker}] if text else []
    
    segments = []
    current_speaker = None
    current_words = []
    
    for w in words:
        w_text = w.get("word", "")
        w_speaker = w.get("speaker")
        if w_speaker is None:
            w_speaker = response.get("speaker")
            if w_speaker is None:
                w_speaker = 0
        if current_speaker is None:
            current_speaker = w_speaker
            current_words.append(w_text)
        elif w_speaker == current_speaker:
            current_words.append(w_text)
        else:
            segment_text = " ".join(current_words).strip()
            if segment_text:
                segments.append({"transcript": segment_text, "speaker": current_speaker})
            current_speaker = w_speaker
            current_words = [w_text]
            
    segment_text = " ".join(current_words).strip()
    if segment_text:
        segments.append({"transcript": segment_text, "speaker": current_speaker})
        
    return segments

@app.websocket("/ws/transcribe")
async def websocket_endpoint(client_ws: WebSocket):
    """Acts as a bridge between the Frontend and Smallest AI."""
    await client_ws.accept()
    print(" Frontend connected to WebSocket.")
    
    headers = {"Authorization": f"Bearer {API_KEY}"}
    
    try:
        async with websockets.connect(SMALLEST_WS_URL, additional_headers=headers) as smallest_ws:
            
            # Task 1: Receive audio bytes from Frontend -> Send directly to Smallest AI
            async def frontend_to_smallest():
                try:
                    while True:
                        # Frontend sends raw PCM bytes
                        audio_data = await client_ws.receive_bytes()
                        await smallest_ws.send(audio_data)
                except WebSocketDisconnect:
                    print(" Frontend disconnected.")

            # Task 2: Receive transcripts from Smallest AI -> Send to Frontend
            async def smallest_to_frontend():
                try:
                    async for message in smallest_ws:
                        response = json.loads(message)
                        text = response.get("transcript", "").strip()
                        is_final = response.get("is_final", False)
                        
                        if text:
                            # Extract speaker ID (defaults to 0 if not found)
                            speaker_id = response.get("speaker")
                            if speaker_id is None:
                                words = response.get("words", [])
                                if words:
                                    speakers = [w.get("speaker") for w in words if w.get("speaker") is not None]
                                    if speakers:
                                        speaker_id = max(set(speakers), key=speakers.count)
                                    else:
                                        speaker_id = 0
                                else:
                                    speaker_id = 0
                            
                            segments = split_transcript_by_speaker(response)
                            payload = {
                                "transcript": text,
                                "is_final": is_final,
                                "speaker": speaker_id,
                                "segments": segments
                            }
                            await client_ws.send_json(payload)
                                
                except websockets.exceptions.ConnectionClosed:
                    print(" Smallest AI connection closed.")

            # Run both tasks simultaneously
            await asyncio.gather(frontend_to_smallest(), smallest_to_frontend())
            
    except Exception as e:
        print(f" Connection Error: {e}")
        await client_ws.close()

# Add your SOAP generation as a standard REST endpoint
@app.post("/generate-soap")
async def generate_soap_endpoint(transcript_data: dict):
    full_text = transcript_data.get("transcript", "")
    
    prompt = f"""[IMPORTANT: Keep your internal reasoning/thinking extremely concise (under 2 sentences) and proceed immediately to generating the final output. Do not analyze line-by-line.]
You are an expert clinical AI scribe. Your task is to transform the provided doctor-patient consultation transcript into a professional, structured, and medically accurate SOAP note.

Translate any code-mixed or informal medical dialogue into formal, standard medical English.

Strictly adhere to the following template structure:

S — SUBJECTIVE
----------------------------------------
Chief Complaint: [Primary reason for visit]
History of Present Illness: [Details of symptoms like duration, onset, severity, etc.]
Associated Symptoms: [Other reported symptoms or negative findings]

O — OBJECTIVE
----------------------------------------
Vitals: [If mentioned, otherwise "Not recorded"]
Physical Examination: [Observable findings if discussed, otherwise "Not examined"]

A — ASSESSMENT
----------------------------------------
Primary Diagnosis: [Clinical impression/diagnosis based on symptoms discussed]
Clinical Reasoning: [Brief reasoning or differentials like viral infection vs. bacterial]

P — PLAN
----------------------------------------
Medications: [Prescriptions with dosages and frequency if mentioned]
Instructions: [Rest, hydration, lifestyle changes discussed]
Follow-up: [When to return or expected recovery timeline]

---

Transcript:
{full_text}

OUTPUT CONSTRAINTS:
1. Do NOT invent or hallucinate any clinical information. If a field is not discussed in the transcript, state "Not discussed" or "None reported".
2. Do NOT output any intro, outro, explanations, thoughts, reasoning tags (like <think> or </think>), or conversational filler. Start directly with "S — SUBJECTIVE" and end with the Follow-up section."""

    clean_output = call_smallest_llm(prompt)
    return {"soap_note": clean_output}

@app.post("/generate-summary")
async def generate_summary_endpoint(transcript_data: dict):
    full_text = transcript_data.get("transcript", "")
    
    prompt = f"""[IMPORTANT: Keep your internal reasoning/thinking extremely concise (under 2 sentences) and proceed immediately to generating the final output. Do not analyze line-by-line.]
You are an expert clinical AI scribe. Your task is to summarize the following doctor-patient consultation transcript.
    
Provide a Hills-like concise, professional paragraph summary (3-4 sentences max) highlighting the patient's primary complaints, key discussion points, and immediate next steps.

Do NOT invent or hallucinate any clinical information.
Do NOT output any intro, outro, thoughts, reasoning tags (like <think> or </think>), or conversational filler. Start directly with the summary text.

Transcript:
{full_text}"""

    clean_output = call_smallest_llm(prompt)
    return {"summary": clean_output}

# Add prescription draft as a standard REST endpoint
@app.post("/generate-prescription-draft")
async def generate_prescription_draft_endpoint(transcript_data: dict):
    full_text = transcript_data.get("transcript", "")
    
    from datetime import datetime
    current_date = datetime.today().strftime('%Y-%m-%d')
    prompt = f"""[IMPORTANT: Keep your internal reasoning/thinking extremely concise (under 2 sentences) and proceed immediately to generating the final output. Do not analyze line-by-line.]
You are an expert clinical AI scribe. Your task is to extract medications and vitals discussed in the transcript and format a structured Prescription Draft.

Strictly adhere to the following template structure:

Patient Name: [Name if mentioned, else leave blank]
Age: [Age if mentioned, else leave blank]
Gender: [Gender if mentioned, else leave blank]
Date: {current_date}

Vitals:
---------------------------------
- Temperature: [If mentioned, else state "Not recorded"]
- Blood Pressure: [If mentioned, else state "Not recorded"]
- Heart Rate/Pulse: [If mentioned, else state "Not recorded"]
- SpO2: [If mentioned, else state "Not recorded"]
[Include any other vitals mentioned in the transcript]

Diagnosis:
---------------------------------
1. [Diagnosis Name if discussed, else state "None discussed"]

Medicines:
---------------------------------
[List each medicine mentioned in the transcript. Format it exactly as follows:]
1. [Medicine Name] [Dosage/Strength, e.g. 500 mg - if mentioned]
   - [Quantity/Form, e.g. 1 tablet]
   - [Frequency/Instructions, e.g. Twice daily after meals]
   - [Duration, e.g. 3 days]

[If no medicines were discussed in the transcript, state "No medicines discussed in this session."]

Instructions:
---------------------------------
- [Non-pharmacological advice discussed, like rest, hydration, avoidance of cold beverages, etc.]
- [If none discussed, state "None discussed"]

Follow-up:
---------------------------------
Visit again if:
- [Follow-up criteria or warning signs discussed, e.g. fever persists > 5 days]
- [If none discussed, state "None discussed"]

Doctor Notes:
---------------------------------
Generated by AI – Requires Doctor Verification

OUTPUT CONSTRAINTS:
1. Do NOT invent or hallucinate any clinical or medication details.
2. Do NOT output any intro, outro, thoughts, explanations, reasoning tags (like <think> or </think>), or conversational filler. Start directly with "Patient Name:" and you must end with the exact text:
Doctor Notes:
---------------------------------
Generated by AI – Requires Doctor Verification
Do not omit the Doctor Notes section or its verification disclaimer.

Transcript:
{full_text}"""

    clean_output = call_smallest_llm(prompt)
    return {"prescription_draft": clean_output}

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
