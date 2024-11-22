import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "@octokit/rest";
import { context } from "@actions/github";
import * as core from "@actions/core";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function createCheckRun(status, conclusion = "in_progress", output = {}) {
  const { owner, repo } = context.repo;
  return await octokit.checks.create({
    owner,
    repo,
    name: "GeminiAI Code Review",
    head_sha: context.payload.pull_request.head.sha,
    status: status || "in_progress",
    conclusion: status === "completed" ? conclusion : "neutral",
    output: {
      title: output.title || "Code Review in Progress",
      summary: output.summary || "The code review is currently in progress.",
      text: output.text || "",
    },
  });
}

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
   - IMPORTANT: End this section with a clear "PASS" or "FAIL" verdict

4. 🚀 Suggestions
   - Performance improvements
   - Code style enhancements
   - Best practices

Code to review:
\`\`\`
${content}
\`\`\`

Keep the tone friendly and encouraging, using emojis naturally throughout the review.
PS: please be concise and to the point, only summarize the whole request you dont need to explain every line.

IMPORTANT: End your review with one of these verdicts:
- "VERDICT: PASS 🟢" if there are no critical issues
- "VERDICT: FAIL 🔴" if there are critical issues that must be addressed
`;

  const result = await model.generateContent(prompt);
  const review = result.response.text();

  // Determine if review passed based on the verdict
  const passed = review.includes("VERDICT: PASS 🟢");
  return { review, passed };
}

async function postReview(reviews, allFilesPassed) {
  const { owner, repo } = context.repo;
  const pull_number = context.payload.pull_request.number;

  const header = `# 👋 Hello from GeminiAI Review Buddy!\n\nI've taken a look at your changes and here's what I found:\n\n`;
  const verdict = allFilesPassed
    ? "\n\n## ✅ Overall Verdict: All checks passed!\nYour code looks good and is ready for merging.\n"
    : "\n\n## ❌ Overall Verdict: Changes needed\nPlease address the issues mentioned above before merging.\n";
  const footer = `\n\n---\n\n💡 _I'm your friendly AI code reviewer powered by Google Gemini. Feel free to discuss or ask questions about my suggestions!_`;

  const reviewBody = header + reviews.join("\n\n---\n\n") + verdict + footer;

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
    // Create initial check run
    await createCheckRun("in_progress", "neutral", {
      title: "GeminiAI Code Review",
      summary: "Code review in progress...",
    });

    const changedFiles = await getChangedFiles();
    const reviews = [];
    let allFilesPassed = true;
    let reviewSummary = "";

    for (const file of changedFiles) {
      if (file.status !== "removed") {
        const content = file.patch || "";
        if (content) {
          core.info(`Reviewing ${file.filename}...`);
          const { review, passed } = await reviewCode(content, file.filename);
          reviews.push(`## 📝 Review for \`${file.filename}\`\n\n${review}`);
          reviewSummary += `\n\n### ${file.filename}\n${review}`;
          allFilesPassed = allFilesPassed && passed;
        }
      }
    }

    if (reviews.length > 0) {
      await postReview(reviews, allFilesPassed);

      // Update check run with final status
      const conclusion = allFilesPassed ? "success" : "failure";
      const output = {
        title: allFilesPassed ? "Code Review Passed ✅" : "Changes Required ❌",
        summary: allFilesPassed
          ? "All files have passed the code review! Ready to merge."
          : "Some files need attention. Please address the issues in the review comments.",
        text: reviewSummary,
      };

      await createCheckRun("completed", conclusion, output);

      if (!allFilesPassed) {
        core.setFailed("Some files did not pass the review");
      }
    } else {
      core.info("No files to review");
      await createCheckRun("completed", "success", {
        title: "No Files to Review",
        summary: "No files were found that needed review.",
      });
    }
  } catch (error) {
    core.setFailed(error.message);

    // Create failure check run
    await createCheckRun("completed", "failure", {
      title: "Review Process Failed",
      summary: `Error during code review: ${error.message}`,
    });
  }
}

main();
