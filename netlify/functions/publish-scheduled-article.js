const fetch = require('node-fetch');

// --- Вспомогательные функции (копируем из generate-article.js) ---
function generateRandomString(length) {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function slugify(text) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')
  return text.toString().toLowerCase().replace(/\s+/g, '-').replace(p, c => b.charAt(a.indexOf(c))).replace(/&/g, '-and-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

// --- Основные переменные окружения ---
const { GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GEMINI_API_KEY } = process.env;
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

// --- Логика работы с API ---

// 1. Получение контент-плана из GitHub
async function getContentPlan() {
    const url = `${GITHUB_API_BASE}/contents/src/data/content-plan.json`;
    const response = await fetch(url, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    if (!response.ok) throw new Error('Could not fetch content plan');
    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return { plan: JSON.parse(content), sha: data.sha };
}

// 2. Генерация статьи через Gemini
async function generateArticleFromPrompt(prompt) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`;
    const geminiPrompt = `You are an expert SEO copywriter. Write a high-quality, structured blog article based on the following request: "${prompt}". Your response MUST be a single JSON object with "title", "description", and "content" fields.`;
    
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: geminiPrompt }] }] })
    });
    const result = await response.json();
    if (!result.candidates || result.candidates.length === 0) {
        throw new Error('Gemini did not return content.');
    }
    const jsonString = result.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonString);
}

// 3. Публикация статьи в репозитории
async function publishArticle(articleData) {
    const { title, description, content } = articleData;
    const slug = `${slugify(title)}-${generateRandomString(4)}`;
    const date = new Date().toISOString();
    const fileContent = `---
title: "${title}"
description: "${description}"
author: "AI-Генератор"
date: ${date}
image: src/assets/images/blog/blog-cover.jpg
imageAlt: "Изображение для статьи"
isFeatured: false
contentType: "cluster"
---

${content}
`;
    const filePath = `src/content/blog/${slug}.md`;
    const url = `${GITHUB_API_BASE}/contents/${filePath}`;
    const commitData = {
        message: `feat(blog): Scheduled AI article "${title}"`,
        content: Buffer.from(fileContent).toString('base64'),
        branch: 'main'
    };
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commitData)
    });
    if (!response.ok) throw new Error('Failed to publish article to GitHub');
    console.log(`Successfully published: ${title}`);
}

// 4. Обновление статуса задачи в контент-плане
async function updateContentPlan(updatedPlan, sha) {
    const url = `${GITHUB_API_BASE}/contents/src/data/content-plan.json`;
    const updatedContent = JSON.stringify(updatedPlan, null, 2);
    const commitData = {
        message: 'chore: Update content plan status',
        content: Buffer.from(updatedContent).toString('base64'),
        sha: sha,
        branch: 'main'
    };
     const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commitData)
    });
    if (!response.ok) throw new Error('Failed to update content plan');
    console.log('Content plan updated successfully.');
}

// --- Основная функция, которая будет запускаться по расписанию ---
exports.handler = async function(event, context) {
    console.log("Starting scheduled article publication...");
    try {
        const { plan, sha } = await getContentPlan();
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Устанавливаем время на начало дня для корректного сравнения

        let planUpdated = false;
        const tasksToPublish = plan.filter(task => 
            task.status === 'scheduled' && new Date(task.publishDate) <= today
        );

        if (tasksToPublish.length === 0) {
            console.log("No articles scheduled for publication today.");
            return { statusCode: 200, body: 'No articles to publish.' };
        }

        for (const task of tasksToPublish) {
            console.log(`Processing task: ${task.prompt}`);
            try {
                const articleData = await generateArticleFromPrompt(task.prompt);
                await publishArticle(articleData);
                // Обновляем статус задачи в нашем локальном объекте
                const taskInPlan = plan.find(p => p.prompt === task.prompt && p.publishDate === task.publishDate);
                if (taskInPlan) {
                    taskInPlan.status = 'published';
                    planUpdated = true;
                }
            } catch (publishError) {
                console.error(`Failed to process task "${task.prompt}":`, publishError);
                // Можно добавить логику для пометки задачи как 'failed'
            }
        }
        
        // Если хотя бы одна задача была выполнена, обновляем файл на GitHub
        if (planUpdated) {
            await updateContentPlan(plan, sha);
        }
        
        console.log("Scheduled publication run finished.");
        return { statusCode: 200, body: 'Scheduled publication finished.' };

    } catch (error) {
        console.error("Critical error in scheduler:", error);
        return { statusCode: 500, body: `Error: ${error.message}` };
    }
};
