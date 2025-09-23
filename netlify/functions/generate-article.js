// netlify/functions/generate-article.js

// Используем node-fetch для отправки запросов
const fetch = require('node-fetch');

// Функция для транслитерации заголовка в URL-дружелюбный формат (slug)
function slugify(text) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')

  return text.toString().toLowerCase()
    .replace(/\s+/g, '-') // Заменяем пробелы на -
    .replace(p, c => b.charAt(a.indexOf(c))) // Заменяем специальные символы
    .replace(/&/g, '-and-') // Заменяем & на 'and'
    .replace(/[^\w\-]+/g, '') // Удаляем все не-буквенно-цифровые символы
    .replace(/\-\-+/g, '-') // Заменяем несколько - на один
    .replace(/^-+/, '') // Убираем - в начале
    .replace(/-+$/, '') // Убираем - в конце
}

exports.handler = async function(event, context) {
    // Получаем промпт из тела запроса
    const { prompt } = JSON.parse(event.body);

    if (!prompt) {
        return { statusCode: 400, body: 'Prompt is required' };
    }

    // --- ШАГ 1: ГЕНЕРАЦИЯ СТАТЬИ С ПОМОЩЬЮ GEMINI API ---
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiPrompt = `
        Ты — SEO-эксперт и копирайтер. Напиши качественную, структурированную статью для блога на основе следующего запроса: "${prompt}".
        
        Твой ответ ДОЛЖЕН БЫТЬ в формате JSON и содержать три поля: "title", "description" и "content".
        - "title": SEO-оптимизированный заголовок статьи (до 60 символов).
        - "description": Краткое описание для мета-тега (до 160 символов).
        - "content": Основной текст статьи в формате Markdown. Он должен быть хорошо структурирован, с заголовками (h2, h3), списками и параграфами.
    `;
    
    let articleData;
    try {
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: geminiPrompt }] }] })
        });
        const geminiResult = await geminiResponse.json();
        // Извлекаем и парсим JSON из ответа модели
        const jsonString = geminiResult.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        articleData = JSON.parse(jsonString);
    } catch (error) {
        console.error('Error generating article:', error);
        return { statusCode: 500, body: 'Failed to generate article content.' };
    }

    // --- ШАГ 2: СОЗДАНИЕ ФАЙЛА В GITHUB РЕПОЗИТОРИИ ---
    const { title, description, content } = articleData;
    const slug = slugify(title);
    const date = new Date().toISOString();
    
    // Формируем содержимое Markdown файла с frontmatter
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
    
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_REPO_OWNER; // Например, 'BuckyBuck135'
    const repoName = process.env.GITHUB_REPO_NAME;   // Например, 'Intermediate-Astro-Decap-CMS'
    
    const filePath = `src/content/blog/${slug}.md`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

    const commitData = {
        message: `feat(blog): AI-generated article "${title}"`,
        content: Buffer.from(fileContent).toString('base64'), // Кодируем контент в base64
        branch: 'main'
    };

    try {
        await fetch(githubApiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(commitData)
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Article "${title}" created successfully!` })
        };
    } catch (error) {
        console.error('Error creating file in GitHub:', error);
        return { statusCode: 500, body: 'Failed to create article file in repository.' };
    }
};
