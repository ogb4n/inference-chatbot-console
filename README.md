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

- 💬 Interface de chat épurée et responsive
- ⚡ **Streaming temps réel** des réponses (token par token)
- 🔌 Deux protocoles supportés :
  - **Ollama natif** (`/api/chat`, NDJSON)
  - **OpenAI-compatible** (`/v1/chat/completions`, SSE) — Triton, serveur maison…
- ⚙️ **Panneau de réglages** dans l'UI (provider, URL, modèle, clé API, streaming)
  - Presets **Ollama** / **Triton** en un clic
  - Test de connexion + détection automatique des modèles disponibles
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

## Brancher le serveur d'inférence

Tout se configure depuis l'interface via le bouton **⚙ Réglages** — aucun
changement de code requis.

| Serveur | Protocole | URL |
|---|---|---|
| **Ollama** | Ollama (natif) | `http://localhost:11434` |
| **Triton** | OpenAI-compatible | `http://localhost:8000` |
| **Serveur maison** | OpenAI-compatible | URL fournie par l'équipe INFRA |

**Workflow :** ⚙ Réglages → choisir un preset (ou saisir l'URL) → *Tester la
connexion* → sélectionner le modèle → *Enregistrer* → discuter.

> ℹ️ Les requêtes vers le modèle partent du **navigateur**. `localhost` y
> désigne donc votre machine, ce qui fonctionne directement quand Ollama/Triton
> tournent en local — même si l'interface est lancée via Docker.

---

## Structure

```
app/
  layout.tsx        # layout racine + polices + métadonnées
  page.tsx          # point d'entrée
  globals.css       # design system (CSS maison)
components/
  Chat.tsx          # chat, navbar, état de la conversation
  Settings.tsx      # panneau de configuration du serveur
lib/
  api.ts            # couche API (streaming SSE OpenAI + NDJSON Ollama)
  config.ts         # types, presets, persistance de la config
  types.ts          # types partagés
Dockerfile          # build multi-étapes (Next.js standalone)
docker-compose.yml  # service web (+ Ollama optionnel)
```

---

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production (Turbopack, sortie standalone) |
| `npm run start` | Démarrer le build de production |
| `npm run lint` | Linter |
