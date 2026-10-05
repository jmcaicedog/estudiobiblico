type VideoSource = { type: 'youtube' | 'vimeo' | 'direct'; url: string };

export function getVideoSource(url: string): VideoSource | null {
  if (!url) return null;

  const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  if (youtubeMatch) {
    return {
      type: 'youtube',
      url: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`,
    };
  }

  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeoMatch) {
    return {
      type: 'vimeo',
      url: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=0`,
    };
  }

  return { type: 'direct', url };
}
