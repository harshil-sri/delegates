# Delegates: unusual use cases and a judge-oriented comparison

Research round 2, 7 November 2026, India time. Working proposal. Both business and personal/creative directions remain open. No application has been implemented in this ideation task; the project folder currently contains the original spec and research notes.

**Current discussion:** Creative Veto Court is now being developed in detail at the user's request. See the [complete demo and backend design](C:/Users/iamda/Desktop/Switch/creative-veto-court-demo-and-backend-design.md). That document is a proposal for review before application coding.

## Recommendation to discuss

**Strongest candidate for a memorable creative demonstration: Creative Veto Court.** Two real collaborators' advocates negotiate a creative brief while protecting each person's explicitly approved limits. The case ends with an exported four-panel storyboard and script that both people approved.

**Strongest business candidate under the deadline: Scope Swap Court.** A client asks for additional work, the builder's agent exposes the capacity conflict, and the two sides agree what to exchange or defer. The outcome is a revised brief with an explicit diff, owners, and approvals.

**Most interesting alternative: Resource Exchange Court.** Two clubs or teams exchange access to resources at different times, producing a jointly approved allocation without either team buying more equipment.

These are recommendations, not a final selection or predictions of prizes. The most distinctive part of the project should be faithful representation of actual people and a useful result. A courtroom and additional agents do not establish that on their own.

## What new research changed

The official rubric weights Switch use at 30%, execution at 25%, creativity/impact at 25%, and presentation/documentation at 20%. [Co-organizer's judging rubric](https://www.devtoolsacademy.com/hackathons/flip-the-switch)

A limited public scan found projects describing several neighboring ideas:

| Public example | What its own description says | Implication for Delegates |
|---|---|---|
| [OpsRelay](https://github.com/sarath-ppt/switch-hackathon-project) | Incident response, PR review, and postmortem agents in Switch/Mattermost. | A multi-agent operations room is already represented in public hackathon work. |
| [CASCADE](https://github.com/yashshah1211/cascade) | Event disruption recovery, deterministic checks, human budget authorization, and local receipts; its scenario includes accessibility. | Replanning, approvals, receipts, and event constraints should be treated as expected capabilities rather than unique selling points. |
| [ProofRoom author's build report](https://builder.aws.com/content/3Lh1ATcQwjUUeMzgpQ7cQI33kAk/proofroom-evidence-backed-ai-recovery-with-switch-and-discord) | Agent diagnosis and review, human authorization, and verified local recovery. | Demonstrated execution is an important bar; a claim in a chat message is weaker evidence. |
| [Boords Agent](https://boords.com/docs/boords-agent) and [its MCP connection](https://boords.com/docs/connections) | AI storyboard editing and integration with external AI apps already exist. | Creative Veto Court must show the collaboration between independent people and the handling of their limits, beyond generating a storyboard. |

I read these descriptions and relevant pages; I did not run these projects or establish their submission or judging status. This is not an exhaustive survey of the event.

Anthropic's September 2026 [Project Swap](https://www.anthropic.com/research/project-swap) studied agents exchanging books for employees. Its analysis found that imperfect preference representation explained more of the outcome shortfall than bargaining. That motivates an owner-reviewed brief and a small sample-decision check before negotiation. It does not validate our proposed feature or establish how reliably an agent would represent users in other domains.

## The common idea worth preserving

Give each advocate a brief that its human has reviewed. Distinguish:

- **Must protect:** a condition the agent cannot waive in an accepted outcome.
- **May negotiate:** a preference the agent may trade within specified bounds.
- **Must ask:** a change requiring a human decision.

Before the case, show the owner one or two example choices the advocate would make. Let the owner correct the brief. These examples are a usability check, not proof that the agent fully understands its person.

During the case, an advocate can explain or propose a change, but only the relevant person can change their protected condition. The backend rejects a plan that fails the current encoded conditions, even if all agents praise it. When a human decision is needed, stop advancing automated turns and show the exact question. A rejection or no agreement is a valid outcome.

The moderator has authority to manage the procedure and recommend options, not to override the people. The clerk is deterministic code. The final artifact names what changed, who accepted it, which assumptions remain, and the source room messages.

An upstream [Switch issue](https://github.com/sandbox-quantum/switch/issues/1095) reports an instance of many agent messages accumulating while a human decision was pending. Our own coordinator should avoid advancing more turns while awaiting that decision. This is a behavior to implement and verify, not a guarantee that prompt instructions alone silence every agent process.

## Candidate 1: Creative Veto Court

**Opening hook:** “The campaign needs this portrait. The creator has not approved that use.”

**People:** a creative lead and a collaborator whose contribution appears in the work. Each reviews the brief their advocate will represent. The same case can be a personal project for the creative track or a proposed workflow for a small creative agency.

**Concrete demo:** create a four-panel storyboard for a fictional 30-second promo. The lead's initial approved brief requires a portrait. The collaborator's approved brief prohibits use of that portrait in the promo. Both also want the event name and approved final line preserved.

These conditions conflict. The app shows that conflict rather than allowing the judge to quietly delete one requirement. Advocates propose an alternative using original object-based artwork and the approved line. The lead explicitly accepts changing the portrait requirement. The collaborator approves the resulting revision. The app exports the storyboard and script from that revision.

**What we can check:** referenced asset IDs belong to an approved set; required text is present; there are four panels; declared shot durations sum to 30 seconds; both configured people approved the current revision. The image rendering should use known original assets. This checks the encoded asset and content rules, not every possible visual interpretation or real-world usage right.

**Useful outcome:** a storyboard, script, and change record a team can use for production. Planned durations should be presented as a storyboard plan, not proof that a finished film has been produced.

**Why Switch fits:** the people and their existing agents can challenge and revise the work in one shared room. Neither person's agent or account can supply the other's approval. The court view shows the common conversation and actual artifact revisions.

**Likely judge objection:** “Is this just an AI storyboard generator?” Show the initial conflicting mandates, the exact human revision that unlocked the solution, and the exported board tied to both approvals. The strongest comparison is a normal generation prompt: generating plausible content is easy; making two real collaborators' decisions visible is the workflow we are demonstrating.

**Market hypothesis:** small creative studios, agencies, and creator collaborations may value fewer rounds of revisions that ignore previously stated limits. Validate with people who have recently worked through an actual creative disagreement. Do not claim existing products cannot support similar processes.

**Main delivery risk:** building a film studio or commissioning complex visuals consumes the remaining time. Keep the first artifact to a readable four-panel HTML/SVG board with original simple artwork. The courtroom can use static avatars and a few states.

## Candidate 2: Scope Swap Court

**Opening hook:** “The client calls it one small change. It adds three hours to a full eight-hour plan.”

**People:** a client or product lead and the person responsible for delivering the work.

**Concrete demo:** an original plan contains A = 2 hours, B = 2 hours, and C = 4 hours, totaling 8 hours. A new D = 3 hours brings it to 11. The builder's approved limit is 8 hours. The client wants D by the same deadline.

Advocates offer concrete alternatives. Keeping A and B and replacing C with D gives 7 hours. The client can choose that exchange; the builder confirms the revised plan. If C cannot be deferred and the deadline cannot change, the app leaves the case unresolved rather than inventing extra capacity.

**What we can check:** arithmetic on the stated estimates, task inclusion/exclusion, the capacity cap, the approved revision, and each person's approval. Estimates and real-world dependencies remain human inputs.

**Useful outcome:** a before/after scope diff, included and deferred tasks, owners, due dates, and a record of both people's decisions. It is a project-planning record; the demo does not require billing, payment, or automatic customer communication.

**Why Switch fits:** a request, objection, proposal, and acceptance happen in the actual team conversation. The accepted brief links back to that history.

**Likely judge objection:** “Is this a change-request form with AI?” The advocates should explain why different exchanges matter to their owners and negotiate a concrete option, while code verifies the entered constraints. Show the revised artifact being generated from the accepted option.

**Market hypothesis:** freelancers and small agencies are a reachable initial audience. [HoneyBook's scoping guide](https://www.honeybook.com/blog/project-scoping) documents the same underlying issue and the need to define deliverables, boundaries, and changes. That supports the relevance of the workflow, not demand for our product specifically.

**Main delivery risk:** comparatively low. Markdown/text output and a scope diff are sufficient; no outside integration is necessary for the first case. Distinctiveness depends on the quality of the negotiation and the clarity of the result.

## Candidate 3: Resource Exchange Court

**Opening hook:** “One club has the room. The other has the projector. Both events can happen if they find the right trade.”

**People:** two club leads or two people authorized to lend the resources involved.

**Concrete demo:** Art controls a room from 14:00 to 18:15 and wants a two-hour screening, originally starting at 14:00. Tech controls a projector for that period but needs a room for a workshop fixed at 14:00–16:00. Art is willing to consider a later start, subject to its lead's approval.

The proposed exchange gives Tech the room from 14:00–16:00, reserves 16:00–16:15 for the handoff, and gives Art the projector for a screening from 16:15–18:15. Both owners approve the full exchange. The ledger records both sides together; one person's approval cannot reserve the other person's resource.

**What we can check:** resource ownership in the demo data, availability windows, no overlapping use, handoff time, and both approvals for the same exchange.

**Useful outcome:** a jointly approved allocation plan and calendar files. With sample resources this demonstrates planning; real bookings require authority over the actual resources and any relevant booking system.

**Why Switch fits:** the agents represent different resource owners and negotiate across different priorities in a shared room. Neither can simply allocate the other person's equipment.

**Likely judge objection:** “Is this a scheduling puzzle?” Show different resources being exchanged and each human choosing a concession. The result should meet both people's stated needs, rather than merely pick one available time.

**Market hypothesis:** campus clubs, makerspaces, creative collectives, or teams sharing equipment. Willingness to pay is less obvious than the agency case. Agent barter itself has research and product precedents, so do not claim to have invented it.

**Main delivery risk:** keeping both sides of the exchange consistent when an approval is missing or the input changes. Restrict the prototype to two people, two resources, and one complete exchange. A large marketplace is a separate product.

## Five additional unusual cases

| Case | Concrete conflict | Artifact | What a judge might like | Why it is not my first pick |
|---|---|---|---|---|
| **The Empty Chair** | A proposed group event violates one participant's declared entry or timing requirement. | Approved event plan and evidence checklist. | Immediate human consequence; an advocate can speak for a person who is not actively watching chat. | Event recovery/accessibility is already present in CASCADE; verification of real venue facts adds work. |
| **Credit Court** | A draft gives all the visible credit to one collaborator, while another needs their contribution acknowledged. | Mutually approved credit sequence and attribution text. | A recognizable creative conflict with a visible before/after result. | The people must decide attribution; the model cannot establish objective authorship or fairness. |
| **Shared Life Court** | Two people agree on chores but overlook the planning and coordination work behind them. | One week's agreed responsibilities and review date. | Relatable and emotionally meaningful. | Fair Play already addresses household task division; subtle social outcomes are harder to verify in a short demo. |
| **Data Boundary Court** | An analyst wants useful customer analysis; the data owner permits only approved aggregate information. | A report generated from an actually restricted view and a disclosure log. | Strong business relevance and concrete tool behavior if enforced correctly. | Real isolation requires controlled tools and data access. A prompt-only promise is inadequate; poor fit for a rushed first build. |
| **No Unasked Volunteering** | Two people want a shift swap, but someone else's availability or existing commitment would be changed. | Roster proposal committed only after the required people agree. | Clear ownership and a real scheduling outcome. | Existing workforce products already offer swaps and approvals; novelty is modest unless a much sharper problem is identified. |

[W3C's accessible-events checklist](https://www.w3.org/WAI/teach-advocate/accessible-presentations/) covers access to multiple facilities and event scheduling. A single step-free-entrance field cannot certify an event's accessibility. [Fair Play](https://www.fairplaylife.com/the-book) is a precedent for household responsibility planning. [When I Work](https://help.wheniwork.com/articles/accepting-shift-swap-and-drop-requests/) documents shift swaps. For future controlled-tool work, [OPA's agent tool-calling documentation](https://www.openpolicyagent.org/docs/agent-tool-calling) illustrates the distinction between a policy decision and enforcement in the agent harness.

## How I would compare them as a judge

These are qualitative estimates of potential for a narrow MVP, not scores earned by existing code. Most share the same underlying Switch design, so they have similar Switch potential. Actual execution could change this ranking substantially.

| Candidate | Switch use (30%) | Execution feasibility (25%) | Creativity and impact (25%) | Presentation (20%) |
|---|---|---|---|---|
| **Creative Veto Court** | Strong if each person's decisions are real | Strong with a simple board renderer | Very strong human-agency story; real creative output | Very strong: conflict and resulting board are visible |
| **Scope Swap Court** | Strong | Strongest: small deterministic model and text artifacts | Strong practical need; a more familiar product category | Strong: the extra work and agreed exchange are easy to see |
| **Resource Exchange Court** | Strong; separate resource authority matters | Medium: complete exchange must be consistent | Very strong story about creating a useful exchange | Strong if the two timelines are drawn clearly |
| **The Empty Chair** | Strong with a real participant-approved brief | Strong with clearly labeled sample facts | Strong human consequence, but overlap with public event work | Very strong opening hook |
| **Shared Life Court** | Strong | Medium: meaningful success is partly subjective | Strong relatability; less distinctive category | Strong with a specific believable conflict |
| **Data Boundary Court** | Strong if the agents have different enforced capabilities | Hardest | Strong business relevance | Medium: difficult to explain and prove quickly |

**My choice for standing out:** Creative Veto Court, with Scope Swap Court as the practical business alternative. The first combines a creative-track use case with a plausible agency market, so it preserves both audiences without requiring two separate products. Resource Exchange is the best additional concept to keep if neither resonates.

The personal/creative and business workflow tracks are distinct framing choices; use the final submission form and event rules to determine how the selected workflow can be entered. The suggestion here is not to claim two completed workflow products.

## A proposed Creative Veto demo

| Video segment | Visible evidence |
|---|---|
| 0–10 seconds | Portrait requirement versus the collaborator's explicit no-portrait rule. Two people, one unresolved creative brief. |
| 10–30 | Each owner reviews their advocate's brief; show one concrete sample choice if it is implemented. |
| 30–65 | Real advocate messages in Switch identify the conflict and propose a different visual treatment. |
| 65–100 | The human lead accepts changing the portrait requirement in chat; the second person reviews the revised board. |
| 100–130 | Both configured humans approve the same revision; the exported storyboard appears. |
| 130–155 | Show the required text, allowed asset IDs, planned duration total, and source message references. |
| 155–180 | Briefly show Switch's role and the setup path. Mention the next use case only if time permits. |

Three minutes is a suggested format; verify any final form limit. Do not depend on a model making a random mistake to create drama. Start with genuinely conflicting, explicitly provided requirements. Any deliberately injected invalid proposal or explanatory replay must be labeled. A sample board is a sample board, not a produced film or evidence of real customer use.

## Minimum implementation shape after a choice

One Switch room, two human participants, two advocate agents, and an optional moderator agent. The application is the clerk, constraint checker, current-revision tracker, and artifact renderer. The court view reads actual room messages through a verified integration.

Store owner-approved briefs, proposed revisions, source message IDs, checks, and approvals. An agent may propose edits but cannot silently change a human's protected condition. Only approvals for the current revision count. Keep private reasons outside the shared workflow; no new privacy claim is needed to demonstrate an explicitly shareable requirement.

For Creative Veto, use a small set of original assets with stable IDs and declared permitted uses. The renderer produces output from the approved structured board. It should not allow an unapproved asset to slip into the exported artifact just because the transcript contains an agreement.

The checks verify the stated model. They do not prove global fairness, legal rights, full preference understanding, or that the agent cannot utter a mistaken sentence. The app must show unknowns and leave rejected cases unresolved.

## Deadline-aware choice test

The official deadline is **7 November 2026 at 23:59 IST**. The spec's internal target is **18:00 IST the same day**. [Official event page](https://www.wemakedevs.org/hackathons/switch) At the start of this research round, the project is still in ideation; time spent on setup, sleep, recording, and submission must be allowed for.

Before building a full court, prove a tiny end-to-end path: two people can participate in the room, the advocates answer with their assigned briefs, a human changes one condition, and the accepted result reaches a real exported artifact. The exact installed Switch versions, identities, addressing, and observation path are still technical gates.

If the board export and real room flow are too costly, Scope Swap uses the same representation and approval ideas with a much simpler text artifact. A generic landing page or animated transcript does not demonstrate a completed case by itself.

## Sources checked during this round

- [Judging rubric](https://www.devtoolsacademy.com/hackathons/flip-the-switch)
- [Official challenge and deadline](https://www.wemakedevs.org/hackathons/switch)
- [Project Swap research](https://www.anthropic.com/research/project-swap)
- [OpsRelay public repository](https://github.com/sarath-ppt/switch-hackathon-project)
- [CASCADE public repository](https://github.com/yashshah1211/cascade)
- [CASCADE author's build report](https://dev.to/yashshah1211/when-our-ai-agent-said-committed-before-it-had-executed-anything-21b2)
- [ProofRoom author's build report](https://builder.aws.com/content/3Lh1ATcQwjUUeMzgpQ7cQI33kAk/proofroom-evidence-backed-ai-recovery-with-switch-and-discord)
- [Boords Agent](https://boords.com/docs/boords-agent)
- [Boords MCP connection](https://boords.com/docs/connections)
- [HoneyBook on project scoping](https://www.honeybook.com/blog/project-scoping)
- [Switch discussion of conversational damping](https://github.com/sandbox-quantum/switch/issues/1095)
- [W3C accessible events](https://www.w3.org/WAI/teach-advocate/accessible-presentations/)
- [Fair Play household work](https://www.fairplaylife.com/the-book)
- [When I Work shift requests](https://help.wheniwork.com/articles/accepting-shift-swap-and-drop-requests/)
- [OPA on tool policy enforcement](https://www.openpolicyagent.org/docs/agent-tool-calling)
