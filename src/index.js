import { GoogleGenerativeAI } from '@google/generative-ai';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getChangedFiles() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const event = JSON.parse(await fs.readFile(eventPath, 'utf8'));
  
  const { owner, repo } = context.repo;
  const pull_number = event.pull_request.number;
  const base = event.pull_request.base.sha;
  const head = event.pull_request.head.sha;

  const { data: files } = await octokit.repos.compareCommits({
    owner,
    repo,
    base,
    head,
  });

  return files.files;
}

async function reviewCode(content) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `Please review this code and provide feedback on:
1. Potential bugs or issues
2. Code style and best practices
3. Performance considerations
4. Security concerns
5. Suggestions for improvement

Code to review:
${content}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function postReview(review) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const event = JSON.parse(await fs.readFile(eventPath, 'utf8'));
  
  const { owner, repo } = context.repo;
  const pull_number = event.pull_request.number;

  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    body: review,
    event: 'COMMENT'
  });
}

async function main() {
  try {
    const changedFiles = await getChangedFiles();
    
    for (const file of changedFiles) {
      if (file.status === 'modified' || file.status === 'added') {
        const content = file.patch || '';
        const review = await reviewCode(content);
        
        const reviewComment = `## AI Code Review for ${file.filename}\n\n${review}`;
        await postReview(reviewComment);
      }
    }
  } catch (error) {
    console.error('Error during code review:', error);
    process.exit(1);
  }
}

main();