import asyncio
import websockets
import sounddevice as sd
import numpy as np
import threading
import json
import time
import os
import urllib.request
import urllib.error
from dotenv import load_dotenv

# =========================
# ENV SETUP
# =========================
load_dotenv()
API_KEY = os.getenv("SMALLEST_API_KEY") or os.getenv("SARVAM_API_KEY")

if not API_KEY:
    raise ValueError(" API key not found in .env")

SMALLEST_WS_URL = "wss://api.smallest.ai/waves/v1/stt/live?model=pulse&language=hi&encoding=linear16&sample_rate=16000&diarize=true"

# =========================
# CONFIG
# =========================
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SIZE = 1024  # Smaller chunks for lower latency

# Session state
transcript = []
is_recording = False

# Asyncio event loop and queue for cross-thread audio passing
loop = asyncio.new_event_loop()
audio_queue = asyncio.Queue()
audio_stream = None

# =========================
# LLM UTILITY
# =========================
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

# =========================
# AUDIO CAPTURE (Bridged to Async)
# =========================
def audio_callback(indata, frames, time_info, status):
    """Pushes audio directly from the sounddevice thread into the asyncio queue."""
    if is_recording:
        # Convert float32 to int16 PCM (Standard for WebSockets)
        audio_int16 = np.int16(np.clip(indata, -1.0, 1.0) * 32767)
        # Thread-safe insertion into the asyncio queue
        loop.call_soon_threadsafe(audio_queue.put_nowait, audio_int16.tobytes())

# =========================
# WEBSOCKET PIPELINE
# =========================
async def send_audio(websocket):
    """Pulls PCM audio from the queue and streams it directly to Smallest AI."""
    while is_recording or not audio_queue.empty():
        try:
            # Wait for audio chunks without blocking the event loop
            data = await asyncio.wait_for(audio_queue.get(), timeout=0.1)
            # Send raw binary bytes directly
            await websocket.send(data)
        except asyncio.TimeoutError:
            continue
        except websockets.exceptions.ConnectionClosed:
            break

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

async def receive_transcripts(websocket):
    """Listens for live transcripts from Smallest AI."""
    global transcript
    try:
        async for message in websocket:
            response = json.loads(message)
            is_final = response.get("is_final", False)
            
            if is_final:
                segments = split_transcript_by_speaker(response)
                for seg in segments:
                    seg_text = seg["transcript"]
                    seg_speaker = seg["speaker"]
                    speaker_name = "Doctor" if seg_speaker == 0 else "Patient"
                    speaker_prefix = f"[{speaker_name}]:"
                    
                    if transcript and transcript[-1].startswith(speaker_prefix):
                        existing_text = transcript[-1][len(speaker_prefix):].strip()
                        if existing_text.lower() != seg_text.lower() and not existing_text.lower().endswith(seg_text.lower()):
                            transcript[-1] = f"{speaker_prefix} {existing_text} {seg_text}"
                            print(f" {seg_text}", end="", flush=True)
                    else:
                        line = f"[{time.strftime('%H:%M:%S')}] [{speaker_name}]: {seg_text}"
                        transcript.append(f"{speaker_prefix} {seg_text}")
                        print(f"\n {line}", end="", flush=True)
                    
    except websockets.exceptions.ConnectionClosed:
        print("\n Smallest AI WebSocket connection closed.")


async def run_streaming_session():
    """Manages the full duplex WebSocket connection."""
    global is_recording, audio_stream

    # Clear any residual audio from previous sessions
    while not audio_queue.empty():
        try:
            audio_queue.get_nowait()
        except asyncio.QueueEmpty:
            break

    headers = {"Authorization": f"Bearer {API_KEY}"}
    
    try:
        async with websockets.connect(SMALLEST_WS_URL, additional_headers=headers) as websocket:
            send_task = asyncio.create_task(send_audio(websocket))
            receive_task = asyncio.create_task(receive_transcripts(websocket))
            
            # Run both tasks concurrently until the session ends
            await asyncio.gather(send_task, receive_task)
    except Exception as e:
        print(f"\n Streaming Error: {e}")
    finally:
        # Automatically clean up hardware resources if connection drops unexpectedly
        if is_recording:
            print("\n Connection lost. Stopping active session... Press Enter to return to menu.")
            is_recording = False
            if audio_stream:
                try:
                    audio_stream.stop()
                    audio_stream.close()
                except Exception:
                    pass

# =========================
# SOAP GENERATION
# =========================
def generate_soap():
    full_text = "\n".join(transcript)

    if not full_text.strip():
        print(" No transcript available to compile.")
        return

    print("\n COMPILING FULL TRANSCRIPT:\n")
    print(full_text)

    try:
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

        output = call_smallest_llm(prompt)
        print("\n====== GENERATED SOAP NOTES ======\n")
        print(output)

    except Exception as e:
        print(" SOAP Compilation Error:", e)

def generate_summary():
    full_text = "\n".join(transcript)

    if not full_text.strip():
        print(" No transcript available to summarize.")
        return

    print("\n Transmitting to Smallest AI LLM for Consultation Summary...\n")

    try:
        prompt = f"""[IMPORTANT: Keep your internal reasoning/thinking extremely concise (under 2 sentences) and proceed immediately to generating the final output. Do not analyze line-by-line.]
You are an expert clinical AI scribe. Your task is to summarize the following doctor-patient consultation transcript.
        
Provide a concise, professional paragraph summary (3-4 sentences max) highlighting the patient's primary complaints, key discussion points, and immediate next steps.

Do NOT invent or hallucinate any clinical information.
Do NOT output any intro, outro, thoughts, reasoning tags (like <think> or </think>), or conversational filler. Start directly with the summary text.

Transcript:
{full_text}"""

        output = call_smallest_llm(prompt)
        print("\n====== CONSULTATION SUMMARY ======\n")
        print(output)

    except Exception as e:
        print(" Summary Generation Error:", e)

def generate_prescription_draft():
    full_text = "\n".join(transcript)

    if not full_text.strip():
        print(" No transcript available to generate a prescription draft.")
        return

    print("\n Transmitting to Smallest AI LLM for Prescription Draft...\n")

    try:
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

        output = call_smallest_llm(prompt)
        print("\n====== PRECRIPTION DRAFT (DRAFT ONLY) ======\n")
        print(output)

    except Exception as e:
        print(" Prescription Draft Generation Error:", e)

# =========================
# SESSION CONTROL
# =========================
def start_session():
    global is_recording, transcript, audio_stream
    
    if is_recording:
        print(" Recording session is already live!")
        return

    print("\n Clinical Session Started. Speak into your microphone...")
    is_recording = True
    transcript.clear()

    # 1. Start the hardware audio capture
    audio_stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, dtype="float32", callback=audio_callback)
    audio_stream.start()

    # 2. Start the WebSocket asyncio loop in a background thread so it doesn't block the CLI
    def start_background_loop():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run_streaming_session())

    threading.Thread(target=start_background_loop, daemon=True).start()

def end_session():
    global is_recording, audio_stream

    if not is_recording:
        print(" No active session running.")
        return

    print("\n Stopping Capture Pipelines...")
    is_recording = False

    # Stop and close the hardware stream
    if audio_stream:
        audio_stream.stop()
        audio_stream.close()

    # Give the WebSocket a brief moment to process the final audio chunks
    time.sleep(1.5)

    print("\n Transmitting to Smallest AI LLM for SOAP Notes...\n")
    generate_soap()
    generate_summary()
    generate_prescription_draft()

# =========================
# MAIN ENTRY
# =========================
def main():
    while True:
        if not is_recording:
            print("\n1. Start Session")
            print("3. Exit Application")
            choice = input("Select an option: ")
            if choice == "1":
                start_session()
            elif choice == "3":
                break
        else:
            print("\n SESSION LIVE | Enter '2' to stop and generate SOAP Note:")
            choice = input()
            if choice == "2":
                end_session()

if __name__ == "__main__":
    main()