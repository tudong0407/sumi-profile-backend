// Giveaway V2 Reusable Graph Builder, Offline Validator, and CDP Deployer (with strict 15-25s CDP timeouts)
import http from 'http';
import crypto from 'crypto';
import WebSocket from 'ws';
import LZString from 'lz-string';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

export const SUMI_GUILD_ID = '1026096141273661450';
export const OCTO_GUILD_ID = '807464674508668928';
export const GA_GROUP_ID = '1782127263978';

export const SUMI_STAFF_TEST_CH = '1466390891399876668';
export const SUMI_GA_CH = '1518563875937845359';

export const OWNER_ID = '511187329889861651';
export const FUYUMI_ID = '757091869183311872';

// Role IDs (SuMi Family)
export const ROLE_DOT_ADMIN = '1487172968105640069';       // pos 142 .
export const ROLE_HUYEN_CHU = '1468649836856344689';       // pos 141 « Huyễn Chủ »
export const ROLE_TUYET_NGUYET = '1519354498412314785';    // pos 140 « Tuyết Nguyệt Yêu Hồ » (HOLDS ADMINISTRATOR!)
export const ROLE_CACH_LY = '1474776271883079681';         // punish block
export const ROLE_LOCKED_XP = '1471111216423370792';       // punish block

// Verified Emojis
export const EMOJI = {
  flowers: '<a:Flowers:1511260859194933369>',
  flowersRaw: 'Flowers:1511260859194933369',
  gift: '<:DoodleGift:1511261145292472350>',
  crown: '<:Crown:1511387013474160680>',
  timer: '<:Timer:1511386670736347136>',
  member: '<:MemberIcon:1511383394590789733>',
  ticket: '<:redticket:1511575728301543545>',
  verified: '<a:pink_verified:1517785671836631231>',
  cancel: '<a:Cancel:1511045582888763483>',
  star: '<a:kawaiiTwinkleStar:1511162446507802844>',
  arrow: '<a:PinkRightArrowBounce:1511257951078318100>',
  babyArrow: '<:BabyPinkArrowRight:1511423091501305966>',
  warn: '<:LowWarning:1511347687746703360>',
  // OctopusShiro
  octoDash: '<:PinkDash:1518835685971464312>',
  octoLightDash: '<:light_pink_dash:1518835955145117748>',
  octoOk: '<:whitelisted:1524094506704703700>',
  octoWarn: '<:Warn:1523742936406294648>',
  octoMod: '<:moderator:1523751645366849586>',
  octoOwo: '<:owowow:1520500390699995199>',
  octoMelt: '<a:SilvervaleMelts:1466024241089478750>',
  // Standard / SuMi cute button fallback
  btnGiftId: '1511261145292472350',
  btnCheckEmoji: '<:redticket:1511575728301543545>'
};

export class GraphBuilder {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this._edgeIds = new Set();
    this._nodeIds = new Set();
  }

  _addNode(node) {
    if (this._nodeIds.has(node.id)) {
      throw new Error(`Duplicate node id: ${node.id}`);
    }
    this._nodeIds.add(node.id);
    this.nodes.push(node);
    return node.id;
  }

  _addEdge(edge) {
    if (this._edgeIds.has(edge.id)) {
      throw new Error(`Duplicate edge id: ${edge.id}`);
    }
    this._edgeIds.add(edge.id);
    this.edges.push(edge);
    return edge.id;
  }

  rootSlash(name, description, { ephemeral = false, allow_dms = false, hide_without_permissions = false } = {}) {
    return this._addNode({
      id: 'root',
      type: 'root',
      draggable: false,
      position: { x: 0, y: 0 },
      width: 600,
      height: 200,
      data: {
        title: name,
        description,
        event: false,
        enabled: true,
        data: {
          command_type: 'slash',
          allow_dms,
          hide_without_permissions,
          ephemeral,
          error_ephemeral: true,
          cooldown: { type: 'disabled', interval: 1, interval_type: 'minutes' },
          permissions: {
            allowed_roles: [{ name: '@everyone', id: 'everyone' }],
            banned_roles: [],
            banned_channels: [],
            banned_users: [],
            required_permissions: []
          },
          validated: true
        }
      }
    });
  }

  rootEvent(name, type, extraData = {}) {
    const data = {
      name,
      type,
      error_mode: 'simple',
      error_reply: 'none',
      error_ephemeral: true,
      validated: true,
      ...extraData
    };
    if (type === 'triggeredByBlock') {
      data.triggeredByBlock = true;
      data.trigger_inputs = data.trigger_inputs || [];
      data.trigger_outputs = data.trigger_outputs || [];
    }
    return this._addNode({
      id: 'root',
      type: 'root',
      draggable: false,
      position: { x: 0, y: 0 },
      width: 600,
      height: 200,
      data: {
        event: true,
        enabled: true,
        data
      }
    });
  }

  option(name, type, description, { required = false, autocomplete_choices = [], choices = undefined, x = 420, y = 0 } = {}) {
    const optId = this._addNode({
      id: `opt_${name}`,
      type: 'option',
      draggable: true,
      position: { x, y },
      width: 280,
      height: 90,
      data: {
        node_options: { __OPT_TYPE__: type },
        data: {
          type,
          name,
          description,
          required,
          validated: true,
          autocomplete_choices,
          ...(choices ? { choices } : {})
        }
      }
    });
    if (this._nodeIds.has('root')) {
      this._addEdge({
        source: optId,
        target: 'root',
        type: 'step',
        animated: false,
        arrowHeadType: 'arrowclosed',
        id: `reactflow__edge-${optId}-root`
      });
    }
    return optId;
  }

  errorHandlerWait(waitId = 'err_wait') {
    this._addNode({
      id: 'error_handler',
      type: 'error',
      position: { x: -450, y: 0 },
      draggable: false,
      width: 301,
      height: 113,
      data: {
        node_options: { __LIVE_ERR__: true },
        data: {}
      }
    });
    this._addNode({
      id: waitId,
      type: 'action',
      position: { x: -450, y: 200 },
      draggable: true,
      width: 330,
      height: 100,
      data: {
        node_options: { __ACT_OPT__: 'wait_action' },
        data: {
          type: 'wait_action',
          seconds: '1',
          success_handles: false,
          validated: true,
          linked: true
        }
      }
    });
    this._addEdge({
      source: 'error_handler',
      target: waitId,
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: `reactflow__edge-error_handler-${waitId}`
    });
  }

  act(id, type, data, { x = 0, y = 0, actOptKey = null } = {}) {
    const key = actOptKey || (type === 'delete_var' ? 'math_var:Delete Variable' : (type === 'math_var' ? 'math_var:Run Equation on Variable' : type));
    return this._addNode({
      id,
      type: 'action',
      position: { x, y },
      draggable: true,
      width: 330,
      height: 100,
      data: {
        node_options: { __ACT_OPT__: key },
        data: {
          type,
          validated: true,
          linked: true,
          ...data
        }
      }
    });
  }

  cond(id, condition_type, data, { x = 0, y = 0 } = {}) {
    return this._addNode({
      id,
      type: 'condition',
      position: { x, y },
      draggable: true,
      width: 350,
      height: 100,
      data: {
        node_options: { __COND_OPT__: condition_type },
        data: {
          type: 'condition',
          condition_type,
          multiple: false,
          validated: true,
          linked: true,
          ...data
        }
      }
    });
  }

  branch(condId, branchId, condType, data, { x = 0, y = 0 } = {}) {
    this._addNode({
      id: branchId,
      type: 'conditionChild',
      position: { x, y },
      draggable: true,
      width: 260,
      height: 100,
      data: {
        node_options: { type: condType },
        data: {
          validated: true,
          actions: [],
          ...data
        }
      }
    });
    this._addEdge({
      source: condId,
      target: branchId,
      type: 'step',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: `reactflow__edge-${condId}-${branchId}`
    });
    return branchId;
  }

  elseBranch(condId, elseId, condType, { x = 0, y = 0 } = {}) {
    return this.branch(condId, elseId, condType, { type: 'else', validated: undefined }, { x, y });
  }

  cmp(id, baseVal, cmpVal, op = 'equal_to', extra = {}, { x = 0, y = 0 } = {}) {
    this.cond(id, 'comparison', { base_value: baseVal, target: { self: true } }, { x, y });
    const yes = `${id}_yes`;
    const no = `${id}_no`;
    this.branch(id, yes, 'comparison', {
      type: op,
      comparison_value: cmpVal,
      ignoreCase: false,
      option: '',
      not: false,
      ...extra
    }, { x: x - 180, y: y + 160 });
    this.elseBranch(id, no, 'comparison', { x: x + 180, y: y + 160 });
    return { condId: id, yes, no };
  }

  loopList(id, list_reference, { x = 0, y = 0, timeout = '10' } = {}) {
    this._addNode({
      id,
      type: 'action',
      position: { x, y },
      draggable: true,
      width: 340,
      height: 100,
      data: {
        node_options: { __ACT_OPT__: 'loop' },
        data: {
          type: 'loop',
          loop_over: 'list',
          list_reference,
          count: '1',
          timeout,
          actions: [],
          success_handles: false,
          validated: true,
          linked: true
        }
      }
    });
    const actsId = `${id}_acts`;
    const afterId = `${id}_after`;
    this._addNode({
      id: actsId,
      type: 'loopChild',
      draggable: true,
      position: { x: x + 220, y: y + 140 },
      width: 240,
      height: 80,
      data: { type: 'loop_actions' }
    });
    this._addEdge({
      source: id,
      sourceHandle: 'loop_actions',
      target: actsId,
      type: 'step',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: `reactflow__edge-${id}loop_actions-${actsId}`
    });
    this._addNode({
      id: afterId,
      type: 'loopChild',
      draggable: true,
      position: { x: x - 220, y: y + 140 },
      width: 240,
      height: 80,
      data: { type: 'loop_after' }
    });
    this._addEdge({
      source: id,
      sourceHandle: 'loop_after',
      target: afterId,
      type: 'step',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: `reactflow__edge-${id}loop_after-${afterId}`
    });
    return { loopId: id, actsId, afterId };
  }

  loopCount(id, count, { x = 0, y = 0, timeout = '10' } = {}) {
    this._addNode({
      id,
      type: 'action',
      position: { x, y },
      draggable: true,
      width: 340,
      height: 100,
      data: {
        node_options: { __ACT_OPT__: 'loop' },
        data: {
          type: 'loop',
          loop_over: 'count',
          count: String(count),
          timeout,
          actions: [],
          success_handles: false,
          validated: true,
          linked: true
        }
      }
    });
    const actsId = `${id}_acts`;
    const afterId = `${id}_after`;
    this._addNode({
      id: actsId,
      type: 'loopChild',
      draggable: true,
      position: { x: x + 220, y: y + 140 },
      width: 240,
      height: 80,
      data: { type: 'loop_actions' }
    });
    this._addEdge({
      source: id,
      sourceHandle: 'loop_actions',
      target: actsId,
      type: 'step',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: `reactflow__edge-${id}loop_actions-${actsId}`
    });
    this._addNode({
      id: afterId,
      type: 'loopChild',
      draggable: true,
      position: { x: x - 220, y: y + 140 },
      width: 240,
      height: 80,
      data: { type: 'loop_after' }
    });
    this._addEdge({
      source: id,
      sourceHandle: 'loop_after',
      target: afterId,
      type: 'step',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: `reactflow__edge-${id}loop_after-${afterId}`
    });
    return { loopId: id, actsId, afterId };
  }

  advBtn(id, parentMsgId, data, { x = 0, y = 0 } = {}) {
    this._addNode({
      id,
      type: 'advMessageButton',
      draggable: true,
      position: { x, y },
      width: 260,
      height: 80,
      data: {
        node_options: data.v2ComponentId
          ? { title: 'Button', description: 'ComponentsV2 button', v2ComponentId: data.v2ComponentId, v2ParentId: data.v2ParentId || null }
          : {},
        data: {
          type: 'button',
          style: 'SECONDARY',
          orderComponent: false,
          weight: '',
          row: '',
          showReplies: 'hide',
          validated: true,
          ...data
        }
      }
    });
    this._addEdge({
      source: parentMsgId,
      sourceHandle: 'components_source',
      target: id,
      type: 'step',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: `reactflow__edge-${parentMsgId}components_source-${id}`
    });
    return id;
  }

  link(source, target, sourceHandle = 'action', targetHandle = 'action') {
    const sh = sourceHandle || '';
    const th = targetHandle || '';
    return this._addEdge({
      source,
      target,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
      type: 'custom',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: `reactflow__edge-${source}${sh}-${target}${th}`
    });
  }

  chain(ids, firstHandle = 'action') {
    for (let i = 0; i < ids.length - 1; i++) {
      this.link(ids[i], ids[i + 1], i === 0 ? firstHandle : 'action', 'action');
    }
    return ids[ids.length - 1];
  }

  elements() {
    return [...this.nodes, ...this.edges];
  }
}

export function validateRegexSafety(pattern) {
  const errs = [];
  if (typeof pattern !== 'string') return ['Pattern is not a string'];
  if (pattern.length > 500) errs.push(`Pattern length ${pattern.length} > 500`);
  if (/[{}]/.test(pattern)) errs.push(`Pattern contains forbidden { or } brace: ${pattern}`);
  if (/^\s/.test(pattern)) errs.push(`Pattern starts with raw whitespace (use [ ] instead): ${JSON.stringify(pattern)}`);
  try {
    new RegExp(pattern.trim(), 'i');
  } catch (e) {
    errs.push(`Invalid RegExp: ${e.message}`);
  }
  return errs;
}

export function validateGraph(elements, { forbidAdminOnSuMiCheck = false } = {}) {
  const errs = [];
  const nodes = new Map();
  const edges = [];

  for (const el of elements) {
    if (el.source && el.target) edges.push(el);
    else {
      if (nodes.has(el.id)) errs.push(`Duplicate node id ${el.id}`);
      nodes.set(el.id, el);
    }
  }

  for (const e of edges) {
    if (!nodes.has(e.source)) errs.push(`Edge ${e.id} missing source ${e.source}`);
    if (!nodes.has(e.target)) errs.push(`Edge ${e.id} missing target ${e.target}`);
  }

  const outEdges = new Map();
  for (const e of edges) {
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source).push(e);
  }

  for (const [id, n] of nodes.entries()) {
    const d = n.data?.data;
    if (n.type === 'action') {
      if (!d || d.validated !== true) errs.push(`Action ${id} not validated=true`);
      if (d?.type === 'loop') {
        if (!d.timeout || String(d.timeout).trim() === '') errs.push(`Loop ${id} missing timeout`);
        if (d.loop_over === 'while') errs.push(`Loop ${id} uses forbidden loop_over='while'`);
        if (d.loop_over === 'list') {
          if (!d.list_reference) errs.push(`Loop ${id} missing list_reference`);
          if ('list_key' in d && String(d.list_key).trim() === '') errs.push(`Loop ${id} has empty list_key (must be omitted)`);
        } else if (d.loop_over === 'count') {
          if (!d.count) errs.push(`Loop ${id} missing count`);
        }
        const kids = (outEdges.get(id) || []).map(x => nodes.get(x.target)).filter(Boolean);
        const hasActs = kids.some(k => k.type === 'loopChild' && k.data?.type === 'loop_actions');
        const hasAfter = kids.some(k => k.type === 'loopChild' && k.data?.type === 'loop_after');
        if (!hasActs || !hasAfter) errs.push(`Loop ${id} missing loop_actions or loop_after child`);
      }
      if (d?.type === 'string_manipulation' && d.operation?.type === 'regexReplace') {
        try { new RegExp(d.operation.search, d.operation.flags || 'g'); }
        catch (err) { errs.push(`Node ${id} invalid regexReplace: ${err.message}`); }
      }
      if (d?.type === 'advanced_message' && d.useComponentsV2 && d.componentsV2Data) {
        const c = d.componentsV2Data.components || [];
        if (c.length > 40) errs.push(`Node ${id} ComponentsV2 count ${c.length} > 40`);
      }
    }
    if (n.type === 'condition') {
      if (!d || d.validated !== true) errs.push(`Condition ${id} not validated=true`);
      const kids = (outEdges.get(id) || []).filter(x => x.type === 'step' || x.type === 'custom');
      if (kids.length === 0) errs.push(`Condition ${id} has 0 step branches`);
      if (forbidAdminOnSuMiCheck && d?.condition_type === 'permissions') {
        const hasAdmin = kids.some(kEdge => (nodes.get(kEdge.target)?.data?.data?.permissions || []).includes('ADMINISTRATOR'));
        if (hasAdmin) {
          const sumiCheckNodes = new Set(
            [...nodes.values()]
              .filter(cn => cn.type === 'condition' && cn.data?.data?.condition_type === 'comparison' && cn.data?.data?.base_value === '{server_id}')
              .map(cn => cn.id)
          );
          const blockedNonSumiBranches = new Set();
          for (const scId of sumiCheckNodes) {
            for (const ce of (outEdges.get(scId) || [])) {
              const kn = nodes.get(ce.target);
              if (kn?.type === 'conditionChild' && kn.data?.data?.type === 'else') {
                blockedNonSumiBranches.add(kn.id);
              }
            }
          }
          const q = ['root'];
          const vis = new Set(['root']);
          let reachableInSumi = false;
          while (q.length) {
            const cur = q.shift();
            if (cur === id) { reachableInSumi = true; break; }
            for (const oe of (outEdges.get(cur) || [])) {
              if (!blockedNonSumiBranches.has(oe.target) && !vis.has(oe.target)) {
                vis.add(oe.target);
                q.push(oe.target);
              }
            }
          }
          if (reachableInSumi) {
            errs.push(`FORBIDDEN ADMINISTRATOR permission check reachable in SuMi /giveaway_check (${id})`);
          }
        }
      }
    }
    if (n.type === 'conditionChild') {
      const cd = n.data?.data;
      if (cd && (cd.type === 'matches_pattern' || cd.type === 'not_matches_pattern')) {
        for (const rErr of validateRegexSafety(cd.comparison_value)) {
          errs.push(`Branch ${id}: ${rErr}`);
        }
      }
    }
  }

  return errs;
}

export async function cdpEval(expr, timeoutMs = 25000) {
  const targets = await new Promise((res, rej) => {
    const req = http.get('http://127.0.0.1:9222/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    });
    req.on('error', rej);
    req.setTimeout(10000, () => {
      req.destroy(new Error('HTTP timeout fetching CDP targets'));
    });
  });
  const t = targets.find(x => x.type === 'page' && x.url && x.url.includes('botghost.com'));
  if (!t) throw new Error('No BotGhost builder target found on Edge CDP 9222');
  const WS = globalThis.WebSocket || WebSocket;
  return new Promise((res, rej) => {
    const ws = new WS(t.webSocketDebuggerUrl);
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      fn(arg);
    };
    const timer = setTimeout(() => {
      finish(rej, new Error(`cdpEval timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ id: 999, method: 'Page.bringToFront', params: {} }));
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    });
    ws.addEventListener('message', ev => {
      const rawData = typeof ev.data === 'string' ? ev.data : ev.data.toString();
      const msg = JSON.parse(rawData);
      if (msg.id === 1) {
        if (msg.result && msg.result.exceptionDetails) {
          finish(rej, new Error('CDP Exception: ' + JSON.stringify(msg.result.exceptionDetails)));
        } else {
          finish(res, msg.result && msg.result.result ? msg.result.result.value : undefined);
        }
      }
    });
    ws.addEventListener('error', err => finish(rej, err));
  });
}

export async function ensureBuilderMounted() {
  // Check if CommandBuilder is mounted on the active BotGhost tab; if not, navigate to /dashboard/customevents and click Open builder
  const check = await cdpEval(`(() => {
    const rootEl = document.getElementById('root') || document.body;
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    if (!rk) return { hasStore: false, hasCb: false, url: location.href };
    const q = [rootEl[rk]], seen = new Set();
    let store = null, cb = null;
    while (q.length) {
      const n = q.shift();
      if (!n || seen.has(n)) continue; seen.add(n);
      if (!store && (n.memoizedProps?.store?.getState || n.stateNode?.getState)) {
        store = n.memoizedProps?.store || n.stateNode;
      }
      if (!cb && n.stateNode && typeof n.stateNode.validateSave === 'function' && typeof n.stateNode.buildCommand === 'function') {
        cb = n.stateNode;
      }
      if (store && cb) break;
      if (n.child) q.push(n.child);
      if (n.sibling) q.push(n.sibling);
    }
    return { hasStore: !!store, hasCb: !!cb, url: location.href };
  })()`, 15000);

  if (check && check.hasStore && check.hasCb) {
    return check;
  }

  // Navigate to /dashboard/customevents via History API or location and open first event's builder
  await cdpEval(`(async () => {
    window.history.pushState({}, '', '/dashboard/customevents');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise(r => setTimeout(r, 1500));
    for (let i = 0; i < 15; i++) {
      const openBtn = [...document.querySelectorAll('button')].find(b => /Open builder/i.test(b.innerText || ''));
      if (openBtn) {
        openBtn.click();
        return { clickedOpenBuilder: true };
      }
      const cards = [...document.querySelectorAll('div, h3, h4, span')].filter(el => el.textContent?.trim() === 'Automod Fubel v2' || /Automod/i.test(el.textContent?.trim() || ''));
      if (cards.length > 0) {
        cards[0].click();
      }
      await new Promise(r => setTimeout(r, 400));
    }
    return { clickedOpenBuilder: false, url: location.href };
  })()`, 20000);

  await new Promise(r => setTimeout(r, 2000));
  return await cdpEval(`(() => {
    const rootEl = document.getElementById('root') || document.body;
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    if (!rk) return { hasStore: false, hasCb: false, url: location.href };
    const q = [rootEl[rk]], seen = new Set();
    let store = null, cb = null;
    while (q.length) {
      const n = q.shift();
      if (!n || seen.has(n)) continue; seen.add(n);
      if (!store && (n.memoizedProps?.store?.getState || n.stateNode?.getState)) {
        store = n.memoizedProps?.store || n.stateNode;
      }
      if (!cb && n.stateNode && typeof n.stateNode.validateSave === 'function' && typeof n.stateNode.buildCommand === 'function') {
        cb = n.stateNode;
      }
      if (store && cb) break;
      if (n.child) q.push(n.child);
      if (n.sibling) q.push(n.sibling);
    }
    return { hasStore: !!store, hasCb: !!cb, url: location.href };
  })()`, 15000);
}

export const SUMI_BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';

/**
 * Reusable BotGhost First-Command Update Ack Gate branch.
 * Connects from `sourceNodeId` (after api_action storing `resVarName`), shows v1.2 changelog + button when
 * `{resVarName.response.needs_update_ack} == "true"`, and returns the `no` branch ID for normal flow.
 */
export function attachUpdateAckBranch(gb, prefix, sourceNodeId, resVarName, {
  editId = null,
  ackUrl = `${SUMI_BACKEND_BASE}/api/update/ack`,
  x = 0,
  y = 0,
} = {}) {
  const gate = gb.cmp(`${prefix}_gate`, `{${resVarName}.response.needs_update_ack}`, 'true', 'equal_to', { ignoreCase: true }, { x, y });
  gb.link(sourceNodeId, gate.condId);

  const msgData = {
    messageType: 'basic',
    useComponentsV2: false,
    target: editId ? { editId } : { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: `{${resVarName}.response.update_title}`,
        description: `{${resVarName}.response.update_description}`,
        color: '#ec4899',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        footer: { text: `{${resVarName}.response.footer}`, icon_url: '' },
      }],
    },
    components: [],
    componentsV2Data: null,
    reactions: '',
  };
  if (editId) {
    msgData.editId = editId;
    msgData.action_id = editId;
  }

  const gateMsgId = `${prefix}_gate_msg`;
  gb.act(gateMsgId, 'advanced_message', msgData, { x: x - 260, y: y + 180 });
  gb.link(gate.yes, gateMsgId);

  const btnId = `${prefix}_gate_btn`;
  gb.advBtn(btnId, gateMsgId, {
    label: 'Tôi Đã Đọc & Xác Nhận Cập Nhật v1.3',
    style: 'SUCCESS',
    emoji: { id: '1573411649543737426', name: 'su_sparkle', animated: true },
    emoji_id: '1573411649543737426',
    orderComponent: true,
    row: '1',
    weight: '1',
    showReplies: 'show',
  }, { x: x - 260, y: y + 360 });

  const ackApiId = `${prefix}_gate_ack_api`;
  gb.act(ackApiId, 'api_action', {
    name: `${prefix}_ack_res`,
    ephemeral: false,
    request_options: {
      method: 'POST',
      url: ackUrl,
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'x-api-key', value: '{SECRET_BACKEND_KEY}' },
      ],
      params: [],
      body: [],
      rawBody: '{"userId":"{user_id}"}',
      contentType: 'application/json',
      options: {
        excludeEmptyFields: true,
        replaceParams: true,
        replaceURL: true,
        replaceHeaders: true,
        replaceBody: true,
        jsonSafeVariables: true,
        bodyMode: 'raw',
        contentType: 'application/json',
        failOnError: false,
      },
    },
    success_handles: false,
  }, { x: x - 260, y: y + 540 });
  gb.link(btnId, ackApiId);

  const ackDoneId = `${prefix}_gate_done_msg`;
  gb.act(ackDoneId, 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '<a:su_sparkle:1573411649543737426> ĐÃ XÁC NHẬN CẬP NHẬT v1.3',
        description: `{${prefix}_ack_res.response.message}`,
        color: '#10b981',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        footer: { text: 'SuMi Family • Phiên bản v1.3 đã được mở khóa', icon_url: '' },
      }],
    },
    components: [],
    componentsV2Data: null,
    reactions: '',
  }, { x: x - 260, y: y + 720 });
  gb.link(ackApiId, ackDoneId);

  return gate.no;
}

export async function getLiveInventory() {
  const expr = `(() => {
    const rootEl = document.getElementById('root');
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer$'));
    let f = rootEl[rk], store = null, queue = [f], seen = new Set();
    while (queue.length) {
      const n = queue.shift();
      if (!n || seen.has(n)) continue; seen.add(n);
      if (n.memoizedProps?.store) { store = n.memoizedProps.store; break; }
      if (n.child) queue.push(n.child);
      if (n.sibling) queue.push(n.sibling);
    }
    const st = store.getState();
    const bot = st.data.bot;
    return JSON.stringify({
      last_save: bot.last_save,
      custom_events: (bot.commands.custom_events?.events || []).map((e, idx) => ({ idx, name: e.name, type: e.type, int_id: e.int_id, id: e.id, groupId: e.groupId, enabled: e.enabled })),
      slash_commands: (bot.commands.slash?.commands || []).map((c, idx) => ({ idx, name: c.name, id: c.id, int_id: c.int_id, groupId: c.groupId, enabled: c.enabled })),
      variables: (bot.commands.variables?.variables || []).map(v => ({ name: v.name, reference: v.reference, type: v.type, dataType: v.dataType, global: v.global, groupId: v.groupId }))
    });
  })()`;
  return JSON.parse(await cdpEval(expr, 15000));
}

export async function deployViaCDP({ groupId = GA_GROUP_ID, mode, name, elements, enabled = true, forbidAdminOnSuMiCheck = false }) {
  const errs = validateGraph(elements, { forbidAdminOnSuMiCheck });
  if (errs.length) throw new Error(`Offline validation failed for ${name}:\n- ${errs.join('\n- ')}`);

  await ensureBuilderMounted();

  // Extract actMap, condMap, optMap, and liveErrOpts from existing saved commands/events in Node.js via LZString
  const allTrees = await cdpEval(`(() => {
    const rootEl = document.getElementById('root') || document.body;
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    const q = [rootEl[rk]], seen = new Set();
    let store = null;
    while (q.length) {
      const n = q.shift();
      if (!n || seen.has(n)) continue; seen.add(n);
      if (n.memoizedProps?.store?.getState || n.stateNode?.getState) {
        store = n.memoizedProps?.store || n.stateNode;
        break;
      }
      if (n.child) q.push(n.child);
      if (n.sibling) q.push(n.sibling);
    }
    const bot = store.getState().data.bot;
    return {
      slash: (bot.commands.slash?.commands || []).map(x => x.compressed_tree).filter(Boolean),
      events: (bot.commands.custom_events?.events || []).map(x => x.compressed_tree).filter(Boolean)
    };
  })()`, 10000);

  const actMap = {
    wait_action: { title: 'Wait before running another action', description: 'Wait before running another action', isActionBlock: true },
    set_unique_variable: { title: 'Set a unique variable', description: 'Set a unique variable', isActionBlock: true },
    advanced_message: { title: 'Send or Edit a Message', description: 'Send or edit a message', isActionBlock: false },
    api_action: { title: 'Send an API Request', description: 'Send an API Request', isActionBlock: true },
    role_add: { title: 'Add Roles', description: 'Adds one or more roles to a user', isActionBlock: false },
    role_remove: { title: 'Remove Roles', description: 'Removes one or more roles from a user', isActionBlock: false },
    loop: { title: 'Run a Loop', description: 'Run blocks again and again: a set number of times, for each item or member, or while something is true', isActionBlock: false },
  };
  const condMap = {
    comparison: { title: 'Compare values', description: 'Compare two values', isActionBlock: false }
  };
  const optMap = {
    string: { title: 'Text', description: 'A text option', isActionBlock: false },
    int: { title: 'Number', description: 'A number option', isActionBlock: false },
    user: { title: 'User', description: 'Select a member from the server', isActionBlock: false },
    channel: { title: 'Channel', description: 'Select a channel from the server', isActionBlock: false },
    role: { title: 'Role', description: 'Select a role from the server', isActionBlock: false },
    boolean: { title: 'Choice', description: 'A True or False option', isActionBlock: false },
    attachment: { title: 'Attachment', description: 'An attachment option', isActionBlock: false }
  };
  let liveErrOpts = { title: 'Error Handler', description: 'Handle errors that occur during the command execution' };

  for (const tree of [...(allTrees.slash || []), ...(allTrees.events || [])]) {
    const raw = LZString.decompressFromBase64(tree);
    if (!raw) continue;
    let els;
    try { els = JSON.parse(raw); } catch { continue; }
    for (const el of els) {
      if (el.type === 'error' && el.data?.node_options?.title) liveErrOpts = el.data.node_options;
      if (el.type === 'action' && el.data?.data?.type && el.data?.node_options?.title) {
        const t = el.data.data.type;
        actMap[`${t}:${el.data.node_options.title}`] = el.data.node_options;
        if (!actMap[t] || el.data.node_options.title !== 'Delete Variable') actMap[t] = el.data.node_options;
      }
      if (el.type === 'condition' && el.data?.data?.condition_type && el.data?.node_options?.title) {
        condMap[el.data.data.condition_type] = el.data.node_options;
      }
      if (el.type === 'option' && el.data?.data?.type && el.data?.node_options?.title) {
        optMap[el.data.data.type] = el.data.node_options;
      }
    }
  }

  const missingOpts = [];
  const resolvedEls = elements.map(el => {
    const copy = JSON.parse(JSON.stringify(el));
    if (copy.data?.node_options?.__LIVE_ERR__) {
      copy.data.node_options = JSON.parse(JSON.stringify(liveErrOpts));
    } else if (copy.data?.node_options?.__ACT_OPT__) {
      const k = copy.data.node_options.__ACT_OPT__;
      if (!actMap[k]) missingOpts.push('act:' + k);
      else copy.data.node_options = JSON.parse(JSON.stringify(actMap[k]));
    } else if (copy.data?.node_options?.__COND_OPT__) {
      const k = copy.data.node_options.__COND_OPT__;
      if (!condMap[k]) missingOpts.push('cond:' + k);
      else copy.data.node_options = JSON.parse(JSON.stringify(condMap[k]));
    } else if (copy.data?.node_options?.__OPT_TYPE__) {
      const t = copy.data.node_options.__OPT_TYPE__;
      if (!optMap[t]) missingOpts.push('opt:' + t);
      else copy.data.node_options = JSON.parse(JSON.stringify(optMap[t]));
    }
    return copy;
  });
  if (missingOpts.length) return { ok: false, error: 'Missing node_options', missingOpts };

  const payloadJson = JSON.stringify({ mode, name, groupId, resolvedEls, enabled });
  const browserFn = async function (payloadStr) {
    const cfg = JSON.parse(payloadStr);
    const rootEl = document.getElementById('root') || document.body;
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    const findInFiber = (pred) => {
      const q = [rootEl[rk]], seen = new Set();
      while (q.length) {
        const n = q.shift();
        if (!n || seen.has(n)) continue; seen.add(n);
        const r = pred(n);
        if (r) return r;
        if (n.child) q.push(n.child);
        if (n.sibling) q.push(n.sibling);
      }
      return null;
    };
    const store = findInFiber(n => n.memoizedProps?.store?.getState ? n.memoizedProps.store : (n.stateNode?.getState ? n.stateNode : null));
    const cb = findInFiber(n => n.stateNode && typeof n.stateNode.validateSave === 'function' && typeof n.stateNode.buildCommand === 'function' ? n.stateNode : null);
    if (!store || !cb) return { ok: false, error: 'Missing store or CommandBuilder instance', url: location.href };

    const resolvedEls = cfg.resolvedEls;
    const st0 = store.getState();
    let targetIdx = null;
    if (cfg.mode === 'event') {
      const list = st0.data.bot.commands.custom_events?.events || [];
      const found = list.findIndex(e => e.name === cfg.name);
      targetIdx = found >= 0 ? found : null;
    } else {
      const list = st0.data.bot.commands.slash?.commands || [];
      const found = list.findIndex(c => c.name === cfg.name);
      targetIdx = found >= 0 ? found : null;
    }

    cb.props.setBuilderMode(
      cfg.mode === 'event'
        ? { mode: 'event', components: { Guild: true, Channel: true, User: true, Member: true, Message: true } }
        : { mode: 'command', components: { Guild: true, Channel: true, User: true, Member: true, Reply: true } }
    );
    cb.props.setBuilderIndex(targetIdx);
    store.dispatch({ type: 'SET_GROUP_ID', payload: cfg.groupId });
    cb.props.setSelected(null);
    cb.props.setElements(resolvedEls);
    await new Promise(r => setTimeout(r, 400));

    const fitBtn = document.querySelector('.react-flow__controls-fitview');
    if (fitBtn) fitBtn.click();
    await new Promise(r => setTimeout(r, 150));

    const firstTestNode = resolvedEls.find(e => e.type === 'action' || e.type === 'condition');
    if (firstTestNode) {
      cb.props.setSelected(String(firstTestNode.id));
      await new Promise(r => setTimeout(r, 100));
      cb.props.setSelected(null);
      await new Promise(r => setTimeout(r, 100));
    }

    const probBtn = [...document.querySelectorAll('button')].find(b => /Problems|No problems/i.test(b.innerText || ''));
    const probText = probBtn ? probBtn.innerText.trim().replace(/\s+/g, ' ') : null;
    const canSave = cb.validateSave();

    if (!canSave || (probText && /Problems\s+[1-9]/.test(probText))) {
      if (probBtn && /Problems\s+[1-9]/.test(probText)) probBtn.click();
      await new Promise(r => setTimeout(r, 200));
      const stBad = store.getState();
      const invalidNodes = (stBad.builder.elements || [])
        .filter(e => e.data?.data && e.data.data.validated === false)
        .map(e => ({ id: e.id, type: e.data.data.type }));
      return { ok: false, blocked: true, canSave, probText, invalidNodes, bodyTail: document.body.innerText.slice(-900) };
    }

    const beforeSave = store.getState().data.bot.last_save;
    const saveBtnRe = cfg.mode === 'event' ? /^Save Event$/i : /^Save Command$/i;
    let saveBtn = null;
    for (let w = 0; w < 15; w++) {
      saveBtn = [...document.querySelectorAll('button')].find(b => saveBtnRe.test((b.innerText || '').trim()));
      if (saveBtn) break;
      await new Promise(r => setTimeout(r, 200));
    }
    if (saveBtn) {
      await new Promise(r => setTimeout(r, 250));
      saveBtn.click();
    } else if (typeof cb.save === 'function') {
      await cb.save();
    } else {
      return { ok: false, error: 'Save button not found', mode: cfg.mode, canSave, probText };
    }

    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 250));
      const st = store.getState();
      if (i === 20 && st.data.bot.last_save === beforeSave) {
        if (typeof cb.save === 'function') {
          try { cb.save(); } catch {}
        } else {
          const retryBtn = [...document.querySelectorAll('button')].find(b => saveBtnRe.test((b.innerText || '').trim()) && !b.disabled);
          if (retryBtn) retryBtn.click();
        }
      }
      if (st.data.bot.last_save !== beforeSave) {
        const list = cfg.mode === 'event'
          ? (st.data.bot.commands.custom_events?.events || [])
          : (st.data.bot.commands.slash?.commands || []);
        const saved = list.find(x => x.name === cfg.name);
        if (!saved || !saved.compressed_tree) {
          return { ok: false, error: 'Saved item missing compressed_tree', name: cfg.name };
        }
        return {
          ok: true,
          mode: cfg.mode,
          name: cfg.name,
          probText,
          canSave,
          builderSaveRequired: st.builder.builderSaveRequired ?? st.builder.saveRequired ?? null,
          beforeSave,
          afterSave: st.data.bot.last_save,
          compressed_tree: saved.compressed_tree,
          savedSummary: {
            name: saved.name,
            type: saved.type || 'slash',
            id: saved.id,
            int_id: saved.int_id,
            groupId: saved.groupId,
            enabled: saved.enabled,
            actions_hash: saved.actions_hash,
            optionsCount: Array.isArray(saved.options) ? saved.options.length : 0,
            inputCount: resolvedEls.length
          }
        };
      }
    }
    return { ok: false, timeout: true, probText, canSave };
  };

  const expr = `(${browserFn.toString()})(${JSON.stringify(payloadJson)})`;
  const raw = await cdpEval(expr, 25000);
  if (raw && raw.ok && raw.compressed_tree) {
    const decompressed = JSON.parse(LZString.decompressFromBase64(raw.compressed_tree));
    raw.savedSummary.decompressedCount = decompressed.length;
    delete raw.compressed_tree;
  }
  return raw;
}
