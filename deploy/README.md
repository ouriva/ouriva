# Ouriva — Demo & Early-Tester Hosting

This directory holds everything needed to run, on one small server:

- A **public demo** (`demo.ouriva.app`) — no signup, pre-loaded with realistic
  sample data, reset to a clean state on a schedule so nobody's poking around
  in someone else's mess.
- Any number of **individual early-tester instances** (`<name>.ouriva.app`) —
  one real, private instance per person, provisioned by hand with one command.
  This intentionally does *not* try to be the real multi-tenant Cloud product —
  it's the fast, manual version that gets people using Ouriva today, before
  that's built.

Every instance (demo or tester) is an isolated app + Postgres pair with its
own Docker network and volume — one tester's data can never leak into
another's, and resetting the demo never touches a tester's instance.

## One-time host setup

Tested against Oracle Cloud's Always Free Ampere A1 tier (2 OCPU / 12GB RAM
as of mid-2026), but works on any small Linux VM with Docker.

1. Install Docker + the Compose plugin: https://docs.docker.com/engine/install/
2. Install Caddy for the reverse proxy: https://caddyserver.com/docs/install
3. Clone this repo onto the server.
4. Point DNS at the server: `*.ouriva.app` (or `demo.ouriva.app` plus one
   record per tester if you'd rather not use a wildcard).
5. Copy `deploy/Caddyfile.example` to `/etc/caddy/Caddyfile` and run
   `sudo systemctl enable --now caddy`.
6. Open ports 80 and 443 in the VM's firewall / cloud security list —
   this is a separate step from the OS firewall on Oracle specifically,
   see the Oracle setup notes below.

## Running the demo

```bash
cp deploy/.env.demo.example deploy/.env.demo
# edit deploy/.env.demo — set DEMO_DB_PASSWORD to: openssl rand -hex 16

./deploy/reset-demo.sh   # builds, starts, migrates, and seeds it
```

`reset-demo.sh` is meant to run on a schedule so the demo never accumulates
real edits from visitors:

```cron
0 4 * * * cd /path/to/ouriva-app && ./deploy/reset-demo.sh >> /var/log/ouriva-demo-reset.log 2>&1
```

## Adding a real early tester

```bash
./deploy/provision-instance.sh alice          # empty instance, ready for real use
./deploy/provision-instance.sh alice --seed   # pre-loaded with sample data (e.g. for a demo call)
```

This creates `~/ouriva-instances/alice/`, starts an isolated app + db pair on
its own port, and (if `/etc/caddy/Caddyfile` exists) wires up
`alice.ouriva.app` automatically.

To remove an instance later:

```bash
docker compose -p ouriva-alice -f ~/ouriva-instances/alice/docker-compose.yml down -v
rm -rf ~/ouriva-instances/alice
# then remove its block from /etc/caddy/Caddyfile and: sudo systemctl reload caddy
```

## Why a separate "migrator" image

The production `Dockerfile`'s final stage deliberately removes `npm`/`npx` to
shrink its attack surface, so the running app container can't invoke Prisma
itself. Both scripts here build the `builder` stage (one step earlier in the
same multi-stage Dockerfile, which still has the full toolchain) under its
own tag and run it once, throwaway, just to apply migrations and — for the
demo — seed data. It's built once and reused, not rebuilt on every reset
unless the source changed.
