import fs from 'fs';

const elements = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/ai_mention_tree.json', 'utf8'));

// 1. Remove old edge: e_others_to_ai_wait
const filteredElements = elements.filter(e => e.id !== 'e_others_to_ai_wait');

const insultPattern = "\\b(tuất|tuat)\\b|vô dụng|vo dung|làm (j|gì|gi) đ(c|ược)|lam (j|gi) d(c|uoc)|chủ (zà|già)|chu (za|gia)|bot (rác|rac|ngu|cùi|cui|lỏ|lo|chó|cho|óc|oc)|con bot|óc (chó|cho|bò|bo)|\\b(sủa|sua)\\b|\\b(mõm|mom)\\b|ngậm mồm|câm m|thách (m|mày|may)|thach (m|may)|đồ vô tích sự|m làm j";

// New Nodes
const newNodes = [
  // 1. Condition: Check Toxic Insult
  {
    id: "cond_other_check_toxic",
    type: "condition",
    position: { x: 6200, y: 1374 },
    width: 330,
    height: 110,
    data: {
      node_options: {
        title: "Comparison Condition",
        description: "Check if user insults bot or Fuyumi",
        isActionBlock: false
      },
      data: {
        type: "condition",
        condition_type: "comparison",
        base_value: "{event_message_content}",
        multiple: false,
        target: { self: true },
        validated: true,
        linked: true
      }
    }
  },
  // 2. Child: Toxic Match
  {
    id: "conChild_other_toxic_true",
    type: "conditionChild",
    position: { x: 5800, y: 1594 },
    width: 600,
    height: 112,
    data: {
      node_options: { type: "comparison" },
      data: {
        type: "matches_pattern",
        comparison_value: insultPattern,
        ignoreCase: true,
        validated: true
      }
    }
  },
  // 3. Child: Else (Clean message -> go to AI)
  {
    id: "$else_other_toxic",
    type: "else",
    position: { x: 6500, y: 1594 },
    width: 250,
    height: 90,
    data: {
      node_options: {
        title: "Else",
        description: "Run if message is clean",
        isActionBlock: false
      },
      data: {
        type: "else",
        validated: true,
        linked: true
      }
    }
  },
  // 4. Guard Owner
  {
    id: "cond_toxic_guard_owner",
    type: "condition",
    position: { x: 5800, y: 1780 },
    width: 300,
    height: 109,
    data: {
      node_options: {
        title: "Comparison Condition",
        description: "Exempt Server Owner",
        isActionBlock: false
      },
      data: {
        type: "condition",
        condition_type: "comparison",
        base_value: "{event_user_id}",
        multiple: false,
        target: { self: true },
        validated: true,
        linked: true
      }
    }
  },
  {
    id: "conChild_toxic_guard_owner",
    type: "conditionChild",
    position: { x: 5500, y: 1960 },
    width: 300,
    height: 90,
    data: {
      node_options: { type: "comparison" },
      data: {
        type: "equal_to",
        comparison_value: "511187329889861651",
        validated: true
      }
    }
  },
  {
    id: "$else_toxic_guard_owner",
    type: "else",
    position: { x: 5900, y: 1960 },
    width: 220,
    height: 90,
    data: {
      node_options: { title: "Else", isActionBlock: false },
      data: { type: "else", validated: true, linked: true }
    }
  },
  // 5. Guard Perms (ADMINISTRATOR only)
  {
    id: "cond_toxic_guard_perms",
    type: "condition",
    position: { x: 5900, y: 2130 },
    width: 350,
    height: 109,
    data: {
      node_options: {
        title: "Permissions Condition",
        description: "Exempt Administrators",
        isActionBlock: false
      },
      data: {
        type: "condition",
        condition_type: "permissions",
        multiple: false,
        target: { self: true },
        validated: true,
        linked: true
      }
    }
  },
  {
    id: "conChild_toxic_guard_perms",
    type: "conditionChild",
    position: { x: 5600, y: 2310 },
    width: 300,
    height: 90,
    data: {
      node_options: { type: "permissions" },
      data: {
        type: "permissions",
        permissions: ["ADMINISTRATOR"],
        all: false,
        not: false,
        validated: true
      }
    }
  },
  {
    id: "$else_toxic_guard_perms",
    type: "else",
    position: { x: 6000, y: 2310 },
    width: 220,
    height: 90,
    data: {
      node_options: { title: "Else", isActionBlock: false },
      data: { type: "else", validated: true, linked: true }
    }
  },
  // 6. Guard Roles (>= Huyền Thiên Hồ Sứ)
  {
    id: "cond_toxic_guard_roles",
    type: "condition",
    position: { x: 6000, y: 2480 },
    width: 350,
    height: 109,
    data: {
      node_options: {
        title: "Role Condition",
        description: "Exempt >= Huyền Thiên Hồ Sứ",
        isActionBlock: false
      },
      data: {
        type: "condition",
        condition_type: "role",
        multiple: false,
        target: { self: true },
        validated: true,
        linked: true
      }
    }
  },
  {
    id: "conChild_toxic_guard_roles",
    type: "conditionChild",
    position: { x: 5700, y: 2660 },
    width: 400,
    height: 91,
    data: {
      node_options: { type: "role" },
      data: {
        id: "1487172968105640069,1468649836856344689,1519354498412314785,1521913861660344320,1027173664069795921",
        name: ">= Huyền Thiên",
        option: "channel",
        any_of: true,
        all_of: false,
        not: false,
        validated: true
      }
    }
  },
  {
    id: "$else_toxic_guard_roles",
    type: "else",
    position: { x: 6200, y: 2660 },
    width: 220,
    height: 90,
    data: {
      node_options: { title: "Else", isActionBlock: false },
      data: { type: "else", validated: true, linked: true }
    }
  },
  // 7. Timeout Action (10min Mute)
  {
    id: "act_toxic_timeout",
    type: "action",
    position: { x: 6200, y: 2830 },
    width: 328,
    height: 110,
    data: {
      node_options: {
        title: "Timeout a Member",
        description: "Timeout member 10 minutes for insolence",
        isActionBlock: false
      },
      data: {
        type: "timeout_action",
        target: "{event_user_id}",
        reason: "Xúc phạm & thách thức Trợ lý Nhiễm Nhiễm",
        duration: "10min",
        success_handles: true,
        validated: true,
        linked: true
      }
    }
  },
  // 8. Random Reply on Success
  {
    id: "act_toxic_reply_success",
    type: "action",
    position: { x: 5950, y: 3020 },
    width: 340,
    height: 92,
    data: {
      node_options: {
        title: "Random Reply",
        description: "Send sassy mute notice",
        isActionBlock: false
      },
      data: {
        type: "random_reply",
        messages: [
          "Dám bảo ta vô dụng à? Cho ngươi ngậm mõm 10 phút nếm mùi vuốt hồ ly nhé! Đừng tưởng bản hồ ly hiền mà nhờn! 💅❄️",
          "Láo toét quen thói! Dám mở mỏ hỗn thách thức ta và xúc phạm Tiểu thư Fuyumi à? Câm họng 10 phút để tự kiểm điểm lại cái nết đi! 🦊⚡",
          "Thách thức ta hả? Để xem ai vô dụng hơn nhé! Tặng hẳn 10 phút mute cho bớt cái mỏ hỗn! Lần sau còn tái phạm là ta vả cho bay màu khỏi SuMi Family luôn đấy! 💅✨",
          "Mở miệng ra là sủa bậy! Đã cảnh cáo bao nhiêu lần rồi mà vẫn lì lợm! Ngậm mõm 10 phút trong phòng tối đi nhé đồ vô tích sự! ❄️🐾"
        ],
        validated: true,
        linked: true
      }
    }
  },
  // 9. Reply on Timeout Error (e.g. hierarchy limitation)
  {
    id: "act_toxic_reply_fail",
    type: "action",
    position: { x: 6350, y: 3020 },
    width: 340,
    height: 92,
    data: {
      node_options: {
        title: "Random Reply",
        description: "Notice if timeout fails",
        isActionBlock: false
      },
      data: {
        type: "random_reply",
        messages: [
          "Cái đồ mỏ hỗn kia! Ngươi may mắn là quyền hạn ngươi cao hơn ta hoặc Discord lỗi đấy, không là ta cho ngậm mõm từ lâu rồi! Khôn hồn thì trật tự đi! 🦊💢"
        ],
        validated: true,
        linked: true
      }
    }
  },
  // 10. Reply if user is exempt (Staff/Owner)
  {
    id: "act_toxic_reply_exempt",
    type: "action",
    position: { x: 5300, y: 2800 },
    width: 340,
    height: 92,
    data: {
      node_options: {
        title: "Random Reply",
        description: "Warning to staff/owner",
        isActionBlock: false
      },
      data: {
        type: "random_reply",
        messages: [
          "Xí! Nể mặt cấp trên nên bản hồ ly tha cho lần này đấy nhé! Lần sau cẩn thận cái mỏ hỗn nha! 💅"
        ],
        validated: true,
        linked: true
      }
    }
  }
];

// New Edges
const newEdges = [
  // $else_other_c2a -> cond_other_check_toxic
  {
    id: "e_c2a_else_to_toxic_cond",
    source: "$else_other_c2a",
    sourceHandle: "action",
    target: "cond_other_check_toxic",
    targetHandle: "action",
    type: "custom"
  },
  // cond_other_check_toxic -> conChild_other_toxic_true
  {
    id: "e_toxic_cond_to_child_true",
    source: "cond_other_check_toxic",
    sourceHandle: "action",
    target: "conChild_other_toxic_true",
    targetHandle: "action",
    type: "custom"
  },
  // cond_other_check_toxic -> $else_other_toxic
  {
    id: "e_toxic_cond_to_else",
    source: "cond_other_check_toxic",
    sourceHandle: "action",
    target: "$else_other_toxic",
    targetHandle: "action",
    type: "custom"
  },
  // $else_other_toxic -> act_other_wait_ai (Connects to normal AI Gemini pipeline!)
  {
    id: "e_toxic_else_to_ai_wait",
    source: "$else_other_toxic",
    sourceHandle: "action",
    target: "act_other_wait_ai",
    targetHandle: "action",
    type: "custom"
  },
  // conChild_other_toxic_true -> cond_toxic_guard_owner
  {
    id: "e_toxic_true_to_guard_owner",
    source: "conChild_other_toxic_true",
    sourceHandle: "action",
    target: "cond_toxic_guard_owner",
    targetHandle: "action",
    type: "custom"
  },
  // cond_toxic_guard_owner -> conChild_toxic_guard_owner
  {
    id: "e_guard_owner_to_child",
    source: "cond_toxic_guard_owner",
    sourceHandle: "action",
    target: "conChild_toxic_guard_owner",
    targetHandle: "action",
    type: "custom"
  },
  // cond_toxic_guard_owner -> $else_toxic_guard_owner
  {
    id: "e_guard_owner_to_else",
    source: "cond_toxic_guard_owner",
    sourceHandle: "action",
    target: "$else_toxic_guard_owner",
    targetHandle: "action",
    type: "custom"
  },
  // conChild_toxic_guard_owner -> act_toxic_reply_exempt
  {
    id: "e_owner_to_exempt_reply",
    source: "conChild_toxic_guard_owner",
    sourceHandle: "action",
    target: "act_toxic_reply_exempt",
    targetHandle: "action",
    type: "custom"
  },
  // $else_toxic_guard_owner -> cond_toxic_guard_perms
  {
    id: "e_guard_owner_else_to_perms",
    source: "$else_toxic_guard_owner",
    sourceHandle: "action",
    target: "cond_toxic_guard_perms",
    targetHandle: "action",
    type: "custom"
  },
  // cond_toxic_guard_perms -> conChild_toxic_guard_perms
  {
    id: "e_guard_perms_to_child",
    source: "cond_toxic_guard_perms",
    sourceHandle: "action",
    target: "conChild_toxic_guard_perms",
    targetHandle: "action",
    type: "custom"
  },
  // cond_toxic_guard_perms -> $else_toxic_guard_perms
  {
    id: "e_guard_perms_to_else",
    source: "cond_toxic_guard_perms",
    sourceHandle: "action",
    target: "$else_toxic_guard_perms",
    targetHandle: "action",
    type: "custom"
  },
  // conChild_toxic_guard_perms -> act_toxic_reply_exempt
  {
    id: "e_perms_to_exempt_reply",
    source: "conChild_toxic_guard_perms",
    sourceHandle: "action",
    target: "act_toxic_reply_exempt",
    targetHandle: "action",
    type: "custom"
  },
  // $else_toxic_guard_perms -> cond_toxic_guard_roles
  {
    id: "e_guard_perms_else_to_roles",
    source: "$else_toxic_guard_perms",
    sourceHandle: "action",
    target: "cond_toxic_guard_roles",
    targetHandle: "action",
    type: "custom"
  },
  // cond_toxic_guard_roles -> conChild_toxic_guard_roles
  {
    id: "e_guard_roles_to_child",
    source: "cond_toxic_guard_roles",
    sourceHandle: "action",
    target: "conChild_toxic_guard_roles",
    targetHandle: "action",
    type: "custom"
  },
  // cond_toxic_guard_roles -> $else_toxic_guard_roles
  {
    id: "e_guard_roles_to_else",
    source: "cond_toxic_guard_roles",
    sourceHandle: "action",
    target: "$else_toxic_guard_roles",
    targetHandle: "action",
    type: "custom"
  },
  // conChild_toxic_guard_roles -> act_toxic_reply_exempt
  {
    id: "e_roles_to_exempt_reply",
    source: "conChild_toxic_guard_roles",
    sourceHandle: "action",
    target: "act_toxic_reply_exempt",
    targetHandle: "action",
    type: "custom"
  },
  // $else_toxic_guard_roles -> act_toxic_timeout (MUTE TARGET!)
  {
    id: "e_roles_else_to_timeout",
    source: "$else_toxic_guard_roles",
    sourceHandle: "action",
    target: "act_toxic_timeout",
    targetHandle: "action",
    type: "custom"
  },
  // act_toxic_timeout -> act_toxic_reply_success
  {
    id: "e_timeout_success_to_reply",
    source: "act_toxic_timeout",
    sourceHandle: "success_actions",
    target: "act_toxic_reply_success",
    targetHandle: "action",
    type: "custom"
  },
  // act_toxic_timeout -> act_toxic_reply_fail
  {
    id: "e_timeout_fail_to_reply",
    source: "act_toxic_timeout",
    sourceHandle: "error_actions",
    target: "act_toxic_reply_fail",
    targetHandle: "action",
    type: "custom"
  }
];

const finalElements = [...filteredElements, ...newNodes, ...newEdges];

console.log('Original count:', elements.length);
console.log('New elements added:', newNodes.length + newEdges.length);
console.log('Final count:', finalElements.length);

fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/ai_mention_tree_updated.json', JSON.stringify(finalElements, null, 2));
console.log('Saved ai_mention_tree_updated.json');
