/**
 * HTTP Client for N8N-style Tool Node execution
 * Handles variable interpolation, HTTP requests, and response extraction
 */

import { type ToolNodeData } from './types';

// ============================================
// Variable Interpolation (supports nested paths)
// ============================================

/**
 * Get nested value from an object using dot notation
 * Supports array access like "items[0].title"
 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
  if (!path) return obj;
  
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Interpolate variables in a template string
 * Supports nested paths: "Hello {{user.name}}, task: {{task_data.title}}"
 * Supports fallbacks: "{{todo_id || 1}}"
 */
export function interpolateVariables(
  template: string,
  variables: Record<string, any>
): string {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const trimmedKey = key.trim();
    
    // Support {{key || fallback}}
    const parts = trimmedKey.split('||');
    const path = parts[0].trim();
    const fallback = parts.length > 1 ? parts[1].trim() : '';

    const value = getNestedValue(variables, path);

    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

// ============================================
// HTTP Request Execution
// ============================================

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: Array<{ key: string; value: string }>;
  body?: string;
  outputVar: string;
  responsePath?: string;
}

export interface HttpRequestResult {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
  statusText?: string;
}

/**
 * Execute an HTTP request with variable interpolation
 */
export async function executeHttpRequest(
  config: HttpRequestConfig,
  variables: Record<string, any>
): Promise<HttpRequestResult> {
  try {
    // Interpolate URL
    const interpolatedUrl = interpolateVariables(config.url, variables);
    
    if (!interpolatedUrl) {
      return { success: false, error: 'URL is required' };
    }

    // Build headers object with interpolation
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    for (const header of config.headers) {{}
      if (header.key && header.value) {
        headers[interpolateVariables(header.key, variables)] = 
          interpolateVariables(header.value, variables);
      }
    }

    // Build request options
    const requestOptions: RequestInit = {
      method: config.method,
      headers,
    };

    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(config.method) && config.body) {
      requestOptions.body = interpolateVariables(config.body, variables);
    }

    // Execute the request
    const response = await fetch(interpolatedUrl, requestOptions);

    // Parse response
    let data: any;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Check for successful response
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        statusText: response.statusText,
        data,
      };
    }

    // Extract value if responsePath is specified
    if (config.responsePath) {
      const extractedValue = getNestedValue(data, config.responsePath);
      return {
        success: true,
        data: extractedValue,
        status: response.status,
        statusText: response.statusText,
      };
    }

    return {
      success: true,
      data,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown HTTP error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Convenience function to execute a Tool node's HTTP request
 */
export async function executeToolNodeRequest(
  nodeData: Partial<ToolNodeData>,
  variables: Record<string, any>
): Promise<HttpRequestResult> {
  const config: HttpRequestConfig = {
    method: nodeData.method || 'GET',
    url: nodeData.url || '',
    headers: nodeData.headers || [],
    body: nodeData.body,
    outputVar: nodeData.outputVar || 'http_response',
    responsePath: nodeData.responsePath,
  };

  return executeHttpRequest(config, variables);
}
