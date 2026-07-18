import re

with open('/home/ubuntu/otb-chess/client/src/pages/ClubDashboard.tsx', 'r') as f:
    content = f.read()

# Find the start marker
start_marker = '          {/* ── 1. Current Club Status — single prominent card ── */}'
start_idx = content.find(start_marker)
if start_idx == -1:
    print("Start marker not found")
    exit(1)

# Find the end marker (the next section comment)
end_marker = '{/* ── 2. Tasks Needing Attention'
end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("End marker not found")
    exit(1)

# The replacement: just keep the Tasks Needing Attention comment but renumber it to 1
old_block = content[start_idx:end_idx]
print(f"Removing block of {len(old_block)} chars ({old_block.count(chr(10))} lines)")

# Replace the entire block with just the renumbered comment
content = content[:start_idx] + content[end_idx:]
# Renumber "2. Tasks Needing Attention" to "1. Tasks Needing Attention"
content = content.replace(
    '{/* ── 2. Tasks Needing Attention',
    '{/* ── 1. Tasks Needing Attention',
    1
)

with open('/home/ubuntu/otb-chess/client/src/pages/ClubDashboard.tsx', 'w') as f:
    f.write(content)

print("Done — redundant club status card removed")
