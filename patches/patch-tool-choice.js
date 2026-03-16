/**
 * DAX Patch: Force tool_choice=required for action tools in @librechat/agents Graph.cjs
 *
 * Problem: GPT-4o receives tool definitions but writes text instead of calling functions
 * because tool_choice defaults to "auto" in LibreChat's LangGraph agent.
 *
 * Solution: Patch getModelWithTools() in Graph.cjs to pass { tool_choice: 'required' }
 * when at least one action tool (identified by '_action_' in tool name) is present.
 *
 * The patched function:
 *   BEFORE: return model.bindTools(tools);
 *   AFTER:  const hasActionTool = tools.some(t => (t.name||'').includes('_action_'));
 *           return model.bindTools(tools, hasActionTool ? { tool_choice: 'required' } : {});
 *
 * This runs at Docker build time via: node /app/patches/patch-tool-choice.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const graphFile = '/app/node_modules/@librechat/agents/dist/cjs/graphs/Graph.cjs';
const esmFile = '/app/node_modules/@librechat/agents/dist/esm/graphs/Graph.mjs';

function patchFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${filePath} not found`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Patch 1: getModelWithTools - the primary tool binding call
    // Original: return model.bindTools(tools);
    // Context: preceded by "if (!tools || tools.length === 0) { return model; }"
    const before1 = 'return model.bindTools(tools);';
    const after1 = [
        'const hasActionTool = Array.isArray(tools) && tools.some(function(t) {',
        '    return (t && (t.name || (t.function && t.function.name) || \'\')).includes(\'_action_\');',
        '});',
        'return model.bindTools(tools, hasActionTool ? { tool_choice: \'required\' } : {});'
    ].join('\n        ');

    // Patch 2: fallback path - model.bindTools(bindableTools)
    const before2 = 'model.bindTools(bindableTools)';
    const after2 = [
        'model.bindTools(bindableTools, (function() {',
        '    var hasAction = Array.isArray(bindableTools) && bindableTools.some(function(t) {',
        '        return (t && (t.name || (t.function && t.function.name) || \'\')).includes(\'_action_\');',
        '    });',
        '    return hasAction ? { tool_choice: \'required\' } : {};',
        '}()))'
    ].join('\n                        ');

    const count1 = (content.match(/return model\.bindTools\(tools\);/g) || []).length;
    const count2 = (content.match(/model\.bindTools\(bindableTools\)/g) || []).length;

    console.log(`${path.basename(filePath)}: found ${count1} primary bindTools, ${count2} fallback bindTools`);

    if (count1 > 0) {
        content = content.replace(/return model\.bindTools\(tools\);/g, after1);
        console.log(`  Patched ${count1} primary bindTools call(s)`);
    }

    if (count2 > 0) {
        content = content.replace(/model\.bindTools\(bindableTools\)/g, after2);
        console.log(`  Patched ${count2} fallback bindTools call(s)`);
    }

    if (count1 > 0 || count2 > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  Saved: ${filePath}`);

        // Verify
        const verify = fs.readFileSync(filePath, 'utf8');
        const remaining = (verify.match(/model\.bindTools\([^,)]+\);/g) || []).length;
        const patched = (verify.match(/_action_/g) || []).length;
        console.log(`  Verify: ${remaining} unpatched bindTools remaining, ${patched} _action_ references`);
    } else {
        console.log(`  Nothing to patch`);
    }
}

console.log('[DAX] Patching @librechat/agents to force tool_choice=required for action tools...');
patchFile(graphFile);
patchFile(esmFile);
console.log('[DAX] Patch complete.');
