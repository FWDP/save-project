const test = require('node:test');
const assert = require('node:assert/strict');
const { CATEGORY_GROUPS, BUILTIN_CATEGORIES } = require('../dist/categories/category-catalog');
const { CategoriesService } = require('../dist/categories/categories.service');
const { authContext } = require('../dist/auth/auth-context');

test('catalog contains all supplied groups and uniquely identified parent/subcategory choices', () => {
  assert.equal(CATEGORY_GROUPS.length, 14);
  assert.equal(CATEGORY_GROUPS.reduce((count, group) => count + group.children.length, 0), 57);
  assert.equal(new Set(BUILTIN_CATEGORIES.map(category => category.id)).size, BUILTIN_CATEGORIES.length);
  for (const group of CATEGORY_GROUPS) {
    for (const child of group.children) {
      const entry = BUILTIN_CATEGORIES.find(category => category.name === `${group.name} / ${child}`);
      assert.equal(entry.parentCategory, group.name);
      assert.equal(entry.subcategory, child);
      assert.equal(entry.type, group.name === 'Income' ? 'income' : 'expense');
      assert.ok(entry.name.length <= 80);
    }
  }
});

test('existing accounts receive defaults without losing custom categories or duplicating labels', async () => {
  const custom = [{ id: 'custom', name: 'My category', type: 'expense', color: '#000000' },
    { id: 'existing', name: 'Food & Dining', type: 'expense', color: '#111111' }];
  const model = { find: filter => {
    assert.deepEqual(filter, {userId:'alice'});
    return {sort:()=>({lean:async()=>custom})};
  } };
  await authContext.run({userId:'alice'}, async()=> {
    const result = await new CategoriesService(model).findAll();
    assert.ok(result.some(category=>category.id === 'custom'));
    assert.equal(result.filter(category=>category.name === 'Food & Dining').length, 1);
    assert.ok(result.some(category=>category.name === 'Housing & Home / Rent'));
  });
});
