const test = require('node:test');
const assert = require('node:assert/strict');
const { readReceiptLive } = require('../dist/receipts/receipt-live');

function fake(events) {
  const state = { closed:0 };
  state.ai = {live:{connect:async options=> {
    state.options=options;
    return {
      close(){state.closed++; options.callbacks.onclose({});},
      sendClientContent(payload){state.payload=payload; queueMicrotask(()=>events(options.callbacks));},
    };
  }}};
  return state;
}
const call = args => ({toolCall:{functionCalls:[{id:'one',name:'extract_receipt',args}]}});
test('Live sends image over a dedicated session and closes on function result', async()=> {
  const args={merchant:'Shop',amount:25,date:'2026-09-28'};
  const state=fake(callbacks=> {
    callbacks.onmessage({serverContent:{modelTurn:{parts:[{inlineData:{data:'audio'}}]}}});
    callbacks.onmessage(call(args));
    callbacks.onmessage({serverContent:{turnComplete:true}});
  });
  assert.deepEqual(await readReceiptLive(state.ai,'gemini-3.8-live','Read receipt','image','image/png'),args);
  assert.equal(state.closed,1);
  assert.equal(state.options.model,'gemini-3.8-live');
  assert.deepEqual(state.options.config.responseModalities,['AUDIO']);
  assert.equal(state.options.config.responseSchema,undefined);
  assert.equal(state.payload.turns[0].parts[0].inlineData.mimeType,'image/png');
});
test('Live cleans up on socket errors, premature close, interruption, and missing extraction', async()=> {
  for(const event of [c=>c.onerror({}), c=>c.onclose({}), c=>c.onmessage({goAway:{}}), c=>c.onmessage({serverContent:{interrupted:true}}), c=>c.onmessage({serverContent:{turnComplete:true}}), c=>c.onmessage({toolCall:{functionCalls:[{name:'untrusted',args:{}}]}})]) {
    const state=fake(event);
    await assert.rejects(readReceiptLive(state.ai,'model','prompt','image','image/png'));
    assert.equal(state.closed,1);
  }
});
test('Live times out stalled responses and closes the socket', async()=> {
  const state=fake(()=>{});
  await assert.rejects(readReceiptLive(state.ai,'model','prompt','image','image/png',10),/timed out/);
  assert.equal(state.closed,1);
});
test('Live closes a late connection after the deadline without sending the image', async()=> {
  let connect; let closed=0; let sent=0;
  const ai={live:{connect:()=>new Promise(resolve=>{connect=resolve;})}};
  await assert.rejects(readReceiptLive(ai,'model','prompt','image','image/png',10),/timed out/);
  connect({close(){closed++;},sendClientContent(){sent++;}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closed,1); assert.equal(sent,0);
});
test('Live connection rejection does not expose provider credentials or errors',async()=>{
  const ai={live:{connect:async()=>{throw new Error('private-key-value');}}};
  await assert.rejects(readReceiptLive(ai,'model','prompt','image','image/png'),error=> !error.message.includes('private-key-value') && error.status===503);
});
