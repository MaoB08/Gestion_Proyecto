import { AppProvider, useApp } from './context/AppContext'
import './index.css'

// Pages – Auth
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

// Pages – Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import CoursesPage from './pages/admin/CoursesPage'
import ReportsPage from './pages/admin/ReportsPage'
import EnrollmentRequestsPage from './pages/admin/EnrollmentRequestsPage'

// Pages – Teacher
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import ClassroomTeacher from './pages/teacher/ClassroomTeacher'

// Pages – Student
import StudentDashboard from './pages/student/StudentDashboard'
import ClassroomStudent from './pages/student/ClassroomStudent'

// Shared layout
import Sidebar from './components/Sidebar'

// SVG Icons for Optimization
const OptimizationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const IndexInsight = ({ insight, onHide }) => {
  if (!insight) return null;
  
  const indexLabels = {
    'index_user_email': 'Email (Login Admin)',
    'index_teacher_correo': 'Correo (Login Docente)',
    'index_student_correo': 'Correo (Login Estudiante)',
    'index_course_teacherId': 'ID Docente (Filtrado Cursos)',
    'index_course_studentIds': 'ID Estudiante (Mis Cursos)',
    'index_class_courseId': 'ID Curso (Sesiones)',
    'index_grade_studentId': 'ID Estudiante (Calificaciones)'
  };

  return (
    <div className="index-insight-overlay fade-in">
      <div className="index-insight-card">
        <div className="index-insight-icon">
          <OptimizationIcon />
        </div>
        <div className="index-insight-content">
          <div className="index-insight-title">Consulta Optimizada</div>
          <div className="index-insight-body">
            Se utilizó el índice: <strong>{indexLabels[insight.name] || insight.name}</strong>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ color: 'white', opacity: 0.7, padding: '4px 8px', marginLeft: 10 }} onClick={onHide}>✕</button>
      </div>
    </div>
  );
};

function InnerApp() {
  const { currentUser, activePage, activeClassId, indexInsight, setIndexInsight } = useApp()

  // Not authenticated → auth pages
  if (!currentUser) {
    if (activePage === 'register') return <RegisterPage />
    return <LoginPage />
  }

  // Normal layout with sidebar
  return (
    <div className="app-layout">
      <IndexInsight insight={indexInsight} onHide={() => {
        console.log('Hiding insight manually');
        setIndexInsight(null);
      }} />
      <Sidebar />
      <div className="main-content">
        {currentUser.role === 'admin'   && <AdminRouter   page={activePage} classId={activeClassId} />}
        {currentUser.role === 'teacher' && <TeacherRouter page={activePage} classId={activeClassId} />}
        {currentUser.role === 'student' && <StudentRouter page={activePage} classId={activeClassId} />}
      </div>
    </div>
  )
}

function AdminRouter({ page, classId }) {
  switch (page) {
    case 'users':      return <UsersPage />
    case 'courses':    return <CoursesPage />
    case 'reports':    return <ReportsPage />
    case 'enrollment': return <EnrollmentRequestsPage />
    case 'classroom':  return classId ? <ClassroomTeacher classId={classId} /> : <AdminDashboard />
    default:           return <AdminDashboard />
  }
}

function TeacherRouter({ page, classId }) {
  switch (page) {
    case 'classroom': return classId ? <ClassroomTeacher classId={classId} /> : <TeacherDashboard />
    default: return <TeacherDashboard />
  }
}

function StudentRouter({ page, classId }) {
  switch (page) {
    case 'classroom': return classId ? <ClassroomStudent classId={classId} /> : <StudentDashboard />
    default: return <StudentDashboard />
  }
}

export default function App() {
  return (
    <AppProvider>
      <InnerApp />
    </AppProvider>
  )
}
