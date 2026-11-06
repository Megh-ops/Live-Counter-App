import React, { useState, useEffect, useRef } from 'react';

// Play a satisfying synth click pop using native Web Audio API
function playPopSound(freq = 600) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch (e) {
    // Audio autoplay restrictions silently handled
  }
}

export default function App() {
  const [count, setCount] = useState(0);
  const [peakCount, setPeakCount] = useState(0);
  const [totalIncrements, setTotalIncrements] = useState(0);
  const [sessionClicks, setSessionClicks] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isIncreasing, setIsIncreasing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notification, setNotification] = useState('');
  const [activeUsers, setActiveUsers] = useState(1);
  const [bumpAnimation, setBumpAnimation] = useState(false);

  const eventSourceRef = useRef(null);
  const notificationTimeoutRef = useRef(null);

  const showToast = (msg) => {
    setNotification(msg);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => setNotification(''), 2500);
  };

  // 1. Fetch latest count from server (Manual / Initial refresh)
  const fetchLatestCount = async (notify = true) => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/count');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setCount(data.count ?? 0);
      setPeakCount(data.peakCount ?? 0);
      setTotalIncrements(data.totalIncrements ?? 0);
      setLastUpdated(data.lastUpdated ? new Date(data.lastUpdated) : new Date());
      setIsConnected(true);

      if (notify) {
        showToast('✨ Synchronized to latest server count!');
        if (soundEnabled) playPopSound(800);
      }
    } catch (err) {
      console.error('Failed to fetch count:', err);
      setIsConnected(false);
      showToast('⚠️ Could not connect to backend server');
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // 2. Increase count endpoint
  const handleIncrease = async () => {
    if (isIncreasing) return;
    setIsIncreasing(true);
    setBumpAnimation(true);
    setSessionClicks((prev) => prev + 1);

    if (soundEnabled) playPopSound(520);

    // Optimistic UI update
    setCount((prev) => prev + 1);

    try {
      const res = await fetch('/api/count/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1 }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setCount(data.count);
      setPeakCount(data.peakCount);
      setTotalIncrements(data.totalIncrements);
      setLastUpdated(new Date(data.lastUpdated));
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to increment count:', err);
      showToast('❌ Error updating count');
      // Rollback optimistic update
      fetchLatestCount(false);
    } finally {
      setTimeout(() => setIsIncreasing(false), 150);
      setTimeout(() => setBumpAnimation(false), 300);
    }
  };

  // 3. Connect to live Server-Sent Events (SSE) for true real-time multi-client updates
  useEffect(() => {
    fetchLatestCount(false);

    const sse = new EventSource('/api/count/stream');
    eventSourceRef.current = sse;

    sse.onopen = () => {
      setIsConnected(true);
    };

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setCount(data.count ?? 0);
        setPeakCount(data.peakCount ?? 0);
        setTotalIncrements(data.totalIncrements ?? 0);
        setActiveUsers(data.connectedUsers || 1);
        if (data.lastUpdated) {
          setLastUpdated(new Date(data.lastUpdated));
        }
        setIsConnected(true);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    sse.onerror = () => {
      setIsConnected(false);
      sse.close();
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          fetchLatestCount(false);
        }
      }, 3000);
    };

    return () => {
      sse.close();
    };
  }, []);

  // 4. Keyboard Shortcuts: Space/Enter = Increase, R = Refresh
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' || e.key === '+') {
        e.preventDefault();
        handleIncrease();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        fetchLatestCount(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [soundEnabled, isIncreasing]);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between p-4 md:p-8 bg-[#090d16] text-slate-100 overflow-x-hidden">
      {/* Background ambient neon glow spheres */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[650px] bg-indigo-600/20 rounded-full blur-[140px] -z-10" />
      <div className="pointer-events-none absolute bottom-0 right-10 w-[450px] h-[450px] bg-cyan-600/15 rounded-full blur-[120px] -z-10" />
      <div className="pointer-events-none absolute top-1/3 left-10 w-[350px] h-[350px] bg-fuchsia-600/10 rounded-full blur-[110px] -z-10" />

      {/* Top Navbar Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-3 px-4 glass-panel rounded-2xl mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Live Counter
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AWS EC2 Ready
              </span>
            </h1>
            <p className="text-xs text-slate-400">React Frontend + Express Backend</p>
          </div>
        </div>

        {/* Live Status indicator + Audio Toggle */}
        <div className="flex items-center space-x-2 md:space-x-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl text-slate-400 hover:text-white glass-btn transition-colors"
            title={soundEnabled ? 'Mute SFX' : 'Enable SFX'}
          >
            {soundEnabled ? (
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 shadow-inner">
            <span className="relative flex h-2.5 w-2.5">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span className="text-xs font-medium text-slate-300">
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      <div className={`fixed top-20 z-50 transition-all duration-300 transform ${notification ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="px-4 py-2 rounded-xl bg-slate-800/95 border border-indigo-500/40 text-slate-100 text-xs md:text-sm font-medium shadow-2xl backdrop-blur-md flex items-center gap-2">
          <span>{notification}</span>
        </div>
      </div>

      {/* Main Counter Centerpiece Card */}
      <main className="w-full max-w-lg my-auto py-6">
        <div className="relative glass-panel rounded-3xl p-6 md:p-10 text-center glow-primary border-slate-700/50">
          {/* Subtle Corner Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-6">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Real-time Express State</span>
          </div>

          <h2 className="text-xs md:text-sm uppercase tracking-wider font-semibold text-slate-400">
            Current Global Count
          </h2>

          {/* Huge Numeric Display */}
          <div className="my-8 flex items-center justify-center select-none">
            <span
              className={`font-mono-numbers text-7xl md:text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-indigo-200 glow-text transition-transform duration-200 ${
                bumpAnimation ? 'scale-110 text-indigo-400' : 'scale-100'
              }`}
            >
              {count.toLocaleString()}
            </span>
          </div>

          {/* Metadata Sub-bar */}
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400 mb-8 border-y border-slate-800/80 py-2.5">
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Updated:</span>
              <span className="text-slate-300 font-medium">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Waiting for sync...'}
              </span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Peak:</span>
              <span className="text-indigo-400 font-semibold">{peakCount.toLocaleString()}</span>
            </div>
          </div>

          {/* Action Buttons: INCREASE and REFRESH */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* INCREASE BUTTON */}
            <button
              onClick={handleIncrease}
              disabled={!isConnected}
              className={`group relative overflow-hidden flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-bold text-white text-base shadow-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isConnected
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/30 hover:shadow-indigo-500/50'
                  : 'bg-slate-700'
              }`}
            >
              <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-700 pointer-events-none" />
              <svg className="w-5 h-5 text-indigo-200 transition-transform group-hover:rotate-90 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
              </svg>
              <span>Increase</span>
            </button>

            {/* REFRESH BUTTON */}
            <button
              onClick={() => fetchLatestCount(true)}
              disabled={isRefreshing}
              className="glass-btn flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-bold text-slate-200 hover:text-white text-base transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              <svg
                className={`w-5 h-5 text-indigo-400 ${isRefreshing ? 'animate-spin-fast' : 'group-hover:rotate-180 transition-transform duration-500'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Quick Keyboard shortcut hint */}
          <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-slate-500">
            <span>Shortcuts:</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-400">Space</span>
            <span>to Increase</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-400">R</span>
            <span>to Refresh</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="glass-panel p-3.5 rounded-2xl text-center">
            <p className="text-[11px] font-medium text-slate-400">Your Clicks</p>
            <p className="text-lg font-bold font-mono-numbers text-indigo-300 mt-0.5">{sessionClicks}</p>
          </div>
          <div className="glass-panel p-3.5 rounded-2xl text-center">
            <p className="text-[11px] font-medium text-slate-400">Total Increments</p>
            <p className="text-lg font-bold font-mono-numbers text-slate-200 mt-0.5">{totalIncrements}</p>
          </div>
          <div className="glass-panel p-3.5 rounded-2xl text-center">
            <p className="text-[11px] font-medium text-slate-400">Connected Peers</p>
            <p className="text-lg font-bold font-mono-numbers text-emerald-400 mt-0.5">{activeUsers}</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl py-4 text-center text-xs text-slate-500">
        <p>Built with React &amp; Express • Ready for AWS EC2 Cloud Deployment</p>
      </footer>
    </div>
  );
}

