"""
Fix 3: exact text matches for Feed tab gate and Home About expansion
"""

with open('/home/ubuntu/otb-chess/client/src/pages/ClubProfile.tsx', 'r') as f:
    content = f.read()

# ── 1. Add non-member gate to Feed tab ───────────────────────────────────────
old_feed = '\n        {activeTab === "feed" && (\n          <div className="space-y-4 animate-in fade-in duration-200">\n    '
new_feed = '''
        {activeTab === "feed" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Non-member gate */}
            {!joined ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-4`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/30"}`}>
                  <MessageSquare className={`w-7 h-7 ${isDark ? "text-white/40" : "text-[#436850]/60"}`} />
                </div>
                <div>
                  <h3 className={`text-base font-bold mb-1 ${textMain}`}>Members-only Feed</h3>
                  <p className={`text-sm ${textMuted} max-w-xs`}>Posts, polls, and announcements are only visible to club members. Join to participate in the conversation.</p>
                </div>
                <button
                  onClick={() => { if (!user) { setAuthOpen(true); } else { handleJoin(); } }}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}
                >
                  Join Club
                </button>
              </div>
            ) : (
              <>
    '''

if old_feed in content:
    content = content.replace(old_feed, new_feed, 1)
    print("Added Feed tab non-member gate (open)")

    # Close the <> fragment before the feed tab's closing )}
    # Find the events tab marker
    events_marker = '\n        {activeTab === "events" && (() => {'
    events_idx = content.find(events_marker)
    if events_idx != -1:
        search_region = content[:events_idx]
        # Find the last `          </div>\n        )}\n` before events tab
        close_pattern = '          </div>\n        )}\n'
        last_close_idx = search_region.rfind(close_pattern)
        if last_close_idx != -1:
            content = content[:last_close_idx] + '              </>\n            )}\n' + content[last_close_idx:]
            print("Closed Feed tab fragment")
        else:
            print("WARNING: Could not find feed tab close pattern")
    else:
        print("WARNING: Events marker not found")
else:
    print("WARNING: Feed tab open not found")

# ── 2. Expand Home About snippet ─────────────────────────────────────────────
# Get the exact block including the empty line in the h3
old_home_about = '    {/* About snippet */}\n            {club.description && (\n              <div className={`rounded-3xl border ${cardBorder} ${card} p-5`}>\n                <div className="flex items-center justify-between mb-2">\n                  <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>About</h3>\n\n                </div>\n                <p className={`text-sm leading-relaxed line-clamp-3 ${isDark ? "text-white/75" : "text-[#12372A]/85"}`}>{club.description}</p>\n              </div>\n            )}'

new_home_about = '''    {/* About — full card (description + details) */}
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
    print("Expanded Home About snippet")
else:
    # Try to find and show what's there
    idx = content.find('About snippet')
    if idx != -1:
        print(f"About snippet found but exact text didn't match. Showing context:")
        print(repr(content[idx-4:idx+500]))
    else:
        print("WARNING: Home About snippet not found at all")

with open('/home/ubuntu/otb-chess/client/src/pages/ClubProfile.tsx', 'w') as f:
    f.write(content)

print("\nDone")
