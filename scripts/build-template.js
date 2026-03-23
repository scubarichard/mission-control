/**
 * Build Quarterly Review Word template with all 35 placeholder fields.
 * Uses docxtemplater {{TAG}} syntax.
 *
 * Run: node scripts/build-template.js
 */

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType } from "docx";
import { writeFileSync } from "fs";

// ── Helpers ──────────────────────────────────────────────────────────

function heading(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 100 }, children: [
    new TextRun({ text, bold: true, color: "1a3c6e", size: level === HeadingLevel.HEADING_1 ? 32 : 24 })
  ]});
}

function field(label, tag) {
  return new Paragraph({ spacing: { after: 60 }, children: [
    new TextRun({ text: label + ": ", bold: true, size: 20, color: "444444" }),
    new TextRun({ text: `{{${tag}}}`, size: 20 })
  ]});
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const headerShading = { type: ShadingType.SOLID, color: "1a3c6e" };
const altShading = { type: ShadingType.SOLID, color: "f0f4f8" };

function headerCell(text, width = 2500) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: headerShading,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })] })]
  });
}

function dataCell(text, width = 2500, shading = undefined) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading,
    children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })]
  });
}

// ── Document ─────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: "333333" } }
    }
  },
  sections: [{
    properties: {
      page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } }
    },
    children: [

      // ── Header ──────────────────────────────────────────────────
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [
        new TextRun({ text: "{{FIRM_NAME}}", bold: true, size: 36, color: "1a3c6e" })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
        new TextRun({ text: "Quarterly Investment Review", size: 28, color: "666666", italics: true })
      ]}),

      // ── Client Info Table ───────────────────────────────────────
      heading("Client Information"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
        rows: [
          new TableRow({ children: [
            dataCell("Client:", 1800), dataCell("{{CLIENT_NAME}}", 3200),
            dataCell("Account #:", 1800), dataCell("{{ACCOUNT_NUMBER}}", 3200),
          ]}),
          new TableRow({ children: [
            dataCell("Account Type:", 1800), dataCell("{{ACCOUNT_TYPE}}", 3200),
            dataCell("Report Period:", 1800), dataCell("{{REPORT_PERIOD}}", 3200),
          ]}),
          new TableRow({ children: [
            dataCell("Advisor:", 1800), dataCell("{{ADVISOR_NAME}}", 3200),
            dataCell("Report Date:", 1800), dataCell("{{REPORT_DATE}}", 3200),
          ]}),
        ]
      }),

      emptyLine(),

      // ── Portfolio Performance ───────────────────────────────────
      heading("Portfolio Performance"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            headerCell("Portfolio Value", 2500),
            headerCell("YTD Return", 2000),
            headerCell("Benchmark", 2000),
            headerCell("vs Benchmark", 2000),
            headerCell("Top Holding", 2000),
          ]}),
          new TableRow({ children: [
            dataCell("{{PORTFOLIO_VALUE}}", 2500),
            dataCell("{{YTD_RETURN}}", 2000),
            dataCell("{{BENCHMARK_RETURN}}", 2000),
            dataCell("{{VS_BENCHMARK}}", 2000),
            dataCell("{{TOP_HOLDING}}", 2000),
          ]}),
        ]
      }),

      emptyLine(),

      // ── Client Profile ──────────────────────────────────────────
      heading("Client Profile"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
        rows: [
          new TableRow({ children: [
            dataCell("Risk Tolerance:", 2200), dataCell("{{RISK_PROFILE}}", 2800),
            dataCell("Objective:", 2200), dataCell("{{INVESTMENT_OBJECTIVE}}", 2800),
          ]}),
          new TableRow({ children: [
            dataCell("Time Horizon:", 2200), dataCell("{{TIME_HORIZON}}", 2800),
            dataCell("", 2200), dataCell("", 2800),
          ]}),
        ]
      }),

      new Paragraph({ spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "Background: ", bold: true, size: 20, color: "444444" }),
        new TextRun({ text: "{{BACKGROUND_INFO}}", size: 20 })
      ]}),

      emptyLine(),

      // ── Goals ───────────────────────────────────────────────────
      heading("Client Goals"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            headerCell("#", 600), headerCell("Goal", 9400),
          ]}),
          new TableRow({ children: [
            dataCell("1", 600, altShading), dataCell("{{GOAL_1}}", 9400, altShading),
          ]}),
          new TableRow({ children: [
            dataCell("2", 600), dataCell("{{GOAL_2}}", 9400),
          ]}),
          new TableRow({ children: [
            dataCell("3", 600, altShading), dataCell("{{GOAL_3}}", 9400, altShading),
          ]}),
        ]
      }),

      new Paragraph({ spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "Progress Notes: ", bold: true, size: 20, color: "444444" }),
        new TextRun({ text: "{{GOALS_PROGRESS_NOTES}}", size: 20 })
      ]}),

      emptyLine(),

      // ── Meeting Discussion ──────────────────────────────────────
      heading("Meeting Discussion"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
        rows: [
          new TableRow({ children: [
            dataCell("Date:", 1500), dataCell("{{MEETING_DATE}}", 3000),
            dataCell("Location:", 1500), dataCell("{{MEETING_LOCATION}}", 4000),
          ]}),
          new TableRow({ children: [
            dataCell("Duration:", 1500), dataCell("{{MEETING_DURATION}}", 3000),
            dataCell("Attendees:", 1500), dataCell("{{ATTENDEES}}", 4000),
          ]}),
        ]
      }),

      new Paragraph({ spacing: { before: 120 }, children: [
        new TextRun({ text: "Key Discussion Points:", bold: true, size: 20, color: "444444" })
      ]}),
      new Paragraph({ spacing: { after: 40 }, indent: { left: 360 }, children: [
        new TextRun({ text: "1. {{DISCUSSION_POINT_1}}", size: 20 })
      ]}),
      new Paragraph({ spacing: { after: 40 }, indent: { left: 360 }, children: [
        new TextRun({ text: "2. {{DISCUSSION_POINT_2}}", size: 20 })
      ]}),
      new Paragraph({ spacing: { after: 40 }, indent: { left: 360 }, children: [
        new TextRun({ text: "3. {{DISCUSSION_POINT_3}}", size: 20 })
      ]}),

      new Paragraph({ spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: "Advisor Notes: ", bold: true, size: 20, color: "444444" }),
        new TextRun({ text: "{{ADVISOR_NOTES}}", size: 20 })
      ]}),

      emptyLine(),

      // ── Action Items ────────────────────────────────────────────
      heading("Action Items"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            headerCell("#", 500), headerCell("Action", 5000), headerCell("Owner", 2000), headerCell("Due Date", 2500),
          ]}),
          new TableRow({ children: [
            dataCell("1", 500, altShading), dataCell("{{ACTION_1}}", 5000, altShading), dataCell("{{ACTION_1_OWNER}}", 2000, altShading), dataCell("{{ACTION_1_DUE}}", 2500, altShading),
          ]}),
          new TableRow({ children: [
            dataCell("2", 500), dataCell("{{ACTION_2}}", 5000), dataCell("{{ACTION_2_OWNER}}", 2000), dataCell("{{ACTION_2_DUE}}", 2500),
          ]}),
          new TableRow({ children: [
            dataCell("3", 500, altShading), dataCell("{{ACTION_3}}", 5000, altShading), dataCell("{{ACTION_3_OWNER}}", 2000, altShading), dataCell("{{ACTION_3_DUE}}", 2500, altShading),
          ]}),
        ]
      }),

      emptyLine(),

      // ── Next Steps ──────────────────────────────────────────────
      heading("Next Steps"),
      field("Next Meeting", "NEXT_MEETING_DATE"),
      field("Agenda", "NEXT_MEETING_AGENDA"),

      emptyLine(),
      emptyLine(),

      // ── Footer ──────────────────────────────────────────────────
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [
        new TextRun({ text: "This report was prepared by {{FIRM_NAME}} for {{CLIENT_NAME}}.", size: 16, color: "999999", italics: true })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "Generated {{REPORT_DATE}} | Powered by DAX — Governed AI for RIAs", size: 16, color: "999999", italics: true })
      ]}),
    ]
  }]
});

// ── Save ─────────────────────────────────────────────────────────────

const buffer = await Packer.toBuffer(doc);
const outPath = "docs/templates/Quarterly-Review-TEMPLATE.docx";
writeFileSync(outPath, buffer);
console.log(`Template saved: ${outPath} (${buffer.length} bytes)`);
console.log("Placeholders: 35 fields across 7 sections");
