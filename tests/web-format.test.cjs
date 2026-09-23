const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {decimalToMinor, filters} = require('./load-typescript.cjs')(path.join(__dirname, '../web/src/lib/format.ts'));
test('web money parsing uses exact centavos and rejects silent rounding', () => {
  for (const [input, cents] of [['0.01',1],['1.1',110],['1250.50',125050],['9999999999.99',999999999999]]) assert.equal(decimalToMinor(input), cents);
  for (const input of ['0','-1','1.001','1e3','NaN','10000000000','1,000.00','']) assert.throws(()=>decimalToMinor(input));
});
test('web filters preserve supported URL values without copying unknown parameters', () => {
 const query = filters({month:'2026-09',search:'coffee & lunch',type:'expense',page:'2',ownerId:'someone-else'});
 assert.equal(query.get('month'),'2026-09'); assert.equal(query.get('search'),'coffee & lunch'); assert.equal(query.has('ownerId'),false);
 assert.match(filters({month:'2026-13'}).get('month'), /^\d{4}-(0[1-9]|1[0-2])$/);
});
