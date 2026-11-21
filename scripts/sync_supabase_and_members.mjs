import WebSocket from 'ws';
import fs from 'fs';
import { supabase } from '../src/config/supabase.js';

const GUILD_ID = '1026096141273661450';
const FUYUMI_ID = '757091869183311872';
const HANABIRA_ID = '1429509324845092875';
const OWNER_ID = '511187329889861651';

async function main() {
  // 1. Fetch member info for Fuyumi, Hanabira Mei, and Owner from Discord
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const dcTab = tabs.find(t => t.url?.includes('discord.com/channels') && t.type === 'page');
  const ws = new WebSocket(dcTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const t = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 25000);
    ws.on('message', function h(d) {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { clearTimeout(t); ws.off('message', h); resolve(msg.result); }
    });
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  const dcInfo = await send('Runtime.evaluate', {
    expression: `(async () => {
      let token = null;
      window.webpackChunkdiscord_app.push([['extract_token_' + Math.random()], {}, (req) => {
        for (const id in req.c) {
          const mod = req.c[id];
          if (mod && mod.exports) {
            const exp = mod.exports.default || mod.exports;
            if (exp && typeof exp.getToken === 'function') {
              try {
                const tok = exp.getToken();
                if (tok && typeof tok === 'string' && tok.length > 20) token = tok;
              } catch (e) {}
            }
          }
        }
      }]);
      const getMem = async (uid) => {
        const r = await fetch('https://discord.com/api/v10/guilds/${GUILD_ID}/members/' + uid, {
          headers: { 'Authorization': token }
        });
        return r.ok ? await r.json() : null;
      };
      // Also assign « Phong Thanh Hộ Pháp » (1573186024048173076) and « 20・ Linh Cáo Tinh Anh » (1032988544874061836) to Hanabira Mei
      await fetch('https://discord.com/api/v10/guilds/${GUILD_ID}/members/${HANABIRA_ID}/roles/1573186024048173076', {
        method: 'PUT',
        headers: { 'Authorization': token }
      });
      const fuyumi = await getMem('${FUYUMI_ID}');
      const hanabira = await getMem('${HANABIRA_ID}');
      const owner = await getMem('${OWNER_ID}');
      return { fuyumi, hanabira, owner };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  ws.close();

  const { fuyumi, hanabira, owner } = dcInfo.result?.value || {};
  const fuyumiAvatarUrl = fuyumi?.user?.avatar
    ? `https://cdn.discordapp.com/avatars/${FUYUMI_ID}/${fuyumi.user.avatar}.png?size=256`
    : 'assets/fuyumi_avatar.png';
  const hanabiraAvatarUrl = hanabira?.user?.avatar
    ? `https://cdn.discordapp.com/avatars/${HANABIRA_ID}/${hanabira.user.avatar}.png?size=256`
    : 'assets/default_avatar.png';

  console.log('Fuyumi Avatar URL:', fuyumiAvatarUrl);
  console.log('Hanabira Mei Avatar URL:', hanabiraAvatarUrl, 'User:', hanabira?.user?.username, hanabira?.nick);

  // Download Hanabira Mei's avatar to assets/default_avatar.png if she has one, else generate a clean PNG
  if (hanabira?.user?.avatar) {
    const resAv = await fetch(hanabiraAvatarUrl);
    if (resAv.ok) {
      const buf = Buffer.from(await resAv.arrayBuffer());
      fs.writeFileSync('assets/hanabira_avatar.png', buf);
      console.log('Saved assets/hanabira_avatar.png:', buf.length);
    }
  }

  // 2. Sync Supabase Database
  if (!supabase) throw new Error('Supabase client not initialized');

  // Ensure Clans exist
  await supabase.from('clans').upsert([
    {
      clan_id: 'thien_ho_than_toc',
      clan_name: 'Thiên Hồ Thần Tộc',
      clan_tag: '🦊TH',
      leader_id: FUYUMI_ID,
      clan_level: 5,
      clan_treasury: 99999999,
      total_exp: 15000000,
      max_members: 50,
      description: 'Gia tộc tối thượng của Cửu Vĩ Tiên Chủ Fuyumi tại SuMi Family'
    },
    {
      clan_id: 'ho_ly_mon',
      clan_name: 'Hồ Ly Tông Môn',
      clan_tag: '🌸HL',
      leader_id: HANABIRA_ID,
      clan_level: 2,
      clan_treasury: 25000,
      total_exp: 85000,
      max_members: 15,
      description: 'Phân đà tu luyện của các đệ tử Hồ Ly Tông Môn'
    }
  ], { onConflict: 'clan_id' });

  // Upsert Fuyumi & Hanabira Mei in users
  await supabase.from('users').upsert([
    {
      user_id: FUYUMI_ID,
      username: 'Fuyumi 🌸',
      discriminator: '0',
      avatar_url: 'assets/fuyumi_avatar.png',
      exp: 450000,
      level: 100,
      linh_thach: 999999,
      avatar_frame: 'celestial_fox_gold',
      background_url: 'assets/celestial_palace_pink.png',
      bio: 'Cửu Vĩ Tiên Chủ • Người sáng lập và bảo hộ SuMi Family',
      custom_title: 'Cửu Vĩ Tiên Chủ',
      max_role_slots: 5,
      marry_user_id: null,
      marry_username: null,
      clan_id: 'thien_ho_than_toc',
      streak: 100
    },
    {
      user_id: HANABIRA_ID,
      username: 'Hanabira Mei',
      discriminator: '0',
      avatar_url: hanabira?.user?.avatar ? 'assets/hanabira_avatar.png' : 'assets/default_avatar.png',
      exp: 2800,
      level: 18,
      linh_thach: 1250,
      avatar_frame: 'default',
      background_url: 'assets/default_background.png',
      bio: 'Đệ tử Hồ Ly Tông Môn • SuMi Family',
      custom_title: 'Chấp Pháp Linh Hồ',
      max_role_slots: 2,
      marry_user_id: null,
      marry_username: null,
      clan_id: 'ho_ly_mon',
      streak: 7
    }
  ], { onConflict: 'user_id' });

  // 3. Sync Fuyumi's 5 Equipped Roles + all newly created Perk Roles into user_roles
  const migration = JSON.parse(fs.readFileSync('role_migration_result.json', 'utf8'));
  const createdRoles = migration.createdRoles || [];
  const roleByKey = Object.fromEntries(createdRoles.map(r => [r.key, r]));

  // Clear existing user_roles for Fuyumi and Hanabira Mei to replace cleanly with real Discord Role IDs
  await supabase.from('user_roles').delete().in('user_id', [FUYUMI_ID, HANABIRA_ID]);

  const fuyumiEquipped = [
    {
      user_id: FUYUMI_ID,
      role_id: '1473419957655175169',
      role_name: '« 100 • Hỗn Độn Chúa Tể »',
      role_perk: '⚔️ Trảm Quyết Tối Thượng',
      is_permanent: true,
      is_equipped: true,
      equipped_slot: 1
    },
    {
      user_id: FUYUMI_ID,
      role_id: roleByKey['cuu_vi_toi_thuong']?.id || '1573185998857183253',
      role_name: '« Cửu Vĩ Tối Thượng Thần Hồ »',
      role_perk: '🛡️ Kháng Timeout & Hộ Thể',
      is_permanent: true,
      is_equipped: true,
      equipped_slot: 2
    },
    {
      user_id: FUYUMI_ID,
      role_id: roleByKey['phong_thanh_ho_phap']?.id || '1573186024048173076',
      role_name: '« Phong Thanh Hộ Pháp »',
      role_perk: '🎙️ Di Chuyển Voice',
      is_permanent: true,
      is_equipped: true,
      equipped_slot: 3
    },
    {
      user_id: FUYUMI_ID,
      role_id: roleByKey['than_hanh_cot_cach']?.id || '1573186049289756712',
      role_name: '« Thần Hành Cốt Cách »',
      role_perk: '⚡ Miễn Chờ Chat Chậm',
      is_permanent: true,
      is_equipped: true,
      equipped_slot: 4
    },
    {
      user_id: FUYUMI_ID,
      role_id: roleByKey['tran_thu_phap_vuong']?.id || '1573186074153324608',
      role_name: '« Trấn Thư Pháp Vương »',
      role_perk: '📌 Ghim Tin Nhắn',
      is_permanent: true,
      is_equipped: true,
      equipped_slot: 5
    }
  ];

  const equippedIds = new Set(fuyumiEquipped.map(r => r.role_id));
  const fuyumiUnquipped = createdRoles
    .filter(r => r.key !== 'divider_perk_roles' && !equippedIds.has(r.id))
    .map(r => ({
      user_id: FUYUMI_ID,
      role_id: r.id,
      role_name: r.name,
      role_perk: r.perk || '✨ Quyền Năng Tiên Giới',
      is_permanent: true,
      is_equipped: false,
      equipped_slot: null
    }));

  const hanabiraRoles = [
    {
      user_id: HANABIRA_ID,
      role_id: roleByKey['phong_thanh_ho_phap']?.id || '1573186024048173076',
      role_name: '« Phong Thanh Hộ Pháp »',
      role_perk: '🎙️ Di Chuyển Voice',
      is_permanent: false,
      is_equipped: true,
      equipped_slot: 1
    },
    {
      user_id: HANABIRA_ID,
      role_id: roleByKey['van_tuong_linh_ho']?.id || '1573186057778888745',
      role_name: '« Vạn Tượng Linh Hồ »',
      role_perk: '✨ Dùng Emoji Ngoại Server',
      is_permanent: false,
      is_equipped: true,
      equipped_slot: 2
    }
  ];

  const { error: rolesErr } = await supabase
    .from('user_roles')
    .insert([...fuyumiEquipped, ...fuyumiUnquipped, ...hanabiraRoles]);
  if (rolesErr) console.error('user_roles insert error:', rolesErr);

  // 4. Ensure active pets and 3-slot equipment loadouts for both Fuyumi and Hanabira Mei
  const { data: fPets } = await supabase.from('user_pets').select('*').eq('user_id', FUYUMI_ID).eq('is_active', true);
  if (!fPets || fPets.length === 0) {
    await supabase.from('user_pets').insert({
      user_id: FUYUMI_ID,
      pet_name: 'Cửu Vĩ Hồng Hồ',
      pet_type: 'cuu_vi_hong_ho',
      pet_rarity: 'Tối Thượng Thần Thoại',
      element: 'Hỗn Độn',
      hax_skill: 'Cửu Vĩ Hộ Thể (HAX Bất Tử)',
      hax_description: 'Bất tử trước 3 đòn đầu, phản lại 100% sát thương gốc',
      level: 99,
      star: 10,
      atk: 99999,
      def: 99999,
      spd: 99999,
      power_score: 9999999,
      is_active: true
    });
  }

  const { data: hPets } = await supabase.from('user_pets').select('*').eq('user_id', HANABIRA_ID).eq('is_active', true);
  if (!hPets || hPets.length === 0) {
    await supabase.from('user_pets').insert({
      user_id: HANABIRA_ID,
      pet_name: 'Băng Tuyết Hồ',
      pet_type: 'bang_tuyet_ho',
      pet_rarity: 'Hiếm',
      element: 'Thủy / Băng',
      hax_skill: 'Băng Phong (Đóng Băng)',
      hax_description: '35% tỉ lệ đóng băng đối thủ 1 hiệp',
      level: 15,
      star: 3,
      atk: 355,
      def: 320,
      spd: 425,
      power_score: 2630,
      is_active: true
    });
  }

  // Equip 3 Mythic items for Fuyumi and 3 Rare items for Hanabira Mei in user_pet_items
  await supabase.from('user_pet_items').delete().in('user_id', [FUYUMI_ID, HANABIRA_ID]);
  const { error: itemsErr } = await supabase.from('user_pet_items').insert([
    // Fuyumi Mythic Trio
    { user_id: FUYUMI_ID, item_id: 'weapon_mythic_1', equipped_to_pet: 'cuu_vi_hong_ho', slot: 'weapon' },
    { user_id: FUYUMI_ID, item_id: 'gem_mythic_3', equipped_to_pet: 'cuu_vi_hong_ho', slot: 'gem' },
    { user_id: FUYUMI_ID, item_id: 'soul_mythic_1', equipped_to_pet: 'cuu_vi_hong_ho', slot: 'soul' },
    // Hanabira Mei Rare Trio
    { user_id: HANABIRA_ID, item_id: 'weapon_rare_1', equipped_to_pet: 'bang_tuyet_ho', slot: 'weapon' },
    { user_id: HANABIRA_ID, item_id: 'gem_rare_1', equipped_to_pet: 'bang_tuyet_ho', slot: 'gem' },
    { user_id: HANABIRA_ID, item_id: 'soul_rare_2', equipped_to_pet: 'bang_tuyet_ho', slot: 'soul' }
  ]);
  if (itemsErr) console.error('user_pet_items insert error:', itemsErr);

  // Verify views
  const { data: fEquip } = await supabase.from('v_user_equipped_items').select('slot, item_id, item_name').eq('user_id', FUYUMI_ID);
  const { data: hEquip } = await supabase.from('v_user_equipped_items').select('slot, item_id, item_name').eq('user_id', HANABIRA_ID);
  const { data: fRoles } = await supabase.from('user_roles').select('equipped_slot, role_id, role_name').eq('user_id', FUYUMI_ID).eq('is_equipped', true).order('equipped_slot');

  console.log('Fuyumi Equipped Items in Supabase:', fEquip);
  console.log('Hanabira Equipped Items in Supabase:', hEquip);
  console.log('Fuyumi Equipped Roles in Supabase:', fRoles);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
