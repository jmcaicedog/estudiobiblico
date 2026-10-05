import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PDF_BYTES, validateLinks, validatePdf, validatePdfSize } from '../lib/lesson-resources.ts';

test('resource links can be empty or contain arbitrarily many entries', () => {
  assert.deepEqual(validateLinks([]), []);
  const links = Array.from({ length: 250 }, (_, i) => ({ title: ` Recurso ${i} `, url: ` https://example.com/${i} ` }));
  const result = validateLinks(links);
  assert.equal(result.length, 250);
  assert.deepEqual(result[0], { title: 'Recurso 0', url: 'https://example.com/0' });
});

test('links reject malformed values, unsafe protocols, and embedded credentials', () => {
  for (const value of [null, {}, [null], [{ title: '', url: 'https://example.com' }],
    [{ title: 'Link', url: 'javascript:alert(1)' }], [{ title: 'Link', url: 'data:text/html,test' }],
    [{ title: 'Link', url: 'https://user:password@example.com' }], [{ title: 'Link', url: 'invalid' }]]) {
    assert.throws(() => validateLinks(value));
  }
  assert.deepEqual(validateLinks([{ title: 'Link', url: 'http://example.com' }]),
    [{ title: 'Link', url: 'http://example.com' }]);
});

test('PDF limit is exactly 10 MiB, not just a file extension check', () => {
  assert.equal(MAX_PDF_BYTES, 10 * 1024 * 1024);
  assert.doesNotThrow(() => validatePdfSize(MAX_PDF_BYTES));
  assert.throws(() => validatePdfSize(MAX_PDF_BYTES + 1));
  assert.throws(() => validatePdfSize(0));
  const bytes = new Uint8Array(MAX_PDF_BYTES);
  bytes.set(new TextEncoder().encode('%PDF-1.7'));
  assert.doesNotThrow(() => validatePdf(bytes, 'slides.PDF', 'application/pdf'));
  assert.throws(() => validatePdf(bytes, 'slides.txt', 'application/pdf'));
  assert.throws(() => validatePdf(bytes, 'slides.pdf', 'text/plain'));
  assert.throws(() => validatePdf(new TextEncoder().encode('not a pdf'), 'slides.pdf', 'application/pdf'));
});
