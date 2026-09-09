import test from 'node:test';
import assert from 'node:assert/strict';
import { reportGreeting, reportListState } from './reports-presentation';

const settled = {
  searching: false,
  pending: false,
  failed: false,
  paused: false,
  hasReports: false,
};

test('greeting never treats the workspace fallback as a person', () => {
  assert.equal(reportGreeting('Your workspace'), 'Welcome back');
  assert.equal(reportGreeting('  '), 'Welcome back');
  assert.equal(reportGreeting('  Alex  Morgan '), 'Welcome back, Alex');
});
test('initial requests and search debounce show placeholders, not an empty account', () => {
  assert.equal(reportListState({ ...settled, pending: true }), 'loading');
  assert.equal(reportListState({ ...settled, searching: true, hasReports: true }), 'loading');
});
test('only a settled successful empty query shows the empty state', () => {
  assert.equal(reportListState(settled), 'empty');
  assert.equal(reportListState({ ...settled, failed: true }), 'error');
});
test('cached reports remain visible after refresh failures or a paused request', () => {
  assert.equal(reportListState({ ...settled, hasReports: true, failed: true }), 'ready');
  assert.equal(reportListState({ ...settled, hasReports: true, paused: true }), 'ready');
});
test('a paused initial request shows offline feedback instead of endless skeletons', () => {
  assert.equal(reportListState({ ...settled, pending: true, paused: true }), 'offline');
});
