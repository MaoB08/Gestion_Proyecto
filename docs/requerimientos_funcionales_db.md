# Documentación de Requerimientos Funcionales - MongoDB

Este documento detalla la implementación de las funcionalidades requeridas por el proyecto de aula en relación con el motor de base de datos MongoDB. A continuación, se explica el **cómo**, el **por qué**, y el **para qué** de cada requerimiento, indicando también **dónde** se encuentra implementado en el código fuente.

---

## 1. Agregaciones ($group, $project, $sort, $match, $limit, $skip, $unwind, $lookup)

**¿Para qué sirven?**
Las agregaciones (Aggregation Pipeline) permiten procesar múltiples documentos y devolver resultados computados. Se utilizan para operaciones complejas como agrupar datos, realizar cruces entre colecciones (Joins), transformar campos y paginar información, algo que una consulta simple (`find()`) no puede hacer eficientemente.

**¿Por qué las usamos?**
Para reducir la carga en el servidor Node.js y delegar cálculos complejos directamente a MongoDB, optimizando enormemente la velocidad y el rendimiento del sistema, especialmente cuando manejamos listados de notas, cursos y cruces de información relacional.

**¿Cómo y dónde se implementan?**
Estas 8 agregaciones se aplican integradas principalmente en los reportes de calificaciones y estudiantes:
* **Ubicación en el código:** `backend/src/controllers/gradeController.js` (función `getGradesByTier`) y `backend/src/controllers/courseController.js`.
* **$match:** Filtra las notas que pertenecen a un curso específico y cumplen los criterios de nota.
* **$lookup:** Relaciona y cruza la colección de calificaciones con la de estudiantes (`students`) y la de cursos (`courses`).
* **$unwind:** Desestructura los arrays resultantes del `$lookup` para convertirlos en objetos únicos, simplificando la lectura de los datos cruzados.
* **$project:** Remodela la salida, enviando al frontend estrictamente los datos necesarios (nombre del estudiante, nota, y título de la actividad), ahorrando ancho de banda.
* **$sort:** Ordena las notas de manera ascendente (`grade: 1`) para presentar un ranking limpio.
* **$skip y $limit:** Se emplean para introducir paginación, limitando la salida de los documentos (ej. a 50 resultados) y omitiendo los anteriores según la página actual consultada.
* **$group:** Se encuentra en el `courseController.js` para agrupar estadísticas de cursos (ej. cantidad de estudiantes por curso o agrupación por profesores).

---

## 2. Implementación de Índices

Los índices son estructuras de datos especiales que almacenan una pequeña porción del conjunto de datos en una forma fácil de recorrer.

**¿Para qué sirven y por qué se usan?**
Sirven para acelerar drásticamente las consultas en base de datos. Sin índices, MongoDB debe realizar un escaneo de colección completo (Full Collection Scan). Se usan para asegurar que la plataforma pueda escalar sin lentitud al buscar a miles de estudiantes o clases en vivo.

**¿Cómo y dónde se implementan?**

1. **Índice simple (Single Field)**
   * **Dónde:** `backend/src/models/Course.js` -> `CourseSchema.index({ teacherId: 1 });`
   * **Cómo/Por qué:** Optimiza la consulta `find({ teacherId: ... })` cuando un docente entra a su panel y carga "Mis cursos".
2. **Índice compuesto (Compound Index)**
   * **Dónde:** `backend/src/models/Course.js` -> `CourseSchema.index({ category: 1, estado: 1 });`
   * **Cómo/Por qué:** Acelera los filtros en el panel administrativo cuando se buscan cursos que pertenecen a cierta categoría y están en un estado específico (ej. "Informática" y "Activo").
3. **Índice Multikey**
   * **Dónde:** `backend/src/models/Course.js` -> `CourseSchema.index({ studentIds: 1 });`
   * **Cómo/Por qué:** `studentIds` es un array. Al indexarlo, la base de datos crea un índice por cada elemento del array. Sirve para saber de forma instantánea a qué cursos está inscrito un alumno específico.
4. **Índice de Texto (Text Index)**
   * **Dónde:** `backend/src/models/Course.js` -> `CourseSchema.index({ name: 'text', description: 'text' });`
   * **Cómo/Por qué:** Permite habilitar el motor de búsqueda por texto completo (`$text`), haciendo posible encontrar un curso introduciendo palabras clave relacionadas en su título o descripción sin usar expresiones regulares costosas.
5. **Índice Geoespacial (2dsphere)**
   * **Dónde Backend:** `backend/src/models/Student.js` -> `StudentSchema.index({ location: '2dsphere' });`
   * **Dónde Frontend:** `frontend/src/pages/teacher/TeacherDashboard.jsx`
   * **Cómo/Por qué:** Almacena coordenadas de los usuarios (GeoJSON). Se programó la obtención de coordenadas cuando un estudiante usa la plataforma. El profesor cuenta con una funcionalidad visible (botón "🌐 Vista geoespacial" en la lista de inscritos) para pintar en un mapa interactivo la ubicación de conexión actual de sus alumnos de clase.

---

## 3. Operadores de Consulta y Lógicos

**¿Para qué sirven y por qué se usan?**
Permiten formular consultas detalladas y condiciones lógicas directas al motor de base de datos sin tener que traer toda la colección a la memoria y filtrarla con Javascript (lo cual sería fatal para la memoria del servidor).

**¿Cómo y dónde se implementan?**
Toda la suite de operadores ha sido concentrada dentro de los filtros del sistema de calificaciones:
* **Ubicación en el código:** `backend/src/controllers/gradeController.js` (función `getGradesByTier`)

* **$gt / $gte (Mayor / Mayor o igual que):** Se usa para filtrar notas superiores o iguales al margen "Estandar" y "Sobresaliente" (`grade: { $gte: 3.0 }`).
* **$lt / $lte (Menor / Menor o igual que):** Empleado en conjunto para obtener notas en rango, ej: notas menores a 4.0 (`grade: { $lt: 4.0 }`), o notas en déficit (`$lte: 2.9`).
* **$ne (No es igual a):** Se usa para excluir calificaciones específicas del filtro global (`grade: { $ne: -50 }`).
* **$in:** Se usa para ubicar si la nota coincide dentro de un array de estados no evaluados (`grade: { $in: [0] }`).
* **$and:** Agrupa condiciones obligatorias. Exige que el documento coincida con el curso (`courseId`) Y además con las reglas del grado (`$or`).
* **$or:** Establece ramificaciones. En la tubería se pide que la nota del estudiante cumpla con el filtro de nivel solicitado, O se aplica una validación extra.
* **$not:** Se aplicó dentro del operador lógico `$or` de las agregaciones para invertir y prohibir que se carguen calificaciones con valores ilógicos (ej. `{ grade: { $not: { $lt: -100 } } }`), sirviendo como barrera final de integridad a nivel de búsqueda.
