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
  Settings, 
  Maximize2,
  AlertCircle,
  ChevronRight,
  Wand2,
  Globe
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
  const [smartPrompt, setSmartPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
        colors: ['#3b82f6', '#1e40af', '#dbeafe']
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 font-sans selection:bg-blue-500 selection:text-white">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-8xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div className="flex items-center gap-3 group cursor-pointer">
            <motion.div 
              className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center rounded-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Sparkles className="text-white w-6 h-6" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Lumina</h1>
              <p className="text-xs text-slate-500 font-medium">AI Image Generator</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-medium">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                quotaExhausted ? "bg-amber-500" : "bg-green-500"
              )} />
              <span className="text-slate-600">
                {quotaExhausted ? "API Issue" : "Ready"}
              </span>
            </div>
            
            <motion.button 
              onClick={() => setShowSettings(!showSettings)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </motion.button>

            <motion.button 
              onClick={() => setHistory([])}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Clear all history"
            >
              <Trash2 className="w-5 h-5 text-slate-600" />
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-8xl mx-auto px-6 py-6 gap-6 flex flex-col lg:flex-row min-h-[calc(100vh-64px)]">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Prompt Input */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <label className="text-sm font-semibold text-slate-900">Describe your image</label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">AI Enhancement</span>
                <motion.button 
                  onClick={() => setSmartPrompt(!smartPrompt)}
                  disabled={quotaExhausted}
                  whileHover={{ scale: 1.05 }}
                  className={cn(
                    "relative inline-flex items-center h-6 w-11 rounded-full transition-colors",
                    smartPrompt 
                      ? "bg-blue-500" 
                      : "bg-slate-200",
                    quotaExhausted && "opacity-50 cursor-not-allowed"
                  )}
                  title="Enable AI to refine your prompt automatically"
                >
                  <motion.span
                    animate={{ x: smartPrompt ? 20 : 2 }}
                    className="inline-block h-4 w-4 transform bg-white rounded-full"
                  />
                </motion.button>
              </div>
            </div>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., A serene mountain landscape with golden hour lighting, misty valleys, and wildflowers..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none text-sm leading-relaxed placeholder-slate-400 transition-all"
              rows={4}
            />
          </motion.div>

          {/* Image Display Area */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center min-h-[400px]"
          >
            <AnimatePresence mode="wait">
              {currentImage ? (
                <motion.div 
                  key={currentImage.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative w-full h-full flex flex-col"
                >
                  <div className="flex-1 relative group bg-slate-50 flex items-center justify-center overflow-hidden">
                    <img 
                      src={currentImage.url} 
                      alt={currentImage.prompt}
                      className="max-h-full max-w-full object-contain"
                    />
                    
                    {/* Floating Actions */}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => downloadImage(currentImage.url, `lumina-${currentImage.id}`)}
                        className="p-2 bg-white hover:bg-blue-500 hover:text-white border border-slate-200 rounded-lg shadow-lg transition-all"
                        title="Download image"
                      >
                        <Download className="w-5 h-5" />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => deleteFromHistory(currentImage.id)}
                        className="p-2 bg-white hover:bg-red-500 hover:text-white border border-slate-200 rounded-lg shadow-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Prompt Info */}
                  <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Generated from</p>
                    <p className="text-sm text-slate-700 leading-relaxed italic">"{currentImage.prompt}"</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center space-y-4"
                >
                  <motion.div 
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-slate-300 text-5xl"
                  >
                    <ImageIcon className="w-16 h-16 mx-auto opacity-30" />
                  </motion.div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Create your image</h2>
                    <p className="text-sm text-slate-500">Write a detailed description and click generate</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Gallery Grid View */}
          {history.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Generation History</h3>
                <span className="text-xs text-slate-500 font-medium">{history.length} items</span>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {history.map((img) => (
                  <motion.button
                    key={img.id}
                    onClick={() => setCurrentImage(img)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "aspect-square rounded-lg border-2 bg-white overflow-hidden relative group",
                      "transition-all duration-200",
                      currentImage?.id === img.id 
                        ? "border-blue-500 ring-2 ring-blue-200 ring-offset-1" 
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <img 
                      src={img.url} 
                      alt={img.prompt}
                      className="w-full h-full object-cover group-hover:brightness-75 transition-all"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ChevronRight className="text-white w-5 h-5" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.section>
          )}
        </div>

        {/* Settings Sidebar */}
        <motion.aside 
          initial={{ x: showSettings ? 0 : 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={cn(
            "lg:w-80 space-y-4 transition-all duration-300",
            !showSettings && "hidden lg:block"
          )}
        >
          {/* Quality Settings Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              Image Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 block">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"] as AspectRatio[]).map((ratio) => (
                    <motion.button
                      key={ratio}
                      onClick={() => setOptions({ ...options, aspectRatio: ratio })}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "py-2 px-2 rounded-lg text-xs font-semibold transition-all",
                        options.aspectRatio === ratio 
                          ? "bg-blue-500 text-white shadow-md" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {ratio}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 block">
                  Resolution
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["512px", "1K", "2K", "4K"] as ImageSize[]).map((size) => (
                    <motion.button
                      key={size}
                      onClick={() => setOptions({ ...options, imageSize: size })}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-semibold transition-all",
                        options.imageSize === size 
                          ? "bg-blue-500 text-white shadow-md" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {size}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Web Search Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4" />
                  Web Context
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Use current web information when generating images
                </p>
              </div>
              <motion.button 
                onClick={() => setOptions({ ...options, useSearch: !options.useSearch })}
                whileHover={{ scale: 1.05 }}
                className={cn(
                  "relative inline-flex items-center h-6 w-11 rounded-full transition-colors flex-shrink-0",
                  options.useSearch ? "bg-blue-500" : "bg-slate-200"
                )}
              >
                <motion.span
                  animate={{ x: options.useSearch ? 20 : 2 }}
                  className="inline-block h-4 w-4 transform bg-white rounded-full"
                />
              </motion.button>
            </div>
          </motion.div>

          {/* Generate Button */}
          <motion.button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || cooldownSeconds > 0}
            whileHover={{ scale: !isGenerating && prompt.trim() && cooldownSeconds === 0 ? 1.02 : 1 }}
            whileTap={{ scale: !isGenerating && prompt.trim() && cooldownSeconds === 0 ? 0.98 : 1 }}
            className={cn(
              "w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2",
              "transition-all shadow-sm hover:shadow-md",
              isGenerating || !prompt.trim() || cooldownSeconds > 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
            )}
          >
            {cooldownSeconds > 0 ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Wait {cooldownSeconds}s
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isRefining ? "Enhancing..." : "Generating..."}
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Generate
              </>
            )}
          </motion.button>

          {/* Error Alert */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-lg text-xs space-y-2",
                quotaExhausted
                  ? "bg-amber-50 border border-amber-200 text-amber-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              )}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="font-medium">{error}</div>
              </div>
            </motion.div>
          )}

          {/* Info Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-4 text-xs space-y-2"
          >
            <p className="font-semibold text-slate-900">💡 Pro Tips</p>
            <ul className="text-slate-700 space-y-1.5 list-disc list-inside">
              <li>Be specific with details and style</li>
              <li>Enable AI Enhancement for better results</li>
              <li>Try different aspect ratios</li>
              <li>Use Web Context for current events</li>
            </ul>
          </motion.div>
        </motion.aside>
      </main>

      {/* Settings Panel Mobile Overlay */}
      {showSettings && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowSettings(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
        />
      )}
    </div>
  );
}

