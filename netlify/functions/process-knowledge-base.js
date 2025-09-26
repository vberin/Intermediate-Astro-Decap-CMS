// netlify/functions/process-knowledge-base.js

// Мы используем `require` для доступа к файлу из нашего репозитория
const knowledgeBase = require('../../src/data/knowledge-base.json');

// Эта функция преобразует наш JSON в понятный для AI текстовый формат
function formatKnowledgeBase() {
    let context = "Это информация о компании, которую ты представляешь:\n\n";

    // Основная информация
    const { companyInfo, services, targetAudience, usp, externalLinks, faq } = knowledgeBase;
    if (companyInfo) {
        context += `**О компании:**\n`;
        context += `Название: ${companyInfo.companyName || 'Не указано'}\n`;
        context += `Слоган: ${companyInfo.tagline || 'Не указан'}\n`;
        context += `Описание: ${companyInfo.aboutUs || 'Не указано'}\n\n`;
    }

    // Услуги
    if (services && services.length > 0) {
        context += `**Услуги и продукты:**\n`;
        services.forEach(service => {
            context += `- Название: ${service.serviceName}\n`;
            context += `  Описание: ${service.serviceDescription}\n`;
            context += `  Цена: ${service.servicePrice}\n\n`;
        });
    }

    // Целевая аудитория
    if (targetAudience) {
        context += `**Наша целевая аудитория:**\n${targetAudience}\n\n`;
    }

    // УТП
    if (usp) {
        context += `**Наши преимущества (УТП):**\n${usp}\n\n`;
    }

    // Ссылки
    if (externalLinks) {
        if (externalLinks.socialLinks && externalLinks.socialLinks.length > 0) {
            context += `**Наши социальные сети:**\n`;
            externalLinks.socialLinks.forEach(link => {
                context += `- ${link.platform}: ${link.url}\n`;
            });
            context += `\n`;
        }
        if (externalLinks.reviewLinks && externalLinks.reviewLinks.length > 0) {
            context += `**Где почитать отзывы о нас:**\n`;
            externalLinks.reviewLinks.forEach(link => {
                context += `- ${link.platform}: ${link.url}\n`;
            });
            context += `\n`;
        }
    }

    // FAQ
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
    try {
        const formattedText = formatKnowledgeBase();
        return {
            statusCode: 200,
            body: JSON.stringify({ context: formattedText })
        };
    } catch (error) {
        console.error("Error processing knowledge base:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to process knowledge base" })
        };
    }
};
