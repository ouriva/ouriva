# Security Policy

## Supported Versions

Only the latest release is actively maintained and receives security fixes.

| Version | Supported |
|---------|-----------|
| Latest  | ✅ Yes    |
| Older   | ❌ No     |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, send an email to **hello@ouriva.app** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations, if you have them

You can expect an acknowledgement within 48 hours and a resolution timeline within 7 days for critical issues.

## Scope

This project is a **self-hosted, single-user application**. There is no shared infrastructure or multi-tenant surface to attack. Security issues in scope include:

- Vulnerabilities in the application code (API routes, data handling)
- Dependency vulnerabilities with a realistic exploit path
- Insecure default configurations in the Docker setup

Out of scope:

- Vulnerabilities that require physical access to the server
- Attacks against the user's own infrastructure (database, reverse proxy) — those are the operator's responsibility
- Issues in third-party dependencies with no realistic exploit path in this codebase

## Security Design

Ouriva has **no built-in authentication**. This is intentional — it is designed to run behind an authentication layer you control (reverse proxy with HTTP Basic Auth, VPN, SSO). See the [Security section in the README](README.md#security) for recommended options.
