import { GoogleGenerativeAI } from '@google/generative-ai';
import { Octokit } from '@octokit/rest';
import { context } from '@actions/github';
import * as core from '@actions/core';

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
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `As an expert code reviewer, please analyze this ${filename} and provide a concise but thorough review focusing on:
1. Critical bugs or issues
2. Code style and best practices
3. Performance impacts
4. Security vulnerabilities
5. Key improvement suggestions

Code to review:
\`\`\`
${content}
\`\`\`

Format your response in markdown with clear headings and bullet points.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function postReview(reviews) {
  const { owner, repo } = context.repo;
  const pull_number = context.payload.pull_request.number;

  const reviewBody = reviews.join('\n\n---\n\n');

  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    body: reviewBody,
    event: 'COMMENT'
  });
}

async function main() {
  try {
    const changedFiles = await getChangedFiles();
    const reviews = [];
    
    for (const file of changedFiles) {
      if (file.status !== 'removed') {
        const content = file.patch || '';
        if (content) {
          core.info(`Reviewing ${file.filename}...`);
          const review = await reviewCode(content, file.filename);
          reviews.push(`## AI Review: ${file.filename}\n\n${review}`);
        }
      }
    }

    if (reviews.length > 0) {
      await postReview(reviews);
      core.info('Code review completed successfully');
    } else {
      core.info('No files to review');
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

main();