import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVideoSource } from '../lib/video.ts';

test('empty video URL preserves the placeholder', () => {
  assert.equal(getVideoSource(''), null);
});

test('YouTube watch, short, and embed links resolve to the same player', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4s',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ]) {
    assert.deepEqual(getVideoSource(url), {
      type: 'youtube',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0',
    });
  }
});

test('Vimeo links resolve to the Vimeo player', () => {
  for (const url of ['https://vimeo.com/848382920', 'https://player.vimeo.com/video/848382920']) {
    assert.deepEqual(getVideoSource(url), {
      type: 'vimeo',
      url: 'https://player.vimeo.com/video/848382920?autoplay=0',
    });
  }
});

test('direct videos retain their URL and URL changes do not reuse the previous source', () => {
  const first = getVideoSource('https://youtu.be/dQw4w9WgXcQ');
  const url = 'https://example.com/video.mp4';
  assert.deepEqual(getVideoSource(url), { type: 'direct', url });
  assert.equal(getVideoSource(''), null);
  assert.equal(first.type, 'youtube');
});
