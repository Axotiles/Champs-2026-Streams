# Security Architecture and Threat Model

## Project Overview

Champs-2026-Streams is a web application that displays VALORANT Champions tournament streams through Twitch.

The application uses a browser-based frontend and an Express.js backend. The backend acts as a security boundary between the browser and the Twitch API so that Twitch credentials are never exposed to the client.

The project is also used as a cybersecurity portfolio project to demonstrate secure application design, defensive controls, automated security testing, and threat modeling.

## Architecture

```text
Browser
   |
   | HTTPS / HTTP (local development)
   v
Express.js Backend
   |
   +---- Session Authentication
   |
   +---- CSRF Protection
   |
   +---- Input Validation
   |
   +---- Rate Limiting
   |
   +---- Security Headers / CSP
   |
   +---- Security Logging
   |
   v
Twitch API
```

### Trust Boundaries

There are three primary trust boundaries:

1. **Browser → Express backend**

   Requests originating from the browser are treated as untrusted input.

2. **Express backend → Twitch API**

   Twitch credentials are trusted server-side secrets and are never intentionally exposed to the browser.

3. **GitHub repository / CI → application code**

   Source code, dependencies, workflows, and repository configuration are continuously checked for security problems.

## Protected Assets

The primary assets are:

| Asset                              | Security Importance |
| ---------------------------------- | ------------------- |
| Twitch API client ID               | Medium              |
| Twitch access token                | High                |
| Session secret                     | High                |
| CSRF secret                        | High                |
| Admin credentials / password hash  | High                |
| Authenticated user session         | High                |
| Application source code            | Medium              |
| GitHub repository and CI workflows | High                |
| Security logs                      | Medium              |

## Attack Surface

| Component / Endpoint | Attacker-Controlled Input                | Primary Risk                                            | Current Defenses                                                         |
| -------------------- | ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/api/login`         | Username, password                       | Credential attacks, session abuse                       | Login rate limiting, bcrypt, generic errors, session authentication      |
| `/api/logout`        | CSRF header, session cookie              | CSRF, unauthorized logout                               | Authentication check, CSRF protection                                    |
| `/api/streams`       | `user_login` query parameters            | Injection, abuse, excessive upstream requests           | Authentication, input validation, length/count limits, rate limiting     |
| `/api/csrf-token`    | Request context                          | CSRF token abuse                                        | Token generated server-side and bound to the session                     |
| `/api/health`        | None                                     | Information exposure                                    | Minimal response                                                         |
| Twitch API request   | Validated channel names                  | Credential exposure, upstream abuse                     | Twitch credentials remain server-side; validated inputs; rate limiting   |
| Session cookie       | Browser-managed cookie                   | Session theft, cross-site abuse                         | HTTP-only, SameSite, production Secure flag, explicit path/name/lifetime |
| Frontend DOM         | Twitch/player data and application state | Cross-site scripting                                    | DOM APIs instead of unsafe HTML insertion                                |
| GitHub repository    | Source code and workflow files           | Secret exposure, vulnerable dependencies, insecure code | Gitleaks, npm audit, Semgrep, CodeQL                                     |
| CI/CD workflows      | Repository-controlled configuration      | Supply-chain or workflow abuse                          | Restricted permissions and security scanning                             |


## Threat Model

The following threats are based on the STRIDE model.

### Spoofing

**Threat:** An attacker attempts to impersonate an authenticated user.

**Relevant attack paths:**

* Credential guessing
* Session theft
* Login abuse

**Mitigations:**

* Password verification with bcrypt
* Generic invalid-credential responses
* Login rate limiting
* HTTP-only session cookies
* SameSite cookie policy
* Secure cookies in production
* Session expiration
* Authentication checks on protected endpoints

**Residual risk:**
Credential compromise is still possible outside the application, such as through phishing or reuse of passwords elsewhere.

---

### Tampering

**Threat:** An attacker attempts to modify requests or application state without authorization.

**Relevant attack paths:**

* Forged state-changing requests
* Unauthorized API requests
* Manipulated query parameters

**Mitigations:**

* CSRF protection on logout
* Authentication middleware
* Input validation
* Restricted backend API behavior
* Server-side authorization checks

**Residual risk:**
Future administrative endpoints will require explicit authorization controls such as role-based access control.

---

### Repudiation

**Threat:** A malicious or unauthorized action cannot be reliably attributed to a user or event.

**Mitigations:**

* Security logging for authentication events
* Logging of login failures
* Login rate-limit events
* Logout events
* Timestamped security log entries

**Residual risk:**
Current logging is local console logging. A production deployment would benefit from centralized, tamper-resistant log storage and alerting.

---

### Information Disclosure

**Threat:** Sensitive information is exposed to unauthorized users.

**Relevant attack paths:**

* Exposed Twitch credentials
* Session compromise
* Browser-side access to sensitive secrets
* Accidental secret commits

**Mitigations:**

* Twitch API requests occur on the backend
* Secrets are stored in environment variables
* `.env` is excluded from Git
* Gitleaks secret scanning runs in GitHub Actions
* HTTP-only session cookies
* Content Security Policy
* Security headers
* Generic authentication error messages

**Residual risk:**
Production deployment must ensure secrets are managed through secure deployment infrastructure rather than repository files.

---

### Denial of Service

**Threat:** An attacker sends excessive requests to consume application or upstream resources.

**Relevant attack paths:**

* Repeated login attempts
* Excessive stream API requests
* Large request parameter sets

**Mitigations:**

* Login rate limiting
* `/api/streams` rate limiting
* Maximum number of `user_login` values
* Maximum username length
* Input format validation

**Residual risk:**
Application-level rate limiting does not replace infrastructure-level DDoS protection.

---

### Elevation of Privilege

**Threat:** An attacker obtains access beyond their intended authorization level.

**Relevant attack paths:**

* Accessing protected APIs without authentication
* Bypassing authorization checks
* Future administrative functionality

**Mitigations:**

* `requireAuth` middleware
* Protected `/api/streams`
* Protected `/api/logout`
* Server-side authentication checks
* Future role-based access control for administrative functionality

**Residual risk:**
If administrative features are added, they must use explicit server-side authorization checks and never rely solely on frontend visibility.

## Current Security Controls

### Application Security

* Express backend/API separation
* Server-side secret storage
* Input validation
* Rate limiting
* Authentication
* Session management
* CSRF protection
* Security logging
* XSS hardening
* Content Security Policy
* Security headers
* Secure production cookie configuration

### Automated Security

GitHub Actions currently performs:

* `npm audit` dependency auditing
* Gitleaks secret scanning
* Semgrep static analysis
* CodeQL analysis

An OWASP ZAP baseline workflow has also been added and will be used once the application has a deployable URL.

## Security Testing Philosophy

Security controls are tested through both manual verification and automated analysis.

Examples of manually tested behavior include:

* Invalid credentials are rejected
* Login attempts are rate limited
* Protected API endpoints return `401` when unauthenticated
* Logout requires authentication
* Logout requires a valid CSRF token
* Logged-out users cannot retrieve protected stream data
* Malformed `user_login` input is rejected

Automated checks provide continuous verification as code changes are pushed to the repository.

## Known Limitations

This is a portfolio project and is not currently designed as a production-scale security system.

Known limitations include:

* Local development currently uses HTTP
* Security logs are written to the server console
* The default Express session store is not intended for production deployment
* Administrative RBAC is not yet implemented because administrative modification endpoints do not yet exist
* OWASP ZAP has not yet been run against a deployed instance
* Infrastructure-level protections such as WAF or DDoS mitigation are outside the current project scope

## Future Security Improvements

Potential future improvements include:

* Production deployment over HTTPS
* Production-grade session storage
* Centralized security logging
* Alerting for suspicious authentication activity
* Role-based administrative access
* Automated OWASP ZAP scanning
* Dependabot configuration
* GitHub security alerts
* More extensive integration tests
* Incident-response documentation
* Periodic threat-model review as new features are introduced

## Security Design Principle

Security is treated as part of the application architecture rather than a final checklist.

New features should be evaluated for:

1. What data they accept
2. Who is allowed to perform the action
3. What trust boundary the request crosses
4. What could go wrong if the input or user is malicious
5. How the feature will be tested automatically
