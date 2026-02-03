
import { GoogleGenAI } from "@google/genai";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";

const getLocal = (key: string) =>
  typeof window !== 'undefined' ? localStorage.getItem(key) || '' : '';
const getLocalModel = () => {
  const value = getLocal('droidforge_ai_model');
  return value === 'auto' ? '' : value;
};

const getConfig = () => {
  const provider = (
    getLocal('droidforge_ai_provider') ||
    process.env.NEXT_PUBLIC_AI_PROVIDER ||
    process.env.AI_PROVIDER ||
    ''
  ).toLowerCase();
  const geminiKey =
    getLocal('droidforge_gemini_key') ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    '';
  const groqKey =
    getLocal('droidforge_groq_key') ||
    process.env.NEXT_PUBLIC_GROQ_API_KEY ||
    process.env.NEXT_GROQ_API_KEY ||
    process.env.GROQ_API_KEY ||
    '';
  const awsAccessKeyId =
    getLocal('droidforge_aws_access_key_id') ||
    process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID ||
    '';
  const awsSecretAccessKey =
    getLocal('droidforge_aws_secret_access_key') ||
    process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY ||
    '';
  const awsSessionToken =
    getLocal('droidforge_aws_session_token') ||
    process.env.NEXT_PUBLIC_AWS_SESSION_TOKEN ||
    '';
  const awsRegion =
    getLocal('droidforge_aws_region') ||
    process.env.NEXT_PUBLIC_AWS_REGION ||
    'us-east-1';
  const groqModel =
    getLocalModel() ||
    process.env.NEXT_PUBLIC_GROQ_MODEL ||
    process.env.NEXT_GROQ_MODEL ||
    process.env.GROQ_MODEL ||
    'llama-3.1-8b-instant';
  const geminiModel =
    getLocalModel() ||
    process.env.NEXT_PUBLIC_GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    'gemini-3-pro-preview';
  const bedrockModel =
    getLocalModel() ||
    process.env.NEXT_PUBLIC_BEDROCK_MODEL ||
    'anthropic.claude-3-haiku-20240307-v1:0';
  const useGroq = provider === 'groq' || (!provider && !!groqKey);
  const useBedrock = provider === 'bedrock';
  return {
    provider,
    geminiKey,
    groqKey,
    awsAccessKeyId,
    awsSecretAccessKey,
    awsSessionToken,
    awsRegion,
    groqModel,
    geminiModel,
    bedrockModel,
    useGroq,
    useBedrock
  };
};

const BASE_SYSTEM_PROMPT = `
You are DroidForge Studio AI. You must output production-quality web React components for a live preview.
The output is rendered inside a sandbox that expects a single default export component named GeneratedScreen.

RESPONSE RULES:
1. Return JSON only: {"explanation":"...","code":"..."}.
2. The "code" field must be raw React web code (no markdown, no backticks).
3. Use React, JSX, HTML elements, and Tailwind className. Do NOT use React Native.
4. Never include analysis, plans, or extra headings inside the code.
5. Avoid external imports. Assume React is in scope. Lucide icons are available via lucide-react names.
6. Output a complete, functional UI with real interactions and state when appropriate.
7. Always include clear primary/secondary actions and sensible defaults.
8. If unsure, make a best-effort build instead of refusing.
`;

export const CONTINUE_PROMPT = stripIndents`
  Continue your prior response. IMPORTANT: Immediately begin from where you left off without any interruptions.
  Do not repeat any content, including artifact and action tags.
`;

};

export const testAIProvider = async () => {
  const systemInstruction = 'Return exactly the word "pong".';
  const userMessage = 'ping';

  const { useBedrock, useGroq, geminiKey, geminiModel } = getConfig();
  if (useBedrock) {
    const content = await bedrockChat(systemInstruction, userMessage, 0);
    return content.trim().toLowerCase().includes('pong');
  }

  if (useGroq) {
    const content = await groqChat(systemInstruction, userMessage, 0);
    return content.trim().toLowerCase().includes('pong');
  }

  if (!geminiKey) {
    throw new Error('Missing Gemini API key');
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: userMessage,
    config: {
      systemInstruction,
      responseMimeType: "text/plain",
      temperature: 0,
    },
  });

  return (response.text || '').trim().toLowerCase().includes('pong');
};
