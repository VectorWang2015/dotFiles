import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function harness(openWorkspacePath = async () => ({ ok: true, value: { opened: true } })) {
  let registration;
  let entry;
  let component;
  let offset = 0;
  const values = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const index = offset++;
      if (!(index in values)) values[index] = initial;
      return [values[index], (value) => { values[index] = value; }];
    },
    useRef(initial) {
      const index = offset++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
  };
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: (row) => { registration = row; } } },
    Error,
  });
  const plugin = registration.factory((specifier) => {
    assert.equal(specifier, 'react', 'must not require removed DSH runtime');
    return React;
  });
  let disposed = false;
  let removeEntry;
  const ctx = {
    connection: { rpc: { call: (channel, endpoint, payload) => {
      assert.equal(channel, '/api');
      assert.equal(endpoint, 'session/openWorkspacePath');
      return openWorkspacePath(payload.args.request);
    } } },
    remote: { session: { openWorkspacePath: () => { throw new Error('Preview interception must not receive a native folder action'); } } },
    slots: {
      inject(name, mount) {
        assert.equal(name, 'conversation.session.header.actions');
        removeEntry = mount();
      },
      register(options, render) {
        entry = options;
        component = render;
        return () => { disposed = true; };
      },
    },
  };
  plugin.apply(ctx);
  function render(sessionId = 'current', byId = { current: { cwd: '/workspace/current' } }) {
    offset = 0;
    return component({ sessionId, useSessions: (selector) => selector({ byId }), ...entry.inject() });
  }
  return { plugin, entry, render, dispose: () => { removeEntry(); return disposed; } };
}

const event = { stopPropagation() {} };

test('binds the existing session slot with the new Remote service dependencies', () => {
  const h = harness();
  assert.deepEqual([...h.plugin.inject], ['slots', 'connection']);
  assert.equal(h.entry.id, 'open-workspace-folder');
  assert.equal(h.dispose(), true, 'slot contribution has a disposer');
});

test('opens the selected session cwd through session.openWorkspacePath', async () => {
  const requests = [];
  const h = harness(async (request) => {
    requests.push(request);
    return { ok: true, value: { opened: true } };
  });
  const button = h.render('second', { first: { cwd: '/one' }, second: { cwd: '/two' } });
  assert.equal(button.props.title, '/two');
  await button.props.onClick(event);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/two');
});

test('omits the action for missing or blank cwd', () => {
  assert.equal(harness().render('absent'), null);
  assert.equal(harness().render('current', { current: { cwd: '' } }), null);
});

test('surfaces Remote business errors and allows retry', async () => {
  const h = harness(async () => ({ ok: false, error: { message: 'opener unavailable' } }));
  await h.render().props.onClick(event);
  const button = h.render();
  assert.equal(button.children[0], '打开失败: opener unavailable');
  assert.equal(button.props.disabled, false);
});

test('surfaces transport failures without an unhandled rejection', async () => {
  const h = harness(async () => { throw new Error('connection reset'); });
  await h.render().props.onClick(event);
  assert.equal(h.render().children[0], '打开失败: connection reset');
});

test('coalesces repeated clicks while the opener request is pending', async () => {
  let finish;
  let calls = 0;
  const h = harness(() => {
    calls += 1;
    return new Promise((resolve) => { finish = resolve; });
  });
  const button = h.render();
  const pending = button.props.onClick(event);
  await button.props.onClick(event);
  assert.equal(calls, 1);
  assert.equal(h.render().props.disabled, true);
  finish({ ok: true, value: { opened: true } });
  await pending;
  assert.equal(h.render().props.disabled, false);
});
