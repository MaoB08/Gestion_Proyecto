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
├── server.js              # Punto de entrada: carga .env, conecta DB, arranca Express
├── app.js                 # Configura CORS, JSON, monta rutas
├── config/
│   └── db.js              # connectDB() con mongoose.connect()
├── models/
│   ├── User.js            # Administradores
│   ├── Teacher.js         # Profesores (colección separada)
│   ├── Student.js         # Estudiantes (colección separada)
│   ├── Course.js          # Cursos
│   ├── Class.js           # Sesiones/clases
│   └── Grade.js           # Calificaciones por actividad
├── routes/
│   ├── authRoutes.js      # Login multi-rol
│   ├── userRoutes.js      # CRUD de usuarios + búsqueda paginada
│   ├── teacherRoutes.js   # CRUD de profesores + historial
│   ├── studentRoutes.js   # CRUD de estudiantes + analítica
│   ├── courseRoutes.js    # Cursos + inscripciones + materiales
│   ├── classRoutes.js     # Sesiones + transcripción + IA + asistencia
│   └── gradeRoutes.js     # Calificaciones por tier
├── controllers/
│   ├── classController.js # Sesiones de clase y endpoints de IA
│   ├── courseController.js
│   ├── gradeController.js
│   └── userController.js
└── services/
    ├── geminiService.js   # Integración con Google Generative AI SDK
    └── dbService.js       # Helpers de bajo nivel sobre MongoDB
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
| GET | `/api/classes/participant/:userId` | Historial de clases por asistente (`$or` participantIds + attendance.userId) |
| PATCH | `/api/classes/:id/activate` | Activar clase en vivo |
| PUT | `/api/classes/:id/deactivate` | Finalizar clase (limpia `participantIds`) |
| POST | `/api/classes/:id/transcription` | **Añadir segmento de transcripción** |
| PUT | `/api/classes/:id/transcription/save` | Guardar transcripción completa en `savedTranscription` |
| PUT | `/api/classes/:id/summary` | Guardar resumen de IA manualmente |
| POST | `/api/classes/:id/questions` | **Enviar pregunta** en vivo |
| PUT | `/api/classes/:classId/questions/:questionId/answer` | Marcar pregunta como respondida |
| POST | `/api/classes/:id/join` | Unirse a la clase (asistencia) |
| POST | `/api/classes/:id/attention-check` | **Lanzar verificación de atención** |
| POST | `/api/classes/:classId/attention-check/:checkId/respond` | Responder a verificación |
| PUT  | `/api/classes/:classId/attention-check/:checkId/complete` | Completar verificación |
| POST | `/api/classes/:id/ai/topics` | **IA:** Extraer temas principales de la transcripción |
| POST | `/api/classes/:id/ai/summary` | **IA:** Generar resumen completo y guardarlo en MongoDB |
| POST | `/api/classes/:id/ai/partial-summary` | **IA:** Resumen parcial en tiempo real |
| POST | `/api/classes/:id/ai/ask` | **IA:** Chat educativo sobre el contenido de la clase |
| GET  | `/api/courses/:id/students` | Obtener estudiantes (incluye ubicaciones geo) |
| GET | `/api/health` | Health check |

---

## 6. Frontend — Estructura

```
frontend/src/
├── main.jsx              # Renderiza <App> en #root
├── App.jsx               # Router condicional por rol: AdminRouter/TeacherRouter/StudentRouter
├── App.css / index.css   # Sistema de diseño completo (tokens CSS, clases reutilizables)
├── context/
│   └── AppContext.jsx    # Estado global + helpers + llamadas API + fetchs optimizados
├── components/
│   └── Sidebar.jsx       # Barra lateral por rol con sincronización con activePage
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── admin/
│   │   ├── AdminDashboard.jsx
│   │   ├── UsersPage.jsx
│   │   ├── CoursesPage.jsx              # Gestión de cursos — vista de tabla
│   │   ├── ReportsPage.jsx
│   │   └── EnrollmentRequestsPage.jsx  # Solicitudes de registro e inscripción unificadas
│   ├── teacher/
│   │   ├── TeacherDashboard.jsx         # Panel: cursos, historial, calificaciones
│   │   │                                #   └── SummaryModal (ver resumen IA + copiar)
│   │   │                                #   └── TranscriptionModal (ver transcripción + copiar)
│   │   └── ClassroomTeacher.jsx         # Vista en vivo: transcripción, IA, preguntas
│   └── student/
│       ├── StudentDashboard.jsx          # Portal: mis cursos, explorar, historial, notas
│       │                                 #   └── SummaryModal (ver resumen IA + copiar)
│       │                                 #   └── TranscriptionModal (ver transcripción + copiar)
│       └── ClassroomStudent.jsx          # Vista en vivo: transcripción, IA, preguntas
└── services/
    └── geminiService.js  # Proxy hacia el backend — NUNCA llama a Google directamente
```

### AppContext — Patrón
- Todo el estado vive en `AppContext.jsx` (`useState`) y se persiste en `localStorage` (clave `classai_*`).
- Las funciones de datos hacen `fetch` directo al backend (`http://localhost:3001/api/...`).
- Funciones optimizadas con índices: `fetchCoursesByStudent`, `fetchActiveClassesByCourse`, `fetchParticipantHistory`.
- El contexto expone: `users, courses, classes, currentUser, activePage, activeClassId` + todas las funciones de mutación.

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

---

## 11. Mapa del Parcial — Agregaciones, Índices y Operadores

> Referencia rápida para ubicar cada requisito evaluado en el código fuente.

---

### 11.1 Las 8 Etapas de Agregación

#### `$match`, `$lookup`, `$unwind` y `$project` (usados juntos)

**Archivo:** `backend/src/controllers/gradeController.js` — función `getGradesByTier` (líneas 56–140)

**Contexto:** Cuando el docente filtra calificaciones por nivel (inferior / estándar / sobresaliente), el backend ejecuta un pipeline completo:

```js
const results = await Grade.aggregate([
  { $match: { courseId: ..., grade: gradeFilter } },       // filtra notas del curso
  { $lookup: { from: 'students', ... as: 'student' } },    // une con estudiantes
  { $unwind: { path: '$student', ... } },                  // descompone array
  { $lookup: { from: 'courses',  ... as: 'course'  } },    // une con cursos
  { $unwind: { path: '$course',  ... } },                  // descompone array
  { $addFields: { activity: { $arrayElemAt: [...] } } },   // extrae actividad
  { $project: { grade, 'studentId.nombre', 'contentId.title' } }, // da forma
  { $sort: { grade: 1 } },
]);
```

---

#### `$sort`

| Archivo | Línea(s) | Contexto |
|---------|----------|---------|
| `gradeController.js` | L133 | Ordena calificaciones de menor a mayor |
| `courseController.js` | L32 | Ordena reporte de categorías alfabéticamente |
| `courseController.js` | L88–92 | Ordena cursos por nº de estudiantes o clases |
| `studentRoutes.js` | L78, L114 | Ordena distribución de género y jornada |

---

#### `$skip` y `$limit`

**Archivo:** `backend/src/routes/userRoutes.js` — función `getAllUsers` (líneas 96–98)

```js
mainPipeline.push({ $sort:  { createdAt: -1 } });
if (skip  > 0) mainPipeline.push({ $skip:  skip  }); // omite páginas anteriores
if (limit > 0) mainPipeline.push({ $limit: limit }); // limita registros por página
```

La paginación se activa cuando el admin consulta `/api/users/all?page=2&limit=10`.

---

#### `$group`

**Ubicación 1 — distribución de género** (`studentRoutes.js` líneas 76–79):
```js
await Student.aggregate([
  { $group: { _id: '$sexo', count: { $sum: 1 } } },
  { $sort:  { _id: 1 } },
]);
```

**Ubicación 2 — distribución de jornada** (`studentRoutes.js` líneas 112–114):
```js
// Doble $group: deduplica estudiantes por jornada, luego cuenta
{ $group: { _id: { jornada: '$jornada', userId: '$attendance.userId' } } },
{ $group: { _id: '$_id.jornada', count: { $sum: 1 } } },
```

**Ubicación 3 — reporte por categoría** (`courseController.js` — función `getCategoryReport`, líneas 7–38):
```js
{ $group: {
    _id: { $cond: ... '$category' ... },
    totalCourses: { $sum: 1 },
    totalClasses: { $sum: { $size: '$courseClasses' } }
  }
},
```

---

### 11.2 Índices

#### Índice Simple (Single Field)

| Colección | Campo | Archivo | Línea |
|-----------|-------|---------|-------|
| `courses` | `teacherId` | `Course.js` | L29 |
| `grades` | `studentId` | `Grade.js` | L44 |
| `classes` | `courseId` | `Class.js` | L61 |

```js
CourseSchema.index({ teacherId: 1 });   // Course.js  L29
GradeSchema.index({ studentId: 1 });    // Grade.js   L44
ClassSchema.index({ courseId: 1 });     // Class.js   L61
```

---

#### Índice Compuesto (Compound Index)

| Colección | Campos | Archivo | Línea | Propósito |
|-----------|--------|---------|-------|-----------|
| `courses` | `category + estado` | `Course.js` | L32 | Filtrar cursos por categoría y estado combinados |
| `classes` | `courseId + isActive` | `Class.js` | L64 | Buscar clases activas de un curso específico |
| `grades` | `studentId + courseId + contentId` (unique) | `Grade.js` | L47 | Garantizar una nota por estudiante por actividad |

```js
CourseSchema.index({ category: 1, estado: 1 });                                    // Course.js L32
ClassSchema.index({ courseId: 1, isActive: 1 });                                   // Class.js  L64
GradeSchema.index({ studentId: 1, courseId: 1, contentId: 1 }, { unique: true });  // Grade.js  L47
```

---

#### Índice Multikey

Se activa automáticamente cuando el campo indexado es un **array**.

| Colección | Campo (Array) | Archivo | Línea |
|-----------|--------------|---------|-------|
| `courses` | `studentIds` | `Course.js` | L35 |
| `classes` | `participantIds` | `Class.js` | L67 |

```js
CourseSchema.index({ studentIds: 1 });    // Course.js L35 — array de ObjectId
ClassSchema.index({ participantIds: 1 }); // Class.js  L67 — array de ObjectId
```

---

#### Índice de Texto (Text Index)

> ⚠️ **No implementado actualmente.** El buscador de usuarios usa `$regex`, no `$text`.
> Candidato natural para agregar en `Course.js`:
> ```js
> CourseSchema.index({ name: 'text', description: 'text' });
> ```

---

#### Índice Geoespacial (2DSphere)

**Archivo:** `backend/src/models/Student.js` — línea 110

```js
StudentSchema.index({ location: '2dsphere' });
```

**Campo GeoJSON en el schema (Student.js líneas 92–101):**
```js
location: {
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: [Number] // [longitude, latitude]
}
```

**Captura al login:** `backend/src/routes/authRoutes.js` líneas 86–93
→ Si el cuerpo del login incluye `{ latitude, longitude }`, se guarda automáticamente como GeoJSON Point.

**Visualización:** `GET /api/courses/:id/students` devuelve el campo `location` de cada estudiante; el `TeacherDashboard.jsx` lo muestra en un mapa Leaflet.

---

### 11.3 Operadores de Comparación

| Operador | Archivo | Línea(s) | Contexto |
|----------|---------|----------|---------|
| `$gte` | `gradeController.js` | L70, L72 | Notas ≥ 3.0 (estándar) y ≥ 4.0 (sobresaliente) |
| `$gte` / `$lte` | `studentRoutes.js` | L92 | Filtrar asistencia de hoy (`todayStart`..`todayEnd`) |
| `$lt` | `gradeController.js` | L70 | Notas < 4 (límite superior estándar) |
| `$lte` | `gradeController.js` | L68 | Notas ≤ 2.9 (inferior) |
| `$ne` | `gradeController.js` | L64 | Cualquier nota distinta de -50 (centinela "todas") |
| `$in` | `gradeController.js` | L66 | Notas dentro de `[0]` (no entregados) |

```js
// gradeController.js — getGradesByTier
if (tier === 'todas')          gradeFilter = { $ne: -50 };
if (tier === 'no-entregados')  gradeFilter = { $in: [0] };
if (tier === 'inferior')       gradeFilter = { $lte: 2.9 };
if (tier === 'estandar')       gradeFilter = { $gte: 3.0, $lt: 4 };
if (tier === 'sobresaliente')  gradeFilter = { $gte: 4.0 };
```

---

### 11.4 Operadores Lógicos

**Archivo:** `backend/src/routes/teacherRoutes.js` — ruta `GET /api/teachers/history` (líneas 113–140)

#### `$or`

```js
// Profesores recientes: que empezaron en 2025 O en 2026
const recientes = await Teacher.find({
  $or: [
    { anioInicio: 2025 },
    { anioInicio: 2026 }
  ]
}).select('nombre apellido anioInicio').sort({ anioInicio: 1 });
```

#### `$and`

```js
// Profesores antiguos: que NO sean de 2025 Y que NO sean de 2026
const antiguos = await Teacher.find({
  $and: [
    { anioInicio: { $not: { $eq: 2025 } } },
    { anioInicio: { $not: { $eq: 2026 } } }
  ]
}).select('nombre apellido anioInicio').sort({ anioInicio: 1 });
```

#### `$not`

```js
// Invierte el resultado de $eq → excluye exactamente ese año
{ anioInicio: { $not: { $eq: 2025 } } }
{ anioInicio: { $not: { $eq: 2026 } } }
```

`$or` también aparece en `backend/src/routes/userRoutes.js` líneas 34, 50, 66
→ Búsqueda multi-campo de usuarios: `$match: { $or: [{ nombre... }, { correo... }, ...] }`.

---

### 11.5 Tabla Resumen del Parcial

| Requisito | Estado | Archivo Principal |
|-----------|--------|-------------------|
| `$match` | ✅ | `gradeController.js` |
| `$lookup` | ✅ | `gradeController.js`, `courseController.js` |
| `$unwind` | ✅ | `gradeController.js`, `studentRoutes.js` |
| `$project` | ✅ | `gradeController.js`, `userRoutes.js` |
| `$sort` | ✅ | `gradeController.js`, `courseController.js`, `studentRoutes.js` |
| `$skip` | ✅ | `userRoutes.js` |
| `$limit` | ✅ | `userRoutes.js` |
| `$group` | ✅ | `studentRoutes.js`, `courseController.js` |
| Índice Simple | ✅ | `Course.js`, `Grade.js`, `Class.js` |
| Índice Compuesto | ✅ | `Course.js`, `Class.js`, `Grade.js` |
| Índice Multikey | ✅ | `Course.js`, `Class.js` |
| Índice de Texto | ❌ **Falta** | — |
| Índice 2DSphere | ✅ | `Student.js` |
| `$gt` / `$gte` | ✅ | `gradeController.js`, `studentRoutes.js` |
| `$lt` / `$lte` | ✅ | `gradeController.js`, `studentRoutes.js` |
| `$ne` | ✅ | `gradeController.js` |
| `$in` | ✅ | `gradeController.js` |
| `$or` | ✅ | `teacherRoutes.js`, `userRoutes.js` |
| `$and` | ✅ | `teacherRoutes.js` |
| `$not` | ✅ | `teacherRoutes.js` |
| `$or` (historial) | ✅ | `classController.js` — `getByParticipant` |

---

## 12. Integración de Inteligencia Artificial — Google Gemini

> Esta sección describe el diseño completo de la capa de IA, cómo fluyen los datos y dónde vive cada pieza de código.

---

### 12.1 Arquitectura General

La integración de IA sigue un patrón **servidor-como-proxy** estricto:

```
┌─────────────────────────────────────────────┐
│              FRONTEND (React)               │
│   ClassroomTeacher.jsx / ClassroomStudent   │
│   → frontend/src/services/geminiService.js  │
│     (solo hace fetch al backend propio)     │
└────────────────────┬────────────────────────┘
                     │  HTTP POST
                     │  /api/classes/:id/ai/...
┌────────────────────▼────────────────────────┐
│              BACKEND (Node.js)              │
│   backend/src/routes/classRoutes.js         │
│   backend/src/controllers/classController.js│
│   backend/src/services/geminiService.js     │
│     (usa SDK oficial @google/generative-ai) │
└────────────────────┬────────────────────────┘
                     │  HTTPS
                     │  SDK  @google/generative-ai
┌────────────────────▼────────────────────────┐
│      Google Generative Language API         │
│   generativelanguage.googleapis.com         │
│   Modelo: gemini-2.5-flash                  │
└─────────────────────────────────────────────┘
```

**Principio clave:** La `GEMINI_API_KEY` **nunca** sale del servidor. El frontend nunca conoce la clave ni llama a Google directamente.

---

### 12.2 Configuración y Clave de API

**Archivo:** `backend/.env`
```env
GEMINI_API_KEY=AQ.Ab8R...   # Clave en formato Authorization Key (prefijo AQ.)
```

**Formato de clave:** Google AI Studio ahora genera claves con prefijo `AQ.` (Authorization Keys). Estas claves **no funcionan** con llamadas REST HTTP directas (retornan `401 UNAUTHENTICATED` con error `ACCESS_TOKEN_TYPE_UNSUPPORTED`). Solo son compatibles con el **SDK oficial** `@google/generative-ai`.

**Dependencia instalada en backend:**
```bash
npm install @google/generative-ai   # versión ^0.24.1
```

**Modo simulación automático:** Si `GEMINI_API_KEY` no está configurada o está vacía, `geminiService.js` devuelve respuestas predeterminadas predefinidas localmente, garantizando que la app **nunca falle** por falta de clave.

---

### 12.3 Servicio de IA en el Backend

**Archivo:** `backend/src/services/geminiService.js`

```js
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) return null;  // → modo simulación
  const genAI  = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

**Modelo utilizado:** `gemini-2.5-flash`
- Fue seleccionado consultando la lista de modelos disponibles para la API key activa (`GET /v1beta/models?key=...`).
- `gemini-1.5-flash` devolvía `404 NOT_FOUND` porque no está disponible en el proyecto/cuenta actual.

**Funciones exportadas:**

| Función | Prompt enviado a Gemini | Fallback (sin clave) |
|---------|------------------------|---------------------|
| `identifyTopics(text)` | Analiza la transcripción y lista 4-5 temas principales en viñetas cortas | Array de temas de ejemplo |
| `summarizeTranscription(text)` | Resumen estructurado en Markdown con temas, conceptos clave y puntos importantes | Resumen de ejemplo |
| `partialSummary(text)` | Resume en 3-4 oraciones lo explicado hasta el momento | Frase genérica |
| `askAboutTranscription(text, question)` | Responde la pregunta basándose únicamente en la transcripción (máx. 4 oraciones) | Respuesta genérica |

---

### 12.4 Rutas y Controladores de IA

**Archivo de rutas:** `backend/src/routes/classRoutes.js`

```js
router.post('/:id/ai/topics',          classController.getAITopics);
router.post('/:id/ai/summary',         classController.getAISummary);
router.post('/:id/ai/partial-summary', classController.getAIPartialSummary);
router.post('/:id/ai/ask',             classController.askAI);
```

**Archivo de controladores:** `backend/src/controllers/classController.js`

Flujo común de todos los controladores de IA:

```
1. Buscar la clase por ID en MongoDB (Class.findById)
2. Concatenar todos los segmentos de transcripción: (cls.transcription || []).map(s => s.text).join(' ')
3. Llamar a la función correspondiente de geminiService
4. Retornar { topics | summary | answer } como JSON
```

**Comportamiento especial de `getAISummary`:**
```js
exports.getAISummary = async (req, res) => {
  const cls     = await Class.findById(req.params.id);
  const text    = (cls.transcription || []).map(s => s.text).join(' ');
  const summary = await geminiService.summarizeTranscription(text);

  // Persiste automáticamente en MongoDB
  cls.summary = summary;
  await cls.save();

  res.json({ summary });
};
```
El resumen final queda guardado en el campo `summary` del documento `Class` en MongoDB y **no se pierde** al cerrar la sesión.

---

### 12.5 Servicio de IA en el Frontend

**Archivo:** `frontend/src/services/geminiService.js`

Este archivo es únicamente un **cliente HTTP** que apunta al backend local. No importa el SDK de Google, no maneja claves:

```js
const API_BASE = 'http://localhost:3001/api';

export async function identifyTopics(classId) {
  const res  = await fetch(`${API_BASE}/classes/${classId}/ai/topics`, { method: 'POST' });
  const data = await res.json();
  return data.topics;
}

export async function summarizeTranscription(classId) { ... } // POST /ai/summary
export async function partialSummary(classId)         { ... } // POST /ai/partial-summary
export async function askAboutTranscription(classId, question) { ... } // POST /ai/ask
```

**Nota de firma:** Todas las funciones reciben `classId` (no el texto completo). El backend es responsable de leer la transcripción desde MongoDB.

---

### 12.6 Flujo Completo de Sesión con IA

```
[Profesor inicia clase]
        │
        ▼
[ClassroomTeacher.jsx — habla y dicta]
        │  Speech Recognition API (navegador)
        ▼
[Segmentos de texto → POST /api/classes/:id/transcription]
        │  Backend guarda {text, timestamp, isFinal} en cls.transcription[]
        ▼
[Profesor presiona "📋 Resumen parcial"]
        │  Frontend → POST /api/classes/:id/ai/partial-summary
        │  Backend lee cls.transcription[], llama geminiService.partialSummary()
        │  Gemini responde con texto en lenguaje natural
        ▼
[Resultado aparece en el panel de IA del profesor y los estudiantes]
        │
        ▼
[Profesor presiona "📝 Resumen final" al terminar]
        │  Frontend → POST /api/classes/:id/ai/summary
        │  Backend llama geminiService.summarizeTranscription()
        │  Gemini genera Markdown estructurado
        │  Backend guarda cls.summary en MongoDB (cls.save())
        ▼
[Clase finaliza → PUT /api/classes/:id/deactivate]
        │  participantIds se vacía, isActive = false
        ▼
[Estudiantes y Profesor ven en su Historial de Clases]
        │  GET /api/classes/participant/:userId
        │   → $or: [ participantIds: userId, 'attendance.userId': userId ]
        │  (attendance persiste aunque participantIds se vacíe)
        ▼
[Botones "👁️ Ver Resumen" y "👁️ Ver Transcripción" disponibles]
        │  Abren modales locales (SummaryModal / TranscriptionModal)
        │  con opción "📋 Copiar" al portapapeles
```

---

### 12.7 Modales de Visualización (Frontend)

Se definieron dos componentes helper locales en cada Dashboard:

#### `SummaryModal`
- Muestra el campo `cls.summary` (texto Markdown generado por Gemini).
- Renderizado con `whiteSpace: 'pre-wrap'` para preservar formato.
- Botón **`📋 Copiar`** con confirmación visual temporal (`¡Copiado!` por 2s).
- Disponible en: `TeacherDashboard.jsx` y `StudentDashboard.jsx`.

#### `TranscriptionModal`
- Prioriza `cls.savedTranscription` (texto completo guardado manualmente).
- Fallback: une dinámicamente `cls.transcription[].text` si no hay versión guardada.
- Botón **`📋 Copiar`** deshabilitado si no hay texto disponible.
- Disponible en: `TeacherDashboard.jsx` y `StudentDashboard.jsx`.

---

### 12.8 Datos en MongoDB — Campo `summary` y Transcripciones

**Modelo:** `backend/src/models/Class.js`

```js
const ClassSchema = new mongoose.Schema({
  // ...
  transcription:      [{ text: String, timestamp: String, isFinal: Boolean }],
  savedTranscription: String,   // Texto completo serializado al finalizar
  summary:            String,   // Resumen IA — persiste entre sesiones
  // ...
});
```

| Campo | Quién lo escribe | Cuándo |
|-------|-----------------|--------|
| `transcription[]` | Backend vía `POST /transcription` | En tiempo real durante la clase |
| `savedTranscription` | Backend vía `PUT /transcription/save` | Al finalizar la clase |
| `summary` | Backend vía `POST /ai/summary` | Cuando el profesor genera el resumen final |

---

### 12.9 Modo Simulación vs. Modo Real

| Condición | Comportamiento |
|-----------|---------------|
| `GEMINI_API_KEY` no definida o vacía | Devuelve respuestas predeterminadas hardcodeadas (arrays y strings de ejemplo). La app funciona sin errores. |
| `GEMINI_API_KEY` definida con clave `AQ.` válida | Llama al SDK `@google/generative-ai` → modelo `gemini-2.5-flash` → respuesta real de Google. |
| Clave inválida o expirada | SDK lanza excepción capturada en `catch` → devuelve `null` → el controlador devuelve respuesta de simulación. |

---

### 12.10 Restricciones y Notas de Seguridad

1. **La clave de API (`GEMINI_API_KEY`) NUNCA debe estar en el frontend** ni aparecer en el código fuente.
2. **El archivo `backend/.env` está en `.gitignore`** — no se sube al repositorio.
3. El modelo `gemini-2.5-flash` fue elegido porque es el más rápido disponible bajo la cuenta actual con cuota gratuita.
4. Las claves formato `AQ.` son el nuevo estándar de Google AI Studio (2025-2026) y solo funcionan con el SDK oficial, no con REST HTTP.
5. Si se cambia de cuenta/proyecto en Google Cloud, usar `GET /v1beta/models?key=<API_KEY>` para verificar qué modelos están disponibles antes de cambiar el nombre del modelo en `geminiService.js`.
