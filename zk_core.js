// zk_core.js
// Object-oriented core for the ZK credential system.
// Works in both Node (require) and browser (window.ZKCore) without a bundler
// -- see the export shim at the bottom.

// ---------------------------------------------------------------------------
// MerkleTreeBuilder -- pure math, no crypto-library dependency beyond a
// caller-supplied Poseidon hash function.
// ---------------------------------------------------------------------------
class MerkleTreeBuilder {
  constructor(hash2, levels) {
    this.hash2 = hash2;   // (a, b) => bigint
    this.levels = levels;
  }

  build(leaves) {
    const total = 2 ** this.levels;
    if (leaves.length > total) throw new Error(`too many leaves for ${this.levels} levels`);
    while (leaves.length < total) leaves.push(this._randomFiller());

    let layers = [leaves];
    for (let l = 0; l < this.levels; l++) {
      const prev = layers[layers.length - 1];
      const next = [];
      for (let i = 0; i < prev.length; i += 2) next.push(this.hash2(prev[i], prev[i + 1]));
      layers.push(next);
    }
    return { root: layers[this.levels][0], layers };
  }

  static getPath(layers, levels, index) {
    const pathElements = [], pathIndices = [];
    let idx = index;
    for (let l = 0; l < levels; l++) {
      const layer = layers[l];
      const isRight = idx % 2;
      pathElements.push(isRight ? layer[idx - 1] : layer[idx + 1]);
      pathIndices.push(isRight);
      idx = Math.floor(idx / 2);
    }
    return { pathElements, pathIndices };
  }

  _randomFiller() {
    const bytes = (typeof crypto !== "undefined" && crypto.getRandomValues)
      ? crypto.getRandomValues(new Uint8Array(16))
      : require("crypto").randomBytes(16);
    return BigInt("0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(""));
  }
}

// ---------------------------------------------------------------------------
// Claim hierarchy -- each Claim subclass describes ONE public, non-secret
// clinical/eligibility category. Adding a new domain (age, credit tier, ...)
// means writing one small subclass, not touching the crypto engine.
// ---------------------------------------------------------------------------
class Claim {
  constructor({ id, label }) {
    if (new.target === Claim) throw new Error("Claim is abstract");
    this.id = id;       // stable string, e.g. "CYP2C19__POOR"
    this.label = label; // human-readable, safe to show anyone
  }
  // Public descriptor -- everything here is safe to hand to an LLM or a verifier.
  toPublic() {
    return { id: this.id, label: this.label, kind: this.constructor.name };
  }
  // Subclasses override to add their own public, non-secret fields to reveal
  // once a proof for this claim has been verified.
  revealOnVerified() {
    return this.toPublic();
  }
}

class GenomicRiskClaim extends Claim {
  constructor({ id, gene, drug, riskCategory, clearanceDelta, clinicalRecommendation }) {
    super({ id, label: `${gene} / ${drug}` });
    this.gene = gene;
    this.drug = drug;
    this.riskCategory = riskCategory;
    this.clearanceDelta = clearanceDelta;
    this.clinicalRecommendation = clinicalRecommendation;
  }
  revealOnVerified() {
    return { ...this.toPublic(), gene: this.gene, drug: this.drug,
      riskCategory: this.riskCategory, clinicalRecommendation: this.clinicalRecommendation };
  }
}

// Second domain -- demonstrates the architecture generalizes beyond genomics
// using the identical Merkle-membership circuit and prover/verifier engines.
class AgeEligibilityClaim extends Claim {
  constructor({ id, minAge, jurisdiction }) {
    super({ id, label: `Age >= ${minAge} (${jurisdiction})` });
    this.minAge = minAge;
    this.jurisdiction = jurisdiction;
  }
  revealOnVerified() {
    return { ...this.toPublic(), minAge: this.minAge, jurisdiction: this.jurisdiction };
  }
}

// ---------------------------------------------------------------------------
// CredentialIssuer -- the party that attests a secret is genuine (e.g. a lab).
// Deliberately separate from the prover: in production this runs on a
// different machine entirely and never sees the prover's browser session.
// ---------------------------------------------------------------------------
class CredentialIssuer {
  constructor(eddsa, poseidon) {
    this.eddsa = eddsa;
    this.poseidon = poseidon;
    this.F = poseidon.F;
  }

  // Convert a hex string (with optional 0x prefix) to Uint8Array.
  _hexToBytes(hex) {
    hex = hex.replace(/^0x/, '');
    if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i/2] = parseInt(hex.slice(i, i+2), 16);
    }
    return bytes;
  }

  generateKeypair(seedHex) {
    // Pad to 64 hex chars (32 bytes)
    const padded = seedHex.padEnd(64, "0").slice(0, 64);
    const prv = this._hexToBytes(padded);
    const pub = this.eddsa.prv2pub(prv);
    return { prv, pub: [this.F.toObject(pub[0]), this.F.toObject(pub[1])] };
  }

  // Signs the LEAF value (Poseidon(secret, claimId)), never the raw secret
  // itself and never anything containing patient-identifying data.
  signLeaf(prv, leafBig) {
    const msg = this.F.e(leafBig);
    const sig = this.eddsa.signPoseidon(prv, msg);
    return {
      S: sig.S.toString(),
      R8x: this.F.toObject(sig.R8[0]).toString(),
      R8y: this.F.toObject(sig.R8[1]).toString(),
    };
  }
}

// ---------------------------------------------------------------------------
// ProverEngine / VerifierEngine -- thin wrappers around snarkjs. Swapping
// Groth16 for Plonk later means changing these two classes only.
// ---------------------------------------------------------------------------
class ProverEngine {
  constructor(snarkjsRef, wasmBytes, zkeyBytes) {
    this.snarkjs = snarkjsRef;
    this.wasmBytes = wasmBytes;
    this.zkeyBytes = zkeyBytes;
  }
  async prove(input) {
    return this.snarkjs.groth16.fullProve(input, this.wasmBytes, this.zkeyBytes);
  }
}

class VerifierEngine {
  constructor(snarkjsRef, vkey) {
    this.snarkjs = snarkjsRef;
    this.vkey = vkey;
  }
  async verify(publicSignals, proof) {
    return this.snarkjs.groth16.verify(this.vkey, publicSignals, proof);
  }
}

// ---------------------------------------------------------------------------
// NullifierRegistry -- local stand-in for the on-chain registry. Same
// interface either way, so swapping to a contract call later is a one-line
// change at the call site, not a redesign.
// ---------------------------------------------------------------------------
class NullifierRegistry {
  constructor() { this.used = new Set(); }
  isUsed(nullifierHash) { return this.used.has(String(nullifierHash)); }
  consume(nullifierHash) {
    const key = String(nullifierHash);
    if (this.used.has(key)) throw new Error("Nullifier already used -- proof replay rejected");
    this.used.add(key);
    return true;
  }
}

// ---------------------------------------------------------------------------
// AgentOrchestrator -- owns the LLM tool-calling loop, decoupled from any
// specific Claim type or crypto engine. Its job is ONLY interpretation and
// routing (matching what the user/agent wants against registered tools) --
// it never makes a trust decision itself. See toolRegistry for the actual
// tool implementations, injected by the caller.
//
// SECURITY v3: the API key is now sent in the `x-goog-api-key` request
// HEADER, not in the URL query string (URLs leak into browser history,
// proxies, and server logs).
// ---------------------------------------------------------------------------
class AgentOrchestrator {
  constructor({ apiKeyProvider, modelId, systemInstruction, functionDeclarations, toolRegistry, onEvent, maxToolTurns = 8 }) {
    this.apiKeyProvider = apiKeyProvider;
    this.modelId = modelId;
    this.systemInstruction = systemInstruction;
    this.functionDeclarations = functionDeclarations;
    this.toolRegistry = toolRegistry; // { toolName: async (args) => result }
    this.onEvent = onEvent || (() => {});
    this.maxToolTurns = maxToolTurns;
    this.history = [];
  }

  async send(prompt) {
    this.history.push({ role: "user", parts: [{ text: prompt }] });
    return this._turn(0);
  }

  async _turn(depth) {
    if (depth >= this.maxToolTurns) {
      this.onEvent({ type: "halted", reason: "max_tool_turns" });
      return;
    }
    const apiKey = this.apiKeyProvider();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent`;
    const payload = {
      contents: this.history,
      systemInstruction: { parts: [{ text: this.systemInstruction }] },
      tools: [{ functionDeclarations: this.functionDeclarations }]
    };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("No response candidate returned.");
    const modelMessage = candidate.content;
    this.history.push(modelMessage);

    const calls = modelMessage.parts?.filter(p => p.functionCall) || [];
    if (calls.length > 0) {
      const responseParts = [];
      for (const call of calls) {
        const { name, args } = call.functionCall;
        this.onEvent({ type: "tool_call", name, args });
        let result = { status: "error", message: "Tool not found" };
        if (this.toolRegistry[name]) {
          try { result = await this.toolRegistry[name](args || {}); }
          catch (e) { result = { status: "error", message: e.message }; }
        }
        this.onEvent({ type: "tool_result", name, result });
        responseParts.push({ functionResponse: { name, response: { output: result } } });
      }
      this.history.push({ role: "user", parts: responseParts });
      return this._turn(depth + 1);
    }
    const text = modelMessage.parts?.filter(p => p.text && !p.thought).map(p => p.text).join("\n") || "";
    this.onEvent({ type: "final_text", text });
    return text;
  }
}

// ---------------------------------------------------------------------------
// Export shim: Node (module.exports) and browser (window.ZKCore) both work.
// ---------------------------------------------------------------------------
const ZKCore = {
  MerkleTreeBuilder, Claim, GenomicRiskClaim, AgeEligibilityClaim,
  CredentialIssuer, ProverEngine, VerifierEngine, NullifierRegistry, AgentOrchestrator
};
if (typeof module !== "undefined" && module.exports) module.exports = ZKCore;
if (typeof window !== "undefined") window.ZKCore = ZKCore;
