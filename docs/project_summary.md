# 📘 Resumen Técnico del Proyecto — ClassAI / Gestion_Proyecto

> Documento de referencia para cualquier IA o desarrollador que necesite entender y modificar el proyecto.

---

## 1. Visión General

**ClassAI** es una plataforma de gestión académica web que permite a administradores, profesores y estudiantes gestionar cursos, clases en vivo, asistencia e interacciones mediante IA (Gemini). El proyecto vive en un monorepo:

```
Gestion_Proyecto/
├── backend/         # API REST — Node.js + Express + Mongoose
├── frontend/        # SPA — React 19 + Vite
├── package.json     # Scripts raíz (concurrently)
└── docker-compose.yml
```

---

## 2. Infraestructura y Stack

| Capa | Tecnología |
|---|---|
| Runtime backend | Node.js ≥ 18 |
| Framework HTTP | Express 4 |
| ODM | Mongoose 8 |
| Base de datos | MongoDB Atlas (cluster `ClusterProyect0`) |
| Hashing passwords | bcryptjs |
| Frontend framework | React 19 |
| Bundler | Vite 5 |
| Estilos | Vanilla CSS (`index.css`) — sin Tailwind |
| Estado global | React Context (`AppContext`) + `localStorage` |
| IA / sumario | Google Gemini API (opcional) |

### Variables de entorno backend (`backend/.env`)
```
MONGO_URI=mongodb+srv://...@clusterproyect0.du8akfa.mongodb.net/gestion_proyecto?retryWrites=true&w=majority
PORT=3001
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
GEMINI_API_KEY=  # opcional
```

### Scripts de arranque (raíz)
```bash
npm run dev           # inicia frontend + backend en paralelo
npm run dev:backend   # nodemon src/server.js  (puerto 3001)
npm run dev:frontend  # vite                   (puerto 5173)
```

---

## 3. Backend — Estructura

```
backend/src/
├── server.js          # Punto de entrada: carga .env, conecta DB, arranca Express
├── app.js             # Configura CORS, JSON, monta rutas
├── config/db.js       # connectDB() con mongoose.connect()
├── models/
│   ├── User.js        # Administradores
│   ├── Teacher.js     # Profesores (colección separada)
│   ├── Student.js     # Estudiantes (colección separada)
│   ├── Course.js      # Cursos
│   └── Class.js       # Sesiones/clases
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── teacherRoutes.js
│   ├── studentRoutes.js
│   ├── courseRoutes.js
│   └── classRoutes.js
├── controllers/
│   ├── courseController.js
│   ├── classController.js
│   └── userController.js
└── services/          # (Gemini u otros servicios auxiliares)
```

---

## 4. Modelos de Datos (MongoDB / Mongoose)

### `User` — Administradores
```js
{ name, email(unique), username(unique), password(hash), role: ['admin','teacher','student'], avatar, createdAt }
```

### `Teacher` — Profesores
```js
{ documento(unique,8-11dig), nombre(max32), apellido(max32), telefono(unique,10dig),
  correo(unique,email), clave(hash,min8), areaDominio(enum), anioInicio(4dig),
  estado(bool,default:true), createdAt }
```
`DOMAIN_AREAS`: `['Informática','Matemáticas','Ciencias','Historia','Idiomas','Arte','Ingeniería','Física','Química','Literatura','Educación Física','General']`

### `Student` — Estudiantes
```js
{ documento(unique,8-11dig), nombre(max32), apellido(max32), anioNacimiento(4dig),
  telefono(unique,10dig), correo(unique,email), clave(hash,min8),
  sexo: ['Masculino','Femenino','Otro','M','F'], institucion, location(GeoJSON Point),
  estado(bool,default:true), aprobado(bool,default:false), createdAt }
```
> ⚠️ `aprobado:false` bloquea el login con código `PENDING_APPROVAL`. Un admin debe aprobar al estudiante.

### `Course` — Cursos
```js
{ name, description, category, teacherId(ref:Teacher), studentIds([ref:Student]),
  contents([CourseContentSchema]), 
  estado: ['Activo', 'Desactivado', 'En espera de docente', 'Pausado'],
  solicitarDespausa: Boolean,
  maxStudents: Number (default: 20),
  createdAt }
```

### `Class` — Sesiones de clase
```js
{ courseId(ref:Course), title, date, startTime, endTime, sessionType:['Live','In-Person','Workshop'],
  isActive(bool), transcription([{text,timestamp,isFinal}]), savedTranscription,
  summary, participantIds([ref:User]), questions([QuestionSchema]),
  attendance([{userId,joinedAt}]), attentionChecks([AttentionCheckSchema]), createdAt }
```

- **Classroom Rendering:** Dynamically resolves routing based on component state and implements resilient fallback fetching (to bypass global state polling delays).
- **Interactive UI:**
  - Real-time Transcription with AI capabilities (Topic Extraction, Partial/Final Summaries).
  - Attention Check polling and UI state rendering.
  - Active participant tracking and live question management.

---

## 5. API REST (`/api`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login multi-rol (busca en User → Teacher → Student) |
| GET | `/api/users` | Listar usuarios |
| GET/POST | `/api/teachers` | Listar / Crear profesor |
| GET/POST | `/api/students` | Listar / Crear estudiante (RF-01) |
| GET | `/api/students/pending` | Estudiantes pendientes de aprobación |
| PATCH | `/api/students/:id/approve` | Aprobar estudiante |
| GET | `/api/courses` | Listar todos los cursos |
| GET | `/api/courses/teacher/:teacherId` | Cursos de un profesor |
| GET | `/api/courses/student/:studentId` | Cursos de un estudiante |
| POST /api/courses/:id/enroll | **Inscribir estudiante** `{ studentId }` |
| POST | `/api/courses/:id/unenroll` | **Desinscribir estudiante** |
| POST/GET | `/api/courses` | CRUD de cursos |
| POST | `/api/courses/:id/contents` | **Subir material** (Multipart/form-data) |
| DELETE | `/api/courses/:id/contents/:contentId` | **Eliminar material** |
| GET/POST | `/api/classes` | Listar / Crear clase |
| PATCH | `/api/classes/:id/activate` | Activar clase en vivo |
| POST | `/api/classes/:id/transcription` | **Añadir segmento de transcripción** |
| PUT | `/api/classes/:id/transcription/save` | Guardar transcripción completa |
| POST | `/api/classes/:id/questions` | **Enviar pregunta** en vivo |
| PUT | `/api/classes/:classId/questions/:questionId/answer` | Marcar pregunta como respondida |
| POST | `/api/classes/:id/join` | Unirse a la clase (asistencia) |
| POST | `/api/classes/:id/attention-check` | **Lanzar verificación de atención** |
| POST | `/api/classes/:classId/attention-check/:checkId/respond` | Responder a verificación |
| PUT  | `/api/classes/:classId/attention-check/:checkId/complete` | Completar verificación |
| GET  | `/api/courses/:id/students` | Obtener estudiantes (incluye ubicaciones geo) |
| GET | `/api/health` | Health check |

---

## 6. Frontend — Estructura

```
frontend/src/
├── main.jsx          # Renderiza <App> en #root
├── App.jsx           # Router condicional por rol: AdminRouter/TeacherRouter/StudentRouter
├── App.css / index.css
├── context/
│   └── AppContext.jsx  # Estado global + helpers + llamadas API
├── components/
│   └── Sidebar.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── admin/
│   │   ├── AdminDashboard.jsx
│   │   ├── UsersPage.jsx
│   │   ├── CoursesPage.jsx       # Gestión de cursos (Vista de Tabla restaurada)
│   │   ├── ReportsPage.jsx
│   │   └── EnrollmentRequestsPage.jsx # Unificado: Registro de usuarios + Inscripciones a cursos
│   ├── teacher/
│   │   ├── TeacherDashboard.jsx
│   │   └── ClassroomTeacher.jsx
│   └── student/
│       ├── StudentDashboard.jsx
│       └── ClassroomStudent.jsx
└── services/
    └── geminiService.js
```

### AppContext — Patrón
- Todo el estado vive en `AppContext.jsx` (`useState`).
- Se persiste en `localStorage` (clave `classai_*`).
- **Funciones que ya llaman a la API real**: `login`, `createTeacher`.
- **Funciones que aún son stubs locales** (marcadas `// DB STUB`): `createCourse`, `enrollStudent`, `unenrollStudent`, `createClass`, etc.
- El contexto expone: `users, courses, classes, currentUser, activePage, activeClassId` + todas las funciones.

### Renderizado por rol (`App.jsx`)
- `admin` → `AdminRouter` (pages: dashboard, users, courses, reports, enrollment)
- `teacher` → `TeacherRouter` (page: dashboard - Soporte multi-pestaña)
- `student` → `StudentRouter` (page: dashboard - Navegación lateral sincronizada con activePage)
- Classroom especial para teacher/student cuando `activePage === 'classroom'`

---

## 7. Flujo de Autenticación

1. `LoginPage` llama a `login(email, password)` del contexto.
2. `login()` hace `POST /api/auth/login`.
3. El backend busca en `User` → `Teacher` → `Student` en ese orden.
4. Devuelve `{ id, name, email, username, role, avatar, ... }`.
5. Se guarda en `localStorage` como `classai_session`.
6. Casos especiales: `403 PENDING_APPROVAL` (estudiante no aprobado), `403` cuenta inactiva.

---

## 8. Casos de Uso / RFs implementados

| RF | Nombre | Estado |
|---|---|---|
| RF-01 | Registro de estudiante | ✅ Backend completo (API + aprobación admin) |
| RF-02 | Registro de profesor | ✅ Backend + frontend (UsersPage) |
| RF-06 | Gestión de cursos | ✅ Backend + frontend (CoursesPage) |
| RF-07 | Gestión de contenidos | ✅ Backend + frontend (TeacherDashboard - Materiales) |
| RF-08 | Inscripción en curso | ✅ Backend completo + Sistema de Solicitudes (Aprobar/Rechazar) |
| RF-09 | Calificaciones avanzadas | ✅ Gestión de calificaciones con sistema tier |
| RF-10 | Tracking de Atención en Vivo | ✅ Backend + frontend (Verificaciones aleatorias de 30s) |
| RF-11 | Analítica Geoespacial | ✅ Backend + frontend (Mapa de Leaflet con ubicaciones) |
| RF-XX | Restauración UI Admin | ✅ Reversión a tabla clásica + Separación de solicitudes |
| RF-XX | Navegación Estudiante | ✅ Sidebar sincronizado con Dashboard interno |

---

## 9. Reglas de negocio importantes

1. **Estudiante no puede loguear** hasta ser `aprobado:true` por el admin.
2. **Profesor tiene estado** (`estado`); si es `false`, no puede loguear.
3. **Validación de Curso "En espera de docente"**: No puede tener un profesor asignado. El sistema bloquea esta combinación.
4. **Permisos de solo lectura**: En cursos con estado distinto a `Activo`, el profesor NO puede crear clases ni subir materiales.
5. **Solicitud de despausa**: El profesor puede marcar `solicitarDespausa: true` desde su panel, notificando visualmente al administrador.
6. **Inscripción en curso**: usa `$addToSet` en MongoDB → no se puede repetir la misma inscripción.
7. **Passwords**: siempre hasheados con `bcryptjs` antes de guardar.
8. **CORS**: sólo acepta peticiones de `http://localhost:5173`.
9. **Archivos**: límite de 50MB, solo se permiten extensiones documentales (.pdf, .docx, .pptx). No se admiten archivos de video (.mp4).
10. **Visibilidad de Interfaz**: Todos los botones de acción crítica (Aprobar, Inscribir) deben usar `color: white` para asegurar contraste sobre fondos de éxito/primarios.
11. **Sincronización de Dashboard**: Los Dashboards que usan pestañas internas deben sincronizar su estado con `activePage` del contexto global para mantener el Sidebar coherente.
12. **Control Temporal Estricto**: Nadie (ni profesores ni alumnos) puede entrar a una clase antes de su `startTime`. Los botones de "Entrar" se habilitan dinámicamente.
13. **Validación de Creación**: La hora de inicio no puede ser anterior a la actual, la de fin debe ser posterior a la de inicio, y la duración máxima permitida es de 4 horas.
14. **Expulsión Universal**: Al finalizar una sesión, todos los participantes conectados son redirigidos automáticamente al panel principal.
15. **Transcripción Acumulativa**: Se mantiene un historial persistente de lo dicho por el profesor en el chat, con auto-scroll automático para todos los usuarios.
16. **Límite de Capacidad**: Cada curso tiene un límite máximo de **20 estudiantes**. El sistema bloquea nuevas inscripciones y solicitudes una vez alcanzado este tope.

---

## 10. Notas para extender el proyecto

- Para añadir una nueva ruta: crear archivo en `routes/`, controlador en `controllers/`, importar en `app.js`.
- Para añadir una nueva página: crear en `pages/<rol>/`, importar en `App.jsx` y añadir case en el router.
- Para migrar un stub a API real: reemplazar la función en `AppContext.jsx` con un `fetch` al backend.
- El seed data en `AppContext` es solo para desarrollo local sin DB; cuando el backend está activo, los datos vienen de MongoDB.
- CSS: todas las clases están en `index.css`. Usar clases existentes (`btn`, `card`, `form-input`, `badge-*`, etc.) antes de crear nuevas.
- **Sincronización en Vivo**: El sistema usa "polling" cada 4-10 segundos en los Dashboards y Sidebar para actualizar el estado de las clases y habilitar el acceso dinámicamente sin recargar la página.
