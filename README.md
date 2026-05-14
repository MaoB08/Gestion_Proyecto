# Gestion Proyecto — Monorepo

Plataforma de gestión educativa con aulas en vivo, transcripción mediante IA (Gemini), tracking de atención, analítica geoespacial, demográfica y gestión integral para roles de Admin / Profesor / Estudiante.

## Estructura del proyecto

```
Gestion_Proyecto/
├── frontend/          # Vite + React SPA
├── backend/           # Node.js + Express + Mongoose API
├── package.json       # Scripts de orquestación raíz
├── docker-compose.yml # Orquestación Docker (opcional)
└── .gitignore
```

---

## Inicio rápido (sin Docker)

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd Gestion_Proyecto

# Instalar dependencias de ambos workspace
npm run install:all

# O por separado:
cd frontend && npm install
cd ../backend && npm install
```

### 2. Configurar variables de entorno del backend

```bash
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores reales:
#   MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>
#   GEMINI_API_KEY=...
#   PORT=3001
```

> ⚠️ **Nunca** subas el archivo `.env` a Git. Está bloqueado en `.gitignore`.

### 3. Arrancar en modo desarrollo

Ambos servicios a la vez (requiere `concurrently`):

```bash
npm install        # instala concurrently en raíz
npm run dev        # arranca frontend en :5173 y backend en :3001
```

O por separado:

```bash
npm run dev:frontend   # http://localhost:5173
npm run dev:backend    # http://localhost:3001
```

---

## Inicio con Docker Compose

```bash
# Copia y edita las variables de entorno
cp backend/.env.example .env
# (el docker-compose las lee desde la raíz)

docker compose up --build
```

Servicios disponibles:
| Servicio  | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:5173        |
| Backend   | http://localhost:3001        |
| MongoDB   | mongodb://localhost:27017    |

---

## API REST (Backend)

Base URL: `http://localhost:3001/api`

| Recurso   | Métodos principales                          |
|-----------|----------------------------------------------|
| `/users`  | GET, POST, PUT, DELETE, POST `/login`        |
| `/courses`| GET, POST, PUT, DELETE, enroll/unenroll      |
| `/classes`| GET, POST, activate/deactivate, join/leave, transcription, summary, questions |
| `/health` | GET — health check                           |

---

## Variables de entorno del backend

| Variable       | Descripción                        | Ejemplo               |
|----------------|------------------------------------|-----------------------|
| `MONGO_URI`    | URI de conexión MongoDB            | `mongodb+srv://...`   |
| `GEMINI_API_KEY` | API key de Google Gemini         | `AIza...`             |
| `PORT`         | Puerto del servidor Express        | `3001`                |
| `CORS_ORIGIN`  | Origen permitido (frontend URL)    | `http://localhost:5173` |
| `NODE_ENV`     | Entorno de ejecución               | `development`         |

---

## Tecnologías

| Capa      | Stack                              |
|-----------|------------------------------------|
| Frontend  | Vite 5, React 19, CSS vanilla      |
| Backend   | Node.js 18+, Express 4, Mongoose 8 |
| Base de datos | MongoDB Atlas (o local con Docker) |
| IA        | Google Gemini 1.5 Flash            |
