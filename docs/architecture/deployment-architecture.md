# Deployment Architecture

## Deployment Strategy

**Local Development (MVP):**

- Platform: Local machine
- Build Command: `pnpm build`
- Deployment Method: Direct Node.js execution

**Future Cloud Deployment:**

- Frontend: Vercel
- Backend: Railway/Render
- Database: Supabase/Neon
- Cache: Upstash Redis

## CI/CD Pipeline

[GitHub Actions workflow included above]

## Environments

| Environment | Frontend URL          | Backend URL               | Purpose                |
| ----------- | --------------------- | ------------------------- | ---------------------- |
| Development | http://localhost:3000 | http://localhost:3000/api | Local development      |
| Staging     | TBD                   | TBD                       | Pre-production testing |
| Production  | TBD                   | TBD                       | Live environment       |
