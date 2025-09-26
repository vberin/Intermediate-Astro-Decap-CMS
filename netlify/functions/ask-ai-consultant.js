// netlify/functions/ask-ai-consultant.js

const fetch = require('node-fetch');
// Мы импортируем логику из соседней функции. Это не сработает напрямую на Netlify,
// поэтому мы скопируем саму функцию `formatKnowledgeBase` сюда.

const knowledgeBase = require('../../src/data/knowledge-base.json');

// Копируем функцию из `process-knowledge-base.js`
function formatKnowledgeBase() {
    let context = "Это информация о компании, которую ты представляешь:\n\n";
    const { companyInfo, services, targetAudience, usp, externalLinks, faq } = knowledgeBase;
    if (companyInfo) {
        context += `**О компании:**\n`;
        context += `Название: ${companyInfo.companyName || 'Не указано'}\n`;
        context += `Слоган: ${companyInfo.tagline || 'Не указан'}\n`;
        context += `Описание: ${companyInfo.aboutUs || 'Не указано'}\n\n`;
    }
    if (services && services.length > 0) {
        context += `**Услуги и продукты:**\n`;
        services.forEach(service => {
            context += `- Название: ${service.serviceName}\n`;
            context += `  Описание: ${service.serviceDescription}\n`;
            context += `  Цена: ${service.servicePrice}\n\n`;
        });
    }
    if (targetAudience) {
        context += `**Наша целевая аудитория:**\n${targetAudience}\n\n`;
    }
    if (usp) {
        context += `**Наши преимущества (УТП):**\n${usp}\n\n`;
    }
    if (externalLinks) {
        if (externalLinks.socialLinks && externalLinks.socialLinks.length > 0) {
            context += `**Наши социальные сети:**\n`;
            externalLinks.socialLinks.forEach(link => { context += `- ${link.platform}: ${link.url}\n`; });
            context += `\n`;
        }
        if (externalLinks.reviewLinks && externalLinks.reviewLinks.length > 0) {
            context += `**Где почитать отзывы о нас:**\n`;
            externalLinks.reviewLinks.forEach(link => { context += `- ${link.platform}: ${link.url}\n`; });
            context += `\n`;
        }
    }
    if (faq && faq.length > 0) {
        context += `**Часто задаваемые вопросы и ответы на них:**\n`;
        faq.forEach(item => {
            context += `- Вопрос: ${item.question}\n`;
            context += `  Ответ: ${item.answer}\n\n`;
        });
    }
    return context;
}


exports.handler = async function(event, context) {
    const { question } = JSON.parse(event.body);
    if (!question) {
        return { statusCode: 400, body: 'Question is required' };
    }

    // 1. Получаем всю информацию о компании
    const companyContext = formatKnowledgeBase();

    // 2. Формируем промпт для Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;

    const systemPrompt = `Ты — дружелюбный и профессиональный AI-консультант компании "${knowledgeBase.companyInfo.companyName}".
Твоя задача — отвечать на вопросы посетителей сайта.
Используй ТОЛЬКО информацию, предоставленную ниже. Не придумывай ничего от себя.
Если ты не знаешь ответа на вопрос, вежливо скажи, что не владеешь этой информацией и предложи связаться с менеджером.
Отвечай кратко и по делу на языке, на котором задан вопрос.

--- НАЧАЛО ИНФОРМАЦИИ О КОМПАНИИ ---
${companyContext}
--- КОНЕЦ ИНФОРМАЦИИ О КОМПАНИИ ---
`;

    try {
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: question }]
                }],
                systemInstruction: {
                    role: "model",
                    parts: [{ text: systemPrompt }]
                }
            })
        });
        
        const geminiResult = await geminiResponse.json();
        
        if (!geminiResponse.ok || !geminiResult.candidates || geminiResult.candidates.length === 0) {
            const errorMessage = geminiResult.error ? geminiResult.error.message : 'AI model did not return a response.';
            throw new Error(errorMessage);
        }

        const answer = geminiResult.candidates[0].content.parts[0].text;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ answer: answer })
        };

    } catch (error) {
        console.error("Error with Gemini API:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Failed to get answer from AI. Details: ${error.message}` })
        };
    }
};
