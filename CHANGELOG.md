# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2025-04-24

### Added
- Parallel directory processing for improved performance
- Safe clipboard handling for large files using temporary files
- CHANGELOG.md to track version changes

### Fixed
- ESM compatibility issue with clipboardy module

## [0.2.0] - 2025-04-23

### Added
- Clipboard support with `-C/--clipboard` flag
- Configuration file support with `init` command
- Custom configuration path support with `--config` option

### Fixed
- Correctly check for conflicting clipboard and output arguments
- Various test improvements

## [0.1.4] - 2025-04-20

### Fixed
- Honor custom `--ignore` patterns in tree view
- Load root `.gitignore` correctly
- Allow repeating `-e/--extension` and `--ignore` flags
- Match ignore patterns on full paths

## [0.1.3] - 2025-04-20

### Fixed
- Update output file modification time

## [0.1.2] - 2025-04-19

### Added
- Binary file handling with `--include-binary` flag

### Fixed
- Downgraded chalk to support older versions of Node.js
- Prevent loading binary files by default

## [0.1.1] - 2025-04-19

### Added
- HTML landing page and documentation
- Logo and branding

### Fixed
- Respect `.gitignore` from common ancestor instead of current working directory
- Tree display for paths outside current directory

## [0.1.0] - 2025-04-19

### Added
- Initial release
- Support for generating code trees with `--tree` flag
- File filtering by extension with `-e/--extension` flag
- Output formats: default, Claude XML (`--cxml`), and Markdown (`--markdown`)
- Line numbers with `--line-numbers` flag
- File output with `-o/--output` flag
- Respect `.gitignore` files
- Custom ignore patterns with `--ignore` flag
- Hidden files support with `--include-hidden` flag