import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpeech } from '../src/server/speech.ts';

test('transcription fixes common mishearings of n8n and leaves other words alone', async () => {
  let heard = '';
  const speech = createSpeech({
    id: 'fixture',
    configured: true,
    transcriptionConfigured: true,
    transcribe: async () => heard,
    synthesize: async () => {
      throw new Error('unused');
    },
  });
  const audio = { bytes: new Uint8Array([1]), mimeType: 'audio/wav', name: 'voice.wav' };
  for (const [said, expected] of [
    ['Open my NNN workflows.', 'Open my n8n workflows.'],
    ['Check N N N for errors', 'Check n8n for errors'],
    ['the N.N.N instance', 'the n8n instance'],
    ['Deploy naten and natm today', 'Deploy n8n and n8n today'],
    ['is N-eight-N up?', 'is n8n up?'],
    ['ask N8N about it', 'ask n8n about it'],
    ['n 8 n cloud', 'n8n cloud'],
    // Not n8n: real names and ordinary words survive.
    ['Email Nathan and Natan in 8 nights', 'Email Nathan and Natan in 8 nights'],
    ['Run the annual plan', 'Run the annual plan'],
  ]) {
    heard = said;
    assert.equal(await speech.transcribe(audio), expected, said);
  }
});
