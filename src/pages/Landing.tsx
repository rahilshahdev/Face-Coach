import { Eye, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 w-full max-w-6xl mx-auto flex-1">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mb-24">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white/80 mb-8">
          <span className="text-accent">🎤</span> 100% Free · Runs in Your Browser
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          Your AI Public <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-400">Speaking Coach</span>
        </h1>
        
        <p className="text-xl text-white/60 mb-10 leading-relaxed max-w-2xl mx-auto">
          Real-time eye contact, filler word, and pace tracking. Powered by AI. 
          Runs entirely in your browser. Nothing you say or do leaves your device until you ask for feedback.
        </p>

        <button 
          onClick={() => navigate('/session')}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-accent rounded-xl overflow-hidden hover:bg-orange-600 smooth-transition hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(249,115,22,0.3)]"
        >
          <span>Start Session</span>
          <ArrowRight className="ml-2 group-hover:translate-x-1 smooth-transition" size={20} />
        </button>
        <p className="mt-4 text-sm text-white/40">No sign-up. No installs. Your video feed is processed 100% locally.</p>
      </div>

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-24">
        {/* Card 1 */}
        <div className="group bg-card border border-white/10 p-8 rounded-2xl hover:border-accent/40 hover:shadow-[0_0_30px_rgba(249,115,22,0.1)] smooth-transition">
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 smooth-transition">
            <Eye className="text-accent" size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3">Eye Contact Tracking</h3>
          <p className="text-white/60 leading-relaxed">
            AI watches whether you're engaging the camera or looking away, the same way a real audience would notice.
          </p>
        </div>

        {/* Card 2 */}
        <div className="group bg-card border border-white/10 p-8 rounded-2xl hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.1)] smooth-transition">
          <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 smooth-transition">
            <MessageSquare className="text-cyan-400" size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3">Filler Word Detection</h3>
          <p className="text-white/60 leading-relaxed">
            Detects verbal fillers like 'like', 'actually', 'you know' and highlights brief hesitations (um/uh sounds) in real time.
          </p>
        </div>

        {/* Card 3 */}
        <div className="group bg-card border border-white/10 p-8 rounded-2xl hover:border-fuchsia-500/40 hover:shadow-[0_0_30px_rgba(217,70,239,0.1)] smooth-transition">
          <div className="w-12 h-12 bg-fuchsia-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 smooth-transition">
            <Sparkles className="text-fuchsia-400" size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3">AI Coaching Notes</h3>
          <p className="text-white/60 leading-relaxed">
            After your session, Gemini analyzes your full transcript and gives you specific, encouraging coaching notes.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="w-full max-w-4xl border-t border-white/10 pt-16 text-center">
        <h2 className="text-3xl font-bold mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="text-4xl font-black text-white/10 mb-4">01</div>
            <h4 className="font-bold mb-2">Turn on your camera</h4>
            <p className="text-sm text-white/50">Grant permissions to start the completely private browser-based AI.</p>
          </div>
          <div>
            <div className="text-4xl font-black text-white/10 mb-4">02</div>
            <h4 className="font-bold mb-2">Speak naturally</h4>
            <p className="text-sm text-white/50">Deliver your pitch or presentation for as long as you want.</p>
          </div>
          <div>
            <div className="text-4xl font-black text-white/10 mb-4">03</div>
            <h4 className="font-bold mb-2">Get instant feedback</h4>
            <p className="text-sm text-white/50">Review your metrics immediately and read specific AI coaching notes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
