# Documentation

## Final documents (4 November 2026)

| Document | Audience | Files |
| --- | --- | --- |
| User Guide | Buyers, suppliers and admins | [Markdown](final/User_Guide.md), [PDF](final/User_Guide.pdf) |
| Functional Specification | Product, design, QA and business reviewers | [Markdown](final/Functional_Specification.md), [PDF](final/Functional_Specification.pdf) |
| Technical Specification | Engineers maintaining the code | [Markdown](final/Technical_Specification.md), [PDF](final/Technical_Specification.pdf) |

These describe the product as built and take priority where older documents below disagree. `npm run docs:screenshots` recaptures the screenshots (with the app running) and `npm run docs:pdf` rebuilds the PDFs and diagrams.

## Working documents

| Document | What it covers |
| --- | --- |
| [USER_GUIDE.md](USER_GUIDE.md) | Demo accounts and a walkthrough for each role |
| [USER_STORIES.md](USER_STORIES.md) | The stories the product was built from, by role |
| [DISCOVERY.md](DISCOVERY.md) | Scope, users and the main decisions made before the build |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the app is put together: routes, data access, AI and hosting |
| [DATA_MODEL.md](DATA_MODEL.md) | Tables, relationships and Row Level Security |
| [RPC_CONTRACT.md](RPC_CONTRACT.md) | The database functions that make every write |
| [API.md](API.md) | Server actions and route handlers |
| [AI_DESIGN.md](AI_DESIGN.md) | Tradelink AI: agents, cards, notifications and jobs |
| [SECURITY.md](SECURITY.md) | Threat model, permissions and security controls |
| [TEST_PLAN.md](TEST_PLAN.md) | What is tested and how |
| [adr/](adr/README.md) | Architecture decision records |

Older migrations and some code comments cite `AI_DESIGN.md` by its former name, `docs/PLAN.md`. Applied migrations are never edited, so those references stay as they are.
