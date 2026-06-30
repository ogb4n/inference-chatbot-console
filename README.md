# Inference Console

Interface web de chat pour **tester un modèle de langage** servi par un serveur
d'inférence (Ollama, Triton, ou serveur maison). Comptes utilisateurs,
historique de conversations, streaming temps réel — le tout dockerisé.

> Projet hackathon — équipe DEV WEB. S'interface avec le serveur d'inférence
> fourni par l'équipe INFRA.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Stack technique](#stack-technique)
4. [Mise en place de la stack](#mise-en-place-de-la-stack)
5. [Se connecter](#se-connecter)
6. [Utiliser le service](#utiliser-le-service)
7. [Brancher le serveur d'inférence](#brancher-le-serveur-dinférence)
8. [Exploitation](#exploitation-logs-base-secrets)
9. [Développement local](#développement-local)
10. [Structure du projet](#structure-du-projet)

---

## Fonctionnalités

- 🔐 **Authentification** : inscription / connexion, mots de passe hachés
  (bcrypt), sessions JWT en cookie httpOnly.
- 💬 **Chat** épuré et responsive, **streaming temps réel** (token par token).
- 🗂️ **Historique multi-conversations lié au compte** : créer, reprendre et
  supprimer des conversations, stockées **côté serveur** (synchronisées entre
  appareils), titre auto.
- 🔌 **Deux protocoles** : Ollama natif (`/api/chat`) et OpenAI-compatible
  (`/v1/chat/completions`, ex. Triton).
- 🛡️ **Proxy serveur intégré** : pas de CORS, clé d'API gardée côté serveur.
- ⚙️ **Réglages dans l'UI** : protocole, modèle (avec détection automatique),
  streaming.
- 🐳 **Dockerisé**, prêt à déployer.

---

## Architecture

```
                         CONTENEUR Docker "web" (Next.js)
                    ┌───────────────────────────────────────┐
   Navigateur ───►  │  Pages (login / chat)                 │
                    │  /api/auth/*      → SQLite (comptes)   │
                    │  /api/conversations → SQLite           │
                    │  /api/chat  ──┐                        │
                    └───────────────┼───────────────────────┘
                                    │ + header X-API-Key
                                    ▼
                         Serveur d'inférence (Ollama / Triton / maison)
```

Points clés :

- **Le navigateur ne parle jamais directement au serveur d'inférence.** Il passe
  par le proxy `/api/chat` (même origine) → **pas de CORS**, et la **clé d'API
  reste côté serveur** (injectée en header `X-API-Key`).
- **Une seule base SQLite embarquée** (pas de conteneur DB séparé), persistée
  dans un volume Docker.
- **Contrôle d'accès côté serveur** : toute page et toute route API exige une
  session valide.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Langage | TypeScript (strict) |
| Bundler | Turbopack (dev & build) |
| Base de données | SQLite (`better-sqlite3`) — fichier dans un volume |
| Auth | `bcryptjs` (hachage) + `jose` (JWT) + cookie httpOnly |
| Conteneurisation | Docker (image standalone) + docker-compose |
| UI | CSS maison, aucune dépendance UI externe |

---

## Mise en place de la stack

### Prérequis

- **Docker** + **Docker Compose** sur la machine hôte.
- Un **serveur d'inférence** accessible (Ollama, Triton, ou maison).

### 1. Récupérer le code

```bash
git clone git@github.com:ogb4n/inference-chatbot-console.git
cd inference-chatbot-console
```

### 2. Configurer l'environnement

Copier l'exemple et renseigner les valeurs :

```bash
cp .env.example .env
```

| Variable | Description | Exemple |
|---|---|---|
| `INFERENCE_BASE_URL` | URL du serveur d'inférence **vue depuis le conteneur** | `http://host.docker.internal:11434` |
| `INFERENCE_API_KEY` | Clé envoyée en header `X-API-Key` (si le serveur l'exige) | `83071786da…` |
| `AUTH_SECRET` | **Obligatoire.** Secret de signature des sessions | `openssl rand -hex 32` |
| `COOKIE_SECURE` | `true` uniquement derrière HTTPS ; sinon `false` | `false` |

Générer le secret d'auth rapidement :

```bash
echo "AUTH_SECRET=$(openssl rand -hex 32)" >> .env
```

> ⚠️ `AUTH_SECRET` doit être défini, sinon l'app utilise un secret par défaut non
> sécurisé. Ne le change plus une fois en production (sinon toutes les sessions
> sont invalidées). En HTTP (sans TLS), garde `COOKIE_SECURE=false`.

### 3. Lancer

```bash
docker compose up -d --build
```

L'app est servie sur **http://localhost:3000** (ou `http://<IP-du-serveur>:3000`).

### 4. Vérifier

```bash
docker compose ps                    # le conteneur "web" doit être Up
docker exec inference-console env | grep -E 'AUTH_SECRET|INFERENCE'
```

---

## Se connecter

1. Ouvrir l'app dans le navigateur → tu es **redirigé vers `/login`**.
2. Cliquer sur **« Inscription »**, saisir un **email** + un **mot de passe**
   (6 caractères minimum) → **« Créer mon compte »**.
3. Tu es connecté et redirigé vers le chat. La session dure **7 jours**.
4. Pour revenir plus tard : même page, **« Se connecter »** avec tes identifiants.
5. **Déconnexion** : bouton en haut à droite.

> Chaque utilisateur a ses propres conversations. Les mots de passe sont hachés
> (bcrypt) — jamais stockés en clair.

---

## Utiliser le service

### Choisir le modèle (⚙ Réglages)

En haut à droite, **⚙ Réglages** ouvre le panneau de configuration :

- **Protocole** : `Ollama (natif)` ou `OpenAI-compatible`.
- **Modèle** : nom du modèle (ex. `phi3.5`). Le bouton **« Détecter les
  modèles »** interroge le serveur et propose les modèles disponibles en
  autocomplétion.
- **Streaming** : afficher la réponse mot à mot (recommandé) ou d'un bloc.

Ces réglages sont mémorisés dans le navigateur. Le badge en haut indique le
protocole et le modèle actifs.

### Discuter

- Tape ton message, **Envoyer** (ou Entrée). La réponse s'affiche en temps réel.
- En cas de souci, un message d'erreur précis apparaît sous le champ de saisie.

### Gérer les conversations (barre latérale)

- **+ Nouvelle conversation** : démarrer un fil vierge.
- **Cliquer** sur une conversation : la rouvrir avec tout son historique.
- **× au survol** : supprimer une conversation.
- Le **titre** est généré automatiquement à partir du premier message.
- Sur mobile, la barre latérale s'ouvre via le bouton **☰**.

---

## Brancher le serveur d'inférence

Le protocole et le modèle se choisissent dans l'UI ; **l'URL et la clé** sont des
variables d'environnement serveur (`.env`).

| Serveur | `INFERENCE_BASE_URL` | Protocole (UI) |
|---|---|---|
| **Ollama** (sur l'hôte) | `http://host.docker.internal:11434` | Ollama |
| **Triton** (sur l'hôte) | `http://host.docker.internal:8000` | OpenAI-compatible |
| **Serveur maison** | URL fournie par l'INFRA | selon le serveur |

> ℹ️ `host.docker.internal` permet au conteneur d'atteindre un port publié sur la
> machine hôte. C'est nécessaire car le proxy tourne **dans** le conteneur.

### Si le serveur exige une clé d'API

Renseigne `INFERENCE_API_KEY` : le proxy l'envoie en header `X-API-Key` (et
`Authorization: Bearer` en repli). La clé n'est jamais exposée au navigateur.

### Tester la connectivité depuis le conteneur

```bash
# Ollama (adapter la clé / l'URL)
docker exec inference-console sh -c \
  'wget -qO- --header="X-API-Key: TA_CLE" http://host.docker.internal:11434/api/tags'
```

- ✅ liste de modèles → tout est bon.
- ❌ timeout → `host.docker.internal` n'atteint pas le port. Voir l'alternative
  réseau ci-dessous.

### Alternative réseau (si `host.docker.internal` ne passe pas)

Si le serveur d'inférence tourne dans une **autre stack Docker**, rattache ce
service à son réseau (bloc commenté dans `docker-compose.yml`) et vise le service
directement, ex. `INFERENCE_BASE_URL=http://caddy:8080`.

---

## Exploitation (logs, base, secrets)

### Logs

```bash
docker compose logs -f web
```

### Base de données

La base SQLite vit dans le volume `app-data` (monté sur `/app/data`). Elle est
**créée automatiquement** au premier démarrage et **persiste** aux rebuilds.

```bash
docker exec inference-console ls -la /app/data    # app.db
docker volume ls | grep app-data                  # nom du volume
```

**Réinitialiser** la base (⚠️ efface comptes + conversations) :

```bash
docker compose down -v        # supprime le volume
docker compose up -d          # base vide recréée
```

> Un simple `docker compose down` (sans `-v`) **conserve** les données.

### Mettre à jour le déploiement

```bash
git pull
docker compose up -d --build
```

---

## Développement local

Sans Docker (Node 22+ requis) :

```bash
npm install
# Renseigner les variables d'env (ex. dans .env.local) :
#   INFERENCE_BASE_URL, INFERENCE_API_KEY, AUTH_SECRET, DATABASE_PATH=./data/app.db
npm run dev      # http://localhost:3000 (Turbopack)
```

> Sous Windows, l'installation de `better-sqlite3` peut nécessiter des outils de
> build (Visual Studio Build Tools). Le build Docker, lui, compile sans souci.

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production (standalone) |
| `npm run start` | Démarrer le build de production |
| `npm run lint` | Linter |

---

## Structure du projet

```
app/
  api/
    auth/             # register / login / logout / me
    chat/route.ts     # PROXY serveur : injecte X-API-Key, relaie le flux
    models/route.ts   # proxy liste des modèles
    conversations/    # CRUD des conversations (par utilisateur)
  login/page.tsx      # page connexion / inscription (protégée serveur)
  page.tsx            # chat (protégé serveur)
  layout.tsx          # layout racine + polices
  globals.css         # design system (CSS maison)
components/
  Chat.tsx            # chat, navbar, gestion des conversations
  Sidebar.tsx         # liste des conversations
  Settings.tsx        # panneau de configuration (protocole / modèle)
  LoginForm.tsx       # formulaire connexion / inscription
lib/
  api.ts              # couche API client (parse SSE OpenAI + NDJSON Ollama)
  auth.ts             # hachage bcrypt + sessions JWT (jose) + cookies
  db.ts               # base SQLite (better-sqlite3)
  config.ts           # config UI (protocole / modèle)
  conversations.ts    # accès API des conversations
  types.ts            # types partagés
Dockerfile            # build multi-étapes (Next.js standalone)
docker-compose.yml    # service web + volume base de données
.env.example          # variables serveur (inférence + auth)
```
