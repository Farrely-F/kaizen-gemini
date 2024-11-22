import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "@octokit/rest";
import { context } from "@actions/github";
import * as core from "@actions/core";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getChangedFiles() {
  const { owner, repo } = context.repo;
  const pull_number = context.payload.pull_request.number;

  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number,
  });

  return files;
}

async function reviewCode(content, filename) {
  const model = genAI.getGenerativeModel({
    model: "models/gemini-1.5-pro-002",
    temperature: 0.8,
  });

  const prompt = `As a friendly and helpful code reviewer named "GeminiAI Review Buddy 🤖", analyze this ${filename} and provide an engaging review. Use emojis and a conversational tone while maintaining professionalism.

Please structure your review with these sections:

1. 🎯 Overview
   - Quick summary of what you see
   - First impressions

2. ✨ What's Great
   - Highlight the positive aspects
   - Good practices found

3. 🐛 Potential Issues
   - Bugs or concerns
   - Security considerations

4. 🚀 Suggestions
   - Performance improvements
   - Code style enhancements
   - Best practices

Code to review:
\`\`\`
${content}
\`\`\`

Keep the tone friendly and encouraging, using emojis naturally throughout the review.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function postReview(reviews) {
  const { owner, repo } = context.repo;
  const pull_number = context.payload.pull_request.number;

  const header = `# 👋 Hello from GeminiAI Review Buddy!\n\nI've taken a look at your changes and here's what I found:\n\n`;
  const footer = `\n\n---\n\n💡 _I'm your friendly AI code reviewer powered by Google Gemini. Feel free to discuss or ask questions about my suggestions!_`;

  const reviewBody = header + reviews.join("\n\n---\n\n") + footer;

  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    body: reviewBody,
    event: "COMMENT",
  });
}

async function main() {
  try {
    const changedFiles = await getChangedFiles();
    const reviews = [];

    for (const file of changedFiles) {
      if (file.status !== "removed") {
        const content = file.patch || "";
        if (content) {
          core.info(`Reviewing ${file.filename}...`);
          const review = await reviewCode(content, file.filename);
          reviews.push(`## 📝 Review for \`${file.filename}\`\n\n${review}`);
        }
      }
    }

    if (reviews.length > 0) {
      await postReview(reviews);
      core.info("Code review completed successfully");
    } else {
      core.info("No files to review");
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

main();
