# code-to-prompt

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
A Node.js command-line utility to recursively gather files from specified paths, format their content, and output everything suitable for pasting into Large Language Model (LLM) prompts.

**Motivation:** This tool is heavily inspired by and aims to provide similar functionality to Simon Willison's excellent Python-based [`files-to-prompt`](https://github.com/simonw/files-to-prompt) utility, but implemented in a Node.js/TypeScript environment. It's designed for developers who might be more comfortable extending or integrating within a JavaScript ecosystem.

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

## Installation (Local Usage)

As this tool is not intended for public npm release currently, you can install and run it locally from the cloned repository.

**Method 1: Global Link (Recommended for easy access)**

This method makes the `code-to-prompt` command available anywhere in your terminal.

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/your-username/code-to-prompt.git](https://github.com/your-username/code-to-prompt.git) # Replace with your repo URL
    cd code-to-prompt
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Build the project:**

    ```bash
    npm run build
    ```

    _(This step might run automatically because of the `"prepare": "npm run build"` script in `package.json` when you run `npm install` or `npm link`)_

4.  **Link the package globally:**
    ```bash
    npm link
    ```

Now you can run `code-to-prompt` from any directory.

- **To Update:** Navigate back to the `code-to-prompt` directory, pull the latest changes (`git pull`), and run `npm install` followed by `npm run build` (if needed) and `npm link` again.
- **To Uninstall:** Navigate back to the `code-to-prompt` directory and run `npm unlink`.

**Method 2: Run Directly from Project Directory**

1.  **Clone and build** as described in steps 1-3 above.
2.  **Run using `node`:**
    ```bash
    node /path/to/code-to-prompt/dist/index.js [options] [paths...]
    ```
3.  **Run using `npm start` (if arguments are simple):**
    ```bash
    # From within the code-to-prompt directory
    npm start -- [options] [paths...]
    # Note the '--' to separate npm arguments from your script's arguments
    ```

## Usage

The basic command structure is:

```bash
code-to-prompt [options] [paths...]
[paths...]: One or more file or directory paths to process.[options]: Flags to control filtering, formatting, and output.You can also pipe paths into the tool, for example using find or fd:find ./src -name "*.ts" | code-to-prompt
# Use -0 with find's -print0 for paths with special characters
find ./src -name "*.ts" -print0 | code-to-prompt -0
OptionsOptionAliasDescriptionDefaultpaths...Input file or directory paths (also reads from stdin if no paths given).--extension-eFile extension(s) to include (e.g., -e .ts -e .js). Can be repeated.(Include all)--include-hiddenInclude hidden files and folders (those starting with .).false--ignore-files-onlyMakes --ignore patterns only apply to files, not directories.false--ignore-gitignoreIgnore .gitignore files and include all files found.false--ignoreGlob pattern(s) to ignore using minimatch. Can be repeated (e.g., --ignore "*.log").[]--output-oOutput to a specified file instead of standard output.stdout--cxml-cOutput in Claude-friendly XML format. Mutually exclusive with -m.false--markdown-mOutput in Markdown format with fenced code blocks. Mutually exclusive with -c.false--line-numbers-nAdd line numbers to the content of each file in the output.false--null-0Use NUL (\0) character as separator when reading paths from stdin.false--treePrepend a file tree structure overview to the output.false--verbose-VEnable verbose debug logging to stderr.false--help-hShow help message.--version-vShow version number.Examples1. Process all non-ignored files in the current directory:code-to-prompt .
2. Process only TypeScript and JavaScript files in the src directory:code-to-prompt -e .ts -e .js ./src
3. Process files in src and tests, ignoring .log files and node_modules (via .gitignore), outputting as Markdown to a file:# Assumes .gitignore includes node_modules/ and *.log
code-to-prompt ./src ./tests --markdown -o prompt.md
4. Explicitly ignore build artifacts and test snapshots:code-to-prompt . --ignore "dist/**" --ignore "**/*.snap"
5. Process specific files and add line numbers:code-to-prompt src/index.ts src/lib/printers.ts --line-numbers
6. Generate a file tree overview for the src directory:code-to-prompt --tree ./src
7. Combine find with code-to-prompt using null separator:find ./src -type f \( -name "*.ts" -o -name "*.json" \) -print0 | code-to-prompt -0 --markdown
8. Output in Claude XML format, including hidden files:code-to-prompt --cxml --include-hidden .
DevelopmentClone the repository.Install dependencies: npm installBuild the TypeScript code: npm run buildRun tests: npm test (Note: You'll need to update the test script in package.json to actually run Jest/Vitest).Run in development mode (uses ts-node): npm run dev -- [options] [paths...] (note the -- before passing args to the script).LicenseThis project is licensed under the MIT License. See the LICENSE file for details.AcknowledgementsThis tool was heavily inspired by Simon Willison's [files-to-prompt](
```
