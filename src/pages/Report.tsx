import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function Report() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    const sessions = JSON.parse(localStorage.getItem('facecoach_sessions') || '[]');
    const found = sessions.find((s: any) => s.id === id);
    if (!found) {
      setSession('not_found');
      return;
    }
    setSession(found);

    // Call AI if no feedback exists
    if (!found.ai_strengths || found.ai_strengths.length === 0) {
      fetchAiFeedback(found);
    }
  }, [id]);

  const fetchAiFeedback = async (sessionData: any) => {
    setLoadingAi(true);
    try {
      const customKey = localStorage.getItem('facecoach_gemini_api_key');
      const customModel = localStorage.getItem('facecoach_gemini_model');
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: sessionData.transcript,
          customApiKey: customKey || undefined,
          customModel: customModel || undefined,
          metrics: {
            eyeContact: sessionData.eye_contact_percent,
            fillerWords: sessionData.filler_word_count,
            avgPace: sessionData.avg_wpm,
            longPauses: sessionData.long_pause_count
          }
        })
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      // Update local storage and state
      const sessions = JSON.parse(localStorage.getItem('facecoach_sessions') || '[]');
      const index = sessions.findIndex((s: any) => s.id === sessionData.id);
      if (index !== -1) {
        sessions[index].ai_strengths = data.strengths || [];
        sessions[index].ai_improvements = data.improvements || [];
        localStorage.setItem('facecoach_sessions', JSON.stringify(sessions));
        setSession(sessions[index]);
      }
    } catch (err) {
      console.error("Failed to fetch AI feedback", err);
      // Fallback state if API fails
      setSession((prev: any) => ({
        ...prev,
        ai_strengths: ['Add a valid Gemini API Key to see AI feedback'],
        ai_improvements: ['Check the README for setup instructions']
      }));
    } finally {
      setLoadingAi(false);
    }
  };

  if (session === 'not_found') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Session Not Found</h1>
        <p className="text-white/60 mb-8">This session doesn't exist or was deleted.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-white/10 rounded-xl hover:bg-white/20 smooth-transition">
          Go Home
        </button>
      </div>
    );
  }

  if (!session) return <div className="flex-1 flex items-center justify-center">Loading...</div>;

  // Chart Data preparation
  const chartLabels = session.events.map((e: any) => formatTime(e.time));
  // Reconstruct score over time. We start at 100 and apply penalties based on events.
  let currentScore = 100;
  const chartDataPoints = session.events.map((e: any) => {
    if (e.type === 'filler') currentScore = Math.max(0, currentScore - 2);
    if (e.type === 'lookaway') currentScore = Math.max(0, currentScore - 5);
    if (e.type === 'pause') currentScore = Math.max(0, currentScore - 5);
    // gradually recover if no bad events
    currentScore = Math.min(100, currentScore + 1);
    return currentScore;
  });

  // If no events, just flat line
  if (chartDataPoints.length === 0) {
    chartLabels.push('0:00', formatTime(session.duration_seconds));
    chartDataPoints.push(session.overall_score, session.overall_score);
  }

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        fill: true,
        label: 'Session Score',
        data: chartDataPoints,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
      x: { grid: { display: false } }
    }
  };

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-6 py-10">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <button onClick={() => navigate('/history')} className="text-white/50 hover:text-white mb-2 flex items-center gap-2 text-sm smooth-transition">
            <ArrowLeft size={16} /> Back to History
          </button>
          <h1 className="text-3xl font-bold">Session Report</h1>
          <p className="text-white/40 mt-1">{new Date(session.created_at).toLocaleString()}</p>
        </div>
        
        {/* Overall Score Circle */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
            {/* Background track */}
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/10" />
            {/* Progress track */}
            <circle 
              cx="48" cy="48" r="40" 
              stroke="currentColor" 
              strokeWidth="8" 
              fill="transparent" 
              strokeLinecap="round"
              className={`${session.overall_score > 80 ? 'text-success' : session.overall_score > 50 ? 'text-warning' : 'text-error'} smooth-transition`} 
              strokeDasharray="251.2" 
              strokeDashoffset={251.2 - (251.2 * session.overall_score) / 100} 
            />
          </svg>
          <span className="text-2xl font-black relative z-10">{session.overall_score}</span>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <MetricCard title="Eye Contact" value={`${session.eye_contact_percent}%`} label={session.eye_contact_percent > 80 ? 'Excellent' : 'Needs Work'} good={session.eye_contact_percent > 80} />
        <MetricCard title="Filler Words" value={session.filler_word_count} label={session.filler_word_count < 10 ? 'Great focus' : 'Too many fillers'} good={session.filler_word_count < 10} />
        <MetricCard title="Avg Pace" value={`${session.avg_wpm} wpm`} label={session.avg_wpm > 120 && session.avg_wpm < 160 ? 'Perfect pace' : 'Out of range'} good={session.avg_wpm >= 120 && session.avg_wpm <= 160} />
        <MetricCard title="Long Pauses" value={session.long_pause_count} label={session.long_pause_count === 0 ? 'Smooth delivery' : 'Awkward silences'} good={session.long_pause_count === 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        {/* Timeline Chart */}
        <div className="md:col-span-2 bg-card border border-white/10 p-6 rounded-2xl h-80 flex flex-col">
          <h3 className="text-lg font-bold mb-4">Performance Timeline</h3>
          <div className="flex-1 min-h-0">
            <Line options={chartOptions} data={chartData} />
          </div>
        </div>

        {/* Events List */}
        <div className="bg-card border border-white/10 p-6 rounded-2xl h-80 flex flex-col">
          <h3 className="text-lg font-bold mb-4">Event Log</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {session.events.length === 0 ? (
              <p className="text-white/40 text-sm">No major events recorded. Perfect run!</p>
            ) : (
              session.events.map((evt: any, i: number) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-white/40 font-mono shrink-0">{formatTime(evt.time)}</span>
                  <span className="text-white/80">{evt.type === 'filler' ? `🗣️ Filler: "${evt.detail}"` : evt.type === 'lookaway' ? `👀 Looked away` : evt.type === 'fast' ? `⚡ Too fast` : `⏸️ Pause`}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Feedback Section */}
      <div className="border-t border-white/10 pt-10 mb-10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span className="text-accent">✨</span> AI Coaching Notes
        </h2>
        
        {loadingAi ? (
          <div className="bg-card border border-white/10 p-10 rounded-2xl flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-white/60">Gemini is analyzing your session...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-success/10 border border-success/20 p-6 rounded-2xl">
              <h3 className="text-success font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 size={20} /> Strengths
              </h3>
              <ul className="space-y-3">
                {session.ai_strengths?.map((str: string, i: number) => (
                  <li key={i} className="text-white/80 text-sm leading-relaxed flex gap-2">
                    <span className="text-success mt-1">•</span> <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-warning/10 border border-warning/20 p-6 rounded-2xl">
              <h3 className="text-warning font-bold mb-4 flex items-center gap-2">
                <AlertTriangle size={20} /> Areas to Improve
              </h3>
              <ul className="space-y-3">
                {session.ai_improvements?.map((imp: string, i: number) => (
                  <li key={i} className="text-white/80 text-sm leading-relaxed flex gap-2">
                    <span className="text-warning mt-1">•</span> <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4 border-t border-white/10 pt-10">
        <button className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium smooth-transition flex items-center gap-2 text-white/60">
          <CheckCircle2 size={18} className="text-success" /> Saved to History
        </button>
        <button onClick={() => navigate('/session')} className="px-6 py-3 bg-accent hover:bg-orange-600 rounded-xl font-medium smooth-transition text-white shadow-lg shadow-accent/20">
          Start New Session
        </button>
      </div>

    </div>
  );
}

function MetricCard({title, value, label, good}: {title: string, value: string|number, label: string, good: boolean}) {
  return (
    <div className="bg-card border border-white/10 p-5 rounded-2xl flex flex-col">
      <span className="text-white/40 text-sm font-medium mb-2">{title}</span>
      <span className={`text-3xl font-black mb-1 ${good ? 'text-success' : 'text-warning'}`}>{value}</span>
      <span className="text-xs text-white/50">{label}</span>
    </div>
  );
}
