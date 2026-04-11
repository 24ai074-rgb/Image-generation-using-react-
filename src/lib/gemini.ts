import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. Please configure it in the Secrets panel.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

console.log(`🚀 Lumina AI Studio initialized with model: ${model}`);

// Rate limiting - relaxed for paid tier
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 0.5 seconds for paid tier (higher quota)
let quotaResetTime = 0;
let requestCount = 0;
const DAILY_LIMIT_WARNING = 1000; // Much higher for paid tier

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "1:4" | "1:8" | "4:1" | "8:1";
export type ImageSize = "512px" | "1K" | "2K" | "4K";

export interface GenerationOptions {
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  useSearch?: boolean;
}

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delayNeeded = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  
  lastRequestTime = Date.now();
}

function getRetryDelay(attempt: number, resetTime: number): number {
  const now = Date.now();
  
  // If we have a quota reset time and it hasn't passed, wait until then
  if (resetTime > now) {
    return resetTime - now + 1000;
  }
  
  // Otherwise use exponential backoff: 1s, 2s, 4s, 8s, 16s
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await enforceRateLimit();
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a quota exceeded error
      if (error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429) {
        // Extract reset time from error message if available
        const resetMatch = error?.message?.match(/Please retry in (\d+(?:\.\d+)?)/);
        if (resetMatch) {
          quotaResetTime = Date.now() + Math.ceil(parseFloat(resetMatch[1]) * 1000);
        }
        
        if (attempt < maxAttempts - 1) {
          const delayMs = getRetryDelay(attempt, quotaResetTime);
          console.warn(`Quota exceeded. Retrying in ${(delayMs / 1000).toFixed(1)}s...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
      }
      
      // For other errors, throw immediately
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      
      // Exponential backoff for non-quota errors
      const delayMs = getRetryDelay(attempt, 0);
      console.warn(`Request failed, retrying in ${(delayMs / 1000).toFixed(1)}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

export async function refinePrompt(prompt: string): Promise<string> {
  if (!apiKey) throw new Error("API Key missing");

  try {
    if (requestCount >= DAILY_LIMIT_WARNING) {
      console.warn(`⚠️ Daily request limit approaching. ${requestCount} requests used.`);
    }

    const result = await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash", // Use fast model for text refinement
        contents: [
          {
            role: "user",
            parts: [{ text: `Improve this AI image prompt. Add details about style, lighting, and composition. Keep it under 150 words.\n\nPrompt: "${prompt}"\n\nImproved:` }]
          }
        ],
      });
      
      return response.text?.trim() || prompt;
    });
    
    requestCount++;
    return result;
  } catch (error: any) {
    console.error("Error refining prompt:", error);
    
    if (error?.status === "RESOURCE_EXHAUSTED") {
      throw new Error("API quota exceeded. Retrying later with smart prompt disabled.");
    }
    
    return prompt;
  }
}

export async function generateImage(prompt: string, options: GenerationOptions = {}): Promise<{ imageUrl: string; text?: string }> {
  if (!apiKey) throw new Error("API Key missing");

  const { aspectRatio = "1:1", imageSize = "1K", useSearch = false } = options;

  try {
    if (requestCount >= DAILY_LIMIT_WARNING) {
      console.warn(`⚠️ Daily request limit approaching. ${requestCount} requests used.`);
    }

    const result = await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: model, // Use configured model (gemini-2.5-flash-image by default)
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize
          },
        },
      });

      let imageUrl = "";
      let text = "";

      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        throw new Error("No content generated");
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrl = `data:image/png;base64,${base64EncodeString}`;
        } else if (part.text) {
          text += part.text;
        }
      }

      if (!imageUrl) {
        throw new Error("No image data found in response");
      }

      return { imageUrl, text };
    });
    
    requestCount++;
    return result;
  } catch (error: any) {
    console.error("Error generating image:", error);
    
    if (error?.status === "RESOURCE_EXHAUSTED") {
      throw new Error("API quota exceeded. Please wait and try again later.");
    }
    
    throw error;
  }
}
