import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────
//  RF-02 DOMAIN AREAS (keep in sync with backend Teacher model)
// ─────────────────────────────────────────────
export const DOMAIN_AREAS = [
  'Informática', 'Matemáticas', 'Ciencias', 'Historia',
  'Idiomas', 'Arte', 'Ingeniería', 'Física',
  'Química', 'Literatura', 'Educación Física', 'General',
]

// ─────────────────────────────────────────────
//  SEED DATA — replace calls with MongoDB later
// ─────────────────────────────────────────────
const SEED_USERS = [
  { id: 'u1', name: 'Admin Sistema', email: 'admin@classai.edu', username: 'admin', password: 'admin123', role: 'admin', avatar: 'AS', createdAt: '2024-01-01' },
  { id: 'u2', name: 'Prof. Carlos Méndez', email: 'cmendez@classai.edu', username: 'prof1', password: 'prof123', role: 'teacher', avatar: 'CM', createdAt: '2024-01-05' },
  { id: 'u3', name: 'Prof. Laura Ríos', email: 'lrios@classai.edu', username: 'prof2', password: 'prof123', role: 'teacher', avatar: 'LR', createdAt: '2024-01-06' },
  { id: 'u4', name: 'Kevin Spinell', email: 'kevin@est.edu', username: 'est1', password: 'est123', role: 'student', avatar: 'KS', createdAt: '2024-02-01' },
  { id: 'u5', name: 'Ana Torres', email: 'ana@est.edu', username: 'est2', password: 'est123', role: 'student', avatar: 'AT', createdAt: '2024-02-02' },
  { id: 'u6', name: 'Jorge Pérez', email: 'jorge@est.edu', username: 'est3', password: 'est123', role: 'student', avatar: 'JP', createdAt: '2024-02-03' },
]

const SEED_COURSES = [
  {
    id: 'c1',
    name: 'Gestión de Bases de Datos',
    description: 'Fundamentos de bases de datos relacionales y NoSQL. Diseño, optimización y gestión.',
    category: 'Informática',
    teacherId: 'u2',
    studentIds: ['u4', 'u5'],
    createdAt: '2024-02-10',
    status: 'active',
  },
  {
    id: 'c2',
    name: 'Algoritmos Avanzados',
    description: 'Estructuras de datos, complejidad algorítmica y técnicas de optimización.',
    category: 'Informática',
    teacherId: 'u3',
    studentIds: ['u4', 'u6'],
    createdAt: '2024-02-12',
    status: 'active',
  },
  {
    id: 'c3',
    name: 'Cálculo Diferencial',
    description: 'Límites, derivadas e integrales con aplicaciones prácticas en ingeniería.',
    category: 'Matemáticas',
    teacherId: 'u2',
    studentIds: ['u5', 'u6'],
    createdAt: '2024-02-15',
    status: 'active',
  },
]

const SEED_CLASSES = [
  {
    id: 'cl1',
    courseId: 'c1',
    title: 'Introducción a MongoDB',
    date: '2026-03-16',
    startTime: '18:00',
    sessionType: 'Live',
    isActive: false,
    transcription: [],
    participantIds: [],
    questions: [],
    chatMessages: [],
    attendance: [],
    savedTranscription: '...y así concluye el tema de índices en MongoDB. Recuerden que los índices mejoran la velocidad de búsqueda pero incrementan el espacio en disco.',
    summary: null,
    createdAt: '2024-03-01',
  },
  {
    id: 'cl2',
    courseId: 'c2',
    title: 'Algoritmo de Dijkstra',
    date: '2026-03-16',
    startTime: '20:00',
    sessionType: 'Live',
    isActive: false,
    transcription: [],
    participantIds: [],
    questions: [],
    chatMessages: [],
    attendance: [],
    savedTranscription: null,
    summary: null,
    createdAt: '2024-03-02',
  },
]

// ─────────────────────────────────────────────
//  CONTEXT
// ─────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [users, setUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('classai_users')) || SEED_USERS } catch { return SEED_USERS }
  })
  const [courses, setCourses] = useState([])
  const [classes, setClasses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('classai_classes')) || SEED_CLASSES } catch { return SEED_CLASSES }
  })
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('classai_session')) || null } catch { return null }
  })
  const [activePage, setActivePage] = useState('dashboard')
  const [activeClassId, setActiveClassId] = useState(null)
  const [grades, setGrades] = useState([])

  // Persist local-only state (users/classes still in localStorage for now)
  useEffect(() => { localStorage.setItem('classai_users', JSON.stringify(users)) }, [users])
  useEffect(() => { localStorage.setItem('classai_classes', JSON.stringify(classes)) }, [classes])

  // ── Fetch real data from MongoDB on mount ──────────────────────────────────
  const refreshData = useCallback(async () => {
    try {
      // 1. Fetch Courses
      const resCourses = await fetch('http://localhost:3001/api/courses')
      if (resCourses.ok) {
        const dataCourses = await resCourses.json()
        setCourses(dataCourses.map(c => ({ 
          ...c, 
          id: c._id, 
          teacherId: c.teacherId?._id || c.teacherId, // Normalize if populated
          studentIds: (c.studentIds || []).map(id => id._id || id),
          pendingStudentIds: (c.pendingStudentIds || []).map(id => id._id || id),
          maxStudents: c.maxStudents || 20
        })))
        localStorage.removeItem('classai_courses')
      }

      // 2. Fetch Teachers, Students and Admins
      const [resT, resS, resU] = await Promise.all([
        fetch('http://localhost:3001/api/teachers'),
        fetch('http://localhost:3001/api/students'),
        fetch('http://localhost:3001/api/users')
      ])

      let allUsers = [...SEED_USERS];

      if (resT.ok) {
        const teachers = await resT.json()
        const mappedT = teachers.map(t => ({
          ...t,
          id: t._id,
          name: `${t.nombre} ${t.apellido}`,
          email: t.correo,
          role: 'teacher',
          avatar: `${t.nombre[0]}${t.apellido[0]}`.toUpperCase()
        }))
        allUsers = allUsers.filter(u => u.role !== 'teacher')
        allUsers = [...allUsers, ...mappedT]
      }

      if (resS.ok) {
        const students = await resS.json()
        const mappedS = students.map(s => ({
          ...s,
          id: s._id,
          name: `${s.nombre} ${s.apellido}`,
          email: s.correo,
          role: 'student',
          avatar: `${s.nombre[0]}${s.apellido[0]}`.toUpperCase()
        }))
        allUsers = allUsers.filter(u => u.role !== 'student')
        allUsers = [...allUsers, ...mappedS]
      }

      if (resU.ok) {
        const admins = await resU.json()
        const mappedA = admins.map(a => ({ ...a, id: a._id }))
        allUsers = [...allUsers.filter(u => u.role === 'admin' && u.id === 'u1'), ...mappedA]
      }

      setUsers(allUsers)

      // 3. Fetch Classes
      const resClasses = await fetch('http://localhost:3001/api/classes')
      if (resClasses.ok) {
        const dataClasses = await resClasses.json()
        setClasses(dataClasses.map(cl => ({
          ...cl,
          id: cl._id,
          courseId: cl.courseId?._id || cl.courseId
        })))
      }

    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }, [])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Cross-tab real-time sync (classes)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'classai_classes') {
        try { setClasses(JSON.parse(e.newValue)) } catch {}
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // ── AUTH ───────────────────────────────────────────────────────────────────
  // POST /api/auth/login — verifica email + contraseña contra MongoDB
  const login = async (email, password) => {
    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()

      // 403 = cuenta bloqueada o pendiente de aprobación
      if (res.status === 403) return { success: false, error: json.message }

      if (res.ok) {
        const user = { ...json, id: json.id || json._id }
        setCurrentUser(user)
        localStorage.setItem('classai_session', JSON.stringify(user))
        return { success: true, user }
      }

      // 400 / 401 — credenciales incorrectas
      return { success: false, error: json.message || 'Credenciales incorrectas' }

    } catch {
      // ── Error de red: backend no disponible ───────────────────────────────
      return { success: false, error: 'No se pudo conectar al servidor. Verifica que el backend esté corriendo.' }
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('classai_session')
    setActivePage('dashboard')
    setActiveClassId(null)
  }

  // DB STUB: replace with → POST /api/auth/register
  const registerStudent = (data) => {
    if (users.find(u => u.username === data.username)) return { success: false, error: 'El usuario ya existe' }
    if (users.find(u => u.email === data.email)) return { success: false, error: 'El correo ya está registrado' }
    const newUser = {
      id: `u${Date.now()}`,
      name: data.name,
      email: data.email,
      username: data.username,
      password: data.password,
      role: 'student',
      avatar: data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      createdAt: new Date().toISOString().split('T')[0],
    }
    setUsers(prev => [...prev, newUser])
    return { success: true, user: newUser }
  }

  // ── USERS ──────────────────────────────────
  // POST /api/teachers — persists to MongoDB and syncs local state
  const createTeacher = async (data) => {
    // ── [4.1] Required fields (instant FE feedback, no round-trip) ───────────
    const required = ['documento', 'nombre', 'apellido', 'telefono', 'correo', 'clave', 'areaDominio', 'anioInicio']
    if (required.some(f => !data[f] || data[f].toString().trim() === ''))
      return { success: false, error: 'Todos los campos son obligatorios' }

    // ── Field format validations ──────────────────────────────────────────────
    if (!/^\d{8,11}$/.test(data.documento))
      return { success: false, error: 'El documento debe tener entre 8 y 11 dígitos numéricos' }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(data.nombre) || data.nombre.length > 32)
      return { success: false, error: 'El nombre solo puede contener letras (máx. 32 caracteres)' }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(data.apellido) || data.apellido.length > 32)
      return { success: false, error: 'El apellido solo puede contener letras (máx. 32 caracteres)' }
    if (!/^\d{10}$/.test(data.telefono))
      return { success: false, error: 'El teléfono debe tener exactamente 10 dígitos numéricos' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo))
      return { success: false, error: 'El formato del correo es inválido' }
    if (data.clave.length < 8)
      return { success: false, error: 'La clave debe tener al menos 8 caracteres' }
    if (!/^\d{4}$/.test(data.anioInicio))
      return { success: false, error: 'El año de inicio debe tener exactamente 4 dígitos numéricos' }

    // ── Call backend API ──────────────────────────────────────────────────────
    try {
      const res = await fetch('http://localhost:3001/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento:   data.documento,
          nombre:      data.nombre.trim(),
          apellido:    data.apellido.trim(),
          telefono:    data.telefono,
          correo:      data.correo.toLowerCase(),
          clave:       data.clave,
          areaDominio: data.areaDominio,
          anioInicio:  data.anioInicio,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        // [4.2] Backend uniqueness or validation errors
        return { success: false, error: json.message || 'Error al crear el profesor' }
      }

      // ── Sync saved teacher into local state so table refreshes ──────────────
      const fullName = `${json.nombre} ${json.apellido}`
      const localUser = {
        id:          json._id,
        name:        fullName,
        email:       json.correo,
        username:    json.documento,
        role:        'teacher',
        avatar:      fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        createdAt:   new Date(json.createdAt).toISOString().split('T')[0],
        // RF-02 extended fields
        documento:   json.documento,
        nombre:      json.nombre,
        apellido:    json.apellido,
        telefono:    json.telefono,
        correo:      json.correo,
        areaDominio: json.areaDominio,
        anioInicio:  json.anioInicio,
        estado:      json.estado,
      }
      setUsers(prev => [...prev, localUser])
      return { success: true, user: localUser }

    } catch (err) {
      // Network / CORS error
      return { success: false, error: 'No se pudo conectar al servidor. Verifica que el backend esté corriendo en el puerto 3001.' }
    }
  }

  const updateUser = async (role, id, data) => {
    try {
      const endpoint = role === 'teacher' ? `http://localhost:3001/api/teachers/${id}` : `http://localhost:3001/api/students/${id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.message || json.error || 'Error al actualizar' };
      await refreshData();
      return { success: true, user: json };
    } catch (err) {
      return { success: false, error: 'Error de red al actualizar usuario' };
    }
  }

  const deleteUser = async (role, id) => {
    try {
      const endpoint = role === 'teacher' ? `http://localhost:3001/api/teachers/${id}` : `http://localhost:3001/api/students/${id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.message || json.error || 'Error al eliminar' };
      await refreshData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Error de red al eliminar usuario' };
    }
  }

  // ── COURSES ────────────────────────────────
  const createCourse = async (data) => {
    try {
      const res = await fetch('http://localhost:3001/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          category: data.category || 'General',
          teacherId: data.teacherId || null,
          estado: data.estado || 'Activo',
          tipoInscripcion: data.tipoInscripcion || 'Abierto',
          maxStudents: data.maxStudents || 20,
        })
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.message };
      
      const newCourse = { 
        ...json, 
        id: json._id,
        teacherId: json.teacherId?._id || json.teacherId 
      };
      setCourses(prev => [...prev, newCourse]);
      return { success: true, course: newCourse };
    } catch (err) {
      return { success: false, error: 'Network error al crear curso' };
    }
  }

  const updateCourse = async (id, data) => {
    try {
      const dbId = id.toString();
      const res = await fetch(`http://localhost:3001/api/courses/${dbId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.message };
      
      setCourses(prev => prev.map(c => {
        if ((c.id || c._id) === dbId) {
          return { 
            ...c, 
            ...json, 
            id: json._id,
            teacherId: json.teacherId?._id || json.teacherId
          };
        }
        return c;
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error al actualizar curso' };
    }
  }

  const deleteCourse = async (id) => {
    try {
      const dbId = id.toString();
      const res = await fetch(`http://localhost:3001/api/courses/${dbId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const json = await res.json();
        return { success: false, error: json.message || 'Error al eliminar' };
      }
      
      setCourses(prev => prev.filter(c => (c.id || c._id) !== dbId));
      setClasses(prev => prev.filter(cl => cl.courseId !== dbId));
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error al eliminar curso' };
    }
  }

  // RF-08: POST /api/courses/:id/enroll — persists to MongoDB
  const enrollStudent = async (courseId, studentId) => {
    // Optimistic check: already enrolled locally
    const course = courses.find(c => (c.id || c._id) === courseId)
    const normalizedStudentId = String(studentId)
    if (course && course.studentIds.map(String).includes(normalizedStudentId)) {
      return { success: false, alreadyEnrolled: true, error: 'Ya estás inscrito en este curso' }
    }

    try {
      const res = await fetch(`http://localhost:3001/api/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const json = await res.json()
      if (!res.ok) return { success: false, alreadyEnrolled: !!json.alreadyEnrolled, error: json.message || 'Error al inscribirse' }

      // Update local state with the returned course data
      setCourses(prev => prev.map(c =>
        (c.id || c._id) === courseId
          ? { ...c, studentIds: json.studentIds || [...(c.studentIds), studentId] }
          : c
      ))
      return { success: true }
    } catch {
      return { success: false, error: 'No se pudo conectar al servidor' }
    }
  }

  // RF-08: POST /api/courses/:id/unenroll — persists to MongoDB
  const unenrollStudent = async (courseId, studentId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/courses/${courseId}/unenroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const json = await res.json()
      if (!res.ok) return { success: false, error: json.message || 'Error al salir del curso' }

      // Update local state
      setCourses(prev => prev.map(c =>
        (c.id || c._id) === courseId
          ? { ...c, studentIds: json.studentIds || c.studentIds.filter(id => String(id) !== String(studentId)) }
          : c
      ))
      return { success: true }
    } catch {
      return { success: false, error: 'No se pudo conectar al servidor' }
    }
  }

  // RF-08: POST /api/courses/:id/request-enroll
  const requestEnrollment = async (courseId, studentId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/courses/${courseId}/request-enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const json = await res.json()
      if (!res.ok) return { success: false, error: json.message || 'Error al solicitar' }

      await refreshData()
      return { success: true }
    } catch {
      return { success: false, error: 'Error de red' }
    }
  }

  // Admin approval
  const approveEnrollment = async (courseId, studentId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/courses/${courseId}/approve-enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      if (!res.ok) {
        const json = await res.json()
        return { success: false, error: json.message || 'Error al aprobar' }
      }
      await refreshData()
      return { success: true }
    } catch {
      return { success: false, error: 'Error de red' }
    }
  }

  const rejectEnrollment = async (courseId, studentId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/courses/${courseId}/reject-enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      if (!res.ok) {
        const json = await res.json()
        return { success: false, error: json.message || 'Error al rechazar' }
      }
      await refreshData()
      return { success: true }
    } catch {
      return { success: false, error: 'Error de red' }
    }
  }

  // ── CLASSES ────────────────────────────────
  // RF-10: Create Class
  const createClass = async (data) => {
    try {
      const res = await fetch('http://localhost:3001/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: data.courseId,
          title: data.title,
          description: data.description,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          sessionType: data.sessionType || 'Live',
          isActive: true
        })
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.message || 'Error al crear la clase' };

      const newClass = { ...json, id: json._id };
      setClasses(prev => [...prev, newClass]);
      return { success: true, class: newClass };
    } catch (err) {
      return { success: false, error: 'Error de red al crear la clase' };
    }
  }

  // PUT /api/classes/:id/activate — persists to MongoDB
  const activateClass = async (classId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/activate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const json = await res.json()
        setClasses(prev => prev.map(cl =>
          String(cl.id || cl._id) === String(classId) ? { ...json, id: json._id } : cl
        ))
        return { success: true }
      }
      return { success: false, error: 'Error al activar la clase' }
    } catch (err) {
      console.error('Error activating class:', err)
      return { success: false, error: 'Error de red' }
    }
  }

  // RF-10 Adjustment: Finalize Class
  const deactivateClass = async (classId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/deactivate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        setClasses(prev => prev.map(cl =>
          (cl.id === classId || cl._id === classId) ? { ...json, id: json._id } : cl
        ));
        return { success: true };
      }
      return { success: false, error: 'Error al desactivar la clase' };
    } catch (err) {
      return { success: false, error: 'Error de red' };
    }
  }

  // Periodic refresh for real-time simulation (polling)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh classes if there's an active class or we are in a dashboard
      if (activeClassId || activePage === 'dashboard' || activePage === 'my-courses') {
        refreshData();
      }
    }, 4000); // 4 seconds polling
    return () => clearInterval(interval);
  }, [activeClassId, activePage, refreshData]);

  // POST /api/classes/:id/join — persists to MongoDB
  const joinClass = async (classId, userId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setClasses(prev => prev.map(cl =>
          String(cl.id || cl._id) === String(classId)
            ? { ...cl, participantIds: updated.participantIds, attendance: updated.attendance }
            : cl
        ))
      }
    } catch (err) {
      console.error('Error joining class:', err)
    }
  }

  // POST /api/classes/:id/leave — persists to MongoDB
  const leaveClass = async (classId, userId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setClasses(prev => prev.map(cl =>
          String(cl.id || cl._id) === String(classId)
            ? { ...cl, participantIds: updated.participantIds }
            : cl
        ))
      }
    } catch (err) {
      console.error('Error leaving class:', err)
    }
  }

  // POST /api/classes/:id/transcription — persists to MongoDB
  const appendTranscription = useCallback(async (classId, segment) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(segment)
      })
      if (res.ok) {
        const updatedCls = await res.json()
        setClasses(prev => prev.map(cl => String(cl.id || cl._id) === String(classId) ? { ...cl, transcription: updatedCls.transcription } : cl))
      }
    } catch (err) {
      console.error('Error appending transcription:', err)
    }
  }, [])

  const pauseTranscription = useCallback((classId) => {
    // State managed locally in teacher component; this is intentionally a no-op here
  }, [])

  const clearTranscription = useCallback(async (classId) => {
    // Clear locally first for instant UI feedback, backend doesn't have a dedicated clear endpoint
    setClasses(prev => prev.map(cl =>
      String(cl.id || cl._id) === String(classId) ? { ...cl, transcription: [] } : cl
    ))
  }, [])

  // PUT /api/classes/:id/transcription/save — persists to MongoDB
  const saveTranscription = useCallback(async (classId) => {
    try {
      const cls = classes.find(cl => String(cl.id || cl._id) === String(classId))
      const text = (cls?.transcription || []).map(s => s.text).join(' ')
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/transcription/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const json = await res.json()
        setClasses(prev => prev.map(cl =>
          String(cl.id || cl._id) === String(classId) ? { ...cl, savedTranscription: json.savedTranscription || text } : cl
        ))
      }
    } catch (err) {
      console.error('Error saving transcription:', err)
    }
  }, [classes])

  // PUT /api/classes/:id/summary — persists to MongoDB
  const setSummary = async (classId, summary) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      })
      if (res.ok) {
        setClasses(prev => prev.map(cl =>
          String(cl.id || cl._id) === String(classId) ? { ...cl, summary } : cl
        ))
      }
    } catch (err) {
      console.error('Error setting summary:', err)
    }
  }

  // POST /api/classes/:id/questions — persists to MongoDB
  const sendQuestion = async (classId, userId, text, isQuickReply = false) => {
    try {
      const user = users.find(u => u.id === userId)
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName: user?.name || 'Estudiante',
          userAvatar: user?.avatar || 'ES',
          text,
          isQuickReply,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setClasses(prev => prev.map(cl =>
          String(cl.id || cl._id) === String(classId)
            ? { ...cl, questions: updated.questions }
            : cl
        ))
      }
    } catch (err) {
      console.error('Error sending question:', err)
    }
  }

  // PUT /api/classes/:classId/questions/:questionId/answer — persists to MongoDB
  const answerQuestion = async (classId, questionId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/questions/${questionId}/answer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const updated = await res.json()
        setClasses(prev => prev.map(cl =>
          String(cl.id || cl._id) === String(classId)
            ? { ...cl, questions: updated.questions }
            : cl
        ))
      }
    } catch (err) {
      console.error('Error answering question:', err)
    }
  }

  // RF-11: Attention Checks
  const launchAttentionCheck = async (classId, timeoutSecs = 30) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/attention-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutSecs }),
      })
      const json = await res.json()
      if (!res.ok) return { success: false, error: json.message || 'Error al lanzar verificación' }
      setClasses(prev => prev.map(cl =>
        String(cl.id || cl._id) === String(classId) ? { ...cl, attentionChecks: json.attentionChecks } : cl
      ))
      return { success: true }
    } catch {
      return { success: false, error: 'Error de red' }
    }
  }

  const respondAttentionCheck = async (classId, checkId, userId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/classes/${classId}/attention-check/${checkId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) return { success: false, error: json.message || 'Error al responder' }
      setClasses(prev => prev.map(cl =>
        String(cl.id || cl._id) === String(classId) ? { ...cl, attentionChecks: json.attentionChecks } : cl
      ))
      return { success: true }
    } catch {
      return { success: false, error: 'Error de red' }
    }
  }

  // RF-07: Course Contents
  const addCourseContent = async (courseId, formData) => {
    try {
      const dbId = courseId.toString();
      const res = await fetch(`http://localhost:3001/api/courses/${dbId}/contents`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.message || 'Error agregando contenido' };

      setCourses(prev => prev.map(c => 
        (c.id || c._id) === dbId ? { ...c, contents: [...(c.contents || []), json] } : c
      ));
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Error de red al agregar contenido' };
    }
  }

  const deleteCourseContent = async (courseId, contentId) => {
    try {
      const dbId = courseId.toString();
      const res = await fetch(`http://localhost:3001/api/courses/${dbId}/contents/${contentId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const json = await res.json();
        return { success: false, error: json.message || 'Error al eliminar contenido' };
      }

      setCourses(prev => prev.map(c => 
        (c.id || c._id) === dbId 
          ? { ...c, contents: (c.contents || []).filter(cnt => cnt._id !== contentId) }
          : c
      ));
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Error de red al eliminar contenido' };
    }
  }

  // RF-09: Grades
  const saveGrade = async (gradeData) => {
    try {
      const res = await fetch('http://localhost:3001/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gradeData),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.message || 'Error al guardar calificación' };

      // Update local grades state
      setGrades(prev => {
        const index = prev.findIndex(g => 
          String(g.studentId?._id || g.studentId) === String(gradeData.studentId) && 
          String(g.courseId?._id || g.courseId) === String(gradeData.courseId) && 
          String(g.contentId?._id || g.contentId) === String(gradeData.contentId)
        );
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...json };
          return updated;
        }
        return [...prev, json];
      });
      return { success: true, grade: json };
    } catch (err) {
      return { success: false, error: 'Error de red al guardar calificación' };
    }
  }

  const fetchGradesByCourse = async (courseId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/grades/course/${courseId}`);
      const json = await res.json();
      if (res.ok) {
        setGrades(prev => {
          // Merge or replace grades for this course
          const otherGrades = prev.filter(g => String(g.courseId?._id || g.courseId) !== String(courseId));
          return Array.isArray(json) ? [...otherGrades, ...json] : otherGrades;
        });
        return { success: true, grades: json };
      }
      return { success: false, error: json.message || 'Error al obtener calificaciones' };
    } catch (err) {
      return { success: false, error: 'Error de red al obtener calificaciones' };
    }
  }

  const fetchGradesByStudent = async (studentId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/grades/student/${studentId}`);
      const json = await res.json();
      if (res.ok) {
        setGrades(prev => {
          const otherGrades = prev.filter(g => String(g.studentId?._id || g.studentId) !== String(studentId));
          return Array.isArray(json) ? [...otherGrades, ...json] : otherGrades;
        });
        return { success: true, grades: json };
      }
      return { success: false, error: json.message || 'Error al obtener calificaciones' };
    } catch (err) {
      return { success: false, error: 'Error de red al obtener calificaciones' };
    }
  }

  // ── HELPERS ────────────────────────────────
  const getUserById      = (id) => users.find(u => String(u.id || u._id) === String(id))
  const getCourseById    = (id) => courses.find(c => String(c.id || c._id) === String(id))
  const getClassById     = (id) => classes.find(cl => String(cl.id || cl._id) === String(id))
  const getClassesForCourse  = (courseId) => classes.filter(cl => String(cl.courseId) === String(courseId))
  const getCoursesForTeacher = (teacherId) => courses.filter(c => String(c.teacherId) === String(teacherId))
  const getCoursesForStudent = (studentId) => courses.filter(c => c.studentIds.map(String).includes(String(studentId)))
  const getActiveClasses     = () => classes.filter(cl => cl.isActive)

  const value = {
    // State
    users, courses, classes, currentUser, activePage, activeClassId,
    // Navigation
    setActivePage, setActiveClassId, refreshData,
    // Auth
    login, logout, registerStudent,
    // Users
    createTeacher, updateUser, deleteUser,
    // Courses
    createCourse, updateCourse, deleteCourse, enrollStudent, unenrollStudent,
    addCourseContent, deleteCourseContent, requestEnrollment, approveEnrollment, rejectEnrollment,
    // Classes
    createClass, activateClass, deactivateClass, joinClass, leaveClass,
    appendTranscription, clearTranscription, saveTranscription, setSummary,
    sendQuestion, answerQuestion, launchAttentionCheck, respondAttentionCheck,
    // Grades
    grades, saveGrade, fetchGradesByCourse, fetchGradesByStudent,
    // Helpers
    getUserById, getCourseById, getClassById, getClassesForCourse,
    getCoursesForTeacher, getCoursesForStudent, getActiveClasses,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
