# 🤖 AI Alt Text Generator — Shopify App

Generate SEO-friendly alt text for all your product images using Claude AI.
Priced at $2.99/month with a 25-image free tier.

---

## 🚀 Quick Start (Step by Step)

### Step 1: Create App in Shopify Partner Dashboard
1. Go to https://partners.shopify.com
2. Click **Apps** → **Create app** → **Create app manually**
3. Name it: "AI Alt Text Generator"
4. Copy the **API key** and **API secret**

### Step 2: Set Up Claude API
1. Go to https://console.anthropic.com
2. Create account → **API Keys** → **Create key**
3. Copy your API key

### Step 3: Install & Configure
```bash
# Clone/download this project
cd shopify-alt-text-ai

# Install dependencies
npm install

# Copy env file
cp .env.example .env

# Fill in your .env file with:
# - SHOPIFY_API_KEY (from Step 1)
# - SHOPIFY_API_SECRET (from Step 1)
# - ANTHROPIC_API_KEY (from Step 2)
# - SHOPIFY_APP_URL (your Railway URL after deploy)

# Set up database
npx prisma generate
npx prisma migrate dev --name init

# Run locally
npm run dev
```

### Step 4: Deploy to Railway (cheapest hosting)
1. Go to https://railway.app — sign up free
2. Click **New Project** → **Deploy from GitHub**
3. Connect your GitHub and push this code
4. Add environment variables in Railway dashboard
5. Your app URL will be: `https://your-app-name.railway.app`
6. Update `SHOPIFY_APP_URL` in Railway env vars

### Step 5: Submit to Shopify App Store
1. In Shopify Partner Dashboard → your app → **Distribution**
2. Click **Shopify App Store**
3. Fill in app listing details (use the marketing copy below)
4. Submit for review (~3-5 business days)

---

## 💰 Revenue Model

| Plan | Price | Limit |
|------|-------|-------|
| Free | $0 | 25 images/month |
| Pro | $2.99/month | Unlimited |

Shopify takes 15% → you keep **$2.54/month per pro user**

| Pro Users | Monthly Revenue |
|-----------|----------------|
| 100 | $254 |
| 500 | $1,270 |
| 1,000 | $2,540 |
| 2,000 | $5,080 |

---

## 📝 App Store Listing Copy

**App name:** AI Alt Text Generator — SEO Images

**Tagline:** Auto-generate SEO alt text for all product images with AI

**Description:**
Missing alt text is silently killing your Shopify store's SEO.

Google can't see your product images — it reads alt text to understand them. 
Most Shopify stores have hundreds of images with no alt text at all.

AI Alt Text Generator fixes this in minutes, not hours.

✅ Scans all product images instantly
✅ Claude AI writes accurate, SEO-optimised alt text for each image  
✅ Review and edit before applying anything
✅ One-click apply to your entire store
✅ 25 free images/month — upgrade for unlimited

**Keywords:** alt text, SEO, accessibility, product images, image optimization

---

## 🗂️ File Structure

```
shopify-alt-text-ai/
├── app/
│   ├── routes/
│   │   ├── app.jsx              # App layout + nav
│   │   ├── app._index.jsx       # Dashboard
│   │   ├── app.scan.jsx         # Core feature — scan & generate
│   │   ├── app.pricing.jsx      # Pricing page + billing
│   │   ├── app.history.jsx      # History of generated alt texts
│   │   └── app.billing.confirm.jsx  # Billing confirmation
│   ├── services/
│   │   ├── claude.server.js     # Claude AI integration
│   │   ├── shopify.server.js    # Shopify GraphQL queries
│   │   └── usage.server.js      # Usage tracking + billing
│   ├── db.server.js             # Database client
│   ├── root.jsx                 # App root
│   └── shopify.server.js        # Shopify app config
├── prisma/
│   └── schema.prisma            # Database schema
├── shopify.app.toml             # Shopify app config
├── vite.config.js               # Vite config
├── package.json
└── .env.example                 # Environment variables template
```

---

## 🛠️ Tech Stack

- **Framework:** Remix + Shopify App Bridge
- **UI:** Shopify Polaris
- **AI:** Claude claude-sonnet-4-20250514 (Anthropic)
- **Database:** SQLite (dev) / PostgreSQL (production)
- **ORM:** Prisma
- **Hosting:** Railway ($5/month)
- **Billing:** Shopify Subscription API

---

## 📞 Support

Built by Talha Riaz — Shopify Developer
- Upwork: https://www.upwork.com/freelancers/~01fcf2ef053129ae93
- LinkedIn: https://www.linkedin.com/in/abutalha508/
# deployed
