import { cdpEval } from '../../../brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch/ga_builder_lib.mjs';

async function main() {
  const res = await cdpEval(`(() => {
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
    const cmds = store.getState().data.bot.commands.slash.commands;
    const evs = store.getState().data.bot.commands.custom_events.events;
    return {
      cbProps: cb ? Object.keys(cb.props) : [],
      buildCommandSrc: cb ? cb.buildCommand.toString().slice(0, 800) : null,
      roleCmds: cmds.map((c, idx) => ({ idx, name: c.name, enabled: c.enabled, id: c.id, groupId: c.groupId })).filter(c => /role|icon/i.test(c.name)),
      events: evs.map((e, idx) => ({ idx, name: e.name, enabled: e.enabled, type: e.type }))
    };
  })()`);
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
