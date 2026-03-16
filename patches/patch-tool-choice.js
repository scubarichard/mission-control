/**
 * DAX Patch: Force tool_choice=required for action tools in @librechat/agents Graph.cjs
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

    // Patch: getModelWithTools - replace model.bindTools(tools) with action-aware version
    const before1 = 'return model.bindTools(tools);';
    const after1 = [
        'const hasActionTool = Array.isArray(tools) && tools.some(function(t) {',
        '    var name = (t && (t.name || (t.function && t.function.name) || \'\'));',
        '    return name.includes(\'_action_\');',
        '});',
        'if (hasActionTool) { console.log(\'[DAX] tool_choice=required for\', tools.length, \'tools\'); }',
        'return model.bindTools(tools, hasActionTool ? { tool_choice: \'required\' } : {});'
    ].join('\n        ');

    // Patch: fallback bindTools(bindableTools)
    const before2 = 'model.bindTools(bindableTools)';
    const after2 = [
        'model.bindTools(bindableTools, (function() {',
        '    var hasAction = Array.isArray(bindableTools) && bindableTools.some(function(t) {',
        '        var name = (t && (t.name || (t.function && t.function.name) || \'\'));',
        '        return name.includes(\'_action_\');',
        '    });',
        '    if (hasAction) { console.log(\'[DAX] fallback tool_choice=required for\', bindableTools.length, \'tools\'); }',
        '    return hasAction ? { tool_choice: \'required\' } : {};',
        '}()))'
    ].join('\n                        ');

    const count1 = (content.match(/return model\.bindTools\(tools\);/g) || []).length;
    const count2 = (content.match(/model\.bindTools\(bindableTools\)/g) || []).length;

    console.log(`${path.basename(filePath)}: found ${count1} primary, ${count2} fallback bindTools`);

    if (count1 > 0) {
        content = content.replace(/return model\.bindTools\(tools\);/g, after1);
        console.log(`  Patched ${count1} primary bindTools`);
    }

    if (count2 > 0) {
        content = content.replace(/model\.bindTools\(bindableTools\)/g, after2);
        console.log(`  Patched ${count2} fallback bindTools`);
    }

    if (count1 > 0 || count2 > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  Saved: ${filePath}`);
        const verify = fs.readFileSync(filePath, 'utf8');
        console.log(`  Verify _action_ refs: ${(verify.match(/_action_/g)||[]).length}`);
        console.log(`  Verify tool_choice refs: ${(verify.match(/tool_choice/g)||[]).length}`);
    }
}

console.log('[DAX] Patching Graph.cjs for tool_choice=required...');
patchFile(graphFile);
patchFile(esmFile);
console.log('[DAX] Patch complete.');
