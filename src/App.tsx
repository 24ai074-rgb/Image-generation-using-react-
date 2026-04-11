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
  Layout
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

  const scrollRef = useRef<HTMLDivElement>(null);

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

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (cooldownSeconds > 0) {
      setError(`⏱️ Please wait ${cooldownSeconds}s before generating another image`);
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
          setError("⚠️ Smart prompt temporarily unavailable. Using original prompt.");
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
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00FF00', '#000000', '#FFFFFF']
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

  return (
    <div className="min-h-screen bg-[#F0F0F0] text-black font-sans selection:bg-[#00FF00] selection:text-black">
      {/* Header */}
      <header className="border-b-2 border-black bg-white sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black flex items-center justify-center rounded-sm">
              <Sparkles className="text-[#00FF00] w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">Lumina</h1>
          </div>
          <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest">
            <span className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                quotaExhausted ? "bg-orange-500" : "bg-[#00FF00]"
              )} />
              {quotaExhausted ? "⚠️ API Error" : "🚀 Gemini 2.5 Ready"}
            </span>
            <button 
              onClick={() => setHistory([])}
              className="hover:text-[#00FF00] transition-colors flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Clear History
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto flex flex-col lg:flex-row min-h-[calc(100vh-64px)]">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-[400px] border-r-2 border-black bg-white p-8 flex flex-col gap-8 overflow-y-auto">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Layout className="w-4 h-4" />
                Prompt
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase opacity-50">Smart Refine</span>
                <button 
                  onClick={() => setSmartPrompt(!smartPrompt)}
                  disabled={quotaExhausted}
                  className={cn(
                    "w-10 h-5 rounded-full border-2 border-black transition-colors relative",
                    quotaExhausted 
                      ? "bg-gray-100 opacity-50 cursor-not-allowed"
                      : smartPrompt ? "bg-[#00FF00]" : "bg-gray-200"
                  )}
                  title={quotaExhausted ? "Smart Refine temporarily disabled" : "Use AI to enhance prompts"}
                >
                  <motion.div 
                    animate={{ x: smartPrompt ? 20 : 2 }}
                    className="absolute top-0.5 left-0.5 w-3 h-3 bg-black rounded-full"
                  />
                </button>
              </div>
            </div>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A futuristic cyberpunk city with neon lights and flying cars..."
              className="w-full h-32 p-4 border-2 border-black focus:outline-none focus:ring-4 focus:ring-[#00FF00]/20 resize-none font-medium text-sm leading-relaxed"
            />
          </section>

          <section className="space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Maximize2 className="w-4 h-4" />
                Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setOptions({ ...options, aspectRatio: ratio })}
                    className={cn(
                      "py-2 border-2 border-black text-[10px] font-bold transition-all",
                      options.aspectRatio === ratio 
                        ? "bg-black text-white translate-x-1 -translate-y-1 shadow-[-4px_4px_0px_0px_#00FF00]" 
                        : "bg-white hover:bg-gray-50"
                    )}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Quality
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["512px", "1K", "2K", "4K"] as ImageSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setOptions({ ...options, imageSize: size })}
                    className={cn(
                      "py-2 border-2 border-black text-[10px] font-bold transition-all",
                      options.imageSize === size 
                        ? "bg-black text-white translate-x-1 -translate-y-1 shadow-[-4px_4px_0px_0px_#00FF00]" 
                        : "bg-white hover:bg-gray-50"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-2 border-black bg-gray-50">
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-tighter">Google Search</p>
                  <p className="text-[9px] opacity-60">Use web context for generation</p>
                </div>
              </div>
              <button 
                onClick={() => setOptions({ ...options, useSearch: !options.useSearch })}
                className={cn(
                  "w-10 h-5 rounded-full border-2 border-black transition-colors relative",
                  options.useSearch ? "bg-[#00FF00]" : "bg-gray-300"
                )}
              >
                <motion.div 
                  animate={{ x: options.useSearch ? 20 : 2 }}
                  className="absolute top-0.5 left-0.5 w-3 h-3 bg-black rounded-full"
                />
              </button>
            </div>
          </section>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || cooldownSeconds > 0}
            className={cn(
              "mt-auto w-full py-6 border-2 border-black font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all",
              isGenerating || !prompt.trim() || cooldownSeconds > 0
                ? "bg-gray-200 cursor-not-allowed opacity-50"
                : "bg-[#00FF00] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-8px_8px_0px_0px_#000000] active:translate-x-0 active:translate-y-0 active:shadow-none"
            )}
          >
            {cooldownSeconds > 0 ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Wait {cooldownSeconds}s...
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                {isRefining ? "Refining..." : "Generating..."}
              </>
            ) : (
              <>
                <Zap className="w-6 h-6 fill-black" />
                Create Magic
              </>
            )}
          </button>

          {error && (
            <div className={cn(
              "p-4 border-2 text-xs font-bold flex flex-col gap-2",
              quotaExhausted
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-red-500 bg-red-50 text-red-600"
            )}>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
              {quotaExhausted && (
                <div className="text-[10px] opacity-75 ml-6 space-y-1">
                  <p>� <strong>Troubleshooting:</strong> Check API key and billing status</p>
                  <p>📄 Visit: console.cloud.google.com → APIs & Services → Credentials</p>
                  <p>💳 Verify: Billing account is active and payment method is valid</p>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Main Display Area */}
        <div className="flex-1 p-8 flex flex-col gap-8 bg-[#F0F0F0]">
          {/* Current Image View */}
          <div className="flex-1 flex items-center justify-center min-h-[500px]">
            <AnimatePresence mode="wait">
              {currentImage ? (
                <motion.div 
                  key={currentImage.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  className="relative group max-w-full"
                >
                  <div className="absolute -inset-4 border-2 border-black bg-white -z-10 translate-x-2 translate-y-2" />
                  <div className="border-2 border-black bg-white p-2">
                    <img 
                      src={currentImage.url} 
                      alt={currentImage.prompt}
                      className="max-h-[70vh] w-auto object-contain"
                    />
                  </div>
                  
                  <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => downloadImage(currentImage.url, `lumina-${currentImage.id}`)}
                      className="p-3 bg-white border-2 border-black hover:bg-[#00FF00] transition-colors"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => deleteFromHistory(currentImage.id)}
                      className="p-3 bg-white border-2 border-black hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-6 p-4 border-2 border-black bg-white">
                    <p className="text-xs font-black uppercase tracking-widest mb-2 opacity-50">Prompt</p>
                    <p className="text-sm font-medium italic leading-relaxed">"{currentImage.prompt}"</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center space-y-6"
                >
                  <div className="w-32 h-32 border-4 border-black border-dashed rounded-full mx-auto flex items-center justify-center animate-[spin_10s_linear_infinite]">
                    <ImageIcon className="w-12 h-12 opacity-20" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black uppercase tracking-tighter italic">Ready to Visualize?</h2>
                    <p className="text-sm font-bold opacity-40 uppercase tracking-[0.3em]">Enter a prompt to begin your journey</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* History Gallery */}
          {history.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <h3 className="text-xs font-black uppercase tracking-[0.4em]">Recent Creations</h3>
                <div className="h-[1px] flex-1 bg-black opacity-10" />
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {history.map((img) => (
                  <motion.button
                    key={img.id}
                    layoutId={img.id}
                    onClick={() => setCurrentImage(img)}
                    whileHover={{ scale: 1.05, rotate: -2 }}
                    className={cn(
                      "aspect-square border-2 border-black bg-white p-1 overflow-hidden relative group",
                      currentImage?.id === img.id && "ring-4 ring-[#00FF00] ring-offset-2"
                    )}
                  >
                    <img 
                      src={img.url} 
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ChevronRight className="text-white w-8 h-8" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black bg-white py-6">
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            Powered by Google Gemini 3.1 Flash Image & React
          </p>
          <div className="flex items-center gap-8">
            <a href="#" className="text-[10px] font-black uppercase tracking-widest hover:text-[#00FF00] transition-colors">Documentation</a>
            <a href="#" className="text-[10px] font-black uppercase tracking-widest hover:text-[#00FF00] transition-colors">API Status</a>
            <a href="#" className="text-[10px] font-black uppercase tracking-widest hover:text-[#00FF00] transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

