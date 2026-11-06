# Delegates: research, concept options, and backend brief

**Working draft — 6 November 2026, India time.** Prepared from the existing `delegates-courtroom-spec.md`, the hackathon pages, the Switch source, and the sources below. This is a proposal for discussion, not an implemented system or a claim that the idea is globally unique. The original spec has not been changed.

## Current direction: both audiences remain open

**Update, 6 November:** Business and personal/creative audiences remain open for exploration. The launch scenario below was an initial recommendation, not a final decision. The shared product idea is a Switch room in which advocates represent actual people, surface an actionable conflict, and help them approve an outcome. Choose the demo scenario and track only after comparing the cases and testing the basic Switch workflow.

**Further research, 7 November:** See [unusual use cases and judge review](C:/Users/iamda/Desktop/Switch/delegates-unusual-cases-and-judge-review.md). Public hackathon examples already cover incident recovery, event replanning, approvals, and receipts. The updated shortlist is Creative Veto Court for a distinctive creative demonstration, Scope Swap Court for the most practical business MVP, and Resource Exchange Court as a further alternative. Both audiences remain under consideration; these are proposals rather than a settled product choice.

## Initial launch-planning hypothesis

**Business hypothesis:** keep the courtroom, the two owner advocates, and the human appeal; one possible first demo helps two startup teammates agree on a launch plan when time and priorities conflict. A personal/creative case remains equally open for exploration.

**Pitch:** “Two teammates have four features to ship and not enough time. Their Switch agents argue for their priorities, the court exposes the trade-off, and the people approve a plan they can actually start working on.”

The visual court earns attention. The differentiating product hypothesis is the combination of independently represented stakeholders, a specific conflict, a visible constraint check, a human decision, and a reusable decision receipt inside the team's chat workflow. It is not enough to show AI characters debating or an AI judge producing a plausible verdict: there are already public projects that do that.

My working name is **Delegates: Decision Court**. The broader product could eventually handle team handoffs, planning, and other shared decisions. The initial demo should solve one decision end to end.

**Choose a track intentionally.** The existing spec targets the personal/creative track; a startup launch-planning use case has a strong fit for the business-workflow track. Creative execution is still valuable in either track. Do not assume the same workflow can be entered in both workflow tracks without checking the submission form or organizers.

## What exists today

At the initial inspection on 6 November, the specified project folder contained the concept spec only. Research notes have since been added. I did not find an application, Git repository, working Switch configuration, tested backend, screenshots, or evidence that any of the five spike gates have passed. The analysis of implementation below is a design proposal, not a description of working code.

The existing design has several strengths worth retaining:

- The advocates represent two named people, rather than abstract pro and con personas.
- The shared Switch room gives humans and agents a place to work together.
- Limited rounds and a visible appeal give the story a beginning, conflict, and end.
- A live scene and growing plan can make the workflow understandable without a long explanation.

The key weaknesses to address:

- “Agents argue until an AI judge decides” is similar to existing debate demos and does not show a concrete user outcome.
- Owner constraints need an explicit sharing boundary. A prompt saying “keep this private” is not a guarantee.
- A judge cannot establish that a plan works merely by sounding confident. Some constraints need deterministic checks.
- An unverified observer, two-machine setup, and private-room flow are substantial delivery risks with the deadline close.
- The spec says Switch Decisions and Tasks will hold rulings. On the upstream main branch researched on 6 November, the agent protocol documentation says the task protocol is not ready for use. The visible agent operation list does not establish the proposed decision API. Store the receipt in the app and/or post it to the room unless the exact installed Switch version proves stronger support.

## Hackathon facts

The official [event page](https://www.wemakedevs.org/hackathons/switch) asks for a team-chat workflow in which at least one person and one agent complete a real task using Switch. Switch has to be central. The [co-organizer's judging page](https://www.devtoolsacademy.com/hackathons/flip-the-switch) gives these weights:

| Criterion | Weight | What we should show |
|---|---:|---|
| Use of Switch | 30% | A real shared room, real independent agent identities, messages and a human action in chat; identify what breaks without the room. |
| Technical execution | 25% | A complete real run, clear setup, bounded turns, failure behavior, and a repo another person can try. |
| Creativity and impact | 25% | A memorable court scene plus a real disagreement and useful output. |
| Presentation and documentation | 20% | Show the problem, Switch interaction, constraint conflict, decision, and output; explain setup and limitations in the README. |

Submissions close **Saturday, 7 November 2026 at 11:59 p.m. IST**. The existing spec sets a safer internal target of **6:00 p.m. IST** that day. As of approximately 8:20 p.m. IST on 6 November there are roughly 22 hours until that internal target, not 22 hours of guaranteed coding time. The event asks for a public repo, demo video, and README; verify all details in the actual submission form. Existing tools and agents are allowed, but the Switch setup and workflow need to be built during the event.

On this computer, Docker is installed, but a read-only `docker info` check could not reach the Docker Desktop Linux engine pipe at research time. This does not prove why the engine was unavailable. It makes the Switch/Mattermost boot test the first practical gate.

## What research changes about the idea

| Existing example | What it establishes | Opportunity for us |
|---|---|---|
| [Agentic Coliseum](https://github.com/hseghetti/agentic-coliseum) | Two agents, live structured debate, and an AI judging panel already exist. | Don't sell debate, animation, or a judge by themselves as novel. Show actual named people's stakes, a shared task, and their decision. |
| [Multi-Agent Scheduler](https://github.com/ingyukoh/multi-agent-scheduler) | Agent negotiation over private calendars already exists as an open-source example. Its own test compares coordination, disclosure, and rechecking. | Scheduling alone is not a unique concept. A launch decision with multiple competing constraints and a change-sensitive receipt is a different proposed use case. |
| [Pactum](https://pactum.com/autonomous-procurement-with-pactum) | Enterprise software already uses agents for supplier negotiation within business workflows. | There is a real commercial category, but Pactum's procurement workflow is not the same as this proposed internal team-decision wedge. This is not proof of demand for our product. |
| [MIT CISR on AI decision rights](https://cisr.mit.edu/publication/2026_0601_AIDecisionMatrix_SebastianWeillHaskampVomBrocke) | An interview-based framework treats risk, ambiguity, and human/AI decision rights as significant design choices. | Make human authority visible and exact. The agents propose and check; the people approve. |
| [CalBench](https://arxiv.org/abs/2605.09823) | Research explicitly studies the coordination-versus-disclosure trade-off for calendar agents. | Protect data by controlling what reaches the agents and shared room. Do not advertise perfect privacy or pretend shared constraints reveal nothing. |

None of this establishes that the proposed combination is first in the world. Our claim should be: **a specific, reproducible way to resolve one real team decision through Switch**, with an honest demonstration of where humans retain control.

## Two audiences, four cases to explore

All cases are hypothetical. They share the same basic workflow, but each needs its own prompt, inputs, conflict, and useful receipt. The proposed engine is reusable in principle; it should not be advertised as proven across cases until both are actually tested.

1. **Business: Customer Promise Court.** A sales lead has promised a customer a Friday feature; an engineer says the full version needs until Tuesday. Their advocates explore a limited Friday preview versus a complete Tuesday release. The people review what is included and excluded, the date, ownership, and how the customer will be told. Product question: would teams use this before commitments are made, and who would pay? No message is sent to a real customer without a separate authorized action.
2. **Business: Client Scope Court.** A freelancer and a client disagree about additional changes before a deadline. Advocates turn the disagreement into options: reduce the scope, move the date, or explicitly agree on additional work. The outcome is a proposed scope-change record for both people to approve. Avoid claiming that the receipt forms a legal contract.
3. **Personal: Shared Life Court.** Two roommates or partners need to divide groceries, cooking, cleaning, and time-sensitive responsibilities around different schedules. Advocates make the often-forgotten planning and coordination work visible and offer a revised division. The humans choose what is reasonable; the system does not declare a relationship fair or judge anyone's character. The receipt is an editable agreement for the week.
4. **Personal: Event Budget Court.** Two friends want a memorable night out while staying within a stated spending limit. For example, a ₹1,000 ticket, ₹400 transport, and ₹300 food per person total ₹1,700 each, exceeding a ₹1,500 budget. A ₹100 transport option reduces the estimate to ₹1,400 each, but only if the people verify it meets their timing and accessibility needs. The output is a jointly approved plan, not a booking.

Fair Play already offers a method and cards for dividing household responsibilities; this case is not a claim to invent the idea. [Fair Play](https://www.fairplaylife.com/the-book) Doodle already supports group availability polls, and Splitwise already records shared expenses. [Doodle](https://help.doodle.com/en/articles/9823082-introduction-to-group-poll), [Splitwise](https://www.splitwise.com/) In business, Linear already records project updates and Atlassian documents decision rights and outcomes. [Linear](https://linear.app/learn/project-planning), [Atlassian](https://www.atlassian.com/team-playbook/plays/daci?swcfpc=1) The specific hypothesis to test is whether separate advocates and a shared, human-approved Switch workflow make an unresolved trade-off easier to resolve—not that basic planning, fairness, scheduling, or decision records are novel.

An upstream Switch issue reports a real example of roughly fifty agent messages accumulating while a human decision was pending. [Switch issue #1095](https://github.com/sandbox-quantum/switch/issues/1095) For either audience, a potentially valuable behavior is a **quiet pause**: when a required human decision is pending, the coordinator stops advancing agent turns until the human responds or the case is explicitly cancelled. A demo of that behavior is a stronger Switch-specific reliability detail than more agents talking.

**How to choose without prematurely committing:** for each case, write a ten-second hook, two real conflicting inputs, an observable human decision, and one output the people would actually use. Compare how quickly two people understand the conflict, how naturally a Switch room fits the situation, and whether the full run is feasible before the deadline. Run the leading case for real; show a second only if it also runs and adds to the story. Never claim both tracks or all use cases have been proven by a single example.

## Directions considered

Scores below are qualitative judgments for a two-person team under the event deadline, not measured results.

| Direction | Core conflict and buyer/user | What makes the demo interesting | Main drawback | Fit |
|---|---|---|---|
| **1. Launch Decision Court** | Two founders or product/engineering teammates must choose what fits before a launch. | Feature wishes collide with capacity; the court shows a rejected plan, an alternative, and both people signing the receipt. | Needs believable estimates and a clear check; may fit Business better than the current Creative track. | Strong practical story and natural fit for the team building it. |
| 2. Handoff Court | Two teams disagree on ownership, acceptance criteria, and when a handoff is complete. Buyer hypothesis: engineering managers and delivery leads. | A support agent refuses an ambiguous handoff until an owner and evidence are named. | More abstract on screen; needs a very good example to be understood fast. | Strong future B2B wedge. |
| 3. Incident Decision Court | Operations and product disagree about a simulated rollback versus a limited release. Buyer hypothesis: engineering teams. | Conflicting evidence arrives and the judge must expose uncertainty before a human selects a response. | Higher stakes and more integrations/fictional data; claims about safety or autonomous remediation would be difficult to justify. | Strong spectacle, greater build and trust risk. |
| 4. Two-Person Life Court | Friends plan a trip or shared weekend with time, budget, and preferences. | The court rejects an unaffordable option and negotiates a specific alternative. | Privacy-sensitive and close to scheduling/travel assistants; a weak execution could look like a generic itinerary bot. | Best fit for the original Personal/Creative track. |
| 5. Promise / Change Court | A previously agreed plan becomes stale when a stakeholder changes an input; agents renegotiate only the affected parts. | Approvals visibly expire when a critical assumption changes. | Requires revision tracking and one more complete interaction. | Strong feature or follow-on, rather than a separate first build. |

If you prefer Track 2 and a more playful audience, use the life-planning case with the same backend: two real people, an explicit budget, checked options, and a human-approved result. The choice of launch planning is a recommendation, not a settled decision.

## The proposed first case

**Prompt in chat:** “Our submission is due tomorrow. What can we ship with our remaining time?”

The following numbers are synthetic demo inputs, not actual estimates. Both people explicitly agree that their **available hours** may be shared. The reason behind a person's availability never needs to enter the system.

| Work item | Harshil | Daksh |
|---|---:|---:|
| Working Switch dialogue | 1 h | 1 h |
| Basic recovery and a complete flow | 1 h | 1 h |
| Demo and README | 1 h | 0.5 h |
| Full courtroom animation | 1 h | 0.5 h |
| **Total for everything** | **4 h** | **3 h** |

If each person has 3 hours available, the first plan exceeds Harshil's stated capacity by 1 hour. The software can prove **that arithmetic about the entered estimates**, not that all real-world dependencies or deadlines have been verified.

1. Each person chooses their priority and the constraints that may be shared. One prioritizes visual impact; the other prioritizes a demo that survives failure.
2. The advocates produce a proposal and an objection as real messages in the Switch room.
3. The app flags the 4 h versus 3 h conflict. The moderator can propose a second option: defer full animation, keeping the first three items. That sums to Harshil 3 h and Daksh 2.5 h.
4. A “what would change?” card explains the local counterfactual: the full-animation option needs at least one extra Harshil hour, **assuming all other estimates remain unchanged**. It is not permission to change that person's capacity.
5. One human intervenes: “Defer the animation.” Both named humans review and approve the exact plan revision in chat. If either rejects it or does not respond, the status stays pending; the AI cannot declare consent.
6. The app posts or presents a receipt: selected option, deferred work, each item and owner, input estimates, remaining unknowns, approvals, and links/IDs back to the room messages. It is a planning artifact; it does not imply that any code was shipped.

**Optional memorable extra:** after both approvals, change one approved capacity value and show the prior receipt immediately marked **stale / needs reapproval**, then rerun the decision. Keep it only after the basic case runs reliably. Never silently use the prior approvals for the changed plan.

## UX and demo: show the consequence

Opening visual: “We have 4 features and 3 hours each. Which promise do we break?” Show the two humans' actual entered constraints and the agent identities in the Switch room quickly.

Suggested three-minute structure, assuming a three-minute video is allowed by the final form:

| Time | What the viewer sees |
|---|---|
| 0–10 seconds | The question, visible capacity conflict, and a one-sentence product promise. |
| 10–35 | Two teammates' priorities and the shared Switch room with distinct advocates. |
| 35–75 | One proposal, one objection, and the arithmetic conflict shown next to the dialogue. |
| 75–115 | Alternative and counterfactual; an actual human sends a decision in chat. |
| 115–145 | Both people approve the same revision; the decision receipt and owners appear. If implemented, change a constraint and show the old approval becoming stale. |
| 145–180 | Show Switch room → app observer → checked state → receipt; briefly state how to reproduce. |

Record actual agent and human messages. If the UI uses test fixtures, pre-recorded events, or a replay for any part, say so; do not pass it off as a live Switch run. Use screenshots or editing to keep a real run concise without inventing output. Keep a backup of the full run.

## Proposed backend

### System boundaries

```text
Harshil + Daksh            Two advocate agents + moderator agent
        \                    /
         Mattermost channel / Switch shared room
                       |
      Clerk/observer identity with access only to that room
                       |
     Small application backend: room reader + state machine
     + constraint checker + SQLite event/receipt storage
                       |
          browser receives app events and renders court
```

Switch is the collaboration and conversation layer. Agents talk and humans make their decisions in the shared chat. The app reads those messages, checks structured inputs and presents a court view. The app's receipt is a projection of the room's actual discussion and approvals; it is not a substitute channel with fabricated agent messages. If the observer or UI is down, the room conversation can still be inspected, but this particular decision workflow cannot automatically verify and publish its receipt.

Suggested stack: a small **TypeScript Node service** with SQLite and SSE to the browser; or Python/FastAPI with SQLite if the team is faster in Python. Pick the stack the builders already know. A single process is sufficient for the demo. Avoid Redis, a task queue, a vector database, cloud deployment, separate microservices, and external calendars until the whole flow works.

### A concrete Switch integration to spike

Research found `read_context` in Switch's [agent operations source](https://github.com/sandbox-quantum/switch/blob/main/core/switch_core/bridges/agent/operations/definitions.py). It can read a specific room's stored timeline when the agent is a member, and returns message IDs, senders, bodies, timestamps, and thread groups. The [HTTP operations adapter](https://github.com/sandbox-quantum/switch/blob/main/core/switch_core/bridges/agent/api/operations.py) exposes operations under `/agents/{agent_id}/ops/{operation}`; the exact server base URL, version, authentication, and permissions must be verified on the installed build.

Spike the following, in this order:

1. Create one dedicated observer/clerk identity and grant it membership in the **shared room only**. Keep its token in the server environment, never the browser or repo.
2. Call `read_context` with the explicit shared `room_id`. Verify the actual installed version accepts the call and returns both human and agent messages with stable IDs and sender identities. Do not assume a timestamp alone uniquely identifies a message.
3. Start with polling every 1–3 seconds and an overlapping time window; flatten threads and deduplicate by source message ID. Handle pagination/truncation and reconcile after restart. A short demo may read the recent whole room on each poll, but must not silently discard older messages.
4. Parse only designated, validated message formats into proposals and approvals. Keep other messages visible as transcript, but never let an unrelated message mutate the plan.
5. If the backend must initiate a turn, test that a message sent under its own identity actually addresses and wakes the intended agent. Never post as a human or another advocate. Prove the addressing permissions first.

Why poll first? It avoids writing and maintaining a custom Switch socket client before the demo. The installed release may differ from upstream docs: current upstream [agent API source](https://github.com/sandbox-quantum/switch/blob/main/core/switch_core/bridges/agent/api/handlers.py) describes a WebSocket agent connection and legacy SSE compatibility; the checked-in protocol notes still emphasize SSE. Pin compatible Console/server versions, check their actual behavior, and don't assume an SSE example on the website is the whole current contract.

If this read path cannot be made to work quickly, a clerk agent can explicitly emit structured events to the local app **after it has observed actual Switch messages**. Validate sender, case, and source-message ID where available. This fallback still needs a real, working mechanism for the agent to call the local endpoint; test it rather than treating it as guaranteed. If neither integration works, show the live Mattermost workflow without the custom visualization and be explicit about the missing integration. A canned frontend is useful for UI development but is not the working submission.

### State and event model

The backend owns the plan status, version, checks, and projection; Switch owns the room conversation. Suggested states:

`DRAFT → INTAKE → NEGOTIATING → NEEDS_HUMAN → PROPOSED → AWAITING_APPROVALS → APPROVED`

Any changed required constraint or plan revision invalidates earlier approvals and moves the case back to `NEGOTIATING` or `AWAITING_APPROVALS`. Add explicit `BLOCKED` / `FAILED` status for missing agents, unavailable Switch, or an invalid event. Never transition to APPROVED because a timer expired. An appeal may end in rejection or no agreement.

Suggested records:

- **Case:** ID, room ID, topic, participants, state, round limit, current proposal revision.
- **Shared constraint:** owner, kind, value, units, source message ID, and revision. Store only information deliberately shared for the case.
- **Proposal:** ID, case ID, revision, structured items, estimates by owner, assumptions, and referenced source message ID.
- **Approval:** case ID, exact proposal ID/revision, verified human sender ID, source message ID, timestamp, and approve/reject decision.
- **Event:** app event ID, case ID, type, source Switch message ID where applicable, authenticated sender ID, timestamp, and validated payload.

The receipt can be generated from these records. Keep human-readable text alongside structured data; a JSON blob alone is a poor chat experience.

### Orchestration and correctness

- Start with two advocate agents and one moderator. A deterministic backend plays the clerk; avoid a separate LLM clerk and a three-judge panel.
- Use named mentions and a designated next speaker. Cap at two or three rounds. Accept at most one state-changing message for the expected speaker/turn; duplicates and out-of-turn messages remain visible but cannot advance state. If an agent is silent or fails, show the problem and ask a human to intervene.
- Agents may propose or criticize; the backend validates schema and arithmetic. Unknown values are marked unknown, never filled with fake estimates. Do not claim global optimality or fairness from a small list of candidates.
- Accept approval only from the two preconfigured human identities observed through the trusted Switch room, for the currently displayed exact proposal version. A quoted message, an agent message, an old revision, or a displayed name alone is not an approval.
- Use message ID deduplication and transactional state changes. After a reconnect or refresh, rebuild from stored events and reconcile with the room. A duplicated or late event must not produce a second approval or start another round.
- Make the capacity checker simple and explicit: sum input hours by person, compare with entered caps, and show exactly which cap fails. It cannot certify real scheduling, legal compliance, or factual correctness.

### Privacy: realistic scope for a hackathon

For the first demo, use only fictional or deliberately shareable inputs. The owner may retain the private reason for a constraint outside the application; the shared room sees only what that person has approved, such as “I have 3 hours.” This can still reveal information and is not privacy-preserving computation.

Do not let a shared advocate read the owner's private chamber and trust a prompt alone to stop leaks. Upstream `read_context` explicitly allows an agent to read **any room it belongs to**, even while working in another. For a later private-intake feature, separate the intake identity from the public advocate, make the owner approve the exact outgoing brief, and only pass that brief forward. Test membership and actual data paths. Also remember that the shared server/operator and model provider may receive whatever data reaches them; room isolation does not eliminate those trust boundaries.

Two machines, truly private chambers, calendar access, cross-company trust, and cryptographic privacy are **unverified stretch work**, not claims for the demo.

## Minimum acceptance checks

1. A human message and two differently named agents' real replies appear in the same Switch room and the app within the measured polling interval.
2. Four-item demo data returns Harshil = 4 h versus a 3 h cap; the three-item alternative returns 3 h / 2.5 h. A missing estimate says unknown rather than pass.
3. Wrong actor, duplicate message, malformed proposal, outdated revision, or one human approval cannot close the case.
4. Both actual human accounts approve the same revision; the receipt shows the same decision and source message IDs. If only one human/account is available, label the limitation and do not claim two independent approvals.
5. Changing a constraint invalidates old approvals. If the change case is cut, at least prohibit editing an approved revision without reopening it.
6. If Switch or an agent disconnects, the display says it is waiting or blocked. On reconnect, a refresh does not duplicate messages or silently invent a verdict.
7. An agent without membership in a synthetic private room cannot read it; if that test is not run successfully, make no isolation claim beyond the use of shareable inputs.
8. A second person follows the README on a clean setup, or the demo records clearly which setup prerequisites and manual steps remain.

## Priority order and split

This is a suggested split, not a claim about the team's skills. Exchange roles if needed.

**First gate, together (time-box to 60–90 minutes):** Docker engine, Switch Console, Mattermost, one agent replying, then two agents responding in the same room. Confirm two distinct human identities if feasible. Test the observer read path before investing in the animation. Verify agent addressing: Switch's own getting-started guide says the default can be “Only me,” so another agent may not be allowed to address it until configured. Avoid exposing a local service to the public internet just to meet the two-machine aspiration.

**Harshil — Switch and behavior:** configure the room, advocates, moderator, turn prompts, permissions, and agent response limits; keep a plain-text backup of the setup instructions and test data.

**Daksh — app and presentation:** implement the room reader, deterministic checks, event storage, receipt, and simple frontend. Swap this split if experience points the other way. Integrate early; do not wait for a polished UI.

**Gate 2:** complete one case end to end in chat and save a real message ID, even with a plain HTML display.

**Gate 3:** render the actual case on the court screen, then add one modest visual flourish if time remains.

**Gate 4:** record a full successful run, verify the README and public repo, and submit before the 6 p.m. internal target. Blog, Wispr evidence, extra channels, and social posts come after the main submission is secure. If using Wispr, follow the event's requirements and submit the actual scorecard.

Fallback order when time is tight: two machines → one machine with two real human accounts; multiple rooms → one shared room with deliberately shareable data; custom art → simple static avatars; advanced real-time protocol → verified room polling; extra agent roles → two advocates plus one moderator. Do not silently replace real room events with scripted footage or real approvals with fictional ones.

## Decisions to discuss next

1. Business workflow for launch/scope decisions, or the personal/creative two-person planning case?
2. Which agent providers, model subscriptions, and operating systems do the two builders actually have?
3. What is the team's realistic working time before the internal submission target?
4. Is the optional “approved decision becomes stale when constraints change” moment more exciting than a richer courtroom animation?

## Source links and verification date

Checked 6 November 2026. Links to `main` can change; pin a commit and record the Console/server versions when implementation begins.

- [Flip the Switch event overview, challenge, rules, FAQ, and deadline](https://www.wemakedevs.org/hackathons/switch)
- [Co-organizer's judging weights and submission items](https://www.devtoolsacademy.com/hackathons/flip-the-switch)
- [Switch getting started and agent addressing settings](https://www.switchagents.ai/blog-posts/switch-getting-started)
- [Switch triage template](https://github.com/sandbox-quantum/switch/blob/main/examples/agent-templates/triage-pair.template.yaml)
- [Switch room operations](https://github.com/sandbox-quantum/switch/blob/main/core/switch_core/bridges/agent/operations/definitions.py)
- [Switch HTTP operation adapter](https://github.com/sandbox-quantum/switch/blob/main/core/switch_core/bridges/agent/api/operations.py)
- [Switch API handlers](https://github.com/sandbox-quantum/switch/blob/main/core/switch_core/bridges/agent/api/handlers.py)
- [Switch checked-in protocol notes](https://github.com/sandbox-quantum/switch/blob/main/docs/official/internals/agent-protocol.md)
- [Agentic Coliseum](https://github.com/hseghetti/agentic-coliseum)
- [Multi-Agent Scheduler](https://github.com/ingyukoh/multi-agent-scheduler)
- [Pactum autonomous procurement](https://pactum.com/autonomous-procurement-with-pactum)
- [MIT CISR: Designing Decision Rights for AI](https://cisr.mit.edu/publication/2026_0601_AIDecisionMatrix_SebastianWeillHaskampVomBrocke)
- [CalBench research](https://arxiv.org/abs/2605.09823)
