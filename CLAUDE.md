# CLAUDE.md

This repository serves as a playground for AI coding agents to execute various one-off tasks. Each session creates a self-contained subdirectory where all work—code, dependencies, and artifacts—is performed.

## Working Guidelines

### Session Setup

- **Always create a new subdirectory** for each session or task. Name it descriptively based on the task being performed (e.g., `fitbit-heartrate-retrieval`, `csv-data-analysis`).
- **Keep all work self-contained** within the subdirectory. This includes source code, configuration files, installed dependencies (e.g., `node_modules`), and any generated output.
- Each subdirectory should be independently runnable. Include a README or comments explaining what the task does and how to run it, if applicable.
- If a `package.json` or similar dependency manifest is needed, create it inside the subdirectory rather than at the repository root.

### Security and Confidentiality

**All content checked into this repository is publicly accessible.** Exercise extreme caution with every commit.

- **Never commit credentials or secrets.** This includes but is not limited to:
  - API keys and tokens (OAuth tokens, access tokens, refresh tokens)
  - Passwords and passphrases
  - `.env` files or any environment variable files containing secrets
  - Private keys, certificates, or key files
  - Session cookies or authentication headers
  - Database connection strings with embedded credentials
- **Use `.gitignore`** within each subdirectory to exclude sensitive files, build artifacts, and dependencies (e.g., `node_modules/`, `.env`, `*.key`).
- If a task requires credentials at runtime, read them from environment variables or prompt the user for input—never hardcode them.

### Copyright and Licensing

- **Do not commit copyrighted material** that you do not have the right to redistribute. This includes proprietary datasets, copyrighted text, images, or any third-party content not explicitly licensed for redistribution.
- When using third-party libraries, ensure they are installed via a package manager (e.g., npm, pip) and listed in the appropriate manifest file rather than vendored directly, unless the license permits it.

### Pre-Commit Review

Before every commit, perform the following checks:

1. Run `git diff --staged` to review all staged changes line by line.
2. Verify that no credentials, secrets, or sensitive information are present in the diff.
3. Verify that no copyrighted or legally problematic files are included.
4. Confirm that all changes are within the intended subdirectory and do not modify unrelated files.
5. After pushing, briefly review the commit on the remote to ensure nothing was accidentally included.
