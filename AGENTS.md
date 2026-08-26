<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🏛️ My WiFi Ecosystem Architecture & Documentation Rules

This project is part of a 3-project interconnected ecosystem:
1. `microtik`: Main Web Admin Portal & Central API Backend (`https://microtik-nine.vercel.app`)
2. `microtik-sales-report`: Sales Analytics, Master Data & Accounting Dashboard
3. `microtik-mobileapp`: Mobile POS & Operator App (Expo React Native)

### Mandatory Agent Directives:
1. **Always Read First**: Before making architectural decisions, adding APIs, or altering data schemas, read `system_architecture_summary.md` in the project root.
2. **Keep Documentation in Sync**: Whenever you implement new business concepts, modify database tables, add API endpoints, or change deployment settings, you MUST update `system_architecture_summary.md` across the projects to keep the ecosystem documentation 100% up-to-date.
