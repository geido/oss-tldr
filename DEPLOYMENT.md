# 🚀 OSS TL;DR Deployment Guide

Deploy your demo in **~15 minutes** with Railway + Vercel (both free tiers).

## Prerequisites
- GitHub account
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- [Railway](https://railway.app) account (free)
- [Vercel](https://vercel.com) account (free)

---

## Step 1: Deploy Backend to Railway (5 min)

1. **Go to [Railway](https://railway.app) → New Project → Deploy from GitHub repo**
2. **Select your OSS TL;DR repository, set root directory to `backend`**
3. **Set Environment Variables in Railway dashboard:**
   ```bash
   GITHUB_CLIENT_ID=temp_will_update_later
   GITHUB_CLIENT_SECRET=temp_will_update_later
   OPENAI_API_KEY=your_openai_api_key_here
   JWT_SECRET=your_very_secure_random_string_32_chars
   JWT_ALGORITHM=HS256
   JWT_EXPIRE_HOURS=24
   FRONTEND_URL=temp_will_update_later
   ALLOWED_ORIGINS=temp_will_update_later
   ```
4. **Deploy and save your Railway URL** (e.g., `https://oss-tldr-backend-production.railway.app`)

---

## Step 2: Create GitHub OAuth App (2 min)

1. **Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)**
2. **Click "New OAuth App":**
   - **Application name:** `OSS TL;DR Demo`
   - **Homepage URL:** `temp_will_update_later`
   - **Authorization callback URL:** `temp_will_update_later/auth/callback`
3. **Save Client ID and Client Secret** (you'll need these next)

---

## Step 3: Deploy Frontend to Vercel (3 min)

1. **Go to [Vercel](https://vercel.com) → New Project → Import from GitHub**
2. **Select your OSS TL;DR repository, set root directory to `frontend`**
3. **Set Environment Variable:**
   ```bash
   VITE_API_BASE_URL=https://your-railway-url.railway.app/api/v1
   ```
4. **Deploy and save your Vercel URL** (e.g., `https://oss-tldr-demo.vercel.app`)

---

## Step 4: Update URLs and Secrets (2 min)

### Update Railway Environment Variables:
```bash
GITHUB_CLIENT_ID=your_actual_github_client_id
GITHUB_CLIENT_SECRET=your_actual_github_client_secret
FRONTEND_URL=https://your-vercel-url.vercel.app
ALLOWED_ORIGINS=https://your-vercel-url.vercel.app,http://localhost:5173
```

### Update GitHub OAuth App:
- **Homepage URL:** `https://your-vercel-url.vercel.app`
- **Authorization callback URL:** `https://your-vercel-url.vercel.app/auth/callback`

---

## Step 5: Test Your Demo (1 min)

1. Visit your Vercel URL
2. Click "Login with GitHub"
3. Authorize the app
4. Try adding a repository and generating a TL;DR

🎉 **Your demo is live!**

---

## 🔧 Development vs Production

Your local development setup remains unchanged:
```bash
# Development (hot reload, dev dependencies)
docker-compose up

# Test production build locally
docker-compose -f docker-compose.prod.yml up
```

The Dockerfile automatically uses:
- **Development stage** for local Docker Compose
- **Production stage** for Railway deployment

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend not starting | Check Railway logs, verify OpenAI API key |
| Frontend can't connect | Verify `VITE_API_BASE_URL` matches Railway URL |
| GitHub OAuth failing | Verify callback URL matches exactly, check Client ID/Secret |
| CORS errors | Ensure `ALLOWED_ORIGINS` includes your Vercel URL |

---

## 💰 Cost Estimate

- **Railway:** Free tier (500 hours/month)
- **Vercel:** Free tier (unlimited static deployments)  
- **OpenAI API:** ~$0.01-0.10 per TL;DR
- **Total:** Essentially **free for demos**

---

## 🔄 Alternative Platforms

**Backend:** Render, Fly.io, Google Cloud Run, AWS ECS  
**Frontend:** Netlify, GitHub Pages, Cloudflare Pages

**Why Railway + Vercel?** Best GitHub integration, generous free tiers, zero config needed.