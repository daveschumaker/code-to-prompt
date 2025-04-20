# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Build: `npm run build` (compile TS), `npm run typecheck` (type check only)
- Lint: No explicit lint command found, consider using `npx eslint .`
- Test: `npm test` (all tests), `npx jest path/to/test.test.ts` (single test)
- Watch: `npm run test:watch` (all tests), `npx jest --watch path/to/test.test.ts` (single test)

## Code Style Guidelines

- **Formatting**: 2-space indentation, 80-char line limit, single quotes
- **Imports**: Group by category (Node.js → external → local), use named imports
- **Types**: Explicit parameter/return types, interfaces for objects, type aliases for simpler types
- **Naming**: camelCase for variables/functions, PascalCase for interfaces/types/classes
- **Functions**: Descriptive names starting with verbs, single responsibility
- **Error Handling**: Try/catch with type narrowing, detailed error messages, fallback strategies
- **Tests**: Jest tests with clear BDD-style descriptions, setup/teardown with before/after hooks

When working on code in this repository, maintain consistent style with existing files and ensure all tests pass.
