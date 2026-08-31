# PRAHARI — Deployment Guide

Everything needed to put PRAHARI online for **free**: the Next.js frontend on
**Vercel**, the FastAPI engine on **Render**, and the on-chain anchor contract on
**Polygon Amoy** (a zero-cost testnet). Three of these steps need *your* accounts
and a faucet click — those are marked **[you]**. Everything else is already wired.

> ### v1 stays in production — v2 deploys separately
> The old v1 lives on the **`main`** branch and is left completely untouched.
> Everything here deploys **v2 from the `v2-rebuild` branch as NEW, separate
> projects** — a new Vercel project and a new Render service — so the two run
> side by side and nothing about v1 changes.
> - **Render:** `render.yaml` is pinned to `branch: v2-rebuild` and named
>   `prahari-v2-engine`, so a Blueprint deploy only ever builds v2.
> - **Vercel:** create a **new** project for v2 and set its **Production Branch**
>   to `v2-rebuild` (Settings → Git → Production Branch). Do not reuse the v1
>   project.

---

## 0. What is already prepared (in this repo)

| File | Purpose |
|------|---------|
| `engine/Dockerfile` | Builds the FastAPI engine (Python 3.12) with **Tor** for the live timing demo. |
| `render.yaml` | Render blueprint — free Docker web service, `/health` check. |
| `web/vercel.json` | Next.js build config for Vercel. |
| `.dockerignore` | Keeps `.venv`, `node_modules`, `.next`, `.secrets` out of the image. |
| `web/.env.production.example` | The env vars Vercel needs. |
| `engine/.env.production.example` | The env vars Render needs. |
| `scripts/deploy_amoy.sh` | One-shot contract deploy + anchor + explorer links. |

---

## 1. Push the code to GitHub  **[you may need to authorize]**

The remote is already `github.com/utkarshwrks/Prahari`. From the repo root:

```bash
git add -A && git commit -m "deploy: configs + docs"
git push origin v2-rebuild           # push v2 ONLY — never merge into main
```

Both Vercel and Render deploy v2 from the **`v2-rebuild`** branch. Leave `main`
(v1) alone.

---

## 2. Backend → Render (free)  **[you]**

The engine is a Docker web service. Render's free plan sleeps after ~15 min idle
and cold-starts in ~30–60 s — perfectly fine for a demo.

1. Go to **render.com → New → Blueprint**, pick the `Prahari` repo. Render reads
   `render.yaml` and proposes the `prahari-engine` service. Click **Apply**.
   *(Or: New → Web Service → Docker → set Dockerfile path `engine/Dockerfile`,
   context `.`, plan Free, health check `/health`.)*
2. First build takes ~5–10 min (it installs scipy/sklearn/spacy/Tor). When it is
   live you get a URL like `https://prahari-engine.onrender.com`.
3. Test it: open `https://prahari-engine.onrender.com/health` → `{"ok": true …}`.

**Env vars** (already defaulted in `render.yaml`, override in the dashboard if
needed): `ENVIRONMENT=production`, `RPC_URL`, `CHAIN_ID=80002`, `CORS_ORIGINS=*`.
Add `ANCHORER_KEY=0x…` **only** if you want the deployed engine to seal on-chain
(see §4); never commit that key.

> Free-tier note: the engine imports scipy/sklearn/spacy, which is heavy for a
> 512 MB instance. It boots fine; if a specific ML endpoint OOMs under load, bump
> to Render's cheapest paid instance or disable that endpoint. The core workbench,
> fusion, ledger and Tor demo run within free limits.

---

## 3. Frontend → Vercel (free)  **[you]**

1. Go to **vercel.com → Add New → Project**, import the `Prahari` repo.
2. **Set Root Directory to `web`** (it is a monorepo). Framework auto-detects as
   Next.js.
3. Add **Environment Variables** (Settings → Environment Variables):
   - `ENGINE_URL` = your Render URL, e.g. `https://prahari-engine.onrender.com`
     *(server-side only — the browser never sees it)*
   - `NEXTAUTH_SECRET` = a strong random string → `openssl rand -base64 32`
   - `NEXTAUTH_URL` = your Vercel URL, e.g. `https://prahari.vercel.app`
4. **Deploy.** Done — open the Vercel URL, click **Open workbench**, sign in with
   the pre-filled demo analyst account.

> The app refuses to start in production without `NEXTAUTH_SECRET` — that is by
> design. Set it before the first deploy.

---

## 4. On-chain anchor contract → Polygon Amoy  **[you fund, then one command]**

The whole system is **zero-gas for users**: one backend wallet anchors every case
Merkle root, funded once from a free faucet. That wallet is already generated:

```
Anchorer address:  0x31EdD0021A09f0B32f7dfeb08B58622c75591991
Status:            NOT FUNDED yet (balance 0)
```

### 4a. Get free testnet POL  **[you — needs a captcha/wallet, I can't do this step]**

Claim **Amoy POL** to the address above from any of these (use one or two):

- **https://faucet.polygon.technology** → select **Amoy**, token **POL**, paste
  the address, submit.
- **https://www.alchemy.com/faucets/polygon-amoy** (needs a free Alchemy login).
- **https://faucets.chain.link/polygon-amoy**

One claim (~0.5–1 POL) is *far* more than enough (see the budget below).

### 4b. Deploy + anchor (one command)

Foundry is installed. Once the address shows a balance:

```bash
./scripts/deploy_amoy.sh
```

It deploys `PrahariAnchor`, anchors a real case root, and prints:

```
CONTRACT : https://amoy.polygonscan.com/address/0x…
ANCHOR TX: https://amoy.polygonscan.com/tx/0x…
```

### 4c. Point the engine at the contract

Set on Render (or in `engine/.env`): `CONTRACT_ADDR=<deployed address>`,
`RPC_URL=https://rpc-amoy.polygon.technology`, `CHAIN_ID=80002`, and
`ANCHORER_KEY=<the funded key>`. Now the Ledger panel’s **Seal** button writes a
real, publicly verifiable anchor and shows the explorer link.

---

## 5. Budget — demoing 100+ times

Amoy is a **testnet**: POL there has no monetary value and is free to top up.

| Action | Gas (approx) | Cost @ ~30 gwei |
|--------|--------------|-----------------|
| Deploy `PrahariAnchor` (once) | ~600k | ~0.02 POL |
| One anchor/seal (per demo) | ~55k | ~0.0017 POL |
| **100 seals** | ~5.5M | **~0.17 POL** |

So **one faucet claim covers the deploy plus 100+ full demos** with room to spare.
If you ever run low, claim again — it is free. And note: the **workbench demo
itself runs unlimited times for free** — only the *public on-chain seal* spends
test-POL; everything else (attribution, evidence trail, Tor timing, chain flow,
the local tamper-evident ledger) is entirely gas-free.

---

## 6. One-look summary

```
[you] fund 0x31EdD0…1991 with Amoy POL   →   ./scripts/deploy_amoy.sh
[you] Render  ← engine/Dockerfile + render.yaml   →   ENGINE_URL
[you] Vercel  ← root dir "web" + ENGINE_URL/NEXTAUTH_SECRET/NEXTAUTH_URL
        live at https://<your-app>.vercel.app
```

Nothing here costs money. The only human-gated steps are creating the Vercel/
Render accounts and the faucet click — an assistant cannot create accounts, grant
OAuth, or solve a faucet captcha on your behalf, so those three clicks are yours;
every file, command and env var they need is above.
