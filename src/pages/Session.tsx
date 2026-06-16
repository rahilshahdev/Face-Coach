import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { v4 as uuidv4 } from 'uuid';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface EventLog {
  time: number;
  type: 'filler' | 'pause' | 'lookaway' | 'fast' | 'slow';
  detail: string;
}

// Word-based fillers that cloud speech engines DO transcribe
const FILLER_WORDS = [
  'like', 'basically', 'actually', 'you know', 'so', 'right',
  'kind of', 'sort of', 'literally', 'i mean', 'honestly',
  'obviously', 'anyway', 'whatever', 'just'
];

// Sound-based fillers (um, uh, etc) are STRIPPED by Google/Microsoft cloud
// speech engines. We detect these via micro-pause analysis instead.

// Browser detection for cross-browser quirks
function getBrowserInfo(): { name: string; isSafari: boolean; isFirefox: boolean; isChromium: boolean } {
  const ua = navigator.userAgent;
  if (/Firefox/i.test(ua)) return { name: 'Firefox', isSafari: false, isFirefox: true, isChromium: false };
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return { name: 'Safari', isSafari: true, isFirefox: false, isChromium: false };
  if (/Edg/i.test(ua)) return { name: 'Edge', isSafari: false, isFirefox: false, isChromium: true };
  if (/OPR|Opera/i.test(ua)) return { name: 'Opera', isSafari: false, isFirefox: false, isChromium: true };
  if (/Brave/i.test(ua)) return { name: 'Brave', isSafari: false, isFirefox: false, isChromium: true };
  if (/Chrome/i.test(ua)) return { name: 'Chrome', isSafari: false, isFirefox: false, isChromium: true };
  return { name: 'Unknown', isSafari: false, isFirefox: false, isChromium: false };
}

const browser = getBrowserInfo();

export default function Session() {
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sessionActive, setSessionActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(10);
  const [countdownStatus, setCountdownStatus] = useState('Initializing...');

  const [eyeContactPercent, setEyeContactPercent] = useState(100);
  const [fillerWordCount, setFillerWordCount] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [longPauseCount, setLongPauseCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [faceStatus, setFaceStatus] = useState<'none' | 'looking' | 'away'>('none');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  const [alerts, setAlerts] = useState<{ id: string; text: string }[]>([]);

  const sessionActiveRef = useRef(false);
  const sessionStartTimeRef = useRef(0);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const recognitionRef = useRef<any>(null);
  
  const transcriptRef = useRef(''); 
  const eventsRef = useRef<EventLog[]>([]);

  const eyeContactMsRef = useRef(0);
  const totalTrackingMsRef = useRef(0);
  const lookAwayStartRef = useRef<number | null>(null);
  const lookAwayAlertThrottleRef = useRef(0);

  const totalWordsRef = useRef(0);
  const wordCountHistoryRef = useRef<{ time: number; words: number }[]>([]);
  const lastSpeechTimeRef = useRef(Date.now());
  const pauseStartLoggedRef = useRef(false);
  const hesitationCountRef = useRef(0);
  const lastSpeechEndRef = useRef(0);
  const wordFillerCountRef = useRef(0); // fillers detected from transcript text
  const totalFillerCountRef = useRef(0); // word fillers + hesitation fillers combined

  const longPauseCountRef = useRef(0);
  const wpmRef = useRef(0);
  const faceTrackingIntervalRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechSupported(false);
      console.log(`[FaceCoach] Speech API not available on ${browser.name}`);
    } else {
      console.log(`[FaceCoach] Browser: ${browser.name} | Speech API: supported`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadModel() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        if (!cancelled) {
          faceLandmarkerRef.current = landmarker;
          setModelLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setModelError('Failed to load AI face model. Ensure hardware acceleration is enabled.');
          setModelLoading(false);
        }
      }
    }
    loadModel();
    return () => { cancelled = true; };
  }, []);

  const addAlert = useCallback((text: string) => {
    const id = uuidv4();
    setAlerts((prev) => [...prev.slice(-1), { id, text }]);
    setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== id)), 4000);
  }, []);

  // 500ms ticker — timer, pause detection, and micro-pause (um/uh proxy) detection
  useEffect(() => {
    if (!sessionActive) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - sessionStartTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);

      const silenceDuration = now - lastSpeechTimeRef.current;

      // Micro-pause detection (1-2.5 seconds) = likely "um"/"uh" hesitation
      if (silenceDuration > 1200 && silenceDuration < 2500 && lastSpeechEndRef.current === 0 && elapsed > 3) {
        lastSpeechEndRef.current = now;
        hesitationCountRef.current += 1;
        totalFillerCountRef.current = wordFillerCountRef.current + hesitationCountRef.current;
        setFillerWordCount(totalFillerCountRef.current);
        addAlert('🤔 Hesitation detected (um/uh)');
        eventsRef.current.push({ time: elapsed, type: 'filler', detail: 'hesitation (um/uh)' });
      }

      // Reset hesitation tracker when speech resumes
      if (silenceDuration < 500) {
        lastSpeechEndRef.current = 0;
      }

      // Long pause detection (>3 seconds)
      if (
        silenceDuration > 3000 &&
        !pauseStartLoggedRef.current &&
        elapsed > 5
      ) {
        pauseStartLoggedRef.current = true;
        longPauseCountRef.current += 1;
        setLongPauseCount(longPauseCountRef.current);
        addAlert('⏸️ Long pause detected');
        eventsRef.current.push({ time: elapsed, type: 'pause', detail: 'Silence > 3s' });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [sessionActive, addAlert]);

  // ── SPEECH RECOGNITION ──
  // Key design: completely simple. No warm-up, no watchdog, no abort.
  // Just start → listen → on end, create fresh instance and restart.
  const createAndStartRecognition = useCallback(() => {
    if (!sessionActiveRef.current) return;
    
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    let recognition: any;
    try {
      recognition = new SpeechRec();
    } catch (e) {
      return;
    }
    
    // Safari ignores continuous=true and stops after each utterance.
    // That's fine — our onend handler restarts automatically anyway.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1; // Faster results on all browsers
    recognitionRef.current = recognition;

    // Track the full finalized text accumulated by THIS instance
    let instanceFinalized = '';
    let currentInterim = '';

    recognition.onstart = () => {
      setIsListening(true); // Mic is active
    };

    recognition.onresult = (event: any) => {
      if (!sessionActiveRef.current) return;

      const now = Date.now();
      lastSpeechTimeRef.current = now;
      pauseStartLoggedRef.current = false;

      // Rebuild ALL finalized text from this instance from scratch each time
      // This is the ONLY reliable way — event.resultIndex can jump around on Edge
      instanceFinalized = '';
      currentInterim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          instanceFinalized += result[0].transcript;
        } else {
          currentInterim += result[0].transcript;
        }
      }

      // The full transcript = everything saved from PREVIOUS instances + this instance's finalized + current interim
      const displayText = transcriptRef.current + instanceFinalized + currentInterim;
      setLiveTranscript(displayText); 

      // ── Filler word count (scan entire transcript text) ──
      let wordFillers = 0;
      const lowerText = displayText.toLowerCase();
      for (const filler of FILLER_WORDS) {
        const re = new RegExp(`\\b${filler}\\b`, 'gi');
        const m = lowerText.match(re);
        if (m) wordFillers += m.length;
      }
      wordFillerCountRef.current = wordFillers;
      totalFillerCountRef.current = wordFillers + hesitationCountRef.current;
      setFillerWordCount(totalFillerCountRef.current);

      // ── WPM (rolling 15s window) ──
      const currentWords = (displayText.match(/\b\w+\b/g) || []).length;
      totalWordsRef.current = currentWords;
      
      wordCountHistoryRef.current.push({ time: now, words: currentWords });
      wordCountHistoryRef.current = wordCountHistoryRef.current.filter((x) => now - x.time <= 15000);
      
      if (wordCountHistoryRef.current.length >= 2) {
        const oldest = wordCountHistoryRef.current[0];
        const newest = wordCountHistoryRef.current[wordCountHistoryRef.current.length - 1];
        const dt = (newest.time - oldest.time) / 1000;
        if (dt > 2) {
          const currentWpm = Math.round(((newest.words - oldest.words) / dt) * 60);
          setWpm(currentWpm);
          wpmRef.current = currentWpm;
        }
      }
    };

    recognition.onerror = (e: any) => {
      // These errors are normal and expected:
      // 'no-speech' = user is silent (normal during pauses)
      // 'aborted' = we called stop() intentionally
      // 'network' = temporary network hiccup (auto-recovers via onend restart)
      // 'not-allowed' = mic permission denied
      if (e.error === 'not-allowed') {
        addAlert('🎤 Microphone access denied. Please allow mic permissions.');
        console.error('[FaceCoach] Mic permission denied');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn(`[FaceCoach] Speech error on ${browser.name}:`, e.error);
      }
    };

    recognition.onend = () => {
      // DON'T set isListening=false here if we're about to auto-restart.
      // That was causing the constant "Reconnecting mic..." flicker.
      
      // Persist this instance's finalized text to the master transcript
      if (instanceFinalized.length > 0) {
        transcriptRef.current += instanceFinalized + ' ';
      }
      // Save any dangling interim words the browser never finalized (Edge/Safari)
      if (currentInterim.trim().length > 0) {
        transcriptRef.current += currentInterim + ' ';
      }
      instanceFinalized = '';
      currentInterim = '';

      if (sessionActiveRef.current) {
        // Auto-restart — keep isListening true to prevent UI flicker
        const restartDelay = browser.isSafari ? 50 : 200;
        setTimeout(() => {
          createAndStartRecognition();
        }, restartDelay);
      } else {
        // Session actually ended — NOW show mic as disconnected
        setIsListening(false);
      }
    };

    try { 
      recognition.start(); 
    } catch (e) {
      // If start fails (e.g. permission pending, already started), retry after delay
      setTimeout(() => {
        if (sessionActiveRef.current) createAndStartRecognition();
      }, 1000);
    }
  }, [addAlert]);

  // Face tracking loop
  const startFaceTracking = () => {
    let lastTimestamp = performance.now();

    faceTrackingIntervalRef.current = setInterval(() => {
      if (!sessionActiveRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = faceLandmarkerRef.current;
      
      if (!video || !canvas || !landmarker) return;
      if (video.readyState < 2 || video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = performance.now();
      const deltaMs = now - lastTimestamp;
      lastTimestamp = now;

      try {
        const results = landmarker.detectForVideo(video, now);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];

          const drawingUtils = new DrawingUtils(ctx);
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: '#22c55e', lineWidth: 2 });

          const faceLeftEdge = landmarks[234];
          const faceRightEdge = landmarks[454];
          const noseTip = landmarks[1];

          let lookingAway = false;

          if (faceLeftEdge && faceRightEdge && noseTip) {
            const faceWidth = Math.abs(faceRightEdge.x - faceLeftEdge.x);
            const faceCenterX = (faceLeftEdge.x + faceRightEdge.x) / 2;
            const headTurnOffset = Math.abs(noseTip.x - faceCenterX);
            
            if (headTurnOffset > faceWidth * 0.15) {
              lookingAway = true;
            }
          }

          totalTrackingMsRef.current += deltaMs;

          if (lookingAway) {
            setFaceStatus('away');
            if (lookAwayStartRef.current === null) {
              lookAwayStartRef.current = Date.now();
            } else if (Date.now() - lookAwayStartRef.current > 1500) {
               if (Date.now() - lookAwayAlertThrottleRef.current > 5000) {
                 lookAwayAlertThrottleRef.current = Date.now();
                 addAlert('👀 You looked away');
               }
            }
          } else {
            setFaceStatus('looking');
            eyeContactMsRef.current += deltaMs;
            lookAwayStartRef.current = null;
          }
        } else {
          setFaceStatus('none');
          totalTrackingMsRef.current += deltaMs;
        }

        if (totalTrackingMsRef.current > 0) {
           setEyeContactPercent(
             Math.min(100, Math.round((eyeContactMsRef.current / totalTrackingMsRef.current) * 100))
           );
        }

      } catch (err) {}
    }, 250); 
  };

  // ── 10s Countdown ──
  const triggerCountdown = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsCountingDown(true);
    setCountdownValue(10);
    setCountdownStatus('Initializing webcam...');

    try {
      // Request BOTH video and audio in ONE permission prompt.
      // Then IMMEDIATELY release the audio track so Speech Recognition API
      // gets exclusive, uncontested microphone access.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
      } catch {
        // Fallback for older browsers / Safari that reject complex constraints
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      
      // IMMEDIATELY stop the audio tracks — we only needed them for the permission prompt.
      // The Speech Recognition API will open its own separate mic channel.
      stream.getAudioTracks().forEach(track => track.stop());
      
      // Only attach the video tracks to the video element
      const videoOnlyStream = new MediaStream(stream.getVideoTracks());
      videoRef.current.srcObject = videoOnlyStream;
      await videoRef.current.play();
    } catch (err) {
      alert('Could not access camera/microphone. Please check browser permissions.');
      setIsCountingDown(false);
      return;
    }

    let count = 10;
    const interval = setInterval(() => {
      count -= 1;
      setCountdownValue(count);

      if (count === 8) {
        setCountdownStatus('Warming up AI tracking model...');
      } else if (count === 5) {
        // Warm up face detection (pre-compile GPU shaders)
        if (videoRef.current && faceLandmarkerRef.current && videoRef.current.readyState >= 2) {
          try {
            faceLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
            setCountdownStatus('AI Calibrated ✔');
          } catch (e) {}
        }
      } else if (count === 3) {
        setCountdownStatus('Get ready to speak...');
      } else if (count === 1) {
        setCountdownStatus('Starting now!');
      } else if (count <= 0) {
        clearInterval(interval);
        setIsCountingDown(false);
        
        // Reset all metric state
        transcriptRef.current = '';
        totalWordsRef.current = 0;
        setLiveTranscript('');
        setFillerWordCount(0);
        setWpm(0);
        wpmRef.current = 0;
        wordCountHistoryRef.current = [];
        eyeContactMsRef.current = 0;
        totalTrackingMsRef.current = 0;

        const startTime = Date.now();
        sessionStartTimeRef.current = startTime;
        lastSpeechTimeRef.current = startTime;
        sessionActiveRef.current = true;
        setSessionActive(true);

        // Start both systems ONLY now — clean, no race conditions
        startFaceTracking();
        if (speechSupported) {
          createAndStartRecognition();
        } else {
          addAlert('Speech not supported in this browser. Head & pause metrics only.');
        }
      }
    }, 1000);
  };

  const endSession = () => {
    if (elapsedSeconds < 5) {
      if (!confirm('Session is very short. End anyway?')) return;
    }

    sessionActiveRef.current = false;
    setSessionActive(false);

    if (faceTrackingIntervalRef.current) clearInterval(faceTrackingIntervalRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }

    const finalEyeContact = Math.min(100, Math.max(0, totalTrackingMsRef.current > 0 ? Math.round((eyeContactMsRef.current / totalTrackingMsRef.current) * 100) : 0));
    
    let paceScore = 0;
    const w = wpmRef.current;
    if (w >= 120 && w <= 160) paceScore = 100;
    else if (w > 0) paceScore = Math.max(0, 100 - Math.abs(w - 140) * 1.5);

    const fillerPenalty = Math.max(0, 100 - fillerWordCount * 5);
    const overallScore = Math.round(finalEyeContact * 0.4 + paceScore * 0.3 + fillerPenalty * 0.3);

    const sessionObj = {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      duration_seconds: elapsedSeconds,
      overall_score: overallScore || 0,
      eye_contact_percent: finalEyeContact,
      filler_word_count: fillerWordCount,
      avg_wpm: w || 0,
      long_pause_count: longPauseCountRef.current,
      transcript: transcriptRef.current || '',
      ai_strengths: [],
      ai_improvements: [],
      events: eventsRef.current,
    };

    const existing = JSON.parse(localStorage.getItem('facecoach_sessions') || '[]');
    existing.unshift(sessionObj);
    localStorage.setItem('facecoach_sessions', JSON.stringify(existing));

    navigate(`/report/${sessionObj.id}`);
  };

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      if (faceTrackingIntervalRef.current) clearInterval(faceTrackingIntervalRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) {} }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full">
      <div className="w-full md:w-[60%] relative bg-black flex flex-col justify-center items-center border-r border-white/10 overflow-hidden min-h-[400px]">
        {!sessionActive && !isCountingDown && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            {modelError ? (
              <div className="text-center max-w-md px-6 bg-error/10 border border-error/20 text-error p-6 rounded-2xl">
                <p className="font-bold mb-2">Error loading Face Tracker</p>
                <p className="text-sm text-white/75 mb-4">{modelError}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-error hover:bg-red-700 text-white rounded-lg text-sm smooth-transition">
                  Retry Loading
                </button>
              </div>
            ) : modelLoading ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-white/70">Loading AI face model…</p>
              </div>
            ) : (
              <div className="text-center max-w-md px-6">
                {!speechSupported && (
                  <div className="mb-4 bg-warning/10 border border-warning/20 text-warning px-4 py-3 rounded-lg text-sm">
                    ⚠️ {browser.name} does not support Speech Recognition{browser.isFirefox ? ' (enable it in about:config → media.webspeech.recognition.enable)' : ''}. You can still use FaceCoach for Eye Contact and silence tracking!
                  </div>
                )}
                <p className="text-white/60 mb-6">
                  Ready to test your pitch? Click below to start. A 10-second preparation countdown will begin to calibrate tracking.
                </p>
                <button
                  onClick={triggerCountdown}
                  className="bg-accent hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg smooth-transition shadow-[0_0_30px_rgba(249,115,22,0.4)]"
                >
                  Start Session
                </button>
              </div>
            )}
          </div>
        )}

        {isCountingDown && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="text-center max-w-sm px-6">
              <div className="text-8xl font-black text-accent mb-6 animate-pulse">
                {countdownValue}
              </div>
              <p className="text-xl font-bold text-white mb-2">Preparing Session</p>
              <p className="text-white/60 text-sm animate-pulse">{countdownStatus}</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-cover scale-x-[-1]"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none scale-x-[-1]"
        />

        {sessionActive && (
          <>
            <div className={`absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-sm font-medium ${
                faceStatus === 'looking' ? 'text-success' : faceStatus === 'away' ? 'text-warning' : 'text-error'
              }`}>
              {faceStatus === 'looking' ? '✅ Looking at camera' : faceStatus === 'away' ? '⚠️ Looking away' : '❌ No face detected'}
            </div>

            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end z-10">
              <div className="flex items-center gap-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
                <span className="font-mono text-xl font-bold">{formatTime(elapsedSeconds)}</span>
                {isListening ? (
                  <div className="flex items-center gap-2 text-success text-sm font-medium">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" /> Listening...
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-warning text-sm font-medium">
                    <div className="w-2 h-2 rounded-full bg-warning animate-pulse" /> Reconnecting mic...
                  </div>
                )}
              </div>
              <button
                onClick={endSession}
                className="bg-error hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold smooth-transition shadow-lg shadow-error/20"
              >
                End Session
              </button>
            </div>
          </>
        )}
      </div>

      <div className="w-full md:w-[40%] bg-background p-6 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-2">Live Metrics</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-white/10 p-5 rounded-xl flex flex-col">
            <span className="text-white/50 text-sm font-medium mb-1">👀 Eye Contact</span>
            <div
              className={`text-4xl font-bold smooth-transition ${
                eyeContactPercent > 70 ? 'text-success' : eyeContactPercent > 40 ? 'text-warning' : 'text-error'
              }`}
            >
              {eyeContactPercent}%
            </div>
          </div>

          <div className="bg-card border border-white/10 p-5 rounded-xl flex flex-col">
            <span className="text-white/50 text-sm font-medium mb-1">🗣️ Filler Words</span>
            <div
              className={`text-4xl font-bold smooth-transition ${
                fillerWordCount > 10 ? 'text-error' : fillerWordCount > 5 ? 'text-warning' : 'text-white'
              }`}
            >
              {fillerWordCount}
            </div>
          </div>

          <div className="bg-card border border-white/10 p-5 rounded-xl flex flex-col">
            <span className="text-white/50 text-sm font-medium mb-1">⏱️ Speaking Pace</span>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold text-white smooth-transition">{wpm}</div>
              <span className="text-sm text-white/40">wpm</span>
            </div>
            <span className="text-xs mt-2 text-white/50">
              {wpm === 0 ? 'Speak to measure' : wpm < 100 ? 'A bit slow' : wpm > 180 ? 'Too fast!' : '✓ Good pace'}
            </span>
          </div>

          <div className="bg-card border border-white/10 p-5 rounded-xl flex flex-col">
            <span className="text-white/50 text-sm font-medium mb-1">⏸️ Long Pauses</span>
            <div className="text-4xl font-bold text-white smooth-transition">{longPauseCount}</div>
          </div>
        </div>

        <div className="mt-4 bg-card border border-white/10 p-4 rounded-xl flex-shrink-0 h-32 flex flex-col">
           <h3 className="text-sm font-medium text-white/40 mb-2">Live Transcript</h3>
           <div className="flex-1 overflow-y-auto text-sm text-white/80 leading-relaxed font-mono">
              {liveTranscript || <span className="text-white/30 italic">Start speaking to see transcription...</span>}
           </div>
        </div>

        <div className="mt-4 flex-1 flex flex-col">
          <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-2">
            Recent Alerts
          </h3>
          <div className="flex flex-col gap-2 overflow-hidden h-32 relative">
            {alerts.length === 0 ? (
              <p className="text-white/20 italic">No alerts yet…</p>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="bg-white/5 border border-white/10 px-4 py-3 rounded-lg text-sm"
                >
                  {a.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
