# Security Policy

## Supported version

Security fixes are applied to the current `main` branch.

## Reporting a vulnerability

Use GitHub private vulnerability reporting for this repository. Include the affected route or component, reproduction steps, expected impact, and any relevant environment details. Do not include real API keys, passwords, private documents, or personal conversation data.

Please avoid public disclosure until the issue has been reviewed and a mitigation is available.

## Deployment scope

The built-in account, JSON persistence, file storage, and in-memory rate limiting are intended for local development and small single-instance private deployments. Public or multi-instance deployments should use a production identity provider, transactional database, shared rate limiter/session store, object storage, malware scanning, and isolated document-ingestion workers.
