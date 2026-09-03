// pgx_core.js
// Pharmacogenomics core for GeneVault: verified gene/variant panel, client-side
// raw-genotype file parser (23andMe / AncestryDNA / VCF), phenotype mapping,
// and secret derivation from the REAL parsed genotype.
//
// Data policy: every gene/variant/rsID entry in PGX_PANEL was verified against
// CPIC guideline records and PharmGKB/NCBI before inclusion. No invented rsIDs.
// No file contents ever leave this module — parsing is 100% local.
//
// Works in Node (require) and browser (window.PGXCore) — same shim pattern as zk_core.js.

// ---------------------------------------------------------------------------
// sha256 → BigInt (truncated to 120 bits: safely below the bn128 scalar field
// order r ≈ 2^254, so it is a valid Poseidon/circuit input).
// ---------------------------------------------------------------------------
async function sha256ToBigInt(str) {
  const hex = await _sha256Hex(str);
  return BigInt("0x" + hex.slice(0, 30)); // 120 bits of entropy
}

async function _sha256Hex(str) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Node fallback
  const nodeCrypto = require("crypto");
  return nodeCrypto.createHash("sha256").update(str).digest("hex");
}

// ---------------------------------------------------------------------------
// Verified panel — 7 gene rows, 8 markers (CYP2C9 carries two).
// "activity" is the CPIC-grounded relative activity/clearance fraction used by
// the illustrative PK chart (1.0 = normal). It is NOT an individual prediction.
// ---------------------------------------------------------------------------
const PGX_PANEL = [
  {
    gene: "CYP2C19", protein: "Cytochrome P450 2C19", kind: "enzyme",
    pdb: { id: "4GQS", organism: "Homo sapiens", note: "X-ray structure of human microsomal CYP2C19; heme cofactor highlighted at the active site." },
    markers: [
      { rsid: "rs4244285", alleleName: "CYP2C19*2", change: "c.681G>A", ref: "G", alt: "A" },
    ],
    categories: [
      { key: "NORMAL",       label: "Normal Metabolizer",       diplotype: "*1/*1", altCount: 0, activity: 1.00 },
      { key: "INTERMEDIATE", label: "Intermediate Metabolizer", diplotype: "*1/*2", altCount: 1, activity: 0.65 },
      { key: "POOR",         label: "Poor Metabolizer",         diplotype: "*2/*2", altCount: 2, activity: 0.30 },
    ],
    drugs: [
      {
        name: "Clopidogrel", aliases: ["plavix"],
        adviceByCategory: {
          NORMAL:       { risk: "standard",             text: "CPIC Level A: normal clopidogrel activation expected; standard dosing, no genotype-based change indicated." },
          INTERMEDIATE: { risk: "reduced_efficacy",     text: "CPIC Level A: reduced conversion to the active metabolite; consider an alternative antiplatelet (ticagrelor or prasugrel), especially for ACS/PCI." },
          POOR:         { risk: "major_loss_of_efficacy", text: "CPIC Level A (strong): avoid clopidogrel — little to no active metabolite is formed. Use ticagrelor or prasugrel when clinically appropriate." },
        },
        alternatives: ["Ticagrelor", "Prasugrel"],
        alternativeNote: "CPIC recommends alternative antiplatelet therapy (ticagrelor or prasugrel) for poor metabolizers; aspirin monotherapy is a clinician decision.",
      },
    ],
    limitation: null,
  },
  {
    gene: "CYP2D6", protein: "Cytochrome P450 2D6", kind: "enzyme",
    pdb: { id: "2F9Q", organism: "Homo sapiens", note: "X-ray structure of human CYP2D6 (3.0 Å); heme cofactor highlighted at the active site." },
    markers: [
      { rsid: "rs3892097", alleleName: "CYP2D6*4", change: "c.1846G>A", ref: "G", alt: "A" },
    ],
    categories: [
      { key: "NORMAL",  label: "No *4 detected (*1/*1-like)",   diplotype: "*1/*1", altCount: 0, activity: 1.00 },
      { key: "REDUCED", label: "One *4 allele (*1/*4)",         diplotype: "*1/*4", altCount: 1, activity: 0.50 },
      { key: "POOR",    label: "Two *4 alleles (*4/*4)",        diplotype: "*4/*4", altCount: 2, activity: 0.15 },
    ],
    drugs: [
      {
        name: "Codeine", aliases: [],
        adviceByCategory: {
          NORMAL:  { risk: "standard",         text: "This single marker shows no *4; normal conversion of codeine to morphine is expected (subject to the CYP2D6 caveat below)." },
          REDUCED: { risk: "reduced_efficacy", text: "CPIC: reduced codeine activation; little analgesic benefit expected. Avoid codeine; use an alternative analgesic." },
          POOR:    { risk: "no_efficacy",      text: "CPIC: avoid codeine — negligible conversion to morphine. Choose a non-CYP2D6-dependent analgesic." },
        },
        alternatives: ["Morphine (direct-acting opioid)", "Non-opioid analgesics (e.g. NSAIDs, per clinical assessment)"],
        alternativeNote: "CPIC recommends avoiding codeine in poor/intermediate metabolizers; tramadol and hydrocodone also depend on CYP2D6 activation.",
      },
    ],
    limitation: "HONEST CAVEAT: this single SNP cannot determine full CYP2D6 phenotype. Real CYP2D6 activity also depends on copy-number variation and additional alleles that SNP-array files cannot capture — this result is one input, not a phenotype call.",
  },
  {
    gene: "CYP2C9", protein: "Cytochrome P450 2C9", kind: "enzyme",
    pdb: { id: "1OG5", organism: "Homo sapiens", note: "X-ray structure of human CYP2C9 in complex with (S)-warfarin; heme + warfarin highlighted." },
    markers: [
      { rsid: "rs1799853", alleleName: "CYP2C9*2", change: "c.430C>T", ref: "C", alt: "T" },
      { rsid: "rs1057910", alleleName: "CYP2C9*3", change: "c.1075A>C", ref: "A", alt: "C" },
    ],
    categories: [
      { key: "NORMAL",       label: "Normal Metabolizer (*1/*1)",    diplotype: "*1/*1", altCount: 0, activity: 1.00 },
      { key: "INTERMEDIATE", label: "Intermediate Metabolizer",      diplotype: "*1/*2 or *1/*3", altCount: 1, activity: 0.60 },
      { key: "POOR",         label: "Poor Metabolizer (*2/*2, *2/*3, *3/*3)", diplotype: "*2/*2, *2/*3, *3/*3", altCount: 2, activity: 0.25 },
    ],
    drugs: [
      {
        name: "Warfarin", aliases: ["coumadin", "jantoven"], combo: true, comboPartner: "VKORC1",
        adviceByCategory: {}, // warfarin advice is computed from BOTH genes (CYP2C9 + VKORC1) — see warfarinRiskTier()
        alternatives: [],
        alternativeNote: "Warfarin is dose-adjusted rather than replaced; reduced starting dose (~30-50%) and intensified INR monitoring per CPIC, or a direct oral anticoagulant if clinically appropriate (clinician decision).",
      },
    ],
    limitation: null,
  },
  {
    gene: "VKORC1", protein: "Vitamin K epoxide reductase complex subunit 1", kind: "enzyme",
    pdb: { id: "6WV3", organism: "Homo sapiens", note: "X-ray structure of human VKOR in complex with warfarin (GFP-fusion construct; the VKORC1 body is residues 143-295 of chain A). Warfarin highlighted in the binding site." },
    markers: [
      { rsid: "rs9923231", alleleName: "VKORC1 -1639G>A", change: "c.-1639G>A (promoter)", ref: "G", alt: "A" },
    ],
    categories: [
      { key: "STANDARD",         label: "Standard sensitivity (GG)",         diplotype: "GG", altCount: 0, activity: 1.00 },
      { key: "SENSITIVE",        label: "Increased sensitivity (GA)",        diplotype: "GA", altCount: 1, activity: 0.65 },
      { key: "HIGHLY_SENSITIVE", label: "Highly sensitive (AA)",             diplotype: "AA", altCount: 2, activity: 0.45 },
    ],
    drugs: [
      {
        name: "Warfarin", aliases: ["coumadin"], combo: true, comboPartner: "CYP2C9",
        adviceByCategory: {}, // see warfarinRiskTier()
        alternatives: [],
        alternativeNote: "See CYP2C9 entry — warfarin advice combines both genes.",
      },
    ],
    limitation: null,
  },
  {
    gene: "SLCO1B1", protein: "OATP1B1 hepatic uptake transporter", kind: "transporter",
    pdb: { id: "8HND", organism: "Homo sapiens", note: "Cryo-EM structure of human OATP1B1 in complex with estrone-3-sulfate (2023). The c.521T>C (*5) variant impairs hepatic statin uptake, raising systemic exposure." },
    markers: [
      { rsid: "rs4149056", alleleName: "SLCO1B1*5", change: "c.521T>C", ref: "T", alt: "C" },
    ],
    categories: [
      { key: "NORMAL",        label: "Normal transporter function (*1/*1)", diplotype: "*1/*1", altCount: 0, activity: 1.00 },
      { key: "REDUCED",       label: "Reduced function (*1/*5)",            diplotype: "*1/*5", altCount: 1, activity: 0.55 },
      { key: "POOR_FUNCTION", label: "Poor function (*5/*5)",               diplotype: "*5/*5", altCount: 2, activity: 0.35 },
    ],
    drugs: [
      {
        name: "Simvastatin", aliases: ["zocor"],
        adviceByCategory: {
          NORMAL:        { risk: "standard",     text: "CPIC Level A: normal OATP1B1 function; standard simvastatin dosing with routine myopathy counseling." },
          REDUCED:       { risk: "myopathy_risk", text: "CPIC Level A: higher simvastatin systemic exposure — limit dose (e.g. ≤20 mg/day or lower per CPIC) and consider rosuvastatin or pravastatin; counsel on myopathy symptoms." },
          POOR_FUNCTION: { risk: "high_myopathy_risk", text: "CPIC Level A: markedly elevated exposure — use low simvastatin doses or an alternative statin (rosuvastatin/pravastatin) or non-statin therapy." },
        },
        alternatives: ["Rosuvastatin", "Pravastatin", "Ezetimibe (non-statin)"],
        alternativeNote: "CPIC recommends considering statins less dependent on OATP1B1 uptake (rosuvastatin, pravastatin) or non-statin lipid-lowering therapy.",
      },
    ],
    limitation: null,
  },
  {
    gene: "TPMT", protein: "Thiopurine S-methyltransferase", kind: "enzyme",
    pdb: { id: "2H11", organism: "Homo sapiens", note: "X-ray structure of human TPMT (amino-terminally truncated) complexed with S-adenosyl-L-homocysteine, the reaction by-product; cofactor highlighted." },
    markers: [
      { rsid: "rs1142345", alleleName: "TPMT*3C", change: "c.719A>G", ref: "A", alt: "G" },
    ],
    categories: [
      { key: "NORMAL",       label: "Normal activity (*1/*1)",  diplotype: "*1/*1",  altCount: 0, activity: 1.00 },
      { key: "INTERMEDIATE", label: "Intermediate activity (*1/*3C)", diplotype: "*1/*3C", altCount: 1, activity: 0.30 },
      { key: "POOR",         label: "Poor activity (*3C/*3C)",  diplotype: "*3C/*3C", altCount: 2, activity: 0.05 },
    ],
    drugs: [
      {
        name: "Azathioprine", aliases: ["imuran", "azasan"],
        adviceByCategory: {
          NORMAL:       { risk: "standard",       text: "CPIC Level A: normal TPMT activity; standard thiopurine starting dose." },
          INTERMEDIATE: { risk: "toxicity_risk",  text: "CPIC Level A: reduced TPMT activity — start at reduced dose (typically 30-70% of standard) and titrate; monitor counts closely." },
          POOR:         { risk: "severe_toxicity", text: "CPIC Level A: severely reduced activity — start at drastically reduced frequency/dose (per CPIC ~10% of standard or dose-sparing regimens) or use a non-thiopurine alternative." },
        },
        alternatives: ["Non-thiopurine immunosuppressants (e.g. mycophenolate, per clinical assessment)"],
        alternativeNote: "For poor TPMT activity CPIC favors non-thiopurine therapy or extreme dose reduction with specialist oversight.",
      },
      {
        name: "Mercaptopurine", aliases: ["6-mp", "purinethol", "purixan"],
        adviceByCategory: {
          NORMAL:       { risk: "standard",       text: "CPIC Level A: normal TPMT activity; standard mercaptopurine dosing." },
          INTERMEDIATE: { risk: "toxicity_risk",  text: "CPIC Level A: reduced TPMT activity — reduced starting dose (30-70% of standard) with close hematologic monitoring." },
          POOR:         { risk: "severe_toxicity", text: "CPIC Level A: severely reduced activity — drastic dose reduction (~10% of standard or less-frequent dosing per CPIC) or non-thiopurine alternative." },
        },
        alternatives: ["Non-thiopurine therapy (per clinical assessment)"],
        alternativeNote: "Same CPIC thiopurine guideline as azathioprine.",
      },
    ],
    limitation: "Full TPMT star-allele assignment includes *3A (two linked SNPs) and other alleles; this panel checks the single most common decreased-function variant (*3C).",
  },
  {
    gene: "DPYD", protein: "Dihydropyrimidine dehydrogenase (DPD)", kind: "enzyme",
    pdb: { id: "1GTH", organism: "Sus scrofa (porcine)", note: "HONEST LABEL: no experimental human DPYD structure exists in the PDB (only AlphaFold models). This is the porcine DPD crystal structure — the standard template the pharmacogenomics literature uses to map human DPYD variants (~86% identity). FAD/FMN cofactors highlighted." },
    markers: [
      { rsid: "rs3918290", alleleName: "DPYD*2A", change: "c.1905+1G>A (IVS14+1 splice donor)", ref: "G", alt: "A" },
    ],
    categories: [
      { key: "NORMAL",       label: "Normal DPD activity (G/G)",   diplotype: "*1/*1", altCount: 0, activity: 1.00 },
      { key: "INTERMEDIATE", label: "Intermediate activity (*1/*2A)", diplotype: "*1/*2A", altCount: 1, activity: 0.40 },
      { key: "DEFICIENT",    label: "DPD deficiency (*2A/*2A)",    diplotype: "*2A/*2A", altCount: 2, activity: 0.10 },
    ],
    drugs: [
      {
        name: "Fluorouracil", aliases: ["5-fu", "5fu", "adrucil"],
        adviceByCategory: {
          NORMAL:       { risk: "standard",        text: "CPIC Level A: no *2A detected on this marker; standard fluoropyrimidine dosing per protocol." },
          INTERMEDIATE: { risk: "severe_toxicity", text: "CPIC Level A: heterozygous DPYD*2A — reduced starting dose (per CPIC ~50% reduction, guided by the full variant panel and clinical judgment) and close toxicity monitoring." },
          DEFICIENT:    { risk: "contraindicated",  text: "CPIC Level A: DPD deficiency — avoid fluoropyrimidines; risk of severe/fatal toxicity. Use a non-fluoropyrimidine regimen." },
        },
        alternatives: ["Non-fluoropyrimidine regimens (oncology decision)"],
        alternativeNote: "This is an oncology dosing decision made by the treating team per CPIC DPYD guidance.",
      },
      {
        name: "Capecitabine", aliases: ["xeloda"],
        adviceByCategory: {
          NORMAL:       { risk: "standard",        text: "CPIC Level A: no *2A detected on this marker; standard capecitabine dosing." },
          INTERMEDIATE: { risk: "severe_toxicity", text: "CPIC Level A: heterozygous DPYD*2A — dose-reduced fluoropyrimidine therapy with intensified monitoring." },
          DEFICIENT:    { risk: "contraindicated",  text: "CPIC Level A: DPD deficiency — avoid fluoropyrimidines; risk of severe/fatal toxicity." },
        },
        alternatives: ["Non-fluoropyrimidine regimens (oncology decision)"],
        alternativeNote: "Capecitabine is converted to 5-FU in vivo — the same CPIC DPYD guideline applies.",
      },
    ],
    limitation: "Full DPYD risk assessment per CPIC uses several variants (e.g. *13, HapB3) beyond *2A; this panel checks the single most clinically actionable splice variant.",
  },
  {
    gene: "HLA-B", protein: "Major Histocompatibility Complex, Class I, B", kind: "antigen-presenting receptor",
    pdb: { id: "3VRI", organism: "Homo sapiens", note: "Crystal structure of human HLA-B*57:01 in complex with abacavir bound non-covalently in the F-pocket of the antigen-binding cleft, altering peptide specificity." },
    markers: [
      { rsid: "rs2395029", alleleName: "HLA-B*57:01 tag", change: "HCP5 / HLA-B*57:01", ref: "T", alt: "G" },
    ],
    categories: [
      { key: "NEGATIVE", label: "HLA-B*57:01 Negative (Non-carrier)", diplotype: "Non-carrier (T/T)", altCount: 0, activity: 1.00 },
      { key: "POSITIVE", label: "HLA-B*57:01 Carrier (G-allele)", diplotype: "*57:01 Carrier (T/G or G/G)", altCount: 1, activity: 0.10 },
    ],
    drugs: [
      {
        name: "Abacavir", aliases: ["ziagen", "triumeq", "epzicom"],
        adviceByCategory: {
          NEGATIVE: { risk: "standard", text: "CPIC Level A: HLA-B*57:01 not detected. Low risk of abacavir hypersensitivity; initiate per standard protocol." },
          POSITIVE: { risk: "contraindicated", text: "CPIC Level A (Strong): HLA-B*57:01 carrier. High risk of life-threatening hypersensitivity reaction (fever, rash, organ failure). CONTRAINDICATED — use an alternative antiretroviral." },
        },
        alternatives: ["Tenofovir disoproxil fumarate (TDF)", "Tenofovir alafenamide (TAF)", "Bictegravir"],
        alternativeNote: "CPIC recommends avoiding abacavir in any patient carrying HLA-B*57:01; rechallenge can cause fatal anaphylaxis.",
      },
    ],
    limitation: "rs2395029 is a validated tag SNP with >99% linkage disequilibrium to HLA-B*57:01 in European populations; sequence-based HLA typing remains the gold standard in clinical labs.",
  },
  {
    gene: "CYP3A5", protein: "Cytochrome P450 3A5", kind: "enzyme",
    pdb: { id: "7L1U", organism: "Homo sapiens", note: "Cryo-EM structure of human microsomal Cytochrome P450 3A5. Major enzyme responsible for calcineurin inhibitor clearance." },
    markers: [
      { rsid: "rs776746", alleleName: "CYP3A5*3", change: "c.219-237A>G (aberrant splicing)", ref: "A", alt: "G" },
    ],
    categories: [
      { key: "EXTENSIVE",    label: "CYP3A5 Expressor (*1/*1)",           diplotype: "*1/*1", altCount: 0, activity: 1.50 },
      { key: "INTERMEDIATE", label: "CYP3A5 Intermediate Expressor (*1/*3)", diplotype: "*1/*3", altCount: 1, activity: 1.00 },
      { key: "POOR",         label: "CYP3A5 Non-expressor (*3/*3)",       diplotype: "*3/*3", altCount: 2, activity: 0.20 },
    ],
    drugs: [
      {
        name: "Tacrolimus", aliases: ["prograf", "advagraf", "envarsus"],
        adviceByCategory: {
          EXTENSIVE:    { risk: "high_clearance", text: "CPIC Level A: Extensive expressor (*1/*1). Rapid drug clearance leads to subtherapeutic blood levels and acute graft rejection. Increase starting dose 1.5–2x with therapeutic drug monitoring (TDM)." },
          INTERMEDIATE: { risk: "adjusted_dose",  text: "CPIC Level A: Intermediate expressor (*1/*3). Increased clearance compared to non-expressors; increase starting dose 1.5x with TDM." },
          POOR:         { risk: "standard",       text: "CPIC Level A: Non-expressor (*3/*3). Standard starting dose per hospital protocol with routine trough monitoring." },
        },
        alternatives: ["Cyclosporine", "Belatacept (transplant nephrology protocol)"],
        alternativeNote: "Tacrolimus dosing strictly requires trough concentration (C0) therapeutic drug monitoring per CPIC guidelines.",
      },
    ],
    limitation: "CYP3A5*3 is the predominant loss-of-function allele; in individuals of African ancestry, *6 and *7 also contribute to non-expressor status.",
  },
];

// Flat lookup: rsid → marker definition (shared by the parser)
const TARGET_RSIDS = {};
for (const g of PGX_PANEL) for (const m of g.markers) TARGET_RSIDS[m.rsid] = { ...m, gene: g.gene };

const PGX_DISCLAIMER =
  "DEMO — NOT MEDICAL ADVICE. This is a privacy-technology demonstration, not a clinical tool. " +
  "Never start, stop, or change any medication based on this output. Consult a physician, " +
  "pharmacist, or genetic counselor for actual pharmacogenomic decisions.";

// ---------------------------------------------------------------------------
// Raw genotype file parser — single pass, fully local.
// Supported: 23andMe-style (rsid/chr/pos/genotype, tab-separated),
// AncestryDNA-style (rsid/chr/pos/allele1/allele2), and VCF 4.x (GT field).
// ---------------------------------------------------------------------------
function parseGenomicFile(text) {
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const lines = text.split(/\r?\n/);
  let format = null;

  // --- format sniffing (cheap, bounded window) ---
  let firstDataLine = null;
  for (let i = 0; i < Math.min(lines.length, 200); i++) {
    const ln = lines[i];
    if (!ln) continue;
    if (ln.startsWith("##fileformat=VCF")) { format = "vcf"; break; }
    if (ln[0] === "#") continue;
    firstDataLine = ln;
    const f = ln.split("\t");
    if (f.length >= 8 && /^rs/.test(f[2] || "")) format = "vcf";
    else if (f.length === 4 && /^rs/.test(f[0] || "")) format = "23andme";
    else if (f.length === 5 && /^rs/.test(f[0] || "")) format = "ancestry";
    if (format) break;
  }
  if (!format) {
    throw new Error("Unrecognized file format. Supported: 23andMe raw text (rsid/chromosome/position/genotype), AncestryDNA raw text, or VCF 4.x. " +
      "The first data line seen was: " + JSON.stringify(String(firstDataLine || "").slice(0, 60)));
  }

  // --- single-pass scan for target rsIDs only ---
  const markers = {};         // rsid → { raw, called, valid, altCount, note, ... }
  let dataLines = 0;

  for (const ln of lines) {
    if (!ln) continue;
    const c0 = ln.charCodeAt(0);
    if (c0 === 35) continue;               // '#': header/comment in all three formats
    let f;
    if (format === "23andme" || format === "ancestry") {
      if (c0 !== 114) continue;            // fast skip: 'r' = 114
      f = ln.split("\t");
    } else {                               // vcf: data lines start with a contig name
      f = ln.split("\t");
    }
    dataLines++;

    let rsid = null, gtRaw = null, vcfRef = null, vcfAlt = null;
    if (format === "23andme") {
      if (f.length < 4) continue;
      rsid = f[0]; gtRaw = f[3];
    } else if (format === "ancestry") {
      if (f.length < 5) continue;
      rsid = f[0]; gtRaw = (f[3] || "") + (f[4] || "");
    } else { // vcf
      if (f.length < 10) continue;
      if (!/^rs/.test(f[2] || "")) continue;
      rsid = f[2]; vcfRef = f[3]; vcfAlt = f[4];
      const fmtKeys = (f[8] || "").split(":");
      const gtIdx = fmtKeys.indexOf("GT");
      if (gtIdx === -1) continue;
      const sample = (f[9] || "").split(":");
      const gt = sample[gtIdx];
      if (!gt || gt === "./." || gt === ".|." || gt === ".") continue;
      const alts = (vcfAlt || "").split(",");
      const letters = gt.replace(/[|/]/g, "").split("").map(n => {
        if (n === ".") return ".";
        const idx = parseInt(n, 10);
        if (idx === 0) return vcfRef;
        if (Number.isNaN(idx) || idx > alts.length) return "?";
        return alts[idx - 1];
      });
      gtRaw = letters.join("");
    }

    const target = TARGET_RSIDS[rsid];
    if (!target) continue;
    if (markers[rsid]) continue; // first occurrence wins

    const norm = String(gtRaw || "").trim().toUpperCase();
    const entry = { raw: norm, gene: target.gene, alleleName: target.alleleName, ref: target.ref, alt: target.alt, called: false, valid: false, altCount: 0, note: null };

    if (norm === "--" || norm === "." || norm === ".." || norm === "" || norm.includes("?")) {
      entry.note = "no-call in file";
    } else if (norm.length === 2 && /^[ACGTI]{2}$/.test(norm)) {
      const letters = norm.split("");
      const ok = letters.every(l => l === target.ref || l === target.alt);
      if (ok) {
        entry.called = true; entry.valid = true;
        entry.altCount = letters.filter(l => l === target.alt).length;
      } else {
        entry.note = "unexpected alleles (" + norm + " vs expected " + target.ref + "/" + target.alt + ") — possible strand/genome-build mismatch; treated as no-call";
      }
    } else {
      entry.note = "unparseable genotype: " + JSON.stringify(norm);
    }
    markers[rsid] = entry;
  }

  const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return { format, markers, stats: { totalLines: lines.length, dataLines, elapsedMs: Math.round(elapsed) } };
}

// ---------------------------------------------------------------------------
// Phenotype derivation + secret derivation from the REAL parsed genotype.
// The secret = sha256(gene | genotypes | per-file random salt) — the value
// that enters the Merkle leaf Poseidon(secret, claimId) and the Groth16 witness.
// ---------------------------------------------------------------------------
async function deriveGeneStates(parsed, fileSaltHex) {
  const states = {};
  for (const geneDef of PGX_PANEL) {
    const gene = geneDef.gene;
    const found = [];
    for (const m of geneDef.markers) {
      const e = parsed.markers[m.rsid];
      if (e) found.push({ rsid: m.rsid, ...e });
    }
    if (found.length === 0) { states[gene] = { gene, found: false }; continue; }

    const anyNoCall = found.some(e => !e.called);
    const genotypeString = found.map(e => e.rsid + "=" + e.raw).join(";");
    const altCount = found.reduce((s, e) => s + (e.valid ? e.altCount : 0), 0);

    let category, notes = [];
    if (anyNoCall) {
      category = "NO_CALL";
      notes.push("marker(s) present but not confidently callable in this file — confirmatory clinical genotyping recommended");
    } else {
      // pick the category with the LARGEST threshold that the observed alt count
      // reaches (categories are ascending 0/1/2; altCount can exceed the top
      // threshold when a gene carries several markers, e.g. CYP2C9 *2/*3/*3)
      const sorted = [...geneDef.categories].sort((a, b) => a.altCount - b.altCount);
      const matched = [...sorted].reverse().find(c => altCount >= c.altCount) || sorted[0];
      category = matched.key;
      if (geneDef.markers.length > 1 && found.length < geneDef.markers.length) {
        notes.push("only " + found.length + " of " + geneDef.markers.length + " " + gene + " markers present in this file — confidence limited");
      }
    }
    if (geneDef.limitation) notes.push(geneDef.limitation);

    const catDef = geneDef.categories.find(c => c.key === category) || null;
    states[gene] = {
      gene, found: true, genotypeString, altCount, category,
      categoryLabel: catDef ? catDef.label : "No confident call",
      diplotype: catDef ? catDef.diplotype : "n/a",
      activity: catDef ? catDef.activity : null,
      markersFound: found.map(e => ({ rsid: e.rsid, raw: e.raw, called: e.called, note: e.note, alleleName: e.alleleName })),
      notes,
      secret: await sha256ToBigInt(gene + "|" + genotypeString + "|" + fileSaltHex),
    };
  }
  return states;
}

// ---------------------------------------------------------------------------
// Drug lookup + advice
// ---------------------------------------------------------------------------
function findDrug(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  for (const g of PGX_PANEL) {
    for (const d of g.drugs) {
      const names = [d.name.toLowerCase(), ...(d.aliases || [])];
      if (names.some(n => n === q || q.includes(n) || n.includes(q.replace(/\s/g, "")))) {
        return { drug: d.name, gene: g.gene, geneDef: g, drugDef: d, combo: !!d.combo, comboPartner: d.comboPartner || null };
      }
    }
  }
  return null;
}

function listDrugs() {
  const out = [];
  for (const g of PGX_PANEL) for (const d of g.drugs) out.push({ drug: d.name, gene: g.gene, aliases: d.aliases || [] });
  return out;
}

// Warfarin: CPIC-flavored combined tier from CYP2C9 + VKORC1 categories
function warfarinRiskTier(cyp2c9Cat, vkorc1Cat) {
  const s = { NORMAL: 0, INTERMEDIATE: 1, POOR: 2 }[cyp2c9Cat];
  const v = { STANDARD: 0, SENSITIVE: 1, HIGHLY_SENSITIVE: 2 }[vkorc1Cat];
  if (s === undefined || v === undefined) return null;
  const score = s + v;
  if (score === 0) return {
    tier: "standard", label: "Standard sensitivity",
    text: "CYP2C9 and VKORC1 both normal/standard — initiate per standard label dosing with routine INR monitoring (simplified tier; real CPIC warfarin dosing uses a full pharmacogenetic algorithm).",
  };
  if (score <= 2) return {
    tier: "increased", label: "Increased sensitivity",
    text: "Reduced warfarin dose requirement expected (roughly 30% lower initiation is typical practice) with more frequent INR monitoring until stable (simplified tier from the two genes).",
  };
  return {
    tier: "high", label: "High sensitivity — substantial bleeding risk",
    text: "Markedly reduced warfarin dose requirement (30-50% reduction, guided by INR) and intensified monitoring; some regimens favor a DOAC if clinically appropriate — clinician decision (simplified tier).",
  };
}

// Full claim catalog: one claim per (gene, category) — the PUBLIC taxonomy.
// The claim tree for the user's own category contains their real leaf; the
// other categories' trees contain decoys only (no proof is possible there).
function getClaimCatalog() {
  const out = [];
  for (const g of PGX_PANEL) {
    for (const c of g.categories) {
      out.push({
        claimId: g.gene + "__" + c.key,
        gene: g.gene,
        categoryKey: c.key,
        categoryLabel: c.label,
        diplotype: c.diplotype,
      });
    }
  }
  return out;
}

function claimFor(gene, categoryKey) {
  const g = geneDefFor(gene);
  if (!g) return null;
  const c = g.categories.find(c => c.key === categoryKey);
  return c ? { claimId: g.gene + "__" + c.key, gene: g.gene, categoryKey: c.key, categoryLabel: c.label, diplotype: c.diplotype } : null;
}

function geneDefFor(gene) {
  const up = String(gene || "").trim().toUpperCase();
  return PGX_PANEL.find(g => g.gene === up) || null;
}

function activityFraction(gene, categoryKey) {
  const g = geneDefFor(gene);
  if (!g) return null;
  const c = g.categories.find(c => c.key === categoryKey);
  return c ? c.activity : null;
}

// ---------------------------------------------------------------------------
// Export shim: Node + browser
// ---------------------------------------------------------------------------
const PGXCore = {
  PGX_PANEL, TARGET_RSIDS, PGX_DISCLAIMER,
  parseGenomicFile, deriveGeneStates, sha256ToBigInt,
  findDrug, listDrugs, warfarinRiskTier,
  getClaimCatalog, claimFor, geneDefFor, activityFraction,
};
if (typeof module !== "undefined" && module.exports) module.exports = PGXCore;
if (typeof window !== "undefined") window.PGXCore = PGXCore;
