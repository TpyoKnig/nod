import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { registerAudioMessages } from '../src/server/audio-messages.ts';
import { createSpeech } from '../src/server/speech.ts';
import type { AppDependencies } from '../src/server/app.ts';

// POST /api/speech/transcribe (G2 glasses): speech to text only. It must return nod's corrected
// transcript and never submit anything to the conversation.
async function server(transcript: string | null, transcriptionConfigured = true) {
  const calls: string[] = [];
  const speech = createSpeech({
    id: 'fake',
    configured: transcriptionConfigured,
    transcriptionConfigured,
    async synthesize() {
      throw new Error('not used');
    },
    async transcribe(audio) {
      calls.push(audio.mimeType);
      return transcript ?? '';
    },
  });
  const app = Fastify();
  await app.register(multipart);
  registerAudioMessages(app, {
    speech,
    submitMessage: () => {
      throw new Error('transcribe must not submit a message');
    },
  } as unknown as AppDependencies);
  return { app, calls };
}

const boundary = 'g2boundary';
const upload = (type = 'audio/wav') => ({
  method: 'POST' as const,
  url: '/api/speech/transcribe',
  headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  payload: Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="glasses.wav"\r\nContent-Type: ${type}\r\n\r\nRIFF-not-really-audio\r\n--${boundary}--\r\n`,
  ),
});

test('returns the corrected transcript and submits nothing', async () => {
  const { app, calls } = await server('Ask N N N to run the workflow');
  const response = await app.inject(upload());
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), { text: 'Ask n8n to run the workflow' });
  assert.deepEqual(calls, ['audio/wav']);
  await app.close();
});

test('rejects a file that is not audio without transcribing it', async () => {
  const { app, calls } = await server('anything');
  const response = await app.inject(upload('text/plain'));
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(calls.length, 0);
  await app.close();
});

test('reports silence as a readable 400', async () => {
  const { app } = await server('   ');
  const response = await app.inject(upload());
  assert.equal(response.statusCode, 400, response.body);
  assert.match(response.json().message, /No speech was detected/);
  await app.close();
});

test('explains how to set up voice when transcription is off', async () => {
  const { app, calls } = await server('anything', false);
  const response = await app.inject(upload());
  assert.equal(response.statusCode, 400, response.body);
  assert.match(response.json().message, /Set up audio/);
  assert.equal(calls.length, 0);
  await app.close();
});
