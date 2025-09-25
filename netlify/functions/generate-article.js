// netlify/functions/generate-article.js

const fetch = require('node-fetch');

function slugify(text) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')

  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(p, c => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

exports.handler = async function(event, context) {
    const { prompt } = JSON.parse(event.body);
    if (!prompt) return { statusCode: 400, body: 'Prompt is required' };

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiPrompt = `
        You are an expert SEO copywriter. Write a high-quality, structured blog article based on the following request: "${prompt}".
        
        Your response MUST be a single JSON object with three fields: "title", "description", and "content".
        - "title": An SEO-optimized title for the article (under 60 characters).
        - "description": A brief meta description (under 160 characters).
        - "content": The main body of the article in Markdown format. It must be well-structured with headings (h2, h3), lists, and paragraphs.
    `;
    
    let articleData;
    try {
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: geminiPrompt }] }] })
        });
        
        const geminiResult = await geminiResponse.json();

        // --- УЛУЧШЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ ---
        console.log('Gemini API Response:', JSON.stringify(geminiResult, null, 2));

        // --- УЛУЧШЕННАЯ ПРОВЕРКА ОШИБОК ---
        if (!geminiResponse.ok || !geminiResult.candidates || geminiResult.candidates.length === 0) {
            // Если есть сообщение об ошибке от API, выводим его
            const errorMessage = geminiResult.error ? geminiResult.error.message : 'No content generated.';
            throw new Error(`Gemini API Error: ${errorMessage}`);
        }

        const jsonString = geminiResult.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        articleData = JSON.parse(jsonString);

    } catch (error) {
        console.error('Error generating article:', error);
        return { statusCode: 500, body: `Failed to generate article content. Details: ${error.message}` };
    }

    // --- ШАГ 2: СОЗДАНИЕ ФАЙЛА В GITHUB (остается без изменений) ---
    const { title, description, content } = articleData;
    const slug = slugify(title);
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
    
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;
    
    const filePath = `src/content/blog/${slug}.md`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

    const commitData = {
        message: `feat(blog): AI-generated article "${title}"`,
        content: Buffer.from(fileContent).toString('base64'),
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
