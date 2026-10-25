import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadTypeScriptModule(relativePath) {
  const filename = resolve(process.cwd(), relativePath);
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const loaded = { exports: {} };
  new Function('exports', 'require', 'module', output)(loaded.exports, require, loaded);
  return loaded.exports;
}

const { buildQuestionQueue } = loadTypeScriptModule('src/lib/interview-questions.ts');
const { parseInterviewConfig } = loadTypeScriptModule('src/lib/interview-config.ts');

function question(id, phase, role = 'general', experience_level = 'todos') {
  return {
    id: String(id), category: 'práctica', question_text: `Pregunta ${id}`,
    difficulty: 'media', tips: '', phase, role, experience_level,
  };
}

const questionBank = [
  ...Array.from({ length: 4 }, (_, index) => question(`open-${index}`, 1)),
  ...Array.from({ length: 16 }, (_, index) => question(`behavior-${index}`, 2)),
  ...Array.from({ length: 16 }, (_, index) => question(`web-${index}`, 3, 'web')),
  ...Array.from({ length: 16 }, (_, index) => question(`general-tech-${index}`, 3)),
  ...Array.from({ length: 16 }, (_, index) => question(`bd-${index}`, 3, 'bd')),
  ...Array.from({ length: 4 }, (_, index) => question(`close-${index}`, 4)),
];

test('la URL usa valores predeterminados al entrar directamente a una ruta de entrevista', () => {
  assert.deepEqual(parseInterviewConfig(new URLSearchParams()), {
    role: 'general', sessionType: 'mixta', count: 10,
  });
});

test('la configuración acepta únicamente áreas, formatos y duraciones conocidas', () => {
  assert.deepEqual(parseInterviewConfig(new URLSearchParams('role=bd&type=tecnica&count=15')), {
    role: 'bd', sessionType: 'tecnica', count: 15,
  });
  assert.equal(parseInterviewConfig(new URLSearchParams('role=unknown&type=mixta&count=10')), null);
  assert.equal(parseInterviewConfig(new URLSearchParams('role=web&type=unknown&count=10')), null);
  assert.equal(parseInterviewConfig(new URLSearchParams('role=web&type=mixta&count=99')), null);
});

test('una sesión guardada puede conservar su duración histórica al reanudarse', () => {
  assert.deepEqual(parseInterviewConfig(new URLSearchParams('sessionId=saved&role=web&type=mixta&count=4')), {
    role: 'web', sessionType: 'mixta', count: 4,
  });
});

test('la entrevista mixta respeta la cantidad y conserva apertura y cierre', () => {
  const queue = buildQuestionQueue(questionBank, 'web', 'mixta', 10);
  assert.equal(queue.length, 10);
  assert.equal(queue.filter(item => item.phase === 1).length, 1);
  assert.equal(queue.filter(item => item.phase === 2).length, 3);
  assert.equal(queue.filter(item => item.phase === 3).length, 5);
  assert.equal(queue.filter(item => item.phase === 4).length, 1);
});

test('los formatos técnico y conductual no mezclan fases ajenas', () => {
  const technical = buildQuestionQueue(questionBank, 'bd', 'tecnica', 10);
  const behavioral = buildQuestionQueue(questionBank, 'web', 'conductual', 5);
  assert.equal(technical.length, 10);
  assert.equal(technical.some(item => item.phase === 2), false);
  assert.equal(behavioral.length, 5);
  assert.equal(behavioral.some(item => item.phase === 3), false);
});

test('las preguntas técnicas se limitan al área elegida y al contenido general', () => {
  const queue = buildQuestionQueue(questionBank, 'bd', 'tecnica', 10);
  assert.ok(queue.filter(item => item.phase === 3).every(item => item.role === 'bd' || item.role === 'general'));
});

test('se priorizan preguntas no contestadas si hay suficientes opciones', () => {
  const recent = new Set(['open-0', 'behavior-0', 'web-0', 'general-tech-0', 'close-0']);
  const queue = buildQuestionQueue(questionBank, 'web', 'mixta', 5, recent);
  assert.equal(queue.length, 5);
  assert.equal(queue.some(item => recent.has(item.id)), false);
});
