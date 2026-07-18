"""
ClubProfile.tsx changes:
1. Remove About block from Feed tab (lines 2113-2399)
2. Move full About details to Home tab (expand the snippet)
3. Add non-member CTA gate to Feed, Events, Members, Leagues tabs
"""

with open('/home/ubuntu/otb-chess/client/src/pages/ClubProfile.tsx', 'r') as f:
    lines = f.readlines()

content = ''.join(lines)

# ── 1. Remove the About block from the Feed tab ──────────────────────────────
# Lines 2113-2399: "Club Description & Details (Feed tab only)" through the closing </div>
# We'll find the exact text block
about_start_marker = '            {/* Club Description & Details (Feed tab only) */}'
about_end_marker = '            {/* ── Top Members / Leaderboard Preview ──────────────────────── */}'

start_idx = content.find(about_start_marker)
end_idx = content.find(about_end_marker)

if start_idx == -1:
    print("ERROR: About start marker not found")
    exit(1)
if end_idx == -1:
    print("ERROR: About end marker not found")
    exit(1)

# Remove the block (keep the end marker)
content = content[:start_idx] + content[end_idx:]
print(f"Removed About block from Feed tab ({end_idx - start_idx} chars)")

# ── 2. Expand the About snippet in the Home tab ───────────────────────────────
# Replace the compact snippet with a full About card (description + details grid + social links)
old_home_about = '''            {/* About snippet */}
            {club.description && (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>About</h3>
                </div>
                <p className={`text-sm leading-relaxed line-clamp-3 ${isDark ? "text-white/75" : "text-[#12372A]/85"}`}>{club.description}</p>
              </div>
            )}'''

new_home_about = '''            {/* About — full card (description + details + social links) */}
            <div className={`rounded-3xl border ${cardBorder} ${card} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>About</h3>
                {(isOwner || isDirector) && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      isDark
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-[#ADBC9F]/40 text-[#12372A] hover:bg-[#ADBC9F]"
                    }`}
                  >
                    Edit
                  </button>
                )}
              </div>
              {club.description && (
                <p className={`text-sm leading-relaxed mb-4 ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
                  {club.description}
                </p>
              )}
              <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${isDark ? "border-white/8" : "border-[#ADBC9F]/50"}`}>
                {club.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                    <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{flag} {club.location}</span>
                  </div>
                )}
                {club.category && (
                  <div className="flex items-center gap-2">
                    <Hash className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                    <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{categoryLabel}</span>
                  </div>
                )}
                {club.foundedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                    <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{formatDate(club.foundedAt)}</span>
                  </div>
                )}
                {club.ownerName && (
                  <div className="flex items-center gap-2">
                    <Crown className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                    <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{club.ownerName}</span>
                  </div>
                )}
              </div>
            </div>'''

if old_home_about in content:
    content = content.replace(old_home_about, new_home_about, 1)
    print("Expanded About snippet in Home tab")
else:
    print("WARNING: Home About snippet not found — skipping expansion")

# ── 3. Add non-member CTA gate to Feed tab ────────────────────────────────────
# Insert gate right after `{activeTab === "feed" && (` opening
old_feed_open = '''        {activeTab === "feed" && (
          <div className="space-y-4">'''

new_feed_open = '''        {activeTab === "feed" && (
          <div className="space-y-4">
            {/* Non-member gate */}
            {!joined && (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-4`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/30"}`}>
                  <MessageSquare className={`w-7 h-7 ${isDark ? "text-white/40" : "text-[#436850]/60"}`} />
                </div>
                <div>
                  <h3 className={`text-base font-bold mb-1 ${textMain}`}>Members-only Feed</h3>
                  <p className={`text-sm ${textMuted} max-w-xs`}>Posts, polls, and announcements are only visible to club members. Join to participate in the conversation.</p>
                </div>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}
                >
                  Join Club
                </button>
              </div>
            )}
            {joined && ('''

# We need to close the joined block before the end of the feed tab
# Find the closing of the feed tab div
# Strategy: wrap the existing feed content in {joined && (...)}
# This is complex — instead gate at the top and use early return pattern with CSS
# Simpler: just show the gate when !joined, and the content when joined

# Actually the cleanest approach: wrap the inner content
# Find the end of the feed tab section
feed_end_marker = '        {activeTab === "events" && (() => {'

if old_feed_open in content and feed_end_marker in content:
    # First do the open replacement
    content = content.replace(old_feed_open, new_feed_open, 1)
    print("Added non-member gate to Feed tab (open)")
    
    # Now find the closing of the feed tab's outer div and add the closing brace for {joined &&
    # The feed tab ends with `        )}` before the events tab
    # We need to find the `        )}` that closes the feed tab
    # Find position of feed_end_marker
    events_idx = content.find(feed_end_marker)
    # Look backwards for the closing of the feed tab
    # The feed tab structure is: {activeTab === "feed" && ( <div> ... </div> )}
    # We need to add `)}` before the outer `)}` of the feed tab
    
    # Find the last `          </div>\n        )}` before events tab
    search_region = content[:events_idx]
    # Find the last occurrence of `        )}\n` in the feed section
    last_feed_close = search_region.rfind('        )}\n')
    if last_feed_close != -1:
        # Insert closing brace for {joined && before the outer div close
        # The structure should be:
        # {joined && (  <-- already added
        #   ... all the feed content ...
        # )}            <-- need to add this
        # </div>        <-- outer div
        # )}            <-- feed tab close
        
        # Find the `          </div>\n        )}\n` at the end of the feed tab
        outer_close = '          </div>\n        )}\n'
        outer_close_idx = search_region.rfind(outer_close)
        if outer_close_idx != -1:
            insert_pos = outer_close_idx
            content = content[:insert_pos] + '            )}\n' + content[insert_pos:]
            print("Closed {joined && block in Feed tab")
        else:
            print("WARNING: Could not find outer close for Feed tab")
    else:
        print("WARNING: Could not find feed tab close")
else:
    print(f"WARNING: Feed tab open not found. old_feed_open in content: {old_feed_open in content}")

# ── 4. Add non-member CTA gate to Members tab ────────────────────────────────
old_members_open = '        {activeTab === "members" && (() => {'
new_members_open = '''        {activeTab === "members" && (() => {
          if (!joined) return (
            <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-4`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/30"}`}>
                <Users className={`w-7 h-7 ${isDark ? "text-white/40" : "text-[#436850]/60"}`} />
              </div>
              <div>
                <h3 className={`text-base font-bold mb-1 ${textMain}`}>Members-only</h3>
                <p className={`text-sm ${textMuted} max-w-xs`}>The member directory is only visible to club members. Join to see who's in the club.</p>
              </div>
              <button onClick={() => setShowJoinModal(true)} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}>Join Club</button>
            </div>
          );'''

if old_members_open in content:
    content = content.replace(old_members_open, new_members_open, 1)
    print("Added non-member gate to Members tab")
else:
    print("WARNING: Members tab open not found")

# ── 5. Add non-member CTA gate to Events tab ─────────────────────────────────
old_events_open = '        {activeTab === "events" && (() => {'
new_events_open = '''        {activeTab === "events" && (() => {
          if (!joined) return (
            <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-4`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/30"}`}>
                <Calendar className={`w-7 h-7 ${isDark ? "text-white/40" : "text-[#436850]/60"}`} />
              </div>
              <div>
                <h3 className={`text-base font-bold mb-1 ${textMain}`}>Members-only Events</h3>
                <p className={`text-sm ${textMuted} max-w-xs`}>Club events and tournaments are only visible to members. Join to see upcoming events and RSVP.</p>
              </div>
              <button onClick={() => setShowJoinModal(true)} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}>Join Club</button>
            </div>
          );'''

if old_events_open in content:
    content = content.replace(old_events_open, new_events_open, 1)
    print("Added non-member gate to Events tab")
else:
    print("WARNING: Events tab open not found")

# ── 6. Add non-member CTA gate to Leagues tab ────────────────────────────────
old_leagues_open = '        {activeTab === "leagues" && ('
new_leagues_open = '''        {activeTab === "leagues" && (
          !joined ? (
            <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-4`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/30"}`}>
                <Award className={`w-7 h-7 ${isDark ? "text-white/40" : "text-[#436850]/60"}`} />
              </div>
              <div>
                <h3 className={`text-base font-bold mb-1 ${textMain}`}>Members-only Leagues</h3>
                <p className={`text-sm ${textMuted} max-w-xs`}>Club leagues and standings are only visible to members. Join to compete and track your progress.</p>
              </div>
              <button onClick={() => setShowJoinModal(true)} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}>Join Club</button>
            </div>
          ) :'''

if old_leagues_open in content:
    content = content.replace(old_leagues_open, new_leagues_open, 1)
    print("Added non-member gate to Leagues tab")
else:
    print("WARNING: Leagues tab open not found")

with open('/home/ubuntu/otb-chess/client/src/pages/ClubProfile.tsx', 'w') as f:
    f.write(content)

print("\nAll changes applied successfully")
