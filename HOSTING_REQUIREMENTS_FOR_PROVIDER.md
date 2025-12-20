# Hosting Requirements Specification
## LECRM Web Application

**Project:** LECRM (Customer Relationship Management System)  
**Type:** React Single Page Application (SPA) with Serverless API Functions  
**Date:** 2024

---

## Executive Summary

LECRM is a modern web application built with React that requires:
- Static file hosting for the frontend application
- Serverless function support for API endpoints
- Node.js runtime environment
- Environment variable management
- Database connectivity (external Supabase service)

---

## 1. Hosting Platform Requirements

### 1.1 Static File Hosting
**Required Capabilities:**
- Serve static HTML, CSS, and JavaScript files
- Support for Single Page Application (SPA) routing
  - All routes must redirect to `index.html` for client-side routing
- HTTPS/SSL certificate support
- CDN capabilities for global content delivery
- Gzip/Brotli compression support

**Build Output:**
- Directory: `dist/`
- Format: Static files (HTML, CSS, JS bundles)
- No server-side rendering required

### 1.2 Serverless Functions / API Routes
**Required Capabilities:**
- Node.js runtime environment
- Support for ES Modules (ESM)
- API endpoint routing (e.g., `/api/*`)
- Request/response handling (HTTP methods: GET, POST, PUT, DELETE, OPTIONS)
- CORS header configuration
- Function timeout: Minimum 5 minutes (300 seconds)
- Memory allocation: 512MB - 1GB recommended

**Required API Endpoints:**
- `/api/data/accounts` - Account data operations
- `/api/data/contacts` - Contact data operations
- `/api/data/estimates` - Estimate data operations
- `/api/data/jobsites` - Jobsite data operations
- `/api/data/scorecards` - Scorecard data operations
- `/api/data/templates` - Template data operations
- `/api/google-sheets/write` - Google Sheets integration proxy
- `/api/google-auth/token` - OAuth token handling

### 1.3 Build Environment
**Required Specifications:**
- **Node.js Version:** 16.x or higher (18.x recommended)
- **Package Manager:** npm
- **Build Command:** `npm install && npm run build`
- **Build Tool:** Vite 5.0.8
- **Output Directory:** `dist/`

**Build Process:**
1. Install dependencies via `npm install`
2. Execute build via `npm run build`
3. Output static files to `dist/` directory
4. Deploy static files and serverless functions

---

## 2. Environment Variables

### 2.1 Server-Side Environment Variables
**Required (Not exposed to client):**
- `SUPABASE_URL` - Database connection URL
- `SUPABASE_SERVICE_ROLE_KEY` - Database admin authentication key
- `GOOGLE_SHEETS_WEB_APP_URL` - Google Apps Script Web App endpoint
- `GOOGLE_SHEETS_SECRET_TOKEN` - Secret token for API authentication

**Access Requirements:**
- Must be accessible to serverless functions only
- Must NOT be exposed in client-side JavaScript bundles
- Must support different values per environment (production, staging, development)

### 2.2 Client-Side Environment Variables
**Required (Exposed to client, prefixed with `VITE_`):**
- `VITE_SUPABASE_URL` - Database connection URL (optional)
- `VITE_SUPABASE_ANON_KEY` - Database anonymous key (optional)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID

**Access Requirements:**
- Injected at build time into JavaScript bundles
- Accessible via `import.meta.env.VITE_*` in client code
- Must support different values per environment

### 2.3 Environment Management
**Required Features:**
- Separate environment configurations (production, staging, development)
- Secure storage of sensitive variables
- Ability to update variables without redeployment
- Variable validation and error handling

---

## 3. Network & Security Requirements

### 3.1 SSL/TLS
- **Required:** HTTPS for all traffic
- **Certificate:** Valid SSL/TLS certificate (automated renewal preferred)
- **Protocols:** TLS 1.2 or higher
- **HSTS:** HTTP Strict Transport Security support

### 3.2 CORS Configuration
**Allowed Origins:**
- Production domain (e.g., `https://lecrm.vercel.app`)
- Staging domain (e.g., `https://lecrm-stg.vercel.app`)
- Development domain (e.g., `https://lecrm-dev.vercel.app`)
- Local development: `http://localhost:5173`, `http://localhost:3000`

**Required Headers:**
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`
- `Access-Control-Allow-Credentials` (if needed)

### 3.3 Security Features
- DDoS protection
- Rate limiting on API endpoints
- Request size limits (minimum 10MB for file uploads)
- Secure environment variable storage
- No exposure of sensitive credentials in logs or error messages

---

## 4. Performance Requirements

### 4.1 Static Assets
- CDN distribution for global performance
- Asset caching with appropriate cache headers
- Automatic compression (Gzip/Brotli)
- Image optimization (if applicable)

### 4.2 Serverless Functions
- **Cold Start Time:** < 2 seconds preferred
- **Warm Execution:** < 500ms response time
- **Concurrent Requests:** Support for multiple simultaneous requests
- **Scaling:** Automatic scaling based on demand

### 4.3 Build Performance
- Build time: < 5 minutes for initial build
- Incremental builds: < 3 minutes
- Build caching: Support for dependency caching

---

## 5. Database Connectivity

### 5.1 External Database Service
**Service:** Supabase (PostgreSQL)
- Database hosted externally (not on hosting platform)
- Connection via HTTPS REST API
- Authentication via API keys

**Requirements:**
- Outbound HTTPS connections to Supabase API
- No firewall restrictions on database connections
- Support for long-running queries (up to 5 minutes)

### 5.2 Database Operations
- Read operations (GET requests)
- Write operations (POST/PUT requests)
- Batch operations (multiple records)
- Pagination support for large datasets

---

## 6. Third-Party Service Integration

### 6.1 Google Services
**Required Outbound Connections:**
- Google Apps Script Web App (HTTPS)
- Google OAuth API (HTTPS)
- Google Sheets API (HTTPS)

**Requirements:**
- No firewall restrictions on Google API endpoints
- Support for OAuth redirect flows
- Ability to make POST requests with JSON payloads

### 6.2 External API Calls
- Support for fetch/HTTP client libraries
- Timeout handling (up to 5 minutes)
- Retry logic support
- Error handling and logging

---

## 7. Monitoring & Logging

### 7.1 Required Capabilities
- Application logs (serverless function logs)
- Build logs
- Error tracking
- Performance metrics
- Request/response logging

### 7.2 Log Retention
- Minimum 7 days log retention
- Ability to export logs
- Searchable log interface

---

## 8. Deployment Requirements

### 8.1 Deployment Process
**Required Workflow:**
1. Connect to Git repository (GitHub/GitLab/Bitbucket)
2. Automatic deployment on push to main branch
3. Build process execution
4. Static file deployment
5. Serverless function deployment
6. Environment variable injection

### 8.2 Deployment Environments
**Required Environments:**
- Production
- Staging/Preview
- Development

**Per-Environment Configuration:**
- Separate environment variables
- Separate build outputs
- Separate domains/URLs

### 8.3 Rollback Capability
- Ability to rollback to previous deployments
- Deployment history
- Quick rollback mechanism

---

## 9. Technical Specifications

### 9.1 Application Stack
- **Frontend Framework:** React 18.2.0
- **Routing:** React Router v6
- **Build Tool:** Vite 5.0.8
- **Styling:** Tailwind CSS 3.3.6
- **State Management:** @tanstack/react-query 5.12.0
- **Package Format:** ES Modules (ESM)

### 9.2 Dependencies
- **Total Dependencies:** ~50 production dependencies
- **Build Dependencies:** ~10 dev dependencies
- **Package Manager:** npm
- **Lock File:** package-lock.json

### 9.3 Code Repository
- **Source Control:** Git
- **Repository:** GitHub/GitLab/Bitbucket compatible
- **Branch Strategy:** Main branch for production, feature branches for development

---

## 10. Resource Requirements

### 10.1 Build Resources
- **CPU:** 2+ cores recommended
- **Memory:** 4GB+ RAM for build process
- **Storage:** 500MB+ for dependencies and build artifacts
- **Network:** Stable connection for npm package downloads

### 10.2 Runtime Resources
- **Static Files:** ~5-10 MB (compressed)
- **Serverless Functions:** 512MB - 1GB memory per function
- **Function Timeout:** 5 minutes maximum
- **Concurrent Executions:** Support for multiple simultaneous function invocations

---

## 11. Compliance & Support

### 11.1 Support Requirements
- Technical support for deployment issues
- Documentation for platform features
- Status page for service availability
- Incident response procedures

### 11.2 Service Level Agreement
- Uptime: 99.9% or higher
- Response time for critical issues
- Maintenance windows communication

---

## 12. Migration Considerations

### 12.1 Current Platform
- **Current Host:** Vercel
- **Migration Requirements:**
  - Export current configuration
  - Transfer environment variables
  - Maintain domain/DNS configuration
  - Zero-downtime migration preferred

### 12.2 Compatibility
- Must support Vercel-compatible serverless function format OR
- Provide migration path for serverless functions
- Support for similar API routing structure

---

## 13. Additional Requirements

### 13.1 Custom Domain Support
- Ability to configure custom domains
- SSL certificate provisioning for custom domains
- DNS configuration support
- Subdomain support

### 13.2 Analytics & Monitoring
- Integration with analytics tools (optional)
- Performance monitoring
- Error tracking integration

### 13.3 Backup & Recovery
- Automated backups (if applicable)
- Disaster recovery procedures
- Data retention policies

---

## 14. Questions for Hosting Provider

1. Do you support Node.js serverless functions?
2. What is the maximum function execution time?
3. How are environment variables managed and secured?
4. What is your CORS configuration process?
5. Do you support automatic deployments from Git?
6. What is your SSL certificate management process?
7. What monitoring and logging tools are available?
8. What is your pricing model for serverless functions?
9. Are there any limitations on outbound API calls?
10. What is your support response time for critical issues?

---

## Contact Information

For technical questions regarding these requirements, please contact the development team.

**Document Version:** 1.0  
**Last Updated:** 2024

