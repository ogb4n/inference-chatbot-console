# Inference Console

Interface web de chat pour **tester un modèle de langage** servi par un serveur
d'inférence — Ollama, Triton ou un serveur maison. Intégration API en **temps
réel** (streaming), réglages configurables directement depuis l'interface.

> Projet hackathon — équipe FRONT. S'interface avec le serveur d'inférence
> fourni par l'équipe INFRA.

---

## Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** (strict)
- **Turbopack** (dev & build)
- **Docker** (image standalone + docker-compose)
- Aucune dépendance UI externe — CSS maison

---

## Fonctionnalités

- 🔐 **Authentification** : inscription / connexion, mots de passe hachés
  (bcrypt), sessions JWT en cookie httpOnly, routes protégées par middleware
- 💬 Interface de chat épurée et responsive
- 🗂️ **Historique multi-conversations lié au compte** : barre latérale pour
  créer, reprendre et supprimer des conversations (stockées **côté serveur**,
  synchronisées entre appareils, titre auto)
- ⚡ **Streaming temps réel** des réponses (token par token)
- 🔌 Deux protocoles supportés :
  - **Ollama natif** (`/api/chat`, NDJSON)
  - **OpenAI-compatible** (`/v1/chat/completions`, SSE) — Triton, serveur maison…
- 🛡️ **Proxy serveur intégré** (`/api/chat`) : pas de CORS, clé d'API gardée
  côté serveur (jamais exposée au navigateur), injection du header `X-API-Key`
- ⚙️ **Panneau de réglages** dans l'UI (protocole, modèle, streaming)
  - Détection automatique des modèles disponibles
  - Configuration persistée (localStorage)
- 🐳 Dockerisé, prêt à déployer

---

## Démarrage rapide

### Option A — Local (développement)

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000

### Option B — Docker

```bash
docker compose up -d --build
```

Ouvrir http://localhost:3000

Arrêter :

```bash
docker compose down
```

---

## Architecture (proxy serveur)

```
Navigateur ──► /api/chat (même origine, Next.js)  ──►  serveur d'inférence
                 │ ajoute X-API-Key                     (Ollama / Triton / maison)
                 │ relaie le flux
```

Le navigateur n'appelle **jamais** directement le serveur d'inférence : il passe
par le proxy `/api/chat` servi par Next.js (même origine). Avantages :

- **Pas de CORS** (même origine).
- **Clé d'API jamais exposée** au navigateur — injectée côté serveur en header
  `X-API-Key`.
- Fonctionne derrière un reverse-proxy d'authentification (ex. Caddy + clé).

### Configuration

L'URL et la clé du serveur sont des **variables d'environnement serveur**
(`.env`, lu par docker compose) :

| Variable | Description | Exemple |
|---|---|---|
| `INFERENCE_BASE_URL` | URL du serveur **vue depuis le conteneur** | `http://host.docker.internal:11434` |
| `INFERENCE_API_KEY` | Clé envoyée en header `X-API-Key` | `clef-equipe-devweb` |
| `AUTH_SECRET` | Secret de signature des sessions (**obligatoire**) | `openssl rand -hex 32` |
| `COOKIE_SECURE` | `true` seulement derrière HTTPS | `false` |

Le **protocole** (Ollama / OpenAI) et le **modèle** se choisissent dans l'UI via
**⚙ Réglages** (avec détection automatique des modèles disponibles).

```bash
cp .env.example .env      # puis renseigner INFERENCE_BASE_URL et INFERENCE_API_KEY
docker compose up -d --build
```

> ℹ️ `host.docker.internal` permet au conteneur d'atteindre un port publié sur la
> machine hôte. Si ça ne passe pas, voir le bloc « ALTERNATIVE réseau » commenté
> dans `docker-compose.yml` (rattachement direct au réseau de la stack Ollama).

---

## Structure

```
app/
  api/
    auth/           # register / login / logout / me
    chat/route.ts   # PROXY serveur : injecte X-API-Key, relaie le flux
    models/route.ts # proxy liste des modèles
    conversations/  # CRUD des conversations (par utilisateur)
  login/page.tsx    # page de connexion / inscription
  layout.tsx        # layout racine + polices + métadonnées
  page.tsx          # point d'entrée (chat, protégé)
  globals.css       # design system (CSS maison)
components/
  Chat.tsx          # chat, navbar, gestion des conversations
  Sidebar.tsx       # liste des conversations (créer / sélectionner / supprimer)
  Settings.tsx      # panneau de configuration (protocole / modèle)
lib/
  api.ts            # couche API client (parse SSE OpenAI + NDJSON Ollama)
  auth.ts           # hachage bcrypt + sessions JWT (jose) + cookies
  db.ts             # base SQLite (better-sqlite3)
  config.ts         # types + persistance de la config UI
  conversations.ts  # accès API des conversations
  types.ts          # types partagés
middleware.ts       # protège les pages (redirige vers /login)
Dockerfile          # build multi-étapes (Next.js standalone)
docker-compose.yml  # service web + volume base de données
.env.example        # variables serveur (inférence + auth)
```

## Authentification

- Première visite → redirection vers **/login** (création de compte possible).
- Mots de passe **hachés (bcrypt)**, jamais stockés en clair.
- Session = **JWT signé** (`AUTH_SECRET`) dans un cookie **httpOnly**.
- Toutes les routes (page chat, `/api/chat`, `/api/conversations`…) exigent une
  session valide.
- Les conversations sont **stockées en base par utilisateur** (SQLite, dans le
  volume Docker `app-data` → persistant entre redéploiements).

> ⚠️ Définis impérativement `AUTH_SECRET` (`openssl rand -hex 32`). Sans HTTPS,
> garde `COOKIE_SECURE=false` sinon le cookie de session ne sera pas transmis.

---

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production (Turbopack, sortie standalone) |
| `npm run start` | Démarrer le build de production |
| `npm run lint` | Linter |
