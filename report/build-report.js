const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, VerticalAlign, TableOfContents, ImageRun,
} = require("docx");

const FONT = "Times New Roman";
const BODY_SIZE = 24; // 12pt
const LINE_150 = 360; // 1.5 line spacing
const NAVY = "1F3864";

// ---------- basic building blocks ----------
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 200, line: LINE_150 },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children: Array.isArray(text)
      ? text.map(r => new TextRun({ font: FONT, size: BODY_SIZE, ...r }))
      : [new TextRun({ text, font: FONT, size: BODY_SIZE, bold: opts.bold, italics: opts.italics })],
  });
}

function h1(text, opts = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: !!opts.pageBreakBefore,
    spacing: { before: 320, after: 200, line: LINE_150 },
    children: [new TextRun({ text, font: FONT, size: 28, bold: true, color: "000000" })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 160, line: LINE_150 },
    children: [new TextRun({ text, font: FONT, size: 25, bold: true, color: "000000" })],
  });
}

function bulletList(items) {
  return items.map(t => new Paragraph({
    numbering: { reference: "bullet-list", level: 0 },
    spacing: { after: 100, line: LINE_150 },
    children: Array.isArray(t)
      ? t.map(r => new TextRun({ font: FONT, size: BODY_SIZE, ...r }))
      : [new TextRun({ text: t, font: FONT, size: BODY_SIZE })],
  }));
}

function numberedItem(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: "num-list", level: 0 },
    spacing: { after: opts.after ?? 100, line: LINE_150 },
    children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
  });
}

function codeBlock(lines) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
    },
    spacing: { after: 200, before: 100 },
    children: lines.flatMap((l, i) => {
      const run = new TextRun({ text: l || " ", font: "Consolas", size: 19 });
      return i === 0 ? [run] : [new TextRun({ text: l || " ", font: "Consolas", size: 19, break: 1 })];
    }),
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 2000, type: WidthType.DXA },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), font: FONT, size: 19, bold: !!opts.header, color: opts.header ? "FFFFFF" : "000000" })],
    })],
  });
}

function table(headerRow, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headerRow.map((h, i) => cell(h, { header: true, width: colWidths[i], align: AlignmentType.CENTER })),
      }),
      ...rows.map(r => new TableRow({
        children: r.map((c, i) => cell(c, { width: colWidths[i] })),
      })),
    ],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 300 },
    children: [new TextRun({ text, font: FONT, size: 19, italics: true, bold: true })],
  });
}

// ---------- box+arrow diagrams (no external image needed) ----------
function diagBox(title, items, fill, width) {
  const paras = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: title, font: FONT, size: 18, bold: true })] })];
  items.forEach(it => paras.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: it, font: FONT, size: 14 })] })));
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 80, right: 80 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "333333" }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333" },
      left: { style: BorderStyle.SINGLE, size: 6, color: "333333" }, right: { style: BorderStyle.SINGLE, size: 6, color: "333333" },
    },
    children: paras,
  });
}
function diagArrow(label, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: "\u2192", size: 30, bold: true })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: label, font: FONT, size: 13, bold: true, color: "B22222" })] }),
    ],
  });
}
function diagramTable(columnWidths, cells) {
  return new Table({
    width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [new TableRow({ children: cells })],
  });
}
function architectureDiagram() {
  const boxW = 1950, arrowW = 500;
  return diagramTable([boxW, arrowW, boxW, arrowW, boxW, arrowW, boxW], [
    diagBox("USER / BROWSER", ["Access via HTTPS"], "FFFFFF", boxW),
    diagArrow("TB1", arrowW),
    diagBox("FRONTEND", ["Login Page", "Dashboard", "Transactions View"], "D6E8FA", boxW),
    diagArrow("TB2", arrowW),
    diagBox("BACKEND API", ["Auth Middleware", "Business Logic", "API Endpoints"], "D9F2D9", boxW),
    diagArrow("TB3", arrowW),
    diagBox("DATABASE", ["users", "accounts", "transactions"], "EBDCF7", boxW),
  ]);
}
function methodologyDiagram() {
  const boxW = 1750, arrowW = 300;
  return diagramTable([boxW, arrowW, boxW, arrowW, boxW, arrowW, boxW, arrowW, boxW], [
    diagBox("RECONNAISSANCE", [], "FFF3D6", boxW),
    diagArrow("", arrowW),
    diagBox("VULNERABILITY ID", [], "FFE0D6", boxW),
    diagArrow("", arrowW),
    diagBox("EXPLOITATION", [], "FADBD8", boxW),
    diagArrow("", arrowW),
    diagBox("REMEDIATION", [], "D9F2D9", boxW),
    diagArrow("", arrowW),
    diagBox("VERIFICATION", [], "D6E8FA", boxW),
  ]);
}

// ---------- severity / comparison mini-bars (table-based, no chart engine needed) ----------
function barRow(label, widthDxa, fill, maxWidthDxa, valueText) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2200, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        children: [new Paragraph({ children: [new TextRun({ text: label, font: FONT, size: 18, bold: true })] })],
      }),
      new TableCell({
        width: { size: maxWidthDxa, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        children: [new Table({
          width: { size: maxWidthDxa, type: WidthType.DXA },
          columnWidths: [widthDxa, Math.max(maxWidthDxa - widthDxa, 1)],
          borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: widthDxa, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill }, children: [new Paragraph({ children: [new TextRun({ text: valueText, font: FONT, size: 16, color: "FFFFFF", bold: true })] })] }),
            new TableCell({ width: { size: Math.max(maxWidthDxa - widthDxa, 1), type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
          ] })],
        })],
      }),
    ],
  });
}
function barChart(rows) {
  const maxW = 5200;
  return new Table({
    width: { size: 7400, type: WidthType.DXA },
    columnWidths: [2200, maxW],
    borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    rows: rows.map(r => barRow(r.label, r.widthDxa, r.fill, maxW, r.valueText)),
  });
}

function imagePara(imgPath, width, height) {
  const data = fs.readFileSync(imgPath);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
    children: [new ImageRun({ data, type: "png", transformation: { width, height } })],
  });
}

// ==========================================================================
const IMG_DASHBOARD = "C:\\Users\\anshi\\AppData\\Local\\Temp\\claude\\d--BROKEN-OBJECT-LEVEL-AUTHORIZATION-IDOR--BANKING-DEMO\\c477398c-6f5f-4e09-a905-4b1e7db851a2\\images\\1.png";
const IMG_EXPLOIT = "C:\\Users\\anshi\\AppData\\Local\\Temp\\claude\\d--BROKEN-OBJECT-LEVEL-AUTHORIZATION-IDOR--BANKING-DEMO\\c477398c-6f5f-4e09-a905-4b1e7db851a2\\images\\2.png";

const children = [];

// ---------- Title page ----------
children.push(
  new Paragraph({ spacing: { after: 900 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new TextRun({ text: "VIT LOGO", font: FONT, size: 40, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "COURSE NAME", font: FONT, size: 26, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: "BCSE302L \u2013 Web Application Security", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "CASE STUDY PROJECT REPORT", font: FONT, size: 26, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new TextRun({ text: "Broken Object-Level Authorization (IDOR) Banking Demo", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: "Group Number: ________", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Group Members (Name \u2013 Reg. No.):", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "1. Anshika Raj \u2013 23BCI0100", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "2. Aditya Prakash \u2013 23BCI0089", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "3. Aryan Sharma \u2013 23BCI0154", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Submitted to: < Faculty Name >", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "School of Computer Science and Engineering", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Vellore Institute of Technology", font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "September, 2026", font: FONT, size: 24 })] }),
);

// ---------- Declaration ----------
children.push(
  h1("DECLARATION AND ETHICAL-USE STATEMENT", { pageBreakBefore: true }),
  body("We declare that this report is our own original work carried out as part of the BCSE302L Web Application Security course. All sources are cited. All security testing described in this report was performed only on a banking application we built ourselves, running locally with fictitious seeded data. No third-party, production, or unauthorised system was tested, and no real user data was accessed at any time.")
);

// ---------- TOC ----------
children.push(
  h1("TABLE OF CONTENTS", { pageBreakBefore: true }),
  body('(Right-click and choose "Update Field" in Word to refresh page numbers after writing the report.)', { align: AlignmentType.LEFT, italics: true }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
);

// ---------- Abstract ----------
children.push(
  h1("ABSTRACT", { pageBreakBefore: true }),
  body("This project studies Broken Object-Level Authorization (BOLA), OWASP API1:2023, in a self-built banking web application. The target is a Node.js/Express REST API backed by SQLite, with JWT authentication and a plain HTML/CSS/JS client exposing a login page, an account dashboard, and a transaction view. Testing followed a reconnaissance \u2192 identification \u2192 exploitation \u2192 remediation \u2192 verification cycle: the endpoint GET /api/accounts/{id}/transactions was manually identified as accepting a client-controlled account identifier, and a single BOLA finding (CWE-639, CVSS 3.1 base score 6.5, Medium) was confirmed by authenticating as one user and successfully retrieving another user's transaction history and balance by changing the id in the request. The finding was remediated by scoping every account lookup to owner_id = <authenticated user>, returning 403 Forbidden on a mismatch, and re-tested with the identical request that previously succeeded. An access-logging layer was added to make future attempts detectable. After remediation, the finding was no longer exploitable while legitimate same-owner requests were unaffected. The main limitation is scale: testing used two seeded accounts on a single local instance, with no automated scanner or load testing, so results describe correctness of the fix rather than its behaviour under production traffic."),
  body([{ text: "Keywords: ", bold: true }, { text: "web application security, BOLA, IDOR, OWASP API Top 10, access control, JWT, CWE-639" }]),
);

// ==========================================================================
// 1. INTRODUCTION
// ==========================================================================
children.push(h1("1. INTRODUCTION", { pageBreakBefore: true }));

children.push(h2("1.1 Background"));
children.push(body("This project sits within API security, specifically access control. A web API typically authenticates a request (confirms who is calling) and separately authorizes it (confirms what that identity may do to the specific resource named in the request). OWASP's API Security Top 10 lists Broken Object Level Authorization (API1:2023) as the most common and highest-impact API weakness: an endpoint accepts an object identifier such as an account ID from the client and returns or modifies that object without checking whether the caller actually owns or is permitted to access it. MITRE catalogues the same weakness as CWE-639, Authorization Bypass Through User-Controlled Key."));

children.push(h2("1.2 Motivation"));
children.push(body("BOLA matters because it turns a normal, authenticated user into an attacker against every other user's data using only the application's own, intended request shape \u2014 no injection payload or credential theft is required, only changing an integer. Real-world instances confirm this is not a theoretical concern: CVE-2024-37889 (MyFinances) let an authenticated user read another customer's financial records; CVE-2026-23844 (Whisper Money) allowed interaction with another user's bank-account information; CVE-2026-53903 (MyComplianceOffice) let a user retrieve another user's trading documents by ID. All three are financial applications, the same domain this project targets, which is why a banking demo was chosen as the vehicle for studying BOLA rather than a generic CRUD app."));

children.push(h2("1.3 Objectives of the Project"));
children.push(body("The objectives, restated in the Conclusion (\u00a711.1):"));
children.push(...bulletList([
  "Build a working, self-contained banking application with real authentication (JWT) rather than a described or diagrammed one.",
  "Identify and reproduce a genuine BOLA vulnerability on a client-controlled account identifier, with the exact request/response evidence.",
  "Remediate the vulnerability with a server-side ownership check and verify the fix using the identical request that previously succeeded.",
  "Add a detection mechanism (access logging) so a future BOLA attempt is auditable, not only blocked.",
]));

children.push(h2("1.4 Scope of the Report"));
children.push(body("Section 2 reviews the standards and prior sources this project draws on. Section 3 defines the problem and its scope precisely. Section 4 describes the application under test and its architecture. Section 5 builds a threat model. Section 6 states the testing methodology. Section 7 documents the vulnerable build, the finding, and the defended build. Section 8 analyses the results. Sections 9\u201311 cover limitations, contemporary issues, and the conclusion. Sections 12\u201314 cover contributions, references, and appendices."));

// ==========================================================================
// 2. LITERATURE AND BACKGROUND STUDY
// ==========================================================================
children.push(h1("2. LITERATURE AND BACKGROUND STUDY"));

children.push(h2("2.1 Related Concepts and Standards"));
children.push(body("This project is grounded in four standards. OWASP API Security Top 10 (2023) ranks BOLA as API1, the single most common API weakness, and defines it as an API receiving an object ID from a client without verifying the caller is authorized for that specific object [1]. The OWASP IDOR Prevention Cheat Sheet gives the concrete prevention pattern used in \u00a77.3: always resolve an object through a query scoped to the caller's identity, never by identifier alone [2]. MITRE's CWE-639 classifies the underlying weakness \u2014 using a user-controlled key to reach a resource without an authorization check \u2014 independent of any specific framework [3]. CVSS v3.1 is used in \u00a77.2 to score the finding's severity on a standard, comparable scale [9]. The course textbook (Hoffman) frames the same distinction this project turns into working code: authentication proves identity, authorization decides access, and conflating the two is one of the most common root causes of exploitable web application vulnerabilities [8]."));

children.push(h2("2.2 Related Work / Existing Solutions"));
children.push(table(
  ["Ref.", "Approach / Source", "Strengths", "Limitations"],
  [
    ["[1]", "OWASP API1:2023 \u2014 BOLA definition", "Authoritative, precise definition of the weakness class", "Describes the problem, not a specific implementation"],
    ["[2]", "OWASP IDOR Prevention Cheat Sheet", "Concrete, actionable prevention pattern (scope queries to caller)", "Framework-agnostic; needs adaptation to a specific stack"],
    ["[4]\u2013[7]", "Real-world CVE case studies (MyFinances, Khoj, Whisper Money, MyComplianceOffice)", "Demonstrate real business impact in the same (financial) domain", "Public advisories give outcome, not full technical root-cause detail"],
  ],
  [900, 3000, 2900, 2500]
));

children.push(h2("2.3 Gap Identified"));
children.push(body("The standards above explain BOLA correctly but abstractly, and the CVE case studies confirm real impact but without a reproducible, hands-on example a student can run and modify. What is missing is a small, complete application where the same code path can be toggled between the vulnerable and fixed state and the identical request re-run against both \u2014 turning a described vulnerability class into an observed, then closed, one. That gap is what this project's vulnerable/secure toggle (\u00a77.1, \u00a77.3) is built to fill."));

// ==========================================================================
// 3. PROBLEM STATEMENT AND SCOPE
// ==========================================================================
children.push(h1("3. PROBLEM STATEMENT AND SCOPE"));
children.push(body("This section restates the chosen scenario \u2014 BOLA/IDOR in a banking application \u2014 and fixes the boundary of what was and was not tested."));

children.push(h2("3.1 Problem Definition"));
children.push(body("The banking application lets authenticated users view their own transactions through GET /api/accounts/{id}/transactions. In the vulnerable build, the backend trusts the client-supplied account_id and never checks whether the requested account belongs to the currently authenticated user, so an authenticated user can change the id in the request and read another user's transaction history and balance. The problem this report solves: how can a banking web application prevent an authenticated user from accessing another user's transaction records when the account identifier is supplied through a client-controlled API request, without breaking that same user's access to their own account?"));

children.push(h2("3.2 In-Scope and Out-of-Scope"));
children.push(body([{ text: "In scope:", bold: true }]));
children.push(...bulletList([
  "Login, signup and JWT-based session handling.",
  "Object-level authorization on GET /api/accounts/{id} and GET /api/accounts/{id}/transactions.",
  "The server-side ownership-check remediation and its verification.",
  "Detection: access logging of allowed and blocked account-scoped requests.",
]));
children.push(body([{ text: "Out of scope:", bold: true }]));
children.push(...bulletList([
  "Other OWASP Top 10 categories not exercised by this endpoint pair (XSS, SQL injection, CSRF, SSRF).",
  "Real payment processing, real user data, or any production/third-party system.",
  "Load testing, denial-of-service testing, and formal performance benchmarking.",
  "Automated SAST/DAST/SCA tooling (noted as future work in \u00a711.2).",
]));

children.push(h2("3.3 Assumptions and Constraints"));
children.push(...bulletList([
  "Attacker model: an authenticated, low-privilege user attacking another account they do not own (not an unauthenticated outsider, which is already blocked by the JWT requirement, and not an insider or supply-chain actor).",
  "Access level: white-box \u2014 full source code was available and written by the team.",
  "Environment: a single local Node.js instance (localhost:4000), no containers, no cloud deployment.",
  "Constraints: a time-boxed course project; no destructive or production testing; all data is synthetic and seeded.",
]));

// ==========================================================================
// 4. SYSTEM UNDER TEST AND ARCHITECTURE
// ==========================================================================
children.push(h1("4. SYSTEM UNDER TEST AND ARCHITECTURE"));
children.push(body("This section describes the full-stack application built for this project \u2014 the system both attacked and defended in \u00a77."));

children.push(h2("4.1 Application Overview"));
children.push(body("The application is a small multi-user banking demo. A user signs up or logs in, sees a dashboard of their own accounts (balance, account number, type), and opens a transactions view per account. There is a single user role \u2014 an authenticated account holder \u2014 with no administrative role; every user's capabilities are identical, which keeps the object-level authorization question isolated to \u201cdoes this account belong to me\u201d rather than mixed with role-based permissions."));
children.push(imagePara(IMG_DASHBOARD, 480, 245));
children.push(caption("Figure 1a \u2014 Dashboard after login, showing the authenticated user's own account."));

children.push(h2("4.2 Architecture Diagram"));
children.push(body("The application follows a four-layer flow. Trust boundaries TB1\u2013TB3 mark the points where data crosses from one trust level to another and must be revalidated on the far side:"));
children.push(architectureDiagram());
children.push(caption("Figure 1 \u2014 Architecture diagram: banking web application, with trust boundaries TB1\u2013TB3."));

children.push(h2("4.3 Frontend Description"));
children.push(body("The frontend is plain HTML, CSS and vanilla JavaScript (ES2020+) with no framework, served statically by the same Express process \u2014 chosen so every request the client makes is visible directly in its source rather than hidden behind a build step or framework abstraction. Pages: login, signup, dashboard, a transaction view (with a built-in request/response inspector, \u00a76.2), and a security-log view. Session state is a JWT stored in localStorage under the key idor_demo_token and attached as an Authorization: Bearer header on every request; no cookies, sessionStorage, or IndexedDB are used."));

children.push(h2("4.4 Backend Description"));
children.push(body("The backend is Node.js (v24.19.0) with Express 4.19, exposing a REST API. Endpoint inventory:"));
children.push(table(
  ["Method", "Path", "Parameters", "Auth?", "Data sensitivity"],
  [
    ["POST", "/api/auth/signup", "username, password, full_name", "N", "Critical"],
    ["POST", "/api/auth/login", "username, password", "N", "Critical"],
    ["POST", "/api/auth/logout", "\u2014", "Y", "Medium"],
    ["GET", "/api/me", "\u2014", "Y", "High"],
    ["GET", "/api/accounts", "none (server-filtered)", "Y", "High"],
    ["GET", "/api/accounts/{id}", "account_id (path)", "Y", "High"],
    ["GET", "/api/accounts/{id}/transactions", "account_id (path)", "Y", "Critical"],
    ["GET", "/api/security-log", "none (server-filtered)", "Y", "Medium"],
  ],
  [1200, 3400, 2600, 1000, 1400]
));

children.push(h2("4.5 Data Stores"));
children.push(body("Data is stored in SQLite via Node's built-in node:sqlite module (no external database server, no native compilation). Schema: users (id, username, password_hash, full_name), accounts (id, owner_id \u2192 users, account_number, account_type, balance), transactions (id, account_id \u2192 accounts, type, amount, description, timestamp), and access_logs (\u00a76.2\u2013\u00a76.5). Passwords are hashed with bcrypt (cost factor 10) and never stored or logged in plaintext. The JWT signing secret is read from a local, git-ignored .env file, not hardcoded in source."));

children.push(h2("4.6 Lab Setup and Tools"));
children.push(body("No VM or container was used; the application runs directly on a Windows development machine via npm start, listening on http://localhost:4000. Testing tools were deliberately minimal given the narrow, known target: the browser's own DevTools Network tab, curl for reproducing requests outside the browser, and a request/response inspector built directly into the application's transactions page (showing the exact method, URL, HTTP status and JSON body for every account id tested \u2014 serving the same evidentiary purpose as a proxy tool such as Burp Suite for this specific endpoint pair). No external scanner (Burp Suite, OWASP ZAP, sqlmap, Nuclei) was run; this is recorded as a limitation in \u00a79. A reader reproduces the environment with npm install, npm run seed, then npm start."));

// ==========================================================================
// 5. THREAT MODEL AND SECURITY REQUIREMENTS
// ==========================================================================
children.push(h1("5. THREAT MODEL AND SECURITY REQUIREMENTS"));

children.push(h2("5.1 Assets to Protect"));
children.push(...bulletList([
  "User credentials (password hashes).",
  "JWT session tokens.",
  "Account balances and transaction history (financial PII).",
  "Integrity of the banking database.",
  "Availability of the service (out of scope for active testing, see \u00a73.2).",
]));

children.push(h2("5.2 Threat Actors"));
children.push(body("The primary actor modelled is an authenticated, low-privilege user targeting another user's account \u2014 exactly the actor demonstrated in \u00a77.2, requiring only a valid login of their own. An unauthenticated outsider is a secondary, out-of-scope actor: every account-scoped endpoint already requires a valid JWT, so this actor is blocked before reaching the object-level authorization question this project studies."));

children.push(h2("5.3 Threat Enumeration"));
children.push(table(
  ["ID", "Threat / STRIDE category", "Affected component", "Likelihood", "Impact"],
  [
    ["T1", "Tampering \u2014 client-controlled account_id in the URL", "Backend API (both account-scoped endpoints)", "High", "Medium (enables T2)"],
    ["T2", "Information Disclosure \u2014 BOLA/IDOR exposing another user's transactions", "Backend API + Database", "High", "High"],
    ["T3", "Repudiation \u2014 no record of who accessed which account", "Backend API", "Medium", "Medium"],
  ],
  [700, 3500, 2500, 1300, 1400]
));

children.push(h2("5.4 Security Requirements"));
children.push(body([{ text: "Functional: ", bold: true }, { text: "JWT authentication (implemented); server-side object-level authorization scoped to owner_id (implemented in the secure build, \u00a77.3); password hashing via bcrypt (implemented); access logging of every account-scoped request (implemented, addresses T3); rate limiting (not implemented \u2014 see \u00a79 and \u00a711.2)." }]));
children.push(body([{ text: "Non-functional: ", bold: true }, { text: "confidentiality of transaction data is the primary goal; integrity is not directly threatened by this read-only endpoint pair; availability was not targeted; the fix must add no perceptible latency to legitimate requests (\u00a78.3)." }]));

children.push(h2("5.5 Success Criteria"));
children.push(body("The project succeeds if: (1) the BOLA finding is reproducibly exploitable against the vulnerable build; (2) the identical request is blocked with 403 against the secure build, with no change in behaviour for a same-owner request; and (3) the access log records both the allowed and the blocked attempt. All three were met, as shown in \u00a78.1\u2013\u00a78.2."));

// ==========================================================================
// 6. METHODOLOGY
// ==========================================================================
children.push(h1("6. METHODOLOGY"));
children.push(body("Testing followed a reconnaissance \u2192 vulnerability identification \u2192 exploitation \u2192 remediation \u2192 verification cycle, mirroring the OWASP WSTG structure at a scope appropriate to a single, already-known endpoint pair rather than a full black-box assessment."));
children.push(methodologyDiagram());
children.push(caption("Figure 2 \u2014 Methodology flow followed in this project."));

children.push(h2("6.1 Reconnaissance"));
children.push(body("Because this was a white-box exercise on a self-built application, reconnaissance was source-driven rather than black-box: the full endpoint inventory (\u00a74.4) was read directly from the Express route definitions, and every endpoint accepting a client-controlled path parameter was flagged as a candidate for object-level authorization testing."));

children.push(h2("6.2 Vulnerability Identification"));
children.push(body("GET /api/accounts/{id} and GET /api/accounts/{id}/transactions were identified as the only endpoints taking a client-controlled account_id; by contrast GET /api/accounts takes no identifier at all and is always filtered server-side to the caller's own owner_id, so it was ruled out as not exploitable by construction. Manual code review of the vulnerable build's route handler confirmed the account lookup used the id alone, with no comparison against the authenticated user \u2014 no automated scanner was needed to find this, since the entire candidate surface was two endpoints in one file."));

children.push(h2("6.3 Exploitation"));
children.push(body("A controlled proof-of-concept was built directly in the application's own UI (the request/response inspector on the transactions page) plus an equivalent curl command for reproducibility outside the browser. Full detail, including the captured request/response, is in \u00a77.2 (Finding F1)."));

children.push(h2("6.4 Remediation"));
children.push(body("The fix is a single code change described in \u00a77.3: every account lookup is scoped to owner_id = <authenticated user id> instead of id alone, so a request for an account the caller does not own returns no row and the endpoint responds 403."));

children.push(h2("6.5 Verification"));
children.push(body("Verification re-ran the exact same exploit request (\u00a77.2) against the secure build and additionally re-ran the caller's own-account request to confirm no regression. Both are recorded in the Test Cases table (\u00a77.4) and the Before/After comparison (\u00a78.2)."));

// ==========================================================================
// 7. IMPLEMENTATION AND EXPERIMENTS
// ==========================================================================
children.push(h1("7. IMPLEMENTATION AND EXPERIMENTS"));

children.push(h2("7.1 Vulnerable Build"));
children.push(body("In the vulnerable build (src/routes/accounts.js, function resolveAccess), both account-scoped endpoints fetch the account by id alone and treat it as accessible whenever it exists, regardless of who owns it:"));
children.push(codeBlock([
  "function resolveAccess(accountId, userId) {",
  "  const account = findAccountById(accountId);",
  "  if (!account) return { account: null, exists: false, allowed: false };",
  "  const allowed = config.authzMode === \"secure\"",
  "    ? account.owner_id === userId",
  "    : true;   // vulnerable branch: any existing id is allowed",
  "  return { account, exists: true, allowed };",
  "}",
]));
children.push(body("A single AUTHZ_MODE setting selects which branch runs, so the vulnerable and secure behaviour are two states of one function rather than two separate applications \u2014 this isolates the vulnerability to exactly the missing condition on the highlighted line."));

children.push(h2("7.2 Findings"));
children.push(body([{ text: "Finding F1 \u2014 Broken Object-Level Authorization on account/transaction endpoints", bold: true }]));
children.push(body([{ text: "Affected component / endpoint: ", bold: true }, { text: "GET /api/accounts/{id} and GET /api/accounts/{id}/transactions." }]));
children.push(body([{ text: "Vulnerability class / CWE: ", bold: true }, { text: "Broken Object Level Authorization (OWASP API1:2023); CWE-639, Authorization Bypass Through User-Controlled Key." }]));
children.push(body([{ text: "CVSS v3.1 base vector: ", bold: true }, { text: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N \u2014 base score 6.5 (Medium)." }]));
children.push(body("Justification: Attack Vector Network \u2014 exploited over the same HTTP API any legitimate client uses. Attack Complexity Low \u2014 no special conditions, only changing an integer. Privileges Required Low \u2014 the attacker must be authenticated, but as any ordinary user, not a privileged one. User Interaction None \u2014 fully attacker-driven. Scope Unchanged \u2014 the vulnerable component and the impacted component (the accounts/transactions API) are the same. Confidentiality High \u2014 another user's full transaction history and balance are disclosed. Integrity None and Availability None \u2014 the endpoints are read-only; no data is modified and no service is disrupted."));
children.push(body([{ text: "Preconditions to exploit: ", bold: true }, { text: "the attacker must hold a valid session (their own JWT) for any account, and must know or guess a target account_id; ids are small sequential integers, so guessing is trivial." }]));
children.push(body([{ text: "Proof of concept: ", bold: true }, { text: "authenticated as alice (account id 1), request GET /api/accounts/2/transactions (bob's account) instead of GET /api/accounts/1/transactions. The response below was captured live by the application's own request/response inspector:" }]));
children.push(codeBlock([
  "GET /api/accounts/2/transactions",
  "Authorization: Bearer <alice's JWT>",
  "",
  "HTTP/1.1 200 OK",
  "{",
  "  \"account_id\": 2,",
  "  \"transactions\": [",
  "    { \"id\": 5, \"type\": \"credit\", \"amount\": 1500, \"description\": \"Salary deposit\" },",
  "    { \"id\": 6, \"type\": \"debit\",  \"amount\": 350.6, \"description\": \"Rent payment\" }",
  "  ]",
  "}",
]));
children.push(imagePara(IMG_EXPLOIT, 480, 250));
children.push(caption("Figure 3 \u2014 Proof of concept: authenticated as alice, account id 2 (bob's) returns 200 with bob's real transactions."));
children.push(body([{ text: "Business impact: ", bold: true }, { text: "any customer of the bank could read any other customer's balance and full transaction history \u2014 a direct, disclosed breach of financial privacy with no special tooling required." }]));
children.push(body([{ text: "Remediation applied: ", bold: true }, { text: "see \u00a77.3 for the code change." }]));
children.push(body([{ text: "Verification evidence: ", bold: true }, { text: "the identical request against the secure build returns 403 (\u00a77.4, \u00a78.2)." }]));

children.push(h2("7.3 Defended Build"));
children.push(body("Countermeasures, grouped by layer:"));
children.push(body([{ text: "Code-level (implemented): ", bold: true }]));
children.push(codeBlock([
  "function findOwnedAccount(id, ownerId) {",
  "  return db.prepare(",
  "    \"SELECT * FROM accounts WHERE id = ? AND owner_id = ?\"",
  "  ).get(id, ownerId);",
  "}",
]));
children.push(body("resolveAccess() calls this instead of the unscoped lookup when AUTHZ_MODE=secure. The parameterised query prevents SQL injection as a side effect, and the owner_id = ? clause means a mismatched account never leaves the database at all \u2014 not merely hidden by application logic afterward. A request for an account that exists but is owned by someone else now returns 403 Forbidden: you do not own this account."));
children.push(body([{ text: "Architectural (implemented): ", bold: true }, { text: "every account-scoped route calls the same resolveAccess() function, so there is exactly one authorization chokepoint in the codebase; an access_logs table records every request \u2014 allowed or blocked \u2014 with requester, target account, and outcome (\u00a76.2\u2013\u00a76.5, \u00a710)." }]));
children.push(body([{ text: "Configuration-level (partially implemented): ", bold: true }, { text: "the JWT signing secret and AUTHZ_MODE are read from a git-ignored .env file rather than hardcoded. Security response headers (CSP, HSTS, X-Content-Type-Options) and cookie flags were not implemented, since the session token is carried in an Authorization header rather than a cookie; this is recorded as a gap in \u00a79 rather than presented as done." }]));
children.push(body([{ text: "Automation (not implemented): ", bold: true }, { text: "no SAST/DAST/SCA pipeline or automated regression suite was built; verification in this project was manual (\u00a76.5, \u00a77.4). Noted as future work in \u00a711.2." }]));

children.push(h2("7.4 Test Cases"));
children.push(table(
  ["TC ID", "Objective", "Input", "Before fix", "After fix", "Pass?"],
  [
    ["TC1", "Own account access still works", "GET /api/accounts/1 as alice (id 1)", "200, own data", "200, own data", "Yes"],
    ["TC2", "Cross-account access via tampered id", "GET /api/accounts/2 as alice (bob's id)", "200, bob's data (fail)", "403, blocked", "Yes"],
    ["TC3", "Nonexistent account id", "GET /api/accounts/99", "404", "404", "Yes"],
    ["TC4", "Unauthenticated request", "GET /api/accounts/1, no token", "401", "401", "Yes"],
  ],
  [900, 2600, 2600, 1500, 1400, 800]
));

// ==========================================================================
// 8. RESULTS AND ANALYSIS
// ==========================================================================
children.push(h1("8. RESULTS AND ANALYSIS"));

children.push(h2("8.1 Findings Summary"));
children.push(table(
  ["Finding", "Class / CWE", "CVSS", "Severity", "Status"],
  [["F1", "BOLA / CWE-639", "6.5", "Medium", "Fixed \u2014 verified"]],
  [900, 2800, 1400, 1800, 2900]
));
children.push(caption("Figure 4 \u2014 Severity distribution: one confirmed finding, Medium severity (a distribution chart is not meaningful for a single finding, so it is shown directly)."));
children.push(barChart([{ label: "F1 (Medium)", widthDxa: 3380, fill: "E9A23B", valueText: "6.5 / 10" }]));

children.push(h2("8.2 Before vs After Comparison"));
children.push(table(
  ["Request", "Vulnerable build", "Secure build"],
  [
    ["GET /api/accounts/2 (as alice)", "200, bob's account returned", "403, Forbidden: not owner"],
    ["GET /api/accounts/2/transactions (as alice)", "200, bob's transactions returned", "403, blocked"],
    ["Security Log entry", "ALLOWED", "BLOCKED"],
    ["GET /api/accounts/1 (own account)", "200, unaffected", "200, unaffected"],
  ],
  [3400, 3300, 2800]
));
children.push(caption("Figure 5 \u2014 Exploitable findings before and after remediation."));
children.push(barChart([
  { label: "Before fix", widthDxa: 3380, fill: "C0392B", valueText: "1 exploitable" },
  { label: "After fix", widthDxa: 200, fill: "27AE60", valueText: "0" },
]));

children.push(h2("8.3 Performance Impact of Defences"));
children.push(body("No dedicated load or latency benchmarking was performed; this is a stated limitation (\u00a79), not a claimed measurement. Qualitatively, the fix adds one additional equality condition (owner_id = ?) to a query that already filters by the accounts table's primary key on a two-row demo dataset, so any added cost is expected to be far below the normal jitter of Node's single-threaded event loop and not observable without formal profiling on a realistically sized dataset."));

children.push(h2("8.4 Root-Cause Analysis"));
children.push(body("The root cause was not a missing feature but a missing comparison: the vulnerable handler correctly authenticated the caller (requireAuth verified the JWT) but then queried the resource by the client-supplied identifier alone, implicitly trusting that a logged-in user is automatically entitled to any resource whose id they can guess. This is the exact anti-pattern CWE-639 and OWASP API1:2023 describe: authentication and authorization were conflated into a single check, when they are two separate questions that both must be answered before returning data."));

children.push(h2("8.5 Discussion"));
children.push(body("No defence in the secure build was found to be bypassable within this project's scope: TC1\u2013TC4 (\u00a77.4) all passed, and no alternate request shape (different HTTP method, trailing slash, alternate casing of the path) was found to reach the vulnerable code path once resolveAccess() was the single chokepoint for both endpoints. The honest caveat is that this project did not attempt more adversarial bypass techniques \u2014 HTTP parameter pollution, type confusion in the id parameter, or race conditions \u2014 so an absence of a bypass found is not the same as a formal guarantee; see \u00a79."));

// ==========================================================================
// 9. LIMITATIONS
// ==========================================================================
children.push(h1("9. LIMITATIONS"));
children.push(...bulletList([
  "Coverage: only the two account-scoped endpoints were tested for BOLA; other OWASP Top 10 categories (XSS, CSRF, SSRF, injection) were out of scope and not assessed.",
  "Tools: no automated DAST/proxy tool (Burp Suite, OWASP ZAP) or scanner (Nuclei, sqlmap) was used; testing was entirely manual, appropriate to a two-endpoint known surface but not representative of a full assessment.",
  "Environment: a single local Windows instance with SQLite and two seeded users is not representative of a production deployment (MySQL/Postgres at scale, concurrent users, network latency); no load-realistic or concurrency testing was performed.",
  "Validity: the performance discussion in \u00a78.3 is qualitative reasoning, not a measured benchmark; results describe correctness of the fix, not its behaviour under production traffic.",
]));

// ==========================================================================
// 10. CONTEMPORARY ISSUES
// ==========================================================================
children.push(h1("10. CONTEMPORARY ISSUES"));
children.push(body("CVE-2026-23844 (Whisper Money, disclosed 19 Jan 2026) affected a personal-finance application where improper object-level authorization let a user interact with another user's bank-account information \u2014 the same failure class and the same domain (personal finance) as Finding F1. The ownership-scoped query pattern in \u00a77.3 (owner_id = ? on every account lookup) is exactly the class of fix that closes this kind of issue. CVE-2026-53903 (MyComplianceOffice, disclosed 1 Jul 2026) shows the same pattern outside banking specifically: an authenticated user retrieved another user's trading document by supplying its identifier, because ownership was never checked \u2014 confirming BOLA is a cross-domain, not banking-specific, weakness."));
children.push(body("More broadly, this project's shape \u2014 a thin frontend calling a REST API that is the actual security boundary \u2014 is now the default architecture for most web and mobile applications, which is precisely why OWASP maintains a separate, API-focused Top 10 alongside the general one: the \u201capi-first attack surface\u201d makes object-level authorization checks on every resource-accepting endpoint, not just the login page, the primary defence that matters."));

// ==========================================================================
// 11. CONCLUSION AND FUTURE WORK
// ==========================================================================
children.push(h1("11. CONCLUSION AND FUTURE WORK"));

children.push(h2("11.1 Conclusion"));
children.push(body("Against the objectives in \u00a71.3: a working banking application with real JWT authentication was built (objective 1); a genuine BOLA vulnerability was identified and reproduced with captured request/response evidence rather than described abstractly (objective 2); it was remediated with a server-side ownership check and verified using the identical request that previously succeeded, with no regression to legitimate access (objective 3); and an access-logging layer was added so a future attempt is auditable rather than silent (objective 4). The key security lesson generalises beyond this one endpoint: authentication and authorization are separate questions, and an API is only as safe as its weakest per-object check \u2014 not its login page."));

children.push(h2("11.2 Future Work"));
children.push(...bulletList([
  "Extend coverage to other OWASP API Top 10 categories not exercised here, particularly Broken Authentication (API2) and Excessive Data Exposure (API3).",
  "Add rate limiting and standard security response headers, both scoped out of the current defended build (\u00a77.3).",
  "Integrate automated SAST/DAST/SCA scanning and a regression test suite so each fixed vulnerability has a permanent automated check.",
  "Move from a single local SQLite instance to a containerised, reproducible lab setup for realistic performance and concurrency testing.",
]));

// ==========================================================================
// 12. INDIVIDUAL CONTRIBUTIONS
// ==========================================================================
children.push(h1("12. INDIVIDUAL CONTRIBUTIONS"));
children.push(body("Percentages below are an initial estimate for the team to review, adjust, and sign.", { italics: true }));
children.push(table(
  ["Name", "Reg. No.", "Sections / tasks owned", "% contribution"],
  [
    ["Anshika Raj", "23BCI0100", "Backend APIs, database, JWT auth logic, report and documentation", "35%"],
    ["Aditya Prakash", "23BCI0089", "Frontend (login, dashboard, transactions), defence implementation", "30%"],
    ["Aryan Sharma", "23BCI0154", "Vulnerability identification, exploit testing, defence implementation and re-testing", "35%"],
  ],
  [1800, 1500, 4400, 1660]
));

// ==========================================================================
// 13. REFERENCES
// ==========================================================================
children.push(h1("13. REFERENCES"));
children.push(body("IEEE format, numbered in order of citation.", { italics: true }));
[
  "OWASP Foundation, \u201cAPI1:2023 \u2013 Broken Object Level Authorization,\u201d OWASP API Security Top 10, 5 Jun. 2023. [Online]. Available: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/",
  "OWASP Foundation, \u201cInsecure Direct Object Reference Prevention Cheat Sheet,\u201d OWASP Cheat Sheet Series. [Online]. Available: https://cheatsheetseries.owasp.org/",
  "MITRE, \u201cCWE-639: Authorization Bypass Through User-Controlled Key,\u201d Common Weakness Enumeration, updated 30 Apr. 2026. [Online]. Available: https://cwe.mitre.org/data/definitions/639.html",
  "NIST National Vulnerability Database, \u201cCVE-2024-37889 \u2013 MyFinances,\u201d 14 Jun. 2024.",
  "NIST National Vulnerability Database, \u201cCVE-2024-52294 \u2013 Khoj,\u201d 30 Dec. 2024.",
  "NIST National Vulnerability Database, \u201cCVE-2026-23844 \u2013 Whisper Money,\u201d 19 Jan. 2026.",
  "NIST National Vulnerability Database, \u201cCVE-2026-53903 \u2013 MyComplianceOffice,\u201d 1 Jul. 2026.",
  "A. Hoffman, Web Application Security: Exploitation and Countermeasures for Modern Web Applications, 1st ed. Sebastopol, CA: O'Reilly Media, 2020.",
  "FIRST.org, \u201cCommon Vulnerability Scoring System v3.1: Specification Document,\u201d 2019. [Online]. Available: https://www.first.org/cvss/v3.1/specification-document",
  "M. Jones, J. Bradley, and N. Sakimura, \u201cJSON Web Token (JWT),\u201d RFC 7519, Internet Engineering Task Force, May 2015.",
].forEach(t => children.push(numberedItem(t)));

// ==========================================================================
// 14. APPENDICES
// ==========================================================================
children.push(h1("14. APPENDICES"));
children.push(...bulletList([
  "Appendix A \u2014 Full source code of the vulnerable and patched builds: project root, src/routes/accounts.js (single AUTHZ_MODE toggle, \u00a77.1/\u00a77.3).",
  "Appendix B \u2014 Raw request/response evidence: \u00a77.2 (Finding F1) and the application's own Security Log page.",
  "Appendix C \u2014 Payload list: account ids 1 (alice, own) and 2 (bob, cross-account) as used in \u00a77.2 and \u00a77.4.",
  "Appendix D \u2014 Environment setup: npm install, npm run seed, npm start (README.md in the project root); AUTHZ_MODE is set in .env or toggled live via the in-app \u201cSwitch mode\u201d control.",
  "Appendix E \u2014 Ethical-use declaration: see page 2.",
]));

// ---------- Formatting checklist (template's own page \u2014 delete before final PDF export if not required) ----------
children.push(h1("REPORT FORMATTING CHECKLIST", { pageBreakBefore: true }));
children.push(...bulletList([
  "Body font: Times New Roman 12 pt; 1.5 line spacing; justified.",
  "Headings numbered exactly as in this template; sections not renamed or reordered.",
  "Every figure and table numbered and captioned; every figure referenced in the text.",
  "Every claim, payload or statistic taken from another source is cited.",
  "Report to be submitted as PDF, plus the source repository, demo and slides.",
  "Right-click the Table of Contents and choose \u201cUpdate Field\u201d before exporting to PDF.",
]));

// ==========================================================================
const doc = new Document({
  numbering: {
    config: [
      { reference: "bullet-list", levels: [{ level: 0, format: "bullet", text: "\u25aa", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 260 } } } }] },
      { reference: "num-list", levels: [{ level: 0, format: "decimal", text: "[%1]", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 320 } } } }] },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "IDOR Banking Demo \u2014 Case Study Project Report", font: FONT, size: 16, color: "888888" })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })],
          })],
        }),
      },
      children,
    },
  ],
});

const outPath = path.join(__dirname, "Project_Report.docx");
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log("Wrote " + outPath);
});
