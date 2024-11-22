// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { Octokit } from "@octokit/rest";
// import dotenv from "dotenv";
// import fs from "fs/promises";

// dotenv.config();

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// // Track review status
// let reviewInProgress = false;
// let reviewPassed = false;

// async function getChangedFiles(context, eventData) {
//   const { owner, repo } = context.repo;
//   const pull_number = eventData.pull_request.number;
//   const base = eventData.pull_request.base.sha;
//   const head = eventData.pull_request.head.sha;

//   const { data: files } = await octokit.repos.compareCommits({
//     owner,
//     repo,
//     base,
//     head,
//   });

//   return files.files;
// }

// async function createCheckRun(context, eventData, status, conclusion, output) {
//   const { owner, repo } = context.repo;

//   return await octokit.checks.create({
//     owner,
//     repo,
//     name: 'Gemini Code Review',
//     head_sha: eventData.pull_request.head.sha,
//     status,
//     conclusion,
//     output: {
//       title: 'Code Review Results',
//       summary: output
//     }
//   });
// }

// async function reviewCode(content, filename) {
//   const model = genAI.getGenerativeModel({
//     model: "models/gemini-1.5-pro-002",
//     temperature: 0.7,
//   });

//   const prompt = `You are a thorough code reviewer. Please review this code and provide detailed feedback on:
// 1. Critical Issues:
//    - Potential bugs or logic errors
//    - Security vulnerabilities
//    - Performance bottlenecks
//    - Memory leaks

// 2. Code Quality:
//    - Code style and consistency
//    - Best practices adherence
//    - Design patterns usage
//    - Code organization

// 3. Specific Recommendations:
//    - Concrete suggestions for improvement
//    - Alternative approaches if applicable
//    - Performance optimization opportunities

// 4. Overall Assessment:
//    - A clear PASS/FAIL verdict
//    - Summary of key findings
//    - Risk level (High/Medium/Low)

// File being reviewed: ${filename}

// Code to review:
// ${content}

// Please format your response in markdown and be specific with your feedback.`;

//   const result = await model.generateContent(prompt);
//   const review = result.response.text();

//   // Determine if review passed based on AI response
//   const reviewPassed = !review.toLowerCase().includes('fail') &&
//                       !review.toLowerCase().includes('high risk') &&
//                       !review.toLowerCase().includes('critical issue');

//   return { review, passed: reviewPassed };
// }

// async function postReview(context, eventData, review, file) {
//   const { owner, repo } = context.repo;
//   const pull_number = eventData.pull_request.number;

//   await octokit.pulls.createReview({
//     owner,
//     repo,
//     pull_number,
//     body: `## AI Code Review for ${file.filename}\n\n${review}`,
//     event: 'COMMENT'
//   });
// }

// async function main() {
//   try {
//     const eventPath = process.env.GITHUB_EVENT_PATH;
//     const eventData = JSON.parse(await fs.readFile(eventPath, "utf8"));
//     const context = {
//       repo: {
//         owner: eventData.repository.owner.login,
//         repo: eventData.repository.name
//       }
//     };

//     // Create initial check run
//     await createCheckRun(context, eventData, 'in_progress', null, 'Code review in progress...');
//     reviewInProgress = true;

//     const changedFiles = await getChangedFiles(context, eventData);
//     let allFilesPassed = true;
//     let reviewSummary = '';

//     for (const file of changedFiles) {
//       if (file.status === "modified" || file.status === "added") {
//         const content = file.patch || "";
//         const { review, passed } = await reviewCode(content, file.filename);

//         reviewSummary += `\n\n### ${file.filename}\n${review}`;
//         allFilesPassed = allFilesPassed && passed;

//         await postReview(context, eventData, review, file);
//       }
//     }

//     // Update final check run status
//     const conclusion = allFilesPassed ? 'success' : 'action_required';
//     const status = 'completed';
//     const output = allFilesPassed
//       ? 'All files passed AI code review! 🎉'
//       : 'Some files need attention. Please address the issues mentioned in the review comments. ⚠️';

//     await createCheckRun(context, eventData, status, conclusion, reviewSummary);

//     reviewInProgress = false;
//     reviewPassed = allFilesPassed;

//   } catch (error) {
//     console.error("Error during code review:", error);

//     // Create failure check run on error
//     try {
//       const eventData = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
//       const context = {
//         repo: {
//           owner: eventData.repository.owner.login,
//           repo: eventData.repository.name
//         }
//       };

//       await createCheckRun(
//         context,
//         eventData,
//         'completed',
//         'failure',
//         `Error during code review: ${error.message}`
//       );
//     } catch (e) {
//       console.error("Failed to create error check:", e);
//     }

//     process.exit(1);
//   }
// }

// main();
