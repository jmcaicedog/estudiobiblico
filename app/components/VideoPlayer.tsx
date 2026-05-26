"use client";

import React, { useState, useEffect } from 'react';

interface VideoPlayerProps {
  url: string;
  onEnded?: () => void;
}

export default function VideoPlayer({ url, onEnded }: VideoPlayerProps) {
  const [embedInfo, setEmbedInfo] = useState<{ type: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (!url) {
      setEmbedInfo(null);
      setLoading(false);
      return;
    }

    // YouTube matches:
    // https://www.youtube.com/watch?v=dQw4w9WgXcQ
    // https://youtu.be/dQw4w9WgXcQ
    // https://www.youtube.com/embed/dQw4w9WgXcQ
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const ytMatch = url.match(ytRegex);

    if (ytMatch) {
      setEmbedInfo({
        type: 'youtube',
        url: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`
      });
      setLoading(false);
      return;
    }

    // Vimeo matches:
    // https://vimeo.com/848382920
    // https://player.vimeo.com/video/848382920
    const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);

    if (vimeoMatch) {
      setEmbedInfo({
        type: 'vimeo',
        url: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=0`
      });
      setLoading(false);
      return;
    }

    // Fallback to direct video file
    setEmbedInfo({
      type: 'direct',
      url: url
    });
    setLoading(false);
  }, [url]);

  if (!url) {
    return (
      <div style={placeholderStyle}>
        <p>Selecciona una lección para comenzar a ver el video.</p>
      </div>
    );
  }

  return (
    <div style={playerWrapperStyle}>
      {loading && (
        <div style={loadingStyle}>
          <div className="spinner"></div>
        </div>
      )}

      {embedInfo?.type === 'youtube' && (
        <iframe
          src={embedInfo.url}
          style={iframeStyle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Reproductor YouTube"
        ></iframe>
      )}

      {embedInfo?.type === 'vimeo' && (
        <iframe
          src={embedInfo.url}
          style={iframeStyle}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Reproductor Vimeo"
        ></iframe>
      )}

      {embedInfo?.type === 'direct' && (
        <video
          key={url}
          src={embedInfo.url}
          controls
          style={videoStyle}
          onEnded={onEnded}
        />
      )}
    </div>
  );
}

// Estilos en línea para encapsulación
const playerWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '16/9',
  backgroundColor: '#0b0f19',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
};

const placeholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  aspectRatio: '16/9',
  backgroundColor: '#111827',
  borderRadius: '16px',
  color: '#6b7280',
  textAlign: 'center',
  fontSize: '1.1rem',
  border: '1px dashed rgba(255, 255, 255, 0.1)',
  padding: '24px',
};

const loadingStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(11, 15, 25, 0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  backdropFilter: 'blur(8px)',
};

const iframeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  border: 'none',
};

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};
