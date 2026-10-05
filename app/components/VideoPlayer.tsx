"use client";

import React from 'react';
import { getVideoSource } from '@/lib/video';

interface VideoPlayerProps {
  url: string;
  onEnded?: () => void;
}

export default function VideoPlayer({ url, onEnded }: VideoPlayerProps) {
  const embedInfo = getVideoSource(url);

  if (!url) {
    return (
      <div style={placeholderStyle}>
        <p>Selecciona una lección para comenzar a ver el video.</p>
      </div>
    );
  }

  return (
    <div style={playerWrapperStyle}>
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
