import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { type LLMConfig } from '../types';
import { prisma } from '@/lib/prisma';
import { LLMProvider as PrismaProvider } from '@/generated/prisma/client';

// ============================================
// Helper: Get API Key from Config, DB, or Env
// ============================================

async function getApiKey(providerName: string, config: LLMConfig): Promise<string> {
  // 1. Check explicit config
  if (config.apiKey) return config.apiKey;

  // 2. Check DB if userId is present
  if (config.userId) {
    try {
      const cred = await prisma.lLMCredential.findUnique({
        where: {
          userId_provider: {
            userId: config.userId,
            provider: providerName, // Now matching string directly.
          },
        },
      });
      if (cred?.apiKey) return cred.apiKey;
    } catch (e) {
      console.warn(`Failed to fetch credentials for ${providerName}:`, e);
      // Continue to env var check
    }
  }

  // 3. Check Environment Variable
  const envVar = `${providerName.toUpperCase()}_API_KEY`;
  const key = process.env[envVar];
  if (key) return key;

  throw new Error(
    `${providerName} API key is required. Set ${envVar} env var, configure in settings, or provide apiKey.`
  );
}

// ============================================
// LLM Provider Interface
// ============================================

export interface LLMProvider {
  generateResponse(params: {
    systemPrompt: string;
    userPrompt: string;
    config: LLMConfig;
  }): Promise<string>;

  generateDecision(params: {
    systemPrompt: string;
    userPrompt: string;
    outcomes: string[];
    config: LLMConfig;
  }): Promise<string>;
}

// ============================================
// OpenAI Provider
// ============================================

export class OpenAIProvider implements LLMProvider {
  private async getClient(config: LLMConfig): Promise<OpenAI> {
    const key = await getApiKey('openai', config);
    return new OpenAI({ apiKey: key });
  }

  private parseError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('429') || message.includes('rate_limit')) {
      return 'OpenAI rate limit exceeded. Please try again in a moment.';
    }
    if (message.includes('401') || message.includes('invalid_api_key') || message.includes('Incorrect API key')) {
      return 'Invalid OpenAI API key. Please check your API key and try again.';
    }
    if (message.includes('insufficient_quota')) {
      return 'OpenAI quota exceeded. Please check your billing details.';
    }
    if (message.includes('model_not_found')) {
      return 'Model not found. Please select a different OpenAI model.';
    }
    
    return `OpenAI error: ${message.slice(0, 200)}`;
  }

  async generateResponse(params: {
    systemPrompt: string;
    userPrompt: string;
    config: LLMConfig;
  }): Promise<string> {
    try {
      const client = await this.getClient(params.config);
      
      const response = await client.chat.completions.create({
        model: params.config.model || 'gpt-4o-mini',
        temperature: params.config.temperature ?? 0.7,
        max_tokens: params.config.maxTokens ?? 1000,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  async generateDecision(params: {
    systemPrompt: string;
    userPrompt: string;
    outcomes: string[];
    config: LLMConfig;
  }): Promise<string> {
    try {
      const client = await this.getClient(params.config);
      
      const decisionPrompt = `${params.systemPrompt}

You must respond with ONLY one of these exact values: ${params.outcomes.join(', ')}
Do not include any other text, explanation, or punctuation. Just respond with the single word.

User message: ${params.userPrompt}`;

      const response = await client.chat.completions.create({
        model: params.config.model || 'gpt-4o-mini',
        temperature: 0.1, // Low temperature for consistent decisions
        max_tokens: 50,
        messages: [
          { role: 'user', content: decisionPrompt },
        ],
      });

      const rawResult = response.choices[0]?.message?.content?.trim() || '';
      
      // Clean the response - remove punctuation, extra text, get first word
      const cleanedResult = rawResult
        .replace(/[.,!?;:'"]/g, '') // Remove punctuation
        .split(/\s+/)[0] // Get first word only
        .trim();
      
      console.log(`[LLM Decision] Raw response: "${rawResult}", Cleaned: "${cleanedResult}", Outcomes: [${params.outcomes.join(', ')}]`);
      
      // Try exact match first (case-insensitive)
      const exactMatch = params.outcomes.find(
        (o) => o.toLowerCase() === cleanedResult.toLowerCase()
      );
      
      if (exactMatch) {
        console.log(`[LLM Decision] Exact match found: "${exactMatch}"`);
        return exactMatch;
      }
      
      // Try partial match (outcome starts with or contains the response)
      const partialMatch = params.outcomes.find(
        (o) => o.toLowerCase().startsWith(cleanedResult.toLowerCase()) ||
               cleanedResult.toLowerCase().startsWith(o.toLowerCase())
      );
      
      if (partialMatch) {
        console.log(`[LLM Decision] Partial match found: "${partialMatch}"`);
        return partialMatch;
      }
      
      // No match - return first outcome as fallback
      console.warn(`[LLM Decision] No match found for "${cleanedResult}", defaulting to first outcome: "${params.outcomes[0]}"`);
      return params.outcomes[0] || 'default';
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }
}

// ============================================
// Anthropic Provider
// ============================================

export class AnthropicProvider implements LLMProvider {
  private async getClient(config: LLMConfig): Promise<Anthropic> {
    const key = await getApiKey('anthropic', config);
    return new Anthropic({ apiKey: key });
  }

  private parseError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('429') || message.includes('rate_limit')) {
      return 'Anthropic rate limit exceeded. Please try again in a moment.';
    }
    if (message.includes('401') || message.includes('invalid_api_key') || message.includes('authentication')) {
      return 'Invalid Anthropic API key. Please check your API key and try again.';
    }
    if (message.includes('overloaded')) {
      return 'Anthropic servers are overloaded. Please try again later.';
    }
    if (message.includes('model')) {
      return 'Model not available. Please select a different Claude model.';
    }
    
    return `Anthropic error: ${message.slice(0, 200)}`;
  }

  async generateResponse(params: {
    systemPrompt: string;
    userPrompt: string;
    config: LLMConfig;
  }): Promise<string> {
    try {
      const client = await this.getClient(params.config);
      
      const response = await client.messages.create({
        model: params.config.model || 'claude-3-haiku-20240307',
        max_tokens: params.config.maxTokens ?? 1000,
        system: params.systemPrompt,
        messages: [
          { role: 'user', content: params.userPrompt },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : '';
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  async generateDecision(params: {
    systemPrompt: string;
    userPrompt: string;
    outcomes: string[];
    config: LLMConfig;
  }): Promise<string> {
    try {
      const client = await this.getClient(params.config);
      
      const decisionPrompt = `${params.systemPrompt}

You must respond with ONLY one of these exact values: ${params.outcomes.join(', ')}
Do not include any other text, explanation, or punctuation. Just respond with the single word.

User message: ${params.userPrompt}`;

      const response = await client.messages.create({
        model: params.config.model || 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [
          { role: 'user', content: decisionPrompt },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      const rawResult = textBlock?.type === 'text' ? textBlock.text.trim() : '';
      
      // Clean the response - remove punctuation, extra text, get first word
      const cleanedResult = rawResult
        .replace(/[.,!?;:'"]/g, '')
        .split(/\s+/)[0]
        .trim();
      
      console.log(`[LLM Decision] Raw response: "${rawResult}", Cleaned: "${cleanedResult}", Outcomes: [${params.outcomes.join(', ')}]`);
      
      // Try exact match first (case-insensitive)
      const exactMatch = params.outcomes.find(
        (o) => o.toLowerCase() === cleanedResult.toLowerCase()
      );
      
      if (exactMatch) return exactMatch;
      
      // Try partial match
      const partialMatch = params.outcomes.find(
        (o) => o.toLowerCase().startsWith(cleanedResult.toLowerCase()) ||
               cleanedResult.toLowerCase().startsWith(o.toLowerCase())
      );
      
      if (partialMatch) return partialMatch;
      
      console.warn(`[LLM Decision] No match found for "${cleanedResult}", defaulting to first outcome`);
      return params.outcomes[0] || 'default';
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }
}

// ============================================
// Google Gemini Provider
// ============================================

export class GoogleProvider implements LLMProvider {
  private async getClient(config: LLMConfig) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const key = await getApiKey('google', config);
    return new GoogleGenerativeAI(key);
  }

  private parseError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    
    // Rate limit error
    if (message.includes('429') || message.includes('quota') || message.includes('Too Many Requests')) {
      return 'Google API rate limit exceeded. Please try again in a few seconds or upgrade your API plan.';
    }
    
    // Auth error
    if (message.includes('401') || message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED')) {
      return 'Invalid Google API key. Please check your API key and try again.';
    }
    
    // Model not found
    if (message.includes('404') || message.includes('model not found')) {
      return 'Model not found. Please select a different Gemini model.';
    }
    
    // Safety filter
    if (message.includes('SAFETY') || message.includes('blocked')) {
      return 'Response was blocked by safety filters. Please try a different prompt.';
    }
    
    return `Google API error: ${message.slice(0, 200)}`;
  }

  private async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[GoogleAI] Error detected: ${message}`);
      
      // Only retry on rate limits (429) or temporary server errors (503)
      if (retries > 0 && (message.includes('429') || message.includes('quota') || message.includes('Too Many Requests') || message.includes('503'))) {
        console.log(`[GoogleAI] Retrying... (${retries} attempts left) in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(operation, retries - 1, delay * 2);
      }
      
      console.error(`[GoogleAI] Final Failure: ${message}`);
      throw error;
    }
  }

  async generateResponse(params: {
    systemPrompt: string;
    userPrompt: string;
    config: LLMConfig;
  }): Promise<string> {
    try {
      return await this.withRetry(async () => {
        const genAI = await this.getClient(params.config);
        const model = genAI.getGenerativeModel({ 
          model: params.config.model || 'gemini-1.5-flash',
          systemInstruction: params.systemPrompt,
        });
        
        const result = await model.generateContent(params.userPrompt);
        return result.response.text();
      });
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  async generateDecision(params: {
    systemPrompt: string;
    userPrompt: string;
    outcomes: string[];
    config: LLMConfig;
  }): Promise<string> {
    try {
      return await this.withRetry(async () => {
        const genAI = await this.getClient(params.config);
        const model = genAI.getGenerativeModel({ 
          model: params.config.model || 'gemini-1.5-flash',
        });
        
        const decisionPrompt = `${params.systemPrompt}

You must respond with ONLY one of these exact values: ${params.outcomes.join(', ')}
Do not include any other text, explanation, or punctuation. Just respond with the single word.

User message: ${params.userPrompt}`;

        const result = await model.generateContent(decisionPrompt);
        const rawResult = result.response.text().trim();
        
        // Clean the response
        const cleanedResult = rawResult
          .replace(/[.,!?;:'"]/g, '')
          .split(/\s+/)[0]
          .trim();
        
        console.log(`[LLM Decision] Raw response: "${rawResult}", Cleaned: "${cleanedResult}", Outcomes: [${params.outcomes.join(', ')}]`);
        
        // Try exact match
        const exactMatch = params.outcomes.find(
          (o) => o.toLowerCase() === cleanedResult.toLowerCase()
        );
        if (exactMatch) return exactMatch;
        
        // Try partial match
        const partialMatch = params.outcomes.find(
          (o) => o.toLowerCase().startsWith(cleanedResult.toLowerCase()) ||
                 cleanedResult.toLowerCase().startsWith(o.toLowerCase())
        );
        if (partialMatch) return partialMatch;
        
        console.warn(`[LLM Decision] No match found for "${cleanedResult}", defaulting to first outcome`);
        return params.outcomes[0] || 'default';
      });
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }
}

// ============================================
// Mistral Provider
// ============================================

export class MistralProvider implements LLMProvider {
  private async getClient(config: LLMConfig): Promise<string> {
    return getApiKey('mistral', config);
  }

  private parseError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('401')) return 'Invalid Mistral API key.';
    if (message.includes('429')) return 'Mistral rate limit exceeded.';
    return `Mistral error: ${message.slice(0, 200)}`;
  }

  async generateResponse(params: {
    systemPrompt: string;
    userPrompt: string;
    config: LLMConfig;
  }): Promise<string> {
    try {
      const apiKey = await this.getClient(params.config);
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: params.config.model || 'mistral-medium-latest',
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
          temperature: params.config.temperature ?? 0.7,
          max_tokens: params.config.maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mistral API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  async generateDecision(params: {
    systemPrompt: string;
    userPrompt: string;
    outcomes: string[];
    config: LLMConfig;
  }): Promise<string> {
    try {
      const apiKey = await this.getClient(params.config);
      
      const decisionPrompt = `${params.systemPrompt}

You must respond with ONLY one of these exact values: ${params.outcomes.join(', ')}
Do not include any other text, explanation, or punctuation. Just respond with the single word.

User message: ${params.userPrompt}`;

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: params.config.model || 'mistral-medium-latest',
          messages: [
            { role: 'user', content: decisionPrompt },
          ],
          temperature: 0.1,
          max_tokens: 50,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mistral API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const rawResult = data.choices?.[0]?.message?.content?.trim() || '';

      // Clean the response
      const cleanedResult = rawResult
        .replace(/[.,!?;:'"]/g, '')
        .split(/\s+/)[0]
        .trim();
      
      console.log(`[LLM Decision] Raw response: "${rawResult}", Cleaned: "${cleanedResult}", Outcomes: [${params.outcomes.join(', ')}]`);
      
      // Try exact match
      const exactMatch = params.outcomes.find(
        (o) => o.toLowerCase() === cleanedResult.toLowerCase()
      );
      if (exactMatch) return exactMatch;
      
      // Try partial match
      const partialMatch = params.outcomes.find(
        (o) => o.toLowerCase().startsWith(cleanedResult.toLowerCase()) ||
               cleanedResult.toLowerCase().startsWith(o.toLowerCase())
      );
      if (partialMatch) return partialMatch;
      
      console.warn(`[LLM Decision] No match found for "${cleanedResult}", defaulting to first outcome`);
      return params.outcomes[0] || 'default';
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }
}

// ============================================
// Provider Factory
// ============================================

const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  google: new GoogleProvider(),
  mistral: new MistralProvider(),
};

export function getLLMProvider(providerName: string = 'openai'): LLMProvider {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${providerName}. Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

// ============================================
// Convenience function for calling LLM
// ============================================

export async function callLLM(params: {
  systemPrompt: string;
  userPrompt: string;
  config?: Partial<LLMConfig>;
}): Promise<string> {
  const config: LLMConfig = {
    provider: params.config?.provider || 'openai',
    model: params.config?.model || 'gpt-4o-mini',
    temperature: params.config?.temperature ?? 0.7,
    maxTokens: params.config?.maxTokens ?? 1000,
    apiKey: params.config?.apiKey,
    userId: params.config?.userId,
  };
  
  const provider = getLLMProvider(config.provider);
  return provider.generateResponse({
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    config,
  });
}

export async function callLLMDecision(params: {
  systemPrompt: string;
  userPrompt: string;
  outcomes: string[];
  config?: Partial<LLMConfig>;
}): Promise<string> {
  const config: LLMConfig = {
    provider: params.config?.provider || 'openai',
    model: params.config?.model || 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 50,
    apiKey: params.config?.apiKey,
    userId: params.config?.userId,
  };
  
  const provider = getLLMProvider(config.provider);
  return provider.generateDecision({
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    outcomes: params.outcomes,
    config,
  });
}
