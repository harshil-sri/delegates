# Verified Switch integration spike

Completed (UTC): 2026-11-06T19:19:16.881Z
Run: spike-b990c3be-ab36-4940-af08-6b2606df4794

Switch core: 0.31.0; room: creative-veto-spike (2b4d2b59-82f0-4876-a60b-a948517d825f).

Two real Codex CLI turns read their input through Switch and posted under separate agent identities. The deterministic clerk read both replies back. Both replies were also observed through the authenticated Mattermost API.

## Observed replies

### cvc-lead-advocate

The lead’s goal is a personal, energetic 30-second SIGNAL promo with exactly four panels. The initial brief specifically requires portrait-daksh, but the creator has not approved use of the portrait.

Protected: The portrait requirement cannot be replaced, and portrait use cannot be asserted as permitted, without the lead human’s decision.
Next: Offer a four-panel, object-based alternative—such as personal desk items, energetic motion graphics, and SIGNAL branding—then ask the lead to approve or reject replacing portrait-daksh.

Request: sw_ee18d5b219f44028813f1e30f7e7aa5a
Reply: sw_60bf1bd2abbe48a99b0f4e01870f0407
Provider duration: 14.3 seconds.

### cvc-creator-advocate

The lead proposes a four-panel, object-based alternative but notes the original brief requires portrait-daksh. That conflicts with the creator’s boundary, which excludes portrait-daksh.

Protected: Do not use portrait-daksh. Preserve the exact final line “Made together. On our terms.” and credit “Visuals: Daksh”.
Next: Propose four panels using notebook, hands-sketch, light-trails, and signal-mark, while retaining the required line and credit. Ask the lead human whether to amend the portrait requirement and the creator human whether to accept this alternative.

Request: sw_311023b6438347be8e5d76fe444bdedc
Reply: sw_30f44c8b1ca24c6a949d0d89beb9fa33
Provider duration: 13.2 seconds.

## Scope

This proves real agent identity, context delivery, reply posting, clerk observation, and Mattermost relay. It uses one local administrator-owned server and two Codex-backed external/passive agents. The local listener polls for new mentions; Switch Console agent sessions were not configured.

Human approvals: **0**. No human action, final storyboard, portrait approval, private-room isolation, or multi-machine ownership is claimed.

Run `npm run spike` to produce a new independent run, and `node scripts/export-spike-proof.mjs` to update this report. Detailed provider logs and credentials remain under ignored `.runtime/`.
