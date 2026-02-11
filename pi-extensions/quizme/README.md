# Quiz Me

Test your understanding of what happened in your coding session. This extension generates a quiz about your recent changes and grades your answers.

## Features

- **Automatic Session Quiz**: Prompts you at session shutdown to quiz your understanding
- **Manual Trigger**: Run `/quizme` command anytime to generate a quiz
- **Smart Question Generation**: Creates 5-12 questions based on actual session activity
- **Multiple Question Types**: Multiple choice, short answer, and "explain why"
- **Automated Grading**: AI-powered grading with explanations for each answer

## Commands

### `/quizme`

Generate a quiz about the current session:

```bash
/quizme
```

## Controls

During the quiz:
- **Enter** / **Return**: Edit your answer for the current question
- **← / →** or **p / n**: Navigate between questions
- **g**: Grade your answers and see results
- **Esc**: Cancel the quiz

## What It Tests

The quiz focuses on:
- File changes made during the session
- Configuration choices
- Architecture decisions
- New workflows introduced

## Configuration

The quiz behavior is controlled by `~/.pi/agent/extensions/quizme/prompt.md`. You can customize:
- Number of questions (default: 5-12)
- Question types and balance
- Grading strictness
- Focus areas (files, config, architecture, workflows)

## Debug Mode

The extension logs detailed debug information to `~/.pi/debug/quizme/` for troubleshooting quiz generation and grading.

## Notes

- Requires a model with API key configured
- Session text must exist to generate a quiz (empty sessions are skipped)
- Quiz prompts are truncated to fit within context limits