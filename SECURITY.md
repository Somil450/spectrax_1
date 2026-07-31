# Security Policy

## Supported Versions

Security updates are currently provided for the latest code available on the `main` branch.

| Version | Supported |
| ------- | --------- |
| main    | ✅ Yes    |

## Contact Details

To report a security vulnerability in **SpectraX**, please contact the maintainer through one of the following channels:

- 👤 Maintainer Profile: [Somil Jain](https://github.com/Somil450)
- 💬 Contact the maintainer through any social links listed on the GitHub profile

> Please **do not** open a public GitHub issue for security vulnerabilities.

## Expected Response Time

| Action | Timeframe |
| ------- | --------- |
| Acknowledgement of report | Within 48 hours |
| Status update | Within 7 days |
| Patch / fix release | Within 30 days |

## Responsible Disclosure Policy

We follow a **responsible disclosure** policy:

- Please report vulnerabilities privately before any public disclosure
- We request an embargo period of 30 days to investigate and patch the issue
- After a fix is released, you are welcome to publish your findings
- We will credit reporters in release notes unless anonymity is requested
- We deeply appreciate the efforts of security researchers and contributors who help keep the project secure 🙏

## What to Include in Your Report

- A clear description of the vulnerability
- Steps to reproduce the issue
- Affected versions or components
- Potential impact assessment
- Proof of concept, screenshots, or logs (if applicable)
- Any suggested fix (optional but appreciated)

## Dependency Vulnerability Status

`npm audit` is run against the frontend (`package.json`) and backend (`server/package.json`) dependency trees. The backend is fully clean after upgrading `vitest` to `4.x`. The frontend still reports advisories that **cannot be resolved without major breaking changes**; they are documented below with their impact assessment.

| Package | Severity | Advisory | Reason not auto-fixed |
| ------- | -------- | -------- | --------------------- |
| `brace-expansion` / `minimatch` chain (via `eslint`, `jest`, `@typescript-eslint`, `glob`, `workbox-build`) | High | ReDoS in brace expansion | These are **dev-only** build/lint/test toolchain dependencies. The only non-`--force` resolution is a major upgrade of `eslint` (8.x to 10.x) and `jest`, which changes lint/test configuration and is a breaking change. |
| `@xenova/transformers` (via `onnxruntime-web` -> `onnx-proto` -> `protobufjs`; `sharp`) | Critical / High | `protobufjs` DoS (critical); `sharp` advisory | `@xenova/transformers` is used at runtime by the pose-estimation workers (`src/workers/`). npm's fix is a downgrade to `1.4.2`, which **drops** the `onnxruntime-web`/`sharp` dependencies and would break the AI pose-estimation feature. |
| `react-router-dom` / `react-router` | High | GHSA-qwww-vcr4-c8h2 (RSC mode CSRF) | Advisory affects React Router in **RSC (React Server Components) data mode** only. This app is a client-side SPA that does not import `react-router` (routing is state-based in `App.tsx`), so it is not applicable. npm's fix is a downgrade to `7.11.0` (breaking). |

Re-run `npm audit fix` and `npm audit fix` (in `server/`) to pick up any future non-breaking fixes.

## References

- SpectraX Repository: https://github.com/Somil450/spectrax_1
- GitHub Security Advisories: https://docs.github.com/en/code-security/security-advisories
- OWASP Vulnerability Disclosure Cheat Sheet: https://owasp.org/www-community/Vulnerability_Disclosure_Cheat_Sheet
- Adding a Security Policy to Your Repository: https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository

