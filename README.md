# code-to-prompt

<p align="center">
  <img src="docs/code-to-prompt-logo.png" alt="code-to-prompt logo" width="250" />
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/code-to-prompt.svg)](https://badge.fury.io/js/code-to-prompt)
[![Changelog](https://img.shields.io/badge/changelog-view-blue)](CHANGELOG.md)

A Node.js command-line utility to recursively gather files from specified paths, format their content, and output everything suitable for pasting into Large Language Model (LLM) prompts.

## Motivation

This tool is heavily inspired by and aims to provide similar functionality to Simon Willison's excellent Python-based [`files-to-prompt`](https://github.com/simonw/files-to-prompt) utility, but implemented in a Node.js/TypeScript environment. It's designed for developers who might be more comfortable extending or integrating within a JavaScript ecosystem.

## Features

- Recursively scans directories for files.
- Concatenates specified file contents into a single output.
- Filters files by extension (`-e`).
- Respects `.gitignore` rules by default (`--ignore-gitignore` to disable).
- Supports custom ignore patterns (`--ignore`).
- Optionally includes hidden files and folders (`--include-hidden`).
- Multiple output formats:
  - Default: Simple text format with file paths as headers.
  - Markdown: Fenced code blocks with language detection (`-m`).
  - XML: Claude-friendly XML format (`-c`).
- Optionally adds line numbers to output (`-n`).
- Optionally generates a file tree structure overview (`--tree`).
- Accepts paths as arguments or via standard input (including null-separated).
- Outputs to standard output or a specified file (`-o`).
- Verbose logging for debugging (`-V`).

## Installation

The `code-to-prompt` package is published on npm. You can install it globally:

```bash
npm install -g code-to-prompt
```

### Method 1: Global Link (Recommended for easy access)

This method makes the `code-to-prompt` command available anywhere in your terminal.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/daveschumaker/code-to-prompt.git
   cd code-to-prompt
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

4. **Link the package globally:**

   ```bash
   npm link
   ```

Now you can run `code-to-prompt` from any directory.

#### To Update

Navigate back to the `code-to-prompt` directory, pull the latest changes (`git pull`), and run `npm install` followed by `npm run build` (if needed) and `npm link` again.

#### To Uninstall

Navigate back to the `code-to-prompt` directory and run `npm unlink`.

### Method 2: Run Directly from Project Directory

1. Clone and build as described in steps 1-3 above.
2. Run the tool using `node` directly or via an npm script (if configured):

   ```bash
   # Example: Run directly using node
   node dist/index.js [options] [paths...]

   # Example: If you have a 'start' or 'dev' script in package.json
   # npm start -- [options] [paths...]
   ```

## Usage

The basic command structure is:

```bash
code-to-prompt [options] [paths...]
```

- `[paths...]`: One or more file or directory paths to process. If omitted, paths are read from standard input.
- `[options]`: Flags to control filtering, formatting, and output (see below).

You can also pipe paths into the tool, for example using `find` or `fd`:

```bash
find ./src -name "*.ts" | code-to-prompt
# Use -0 with find's -print0 for paths with special characters
find ./src -name "*.ts" -print0 | code-to-prompt -0
```

### Options

| Option                | Alias | Description                                                                            | Default                                                    |
| --------------------- | ----- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `paths...`            |       | Input file or directory paths (reads from stdin if no paths given).                    |                                                            |
| `--config`            |       | Path to configuration file.                                                            | `~/.config/code-to-prompt/config.json` (or XDG equivalent) |
| `--extension`         | `-e`  | File extension(s) to include (e.g., `-e .ts -e .js`). Can be repeated.                 | (Include all)                                              |
| `--include-hidden`    |       | Include hidden files and folders (those starting with `.`).                            | `false`                                                    |
| `--include-binary`    |       | Include binary files (images, executables, etc.).                                      | `false`                                                    |
| `--ignore-files-only` |       | Makes `--ignore` patterns only apply to files, not directories.                        | `false`                                                    |
| `--ignore-gitignore`  |       | Ignore `.gitignore` files and include all files found.                                 | `false`                                                    |
| `--ignore`            |       | Glob pattern(s) to ignore using minimatch. Can be repeated (e.g., `--ignore "*.log"`). | `[]`                                                       |
| `--output`            | `-o`  | Output to a specified file instead of standard output.                                 | `stdout`                                                   |
| `--cxml`              | `-c`  | Output in Claude-friendly XML format. Mutually exclusive with `-m`.                    | `false`                                                    |
| `--markdown`          | `-m`  | Output in Markdown format with fenced code blocks. Mutually exclusive with `-c`.       | `false`                                                    |
| `--line-numbers`      | `-n`  | Add line numbers to the content of each file in the output.                            | `false`                                                    |
| `--clipboard`         | `-C`  | Copy the output directly to the system clipboard. Conflicts with `-o`.                 | `false`                                                    |
| `--null`              | `-0`  | Use NUL (`\0`) character as separator when reading paths from stdin.                   | `false`                                                    |
| `--tree`              |       | Prepend a file tree structure overview to the output.                                  | `false`                                                    |
| `--add-to-tree`       |       | Add specified paths to the file tree only, without exporting their contents.           | `[]`                                                       |
| `--verbose`           | `-V`  | Enable verbose debug logging to stderr.                                                | `false`                                                    |
| `--help`              | `-h`  | Show help message.                                                                     |                                                            |
| `--version`           | `-v`  | Show version number.                                                                   |                                                            |

### Examples

#### 1. Process all non-ignored files in the current directory

```bash
code-to-prompt .
```

#### 2. Process only TypeScript and JavaScript files in the src directory

```bash
code-to-prompt -e .ts -e .js ./src
```

#### 3. Process files in `src` and `tests`, ignoring `.log` files and `node_modules` (via `.gitignore`), outputting as Markdown to a file

```bash
# Assumes .gitignore includes node_modules/ and *.log
code-to-prompt ./src ./tests --markdown -o prompt.md
```

#### 4. Explicitly ignore build artifacts and test snapshots

```bash
code-to-prompt . --ignore "dist/**" --ignore "**/*.snap"
```

#### 5. Process specific files and add line numbers

```bash
code-to-prompt src/index.ts src/lib/printers.ts --line-numbers
```

#### 6. Generate a file tree overview for the `src` directory

```bash
code-to-prompt --tree ./src
```

#### 7. Combine `find` with `code-to-prompt` using null separator

```bash
find ./src -type f \( -name "*.ts" -o -name "*.json" \) -print0 | code-to-prompt -0 --markdown
```

#### 8. Output in Claude XML format, including hidden files

```bash
code-to-prompt --cxml --include-hidden .
```

#### 9. Include binary files in the output

```bash
code-to-prompt --include-binary . -o output-with-binaries.txt
```

#### 10. Multi-line configuration options

```bash
code-to-prompt \
  --markdown \
  --line-numbers \
  --ignore "*.snap" \
  --ignore "dist/**" \
  -o specific-prompt.md \
  src/index.ts \
  src/lib/printers.ts \
  src/lib/fileTree.ts \
  tests/e2e/cli.test.ts \
  README.md \
  LICENSE \
  ./src/types \
  ./assets
```

#### 11. Process files and copy the result directly to the clipboard

```bash
code-to-prompt ./src -e .ts --markdown -C
```

This processes TypeScript files in `src`, formats the output as Markdown, and copies the entire result to the system clipboard instead of printing it to standard output or a file.

## Configuration

`code-to-prompt` can be configured using a JSON file located at the standard XDG config directory:

- Linux/macOS: `~/.config/code-to-prompt/config.json`
- Windows: `%LOCALAPPDATA%\code-to-prompt\config.json` (or equivalent)

You can create a default configuration file using the `init` command:

```bash
code-to-prompt init
```

This will create the file with default settings, which you can then customize. Available options in the config file mirror the command-line flags (use the long-form name, e.g., `"include-hidden": true`).

**Precedence:** Command-line flags will always override settings found in the configuration file.

You can also specify a custom configuration file path using the `--config` flag:

```bash
code-to-prompt --config ./my-project-config.json .
```

## Development

1. Clone the repository.
2. Install dependencies: `npm install`
3. Build the TypeScript code: `npm run build`
4. Run tests: `npm test`
5. Run in development mode (uses `ts-node`): `npm run dev -- [options] [paths...]` (note the `--` before passing args to the script).

## Contributing

Contributions are welcome! To contribute, please follow these steps:

1. [Fork the project repository](https://github.com/daveschumaker/code-to-prompt/fork).
2. Create a new branch for your feature or bugfix (e.g., `git checkout -b my-feature`).
3. Add or modify code as needed.
4. Write tests for your changes.
5. Commit your changes (`git commit -m "feat: description"`).
6. Push to your fork (`git push origin my-feature`).
7. [Open a pull request](https://github.com/daveschumaker/code-to-prompt/pulls) against the main repository.
8. Address any review comments.

## Changelog

See the [CHANGELOG.md](CHANGELOG.md) file for details on all version changes.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements

This tool was heavily inspired by Simon Willison's [files-to-prompt](https://github.com/simonw/files-to-prompt).
