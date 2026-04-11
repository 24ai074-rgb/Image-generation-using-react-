/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  Loader2, 
  Settings2, 
  Maximize2, 
  History,
  Info,
  ChevronRight,
  Zap,
  Search,
  Layout,
  X,
  Clock,
  Wand2,
  ArrowRight,
  Eye,
  Layers,
  Globe,
  Check,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import { 
  generateImage, 
  refinePrompt, 
  AspectRatio, 
  ImageSize, 
  GenerationOptions 
} from './lib/gemini';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  options: GenerationOptions;
}

// — Aspect ratio visual mini-icons —
function AspectIcon({ ratio }: { ratio: string }) {
  const dims: Record<string, { w: number; h: number }> = {
    '1:1': { w: 14, h: 14 },
    '4:3': { w: 16, h: 12 },
    '3:4': { w: 12, h: 16 },
    '16:9': { w: 18, h: 10 },
    '9:16': { w: 10, h: 18 },
    '21:9': { w: 21, h: 9 },
  };
  const d = dims[ratio] || { w: 14, h: 14 };
  return (
    <div
      className="rounded-sm border border-current opacity-60"
      style={{ width: d.w, height: d.h }}
    />
  );
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [options, setOptions] = useState<GenerationOptions>({
    aspectRatio: '1:1',
    imageSize: '1K',
    useSearch: false
  });
  const [smartPrompt, setSmartPrompt] = useState(false); // Disabled by default to save quota
  const [error, setError] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lumina_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('lumina_history', JSON.stringify(history));
  }, [history]);

  // Cooldown timer for rate limiting
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds(cooldownSeconds - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [prompt]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds}s before generating another image`);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      let finalPrompt = prompt;
      
      if (smartPrompt && !quotaExhausted) {
        setIsRefining(true);
        try {
          finalPrompt = await refinePrompt(prompt);
        } catch (refineError: any) {
          console.warn("Prompt refinement skipped, using original prompt");
          setError("Smart prompt temporarily unavailable. Using original prompt.");
        } finally {
          setIsRefining(false);
        }
      }

      const result = await generateImage(finalPrompt, options);
      
      const newImage: GeneratedImage = {
        id: Math.random().toString(36).substring(7),
        url: result.imageUrl,
        prompt: finalPrompt,
        timestamp: Date.now(),
        options: { ...options }
      };

      setCurrentImage(newImage);
      setHistory(prev => [newImage, ...prev]);
      setCooldownSeconds(1); // Minimal cooldown for paid tier
      
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#7c5cfc', '#00d4ff', '#ff6bcb', '#34d399']
      });

    } catch (err: any) {
      const message = err.message || "Failed to generate image. Please try again.";
      setError(message);
      setCooldownSeconds(1); // Minimal cooldown after error
      
      if (message.includes("quota")) {
        setQuotaExhausted(true);
        console.warn("⚠️ API quota issue detected. This may indicate a billing problem with your paid tier or an API issue.");
      }
    } finally {
      setIsGenerating(false);
      setIsRefining(false);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteFromHistory = (id: string) => {
    setHistory(prev => prev.filter(img => img.id !== id));
    if (currentImage?.id === id) setCurrentImage(null);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  // Generating overlay
  const GeneratingOverlay = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(124,92,252,0.08) 0%, rgba(8,9,13,0.95) 70%)'
      }}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-2 border-transparent"
            style={{
              borderTopColor: '#7c5cfc',
              borderRightColor: '#00d4ff',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-accent-primary" />
          </div>
          <motion.div
            animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full border border-accent-primary/30"
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary">
            {isRefining ? 'Refining your prompt…' : 'Creating your image…'}
          </p>
          <p className="text-xs text-text-muted mt-1">This may take a few seconds</p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-surface-900 text-text-primary font-sans relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #7c5cfc 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #00d4ff 0%, transparent 70%)' }}
        />
      </div>

      {/* ─── Top Nav ─── */}
      <header className="sticky top-0 z-50 glass border-b border-white/[0.04]">
        <div className="max-w-[1800px] mx-auto px-6 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-display font-bold tracking-tight">
              <span className="gradient-text">Lumina</span>
            </h1>
            <span className="hidden sm:inline-flex ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
              AI Studio
            </span>
          </div>

          {/* Status + Actions */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-700/60 border border-white/[0.04]">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                quotaExhausted ? "bg-accent-warning animate-pulse" : "bg-accent-success"
              )} />
              <span className="text-[11px] font-medium text-text-secondary">
                {quotaExhausted ? "API Quota Warning" : "Gemini Ready"}
              </span>
            </div>
            {history.length > 0 && (
              <button
                id="clear-history-btn"
                onClick={() => setHistory([])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary hover:text-accent-danger hover:bg-accent-danger/10 transition-all duration-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main Layout ─── */}
      <main className="relative z-10 max-w-[1800px] mx-auto flex flex-col lg:flex-row min-h-[calc(100vh-56px)]">
        
        {/* ════════════ Left Panel — Controls ════════════ */}
        <aside className="w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-white/[0.04] bg-surface-900/80 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* ── Prompt Input ── */}
            <section id="prompt-section">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-accent-primary" />
                  Prompt
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-text-muted">Smart</span>
                  <button 
                    id="smart-prompt-toggle"
                    onClick={() => setSmartPrompt(!smartPrompt)}
                    disabled={quotaExhausted}
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors duration-300",
                      quotaExhausted 
                        ? "bg-surface-600 opacity-40 cursor-not-allowed"
                        : smartPrompt ? "bg-accent-primary" : "bg-surface-500"
                    )}
                    title={quotaExhausted ? "Smart Refine temporarily disabled" : "Use AI to enhance prompts"}
                  >
                    <motion.div 
                      animate={{ x: smartPrompt ? 17 : 2 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-md"
                    />
                  </button>
                </div>
              </div>
              <div className="relative group">
                <textarea 
                  ref={textareaRef}
                  id="prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the image you want to create…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-surface-700/60 border border-white/[0.06] text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent-primary/40 focus:ring-2 focus:ring-accent-primary/10 transition-all duration-200 leading-relaxed"
                />
                <div className="absolute bottom-2 right-2 text-[10px] text-text-muted opacity-0 group-focus-within:opacity-100 transition-opacity">
                  Ctrl + Enter
                </div>
              </div>
            </section>

            {/* ── Settings Panel ── */}
            <section id="settings-section">
              <button
                id="settings-toggle"
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between mb-3 group"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-accent-secondary" />
                  Settings
                </span>
                <motion.div animate={{ rotate: showSettings ? 90 : 0 }}>
                  <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-secondary transition-colors" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden space-y-5"
                  >
                    {/* Aspect Ratio */}
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2 block flex items-center gap-1.5">
                        <Maximize2 className="w-3 h-3" />
                        Aspect Ratio
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"] as AspectRatio[]).map((ratio) => (
                          <button
                            key={ratio}
                            id={`aspect-ratio-${ratio.replace(':','-')}`}
                            onClick={() => setOptions({ ...options, aspectRatio: ratio })}
                            className={cn(
                              "py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                              options.aspectRatio === ratio 
                                ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/30 shadow-sm shadow-accent-primary/10" 
                                : "bg-surface-700/40 text-text-secondary border border-white/[0.04] hover:border-white/[0.1] hover:text-text-primary"
                            )}
                          >
                            <AspectIcon ratio={ratio} />
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quality */}
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2 block flex items-center gap-1.5">
                        <Layers className="w-3 h-3" />
                        Quality
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(["512px", "1K", "2K", "4K"] as ImageSize[]).map((size) => (
                          <button
                            key={size}
                            id={`quality-${size}`}
                            onClick={() => setOptions({ ...options, imageSize: size })}
                            className={cn(
                              "py-2 rounded-lg text-[11px] font-semibold transition-all duration-200",
                              options.imageSize === size 
                                ? "bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/30 shadow-sm shadow-accent-secondary/10" 
                                : "bg-surface-700/40 text-text-secondary border border-white/[0.04] hover:border-white/[0.1] hover:text-text-primary"
                            )}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Google Search Toggle */}
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-700/30 border border-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-accent-tertiary" />
                        <div>
                          <p className="text-[11px] font-semibold text-text-primary">Web Search</p>
                          <p className="text-[10px] text-text-muted">Context from the web</p>
                        </div>
                      </div>
                      <button 
                        id="search-toggle"
                        onClick={() => setOptions({ ...options, useSearch: !options.useSearch })}
                        className={cn(
                          "relative w-9 h-5 rounded-full transition-colors duration-300",
                          options.useSearch ? "bg-accent-tertiary" : "bg-surface-500"
                        )}
                      >
                        <motion.div 
                          animate={{ x: options.useSearch ? 17 : 2 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          className="absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* ── Error Display ── */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={cn(
                    "p-4 rounded-xl border text-xs font-medium space-y-2",
                    quotaExhausted
                      ? "bg-accent-warning/5 border-accent-warning/20 text-accent-warning"
                      : "bg-accent-danger/5 border-accent-danger/20 text-accent-danger"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p>{error}</p>
                      {quotaExhausted && (
                        <div className="mt-2 text-[10px] opacity-75 space-y-0.5">
                          <p>🔑 Check API key and billing status</p>
                          <p>📄 Visit: console.cloud.google.com</p>
                          <p>💳 Verify billing is active</p>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Generate Button (pinned to bottom) ── */}
          <div className="p-6 pt-0">
            <button
              id="generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || cooldownSeconds > 0}
              className={cn(
                "w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all duration-300 relative overflow-hidden",
                isGenerating || !prompt.trim() || cooldownSeconds > 0
                  ? "bg-surface-600 text-text-muted cursor-not-allowed"
                  : "bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-lg shadow-accent-primary/25 hover:shadow-xl hover:shadow-accent-primary/30 hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {/* Shimmer effect on hover */}
              {!isGenerating && prompt.trim() && cooldownSeconds === 0 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
              )}

              {cooldownSeconds > 0 ? (
                <>
                  <Clock className="w-4 h-4" />
                  Wait {cooldownSeconds}s
                </>
              ) : isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRefining ? "Enhancing…" : "Creating…"}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-text-muted mt-2">
              Powered by Gemini · {history.length} image{history.length !== 1 ? 's' : ''} created
            </p>
          </div>
        </aside>

        {/* ════════════ Center — Canvas ════════════ */}
        <div className="flex-1 flex flex-col relative">
          {/* Canvas Area */}
          <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <GeneratingOverlay key="loading" />
              ) : currentImage ? (
                <motion.div 
                  key={currentImage.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  className="relative group max-w-full w-full flex flex-col items-center"
                >
                  {/* Image Container */}
                  <div className="relative rounded-2xl overflow-hidden glow-accent shadow-2xl shadow-black/40 max-w-[800px] w-fit">
                    <img 
                      id="current-image"
                      src={currentImage.url} 
                      alt={currentImage.prompt}
                      className="max-h-[65vh] w-auto object-contain cursor-pointer"
                      onClick={() => setLightboxOpen(true)}
                    />
                    
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                        <div className="flex gap-2">
                          <button 
                            id="download-image-btn"
                            onClick={(e) => { e.stopPropagation(); downloadImage(currentImage.url, `lumina-${currentImage.id}`); }}
                            className="p-2.5 rounded-xl glass border border-white/10 text-white hover:bg-white/20 transition-all duration-200"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            id="expand-image-btn"
                            onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                            className="p-2.5 rounded-xl glass border border-white/10 text-white hover:bg-white/20 transition-all duration-200"
                            title="Expand"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            id="delete-image-btn"
                            onClick={(e) => { e.stopPropagation(); deleteFromHistory(currentImage.id); }}
                            className="p-2.5 rounded-xl glass border border-white/10 text-white hover:bg-accent-danger/60 transition-all duration-200"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-[10px] text-white/70 font-medium">
                          <Clock className="w-3 h-3" />
                          {formatTime(currentImage.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Prompt caption */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-5 max-w-[700px] w-full px-5 py-3 rounded-xl bg-surface-800/80 border border-white/[0.04]"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Prompt</p>
                    <p className="text-xs text-text-secondary leading-relaxed italic">"{currentImage.prompt}"</p>
                  </motion.div>
                </motion.div>
              ) : (
                /* Empty state */
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center space-y-8 max-w-lg"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative mx-auto w-28 h-28"
                  >
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 border border-white/[0.06]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-text-muted" />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0, 0.2] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute -inset-3 rounded-[2rem] border border-accent-primary/10"
                    />
                  </motion.div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-display font-bold">
                      <span className="gradient-text">Create something amazing</span>
                    </h2>
                    <p className="text-sm text-text-muted leading-relaxed">
                      Describe what you want to see, and Lumina will bring it to life using AI.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['Cyberpunk city at night', 'Watercolor landscape', 'Cute robot watering plants'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setPrompt(suggestion)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-surface-700/50 border border-white/[0.06] text-text-secondary hover:text-accent-primary hover:border-accent-primary/30 transition-all duration-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── History Strip ── */}
          {history.length > 0 && (
            <section className="border-t border-white/[0.04] bg-surface-900/60 px-6 py-4">
              <div className="flex items-center gap-3 mb-3">
                <History className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Recent — {history.length}
                </span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                {history.map((img) => (
                  <motion.button
                    key={img.id}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setCurrentImage(img)}
                    className={cn(
                      "shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 relative group",
                      currentImage?.id === img.id 
                        ? "border-accent-primary shadow-lg shadow-accent-primary/20" 
                        : "border-white/[0.06] hover:border-white/[0.15]"
                    )}
                  >
                    <img 
                      src={img.url} 
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                    />
                    {currentImage?.id === img.id && (
                      <motion.div
                        layoutId="history-highlight"
                        className="absolute inset-0 border-2 border-accent-primary rounded-xl"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-3.5 h-3.5 text-white" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ─── Lightbox ─── */}
      <AnimatePresence>
        {lightboxOpen && currentImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={currentImage.url}
              alt={currentImage.prompt}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              id="lightbox-close-btn"
              className="absolute top-6 right-6 p-3 rounded-full glass border border-white/10 text-white hover:bg-white/10 transition-all"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); downloadImage(currentImage.url, `lumina-${currentImage.id}`); }}
                className="px-4 py-2 rounded-xl glass border border-white/10 text-white text-xs font-medium flex items-center gap-2 hover:bg-white/10 transition-all"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
