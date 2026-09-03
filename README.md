# GeneVault — Your AI can check your DNA without ever seeing it 🔐🧬

**Privacy-preserving pharmacogenomics with WebMCP + real Groth16 zero-knowledge proofs.**
The browser proves drug safety to an AI agent with mathematical certainty — the genetic file never leaves the device.

> **The 20-second version:** For ~30% of people, the common blood thinner clopidogrel (Plavix) doesn't work — the first sign can be a fatal clot. Guidelines say *check the patient's genetics first*. But nobody should upload their DNA to an AI or cloud: you can change a leaked password, never your genome. **GeneVault registers 12 tools on `document.modelContext` so any AI agent can ask the browser directly — and the browser answers with a Groth16 zk-SNARK proof, not with your DNA.**

---

## ⚡ Judge quickstart (60 seconds, no API key, no signup)

```bash
# 1. Serve the folder (required: file:// cannot fetch the circuit artifacts)
python3 -m http.server 8000
# 2. Open http://localhost:8000/            ← landing page
#    Open http://localhost:8000/genevault.html  ← the app
# 3. Click  "Run Full Agent Demo"
```

One click — the in-page AI agent **asks its own questions** and executes **7 WebMCP tools end-to-end**:

```
parse_genomic_file → list_detected_markers → check_drug_safety(Plavix)
   → recommend_alternative(Plavix) → generate_zk_proof(CYP2C19) → verify_zk_proof(...)
```

Watch the **WebMCP Agent Runtime HUD** (bottom-right), the **3D DNA helix** re-orienting live, and the
**human-in-the-loop consent gate** controlling every release. Then try the **Forgery Audit** button and
watch the R1CS circuit *mathematically refuse* to prove a false claim.

**Testing with a real external agent:** open the hosted URL in **ChatGPT's in-app browser** (supports
WebMCP natively) or **Chrome 149+** with `chrome://flags/#enable-webmcp-testing` → *Enabled* → relaunch.
The status pill turns green: `WebMCP: 12/12 Active`. Without WebMCP support the app runs an identical,
honestly-labeled local fallback — the full demo still works.

> 💡 No Gemini API key is needed for judging. The optional in-page chat asks for your own key
> (sent as a `x-goog-api-key` **request header**, memory-only, never stored) — everything else is keyless.

---

## What's actually real

| Layer | Status |
|---|---|
| WebMCP registration | ✅ Real `document.modelContext.registerTool()` × 12 tools, verified via `getTools()`, `AbortController` cleanup |
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

## The 12 registered WebMCP tools

| tool | what the agent gets |
|------|---------------------|
| `parse_genomic_file` | scan the raw file **client-side**; public labels only (format, lines scanned, markers found) |
| `list_detected_markers` | which pharmacogenes are present — no genotypes, no risk categories |
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
│   document.modelContext.registerTool(...) ×12  ◄── any WebMCP agent (ChatGPT browser, Chrome)   │
│   Human-in-the-loop consent gate on every release ──► audit ledger                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                    │ only this crosses the boundary ▼
        "unsafe for this patient — proof verified"   (zero genetic letters)
```

**Why WebMCP is the hero:** before WebMCP, a privacy-preserving tool like this had to ship as a
separate app the AI couldn't talk to. With WebMCP, *any* agent can discover and call the vault's
tools safely — and the vault decides, per-call, what (if anything) to release. The agent gets a
verified answer; the human keeps the keys and the consent.

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
| `app.js` | app logic: 12 WebMCP tools, consent engine, 3D, charts, agent demos |
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
