"use client";

import React, { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { 
  Play, Plus, Edit, Trash2, ArrowUp, ArrowDown, 
  Lock, Unlock, LogOut, BookOpen, X, Clock
} from 'lucide-react';
import { 
  updateCourse,
  createModule, updateModule, deleteModule,
  saveLesson, updateLesson, deleteLesson,
  CourseStructure 
} from '@/app/actions';
import { loginAdmin, logoutUser } from '@/app/auth-actions';
import { MAX_PDF_BYTES, type ResourceLink } from '@/lib/lesson-resources';
import styles from '../admin/admin.module.css';

interface AdminDashboardClientProps {
  initialData: CourseStructure | null;
  initialAuth: boolean;
}

export default function AdminDashboardClient({ initialData, initialAuth }: AdminDashboardClientProps) {
  const [data, setData] = useState<CourseStructure | null>(initialData);
  const isAuthenticated = initialAuth;
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Selection state
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(initialData?.modules[0]?.id ?? null);

  // Transitions
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [modalType, setModalType] = useState<
    'editCourse' | 'createModule' | 'editModule' | 'deleteModule' | 'createLesson' | 'editLesson' | 'deleteLesson' | null
  >(null);
  
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Form Fields State
  const [courseForm, setCourseForm] = useState({ title: '', description: '' });
  const [moduleForm, setModuleForm] = useState({ id: 0, title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ 
    id: 0, 
    title: '', 
    description: '', 
    video_url: '', 
    duration_minutes: 0 
  });
  const [links, setLinks] = useState<ResourceLink[]>([]);
  const [slides, setSlides] = useState<File | null>(null);
  const [slidesName, setSlidesName] = useState<string | null>(null);
  const [removeSlides, setRemoveSlides] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);

  const loadResources = (lesson?: CourseStructure['lessons'][number]) => {
    setLinks(lesson?.resource_links.map(link => ({ ...link })) || []);
    setSlides(null);
    setSlidesName(lesson?.slides_name || null);
    setRemoveSlides(false);
    setSaveError('');
    setFileInputKey(key => key + 1);
  };

  // Dialog open/close controller
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (modalType) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [modalType]);

  // --- ACTIONS ---
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    
    try {
      const res = await loginAdmin(email, password);
      if (res.success) {
        // Reload data to make sure we sync with Neon
        window.location.reload();
      } else {
        setLoginError(res.error || 'Error al iniciar sesión');
      }
    } catch {
      setLoginError('Error de red al conectar con el servidor');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      window.location.assign('/');
    } catch {
      setLogoutError('No se pudo cerrar la sesión. Intenta nuevamente.');
    }
  };

  // --- MODULE ACTIONS ---

  const moveModule = async (moduleId: number, direction: 'up' | 'down') => {
    if (!data) return;
    const index = data.modules.findIndex(m => m.id === moduleId);
    if (index === -1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= data.modules.length) return;

    const currentModule = data.modules[index];
    const targetModule = data.modules[targetIndex];

    const currentPos = currentModule.position;
    const targetPos = targetModule.position;

    // Optimistic Update
    const updatedModules = [...data.modules];
    updatedModules[index] = { ...currentModule, position: targetPos };
    updatedModules[targetIndex] = { ...targetModule, position: currentPos };
    updatedModules.sort((a, b) => a.position - b.position);

    setData({
      ...data,
      modules: updatedModules
    });

    // Database Sync
    startTransition(async () => {
      await updateModule(currentModule.id, currentModule.title, currentModule.description, targetPos);
      await updateModule(targetModule.id, targetModule.title, targetModule.description, currentPos);
    });
  };

  const handleSaveModule = async () => {
    if (!data) return;
    
    startTransition(async () => {
      if (modalType === 'createModule') {
        const nextPosition = data.modules.length > 0 
          ? Math.max(...data.modules.map(m => m.position)) + 1 
          : 1;
        await createModule(data.course.id, moduleForm.title, moduleForm.description, nextPosition);
      } else if (modalType === 'editModule') {
        const existing = data.modules.find(m => m.id === moduleForm.id);
        const position = existing ? existing.position : 1;
        await updateModule(moduleForm.id, moduleForm.title, moduleForm.description, position);
      }
      
      // Refresh local state by pulling from router refresh or reloading
      window.location.reload();
    });
    setModalType(null);
  };

  const handleDeleteModule = async () => {
    if (moduleForm.id === 0) return;
    
    startTransition(async () => {
      await deleteModule(moduleForm.id);
      window.location.reload();
    });
    setModalType(null);
  };

  // --- LESSON ACTIONS ---

  const moveLesson = async (lessonId: number, direction: 'up' | 'down') => {
    if (!data || selectedModuleId === null) return;
    
    const moduleLessons = data.lessons.filter(l => l.module_id === selectedModuleId);
    const index = moduleLessons.findIndex(l => l.id === lessonId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= moduleLessons.length) return;

    const currentLesson = moduleLessons[index];
    const targetLesson = moduleLessons[targetIndex];

    const currentPos = currentLesson.position;
    const targetPos = targetLesson.position;

    // Optimistic Update
    const updatedLessons = data.lessons.map(l => {
      if (l.id === currentLesson.id) return { ...l, position: targetPos };
      if (l.id === targetLesson.id) return { ...l, position: currentPos };
      return l;
    }).sort((a, b) => a.position - b.position);

    setData({
      ...data,
      lessons: updatedLessons
    });

    // Database Sync
    startTransition(async () => {
      await updateLesson(currentLesson.id, currentLesson.title, currentLesson.description, currentLesson.video_url, currentLesson.duration_seconds, targetPos);
      await updateLesson(targetLesson.id, targetLesson.title, targetLesson.description, targetLesson.video_url, targetLesson.duration_seconds, currentPos);
    });
  };

  const handleSaveLesson = async () => {
    if (!data || selectedModuleId === null) return;
    
    startTransition(async () => {
      setSaveError('');
      try {
        const moduleLessons = data.lessons.filter(l => l.module_id === selectedModuleId);
        const existing = data.lessons.find(l => l.id === lessonForm.id);
        const position = existing?.position ?? (moduleLessons.length > 0
          ? Math.max(...moduleLessons.map(l => l.position)) + 1 : 1);
        const form = new FormData();
        form.set('id', String(lessonForm.id));
        form.set('moduleId', String(selectedModuleId));
        form.set('title', lessonForm.title);
        form.set('description', lessonForm.description);
        form.set('videoUrl', lessonForm.video_url);
        form.set('duration', String(lessonForm.duration_minutes * 60));
        form.set('position', String(position));
        form.set('links', JSON.stringify(links));
        form.set('removeSlides', String(removeSlides));
        if (slides) form.set('slides', slides);
        const result = await saveLesson(form);
        if (!result.success) {
          setSaveError(result.error || 'No se pudo guardar la lección.');
          return;
        }
        window.location.reload();
      } catch {
        setSaveError('No se pudo guardar la lección. Revisa tu sesión y vuelve a intentar.');
      }
    });
  };

  const handleDeleteLesson = async () => {
    if (lessonForm.id === 0) return;
    
    startTransition(async () => {
      await deleteLesson(lessonForm.id);
      window.location.reload();
    });
    setModalType(null);
  };

  // --- COURSE SAVE ACTION ---

  const handleSaveCourse = async () => {
    if (!data) return;
    startTransition(async () => {
      await updateCourse(data.course.id, courseForm.title, courseForm.description);
      window.location.reload();
    });
    setModalType(null);
  };

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <div className={styles.logoIcon} style={{ margin: '0 auto 12px', width: '48px', height: '48px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
              <Lock size={22} />
            </div>
            <h2 className={styles.loginTitle}>Acceso Administrador</h2>
            <p className={styles.loginDesc}>
              Ingresa el correo y la contraseña del administrador para editar el contenido del curso.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.formGroup}>
              <label htmlFor="admin-email" className={styles.formLabel}>Correo electrónico</label>
              <input id="admin-email" type="email" autoComplete="email" required maxLength={254}
                value={email} onChange={e => setEmail(e.target.value)} disabled={isLoggingIn} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="pass" className={styles.formLabel}>Contraseña</label>
              <input 
                id="pass"
                type="password" 
                autoComplete="current-password"
                maxLength={128}
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoggingIn}
              />
            </div>

            {loginError && <div role="alert" className={styles.errorMsg}>{loginError}</div>}

            <button type="submit" className={styles.loginBtn} disabled={isLoggingIn}>
              {isLoggingIn ? 'Verificando...' : 'Entrar al Panel'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textDecoration: 'underline' }}>
              Volver al Portal Estudiante
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- NO DATA CORRECTION SCREEN ---
  if (!data) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logoIcon}><BookOpen size={18} /></div>
            <h1 className={styles.brandTitle}>Panel de Administración</h1>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} /> Salir
          </button>
        </header>
        <div className={styles.loginContainer} style={{ minHeight: 'calc(100vh - 73px)' }}>
          <div className={styles.loginCard} style={{ maxWidth: '500px' }}>
            <h3 className={styles.loginTitle} style={{ color: 'var(--danger)' }}>Base de datos no conectada</h3>
            <p className={styles.loginDesc} style={{ textAlign: 'left', marginBottom: '16px' }}>
              No se ha podido inicializar el curso en la base de datos Neon. Asegúrate de configurar la variable <code>DATABASE_URL</code> en tu archivo <code>.env.local</code>.
            </p>
            <button onClick={() => window.location.reload()} className={styles.loginBtn}>
              Reintentar Conexión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- FULL ADMIN INTERFACE ---
  
  const currentModule = data.modules.find(m => m.id === selectedModuleId);
  const currentLessons = data.lessons.filter(l => l.module_id === selectedModuleId);

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <Unlock size={18} />
          </div>
          <div>
            <h1 className={styles.brandTitle}>Panel de Control: {data.course.title}</h1>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link href="/" className={styles.viewPortalBtn}>
            Ver Portal Estudiante
          </Link>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </header>

      {logoutError && <p role="alert" className={styles.errorMsg}>{logoutError}</p>}
      {/* COURSE CONFIGURATION BANNER */}
      <section className={styles.courseBanner}>
        <div className={styles.courseBannerTitle}>
          <strong>Curso Activo:</strong> {data.course.title}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
            {data.course.description}
          </div>
        </div>
        <button 
          className={styles.editCourseBtn}
          onClick={() => {
            setCourseForm({ title: data.course.title, description: data.course.description });
            setModalType('editCourse');
          }}
        >
          <Edit size={12} style={{ marginRight: '6px' }} /> Editar Curso
        </button>
      </section>

      {/* CORE WORKSPACE */}
      <main className={styles.workspace}>
        {/* COLUMN 1: MODULES */}
        <div className={`${styles.column} ${styles.modulesCol}`}>
          <div className={styles.colHeader}>
            <h3 className={styles.colTitle}>Módulos ({data.modules.length})</h3>
            <button 
              className={styles.addBtn}
              onClick={() => {
                setModuleForm({ id: 0, title: '', description: '' });
                setModalType('createModule');
              }}
            >
              <Plus size={14} /> Módulo
            </button>
          </div>

          <div className={styles.scrollList}>
            {data.modules.map((m, index) => (
              <div 
                key={m.id} 
                className={`${styles.itemCard} ${selectedModuleId === m.id ? styles.selected : ''}`}
                onClick={() => setSelectedModuleId(m.id)}
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{m.title}</span>
                  <span className={styles.itemMeta}>
                    Posición: {m.position} • {data.lessons.filter(l => l.module_id === m.id).length} lecciones
                  </span>
                </div>

                <div className={styles.actionsGroup}>
                  {/* Position reordering */}
                  <button 
                    className={styles.arrowBtn}
                    onClick={(e) => { e.stopPropagation(); moveModule(m.id, 'up'); }}
                    disabled={index === 0}
                    title="Mover arriba"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button 
                    className={styles.arrowBtn}
                    onClick={(e) => { e.stopPropagation(); moveModule(m.id, 'down'); }}
                    disabled={index === data.modules.length - 1}
                    title="Mover abajo"
                  >
                    <ArrowDown size={12} />
                  </button>
                  
                  {/* Edit/Delete */}
                  <button 
                    className={styles.actionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModuleForm({ id: m.id, title: m.title, description: m.description });
                      setModalType('editModule');
                    }}
                    title="Editar módulo"
                  >
                    <Edit size={12} />
                  </button>
                  <button 
                    className={`${styles.actionBtn} ${styles.delete}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModuleForm({ id: m.id, title: m.title, description: m.description });
                      setModalType('deleteModule');
                    }}
                    title="Eliminar módulo"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 2: LESSONS */}
        <div className={`${styles.column} ${styles.lessonsCol}`}>
          <div className={styles.colHeader}>
            <h3 className={styles.colTitle}>
              Lecciones de: {currentModule ? currentModule.title : 'Selecciona un módulo'}
            </h3>
            {currentModule && (
              <button 
                className={styles.addBtn}
                onClick={() => {
                  setLessonForm({ id: 0, title: '', description: '', video_url: '', duration_minutes: 10 });
                  loadResources();
                  setModalType('createLesson');
                }}
              >
                <Plus size={14} /> Lección
              </button>
            )}
          </div>

          <div className={styles.scrollList}>
            {currentModule ? (
              currentLessons.length > 0 ? (
                currentLessons.map((l, index) => (
                  <div key={l.id} className={styles.itemCard} style={{ cursor: 'default' }}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{l.title}</span>
                      <span className={styles.itemMeta} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <span>Posición: {l.position}</span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={11} /> {Math.round(l.duration_seconds / 60)} min
                        </span>
                        <span>•</span>
                        <span style={{ color: 'var(--primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.video_url}
                        </span>
                      </span>
                    </div>

                    <div className={styles.actionsGroup}>
                      {/* Position reordering */}
                      <button 
                        className={styles.arrowBtn}
                        onClick={() => moveLesson(l.id, 'up')}
                        disabled={index === 0}
                        title="Mover arriba"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button 
                        className={styles.arrowBtn}
                        onClick={() => moveLesson(l.id, 'down')}
                        disabled={index === currentLessons.length - 1}
                        title="Mover abajo"
                      >
                        <ArrowDown size={12} />
                      </button>

                      {/* Edit/Delete */}
                      <button 
                        className={styles.actionBtn}
                        onClick={() => {
                          setLessonForm({
                            id: l.id,
                            title: l.title,
                            description: l.description,
                            video_url: l.video_url,
                            duration_minutes: Math.round(l.duration_seconds / 60)
                          });
                          loadResources(l);
                          setModalType('editLesson');
                        }}
                        title="Editar lección"
                      >
                        <Edit size={12} />
                      </button>
                      <button 
                        className={`${styles.actionBtn} ${styles.delete}`}
                        onClick={() => {
                          setLessonForm({
                            id: l.id,
                            title: l.title,
                            description: l.description,
                            video_url: l.video_url,
                            duration_minutes: Math.round(l.duration_seconds / 60)
                          });
                          loadResources(l);
                          setModalType('deleteLesson');
                        }}
                        title="Eliminar lección"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.loginContainer} style={{ minHeight: '300px' }}>
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Play size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p>No hay lecciones creadas en este módulo.</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Comienza agregando tu primera lección usando el botón &quot;Añadir Lección&quot;.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className={styles.loginContainer} style={{ minHeight: '300px' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Selecciona o crea un módulo en el menú lateral.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- FORM DIALOG MODAL --- */}
      <dialog ref={dialogRef} className={styles.dialog} onCancel={() => setModalType(null)}>
        {/* EDIT COURSE */}
        {modalType === 'editCourse' && (
          <>
            <div className={styles.dialogHeader}>
              <h3 className={styles.dialogTitle}>Editar Información del Curso</h3>
              <button className={styles.closeDialogBtn} onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Título del Curso</label>
                <input 
                  type="text" 
                  value={courseForm.title} 
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  placeholder="Ej. Introducción al Estudio Teológico"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Descripción del Curso</label>
                <textarea 
                  value={courseForm.description} 
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="Describe de qué trata el curso..."
                  rows={4}
                />
              </div>
            </div>
            <div className={styles.dialogFooter}>
              <button className={styles.cancelBtn} onClick={() => setModalType(null)}>Cancelar</button>
              <button className={styles.saveBtn} onClick={handleSaveCourse} disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar Curso'}
              </button>
            </div>
          </>
        )}

        {/* CREATE / EDIT MODULE */}
        {(modalType === 'createModule' || modalType === 'editModule') && (
          <>
            <div className={styles.dialogHeader}>
              <h3 className={styles.dialogTitle}>
                {modalType === 'createModule' ? 'Crear Nuevo Módulo' : 'Editar Módulo'}
              </h3>
              <button className={styles.closeDialogBtn} onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Título del Módulo</label>
                <input 
                  type="text" 
                  value={moduleForm.title} 
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  placeholder="Ej. Módulo 1: Fundamentos Básicos"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Descripción del Módulo (Opcional)</label>
                <textarea 
                  value={moduleForm.description} 
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  placeholder="Breve resumen de los temas a cubrir..."
                  rows={3}
                />
              </div>
            </div>
            <div className={styles.dialogFooter}>
              <button className={styles.cancelBtn} onClick={() => setModalType(null)}>Cancelar</button>
              <button className={styles.saveBtn} onClick={handleSaveModule} disabled={isPending}>
                {isPending ? 'Guardando...' : modalType === 'createModule' ? 'Crear Módulo' : 'Guardar Cambios'}
              </button>
            </div>
          </>
        )}

        {/* DELETE MODULE CONFIRM */}
        {modalType === 'deleteModule' && (
          <>
            <div className={styles.dialogHeader}>
              <h3 className={styles.dialogTitle} style={{ color: 'var(--danger)' }}>Eliminar Módulo</h3>
              <button className={styles.closeDialogBtn} onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <div className={styles.dialogBody}>
              <p>¿Estás seguro que deseas eliminar el módulo <strong>{moduleForm.title}</strong>?</p>
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px' }}>
                ⚠️ Esta acción es irreversible y eliminará permanentemente todas las lecciones y progresos asociados a este módulo.
              </p>
            </div>
            <div className={styles.dialogFooter}>
              <button className={styles.cancelBtn} onClick={() => setModalType(null)}>Cancelar</button>
              <button className={styles.deleteConfirmBtn} onClick={handleDeleteModule} disabled={isPending}>
                {isPending ? 'Eliminando...' : 'Sí, Eliminar Módulo'}
              </button>
            </div>
          </>
        )}

        {/* CREATE / EDIT LESSON */}
        {(modalType === 'createLesson' || modalType === 'editLesson') && (
          <>
            <div className={styles.dialogHeader}>
              <h3 className={styles.dialogTitle}>
                {modalType === 'createLesson' ? 'Añadir Nueva Lección' : 'Editar Lección'}
              </h3>
              <button className={styles.closeDialogBtn} onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Título de la Lección</label>
                <input 
                  type="text" 
                  value={lessonForm.title} 
                  disabled={isPending}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  placeholder="Ej. 1.1 Introducción Histórica"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Enlace del Video (YouTube, Vimeo o URL Directa MP4)</label>
                <input 
                  type="text" 
                  value={lessonForm.video_url} 
                  disabled={isPending}
                  onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Acepta enlaces estándar de YouTube, Vimeo, o URLs directas a archivos de video (.mp4).
                </span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Duración Aproximada (en minutos)</label>
                <input 
                  type="number" 
                  value={lessonForm.duration_minutes} 
                  disabled={isPending}
                  onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="Ej. 15"
                  min="0"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Descripción y Recursos (Soporta Markdown)</label>
                <textarea 
                  value={lessonForm.description} 
                  disabled={isPending}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  placeholder="Contenido de la lección, notas o recursos externos... Puedes usar **negritas** o listas con guiones (-)."
                  rows={6}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="lesson-slides" className={styles.formLabel}>Diapositivas (PDF, máximo 10 MB)</label>
                {slidesName && !removeSlides && (
                  <div>
                    <a href={`/api/lessons/${lessonForm.id}/slides`}>{slidesName}</a>
                    <button type="button" className={styles.cancelBtn} disabled={isPending}
                      onClick={() => { setRemoveSlides(true); setSlides(null); setFileInputKey(key => key + 1); }}>
                      Eliminar PDF
                    </button>
                  </div>
                )}
                {removeSlides && <p>El PDF se eliminará al guardar los cambios.</p>}
                <input key={fileInputKey} id="lesson-slides" type="file" accept=".pdf,application/pdf" disabled={isPending}
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setSaveError('');
                    if (file && (file.size > MAX_PDF_BYTES || file.size === 0)) {
                      setSaveError('El PDF debe pesar como máximo 10 MB y no puede estar vacío.');
                      e.target.value = '';
                      setSlides(null);
                      return;
                    }
                    setSlides(file);
                    if (file) setRemoveSlides(false);
                  }} />
                <small>Selecciona un archivo para añadir o reemplazar las diapositivas.</small>
                {slides && <button type="button" className={styles.cancelBtn} disabled={isPending}
                  onClick={() => { setSlides(null); setFileInputKey(key => key + 1); }}>Cancelar archivo seleccionado</button>}
              </div>
              <div className={styles.formGroup}>
                <h4 className={styles.formLabel}>Enlaces de estudio</h4>
                {links.map((link, index) => (
                  <div key={index} className={styles.resourceRow}>
                    <input aria-label={`Título del enlace ${index + 1}`} placeholder="Título del recurso"
                      value={link.title} maxLength={255} disabled={isPending}
                      onChange={e => setLinks(links.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} />
                    <input aria-label={`URL del enlace ${index + 1}`} type="url" placeholder="https://..."
                      value={link.url} disabled={isPending}
                      onChange={e => setLinks(links.map((item, i) => i === index ? { ...item, url: e.target.value } : item))} />
                    <button type="button" className={styles.cancelBtn} disabled={isPending}
                      aria-label={`Eliminar enlace ${index + 1}`} onClick={() => setLinks(links.filter((_, i) => i !== index))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" className={styles.cancelBtn} disabled={isPending}
                  onClick={() => setLinks([...links, { title: '', url: '' }])}>
                  <Plus size={14} /> Añadir enlace
                </button>
              </div>
              {saveError && <p role="alert" className={styles.errorMsg}>{saveError}</p>}
            </div>
            <div className={styles.dialogFooter}>
              <button className={styles.cancelBtn} onClick={() => setModalType(null)}>Cancelar</button>
              <button className={styles.saveBtn} onClick={handleSaveLesson} disabled={isPending}>
                {isPending ? 'Guardando...' : modalType === 'createLesson' ? 'Crear Lección' : 'Guardar Cambios'}
              </button>
            </div>
          </>
        )}

        {/* DELETE LESSON CONFIRM */}
        {modalType === 'deleteLesson' && (
          <>
            <div className={styles.dialogHeader}>
              <h3 className={styles.dialogTitle} style={{ color: 'var(--danger)' }}>Eliminar Lección</h3>
              <button className={styles.closeDialogBtn} onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <div className={styles.dialogBody}>
              <p>¿Estás seguro que deseas eliminar la lección <strong>{lessonForm.title}</strong>?</p>
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px' }}>
                ⚠️ Esta acción es irreversible y eliminará permanentemente todos los progresos de visualización de los estudiantes para esta lección.
              </p>
            </div>
            <div className={styles.dialogFooter}>
              <button className={styles.cancelBtn} onClick={() => setModalType(null)}>Cancelar</button>
              <button className={styles.deleteConfirmBtn} onClick={handleDeleteLesson} disabled={isPending}>
                {isPending ? 'Eliminando...' : 'Sí, Eliminar Lección'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
