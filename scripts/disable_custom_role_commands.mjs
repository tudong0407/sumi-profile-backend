import { cdpEval, ensureBuilderMounted } from './ga_builder_lib.mjs';

const TARGET_DISABLE_CMDS = [
  'rolecreate',
  'roledelete',
  'iconrole_outdated',
  'iconcreate',
  'editrole',
  'gradientrole'
];

const TARGET_ENABLE_CMDS = [
  'profile',
  'rank',
  'battle',
  'wiki'
];

async function main() {
  await ensureBuilderMounted();
  const res = await cdpEval(`(async () => {
    const rootEl = document.getElementById('root');
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer$'));
    let f = rootEl[rk], store = null, cb = null, q = [f], seen = new Set();
    while (q.length) {
      const n = q.shift();
      if (!n || seen.has(n)) continue; seen.add(n);
      if (n.memoizedProps?.store) store = n.memoizedProps.store;
      if (n.stateNode?.validateSave && n.stateNode?.buildCommand) cb = n.stateNode;
      if (n.child) q.push(n.child);
      if (n.sibling) q.push(n.sibling);
    }
    if (!store || !cb) return { ok: false, error: 'Missing store or cb' };

    const disableSet = new Set(${JSON.stringify(TARGET_DISABLE_CMDS)});
    const enableSet = new Set(${JSON.stringify(TARGET_ENABLE_CMDS)});
    const beforeSave = store.getState().data.bot.last_save;
    const currentSlash = store.getState().data.bot.commands.slash;
    const slashData = {
      ...currentSlash,
      commands: currentSlash.commands.map(c => {
        if (disableSet.has(c.name)) {
          return { ...c, enabled: false };
        }
        if (enableSet.has(c.name)) {
          return { ...c, enabled: true };
        }
        return c;
      })
    };

    cb.props.setBotModule({ module: 'slash', module_data: slashData }, true);
    await new Promise(r => setTimeout(r, 300));
    await cb.saveBot(false, true);

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (store.getState().data.bot.last_save !== beforeSave) break;
    }

    const st = store.getState();
    const summary = st.data.bot.commands.slash.commands
      .filter(c => disableSet.has(c.name) || enableSet.has(c.name))
      .map(c => ({ name: c.name, enabled: c.enabled, id: c.id, int_id: c.int_id, optionsCount: c.options?.length || 0 }));

    return {
      ok: st.data.bot.last_save !== beforeSave,
      beforeSave,
      afterSave: st.data.bot.last_save,
      builderSaveRequired: st.builder.builderSaveRequired,
      summary
    };
  })()`, 25000);

  console.log('Sync custom role & profile/rank/battle/wiki commands result:', JSON.stringify(res, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
