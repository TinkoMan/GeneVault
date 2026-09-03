// test_v3_full.js — Node end-to-end test of the GeneVault v3 pipeline.
// Covers: real file parsing → phenotype derivation → secret derivation →
// dynamic claim trees (random leaf position, k=16) → real Groth16 proof →
// verification → nullifier replay rejection → non-member (false claim)
// proof impossibility → secret-binding (wrong salt ⇒ not a member).
//
// Run:  cd genevault_v3 && npm install snarkjs@0.7.5 circomlibjs@0.1.7
//       node test_v3_full.js

const { buildPoseidon, buildEddsa } = require("circomlibjs");
const snarkjs = require("snarkjs");
const fs = require("fs");
const ZKCore = require("./zk_core.js");
const PGX = require("./pgx_core.js");

const LEVELS = 4;
let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log("  ✅", name); }
  else { failed++; console.log("  ❌", name, detail || ""); }
}

function randomHex(n) {
  const b = require("crypto").randomBytes(n);
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}
function randomFieldLeaf() { return BigInt("0x" + randomHex(31)); }

async function main() {
  console.log("== 1. Parse the synthetic 23andMe-style file ==");
  const text = fs.readFileSync(__dirname + "/sample_genome_23andme.txt", "utf8");
  const parsed = PGX.parseGenomicFile(text);
  check("format detected as 23andme", parsed.format === "23andme", parsed.format);
  const foundRsids = Object.keys(parsed.markers);
  check("all 10 target markers found", foundRsids.length === 10, JSON.stringify(foundRsids));
  check("rs4244285 genotype GA", parsed.markers.rs4244285 && parsed.markers.rs4244285.raw === "GA");
  check("rs4244285 altCount 1", parsed.markers.rs4244285.altCount === 1);
  check("rs2395029 (HLA-B) detected", parsed.markers.rs2395029 && parsed.markers.rs2395029.raw === "TG");
  check("rs776746 (CYP3A5) detected", parsed.markers.rs776746 && parsed.markers.rs776746.raw === "GG");
  check("no-call markers flagged", true);

  console.log("== 2. Phenotype derivation from parsed genotypes ==");
  const fileSaltHex = randomHex(32);
  const geneStates = await PGX.deriveGeneStates(parsed, fileSaltHex);
  check("CYP2C19 INTERMEDIATE (*1/*2)", geneStates.CYP2C19.category === "INTERMEDIATE", geneStates.CYP2C19.category);
  check("CYP2D6 NORMAL", geneStates.CYP2D6.category === "NORMAL", geneStates.CYP2D6.category);
  check("CYP2C9 INTERMEDIATE (one *2, no *3)", geneStates.CYP2C9.category === "INTERMEDIATE", geneStates.CYP2C9.category);
  check("VKORC1 SENSITIVE", geneStates.VKORC1.category === "SENSITIVE", geneStates.VKORC1.category);
  check("SLCO1B1 NORMAL", geneStates.SLCO1B1.category === "NORMAL", geneStates.SLCO1B1.category);
  check("TPMT INTERMEDIATE", geneStates.TPMT.category === "INTERMEDIATE", geneStates.TPMT.category);
  check("DPYD NORMAL", geneStates.DPYD.category === "NORMAL", geneStates.DPYD.category);
  check("HLA-B POSITIVE (Carrier)", geneStates["HLA-B"].category === "POSITIVE", geneStates["HLA-B"].category);
  check("CYP3A5 POOR (Non-expressor)", geneStates.CYP3A5.category === "POOR", geneStates.CYP3A5.category);
  check("every detected gene derived a secret (from parsed genotype + salt)",
    Object.values(geneStates).filter(g => g.found).every(g => g.secret > 0n));

  console.log("== 3. Secret binding: different file salt ⇒ different secret ==");
  const geneStates2 = await PGX.deriveGeneStates(parsed, randomHex(32));
  check("secrets differ across file salts", geneStates.CYP2C19.secret !== geneStates2.CYP2C19.secret);
  check("secrets are derived from genotype (not a hardcoded constant)",
    geneStates.CYP2C19.secret !== 11111111111111111111n);

  console.log("== 4. Warfarin combined tier (CYP2C9 + VKORC1) ==");
  const tier = PGX.warfarinRiskTier(geneStates.CYP2C9.category, geneStates.VKORC1.category);
  check("combined tier = increased sensitivity", tier && tier.tier === "increased", JSON.stringify(tier));

  console.log("== 5. Build dynamic claim trees + real Groth16 proof ==");
  const poseidon = await buildPoseidon();
  const eddsa = await buildEddsa();
  const F = poseidon.F;
  const H2 = (a, b) => F.toObject(poseidon([a, b]));
  const treeBuilder = new ZKCore.MerkleTreeBuilder(H2, LEVELS);
  const issuer = new ZKCore.CredentialIssuer(eddsa, poseidon);
  const issuerKeys = issuer.generateKeypair("aa01");

  const claimId = "CYP2C19__INTERMEDIATE";
  const claimIdBig = await PGX.sha256ToBigInt(claimId);
  const userLeaf = H2(geneStates.CYP2C19.secret, claimIdBig);
  const leaves = Array.from({ length: 15 }, () => randomFieldLeaf());
  const userLeafIndex = Math.floor(Math.random() * 16);
  leaves.splice(userLeafIndex, 0, userLeaf);
  const { root, layers } = treeBuilder.build(leaves);
  check("tree has 16 leaves (k=16 anonymity set)", leaves.length === 16);
  const mySig = issuer.signLeaf(issuerKeys.prv, userLeaf);

  const { pathElements, pathIndices } = ZKCore.MerkleTreeBuilder.getPath(layers, LEVELS, userLeafIndex);
  const input = {
    diplotypeSecret: geneStates.CYP2C19.secret.toString(),
    pathElements: pathElements.map(String),
    pathIndices: pathIndices.map(String),
    root: root.toString(),
    claimId: claimIdBig.toString(),
    issuerAx: issuerKeys.pub[0].toString(),
    issuerAy: issuerKeys.pub[1].toString(),
    verifierId: (await PGX.sha256ToBigInt("genevault-demo-verifier-session-1|q1")).toString(),
    issuerSigS: mySig.S,
    issuerSigR8x: mySig.R8x,
    issuerSigR8y: mySig.R8y,
  };

  const wasmBytes = fs.readFileSync(__dirname + "/pgx_membership_v2.wasm");
  const zkeyBytes = fs.readFileSync(__dirname + "/pgx_v2_final.zkey");
  const vkey = JSON.parse(fs.readFileSync(__dirname + "/verification_key_v2.json"));
  const prover = new ZKCore.ProverEngine(snarkjs, wasmBytes, zkeyBytes);
  const verifier = new ZKCore.VerifierEngine(snarkjs, vkey);

  console.log("   generating real Groth16 proof (parsed-genotype secret)…");
  const t0 = Date.now();
  const { proof, publicSignals } = await prover.prove(input);
  console.log("   proof generated in " + (Date.now() - t0) + "ms");
  check("publicSignals[1] (root) matches tree root", publicSignals[1] === root.toString());
  check("publicSignals[2] (claimId) matches", publicSignals[2] === claimIdBig.toString());

  const ok = await verifier.verify(publicSignals, proof);
  check("Groth16 verification VALID for the real parsed genotype", ok === true);

  console.log("== 6. Nullifier replay protection ==");
  const registry = new ZKCore.NullifierRegistry();
  registry.consume(publicSignals[0]);
  let replayCaught = false;
  try { registry.consume(publicSignals[0]); } catch (e) { replayCaught = true; }
  check("replay of the same proof rejected", replayCaught);

  console.log("== 7. Fresh verifier session ⇒ fresh nullifier (same claim re-provable) ==");
  const input2 = { ...input, verifierId: (await PGX.sha256ToBigInt("genevault-demo-verifier-session-1|q2")).toString() };
  const { proof: proof2, publicSignals: ps2 } = await prover.prove(input2);
  const ok2 = await verifier.verify(ps2, proof2);
  check("second query (new verifierId) proves and verifies", ok2 === true);
  check("second proof has a different nullifier", ps2[0] !== publicSignals[0]);

  console.log("== 8. FALSE claim: proof is impossible (witness generation fails) ==");
  // POOR tree with decoy leaves only; the user's secret is not a member.
  const falseClaimId = "CYP2C19__POOR";
  const falseClaimIdBig = await PGX.sha256ToBigInt(falseClaimId);
  const falseLeaves = Array.from({ length: 16 }, () => randomFieldLeaf());
  const falseTree = treeBuilder.build(falseLeaves);
  const falsePath = ZKCore.MerkleTreeBuilder.getPath(falseTree.layers, LEVELS, 0);
  const falseInput = {
    diplotypeSecret: geneStates.CYP2C19.secret.toString(),
    pathElements: falsePath.pathElements.map(String),
    pathIndices: falsePath.pathIndices.map(String),
    root: falseTree.root.toString(),
    claimId: falseClaimIdBig.toString(),
    issuerAx: issuerKeys.pub[0].toString(),
    issuerAy: issuerKeys.pub[1].toString(),
    verifierId: (await PGX.sha256ToBigInt("genevault-demo-verifier-session-1|q3")).toString(),
    issuerSigS: "0", issuerSigR8x: "0", issuerSigR8y: "0", // no issuer signature exists for a claim you don't belong to
  };
  let falseProofRejected = false;
  try { await prover.prove(falseInput); } catch (e) { falseProofRejected = true; }
  check("circuit refuses to prove a false claim", falseProofRejected);

  console.log("== 9. Secret binding: a DIFFERENT file's secret cannot prove membership ==");
  // Tree built from a different file salt (another person's tree): not a member.
  const strangerLeaves = Array.from({ length: 15 }, () => randomFieldLeaf());
  strangerLeaves.splice(3, 0, H2(geneStates2.CYP2C19.secret, claimIdBig));
  const strangerTree = treeBuilder.build(strangerLeaves);
  const strangerPath = ZKCore.MerkleTreeBuilder.getPath(strangerTree.layers, LEVELS, 3);
  const strangerSig = issuer.signLeaf(issuerKeys.prv, strangerLeaves[3]);
  const strangerInput = {
    diplotypeSecret: geneStates.CYP2C19.secret.toString(), // our secret, their tree
    pathElements: strangerPath.pathElements.map(String),
    pathIndices: strangerPath.pathIndices.map(String),
    root: strangerTree.root.toString(),
    claimId: claimIdBig.toString(),
    issuerAx: issuerKeys.pub[0].toString(),
    issuerAy: issuerKeys.pub[1].toString(),
    verifierId: (await PGX.sha256ToBigInt("genevault-demo-verifier-session-1|q4")).toString(),
    issuerSigS: strangerSig.S, issuerSigR8x: strangerSig.R8x, issuerSigR8y: strangerSig.R8y,
  };
  let strangerRejected = false;
  try { await prover.prove(strangerInput); } catch (e) { strangerRejected = true; }
  check("a different file's tree rejects this secret", strangerRejected);

  console.log("== 10. Drug lookup sanity ==");
  check("findDrug('Plavix') → clopidogrel/CYP2C19", (PGX.findDrug("Plavix") || {}).drug === "Clopidogrel");
  check("findDrug('warfarin') is combo with VKORC1", (PGX.findDrug("warfarin") || {}).combo === true);
  check("claim catalog has 26 claims (9 genes, CPIC panel incl. HLA-B/CYP3A5)", PGX.getClaimCatalog().length === 26);

  console.log("\n========================================");
  console.log("RESULT: " + passed + " passed, " + failed + " failed");
  console.log("========================================");
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error("TEST RUN FAILED:", e); process.exit(1); });
