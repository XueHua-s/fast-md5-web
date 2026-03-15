# Skill Loading Guide for AI Agents

This project uses a `skills/` directory to provide structured, reusable AI instructions. Before starting a task, check whether any of the skills below match the user's intent and load the corresponding `SKILL.md`. Follow the instructions within each loaded skill throughout the task.

For full project context, constraints, and collaboration guidelines, see `AGENTS.md` at the project root.

## How to Load

1. Read the skill's `SKILL.md` file
2. Follow the instructions inside `SKILL.md` to load any `references/` docs it requires
3. Execute the task according to the workflow defined in the skill

For complex tasks, load multiple skills together (e.g. refactoring = design philosophy + project spec + project structure).

## Available Skills

### Code Review Expert

- **Path**: `skills/code-review-expert/SKILL.md`
- **When to load**: User requests code review, PR review, security audit, or SOLID analysis
- **References**:
  - `skills/code-review-expert/references/solid-checklist.md`
  - `skills/code-review-expert/references/security-checklist.md`
  - `skills/code-review-expert/references/code-quality-checklist.md`
  - `skills/code-review-expert/references/removal-plan.md`

### Software Design Philosophy

- **Path**: `skills/software-design-philosophy/SKILL.md`
- **When to load**: User mentions module design, API complexity, shallow modules, refactoring, complexity management, or *A Philosophy of Software Design*
- **References**:
  - `skills/software-design-philosophy/references/complexity-symptoms.md`
  - `skills/software-design-philosophy/references/deep-modules.md`
  - `skills/software-design-philosophy/references/information-hiding.md`
  - `skills/software-design-philosophy/references/general-vs-special.md`
  - `skills/software-design-philosophy/references/comments-as-design.md`
  - `skills/software-design-philosophy/references/strategic-programming.md`

### Project Spec

- **Path**: `skills/fast-md5-web-project-spec/SKILL.md`
- **When to load**: User works on features, interface refactoring, performance optimization, or needs quality gate / test acceptance guidance
- **References** (always load `global-prompt.md` first):
  - `skills/fast-md5-web-project-spec/references/global-prompt.md`

### Project Structure

- **Path**: `skills/fast-md5-web-project-structure/SKILL.md`
- **When to load**: User asks "where is this file", "which module to change", needs dependency info, or makes cross-module changes
- **References**:
  - `skills/fast-md5-web-project-structure/references/project-structure.md`
  - `skills/fast-md5-web-project-structure/references/dependencies.md`
