/**
 * DAX Monkey Patch: Force tool_choice: "required" when action tools are present
 *
 * Problem: GPT-4o receives tool definitions but responds with text instead of
 * making function calls because tool_choice defaults to "auto".
 *
 * Strategy: Hook into the HTTP request pipeline. The Azure OpenAI API is called
 * via axios/fetch. We intercept at the LangChain level by patching invocationParams
 * on the ChatOpenAI prototype after all modules are loaded.
 *
 * We use process.nextTick to defer the patch until after all requires complete.
 */
'use strict';

// Defer patching until after all modules have loaded
process.on('beforeExit', () => {}); // keep alive hint

// Use a short timeout to run after module initialization
setTimeout(() => {
    try {
        // Try to find and patch the Azure OpenAI model
        const openaiModule = require('@langchain/openai');
        const ChatClass = openaiModule.AzureChatOpenAI || openaiModule.ChatOpenAI;

        if (!ChatClass) {
            console.error('[DAX patch] Could not find AzureChatOpenAI or ChatOpenAI in @langchain/openai');
            return;
        }

        if (ChatClass.prototype._daxPatched) {
            return; // already patched
        }

        const originalInvocationParams = ChatClass.prototype.invocationParams;
        if (!originalInvocationParams) {
            console.error('[DAX patch] invocationParams not found on prototype');
            return;
        }

        ChatClass.prototype.invocationParams = function(options) {
            const params = originalInvocationParams.call(this, options);

            // Check bound tools (set via bindTools) or options tools
            const boundTools = this.tools || this.kwargs?.tools;
            const optionTools = options?.tools;
            const allTools = boundTools || optionTools;

            if (allTools && Array.isArray(allTools) && allTools.length > 0) {
                const hasActionTool = allTools.some(t => {
                    const name = (t?.function?.name || t?.name || '');
                    return name.includes('_action_');
                });

                if (hasActionTool && params.tool_choice !== 'required') {
                    params.tool_choice = 'required';
                    console.log('[DAX patch] tool_choice=required applied for', allTools.length, 'tools');
                }
            }

            return params;
        };

        ChatClass.prototype._daxPatched = true;
        console.log('[DAX patch] Successfully patched', ChatClass.name, 'invocationParams -> tool_choice=required');

    } catch (e) {
        console.error('[DAX patch] Patch failed:', e.message);
    }
}, 5000); // 5 second delay to ensure all modules loaded

console.log('[DAX patch] force-tool-choice.js loaded, patch scheduled in 5s');
