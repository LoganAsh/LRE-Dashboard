# Visual and phone tests

These drive a real headless Chromium against the running app, with a stand-in database (`mockdata.mjs`).

One-time setup (kept out of the app's own dependencies):
    mkdir -p /home/claude/shots && cd /home/claude/shots && npm init -y && npm i puppeteer-core @sparticuz/chromium

Then, from the repo root:
    sh tests/visual/serve.sh                                  # dev server on :5199
    node tests/visual/phone.test.mjs                          # 47 behavior checks on the phone app
    node tests/visual/shootAll.mjs --viewport desktop --out DIR [--url http://127.0.0.1:5198/]
    node tests/visual/desktopDialogs.mjs --out DIR            # the 7 pop-ups, on desktop
    python3 tests/visual/diff.py DIR_A DIR_B                  # pixel-compare two folders of screenshots
    node tests/visual/phoneShots.mjs OUT.png "Bid Log" [--dark] [--viewport] [--live]
    node tests/visual/tap.mjs OUT.png "Projects" "tap label" "scroll:.selector:bottom" [--dark] [--live]
    python3 tests/visual/sheet.py OUT.png "label=a.png" "label=b.png"   # side-by-side contact sheet

To prove desktop is unchanged: run a second dev server from a clean checkout of main on :5198, take
screenshots from both ports with the same command, and diff them.
