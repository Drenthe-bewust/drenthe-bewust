# Instructies voor Claude

## 🚨 CRITICAL: Homepage Protection

**The homepage is sacred. It must ALWAYS be protected.**

### Rules for homepage safety:
1. **ALWAYS test changes** — After ANY change to Jekyll config, build, or profile handling:
   - Navigate to https://www.drenthe-bewust.nl/ immediately
   - Verify the correct homepage loads
   - DO NOT claim "fixed" without verification

2. **NEVER use `exclude` for critical files** — `exclude` removes files from build. If you want to protect index.html, use validation instead.

3. **NEVER set empty permalinks** — If webhook/form sets `permalink: ""` or `permalink: /`, this WILL break homepage. Always remove it.

4. **Validate before claiming "permanent"** — 
   - "Should work" ≠ "is fixed"
   - "Tested locally" ≠ "tested on live site"
   - Always verify on live site: https://www.drenthe-bewust.nl/

5. **One change at a time** — Don't combine config changes + file fixes + validation in one commit. Test after each change.

## Permalink Rules
- Bewust-makers MUST have: `permalink: /bewust-makers/[filename]/`
- Never leave permalink empty
- Never set permalink to `/` or `/index`
- If in doubt, let Jekyll auto-generate (remove the field)

## When Something "Breaks" the Homepage
1. Check: What was the last commit?
2. Check: What file is on root (/) now?
3. Fix the root cause (not a workaround)
4. Test immediately on live site
5. Only then commit

---

**Attribution:** Claude Haiku 4.5
