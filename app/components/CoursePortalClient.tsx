"use client";

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { 
  Play, Check, ChevronDown, ChevronUp, Search, 
  Menu, X, BookOpen, Award, Clock, ExternalLink 
} from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { toggleLessonCompletion, checkAdminAuth, CourseStructure } from '@/app/actions';
import styles from '../page.module.css';

interface CoursePortalClientProps {
  initialData: CourseStructure | null;
}

export default function CoursePortalClient({ initialData }: CoursePortalClientProps) {
  const [data, setData] = useState<CourseStructure | null>(initialData);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<'info' | 'resources'>('info');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [completions, setCompletions] = useState<number[]>(initialData?.completions || []);
  const [isPending, startTransition] = useTransition();

  // Check admin status on mount
  useEffect(() => {
    checkAdminAuth().then(setIsAdmin);
    
    // Auto-select first lesson if available
    if (initialData && initialData.lessons.length > 0) {
      setSelectedLessonId(initialData.lessons[0].id);
      
      // Ensure the first lesson's module is expanded
      const firstLessonModuleId = initialData.lessons[0].module_id;
      setExpandedModules({ [firstLessonModuleId]: true });
    }
  }, [initialData]);

  if (!data) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logoIcon}>B</div>
            <h1 className={styles.brandName}>Estudio Bíblico</h1>
          </div>
        </header>
        <div className={styles.emptyState}>
          <h2 className={styles.emptyStateTitle}>No hay cursos disponibles</h2>
          <p className={styles.emptyStateText}>
            Configura tu base de datos en Neon para sembrar el curso de muestra o accede al Panel de Administración para crear contenido.
          </p>
          <Link href="/admin" className={styles.adminBtn}>
            Ir al Panel de Administración
          </Link>
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

  // Toggle completion checkbox with optimistic update
  const handleToggleCompletion = async (lessonId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting the lesson when clicking checkbox
    
    const isCompleted = completions.includes(lessonId);
    let updatedCompletions: number[];
    
    if (isCompleted) {
      updatedCompletions = completions.filter(id => id !== lessonId);
    } else {
      updatedCompletions = [...completions, lessonId];
    }
    
    // Optimistic Update
    setCompletions(updatedCompletions);
    
    // Server Sync
    startTransition(async () => {
      await toggleLessonCompletion(lessonId, !isCompleted);
    });
  };

  // Auto-complete lesson when video ends
  const handleVideoEnded = async () => {
    if (activeLesson && !completions.includes(activeLesson.id)) {
      const updatedCompletions = [...completions, activeLesson.id];
      setCompletions(updatedCompletions);
      await toggleLessonCompletion(activeLesson.id, true);
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
      // Bold **text**
      // Italics *text*
      // Links [text](url)
      const html = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">$1 <span style="font-size: 0.75rem; vertical-align: middle;">↗</span></a>');
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
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
          <div className={styles.logoIcon}>
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className={styles.brandName}>{data.course.title}</h1>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link href="/admin" className={styles.adminBtn}>
            {isAdmin ? 'Panel de Administración' : 'Acceso Administrador'}
          </Link>
        </div>
      </header>

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
                      <p>Utiliza estas lecturas y enlaces recomendados para profundizar en el tema de esta lección:</p>
                      <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                        <li style={{ marginBottom: '6px' }}>
                          <strong>Lectura de apoyo:</strong> Consulta los apuntes y textos referentes al módulo en tu bibliografía de estudio.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                          <strong>Ejercicios prácticos:</strong> Anota tus reflexiones en tu cuaderno de estudio antes de continuar con la siguiente lección.
                        </li>
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
                      <Award size={18} /> ¡Curso Finalizado!
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
