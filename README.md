# GitHub AI Code Review with Google Gemini

This GitHub Action automatically performs code reviews on pull requests using Google's Gemini AI.

## Setup

1. Create a Google Cloud project and get a Gemini API key
2. Add the following secrets to your GitHub repository:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## How it works

The action triggers automatically when:
- A new pull request is opened
- Changes are pushed to an existing pull request

The AI reviewer will:
1. Analyze changed files in the PR
2. Generate comprehensive code review comments
3. Post the review as a comment on the PR

## Configuration

The action is configured to review:
- Code style and best practices
- Potential bugs
- Performance considerations
- Security concerns
- Improvement suggestions