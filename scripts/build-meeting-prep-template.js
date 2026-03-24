/**
 * Build Meeting Prep Word template with professional styling.
 * Uses {{camelCase}} placeholders for PizZip string replacement.
 * Run: node scripts/build-meeting-prep-template.js
 */
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType } from "docx";
import { writeFileSync } from "fs";

const NAVY = "1B3A5C";
const BLUE = "2E6DA4";
const LIGHT_BLUE = "D6E4F0";
const WHITE = "FFFFFF";
const LIGHT_GRAY = "F4F6F8";
const DARK_TEXT = "2C3E50";
const MED_TEXT = "555555";

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }
};

function heading(text) {
  return new Paragraph({
    spacing: { before: 250, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BLUE } },
    children: [new TextRun({ text, bold: true, size: 24, color: NAVY, font: "Calibri" })]
  });
}

function field(label, tag) {
  return new Paragraph({ spacing: { after: 40 }, children: [
    new TextRun({ text: label + ": ", bold: true, size: 20, color: MED_TEXT, font: "Calibri" }),
    new TextRun({ text: `{{${tag}}}`, size: 20, color: DARK_TEXT, font: "Calibri" })
  ]});
}

function spacer(size = 80) {
  return new Paragraph({ spacing: { after: size }, children: [] });
}

function lCell(text, width = 1800) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 19, color: MED_TEXT, font: "Calibri" })] })]
  });
}

function vCell(tag, width = 3200) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: `{{${tag}}}`, size: 20, color: DARK_TEXT, font: "Calibri" })] })]
  });
}

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 22, color: DARK_TEXT } } } },
  sections: [{
    properties: { page: { margin: { top: 600, bottom: 600, left: 800, right: 800 } } },
    children: [
      // Header
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: 10000, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: NAVY },
            margins: { top: 100, bottom: 100, left: 200, right: 200 },
            children: [
              new Paragraph({ children: [
                new TextRun({ text: "DAX", bold: true, size: 36, color: WHITE, font: "Calibri" }),
                new TextRun({ text: "  |  Meeting Prep Brief", size: 28, color: LIGHT_BLUE, font: "Calibri" })
              ]}),
              new Paragraph({ spacing: { before: 40 }, children: [
                new TextRun({ text: "{{clientName}}", size: 26, color: WHITE, font: "Calibri", bold: true }),
                new TextRun({ text: "  |  {{meetingDate}}{{meetingTime}}", size: 22, color: LIGHT_BLUE, font: "Calibri" })
              ]})
            ]
          })
        ]})]
      }),

      spacer(150),

      // Client Snapshot
      heading("Client Snapshot"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [
          new TableRow({ children: [lCell("Account:"), vCell("accountNumber"), lCell("Risk:"), vCell("riskProfile")] }),
          new TableRow({ children: [lCell("Objective:"), vCell("investmentObjective"), lCell("Horizon:"), vCell("timeHorizon")] }),
        ]
      }),
      field("Interests", "tags"),
      field("Background", "backgroundInfo"),

      spacer(),

      // Market Context
      heading("Market Context"),
      field("SPY (S&P 500)", "benchmarkToday"),
      field("Portfolio Value", "portfolioValue"),
      field("Top Holding", "topHolding"),

      spacer(),

      // Last Meeting Notes
      heading("Last Meeting Notes"),
      new Paragraph({ spacing: { after: 60 }, children: [
        new TextRun({ text: "{{lastMeetingNotes}}", size: 20, color: DARK_TEXT, font: "Calibri" })
      ]}),

      spacer(),

      // Action Items
      heading("Outstanding Action Items"),
      new Paragraph({ spacing: { after: 30 }, indent: { left: 360 }, children: [new TextRun({ text: "1. {{action1}}", size: 20, font: "Calibri" })] }),
      new Paragraph({ spacing: { after: 30 }, indent: { left: 360 }, children: [new TextRun({ text: "2. {{action2}}", size: 20, font: "Calibri" })] }),
      new Paragraph({ spacing: { after: 30 }, indent: { left: 360 }, children: [new TextRun({ text: "3. {{action3}}", size: 20, font: "Calibri" })] }),

      spacer(),

      // Next Meeting
      heading("Next Scheduled Meeting"),
      field("Date", "nextMeetingDate"),

      spacer(),

      // Talking Points
      heading("Key Talking Points"),
      new Paragraph({ spacing: { after: 60 }, children: [
        new TextRun({ text: "{{talkingPoints}}", size: 20, color: DARK_TEXT, font: "Calibri" })
      ]}),

      spacer(150),

      // Footer
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: 10000, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: NAVY },
            margins: { top: 60, bottom: 60, left: 200, right: 200 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "Prepared by {{advisorName}}  |  {{reportDate}}  |  Powered by DAX — Dakona LLC", size: 17, color: LIGHT_BLUE, font: "Calibri", italics: true })
              ]})
            ]
          })
        ]})]
      }),
    ]
  }]
});

const buffer = await Packer.toBuffer(doc);
const outPath = "docs/templates/Meeting-Prep-TEMPLATE.docx";
writeFileSync(outPath, buffer);
console.log(`Template saved: ${outPath} (${buffer.length} bytes)`);
