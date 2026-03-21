import { type ExecutionContext, type AdvanceResult } from './types';

/**
 * Transforms engine execution state into a human-readable trace snapshot.
 * This separates tracing format logic from the core workflow runner.
 */
export function buildTracePayload(
    nodeId: string,
    action: AdvanceResult['action'],
    context: ExecutionContext
) {
    const outputData: Record<string, unknown> = {};
    const logs: string[] = [];

    if (action.type === 'speak') {
        outputData.text = action.text;
        logs.push(`Spoke: "${(action.text || '').substring(0, 100)}..."`);
    } else if (action.type === 'wait_for_input') {
        outputData.inputMode = action.inputMode;
        if (action.sttProvider) outputData.sttProvider = action.sttProvider;
        logs.push(`Waiting for ${action.inputMode || 'text'} input`);
    } else if (action.type === 'wait_for_webhook') {
        outputData.slug = action.slug;
        logs.push(`Waiting for webhook: ${action.slug}`);
    } else if (action.type === 'error') {
        outputData.error = action.message;
        logs.push(`Error: ${action.message}`);
    } else if (action.type === 'completed') {
        logs.push('Workflow completed');
    } else {
        logs.push('Processed successfully');
        // If it's a Tool node or LLM Reply, the latest variable changes are caught 
        // in the context.variables snapshot that is saved alongside this trace.
    }

    return {
        nodeId,
        inputVariables: context.variables || {}, // We use the current variables as the snapshot
        outputData,
        logs,
    };
}
