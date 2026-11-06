# Switch stack provenance

`compose.yml` is the unmodified bundled standalone Compose file from
`sandbox-quantum/switch`, tag `switch-console-v0.40.1`, commit
`6ab2ff463ad9518920ba2a15b182b1d2e760fd9f`.

Source: https://github.com/sandbox-quantum/switch/blob/6ab2ff463ad9518920ba2a15b182b1d2e760fd9f/console/apps/switch-console-desktop/src/main/core/managed-switch-server/resources/standalone-docker-compose.pinned.yml

The stack uses the published `switch-core`, `gateway`, and `setup` images pinned
to version `0.31.0`, the core version bundled by this Console release. Mattermost
is pinned by that upstream Compose file. See `SWITCH-LICENSE` for the upstream
license and Commons Clause. This project does not change Switch core.
