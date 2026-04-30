import { getActiveAiConfig, migrateOldAiConfig } from './database';
import { st } from '../i18n';

function extractJson(text) {
    if (!text) return null;

    // 策略1: 尝试提取 ```json 或 ``` 代码块中的内容
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
        const inner = codeBlockMatch[1].trim();
        if (inner.startsWith('{')) {
            try { return JSON.parse(inner); } catch { }
        }
    }

    // 策略2: 尝试从第一个 { 到最后一个 } 提取
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch {
            // 如果直接解析失败，尝试修复常见问题
            const fixed = jsonMatch[0]
                .replace(/,\s*}/g, '}')        // 去掉尾随逗号
                .replace(/,\s*\]/g, ']')       // 去掉数组尾随逗号
                .replace(/'/g, '"')            // 单引号转双引号
                .replace(/(\w+):/g, '"$1":');  // 属性名补引号
            try { return JSON.parse(fixed); } catch { }
        }
    }

    // 策略3: 尝试直接解析整个文本
    try {
        const obj = JSON.parse(text.trim());
        if (obj.summary || obj.tags) return obj;
    } catch { }

    return null;
}

export async function analyzeRepository(repo, readmeContent) {
    await migrateOldAiConfig();
    const config = await getActiveAiConfig();
    if (!config?.apiKey) {
        throw new Error(st('ai.noConfig'));
    }

    const endpoint = (config.endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = config.model || 'gpt-3.5-turbo';

    const repoInfo = [
        `仓库名称：${repo.full_name || ''}`,
        `描述：${repo.description || '无描述'}`,
        `编程语言：${repo.language || '未知'}`,
        readmeContent ? `README 概要：${readmeContent.slice(0, 2000)}` : null,
    ].filter(Boolean).join('\n');

    const userMessage = `请分析这个GitHub仓库并提供：

1. 一个简洁的中文概述（不超过50字），说明这个仓库的主要功能和用途
2. 3-5个相关的应用类型标签（用中文，类似应用商店的分类，如：开发工具、Web应用、移动应用、数据库、AI工具等）
3. 支持的平台类型（从以下选择：mac、windows、linux、ios、android、docker、web、cli）

重要：请严格使用中文进行分析和回复，无论原始README是什么语言。

请严格以JSON格式回复，不要使用markdown代码块，直接输出JSON：
{
  "summary": "你的中文概述",
  "tags": ["标签1", "标签2", "标签3"],
  "platforms": ["platform1", "platform2"]
}

仓库信息：
${repoInfo}

重点关注实用性和准确的分类，帮助用户快速理解仓库的用途和支持的平台。`;

    const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: '你是仓库分析助手，始终输出纯 JSON，不要使用 markdown 代码块。' },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 500,
        }),
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        if (response.status === 401) {
            throw new Error('AI API Key 无效或已过期');
        }
        if (response.status === 404) {
            throw new Error(`模型 "${model}" 不可用，请检查 Endpoint 和模型名称`);
        }
        throw new Error(`AI API 请求失败 (${response.status}): ${errBody.slice(0, 100)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
        throw new Error('AI 返回结果为空，可能是模型名称不正确或 API 配置有误');
    }

    const result = extractJson(content);
    if (!result) {
        throw new Error(`AI 返回格式异常，无法解析。返回内容：${content.slice(0, 200)}`);
    }

    return {
        summary: result.summary || '',
        tags: Array.isArray(result.tags) ? result.tags : [],
        platforms: Array.isArray(result.platforms) ? result.platforms : [],
    };
}

export async function verifyAiConfig(apiKey, endpoint, model) {
    const baseUrl = (endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const modelName = model || 'gpt-3.5-turbo';

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: modelName,
            messages: [
                { role: 'user', content: '回复"连接成功"四个字' },
            ],
            temperature: 0.1,
            max_tokens: 10,
        }),
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        if (response.status === 401) throw new Error(st('ai.keyInvalid'));
        if (response.status === 404) throw new Error(st('ai.modelUnavailable'));
        throw new Error(st('ai.connectionFailed', { code: response.status }));
    }

    return true;
}
