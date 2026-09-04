# GeneVault — Your AI can check your DNA without ever seeing it 🔐🧬

**Privacy-preserving pharmacogenomics with WebMCP + real Groth16 zero-knowledge proofs.**
The browser proves drug safety to an AI agent with mathematical certainty — the genetic file never leaves the device.

> **The 20-second version:** For ~30% of people, the common blood thinner clopidogrel (Plavix) doesn't work — the first sign can be a fatal clot. Guidelines say *check the patient's genetics first*. But nobody should upload their DNA to an AI or cloud: you can change a leaked password, never your genome. **GeneVault registers 18 tools on `document.modelContext` so any AI agent can ask the browser directly — and the browser answers with a Groth16 zk-SNARK proof, not with your DNA.**

---


Watch the **WebMCP Agent Runtime HUD** (bottom-right), the **3D DNA helix** re-orienting live, and the
**human-in-the-loop consent gate** controlling every release. Then try the **Forgery Audit** button and
watch the R1CS circuit *mathematically refuse* to prove a false claim.

**Testing with a real external agent:** open the hosted URL in **ChatGPT's in-app browser** (supports
WebMCP natively) or **Chrome 149+** with `chrome://flags/#enable-webmcp-testing` → *Enabled* → relaunch.
The status pill turns green: `WebMCP: 18/18 Active`. Without WebMCP support the app runs an identical,
honestly-labeled local fallback — the full demo still works.

> 💡 No Gemini API key is needed for judging. The optional in-page chat asks for your own key
> (sent as a `x-goog-api-key` **request header**, memory-only, never stored) — everything else is keyless.

---

## Understand the concept via prompts

The fastest way to actually *get* what GeneVault does is to ask it something and watch which of
the 18 tools light up. Every prompt below is copy-pasteable into the in-app Prescribing Copilot
(or into an external WebMCP agent like ChatGPT's browser) — try **Load Demo Data** first.

| Prompt | What it's really testing | Tools it triggers |
|---|---|---|
| "My friend was prescribed Plavix after a stent. Is it safe for me? Prove it mathematically WITHOUT reading my raw DNA, and if it's dangerous tell us what to prescribe instead." | The headline flow: risk verdict + a real proof + a CPIC alternative, all in one ask | `check_drug_safety` → `generate_zk_proof` → `verify_zk_proof` → `recommend_alternative` |
| "My GI wants to start Imuran long-term. Is my TPMT good enough? Prove it." | The panel isn't hardcoded to one gene — TPMT drives thiopurine dosing, totally different pathway | `check_drug_safety("Imuran")` → `generate_zk_proof` → `verify_zk_proof` |
| "I drink grapefruit juice daily and eat spinach — do my panel meds care?" | Non-genetic risk layered on top of genetic risk — diet interactions, not a ZK claim | `check_food_drug_interactions` |
| "Not Codeine after dental surgery — will it even work on me?" / "Is Codeine safe for me?" | CYP2D6 phenotype can mean codeine does *nothing* (poor metabolizer) or is dangerously strong (ultra-rapid) — same tool, opposite failure modes | `check_drug_safety("Codeine")` |
| "My mom starts chemo for colon cancer — the oncologist suggested Xeloda. Check my DPYD safety, prove it, and tell me if 5-FU carries the same risk." | Xeloda (capecitabine) is a prodrug of 5-FU — both are gated by the same DPYD variant, and the app should say so rather than treating them as unrelated | `check_drug_safety("Xeloda")` → `compare_two_drugs("Xeloda","5-FU")` → `generate_zk_proof` |
| "I'm starting Warfarin for AFib — which TWO genes did you prove my dose from?" | Warfarin is the one drug in the panel that requires **two independent proofs** (CYP2C9 + VKORC1) before a verdict — makes sure it's not silently dropping one | `check_drug_safety("Warfarin")` → two calls of `generate_zk_proof` / `verify_zk_proof` |
| "Is Warfarin safe for me? My doctor is setting the dose." | Same dual-gene flow, phrased the way a patient — not a developer — would actually ask it | `check_drug_safety("Warfarin")` |
| "Is Simvastatin 80mg ok for my cholesterol?" | SLCO1B1 variants drive statin-induced myopathy risk at high doses | `check_drug_safety("Simvastatin")` |
| "Show me the actual 3D enzyme that processes Plavix, dock the drug into it, and pin a note explaining what's wrong in my case." | The 3D layer isn't decoration — it's a real RCSB PDB structure, a docking visualization, and an agent-authored annotation, chained together | `visualize_variant` → `simulate_drug_docking` → `highlight_catalytic_pocket` → `annotate_structure` |
| "Honestly — why don't I just paste my rs4244285 genotype directly into the chat? What does your setup actually protect me from?" | The trust question every judge asks eventually — forces the app to explain its own threat model instead of you explaining it for it | `get_privacy_report` |
| "Prove to me that you can determine my drug response WITHOUT seeing my actual DNA letters. Show me the cryptographic proof and verify it — and count how many letters of my DNA you saw." | The whole pitch in one line — a live proof, a live verification, and an explicit, auditable zero-letter count | `generate_zk_proof` → `verify_zk_proof` → `get_privacy_report` |

Also worth trying: **Security & Forgery Audit → Attempt False Forgery**, which isn't a chat prompt
at all — it's a button that tries to make the circuit lie, and fails on purpose. That failure *is*
the demo.

---

## What's actually real

| Layer | Status |
|---|---|
| WebMCP registration | ✅ Real `document.modelContext.registerTool()` × 18 tools, verified via `getTools()`, `AbortController` cleanup |
| Zero-knowledge proofs | ✅ **Real Groth16** over bn128 (snarkjs) — 8,845-constraint Circom circuit (`PgxMembershipV2`), ~2 s proving in-browser |
| What's inside the circuit | ✅ Poseidon Merkle membership (depth 4, k = 16 anonymity set) **+ EdDSA-Poseidon issuer signature + single-use nullifier — all verified inside the SNARK** |
| Replay protection | ✅ Every proof commits a fresh `verifierId`; the nullifier registry rejects exact replays; re-querying legitimately mints a fresh nullifier |
| False claims | ✅ **Cryptographically impossible** — a non-member leaf fails witness generation (tested; try it live in the Forgery Audit) |
| Secret derivation | ✅ `sha256(gene ‖ genotypes ‖ per-file random salt)` at parse time — nothing genetic is hardcoded in the source |
| DNA parsing | ✅ Client-side single-pass: 23andMe, AncestryDNA raw text and VCF 4.x (GT/REF/ALT). 600k+ positions in ~1 s. Never uploaded |
| Human-in-the-loop | ✅ External agent calls block until the patient clicks **Allow once / Allow all session / Deny** — denial returns `denied_by_patient` and releases nothing |
| 3D & science content | ✅ Live RCSB PDB structures (4GQS, 2F9Q, 1OG5, 6WV3, 8HND, 2H11, 1GTH), CPIC Level A guideline content, verified rsIDs |
| E2E test coverage | ✅ 32/32 Node tests: parse → derive → trees → prove → verify → replay-reject → false-claim-reject → secret-binding |

**Honest demo boundaries** (also labeled in the app): synthetic patient files ship with the repo
(bring your own raw export to run on real data, fully offline); curator/issuer/prover run in one
browser for the demo (production splits lab / registry / patient); SNP arrays can't see CYP2D6 copy
number, HLA typing or UGT1A1 repeats — the UI says so instead of faking it. **NOT medical advice.**

---

## The 18 registered WebMCP tools

| tool | what the agent gets |
|------|---------------------|
| `parse_genomic_file` | scan the raw file **client-side**; public labels only (format, lines scanned, markers found) |
| `list_detected_markers` | coverage + gaps report: which pharmacogenes are tested / low-confidence / NOT covered by this file — no genotypes, no risk categories |
| `check_drug_safety(drugName)` | risk tier + CPIC-flavored advice, **only after a Groth16 proof verifies**. Warfarin = two proofs (CYP2C9 + VKORC1) |
| `generate_zk_proof(markerId, category?)` | real proof for a phenotype claim; a false category genuinely fails witness generation |
| `verify_zk_proof(claimId, proof, publicSignals)` | `groth16.verify` + single-use nullifier + claim reveal |
| `recommend_alternative(drugName)` | CPIC-flavored alternatives (or an honest "dose adjustment is a clinician decision") |
| `visualize_variant(gene)` | loads the real PDB structure into the 3D viewport + PK context |
| `highlight_catalytic_pocket(gene, color?)` | real-time 3D control: zoom & highlight the active site |
| `simulate_drug_docking(drugName, gene?)` | illustrative substrate-docking visual in 3D |
| `rotate_3d_view(angle, axis?)` | real-time camera control |
| `annotate_structure(text)` | pin an agent note on the viewport |
| `verify_patient_identity()` | session nonce + nullifier-registry freshness |
| `get_privacy_report()` | hard-number transparency + downloadable privacy receipt (ruleset version, what was checked/disclosed, how to independently verify) — 0 DNA letters released |
| `compare_two_drugs(drugA, drugB)` | head-to-head Groth16-proven verdicts + a bottom-line pick; non-gated drugs honestly flagged |
| `check_food_drug_interactions(drugName)` | curated food/diet interactions (grapefruit–statin, vitamin K–warfarin…) + genotype angle |
| `run_preop_panel(drugs?)` | medication scan / batch ZK-proven peri-operative panel — one consent, per-drug Groth16 proofs, plain-language answers; gene–drug scope stated honestly |
| `export_doctor_summary()` | doctor-ready, versioned handoff report: plain answers, coverage/gaps, ruleset version, downloadable file — built for the clinician review pathway |
| `revoke_session_consents()` | patient-control lever: lock the session to ask-every-time |

Registration is the standard WebMCP shape:

```js
document.modelContext.registerTool({
  name: "check_drug_safety",
  description: "Safety assessment using a Groth16 zk-SNARK proof (DNA never exposed)",
  inputSchema: { type: "object", properties: { drugName: { type: "string" } }, required: ["drugName"] },
  execute: async (input) => { /* generate + verify proof on-device, gated by patient consent */ }
});
```

---

## Architecture

```
┌────────────────────────────  YOUR BROWSER (everything happens here)  ───────────────────────────┐
│                                                                                                 │
│  raw DNA file ──► client parser (23andMe/AncestryDNA/VCF) ──► gene states ──► per-file secrets   │
│                                                                    │                            │
│                          ┌─────────────────────────────────────────┘                            │
│                          ▼                                                                      │
│   Poseidon Merkle trees (k=16, depth 4)  ◄── issuer EdDSA-Poseidon signature                    │
│                          │                                                                      │
│                          ▼                                                                      │
│   Circom circuit PgxMembershipV2 (8,845 constraints, bn128)                                     │
│   checks: Merkle membership + issuer sig + nullifier freshness                                  │
│                          │                                                                      │
│                          ▼                                                                      │
│   Groth16 proof (snarkjs, ~2 s) ──► verify ──► nullifier registry ──► verdict to agent          │
│                                                                                                 │
│   document.modelContext.registerTool(...) ×18  ◄── any WebMCP agent (ChatGPT browser, Chrome)    │
│   Human-in-the-loop consent gate on every release ──► audit ledger                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                    │ only this crosses the boundary ▼
        "unsafe for this patient — proof verified"   (zero genetic letters)
```

**Why WebMCP is the hero:** before WebMCP, a privacy-preserving tool like this had to ship as a
separate app the AI couldn't talk to. With WebMCP, *any* agent can discover and call the vault's
tools safely — and the vault decides, per-call, what (if anything) to release. The agent gets a
verified answer; the human keeps the keys and the consent.

## Independently verifying the proofs (don't trust our badge)

Every Groth16 artifact needed for third-party audit ships in this repo:

| Artifact | File |
|---|---|
| Compiled circuit (bn128, 8,845 constraints) | `pgx_membership_v2.wasm` |
| Proving key | `pgx_v2_final.zkey` |
| Verification key | `verification_key_v2.json` |
| On-chain verifiers (snarkjs-generated) | `Verifier.sol`, `ClaimVerificationGateway.sol` |

**What a proof attests** — and what it does not: the prover knows a secret
genotype leaf that (1) is a signed member of the published k=16 Poseidon Merkle
tree for claim `GENE__CATEGORY`, and (2) has not been spent before (single-use
nullifier). It does **not** attest that the uploaded file belongs to the person
uploading it, nor that the variant panel is clinically complete — the UI, tool
responses, and audit ledger say so explicitly.

**Verify without trusting our UI:**

1. Every proof's public signals are displayed in the app (HUD step 3 of 5) and
   returned by the `generate_zk_proof` tool.
2. CLI: `snarkjs groth16 verify verification_key_v2.json public_input.json proof.json`
3. On-chain: deploy `Verifier.sol` and call it with `(proof, publicSignals)` —
   verification math identical to the browser, zero trust in our frontend.
4. In-app, `verify_zk_proof` re-runs the pairing check independently and
   consumes the nullifier — replayed proofs are rejected and audit-logged.
5. Insufficient-data is a hard stop: no-call or missing markers return
   `no_confident_call` / `marker_absent` — the system refuses to fabricate a
   verdict from incomplete genomes (see `DEMO_PROMPTS.md` P6).

## FAQ

**Why can't I just paste my genotype into the chat instead of doing all this?**
You can — and that's exactly the thing GeneVault exists to prevent. The moment a raw genotype is
in a chat message, it's sitting in that provider's logs, training pipelines, or a screenshot,
forever, tied to your identity. A password can be rotated after a leak; a genome can't. GeneVault's
answer is that the agent never receives the genotype at all — only a proof that a claim about it is
true. Ask `get_privacy_report` at any time for the exact count of genetic values disclosed (it's
always zero).

**Is the zero-knowledge proof actually real, or is it a UI animation?**
It's real Groth16 over bn128, run by snarkjs, against a compiled 8,845-constraint Circom circuit
(`PgxMembershipV2`). You don't have to trust the app's badge — the compiled circuit, proving key,
verification key, and Solidity verifiers all ship in the repo, and the **Independently verifying
the proofs** section above gives you the exact CLI command to check a proof yourself, outside the
browser entirely.

**What does a proof actually prove — and what does it *not* prove?**
It proves the prover holds a genotype leaf that (1) is a signed member of the published Merkle tree
for a specific `GENE__CATEGORY` claim, and (2) hasn't been used before (single-use nullifier). It
does **not** prove the uploaded file belongs to the person uploading it, and it does not prove the
variant panel is clinically complete. Both limits are stated in-app, not just here.

**Can I make it lie — force a "safe" verdict for an unsafe genotype?**
No — that's what the **Forgery Audit** button is for. A non-member leaf fails witness generation
before a proof can even be constructed; there's no code path that produces a valid proof for a
false claim. Try it live rather than taking that on faith.

**What happens if I ask about a drug the panel doesn't cover, or upload a file with gaps?**
It refuses to guess. Missing or low-confidence markers return `no_confident_call` or
`marker_absent` instead of a fabricated verdict — see `list_detected_markers` and `DEMO_PROMPTS.md`
(P6) for the exact behavior.

**Does my DNA file get uploaded anywhere, ever?**
No. Parsing (23andMe / AncestryDNA raw text / VCF 4.x) happens client-side, in a single pass, and
the file never leaves the browser tab. Closing the tab clears it — there's no server-side storage
in this demo.

**Why does Warfarin need two proofs instead of one?**
Warfarin dosing genuinely depends on two independent genes — CYP2C9 (metabolism) and VKORC1
(sensitivity) — so a single-gene proof would be an honest-sounding but incomplete answer. The app
runs and verifies both before returning a verdict; ask it directly which two genes it used.

**Is this trained on or connected to a real EHR / real patients?**
No. The demo ships with synthetic patient files, and the curator/issuer/prover all run in one
browser for the sake of the demo. The README and in-app UI both say so — production would split
those three roles across a lab, a registry, and the patient's device.

**Can this replace a doctor or genetic counselor?**
No, and it says so on every relevant screen. It's a demonstration of privacy-preserving querying,
not a diagnostic or prescribing tool. See the disclaimer at the bottom of this file.

**Does this only work in ChatGPT's browser / Chrome 149+?**
Real WebMCP calls need one of those. Everywhere else — including most current Chrome versions and
other browsers — the app runs an identical, honestly-labeled local fallback so the full demo still
works; it just isn't being driven by an external agent over WebMCP.

---

## Run it

```bash
python3 -m http.server 8000
# open http://localhost:8000/genevault.html
```

Optional Node end-to-end test (32 checks):

```bash
npm install
npm test
```

## Files

| file | role |
|------|------|
| `index.html` | landing page for humans (the 20-second pitch) |
| `genevault.html` | the app (layout + panels + HUD + consent gate) |
| `app.js` | app logic: 18 WebMCP tools, consent engine, 3D, charts, agent demos |
| `pgx_core.js` | verified 9-gene panel, parser, phenotypes, secret derivation (Node/browser) |
| `zk_core.js` | crypto core: prover/verifier engines, Merkle builder, nullifier registry |
| `pgx_membership_v2.wasm` / `pgx_v2_final.zkey` / `verification_key_v2.json` | compiled circuit artifacts |
| `Verifier.sol` / `ClaimVerificationGateway.sol` | on-chain verifier + root-publishing gateway (production path) |
| `sample_genome_23andme.txt` | SYNTHETIC test file (clearly fake data) |
| `test_v3_full.js` | Node end-to-end suite (32 checks) |
| `screenshots/` | live captures used by the landing page |

## Deploy (any static host, HTTPS required for WebMCP)

```bash
# Netlify (fastest): drag-and-drop this folder at https://app.netlify.com/drop
# Vercel:  npx vercel deploy --prod
# GitHub Pages: push to a repo → Settings → Pages → deploy from branch
# Cloudflare Pages: connect repo → build cmd: (none) → output dir: /
```

---

**NOT MEDICAL ADVICE.** Demonstration of privacy-preserving pharmacogenomic querying. Consult a
physician, pharmacist, or genetic counselor for real decisions.

Licensed under MIT — see `LICENSE`.
