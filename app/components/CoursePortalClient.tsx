"use client";

import React, { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { 
  Play, Check, ChevronDown, ChevronUp, Search, 
  Menu, X, Award, Clock, ExternalLink 
} from 'lucide-react';
import AppLogo from './AppLogo';
import VideoPlayer from './VideoPlayer';
import { toggleLessonCompletion, CourseStructure } from '@/app/actions';
import { logoutUser } from '@/app/auth-actions';
import type { SessionUser } from '@/lib/auth';
import styles from '../page.module.css';

interface CoursePortalClientProps {
  initialData: CourseStructure | null;
  user: SessionUser;
}

export default function CoursePortalClient({ initialData, user }: CoursePortalClientProps) {
  const data = initialData;
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(initialData?.lessons[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>(
    initialData?.lessons[0] ? { [initialData.lessons[0].module_id]: true } : {}
  );
  const [activeTab, setActiveTab] = useState<'info' | 'resources'>('info');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = user.role === 'admin';
  const [progressError, setProgressError] = useState('');
  const savingProgress = useRef(false);
  
  const [completions, setCompletions] = useState<number[]>(initialData?.completions || []);
  const [isPending, startTransition] = useTransition();

  const handleLogout = async () => {
    try {
      await logoutUser();
      window.location.assign('/');
    } catch {
      setProgressError('No se pudo cerrar la sesión. Intenta nuevamente.');
    }
  };

  if (!data) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logoIcon}><AppLogo /></div>
            <h1 className={styles.brandName}>Estudio Bíblico</h1>
          </div>
        </header>
        <div className={styles.emptyState}>
          <h2 className={styles.emptyStateTitle}>No hay cursos disponibles</h2>
          <p className={styles.emptyStateText}>
            Configura tu base de datos en Neon para sembrar el curso de muestra o accede al Panel de Administración para crear contenido.
          </p>
          {isAdmin && <Link href="/admin" className={styles.adminBtn}>Ir al Panel de Administración</Link>}
          <button onClick={handleLogout} className={styles.adminBtn}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  // Get active lesson object
  const activeLesson = data.lessons.find(l => l.id === selectedLessonId) || null;

  // Flatten lessons list for next/prev navigation
  const allLessons = data.lessons;
  const activeLessonIndex = activeLesson ? allLessons.findIndex(l => l.id === activeLesson.id) : -1;
  const prevLesson = activeLessonIndex > 0 ? allLessons[activeLessonIndex - 1] : null;
  const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < allLessons.length - 1 ? allLessons[activeLessonIndex + 1] : null;

  // Calculate progress
  const totalLessonsCount = allLessons.length;
  const completedCount = completions.length;
  const progressPercent = totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : 0;

  // Toggle modules expand/collapse
  const toggleModule = (moduleId: number) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const saveCompletion = (lessonId: number, completed: boolean) => {
    if (savingProgress.current) return;
    savingProgress.current = true;
    setProgressError('');
    const previous = completions;
    setCompletions(completed ? [...completions, lessonId] : completions.filter(id => id !== lessonId));
    startTransition(async () => {
      try {
        const result = await toggleLessonCompletion(lessonId, completed);
        if (!result.success) {
          setCompletions(previous);
          setProgressError(result.error || 'No se pudo guardar el progreso.');
        }
      } catch {
        setCompletions(previous);
        setProgressError('No se pudo conectar al servidor para guardar el progreso.');
      } finally {
        savingProgress.current = false;
      }
    });
  };

  const handleToggleCompletion = (lessonId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    saveCompletion(lessonId, !completions.includes(lessonId));
  };

  const handleVideoEnded = () => {
    if (activeLesson && !completions.includes(activeLesson.id)) {
      saveCompletion(activeLesson.id, true);
    }
  };

  // Filter lessons and modules by search query
  const filteredModules = data.modules.filter(m => {
    const moduleLessons = data.lessons.filter(l => l.module_id === m.id);
    const matchesModuleTitle = m.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLessons = moduleLessons.some(l => l.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesModuleTitle || matchesLessons;
  });

  // Custom Inline Markdown Renderer
  const renderMarkdown = (text: string) => {
    if (!text) return <p>No hay detalles adicionales para esta lección.</p>;
    
    const parseInline = (line: string) => {
      return line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link && /^https?:\/\//i.test(link[2])) {
          return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{link[1]} ↗</a>;
        }
        return part;
      });
    };

    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} style={{ height: '8px' }}></div>;
      
      // Headers
      if (trimmed.startsWith('### ')) {
        return <h4 key={idx} style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: '16px 0 8px' }}>{parseInline(trimmed.slice(4))}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={idx} style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: '20px 0 10px' }}>{parseInline(trimmed.slice(3))}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={idx} style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>{parseInline(trimmed.slice(2))}</h2>;
      }
      
      // Lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={idx} style={{ marginLeft: '16px', marginBottom: '6px', listStyleType: 'disc' }}>
            {parseInline(trimmed.slice(2))}
          </li>
        );
      }
      
      return <p key={idx} style={{ marginBottom: '10px' }}>{parseInline(trimmed)}</p>;
    });
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <button 
            className={styles.mobileMenuBtn}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Abrir menú"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className={styles.logoIcon}><AppLogo /></div>
          <div>
            <h1 className={styles.brandName}>{data.course.title}</h1>
          </div>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.userEmail}>{user.email}</span>
          {isAdmin && <Link href="/admin" className={styles.adminBtn}>Panel de Administración</Link>}
          <button onClick={handleLogout} className={styles.adminBtn}>Cerrar sesión</button>
        </div>
      </header>

      {progressError && <p role="alert" style={{ color: 'var(--danger)', padding: 16 }}>{progressError}</p>}
      {/* PORTAL CONTAINER */}
      <main className={styles.mainLayout}>
        {/* MOBILE OVERLAY */}
        <div 
          className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.open : ''}`}
          onClick={() => setSidebarOpen(false)}
        ></div>

        {/* SIDEBAR */}
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
          {/* Progress Tracker */}
          <div className={styles.progressSection}>
            <div className={styles.progressHeader}>
              <span>Progreso del Curso</span>
              <span>{progressPercent}% ({completedCount}/{totalLessonsCount})</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Search bar */}
          <div className={styles.searchBox}>
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Buscar lecciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Modules & Lessons list */}
          <div className={styles.moduleList}>
            {filteredModules.map(m => {
              const moduleLessons = data.lessons.filter(l => l.module_id === m.id);
              const searchedLessons = moduleLessons.filter(l => 
                l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.title.toLowerCase().includes(searchQuery.toLowerCase())
              );
              
              const isExpanded = expandedModules[m.id] || searchQuery.length > 0;
              const completedInModule = searchedLessons.filter(l => completions.includes(l.id)).length;
              
              if (searchedLessons.length === 0 && searchQuery.length > 0) return null;

              return (
                <div key={m.id} className={styles.moduleItem}>
                  <button 
                    className={styles.moduleHeader}
                    onClick={() => toggleModule(m.id)}
                  >
                    <div className={styles.moduleTitleInfo}>
                      <span className={styles.moduleTitle}>{m.title}</span>
                      <span className={styles.moduleStats}>
                        {completedInModule} de {searchedLessons.length} completadas
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {isExpanded && (
                    <div className={styles.lessonList}>
                      {searchedLessons.map(l => {
                        const isActive = l.id === selectedLessonId;
                        const isCompleted = completions.includes(l.id);
                        
                        return (
                          <button
                            key={l.id}
                            className={`${styles.lessonItem} ${isActive ? styles.active : ''}`}
                            onClick={() => {
                              setSelectedLessonId(l.id);
                              setSidebarOpen(false); // Close mobile sidebar on select
                            }}
                          >
                            <div className={styles.lessonLeft}>
                              <label className={styles.checkboxWrapper} onClick={(e) => handleToggleCompletion(l.id, e)}>
                                <input 
                                  type="checkbox" 
                                  checked={isCompleted} 
                                  readOnly
                                  disabled={isPending}
                                  aria-label={`Completar ${l.title}`}
                                  className={styles.checkboxInput}
                                />
                                <span className={styles.customCheckbox}>
                                  {isCompleted && <Check size={12} strokeWidth={3} />}
                                </span>
                              </label>
                              <span className={styles.lessonTitle}>{l.title}</span>
                            </div>
                            
                            <span className={styles.lessonDuration}>
                              {l.duration_seconds > 0 ? (
                                <>
                                  <Clock size={12} />
                                  {Math.round(l.duration_seconds / 60)} min
                                </>
                              ) : (
                                <Play size={12} />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* MAIN VIEWER */}
        <section className={styles.contentArea}>
          {activeLesson ? (
            <>
              {/* VIDEO PLAYER */}
              <div className={styles.playerSection}>
                <VideoPlayer url={activeLesson.video_url} onEnded={handleVideoEnded} />
              </div>

              {/* DETAILS PANEL */}
              <div className={styles.lessonDetails}>
                <div className={styles.detailsHeader}>
                  <div>
                    <h2 className={styles.lessonTitleLarge}>{activeLesson.title}</h2>
                    <div className={styles.lessonMeta}>
                      <span>
                        {data.modules.find(m => m.id === activeLesson.module_id)?.title}
                      </span>
                      {activeLesson.duration_seconds > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} /> Duración: {Math.round(activeLesson.duration_seconds / 60)} minutos
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    className={`${styles.completeBtn} ${completions.includes(activeLesson.id) ? styles.completed : ''}`}
                    onClick={(e) => handleToggleCompletion(activeLesson.id, e)}
                    disabled={isPending}
                  >
                    <Check size={16} />
                    {completions.includes(activeLesson.id) ? 'Lección Completada' : 'Marcar como Completada'}
                  </button>
                </div>

                {/* TABS FOR DETAILS / RESOURCES */}
                <div className={styles.tabBar}>
                  <button 
                    className={`${styles.tabBtn} ${activeTab === 'info' ? styles.active : ''}`}
                    onClick={() => setActiveTab('info')}
                  >
                    Descripción
                  </button>
                  <button 
                    className={`${styles.tabBtn} ${activeTab === 'resources' ? styles.active : ''}`}
                    onClick={() => setActiveTab('resources')}
                  >
                    Notas y Recursos
                  </button>
                </div>

                {/* TAB PANELS */}
                <div className={styles.tabContent}>
                  {activeTab === 'info' ? (
                    <div className={styles.markdown}>
                      {renderMarkdown(activeLesson.description)}
                    </div>
                  ) : (
                    <div className={styles.markdown}>
                      <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Recursos de Estudio</h4>
                      {activeLesson.slides_name && (
                        <p>
                          <a href={`/api/lessons/${activeLesson.id}/slides`} style={{ color: 'var(--primary)' }}>
                            Descargar diapositivas (PDF): {activeLesson.slides_name}
                          </a>
                        </p>
                      )}
                      {!activeLesson.slides_name && activeLesson.resource_links.length === 0 && (
                        <p>El administrador aún no ha añadido recursos para esta lección.</p>
                      )}
                      <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                        {activeLesson.resource_links.map((link, index) => (
                          <li key={index} style={{ marginBottom: 6 }}>
                            <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                              {link.title} <ExternalLink size={12} />
                            </a>
                          </li>
                        ))}
                        {activeLesson.video_url.includes('youtube') && (
                          <li style={{ marginBottom: '6px' }}>
                            <a href={activeLesson.video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              Ver video directamente en YouTube <ExternalLink size={12} />
                            </a>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* LESSON NAVIGATION */}
                <div className={styles.navigationSection}>
                  <button
                    className={styles.navBtn}
                    onClick={() => setSelectedLessonId(prevLesson!.id)}
                    disabled={!prevLesson}
                  >
                    ← Anterior Lección
                  </button>
                  
                  {nextLesson ? (
                    <button
                      className={styles.navBtn}
                      onClick={() => setSelectedLessonId(nextLesson.id)}
                    >
                      Siguiente Lección →
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: '600', fontSize: '0.9rem' }}>
                      <Award size={18} /> {completedCount === totalLessonsCount ? '¡Curso Finalizado!' : 'Última lección del curso'}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <h2 className={styles.emptyStateTitle}>Selecciona una Lección</h2>
              <p className={styles.emptyStateText}>
                Utiliza el menú de la izquierda para explorar los temas disponibles en el curso y reproducir el video explicativo.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
