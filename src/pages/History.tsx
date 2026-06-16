import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('facecoach_sessions') || '[]');
    setSessions(saved);
  }, []);

  const clearHistory = () => {
    if (confirm('Are you sure you want to delete all history? This cannot be undone.')) {
      localStorage.removeItem('facecoach_sessions');
      setSessions([]);
    }
  };

  const deleteSession = (e: React.MouseEvent, idToRemove: string) => {
    e.stopPropagation(); // prevent navigation to the report page
    if (confirm('Are you sure you want to delete this session?')) {
      const updated = sessions.filter((s: any) => s.id !== idToRemove);
      localStorage.setItem('facecoach_sessions', JSON.stringify(updated));
      setSessions(updated);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 text-3xl">📊</div>
        <h1 className="text-3xl font-bold mb-4">No sessions yet</h1>
        <p className="text-white/60 mb-8 max-w-md">Start your first session to begin tracking your public speaking progress over time.</p>
        <button onClick={() => navigate('/session')} className="px-8 py-4 bg-accent hover:bg-orange-600 rounded-xl font-bold text-white smooth-transition shadow-lg shadow-accent/20">
          Start First Session
        </button>
      </div>
    );
  }

  const bestScore = Math.max(...sessions.map(s => s.overall_score));
  const avgScore = Math.round(sessions.reduce((acc, s) => acc + s.overall_score, 0) / sessions.length);

  // Chart Data (reverse to show chronological order left to right)
  const chronological = [...sessions].reverse();
  const chartData = {
    labels: chronological.map((_, i) => `Session ${i + 1}`),
    datasets: [
      {
        label: 'Overall Score',
        data: chronological.map(s => s.overall_score),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.3,
        fill: true,
      }
    ]
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-6 py-10">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Progress</h1>
          <p className="text-white/40 mt-1">Review past sessions and see your improvement</p>
        </div>
        <button onClick={clearHistory} className="text-white/40 hover:text-error flex items-center gap-2 text-sm smooth-transition">
          <Trash2 size={16} /> Clear All
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-card border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <span className="text-white/40 text-sm font-medium mb-1">Total Sessions</span>
          <span className="text-3xl font-black">{sessions.length}</span>
        </div>
        <div className="bg-card border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <span className="text-white/40 text-sm font-medium mb-1">Best Score</span>
          <span className="text-3xl font-black text-success">{bestScore}</span>
        </div>
        <div className="bg-card border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <span className="text-white/40 text-sm font-medium mb-1">Average Score</span>
          <span className="text-3xl font-black text-accent">{avgScore}</span>
        </div>
      </div>

      {/* Progress Chart */}
      <div className="bg-card border border-white/10 rounded-2xl p-6 h-64 mb-10">
        <Line 
          data={chartData} 
          options={{
            responsive: true, maintainAspectRatio: false,
            scales: { y: { min: 0, max: 100 } }
          }} 
        />
      </div>

      {/* Session Grid */}
      <h2 className="text-xl font-bold mb-4">Past Sessions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session, i) => {
          
          // Find weakest metric
          const metrics = [
            { name: 'Eye Contact', val: session.eye_contact_percent, weight: 1 },
            { name: 'Pace', val: session.avg_wpm >= 120 && session.avg_wpm <= 160 ? 100 : 0, weight: 1 },
            { name: 'Fillers', val: Math.max(0, 100 - session.filler_word_count * 5), weight: 1 }
          ];
          metrics.sort((a, b) => a.val - b.val);
          const weakest = metrics[0].name;

          return (
            <div 
              key={session.id} 
              onClick={() => navigate(`/report/${session.id}`)}
              className="bg-card border border-white/10 rounded-xl p-5 cursor-pointer hover:border-accent hover:shadow-[0_0_15px_rgba(249,115,22,0.15)] smooth-transition flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold">Session {sessions.length - i}</h3>
                  <span className="text-xs text-white/40">{new Date(session.created_at).toLocaleDateString()}</span>
                </div>
                <div className={`text-xl font-black ${session.overall_score > 80 ? 'text-success' : session.overall_score > 50 ? 'text-warning' : 'text-error'}`}>
                  {session.overall_score}
                </div>
              </div>
              
              <div className="text-sm text-white/60 mb-4">
                Duration: {Math.floor(session.duration_seconds / 60)}:{(session.duration_seconds % 60).toString().padStart(2, '0')}
              </div>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="inline-flex px-3 py-1 bg-white/5 rounded-full text-xs text-white/60 border border-white/10">
                  Needs work: {weakest}
                </div>
                <button 
                  onClick={(e) => deleteSession(e, session.id)} 
                  className="text-white/30 hover:text-error smooth-transition p-2 rounded-full hover:bg-error/10"
                  title="Delete session"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
    </div>
  );
}
