with open('/home/ubuntu/otb-chess/client/src/components/AuthModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

google_button = '''
                {/* ── Google OAuth divider + button ── */}
                <div className="flex items-center gap-3 my-1">
                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/60"}`} />
                  <span className={`text-xs ${muted}`}>or</span>
                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/60"}`} />
                </div>
                <a
                  href="/api/auth/google"
                  className={`w-full flex items-center justify-center gap-3 rounded-xl border font-medium py-3.5 text-base transition ${
                    isDark
                      ? "bg-white/5 border-white/15 text-white hover:bg-white/10"
                      : "bg-white border-[#ADBC9F] text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </a>'''

# Sign-in form: insert before </form> closing tag (after "No account?" paragraph)
# Find the exact closing sequence of the sign-in form
old_signin_close = '                </p>\n              </form>\n            )}\n\n            {/* \u2500\u2500 Sign Up form \u2500\u2500 */}'
new_signin_close = '                </p>' + google_button + '\n              </form>\n            )}\n\n            {/* \u2500\u2500 Sign Up form \u2500\u2500 */}'

if old_signin_close not in content:
    # Try with the unicode box drawing characters as they appear in the file
    import re
    # Find the pattern more flexibly
    pattern = r'(                </p>\n              </form>\n            \}\}\n\n            \{/\* )'
    matches = list(re.finditer(pattern, content))
    print(f"Pattern matches: {len(matches)}")
    if matches:
        for m in matches:
            print(f"  at pos {m.start()}: {repr(content[m.start():m.start()+100])}")
    else:
        # Try to find the sign-in form closing
        idx = content.find('Create one free\n                  </button>\n                </p>\n              </form>')
        print(f"Alternative search idx: {idx}")
        if idx >= 0:
            print(repr(content[idx:idx+200]))
    exit(1)

content = content.replace(old_signin_close, new_signin_close, 1)
print("Sign-in form updated")

# Sign-up form: insert before </form> closing tag (after "Already have an account?" paragraph)
old_signup_close = '                </p>\n              </form>\n            )}\n\n            {/* \u2500\u2500 Guest form \u2500\u2500 */}'
new_signup_close = '                </p>' + google_button + '\n              </form>\n            )}\n\n            {/* \u2500\u2500 Guest form \u2500\u2500 */}'

if old_signup_close not in content:
    print("ERROR: sign-up target not found")
    exit(1)

content = content.replace(old_signup_close, new_signup_close, 1)
print("Sign-up form updated")

with open('/home/ubuntu/otb-chess/client/src/components/AuthModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS")
