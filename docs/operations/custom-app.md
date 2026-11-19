# T3 Code Custom

This fork ships as a locally built desktop app, **T3 Code Custom**. There is no download: each
person builds it on their own Mac from this checkout.

## Install or update

Requirements: macOS, the Xcode command line tools, Node, `vp`, and Rust (`cargo`).

```sh
git clone https://github.com/lsj8706/t3code.git
cd t3code
vp i
scripts/custom-app/update-app.sh <name>
```

`<name>` labels the build, such as `nov-20`. The version becomes `<base>-custom.<name>` and shows
under **Settings → Sharing & access**.

The first run installs `/Applications/T3 Code Custom.app`. Later runs stage the new build while the
app keeps running; quit T3 Code Custom and open it again to switch. A newer build replaces one that
is still waiting.

To update, pull and run the script again:

```sh
git pull
vp i
scripts/custom-app/update-app.sh <name>
```

## Why the build is signed

macOS ties permissions and keychain access to an app's signature. An ad-hoc signature changes with
every build, so each build would ask for them again. The script signs every build with one
certificate instead, so macOS treats them as the same app.

The first run creates that certificate. It is self-signed, belongs to that Mac only, and lives in
its own keychain under `~/.t3code-custom`, not in the login keychain. Do not copy that folder to
another Mac; each Mac makes its own. Deleting it makes the next build a new app to macOS, which
asks for permissions and keychain access once more.

## What to know before using it

- **It shares data with T3 Code.** T3 Code Custom reads and writes the same T3 home (`~/.t3`) as
  the official app. Run one of them at a time. A newer build can migrate that data, after which an
  older build may not open it.
- **T3 Connect is unavailable.** Its configuration is not part of a local build. Pair over a local
  network instead.
- **The app is not notarized.** A build made on your own Mac opens normally. One copied from
  another Mac is blocked by Gatekeeper, so build it yourself.
- **The app does not update itself.** Run the script to move to a newer commit.
