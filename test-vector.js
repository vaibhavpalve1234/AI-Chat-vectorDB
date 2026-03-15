// test-vector.js
import { initVectorDB, addDocument, getStats } from './memory/vectorDB.js';

async function test() {
  console.log('Testing vector DB...');
  const init = await initVectorDB();
  console.log('Init result:', init);
  if (init.ready) {
    await addDocument('KNOWLEDGE', { id: 'test', text: 'test document', metadata: {} });
    const stats = await getStats();
    console.log('Stats after insert:', stats);
  } else {
    console.log('Vector DB not ready');
  }
}

test().catch(console.error);