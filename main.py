import asyncio
import websockets
import sounddevice as sd
import numpy as np
import threading
import json
import time
import os
from dotenv import load_dotenv
from sarvamai import SarvamAI

# =========================
# ENV SETUP
# =========================
load_dotenv()
API_KEY = os.getenv("SARVAM_API_KEY")

if not API_KEY:
    raise ValueError(" API key not found in .env")

client = SarvamAI(api_subscription_key=API_KEY)
SARVAM_WS_URL = "wss://api.sarvam.ai/speech-to-text/ws"

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
    """Pulls PCM audio from the queue and streams it to Sarvam."""
    import base64
    while is_recording or not audio_queue.empty():
        try:
            # Wait for audio chunks without blocking the event loop
            data = await asyncio.wait_for(audio_queue.get(), timeout=0.1)
            
            # Encode PCM bytes to base64
            data_b64 = base64.b64encode(data).decode('utf-8')
            
            # Format as AudioMessage JSON
            msg = {
                "audio": {
                    "data": data_b64,
                    "sample_rate": SAMPLE_RATE,
                    "encoding": "audio/wav"
                }
            }
            await websocket.send(json.dumps(msg))
        except asyncio.TimeoutError:
            continue
        except websockets.exceptions.ConnectionClosed:
            break

    # Send flush signal once recording stops and queue is empty
    try:
        flush_msg = {"type": "flush"}
        await websocket.send(json.dumps(flush_msg))
    except Exception:
        pass

async def receive_transcripts(websocket):
    """Listens for live transcripts and handles clinical speaker diarization."""
    global transcript
    try:
        async for message in websocket:
            response = json.loads(message)
            
            # Handle the nested structure of the Sarvam WebSocket response
            if response.get("type") == "data":
                data = response.get("data", {})
                text_chunk = data.get("transcript", "")
                
                if not text_chunk:
                    continue

                sentence = text_chunk.strip()
                
                line = f"[{time.strftime('%H:%M:%S')}] {sentence}"
                
                # Deduplication logic
                if not transcript or (transcript and sentence.lower() not in transcript[-1].lower()):
                    transcript.append(line)
                    print(f"\n {line}")
            elif response.get("type") == "error":
                error_msg = response.get("data", {}).get("message", "Unknown error")
                print(f"\n Server Error: {error_msg}")
            else:
                continue
                
    except websockets.exceptions.ConnectionClosed:
        print("\n Sarvam WebSocket connection closed.")


async def run_streaming_session():
    """Manages the full duplex WebSocket connection."""
    global is_recording, audio_stream

    # Clear any residual audio from previous sessions
    while not audio_queue.empty():
        try:
            audio_queue.get_nowait()
        except asyncio.QueueEmpty:
            break

    headers = {"api-subscription-key": API_KEY}
    # Pass necessary query parameters for speech-to-text streaming
    query_params = "language-code=en-IN&input_audio_codec=pcm_s16le&sample_rate=16000"
    url = f"{SARVAM_WS_URL}?{query_params}"
    
    try:
        async with websockets.connect(url, additional_headers=headers) as websocket:
            send_task = asyncio.create_task(send_audio(websocket))
            receive_task = asyncio.create_task(receive_transcripts(websocket))
            
            # Run both tasks concurrently until the session ends
            await asyncio.gather(send_task, receive_task)
    except Exception as e:
        print(f"\n Streaming Error: {e}")
    finally:
        # Automatically clean up hardware resources if connection drops unexpectedly
        if is_recording:
            print("\n⚠️ Connection lost. Stopping active session... Press Enter to return to menu.")
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
        response = client.chat.completions(
            model="sarvam-105b", 
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert clinical AI scribe. Translate any code-mixed medical dialogue "
                        "into a formal, professional English SOAP note. Output markdown format. "
                        "Do not include thoughts, reasoning tags like <think>, or conversational filler."
                    )
                },
                {
                    "role": "user",
                    "content": f"Convert the following doctor-patient transcript into standard clinical SOAP notes:\n\n{full_text}"
                }
            ],
            temperature=0.1,
        )

        print("\n====== GENERATED SOAP NOTES ======\n")
        output = response.choices[0].message.content
        import re
        output = re.sub(r'<think>.*?</think>', '', output, flags=re.DOTALL).strip()
        print(output)

    except Exception as e:
        print(" SOAP Compilation Error:", e)

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

    print("\n Transmitting to Sarvam LLM for SOAP Notes...\n")
    generate_soap()

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