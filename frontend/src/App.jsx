import React, { useState, useEffect, useRef } from 'react'

function App() {
  // Navigation & Screen View States
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('ascribe_logged_in') === 'true')
  const [activeView, setActiveView] = useState('consultation') // 'consultation' | 'results' | 'receptionist-intake' | 'receptionist-directory' | 'patients-directory'
  const [currentRole, setCurrentRole] = useState(() => localStorage.getItem('ascribe_current_role') || 'doctor') // 'doctor' | 'receptionist'
  
  // Patient Metadata States (for active consultation)
  const [patientName, setPatientName] = useState('New Patient')
  const [patientAge, setPatientAge] = useState('30')
  const [patientGender, setPatientGender] = useState('Male')
  const [patientContact, setPatientContact] = useState('')
  const [patientId, setPatientId] = useState(() => 'PAT-' + Math.floor(100000 + Math.random() * 900000))
  const [visitType, setVisitType] = useState('Initial Visit')
  const [patientReason, setPatientReason] = useState('')
  const [patientWeight, setPatientWeight] = useState('')
  const [patientTemp, setPatientTemp] = useState('')
  const [patientBP, setPatientBP] = useState('')
  const [patientPulse, setPatientPulse] = useState('')
  const [patientSpO2, setPatientSpO2] = useState('')

  // Selected Patient profile (loaded for doctor)
  const [selectedPatient, setSelectedPatient] = useState(null)
  
  // EMR Queue and Search states
  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem('ascribe_patients')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error("Error parsing patients list", e)
      }
    }
    return []
  })
  const [searchQueryPatient, setSearchQueryPatient] = useState('')

  // Receptionist Form States
  const [intakeName, setIntakeName] = useState('')
  const [intakeAge, setIntakeAge] = useState('')
  const [intakeGender, setIntakeGender] = useState('Male')
  const [intakeContact, setIntakeContact] = useState('')
  const [intakeVisitType, setIntakeVisitType] = useState('Initial Visit')
  const [intakeReason, setIntakeReason] = useState('')
  const [intakeWeight, setIntakeWeight] = useState('')
  const [intakeTemp, setIntakeTemp] = useState('')
  const [intakeBP, setIntakeBP] = useState('')
  const [intakePulse, setIntakePulse] = useState('')
  const [intakeSpO2, setIntakeSpO2] = useState('')

  // Recording State Management
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [transcriptLines, setTranscriptLines] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  // Processing Pipeline States
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState('transcribing') // 'transcribing' | 'soap' | 'summary' | 'prescription' | 'complete'

  // AI Generated Results States
  const [soapNote, setSoapNote] = useState('')
  const [summary, setSummary] = useState('')
  const [prescriptionDraft, setPrescriptionDraft] = useState('')
  const [editedPrescriptionText, setEditedPrescriptionText] = useState('')
  const [prescriptions, setPrescriptions] = useState([])
  const [editingSoap, setEditingSoap] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [editedSoapText, setEditedSoapText] = useState('')
  const [editedSummaryText, setEditedSummaryText] = useState('')
  const [interimSegments, setInterimSegments] = useState([])

  // Prescription Pad States
  const [padName, setPadName] = useState('')
  const [padAge, setPadAge] = useState('')
  const [padGender, setPadGender] = useState('')
  const [padDate, setPadDate] = useState('')
  const [padWeight, setPadWeight] = useState('')
  const [padDiagnosis, setPadDiagnosis] = useState('')
  const [padTemp, setPadTemp] = useState('')
  const [padBP, setPadBP] = useState('')
  const [padPulse, setPadPulse] = useState('')
  const [padSpO2, setPadSpO2] = useState('')
  const [padContent, setPadContent] = useState('')

  // Customizable Letterhead States
  const [hospitalName, setHospitalName] = useState(() => localStorage.getItem('ascribe_hospital_name') || '')
  const [hospitalLogo, setHospitalLogo] = useState(() => localStorage.getItem('ascribe_hospital_logo') || '')
  const [doctorNameText, setDoctorNameText] = useState(() => localStorage.getItem('ascribe_doctor_name') || '')
  const [hospitalAddress, setHospitalAddress] = useState(() => localStorage.getItem('ascribe_hospital_address') || '')
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false)

  // Hardware Audio & WebSocket Refs
  const socketRef = useRef(null)
  const audioContextRef = useRef(null)
  const scriptProcessorRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const timerRef = useRef(null)

  // Formatting Timer
  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
    const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
    const secs = (totalSeconds % 60).toString().padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  // Seed initial patient directory data in localStorage if not present
  useEffect(() => {
    const saved = localStorage.getItem('ascribe_patients')
    const seedPatients = [
      {
        id: 'PAT-644933',
        name: 'Govind Singh',
        age: '22',
        gender: 'Male',
        contact: '+91 9876543210',
        visitType: 'Follow-up Visit',
        reasonForVisit: 'Persistent cough and mild fever',
        weight: '68 kg',
        temp: '100.2 F',
        bp: '120/80',
        pulse: '82',
        spo2: '96%',
        history: [
          {
            date: '2026-06-20',
            visitType: 'Initial Visit',
            diagnosis: 'Acute Bronchitis',
            soapNote: 'S — SUBJECTIVE\n----------------------------------------\nChief Complaint: Dry hacking cough and fever for 3 days.\nHistory of Present Illness: Govind Singh is a 22-year-old male presenting with a productive cough and mild chest tightness.\n\nO — OBJECTIVE\n----------------------------------------\nVitals: Temp 100.2F, SpO2 96% on RA.\nPhysical Examination: Erythematous pharynx, bilateral Scattered rhonchi.\n\nA — ASSESSMENT\n----------------------------------------\nPrimary Diagnosis: Acute Bronchitis.\n\nP — PLAN\n----------------------------------------\nMedications: Azithromycin Z-Pak as directed. Albuterol inhaler.\nInstructions: Rest, hydration.',
            summary: 'The patient is a 22-year-old male complaining of a dry, hacking cough and mild fever for the past three days. Vitals show a temperature of 100.2F and SpO2 of 96% on room air. Lungs examination reveals bilateral rhonchi. He is diagnosed with acute bronchitis.',
            prescriptionDraft: 'Patient Name: Govind Singh\nAge: 22\nGender: Male\nDate: 2026-06-20\nWeight: 68 kg\n\nVitals:\n---------------------------------\n- Temperature: 100.2 F\n- Blood Pressure: 120/80\n- Heart Rate/Pulse: 82\n- SpO2: 96%\n\nDiagnosis:\n---------------------------------\n1. Acute Bronchitis\n\nMedicines:\n---------------------------------\n1. Azithromycin 250mg (Z-Pak)\n   - 1 tablet\n   - As directed on package\n   - 5 days'
          }
        ]
      },
      {
        id: 'PAT-482019',
        name: 'Emma Lopez',
        age: '32',
        gender: 'Female',
        contact: '+1 (555) 382-0192',
        visitType: 'Initial Visit',
        reasonForVisit: 'General checkup and low energy',
        weight: '58 kg',
        temp: '98.4 F',
        bp: '118/75',
        pulse: '70',
        spo2: '99%',
        history: []
      }
    ]

    if (!saved) {
      localStorage.setItem('ascribe_patients', JSON.stringify(seedPatients))
      setPatients(seedPatients)
    } else {
      try {
        setPatients(JSON.parse(saved))
      } catch (e) {
        localStorage.setItem('ascribe_patients', JSON.stringify(seedPatients))
        setPatients(seedPatients)
      }
    }
  }, [])

  // Timer Effect
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording, isPaused])

  // Helper: Get Time string
  const getTimestamp = () => {
    const now = new Date()
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  }

  // Prescription Pad Helpers
  const syncTextToPadFields = (text) => {
    if (!text) {
      setPadName(patientName || '')
      setPadAge(patientAge || '')
      setPadGender(patientGender || '')
      setPadDate(new Date().toISOString().split('T')[0])
      setPadWeight('')
      setPadDiagnosis('')
      setPadTemp('')
      setPadBP('')
      setPadPulse('')
      setPadSpO2('')
      setPadContent('')
      return
    }

    const lines = text.split('\n')
    let name = ''
    let age = ''
    let gender = ''
    let date = new Date().toISOString().split('T')[0]
    let weight = ''
    let diagnosis = ''
    let isDiagnosis = false
    let contentLines = []

    const extractVitalVal = (keyName) => {
      const regex = new RegExp(`-\\s*${keyName}\\s*:\\s*([^\n]+)`, 'i')
      const match = text.match(regex)
      if (match) {
        const val = match[1].trim()
        if (val.toLowerCase().includes('not recorded') || val.toLowerCase().includes('leave blank') || val.toLowerCase().includes('state "')) {
          return ''
        }
        return val
      }
      return ''
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('Patient Name:')) {
        name = line.replace('Patient Name:', '').trim()
        if (name.includes('[') || name.toLowerCase().includes('leave blank')) name = patientName || ''
      } else if (line.startsWith('Age:')) {
        age = line.replace('Age:', '').trim()
        if (age.includes('[') || age.toLowerCase().includes('leave blank')) age = patientAge || ''
      } else if (line.startsWith('Gender:')) {
        gender = line.replace('Gender:', '').trim()
        if (gender.includes('[') || gender.toLowerCase().includes('leave blank')) gender = patientGender || ''
      } else if (line.startsWith('Date:')) {
        date = line.replace('Date:', '').trim()
      } else if (line.startsWith('Weight:')) {
        weight = line.replace('Weight:', '').trim()
        if (weight.includes('[') || weight.toLowerCase().includes('not recorded')) weight = ''
      } else if (line.startsWith('Diagnosis:')) {
        isDiagnosis = true
        if (lines[i+1] && lines[i+1].includes('----')) i++
      } else if (isDiagnosis) {
        if (line.startsWith('Medicines:') || line.startsWith('Vitals:')) {
          isDiagnosis = false
          contentLines.push(lines[i])
        } else {
          const diagClean = line.replace(/^\d+\.\s*/, '').trim()
          if (!diagClean.toLowerCase().includes('none discussed') && !diagClean.toLowerCase().includes('[diagnosis')) {
            diagnosis += (diagnosis ? ' ' : '') + diagClean
          }
        }
      } else {
        if (line.startsWith('Vitals:') || (line.includes('----') && i > 0 && lines[i-1].trim().startsWith('Vitals:')) || line.startsWith('- Temperature:') || line.startsWith('- Blood Pressure:') || line.startsWith('- Heart Rate/') || line.startsWith('- SpO2:')) {
          continue
        }
        contentLines.push(lines[i])
      }
    }

    setPadName(name)
    setPadAge(age)
    setPadGender(gender)
    setPadDate(date)
    setPadWeight(weight)
    setPadDiagnosis(diagnosis)
    setPadTemp(extractVitalVal('Temperature'))
    setPadBP(extractVitalVal('Blood Pressure'))
    setPadPulse(extractVitalVal('Heart Rate/Pulse'))
    setPadSpO2(extractVitalVal('SpO2'))
    setPadContent(contentLines.join('\n').trim())
  }

  const compilePadToDraft = () => {
    const current_date = padDate || new Date().toISOString().split('T')[0]
    return `Patient Name: ${padName}
Age: ${padAge}
Gender: ${padGender}
Date: ${current_date}
Weight: ${padWeight || 'Not recorded'}

Vitals:
---------------------------------
- Temperature: ${padTemp || 'Not recorded'}
- Blood Pressure: ${padBP || 'Not recorded'}
- Heart Rate/Pulse: ${padPulse || 'Not recorded'}
- SpO2: ${padSpO2 || 'Not recorded'}

Diagnosis:
---------------------------------
1. ${padDiagnosis || 'None discussed'}

${padContent}`
  }

  // Helper: Download prescription draft as a file
  const downloadPrescriptionText = () => {
    let fileContent = '';
    let fileName = 'Prescription.txt';
    
    if (activeView === 'edit-prescription') {
      fileContent = compilePadToDraft();
      fileName = `Prescription_${padName.trim().replace(/\s+/g, '_') || 'Patient'}_${padDate}.txt`;
    } else {
      fileContent = prescriptionDraft || '';
      const nameMatch = fileContent.match(/Patient Name:\s*([^\n]+)/i);
      const patientNameStr = nameMatch ? nameMatch[1].trim().replace(/\s+/g, '_') : (patientName.replace(/\s+/g, '_') || 'Patient');
      const dateMatch = fileContent.match(/Date:\s*([^\n]+)/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0];
      fileName = `Prescription_${patientNameStr}_${dateStr}.txt`;
    }
    
    if (!fileContent.trim()) {
      alert("No prescription draft available to download.");
      return;
    }
    
    const element = document.createElement("a");
    const file = new Blob([fileContent], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Live audio recording and WS streaming
  const startSession = async () => {
    try {
      setSeconds(0)
      setTranscriptLines([])
      setInterimSegments([])
      setIsRecording(true)
      setIsPaused(false)
      setActiveView('consultation')

      // Set up WebSocket connection to FastAPI backend
      const wsUrl = `ws://${window.location.hostname}:8000/ws/transcribe`
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data)
        
        let segments = payload.segments
        if (!segments && payload.transcript) {
          segments = [{ transcript: payload.transcript, speaker: payload.speaker }]
        }
        
        if (segments && segments.length > 0) {
          const timestamp = getTimestamp()
          
          if (payload.is_final) {
            // Segment is finalized: clear interim states and commit to the permanent list
            setInterimSegments([])
            setTranscriptLines((prev) => {
              const newLines = segments.map(seg => {
                const speakerName = seg.speaker === 0 ? 'Doctor' : (seg.speaker === 1 ? 'Patient' : `Speaker ${seg.speaker}`)
                return { time: timestamp, speaker: speakerName, text: seg.transcript }
              })
              
              let filteredNewLines = newLines
              if (prev.length > 0) {
                const lastLine = prev[prev.length - 1]
                if (newLines.length > 0 && 
                    newLines[0].text.toLowerCase() === lastLine.text.toLowerCase() && 
                    newLines[0].speaker === lastLine.speaker) {
                  filteredNewLines = newLines.slice(1)
                }
              }
              
              if (filteredNewLines.length === 0) {
                return prev
              }
              
              const merged = [...prev]
              for (const line of filteredNewLines) {
                if (merged.length > 0 && merged[merged.length - 1].speaker === line.speaker) {
                  const last = { ...merged[merged.length - 1] }
                  const lastText = last.text.trim()
                  const lineText = line.text.trim()
                  
                  if (lastText.toLowerCase() === lineText.toLowerCase()) {
                    continue
                  }
                  if (lastText.toLowerCase().endsWith(lineText.toLowerCase())) {
                    continue
                  }
                  
                  last.text = `${lastText} ${lineText}`
                  merged[merged.length - 1] = last
                } else {
                  merged.push({ ...line })
                }
              }
              return merged
            })
          } else {
            // Segment is intermediate: update the real-time visual output
            const formattedInterim = segments.map(seg => {
              const speakerName = seg.speaker === 0 ? 'Doctor' : (seg.speaker === 1 ? 'Patient' : `Speaker ${seg.speaker}`)
              return { speaker: speakerName, transcript: seg.transcript }
            })
            setInterimSegments(formattedInterim)
          }
        }
      }

      socket.onerror = (err) => {
        console.error("WebSocket Error:", err)
      }

      // Request browser audio permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      // Native Web Audio downsampling to 16kHz
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const audioContext = new AudioCtx({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      
      // Mono channel script processor node
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
      scriptProcessorRef.current = scriptProcessor

      scriptProcessor.onaudioprocess = (event) => {
        if (isPaused) return

        const inputData = event.inputBuffer.getChannelData(0) // Float32 input Array
        
        // Convert Float32Array (-1.0 to 1.0) into Signed 16-bit PCM bytes
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        }
        
        // Push PCM buffer chunk over WebSocket
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(pcmData.buffer)
        }
      }

      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

    } catch (err) {
      console.error("Audio initialization failed:", err)
      setIsRecording(false)
      alert("Microphone permission denied or backend server is not reachable.")
    }
  }

  // Toggle Pause/Resume
  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  // Stop Recording & Fire REST Processing
  const stopSessionAndGenerate = async () => {
    setIsRecording(false)
    setIsPaused(false)
    setIsProcessing(true)
    setProcessingStep('transcribing')
    setInterimSegments([])

    // Teardown mic hardware node
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect()
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((track) => track.stop())
    if (audioContextRef.current) audioContextRef.current.close()
    if (socketRef.current) socketRef.current.close()

    // Compile entire conversation transcript
    const fullTranscriptText = transcriptLines.map(line => `[${line.speaker}]: ${line.text}`).join('\n')

    if (!fullTranscriptText.trim()) {
      alert("No transcript was recorded. Generating placeholder simulation for testing.")
      simulateClinicalPipeline()
      return
    }

    try {
      // Step 1: Generate SOAP Note
      setProcessingStep('soap')
      const soapResponse = await fetch('http://localhost:8000/generate-soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: fullTranscriptText })
      })
      const soapJson = await soapResponse.json()
      const returnedSoap = soapJson.soap_note || ''
      setSoapNote(returnedSoap)
      setEditedSoapText(returnedSoap)

      // Step 2: Generate Consultation Summary
      setProcessingStep('summary')
      const summaryResponse = await fetch('http://localhost:8000/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: fullTranscriptText })
      })
      const summaryJson = await summaryResponse.json()
      const returnedSummary = summaryJson.summary || ''
      setSummary(returnedSummary)
      setEditedSummaryText(returnedSummary)

      // Step 3: Generate Prescriptions
      setProcessingStep('prescription')
      const rxResponse = await fetch('http://localhost:8000/generate-prescription-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: fullTranscriptText })
      })
      const rxJson = await rxResponse.json()
      const returnedRx = rxJson.prescription_draft || ''
      setPrescriptionDraft(returnedRx)
      setEditedPrescriptionText(returnedRx)
      
      // Parse medicines from draft output text
      const parsed = parsePrescriptionsFromText(returnedRx)
      setPrescriptions(parsed)

      // Step 4: Finalize
      setProcessingStep('complete')
      setIsProcessing(false)
      setActiveView('results')

    } catch (err) {
      console.error("Clinical pipeline generation failed:", err)
      alert("Failed to connect to backend clinical API. Using simulated output instead.")
      simulateClinicalPipeline()
    }
  }

  // Parse Medication details out of the text block
  const parsePrescriptionsFromText = (text) => {
    if (!text) return []
    const lines = text.split('\n')
    const results = []
    let inMedicines = false
    let currentMed = null

    for (let line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('Medicines:')) {
        inMedicines = true
        continue
      }
      if (inMedicines && (trimmed.startsWith('Instructions:') || trimmed.startsWith('Follow-up:') || trimmed.startsWith('Doctor Notes:'))) {
        inMedicines = false
        break
      }
      if (inMedicines && trimmed.length > 0) {
        // Matches e.g. "1. Paracetamol 650 mg" or "2. Cough Syrup 5 ml"
        const medMatch = trimmed.match(/^\d+\.\s*(.+)$/)
        if (medMatch) {
          if (currentMed) results.push(currentMed)
          
          const medText = medMatch[1]
          // Simple split of name and strength if space separates them
          const words = medText.split(' ')
          const dosageCandidate = words.slice(-2).join(' ')
          const hasDosage = /\d+\s*(mg|ml|mcg|tablet|g)/i.test(dosageCandidate)

          currentMed = {
            id: Math.random().toString(36).substr(2, 9),
            medication: hasDosage ? words.slice(0, -2).join(' ') : medText,
            dosage: hasDosage ? dosageCandidate : 'Not mentioned',
            frequency: 'Once daily or as directed'
          }
        } else if (trimmed.startsWith('-') && currentMed) {
          const detail = trimmed.substring(1).trim()
          if (/tablet|ml|mcg|capsule|spoon/i.test(detail)) {
            currentMed.dosage = detail
          } else {
            currentMed.frequency = detail
          }
        }
      }
    }
    if (currentMed) results.push(currentMed)
    
    // Default fallback if parsing came up completely empty
    return results
  }

  // Simulate pipeline in case of errors / placeholder runs
  const simulateClinicalPipeline = () => {
    const nameVal = patientName || 'Jane Doe'
    const ageVal = patientAge || '32'
    const genderVal = patientGender || 'Female'

    setIsProcessing(true)
    setProcessingStep('soap')
    setTimeout(() => {
      setProcessingStep('summary')
      setTimeout(() => {
        setProcessingStep('prescription')
        setTimeout(() => {
          setSoapNote(`S — SUBJECTIVE\n----------------------------------------\nChief Complaint: Dry hacking cough and fever for 3 days.\nHistory of Present Illness: ${nameVal} is a ${ageVal}-year-old ${genderVal.toLowerCase()} presenting with a productive cough and mild chest tightness. Temperature recorded at 101.2F last night.\nAssociated Symptoms: Sore throat.\n\nO — OBJECTIVE\n----------------------------------------\nVitals: Temp 100.2F, SpO2 96% on RA.\nPhysical Examination: Erythematous pharynx, bilateral Scattered rhonchi.\n\nA — ASSESSMENT\n----------------------------------------\nPrimary Diagnosis: Acute Bronchitis.\nClinical Reasoning: None reported\n\nP — PLAN\n----------------------------------------\nMedications: Azithromycin Z-Pak as directed. Albuterol inhaler.\nInstructions: Rest, hydration.\nFollow-up: 5-7 days if symptoms persist.`)
          setEditedSoapText(`S — SUBJECTIVE\n----------------------------------------\nChief Complaint: Dry hacking cough and fever for 3 days.\nHistory of Present Illness: ${nameVal} is a ${ageVal}-year-old ${genderVal.toLowerCase()} presenting with a productive cough and mild chest tightness. Temperature recorded at 101.2F last night.\nAssociated Symptoms: Sore throat.\n\nO — OBJECTIVE\n----------------------------------------\nVitals: Temp 100.2F, SpO2 96% on RA.\nPhysical Examination: Erythematous pharynx, bilateral Scattered rhonchi.\n\nA — ASSESSMENT\n----------------------------------------\nPrimary Diagnosis: Acute Bronchitis.\nClinical Reasoning: None reported\n\nP — PLAN\n----------------------------------------\nMedications: Azithromycin Z-Pak as directed. Albuterol inhaler.\nInstructions: Rest, hydration.\nFollow-up: 5-7 days if symptoms persist.`)
          
          setSummary(`The patient is a ${ageVal}-year-old ${genderVal.toLowerCase()} complaining of a dry, hacking cough and mild fever for the past three days. Vitals show a temperature of 100.2F and SpO2 of 96% on room air. Lungs examination reveals bilateral rhonchi. She is diagnosed with acute bronchitis. The plan is to initiate Azithromycin and Albuterol inhaler, counsel on hydration/rest, and follow-up in 5 days if unimproved.`)
          setEditedSummaryText(`The patient is a ${ageVal}-year-old ${genderVal.toLowerCase()} complaining of a dry, hacking cough and mild fever for the past three days. Vitals show a temperature of 100.2F and SpO2 of 96% on room air. Lungs examination reveals bilateral rhonchi. She is diagnosed with acute bronchitis. The plan is to initiate Azithromycin and Albuterol inhaler, counsel on hydration/rest, and follow-up in 5 days if unimproved.`)
          setPrescriptionDraft(`Patient Name: ${nameVal}
Age: ${ageVal}
Gender: ${genderVal}
Date: ${new Date().toISOString().split('T')[0]}

Vitals:
---------------------------------
- Temperature: 100.2F
- Blood Pressure: 120/80 mmHg
- Heart Rate/Pulse: 82 bpm
- SpO2: 96% on RA

Diagnosis:
---------------------------------
1. Acute Bronchitis

Medicines:
---------------------------------
1. Azithromycin 250mg (Z-Pak)
   - 1 tablet
   - As directed on package
   - 5 days
2. Albuterol HFA 90mcg
   - 2 puffs
   - Q4H PRN
   - 7 days
3. Guaifenesin (OTC) 400mg
   - 1 tablet
   - PO Q4H PRN
   - 3 days

Instructions:
---------------------------------
- Rest and hydration
- Avoid cold beverages

Follow-up:
---------------------------------
Visit again if:
- Fever persists > 5 days or breathing worsens

Doctor Notes:
---------------------------------
Generated by AI – Requires Doctor Verification`)
          setEditedPrescriptionText(`Patient Name: ${nameVal}
Age: ${ageVal}
Gender: ${genderVal}
Date: ${new Date().toISOString().split('T')[0]}

Vitals:
---------------------------------
- Temperature: 100.2F
- Blood Pressure: 120/80 mmHg
- Heart Rate/Pulse: 82 bpm
- SpO2: 96% on RA

Diagnosis:
---------------------------------
1. Acute Bronchitis

Medicines:
---------------------------------
1. Azithromycin 250mg (Z-Pak)
   - 1 tablet
   - As directed on package
   - 5 days
2. Albuterol HFA 90mcg
   - 2 puffs
   - Q4H PRN
   - 7 days
3. Guaifenesin (OTC) 400mg
   - 1 tablet
   - PO Q4H PRN
   - 3 days

Instructions:
---------------------------------
- Rest and hydration
- Avoid cold beverages

Follow-up:
---------------------------------
Visit again if:
- Fever persists > 5 days or breathing worsens

Doctor Notes:
---------------------------------
Generated by AI – Requires Doctor Verification`)

          setPrescriptions([
            { id: '1', medication: 'Azithromycin', dosage: '250mg (Z-Pak)', frequency: 'As directed on package' },
            { id: '2', medication: 'Albuterol HFA', dosage: '90mcg', frequency: '2 puffs Q4H PRN' },
            { id: '3', medication: 'Guaifenesin (OTC)', dosage: '400mg', frequency: 'PO Q4H PRN' }
          ])
          setIsProcessing(false)
          setActiveView('results')
        }, 1000)
      }, 1000)
    }, 1000)
  }

  // Copy text helper
  const copyToEMR = () => {
    const combinedRecord = `CLINICAL CONSULTATION SUMMARY\n==============================\nPATIENT: ${patientName} (${patientGender}, Age: ${patientAge})\nDATE: ${new Date().toLocaleDateString()}\n\nSUMMARY:\n${editedSummaryText}\n\nSOAP NOTE:\n${editedSoapText}`
    navigator.clipboard.writeText(combinedRecord)
    alert("Full consultation details copied to clipboard!")
  }

  // Handle editable table row changes
  const updatePrescriptionRow = (id, field, value) => {
    setPrescriptions(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value }
      }
      return row
    }))
  }

  // Add empty prescription row
  const addPrescriptionRow = () => {
    setPrescriptions(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        medication: 'New Medication',
        dosage: 'Dosage details',
        frequency: 'Frequency instructions'
      }
    ])
  }

  // Filtered transcript search
  const filteredTranscript = transcriptLines.filter(line => 
    line.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
    line.speaker.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Animated Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/10 blur-[120px] pointer-events-none"></div>

        {/* Brand Header */}
        <div className="text-center mb-10 z-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-teal-500 text-white font-black text-3xl shadow-xl mb-4">
            A
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">AscribeMD</h1>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            AI-Powered Clinical Voice Scriber and Electronic Medical Record Portal
          </p>
        </div>

        {/* Portal Login Options Card */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl backdrop-blur-xl p-8 max-w-2xl w-full z-10">
          <h2 className="text-lg font-bold text-slate-200 text-center mb-6 uppercase tracking-wider">Select Portal Access</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Doctor Card */}
            <div 
              onClick={() => {
                setCurrentRole('doctor');
                setIsLoggedIn(true);
                localStorage.setItem('ascribe_current_role', 'doctor');
                localStorage.setItem('ascribe_logged_in', 'true');
                setActiveView('consultation');
              }}
              className="p-6 border border-slate-700 hover:border-primary/50 bg-slate-800/30 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all duration-300 flex flex-col gap-4 text-left group hover:-translate-y-1 shadow-lg"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[32px] fill">medical_services</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-lg group-hover:text-primary transition-colors">Doctor Portal</h3>
                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                  Record real-time clinical conversations, auto-generate SOAP notes, and edit prescription pad details.
                </p>
              </div>
              <div className="mt-auto pt-2 flex items-center gap-1.5 text-primary text-xs font-bold">
                Enter Portal
                <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </div>
            </div>

            {/* Receptionist Card */}
            <div 
              onClick={() => {
                setCurrentRole('receptionist');
                setIsLoggedIn(true);
                localStorage.setItem('ascribe_current_role', 'receptionist');
                localStorage.setItem('ascribe_logged_in', 'true');
                setActiveView('receptionist-intake');
              }}
              className="p-6 border border-slate-700 hover:border-teal-500/50 bg-slate-800/30 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all duration-300 flex flex-col gap-4 text-left group hover:-translate-y-1 shadow-lg"
            >
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[32px] fill">assignment_ind</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-lg group-hover:text-teal-400 transition-colors">Receptionist Portal</h3>
                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                  Perform patient intake registration, input vital readings, and manage patient queue directories.
                </p>
              </div>
              <div className="mt-auto pt-2 flex items-center gap-1.5 text-teal-400 text-xs font-bold">
                Enter Portal
                <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-slate-500 text-xs mt-8">
          AscribeMD Clinical Portal System v2.1.0 • Secure HIPAA-Compliant Environment
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col md:flex-row w-full">
      {/* TopNavBar (Mobile Only) */}
      <header className="md:hidden sticky top-0 z-50 flex justify-between items-center px-margin-mobile w-full h-16 bg-surface border-b border-outline-variant shrink-0">
        <div className="font-headline-md text-headline-md font-bold text-primary">AscribeMD</div>
        <div className="flex items-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined cursor-pointer">notifications</span>
          <span className="material-symbols-outlined cursor-pointer">menu</span>
        </div>
      </header>

      {/* SideNavBar (Desktop Only) */}
      <nav className="hidden md:flex flex-col h-screen w-72 fixed left-0 top-0 py-6 px-4 bg-surface-container-lowest border-r border-outline-variant shadow-sm z-40 shrink-0">
        <div className="mb-8 px-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary font-bold">A</div>
          <div>
            <div className="font-headline-sm text-headline-sm font-bold text-primary">AscribeMD</div>
            <div className="font-body-sm text-body-sm text-on-surface-variant">Clinical Assistant</div>
          </div>
        </div>

        {currentRole === 'receptionist' ? (
          <>
            <button 
              onClick={() => {
                setActiveView('receptionist-intake')
                setIntakeName('')
                setIntakeAge('')
                setIntakeGender('Male')
                setIntakeContact('')
                setIntakeVisitType('Initial Visit')
                setIntakeReason('')
                setIntakeWeight('')
                setIntakeTemp('')
                setIntakeBP('')
                setIntakePulse('')
                setIntakeSpO2('')
              }}
              className="mb-6 w-full py-3 px-4 bg-primary text-on-primary rounded-lg font-card-title text-card-title flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_2px_12px_rgba(0,0,0,0.06)] cursor-pointer"
            >
              <span className="material-symbols-outlined fill">person_add</span>
              Intake Registration
            </button>

            <div className="flex-1 flex flex-col gap-2">
              <a 
                onClick={() => setActiveView('receptionist-intake')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-body-sm text-body-sm cursor-pointer select-none transition-all duration-300 ${activeView === 'receptionist-intake' ? 'text-primary font-semibold bg-primary-container/10 border-l-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container hover:pl-5'}`}
              >
                <span className="material-symbols-outlined">assignment</span>
                Patient Intake
              </a>
              <a 
                onClick={() => setActiveView('receptionist-directory')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-body-sm text-body-sm cursor-pointer select-none transition-all duration-300 ${activeView === 'receptionist-directory' ? 'text-primary font-semibold bg-primary-container/10 border-l-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container hover:pl-5'}`}
              >
                <span className="material-symbols-outlined">group</span>
                Intake Directory
              </a>
            </div>
          </>
        ) : (
          <>
            <button 
              onClick={() => {
                setActiveView('consultation')
                setSoapNote('')
                setSummary('')
                setPrescriptions([])
                setSelectedPatient(null)
                setPatientName('')
                setPatientAge('')
                setPatientGender('Male')
                setPatientId('PAT-' + Math.floor(100000 + Math.random() * 900000))
                setVisitType('Initial Visit')
                setPatientContact('')
                setPatientReason('')
                setPatientWeight('')
                setPatientTemp('')
                setPatientBP('')
                setPatientPulse('')
                setPatientSpO2('')

                // Also reset pad editor details
                setPadName('')
                setPadAge('')
                setPadGender('Male')
                setPadDate(new Date().toISOString().split('T')[0])
                setPadWeight('')
                setPadTemp('')
                setPadBP('')
                setPadPulse('')
                setPadSpO2('')
                setPadDiagnosis('')
                setPadContent('')
              }}
              className="mb-6 w-full py-3 px-4 bg-primary text-on-primary rounded-lg font-card-title text-card-title flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_2px_12px_rgba(0,0,0,0.06)] cursor-pointer"
            >
              <span className="material-symbols-outlined fill">add</span>
              New Consultation
            </button>

            <div className="flex-1 flex flex-col gap-2">
              <a 
                onClick={() => setActiveView('consultation')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-body-sm text-body-sm cursor-pointer select-none transition-all duration-300 ${(activeView === 'consultation' || activeView === 'results') ? 'text-primary font-semibold bg-primary-container/10 border-l-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container hover:pl-5'}`}
              >
                <span className="material-symbols-outlined fill">emergency</span>
                Consultations
              </a>
              <a 
                onClick={() => setActiveView('patients-directory')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-body-sm text-body-sm cursor-pointer select-none transition-all duration-300 ${activeView === 'patients-directory' ? 'text-primary font-semibold bg-primary-container/10 border-l-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container hover:pl-5'}`}
              >
                <span className="material-symbols-outlined">group</span>
                Patients
              </a>
              <a 
                onClick={() => {
                  const activeDraftText = prescriptionDraft || '';
                  if (!activeDraftText.trim()) {
                    const current_date = new Date().toISOString().split('T')[0]
                    const defaultTemplate = `Patient Name: ${patientName}
Age: ${patientAge}
Gender: ${patientGender}
Date: ${current_date}
Weight: ${patientWeight || ''}

Vitals:
---------------------------------
- Temperature: ${patientTemp || ''}
- Blood Pressure: ${patientBP || ''}
- Heart Rate/Pulse: ${patientPulse || ''}
- SpO2: ${patientSpO2 || ''}

Diagnosis:
---------------------------------
1. None discussed

Medicines:
---------------------------------
No medicines discussed in this session.

Instructions:
---------------------------------
- None discussed

Follow-up:
---------------------------------
Visit again if:
- None discussed

Doctor Notes:
---------------------------------
Generated by AI – Requires Doctor Verification`
                    syncTextToPadFields(defaultTemplate)
                  } else {
                    syncTextToPadFields(activeDraftText)
                  }
                  setActiveView('edit-prescription')
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-body-sm text-body-sm cursor-pointer select-none transition-all duration-300 ${activeView === 'edit-prescription' ? 'text-primary font-semibold bg-primary-container/10 border-l-4 border-primary' : 'text-on-surface-variant hover:bg-surface-container hover:pl-5'}`}
                id="nav-edit-prescription"
              >
                <span className="material-symbols-outlined">edit_note</span>
                Edit Prescription
              </a>
            </div>
          </>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-outline-variant">
          <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container hover:pl-5 transition-all duration-300 font-body-sm text-body-sm cursor-pointer select-none">
            <span className="material-symbols-outlined">help</span>
            Help Center
          </a>
          <a 
            onClick={() => {
              setIsLoggedIn(false);
              localStorage.setItem('ascribe_logged_in', 'false');
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-error hover:bg-error-container/10 hover:pl-5 transition-all duration-300 font-body-sm text-body-sm cursor-pointer select-none"
          >
            <span className="material-symbols-outlined text-error">logout</span>
            Log Out
          </a>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 md:ml-72 flex flex-col h-screen overflow-hidden">
        {/* Consultation Header */}
        <header className="bg-surface-container-lowest border-b border-outline-variant px-margin-mobile md:px-margin-desktop py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 shadow-[0_2px_12px_rgba(0,0,0,0.02)] z-10">
          {currentRole === 'receptionist' ? (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <span className="px-2.5 py-1 bg-primary-container text-on-primary-container rounded-full font-data-label text-data-label uppercase tracking-wider font-bold">Reception Desk</span>
                <span className="font-data-label text-data-label text-on-surface-variant">AscribeMD EMR</span>
              </div>
              <div className="font-headline-sm text-headline-sm font-bold text-on-surface">
                {activeView === 'receptionist-intake' ? 'Patient Intake Form' : 'Intake Directory'}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-1">
                {activeView === 'patients-directory' ? (
                  <span className="px-2.5 py-1 bg-secondary-container text-on-secondary-container rounded-full font-data-label text-data-label font-bold">
                    EMR Registry
                  </span>
                ) : (
                  <select 
                    value={visitType} 
                    onChange={(e) => {
                      setVisitType(e.target.value);
                    }}
                    className="px-2.5 py-1 bg-secondary-container text-on-secondary-container rounded-full font-data-label text-[11px] font-bold border border-transparent focus:border-primary focus:outline-none cursor-pointer"
                  >
                    <option value="Initial Visit">Initial Visit</option>
                    <option value="Follow-up Visit">Follow-up Visit</option>
                    <option value="Routine Checkup">Routine Checkup</option>
                    <option value="Emergency Visit">Emergency Visit</option>
                  </select>
                )}
                {activeView !== 'patients-directory' && patientId && (
                  <div className="flex items-center gap-1">
                    <span className="font-data-label text-data-label text-on-surface-variant">ID:</span>
                    <input 
                      type="text" 
                      value={patientId} 
                      onChange={(e) => setPatientId(e.target.value)} 
                      className="font-data-label text-data-label text-on-surface-variant bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary focus:outline-none py-0.5 w-28 font-semibold text-xs text-center" 
                      placeholder="Patient ID"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeView === 'patients-directory' ? (
                  <div className="font-headline-sm text-headline-sm font-bold text-on-surface">Registered Patients Queue</div>
                ) : (
                  <>
                    <input 
                      type="text" 
                      value={patientName} 
                      onChange={(e) => {
                        setPatientName(e.target.value);
                        setPadName(e.target.value);
                      }} 
                      placeholder="Enter Patient Name..."
                      className="font-headline-sm text-headline-sm text-on-surface bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary focus:outline-none py-0.5 font-bold min-w-[200px]" 
                      title="Click to edit name"
                    />
                    <span className="text-outline-variant font-body-sm text-body-sm">•</span>
                    <span className="text-on-surface-variant font-body-sm text-body-sm flex items-center gap-1">
                      Age: 
                      <input 
                        type="text" 
                        value={patientAge} 
                        onChange={(e) => {
                          setPatientAge(e.target.value);
                          setPadAge(e.target.value);
                        }} 
                        placeholder="--"
                        className="w-12 bg-transparent border-b border-transparent focus:border-primary focus:outline-none py-0.5 text-center font-semibold" 
                      />
                    </span>
                    <span className="text-outline-variant font-body-sm text-body-sm">•</span>
                    <span className="text-on-surface-variant font-body-sm text-body-sm flex items-center gap-1">
                      Gender: 
                      <select 
                        value={patientGender || 'Male'} 
                        onChange={(e) => {
                          setPatientGender(e.target.value);
                          setPadGender(e.target.value);
                        }} 
                        className="bg-transparent border-b border-transparent focus:border-primary focus:outline-none py-0.5 font-semibold text-center text-sm cursor-pointer"
                      >
                        <option value="Male" className="text-on-surface">Male</option>
                        <option value="Female" className="text-on-surface">Female</option>
                        <option value="Other" className="text-on-surface">Other</option>
                      </select>
                    </span>
                    <span className="text-outline-variant font-body-sm text-body-sm">•</span>
                    <span className="text-on-surface-variant font-body-sm text-body-sm flex items-center gap-1">
                      Doctor: 
                      <input 
                        type="text" 
                        value={doctorNameText} 
                        onChange={(e) => {
                          setDoctorNameText(e.target.value);
                          localStorage.setItem('ascribe_doctor_name', e.target.value);
                        }} 
                        placeholder="Doctor Name"
                        className="w-36 bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary focus:outline-none py-0.5 text-center font-semibold text-primary" 
                      />
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
          
          {currentRole === 'doctor' && activeView === 'consultation' && (
            <div className="flex items-center gap-6 bg-surface-container-low px-6 py-3 rounded-xl border border-outline-variant/50">
              <div className="flex flex-col items-end">
                <span className="font-data-label text-data-label text-outline uppercase tracking-wider">Session Duration</span>
                <span className="font-transcript-text text-transcript-text font-bold text-primary tracking-widest text-lg" id="session-timer">
                  {formatTime(seconds)}
                </span>
              </div>
              <div className="w-px h-8 bg-outline-variant/50"></div>
              <div className={`flex items-center gap-2 ${isRecording && !isPaused ? 'text-error animate-pulse' : 'text-outline-variant'}`}>
                <span className="relative flex h-3 w-3">
                  {isRecording && !isPaused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isRecording && !isPaused ? 'bg-error' : 'bg-outline-variant'}`}></span>
                </span>
                <span className="font-body-sm text-body-sm font-medium">{isRecording && !isPaused ? 'LIVE' : 'STANDBY'}</span>
              </div>
            </div>
          )}

          {currentRole === 'receptionist' && (
            <button 
              onClick={() => setIsHeaderModalOpen(true)}
              className="px-4 py-2 bg-surface-container-low border border-outline-variant hover:bg-surface-container rounded-xl text-on-surface font-card-title text-card-title flex items-center gap-2 cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">settings_applications</span>
              Configure Hospital Profile
            </button>
          )}
        </header>

        {/* Workspace Content Area */}
        <div className="flex-1 overflow-y-auto bg-background p-margin-mobile md:p-margin-desktop relative">
          {activeView === 'receptionist-intake' ? (
            /* Receptionist Patient Intake Screen */
            <div className="max-w-container-max-width mx-auto flex flex-col gap-gutter">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">Patient Intake Registration</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    Record patient demographics, reasons for visit, and initial vital signs.
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="border-l-4 border-primary px-8 py-5 border-b border-outline-variant bg-surface">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">person_add</span>
                    Demographics & Visit Details
                  </h3>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!intakeName.trim() || !intakeContact.trim()) {
                    alert("Please fill in the Patient Name and Contact Number.");
                    return;
                  }
                  
                  const newPatient = {
                    id: 'PAT-' + Math.floor(100000 + Math.random() * 900000),
                    name: intakeName.trim(),
                    age: intakeAge.trim() || 'N/A',
                    gender: intakeGender,
                    contact: intakeContact.trim(),
                    visitType: intakeVisitType,
                    reasonForVisit: intakeReason.trim() || 'Routine Consultation',
                    weight: intakeWeight.trim() ? intakeWeight.trim() + ' kg' : '',
                    temp: intakeTemp.trim() ? intakeTemp.trim() + ' F' : '',
                    bp: intakeBP.trim() || '',
                    pulse: intakePulse.trim() || '',
                    spo2: intakeSpO2.trim() ? intakeSpO2.trim() + '%' : '',
                    history: [],
                    createdDate: new Date().toISOString().split('T')[0]
                  };

                  const updatedList = [newPatient, ...patients];
                  setPatients(updatedList);
                  localStorage.setItem('ascribe_patients', JSON.stringify(updatedList));
                  
                  // Reset form
                  setIntakeName('');
                  setIntakeAge('');
                  setIntakeGender('Male');
                  setIntakeContact('');
                  setIntakeVisitType('Initial Visit');
                  setIntakeReason('');
                  setIntakeWeight('');
                  setIntakeTemp('');
                  setIntakeBP('');
                  setIntakePulse('');
                  setIntakeSpO2('');

                  alert(`Patient ${newPatient.name} registered successfully! Patient ID: ${newPatient.id}`);
                  setActiveView('receptionist-directory');
                }} className="p-8 space-y-6">
                  {/* Row 1: Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Full Name *</label>
                      <input 
                        type="text"
                        value={intakeName}
                        onChange={(e) => setIntakeName(e.target.value)}
                        className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface focus:outline-none text-sm transition-all"
                        placeholder="e.g. Rahul Sharma"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Number *</label>
                      <input 
                        type="tel"
                        value={intakeContact}
                        onChange={(e) => setIntakeContact(e.target.value)}
                        className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface focus:outline-none text-sm transition-all"
                        placeholder="e.g. +91 98765 43210"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Age</label>
                        <input 
                          type="number"
                          value={intakeAge}
                          onChange={(e) => setIntakeAge(e.target.value)}
                          className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface focus:outline-none text-sm transition-all"
                          placeholder="e.g. 28"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gender</label>
                        <select 
                          value={intakeGender}
                          onChange={(e) => setIntakeGender(e.target.value)}
                          className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary bg-background text-on-surface focus:outline-none text-sm cursor-pointer transition-all"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Visit details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visit Type</label>
                      <select 
                        value={intakeVisitType}
                        onChange={(e) => setIntakeVisitType(e.target.value)}
                        className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary bg-background text-on-surface focus:outline-none text-sm cursor-pointer transition-all"
                      >
                        <option value="Initial Visit">Initial Visit</option>
                        <option value="Follow-up Visit">Follow-up Visit</option>
                        <option value="Routine Checkup">Routine Checkup</option>
                        <option value="Emergency Visit">Emergency Visit</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason for Visit / Complaint</label>
                      <input 
                        type="text"
                        value={intakeReason}
                        onChange={(e) => setIntakeReason(e.target.value)}
                        className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface focus:outline-none text-sm transition-all"
                        placeholder="e.g. Mild headache and fatigue for past two days"
                      />
                    </div>
                  </div>

                  {/* Vitals Separator */}
                  <div className="pt-4 border-t border-outline-variant">
                    <h4 className="font-headline-sm text-card-title text-primary mb-4 flex items-center gap-2 select-none">
                      <span className="material-symbols-outlined text-[20px]">thermostat</span>
                      Initial Vital Signs (Optional)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500">Temperature (°F)</label>
                        <input 
                          type="text" 
                          value={intakeTemp}
                          onChange={(e) => setIntakeTemp(e.target.value)}
                          placeholder="e.g. 98.6"
                          className="px-3 py-2 rounded-lg border border-outline-variant focus:border-primary focus:outline-none text-sm bg-background text-on-surface"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500">Blood Pressure</label>
                        <input 
                          type="text" 
                          value={intakeBP}
                          onChange={(e) => setIntakeBP(e.target.value)}
                          placeholder="e.g. 120/80"
                          className="px-3 py-2 rounded-lg border border-outline-variant focus:border-primary focus:outline-none text-sm bg-background text-on-surface"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500">Heart Rate (Pulse)</label>
                        <input 
                          type="text" 
                          value={intakePulse}
                          onChange={(e) => setIntakePulse(e.target.value)}
                          placeholder="e.g. 72 bpm"
                          className="px-3 py-2 rounded-lg border border-outline-variant focus:border-primary focus:outline-none text-sm bg-background text-on-surface"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500">SpO2 (%)</label>
                        <input 
                          type="text" 
                          value={intakeSpO2}
                          onChange={(e) => setIntakeSpO2(e.target.value)}
                          placeholder="e.g. 98"
                          className="px-3 py-2 rounded-lg border border-outline-variant focus:border-primary focus:outline-none text-sm bg-background text-on-surface"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-slate-500">Weight (kg)</label>
                        <input 
                          type="text" 
                          value={intakeWeight}
                          onChange={(e) => setIntakeWeight(e.target.value)}
                          placeholder="e.g. 70"
                          className="px-3 py-2 rounded-lg border border-outline-variant focus:border-primary focus:outline-none text-sm bg-background text-on-surface"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                    <button 
                      type="submit"
                      className="px-6 py-3 bg-primary text-on-primary rounded-lg font-card-title text-card-title hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined">person_add</span>
                      Save Patient Details & Queue
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : activeView === 'receptionist-directory' ? (
            /* Receptionist Intake Directory Screen */
            <div className="max-w-container-max-width mx-auto flex flex-col gap-gutter">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">Registered Patient Intake Directory</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    Manage patient entries registered for clinical sessions.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveView('receptionist-intake')}
                  className="px-4 py-2.5 bg-primary text-on-primary rounded-lg font-card-title text-card-title hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined">person_add</span>
                  Register Patient
                </button>
              </div>

              {/* Search and Filters */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative w-full flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined text-[20px] select-none">search</span>
                  <input 
                    type="text" 
                    value={searchQueryPatient}
                    onChange={(e) => setSearchQueryPatient(e.target.value)}
                    placeholder="Search registered patients by Name, Contact number, or Patient ID..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:outline-none text-sm bg-background text-on-surface"
                  />
                </div>
              </div>

              {/* Patient Directory Table */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container font-data-label text-data-label text-on-surface-variant uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 border-b border-outline-variant font-medium">Patient ID</th>
                        <th className="px-6 py-4 border-b border-outline-variant font-medium">Demographics</th>
                        <th className="px-6 py-4 border-b border-outline-variant font-medium">Contact Number</th>
                        <th className="px-6 py-4 border-b border-outline-variant font-medium">Visit details</th>
                        <th className="px-6 py-4 border-b border-outline-variant font-medium">Vitals recorded</th>
                        <th className="px-6 py-4 border-b border-outline-variant font-medium text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {patients.filter(p => 
                        p.name.toLowerCase().includes(searchQueryPatient.toLowerCase()) ||
                        p.contact.includes(searchQueryPatient) ||
                        p.id.toLowerCase().includes(searchQueryPatient.toLowerCase())
                      ).length > 0 ? (
                        patients.filter(p => 
                          p.name.toLowerCase().includes(searchQueryPatient.toLowerCase()) ||
                          p.contact.includes(searchQueryPatient) ||
                          p.id.toLowerCase().includes(searchQueryPatient.toLowerCase())
                        ).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-mono font-bold text-xs px-2 py-1 rounded bg-secondary-container/20 text-secondary border border-secondary-container/50">
                                {p.id}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-on-surface">{p.name}</div>
                              <div className="text-xs text-on-surface-variant mt-0.5">{p.age} yrs • {p.gender}</div>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-on-surface-variant">{p.contact}</td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-xs text-primary px-2 py-0.5 bg-primary-container/10 border border-primary/20 rounded inline-block">
                                {p.visitType}
                              </div>
                              <div className="text-xs text-on-surface-variant mt-1.5 truncate max-w-[200px]">{p.reasonForVisit}</div>
                            </td>
                            <td className="px-6 py-4">
                              {p.temp || p.bp || p.weight ? (
                                <div className="text-xs space-y-0.5 text-on-surface-variant">
                                  {p.temp && <div>🌡️ Temp: <span className="font-semibold">{p.temp}</span></div>}
                                  {p.bp && <div>🩺 BP: <span className="font-semibold">{p.bp}</span></div>}
                                  {p.weight && <div>⚖️ Weight: <span className="font-semibold">{p.weight}</span></div>}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">None recorded</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                onClick={() => {
                                  if (confirm(`Are you sure you want to remove patient ${p.name}?`)) {
                                    const updatedList = patients.filter(pat => pat.id !== p.id);
                                    setPatients(updatedList);
                                    localStorage.setItem('ascribe_patients', JSON.stringify(updatedList));
                                  }
                                }}
                                className="text-error hover:text-error/80 p-1.5 rounded-full hover:bg-error-container/10 transition-all cursor-pointer inline-flex items-center"
                                title="Delete Patient Record"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center py-12 text-slate-400 italic bg-slate-50/50">
                            No registered patients found matching search query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : isProcessing ? (
            /* Loading Processing Pipeline Step */
            <div className="max-w-container-max-width mx-auto flex flex-col gap-gutter justify-center h-full min-h-[300px]">
              <section className="bg-surface-container-lowest rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-12 border-l-4 border-l-secondary text-center">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6">Analyzing Consultation Transcript...</h3>
                
                <div className="relative flex justify-between items-center w-full max-w-2xl mx-auto py-8">
                  {/* Connecting Line Background */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-surface-container-high rounded-full z-0"></div>
                  {/* Active Connecting Line */}
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-secondary rounded-full z-0 transition-all duration-500 ${
                    processingStep === 'transcribing' ? 'w-0' :
                    processingStep === 'soap' ? 'w-1/3' :
                    processingStep === 'summary' ? 'w-2/3' : 'w-full'
                  }`}></div>
                  
                  {/* Steps */}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                      processingStep === 'transcribing' ? 'bg-secondary text-on-secondary ring-4 ring-secondary/20' : 'bg-secondary text-on-secondary'
                    }`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>mic</span>
                    </div>
                    <span className="font-data-label text-data-label text-on-surface">Transcribing</span>
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                      processingStep === 'soap' ? 'bg-secondary text-on-secondary ring-4 ring-secondary/20' : 
                      processingStep === 'summary' || processingStep === 'prescription' || processingStep === 'complete' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high border-2 border-outline-variant text-outline'
                    }`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>auto_awesome</span>
                    </div>
                    <span className="font-data-label text-data-label text-on-surface">Generating SOAP</span>
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                      processingStep === 'summary' ? 'bg-secondary text-on-secondary ring-4 ring-secondary/20' : 
                      processingStep === 'prescription' || processingStep === 'complete' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high border-2 border-outline-variant text-outline'
                    }`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>summarize</span>
                    </div>
                    <span className="font-data-label text-data-label text-on-surface">Summary</span>
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                      processingStep === 'prescription' ? 'bg-secondary text-on-secondary ring-4 ring-secondary/20' : 
                      processingStep === 'complete' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high border-2 border-outline-variant text-outline'
                    }`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>prescriptions</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : activeView === 'consultation' ? (
            /* Consultation Setup / Recording Mode */
            <div className="max-w-container-max-width mx-auto flex flex-col gap-gutter">
              <section className="bg-surface-container-lowest rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border-l-4 border-l-primary overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed/20 to-transparent pointer-events-none"></div>
                <div className="relative z-10 p-8 flex flex-col items-center text-center">
                  
                  {/* Visualizer Wave Area */}
                  <div className="w-full max-w-lg h-32 flex items-center justify-center gap-1 mb-6 relative">
                    {isRecording && !isPaused && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 bg-primary-fixed/40 rounded-full absolute pulse-circle"></div>
                        <div className="w-16 h-16 bg-primary-fixed/30 rounded-full absolute pulse-circle-delayed"></div>
                      </div>
                    )}
                    <div className="flex items-end h-16 gap-1 w-full justify-center">
                      {[4,8,12,16,10,6,3,5,9,14,12,8,4,2,4,7,11,16,10,5,3].map((height, i) => (
                        <div 
                          key={i} 
                          className={`w-1.5 bg-primary/80 rounded-t ${isRecording && !isPaused ? 'waveform-bar' : 'h-1.5'}`} 
                          style={{ 
                            height: isRecording && !isPaused ? `${height * 6}px` : '4px',
                            animationDelay: `${i * 0.05}s`
                          }}
                        ></div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-8">
                    <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-outline" style={{ fontSize: '16px' }}>cloud_upload</span>
                      {isRecording ? "Streaming to Sarvam AI STT Engine" : "Microphone ready. Tap Start Session to begin."}
                    </p>
                  </div>

                  {/* Audio Controls */}
                  <div className="flex items-center justify-center gap-4 w-full">
                    <button 
                      onClick={togglePause} 
                      disabled={!isRecording} 
                      className={`w-14 h-14 rounded-full border-2 border-outline-variant flex items-center justify-center transition-colors ${!isRecording ? 'opacity-40 cursor-not-allowed' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                    >
                      <span className="material-symbols-outlined fill">{isPaused ? 'play_arrow' : 'pause'}</span>
                    </button>
                    
                    {!isRecording ? (
                      <button 
                        onClick={startSession} 
                        className="px-8 py-4 bg-primary text-on-primary rounded-full font-card-title text-card-title flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <span className="material-symbols-outlined fill">mic</span>
                        Start Clinical Session
                      </button>
                    ) : (
                      <button 
                        onClick={stopSessionAndGenerate} 
                        className="px-8 py-4 bg-error text-on-error rounded-full font-card-title text-card-title flex items-center justify-center gap-2 hover:bg-error/90 transition-colors shadow-sm"
                      >
                        <span className="material-symbols-outlined fill">stop_circle</span>
                        Stop &amp; Generate Note
                      </button>
                    )}

                    <button className="w-14 h-14 rounded-full border-2 border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors" disabled style={{ opacity: 0.5 }}>
                      <span className="material-symbols-outlined fill">settings_voice</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Live Transcript Log */}
              <section className="bg-surface-container-lowest rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border-l-4 border-l-tertiary flex flex-col min-h-[400px]">
                <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline">notes</span>
                    <h2 className="font-card-title text-card-title text-on-surface">Live Transcript</h2>
                  </div>
                  <span className="px-2 py-1 bg-surface-container rounded text-on-surface-variant font-data-label text-data-label flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>font_download</span> 16kHz PCM
                  </span>
                </div>
                <div className="p-6 flex-1 overflow-y-auto font-transcript-text text-transcript-text flex flex-col gap-4">
                  {transcriptLines.length === 0 ? (
                    <div className="text-outline-variant text-center py-12">Session is live. Real-time transcripts will appear here...</div>
                  ) : (
                    transcriptLines.map((line, idx) => (
                      <div key={idx} className="flex gap-4 group">
                        <div className="text-outline-variant shrink-0 w-16 text-right pt-0.5 text-xs">{line.time}</div>
                        <div className="flex-1">
                          <span className={`font-bold mr-2 ${line.speaker === 'Doctor' ? 'text-secondary' : 'text-outline'}`}>
                            [{line.speaker}]:
                          </span>
                          <span className="text-on-surface">{line.text}</span>
                        </div>
                      </div>
                    ))
                  )}
                  {isRecording && !isPaused && (
                    interimSegments.length > 0 ? (
                      interimSegments.map((seg, idx) => (
                        <div key={`interim-${idx}`} className="flex gap-4 group mt-2 opacity-70">
                          <div className="text-outline-variant shrink-0 w-16 text-right pt-0.5 text-xs">{getTimestamp()}</div>
                          <div className="flex-1 flex items-center gap-1">
                            <span className={`font-bold mr-2 ${seg.speaker === 'Doctor' ? 'text-secondary' : 'text-outline'}`}>
                              [{seg.speaker}]:
                            </span>
                            <span className="text-on-surface">{seg.transcript}</span>
                            {idx === interimSegments.length - 1 && (
                              <span className="inline-block w-1.5 h-4 bg-outline-variant animate-pulse"></span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex gap-4 group mt-2 opacity-70">
                        <div className="text-outline-variant shrink-0 w-16 text-right pt-0.5 text-xs">{getTimestamp()}</div>
                        <div className="flex-1 flex items-center gap-1">
                          <span className="text-secondary font-bold mr-2">[Listening]</span>
                          <span className="inline-block w-1.5 h-4 bg-outline-variant animate-pulse"></span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>
            </div>
          ) : activeView === 'patients-directory' ? (
            /* Doctor's Patients Directory / Queue View */
            <div className="max-w-container-max-width mx-auto flex flex-col gap-gutter">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">EMR Patient Registry & Waiting Queue</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    Select a registered patient to load their profile for consultation or view past clinical consultation logs.
                  </p>
                </div>
              </div>

              {/* Patient Queue & Search Directory for Doctor */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6 space-y-6">
                {/* Search bar */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined text-[20px] select-none">search</span>
                  <input 
                    type="text" 
                    value={searchQueryPatient}
                    onChange={(e) => setSearchQueryPatient(e.target.value)}
                    placeholder="Search patient database by Name, ID, or Contact number..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:outline-none text-sm bg-background text-on-surface"
                  />
                </div>

                {/* Waiting Queue List */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">EMR Registered Patients Queue</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {patients.filter(p => 
                      p.name.toLowerCase().includes(searchQueryPatient.toLowerCase()) ||
                      p.contact.includes(searchQueryPatient) ||
                      p.id.toLowerCase().includes(searchQueryPatient.toLowerCase())
                    ).length > 0 ? (
                      patients.filter(p => 
                        p.name.toLowerCase().includes(searchQueryPatient.toLowerCase()) ||
                        p.contact.includes(searchQueryPatient) ||
                        p.id.toLowerCase().includes(searchQueryPatient.toLowerCase())
                      ).map(p => (
                        <div 
                          key={p.id}
                          className={`p-5 border rounded-xl bg-surface transition-all flex flex-col justify-between gap-4 shadow-sm hover:shadow ${selectedPatient && selectedPatient.id === p.id ? 'border-primary ring-2 ring-primary/10' : 'border-outline-variant hover:border-primary/50'}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="font-semibold text-on-surface flex items-center gap-2 text-base">
                                {p.name}
                                <span className="text-[10px] font-mono bg-secondary-container/20 text-secondary border border-secondary-container/30 px-1.5 py-0.5 rounded">{p.id}</span>
                              </div>
                              <div className="text-xs text-on-surface-variant font-medium">{p.age} yrs • {p.gender} • {p.contact}</div>
                            </div>
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-primary-container/10 border border-primary/20 text-primary uppercase tracking-wide">
                              {p.visitType}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100 italic">
                            <strong>Reason:</strong> {p.reasonForVisit}
                          </div>

                          {p.temp || p.bp || p.weight ? (
                            <div className="flex flex-wrap gap-2.5 pt-1 border-t border-slate-100">
                              {p.temp && <span className="text-[10px] text-slate-500 font-medium">🌡️ Temp: {p.temp}</span>}
                              {p.bp && <span className="text-[10px] text-slate-500 font-medium">🩺 BP: {p.bp}</span>}
                              {p.weight && <span className="text-[10px] text-slate-500 font-medium">⚖️ Weight: {p.weight}</span>}
                            </div>
                          ) : null}

                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                            {/* Previous Clinical History Section */}
                            <button 
                              onClick={() => {
                                if (selectedPatient && selectedPatient.id === p.id) {
                                  setSelectedPatient(null);
                                } else {
                                  setSelectedPatient(p);
                                }
                              }}
                              className="px-3.5 py-1.5 border border-outline-variant hover:bg-surface-container rounded-lg text-xs font-bold text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px] text-secondary">history</span>
                              {selectedPatient && selectedPatient.id === p.id ? 'Hide Clinical History' : 'View Clinical History'}
                            </button>

                            <button 
                              onClick={() => {
                                setSelectedPatient(p);
                                setPatientName(p.name);
                                setPatientAge(p.age);
                                setPatientGender(p.gender);
                                setPatientId(p.id);
                                setPatientContact(p.contact);
                                setVisitType(p.visitType);
                                setPatientReason(p.reasonForVisit);
                                setPatientWeight(p.weight || '');
                                setPatientTemp(p.temp || '');
                                setPatientBP(p.bp || '');
                                setPatientPulse(p.pulse || '');
                                setPatientSpO2(p.spo2 || '');

                                // Prefill pad
                                setPadName(p.name);
                                setPadAge(p.age);
                                setPadGender(p.gender);
                                setPadDate(new Date().toISOString().split('T')[0]);
                                setPadWeight(p.weight ? p.weight.replace(' kg', '') : '');
                                setPadTemp(p.temp ? p.temp.replace(' F', '') : '');
                                setPadBP(p.bp || '');
                                setPadPulse(p.pulse || '');
                                setPadSpO2(p.spo2 ? p.spo2.replace('%', '') : '');
                                setPadDiagnosis('');
                                setPadContent(`Medicines:\n---------------------------------\nNo medicines discussed in this session.\n\nInstructions:\n---------------------------------\n- None discussed\n\nFollow-up:\n---------------------------------\nVisit again if:\n- None discussed\n\nDoctor Notes:\n---------------------------------\nGenerated by AI – Requires Doctor Verification`);

                                alert(`Profile for ${p.name} loaded successfully!`);
                                setActiveView('consultation');
                              }}
                              className="px-4 py-1.5 bg-primary text-on-primary hover:opacity-90 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[16px]">file_open</span>
                              Load Profile
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 p-6 border border-dashed border-outline-variant rounded-xl text-center text-slate-400 italic">
                        No registered patients matching EMR search. Registered entries from the Receptionist portal will list here.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible clinical history timeline for currently active view selection */}
              {selectedPatient && (
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-outline-variant pb-3">
                    <h4 className="font-headline-sm text-card-title text-on-surface flex items-center gap-2 select-none font-bold">
                      <span className="material-symbols-outlined text-secondary">history</span>
                      Clinical History: {selectedPatient.name} ({selectedPatient.id})
                    </h4>
                    <button 
                      onClick={() => setSelectedPatient(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {selectedPatient.history && selectedPatient.history.length > 0 ? (
                      selectedPatient.history.map((hist, idx) => (
                        <details key={idx} className="group border border-outline-variant rounded-xl overflow-hidden bg-surface transition-all">
                          <summary className="p-4 flex justify-between items-center cursor-pointer select-none font-semibold text-sm hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-outline text-[20px] group-open:rotate-90 transition-transform">chevron_right</span>
                              <span className="font-mono text-primary">{hist.date}</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-on-surface font-bold">{hist.diagnosis || 'General Consult'}</span>
                              <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-medium">{hist.visitType || 'Session Log'}</span>
                            </div>
                            <span className="text-xs text-secondary font-bold group-open:hidden">Click to Expand Note</span>
                            <span className="text-xs text-secondary font-bold hidden group-open:inline">Collapse Note</span>
                          </summary>
                          <div className="p-6 border-t border-outline-variant bg-surface-container-lowest grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-on-surface-variant leading-relaxed">
                            <div className="space-y-3">
                              <h5 className="font-bold text-slate-700 uppercase tracking-wider border-b pb-1">SOAP Clinical Documentation</h5>
                              <div className="whitespace-pre-wrap font-mono text-[11px] bg-slate-50 p-4 border border-slate-200 rounded-lg max-h-[300px] overflow-y-auto leading-relaxed select-text">
                                {hist.soapNote}
                              </div>
                            </div>
                            <div className="space-y-3">
                              <h5 className="font-bold text-slate-700 uppercase tracking-wider border-b pb-1">Prescription Details</h5>
                              <div className="whitespace-pre-wrap font-mono text-[11px] bg-teal-50/20 p-4 border border-teal-200/50 text-slate-800 rounded-lg max-h-[300px] overflow-y-auto leading-relaxed select-text">
                                {hist.prescriptionDraft}
                              </div>
                            </div>
                          </div>
                        </details>
                      ))
                    ) : (
                      <div className="py-4 text-center text-slate-400 italic text-sm">
                        No previous consultation records exist for this patient profile.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeView === 'edit-prescription' ? (
            /* Branded AscribeMD Prescription Pad Editor */
            <div className="max-w-container-max-width mx-auto px-4 md:px-0">
              {/* Header Action Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 no-print">
                <div>
                  <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Edit Prescription</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    Review and edit prescription details, patient info, and vitals before saving.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const updatedDraft = compilePadToDraft()
                      setPrescriptionDraft(updatedDraft)
                      setEditedPrescriptionText(updatedDraft)
                      const parsed = parsePrescriptionsFromText(updatedDraft)
                      setPrescriptions(parsed)
                      alert("Prescription draft saved successfully!")
                      setActiveView('results')
                    }}
                    className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-card-title text-card-title hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer"
                    id="save-prescription-btn"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Save Changes
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-secondary text-on-secondary hover:opacity-90 rounded-lg font-card-title text-card-title flex items-center gap-2 cursor-pointer shadow-sm"
                    id="download-prescription-pdf-btn"
                    title="Download/Print prescription as PDF"
                  >
                    <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                    Download PDF
                  </button>
                  <button 
                    onClick={() => {
                      setActiveView('results')
                    }}
                    className="px-5 py-2.5 border border-outline-variant hover:bg-surface-container rounded-lg text-on-surface transition-colors font-card-title text-card-title flex items-center gap-2 cursor-pointer"
                    id="cancel-prescription-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* A4 Prescription Letterhead Card */}
              <div className="max-w-[800px] mx-auto bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden flex flex-col font-sans mb-12">
                
                {/* Pad Header: Teal Gradient (Editable via Modal) */}
                <div 
                  onClick={() => setIsHeaderModalOpen(true)}
                  className="bg-gradient-to-r from-[#1fa594] to-[#2fbba6] text-white p-6 px-10 flex justify-between items-center border-b-[5px] border-[#1aa08e] cursor-pointer relative group transition-all"
                  title="Click to customize letterhead header"
                >
                  {/* Hover Edit Overlay */}
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                    <div className="bg-white/95 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      Customize Header (Logo, Name, Address)
                    </div>
                  </div>

                  {/* Left: Logo & Hospital Name */}
                  <div className="flex items-center gap-4">
                    {hospitalLogo ? (
                      <img src={hospitalLogo} alt="Logo" className="w-12 h-12 object-contain bg-white/10 rounded-lg p-1" />
                    ) : (
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-[24px]">local_hospital</span>
                      </div>
                    )}
                    <div>
                      <h1 className="text-2xl font-extrabold tracking-tight">
                        {hospitalName || <span className="opacity-60 italic text-lg font-normal">Click to add Hospital Name</span>}
                      </h1>
                      <p className="text-[10px] uppercase tracking-widest text-teal-100 font-bold mt-0.5">Clinical Scripter & Assistant</p>
                    </div>
                  </div>

                  {/* Right: Doctor Info & Address */}
                  <div className="text-right">
                    <h2 className="text-lg font-bold text-white leading-tight">
                      {doctorNameText || <span className="opacity-60 italic text-sm font-normal">Click to add Doctor Name</span>}
                    </h2>
                    <p className="text-[11px] text-teal-100/90 font-medium mt-1 max-w-[300px] leading-normal ml-auto text-right">
                      {hospitalAddress || <span className="opacity-60 italic text-[10px] font-normal">Click to add Address</span>}
                    </p>
                  </div>
                </div>

                {/* Patient Metadata section: Lined fields */}
                <div className="p-8 pb-4 border-b border-dashed border-slate-200 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                    <div className="md:col-span-2 flex items-center gap-2">
                      <span className="text-slate-500 font-bold text-sm shrink-0">Patient Name:</span>
                      <input 
                        value={padName} 
                        onChange={(e) => setPadName(e.target.value)} 
                        className="flex-1 border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none pb-0.5 text-slate-800 text-sm font-semibold transition-colors"
                        placeholder="Patient Name" 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold text-sm shrink-0">Age:</span>
                      <input 
                        value={padAge} 
                        onChange={(e) => setPadAge(e.target.value)} 
                        className="flex-1 border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none pb-0.5 text-slate-800 text-sm font-semibold transition-colors"
                        placeholder="Age" 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold text-sm shrink-0">Gender:</span>
                      <input 
                        value={padGender} 
                        onChange={(e) => setPadGender(e.target.value)} 
                        className="flex-1 border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none pb-0.5 text-slate-800 text-sm font-semibold transition-colors"
                        placeholder="Gender" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-3 flex items-center gap-2">
                      <span className="text-slate-500 font-bold text-sm shrink-0">Diagnosis:</span>
                      <input 
                        value={padDiagnosis} 
                        onChange={(e) => setPadDiagnosis(e.target.value)} 
                        className="flex-1 border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none pb-0.5 text-slate-800 text-sm font-semibold transition-colors"
                        placeholder="Diagnosis Details" 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold text-sm shrink-0">Date:</span>
                      <input 
                        type="date"
                        value={padDate} 
                        onChange={(e) => setPadDate(e.target.value)} 
                        className="flex-1 border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none pb-0.5 text-slate-800 text-sm font-semibold transition-colors" 
                      />
                    </div>
                  </div>
                </div>

                {/* Pad Body: Two column layout with Vitals in top right */}
                <div className="p-8 flex flex-col md:flex-row gap-8 flex-1 min-h-[500px] bg-white">
                  
                  {/* Left Column: Medicines and Instructions Area */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs tracking-wider uppercase mb-3 select-none">
                      <span className="material-symbols-outlined text-[16px]">medical_services</span>
                      Prescription Details
                    </div>
                    <textarea 
                      value={padContent}
                      onChange={(e) => setPadContent(e.target.value)}
                      className="w-full flex-1 p-0 border-0 focus:ring-0 bg-transparent text-slate-800 font-mono text-sm leading-relaxed resize-none focus:outline-none placeholder-slate-300 font-transcript-text print:hidden"
                      placeholder="Medicines:&#10;1. Azithromycin 250mg&#10;   - 1 tablet once daily for 5 days&#10;&#10;Instructions:&#10;- Rest and hydration"
                      style={{ minHeight: '420px' }}
                      id="prescription-textarea"
                    />
                    <div className="hidden print:block whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800 flex-1 font-transcript-text">
                      {padContent || 'No prescription details.'}
                    </div>
                  </div>

                  {/* Right Column: Vitals block in top right and Signature at bottom */}
                  <div className="w-full md:w-64 shrink-0 flex flex-col justify-between gap-8 border-l border-slate-100 md:pl-8">
                    {/* Vitals Container */}
                    <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 shadow-sm flex flex-col">
                      <div className="font-bold text-slate-700 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2 text-xs tracking-wider uppercase select-none">
                        <span className="material-symbols-outlined text-[16px] text-teal-600">thermostat</span>
                        Vitals
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-500 font-semibold text-xs uppercase shrink-0">Temp:</span>
                          <input 
                            value={padTemp} 
                            onChange={(e) => setPadTemp(e.target.value)} 
                            className="w-32 text-right border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none text-slate-800 font-medium pb-0.5 text-sm transition-colors" 
                            placeholder="Not recorded" 
                          />
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-500 font-semibold text-xs uppercase shrink-0">BP:</span>
                          <input 
                            value={padBP} 
                            onChange={(e) => setPadBP(e.target.value)} 
                            className="w-32 text-right border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none text-slate-800 font-medium pb-0.5 text-sm transition-colors" 
                            placeholder="Not recorded" 
                          />
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-500 font-semibold text-xs uppercase shrink-0">Pulse:</span>
                          <input 
                            value={padPulse} 
                            onChange={(e) => setPadPulse(e.target.value)} 
                            className="w-32 text-right border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none text-slate-800 font-medium pb-0.5 text-sm transition-colors" 
                            placeholder="Not recorded" 
                          />
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-500 font-semibold text-xs uppercase shrink-0">SpO2:</span>
                          <input 
                            value={padSpO2} 
                            onChange={(e) => setPadSpO2(e.target.value)} 
                            className="w-32 text-right border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none text-slate-800 font-medium pb-0.5 text-sm transition-colors" 
                            placeholder="Not recorded" 
                          />
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-500 font-semibold text-xs uppercase shrink-0">Weight:</span>
                          <input 
                            value={padWeight} 
                            onChange={(e) => setPadWeight(e.target.value)} 
                            className="w-32 text-right border-b border-slate-300 focus:border-teal-500 bg-transparent outline-none text-slate-800 font-medium pb-0.5 text-sm transition-colors" 
                            placeholder="Not recorded" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Signature block (desktop) */}
                    <div className="pt-16 self-end text-center w-full hidden md:block">
                      <div className="border-b border-slate-300 w-full mb-2"></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signature</span>
                    </div>
                  </div>
                </div>

                {/* Signature block (mobile) */}
                <div className="p-8 pt-0 flex justify-end md:hidden bg-white">
                  <div className="text-center w-48">
                    <div className="border-b border-slate-300 w-full mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signature</span>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* Results Screen (SOAP Notes, summary, prescription) */
            <div className="max-w-container-max-width mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Consultation Results</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1 flex items-center flex-wrap gap-1.5">
                    Patient: {patientName} • DOV: {new Date().toLocaleDateString()} • Doctor: 
                    <input 
                      type="text" 
                      value={doctorNameText} 
                      onChange={(e) => setDoctorNameText(e.target.value)} 
                      className="bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary focus:outline-none py-0.5 font-semibold text-sm text-on-surface-variant w-32 inline-block ml-0.5"
                      placeholder="Doctor Name" 
                    />
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary-container/10 text-tertiary-container font-data-label text-data-label border border-tertiary-container/20">
                  <span className="w-2 h-2 rounded-full bg-tertiary-container"></span>
                  AI Processing Complete
                </span>
              </div>

              {/* 2x2 Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* SOAP Note Card */}
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col h-[500px]">
                  <div className="border-l-4 border-primary px-6 py-4 border-b border-outline-variant bg-surface flex justify-between items-center">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary fill">edit_document</span>
                      Structured SOAP Note
                    </h3>
                    <button 
                      onClick={() => setEditingSoap(!editingSoap)} 
                      className="text-primary hover:text-primary-container text-sm flex items-center gap-1 font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm">{editingSoap ? 'save' : 'edit'}</span>
                      {editingSoap ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto space-y-4 font-transcript-text text-transcript-text text-on-surface-variant bg-surface-container-lowest">
                    {editingSoap ? (
                      <textarea 
                        value={editedSoapText}
                        onChange={(e) => setEditedSoapText(e.target.value)}
                        className="w-full h-full p-4 border border-outline-variant rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface font-transcript-text focus:outline-none"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed select-text">
                        {editedSoapText || "No SOAP notes generated."}
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary Card */}
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col h-[500px]">
                  <div className="border-l-4 border-secondary px-6 py-4 border-b border-outline-variant bg-surface flex justify-between items-center">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary fill">summarize</span>
                      Consultation Summary
                    </h3>
                    <button 
                      onClick={() => setEditingSummary(!editingSummary)} 
                      className="text-secondary hover:text-on-secondary-container text-sm flex items-center gap-1 font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm">{editingSummary ? 'save' : 'edit'}</span>
                      {editingSummary ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto bg-surface-container-lowest space-y-4">
                    {editingSummary ? (
                      <textarea 
                        value={editedSummaryText}
                        onChange={(e) => setEditedSummaryText(e.target.value)}
                        className="w-full h-full p-4 border border-outline-variant rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface font-body-md focus:outline-none"
                      />
                    ) : (
                      <>
                        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed select-text">
                          {editedSummaryText || "No summary text generated."}
                        </p>

                      </>
                    )}
                  </div>
                </div>

                {/* Prescription Card */}
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col h-[500px]">
                  <div className="border-l-4 border-error px-6 py-4 border-b border-outline-variant bg-surface flex justify-between items-center">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-error fill">prescriptions</span>
                      Drafted Prescriptions
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={addPrescriptionRow}
                        className="px-2.5 py-1 text-xs bg-surface-container hover:bg-surface-container-high rounded border border-outline-variant text-on-surface flex items-center gap-1 font-semibold"
                      >
                        <span className="material-symbols-outlined text-xs">add</span> Add Row
                      </button>
                      <button 
                        onClick={() => {
                          const activeDraftText = prescriptionDraft || '';
                          if (!activeDraftText.trim()) {
                            const current_date = new Date().toISOString().split('T')[0]
                            const defaultTemplate = `Patient Name: ${patientName}
Age: ${patientAge}
Gender: ${patientGender}
Date: ${current_date}
Weight: 

Vitals:
---------------------------------
- Temperature: 
- Blood Pressure: 
- Heart Rate/Pulse: 
- SpO2: 

Diagnosis:
---------------------------------
1. None discussed

Medicines:
---------------------------------
No medicines discussed in this session.

Instructions:
---------------------------------
- None discussed

Follow-up:
---------------------------------
Visit again if:
- None discussed

Doctor Notes:
---------------------------------
Generated by AI – Requires Doctor Verification`
                            syncTextToPadFields(defaultTemplate)
                          } else {
                            syncTextToPadFields(activeDraftText)
                          }
                          setActiveView('edit-prescription')
                          setTimeout(() => {
                            window.print()
                          }, 350)
                        }}
                        className="px-2.5 py-1 text-xs bg-primary text-on-primary hover:opacity-90 rounded flex items-center gap-1 font-semibold cursor-pointer"
                        title="Download/Print prescription as PDF"
                      >
                        <span className="material-symbols-outlined text-xs">picture_as_pdf</span> Download PDF
                      </button>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-data-label text-[10px] font-bold">
                        <span className="material-symbols-outlined text-[12px]">warning</span>
                        Needs Review
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-error-container/30 border-b border-error/20 flex items-start gap-3">
                    <span className="material-symbols-outlined text-error mt-0.5">info</span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Verify prescription dosages. Double check drug allergies or medical histories before signing off.</p>
                  </div>
                  <div className="p-0 flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-surface-container font-data-label text-data-label text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 border-b border-outline-variant font-medium">Medication</th>
                          <th className="px-6 py-3 border-b border-outline-variant font-medium">Dosage</th>
                          <th className="px-6 py-3 border-b border-outline-variant font-medium">Frequency</th>
                        </tr>
                      </thead>
                      <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-outline-variant">
                        {prescriptions.map((row) => (
                          <tr key={row.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-6 py-3 font-medium text-primary">
                              <input 
                                type="text" 
                                value={row.medication} 
                                onChange={(e) => updatePrescriptionRow(row.id, 'medication', e.target.value)} 
                                className="w-full bg-transparent focus:bg-background border border-transparent focus:border-outline-variant rounded p-1 font-medium text-primary focus:outline-none"
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="text" 
                                value={row.dosage} 
                                onChange={(e) => updatePrescriptionRow(row.id, 'dosage', e.target.value)} 
                                className="w-full bg-transparent focus:bg-background border border-transparent focus:border-outline-variant rounded p-1 focus:outline-none"
                              />
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="text" 
                                value={row.frequency} 
                                onChange={(e) => updatePrescriptionRow(row.id, 'frequency', e.target.value)} 
                                className="w-full bg-transparent focus:bg-background border border-transparent focus:border-outline-variant rounded p-1 focus:outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Transcript Card */}
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col h-[500px]">
                  <div className="border-l-4 border-outline px-6 py-4 border-b border-outline-variant bg-surface flex justify-between items-center">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-outline fill">mic</span>
                      Full Transcript
                    </h3>
                    <div className="flex gap-2">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                        <input 
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface-container-lowest text-on-surface w-48 transition-all focus:outline-none" 
                          placeholder="Search transcript..." 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto font-transcript-text text-transcript-text bg-surface-container-lowest space-y-3">
                    {filteredTranscript.map((line, idx) => (
                      <p key={idx} className="select-text">
                        <span className={`font-bold mr-2 ${line.speaker === 'Doctor' ? 'text-secondary' : 'text-outline'}`}>
                          {line.speaker.toUpperCase()}:
                        </span>
                        {line.text}
                      </p>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Bottom Action / Status Bar */}
        {activeView === 'results' && !isProcessing && (
          <div className="bg-surface-container-lowest border-t border-outline-variant shadow-[0_-4px_12px_rgba(0,0,0,0.05)] p-4 px-margin-mobile md:px-margin-desktop shrink-0 flex flex-wrap justify-between items-center gap-4 z-30 bottom-action-bar">
            <div className="text-body-sm text-on-surface-variant flex items-center gap-2 select-none">
              <span className="material-symbols-outlined text-[18px]">cloud_done</span>
              Last saved: Just now
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={copyToEMR} 
                className="px-4 py-2 rounded-lg font-card-title text-card-title text-on-surface border border-outline-variant hover:bg-surface-container transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                Copy to EMR
              </button>
              <button 
                onClick={() => window.print()} 
                className="px-4 py-2 rounded-lg font-card-title text-card-title text-on-surface border border-outline-variant hover:bg-surface-container transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
                Print Summary
              </button>
              <button 
                onClick={() => {
                  if (selectedPatient && selectedPatient.id) {
                    const newSessionLog = {
                      date: new Date().toISOString().split('T')[0],
                      visitType: visitType || 'Consultation',
                      diagnosis: padDiagnosis || 'General Consultation',
                      soapNote: editedSoapText || soapNote || 'No SOAP notes logged.',
                      summary: editedSummaryText || summary || 'No summary logged.',
                      prescriptionDraft: compilePadToDraft()
                    };

                    const updatedPatients = patients.map(p => {
                      if (p.id === selectedPatient.id) {
                        return {
                          ...p,
                          history: [newSessionLog, ...(p.history || [])]
                        };
                      }
                      return p;
                    });

                    setPatients(updatedPatients);
                    localStorage.setItem('ascribe_patients', JSON.stringify(updatedPatients));
                    alert(`Consultation signed and sealed. Record saved to patient file for ${selectedPatient.name}.`);
                  } else {
                    alert("Consultation signed and completed. (Quick consult, record not saved to directory).");
                  }
                  
                  setActiveView('consultation')
                  setSoapNote('')
                  setSummary('')
                  setPrescriptions([])
                  setSelectedPatient(null)
                  setPatientName('')
                  setPatientAge('')
                  setPatientGender('')
                  setPatientId('')
                  setPatientContact('')
                  setVisitType('Initial Visit')
                  setPatientReason('')
                  setPatientWeight('')
                  setPatientTemp('')
                  setPatientBP('')
                  setPatientPulse('')
                  setPatientSpO2('')
                }}
                className="px-6 py-2 rounded-lg font-card-title text-card-title bg-primary-container text-on-primary hover:bg-primary transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Sign &amp; Complete
              </button>
            </div>
          </div>
        )}
      </main>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-surface border-t border-outline-variant h-16 flex justify-around items-center z-50 shrink-0">
        <a className="flex flex-col items-center text-on-surface-variant p-2">
          <span className="material-symbols-outlined">dashboard</span>
        </a>
        <a className={`flex flex-col items-center p-2 ${activeView === 'consultation' ? 'text-primary font-bold border-t-2 border-primary -mt-[2px]' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined fill">emergency</span>
        </a>
        <a className="flex flex-col items-center text-on-surface-variant p-2">
          <span className="material-symbols-outlined">group</span>
        </a>
        <a className="flex flex-col items-center text-on-surface-variant p-2">
          <span className="material-symbols-outlined">assessment</span>
        </a>
        <a className="flex flex-col items-center text-on-surface-variant p-2">
          <span className="material-symbols-outlined">settings</span>
        </a>
      </nav>

      {/* Customize Letterhead Modal */}
      {isHeaderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant bg-surface flex justify-between items-center">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit_square</span>
                Customize Letterhead
              </h3>
              <button 
                onClick={() => setIsHeaderModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Hospital Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital Name</label>
                <input 
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface focus:outline-none text-sm"
                  placeholder="e.g. AscribeMD Hospital"
                />
              </div>

              {/* Doctor Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doctor Name</label>
                <input 
                  type="text"
                  value={doctorNameText}
                  onChange={(e) => setDoctorNameText(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface focus:outline-none text-sm"
                  placeholder="e.g. Dr. Smith"
                />
              </div>

              {/* Hospital Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital/Clinic Address</label>
                <textarea 
                  value={hospitalAddress}
                  onChange={(e) => setHospitalAddress(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background text-on-surface focus:outline-none text-sm h-20 resize-none"
                  placeholder="e.g. 123 Health Ave, Suite 100"
                />
              </div>

              {/* Logo Uploader */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital Logo / Image</label>
                <div className="flex items-center gap-4">
                  {hospitalLogo ? (
                    <div className="relative group/logo">
                      <img src={hospitalLogo} alt="Preview" className="w-16 h-16 object-contain border border-slate-200 rounded-lg p-1 bg-slate-50" />
                      <button 
                        onClick={() => {
                          setHospitalLogo('')
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-error text-on-error w-5 h-5 rounded-full flex items-center justify-center shadow-md cursor-pointer text-[10px]"
                        title="Remove Logo"
                      >
                        <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 select-none bg-slate-50/50">
                      <span className="material-symbols-outlined text-[24px]">image</span>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-lg text-on-surface text-xs font-semibold cursor-pointer shadow-sm transition-colors">
                      <span className="material-symbols-outlined text-[16px]">upload_file</span>
                      Choose Logo
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onload = (uploadEvent) => {
                              setHospitalLogo(uploadEvent.target.result)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1.5">PNG, JPG, SVG. Recommended square proportions.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-outline-variant bg-surface flex justify-end gap-3">
              <button 
                onClick={() => {
                  localStorage.setItem('ascribe_hospital_name', hospitalName)
                  localStorage.setItem('ascribe_hospital_logo', hospitalLogo)
                  localStorage.setItem('ascribe_doctor_name', doctorNameText)
                  localStorage.setItem('ascribe_hospital_address', hospitalAddress)
                  setIsHeaderModalOpen(false)
                }}
                className="px-5 py-2 bg-primary text-on-primary rounded-lg font-card-title text-card-title hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
              >
                Apply Customization
              </button>
              <button 
                onClick={() => {
                  setHospitalName(localStorage.getItem('ascribe_hospital_name') || '')
                  setHospitalLogo(localStorage.getItem('ascribe_hospital_logo') || '')
                  setDoctorNameText(localStorage.getItem('ascribe_doctor_name') || '')
                  setHospitalAddress(localStorage.getItem('ascribe_hospital_address') || '')
                  setIsHeaderModalOpen(false)
                }}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-lg text-on-surface transition-colors font-card-title text-card-title cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
