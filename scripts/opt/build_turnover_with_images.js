// OPT Solutions — Turnover Documentation Builder (with screenshots)
// Run from P:\_clients\opt-solutions\: node build_turnover_with_images.js
// Screenshots must be at ./screenshots/
// Output: ./OPT_Solutions_Handover_Documentation.docx

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, LevelFormat, TabStopType, SimpleField, ImageRun
} = require('docx');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const OUTPUT_PATH = path.join(__dirname, "OPT_Solutions_Handover_Documentation.docx");

const BRAND="1E4D78", ACCENT="2E86C1", WHITE="FFFFFF", GREY="F2F3F4", DKGREY="5D6D7E";
const sp=(b=0,a=0)=>({before:b,after:a});
const b1=(c="CCCCCC")=>({style:BorderStyle.SINGLE,size:1,color:c});
const allB=(c="CCCCCC")=>({top:b1(c),bottom:b1(c),left:b1(c),right:b1(c)});
const cm={top:80,bottom:80,left:120,right:120};

function h1(t){return new Paragraph({heading:HeadingLevel.HEADING_1,spacing:sp(300,120),children:[new TextRun({text:t,bold:true,size:28,color:BRAND,font:"Arial"})]})}
function h2(t){return new Paragraph({heading:HeadingLevel.HEADING_2,spacing:sp(240,80),children:[new TextRun({text:t,bold:true,size:24,color:ACCENT,font:"Arial"})]})}
function body(t,o={}){return new Paragraph({spacing:sp(80,80),children:[new TextRun({text:t,size:20,font:"Arial",...o})]})}
function boldt(t){return body(t,{bold:true})}
function gap(n=1){return Array.from({length:n},()=>new Paragraph({spacing:sp(60,60),children:[new TextRun("")]}))}
function bullet(t,l=0){return new Paragraph({numbering:{reference:"bullets",level:l},spacing:sp(40,40),children:[new TextRun({text:t,size:20,font:"Arial"})]})}
function rule(c=BRAND){return new Paragraph({spacing:sp(0,0),border:{bottom:{style:BorderStyle.SINGLE,size:12,color:c,space:1}},children:[new TextRun("")]})}

function img(filename,label){
  const p=path.join(SCREENSHOTS_DIR,filename);
  if(fs.existsSync(p)){
    const data=fs.readFileSync(p);
    return new Paragraph({spacing:sp(120,120),children:[new ImageRun({data,type:"png",transformation:{width:614,height:380}})]});
  }
  console.warn("Missing screenshot: "+filename);
  return new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[9360],rows:[new TableRow({children:[new TableCell({borders:allB("2E86C1"),width:{size:9360,type:WidthType.DXA},margins:{top:200,bottom:200,left:200,right:200},shading:{fill:"EBF5FB",type:ShadingType.CLEAR},children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:sp(80,80),children:[new TextRun({text:`[Screenshot: ${label}]`,size:20,color:ACCENT,italics:true,font:"Arial"})]})]})]})]});
}

function twoCol(rows){return new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2880,6480],rows:rows.map(([l,v])=>new TableRow({children:[new TableCell({borders:allB(),width:{size:2880,type:WidthType.DXA},margins:cm,shading:{fill:GREY,type:ShadingType.CLEAR},children:[new Paragraph({spacing:sp(40,40),children:[new TextRun({text:l,bold:true,size:19,font:"Arial"})]})] }),new TableCell({borders:allB(),width:{size:6480,type:WidthType.DXA},margins:cm,children:[new Paragraph({spacing:sp(40,40),children:[new TextRun({text:v,size:19,font:"Arial"})]})]})]}))});}
function hRow(cols,ws){return new TableRow({tableHeader:true,children:cols.map((c,i)=>new TableCell({borders:allB(BRAND),width:{size:ws[i],type:WidthType.DXA},margins:cm,shading:{fill:BRAND,type:ShadingType.CLEAR},children:[new Paragraph({spacing:sp(40,40),children:[new TextRun({text:c,bold:true,size:19,color:WHITE,font:"Arial"})]})]}))})}
function dRow(cells,ws,shade=false){return new TableRow({children:cells.map((c,i)=>new TableCell({borders:allB(),width:{size:ws[i],type:WidthType.DXA},margins:cm,shading:{fill:shade?GREY:WHITE,type:ShadingType.CLEAR},children:[new Paragraph({spacing:sp(40,40),children:[new TextRun({text:c,size:19,font:"Arial"})]})]}))})}

const doc=new Document({
  numbering:{config:[{reference:"bullets",levels:[{level:0,format:LevelFormat.BULLET,text:"\u2022",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}},{level:1,format:LevelFormat.BULLET,text:"\u25E6",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:1080,hanging:360}}}}]}]},
  styles:{default:{document:{run:{font:"Arial",size:20}}},paragraphStyles:[{id:"Heading1",name:"Heading 1",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:28,bold:true,font:"Arial",color:BRAND},paragraph:{spacing:{before:300,after:120},outlineLevel:0}},{id:"Heading2",name:"Heading 2",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:24,bold:true,font:"Arial",color:ACCENT},paragraph:{spacing:{before:240,after:80},outlineLevel:1}}]},
  sections:[{
    properties:{page:{size:{width:12240,height:15840},margin:{top:1440,right:1440,bottom:1440,left:1440}}},
    headers:{default:new Header({children:[new Paragraph({spacing:sp(0,80),border:{bottom:{style:BorderStyle.SINGLE,size:6,color:ACCENT,space:1}},tabStops:[{type:TabStopType.RIGHT,position:9360}],children:[new TextRun({text:"OPT Solutions — Commission Tracking System",size:16,color:DKGREY,font:"Arial"}),new TextRun({text:"\tSystem Handover Documentation",size:16,color:DKGREY,font:"Arial"})]})]})}},
    footers:{default:new Footer({children:[new Paragraph({spacing:sp(80,0),border:{top:{style:BorderStyle.SINGLE,size:6,color:ACCENT,space:1}},tabStops:[{type:TabStopType.RIGHT,position:9360}],children:[new TextRun({text:"1AltX LLC  |  richard@1altx.com",size:16,color:DKGREY,font:"Arial"}),new TextRun({text:"\tPage ",size:16,color:DKGREY,font:"Arial"}),new SimpleField("PAGE",{size:16,color:DKGREY,font:"Arial"})]})]})}},
    children:[
      ...gap(4),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:sp(0,0),children:[new TextRun({text:"OPT SOLUTIONS",size:52,bold:true,color:BRAND,font:"Arial"})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:sp(80,80),children:[new TextRun({text:"Commission Tracking System",size:36,color:ACCENT,font:"Arial"})]}),
      rule(),...gap(1),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:sp(80,80),children:[new TextRun({text:"SYSTEM HANDOVER DOCUMENTATION",size:24,bold:true,color:DKGREY,font:"Arial",characterSpacing:40})]}),
      ...gap(1),rule(),...gap(3),
      twoCol([["Prepared by","Richard Mabbun — 1AltX LLC"],["Prepared for","Sunny Ghimire — OPT Solutions Pty Ltd"],["Date","April 2026"],["Version","1.0 — Final Handover"]]),...gap(2),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:sp(80,80),children:[new TextRun({text:"richard@1altx.com  |  1altx.com",size:18,color:DKGREY,italics:true,font:"Arial"})]}),
      new Paragraph({children:[new PageBreak()]}),
      h1("1. System Overview"),body("The OPT Solutions Commission Tracking System automates the import, calculation, and reporting of monthly merchant commission data from Tyro and Nuvei (formerly Till). Four platforms connect into a single automated pipeline:"),...gap(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2340,7020],rows:[hRow(["Platform","Role"],[2340,7020]),dRow(["Google Drive","Storage for incoming commission report files (Tyro + Nuvei)"],[2340,7020]),dRow(["n8n (Automation)","Watches Drive for new files, processes them, writes to Airtable and HubSpot"],[2340,7020],true),dRow(["Airtable","Transaction database — stores every merchant's monthly commission data"],[2340,7020]),dRow(["HubSpot","CRM — merchant profiles, performance dashboards, and reporting"],[2340,7020],true)]}),
      ...gap(1),h2("How it works"),bullet("Drop a monthly commission file into the Google Drive folder"),bullet("n8n detects the new file within the hour and processes it"),bullet("An AI agent reads the file and calculates each merchant's net commission"),bullet("Data is written to Airtable and HubSpot is updated automatically"),bullet("View results in the HubSpot Commission Overview and Merchant Performance dashboards"),...gap(1),
      img("08_n8n_workflows.png","n8n workflows list"),...gap(1),new Paragraph({children:[new PageBreak()]}),
      h1("2. Google Drive — File Upload"),body("Commission files must be uploaded to specific folders in Google Drive. The automation watches these folders and triggers automatically."),...gap(1),h2("Folder Structure"),
      twoCol([["Tyro files","OPT Commission Imports / Tyro"],["Nuvei files","OPT Commission Imports / Nuvei"],["Check frequency","Hourly"]]),...gap(1),h2("File formats"),
      bullet("Tyro: .xlsx — multi-tab, one sheet per channel"),bullet("Nuvei/Till: .xlsx — multi-row with income, expense and adjustment rows per merchant"),...gap(1),h2("Important"),
      bullet("Do not rename files after uploading"),bullet("Each file is processed once — duplicates are detected and skipped"),...gap(1),
      img("07_google_drive_folders.png","Google Drive folder structure"),...gap(1),new Paragraph({children:[new PageBreak()]}),
      h1("3. n8n — Automation Workflows"),body("Three workflows run automatically in your n8n account at optsolutions.app.n8n.cloud."),...gap(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3120,4680,1560],rows:[hRow(["Workflow","Purpose","Status"],[3120,4680,1560]),dRow(["OPT - Tyro Commission Import","Reads Tyro files, extracts merchant data using AI, writes to Airtable and HubSpot","Published"],[3120,4680,1560]),dRow(["OPT - Nuvei Commission Import","Reads Nuvei files, calculates net commission (income minus expenses and adjustments), writes to Airtable and HubSpot","Published"],[3120,4680,1560],true),dRow(["OPT - Merchant Sync","Keeps merchant MID records in sync between Airtable and HubSpot","Published"],[3120,4680,1560])]}),
      ...gap(1),h2("Nuvei commission calculation"),bullet("Residual Adjustment: flat -$30 if monthly volume under $3,000"),bullet("Velocity Points: -0.10% of volume (opted-in merchants only)"),bullet("Same-Day Funding: -0.10% of volume (opted-in merchants only)"),bullet("Net Payout = Gross Profit minus all adjustments"),...gap(1),
      img("09_n8n_tyro_workflow.png","Tyro workflow canvas"),...gap(1),img("10_n8n_nuvei_workflow.png","Nuvei workflow canvas"),...gap(1),
      h2("If a workflow fails"),bullet("Log into optsolutions.app.n8n.cloud and click Executions"),bullet("Red entries indicate failures — click to see the error"),bullet("Email richard@1altx.com with the filename and error description"),...gap(1),new Paragraph({children:[new PageBreak()]}),
      h1("4. Airtable — Transaction Database"),body("Airtable stores every merchant's monthly commission records. You own this base in your Airtable workspace."),...gap(1),h2("Tables"),
      twoCol([["Merchants","One record per merchant — MID, provider, name, HubSpot ID, status"],["Transactions","One record per merchant per month — all commission fields populated automatically"]]),...gap(1),h2("Key transaction fields"),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2600,6760],rows:[hRow(["Field","Description"],[2600,6760]),dRow(["Volume","Total card volume"],[2600,6760]),dRow(["Income / Expense","Revenue and cost rows (Nuvei only)"],[2600,6760],true),dRow(["Gross Profit","Income minus Expense"],[2600,6760]),dRow(["Adjustment Total","Sum of named adjustments (Nuvei only)"],[2600,6760],true),dRow(["Commission","Net Payout — the amount you earn per merchant"],[2600,6760]),dRow(["Merchant","Linked to Merchants table"],[2600,6760],true),dRow(["Transaction ID","Unique key: MID_YYYY-MM_provider"],[2600,6760])]}),
      ...gap(1),img("05_airtable_merchants.png","Airtable — Merchants table"),...gap(1),img("06_airtable_transactions.png","Airtable — Transactions table"),...gap(1),new Paragraph({children:[new PageBreak()]}),
      h1("5. HubSpot — CRM & Reporting"),body("HubSpot is your primary reporting and merchant management interface. All 30 merchants are set up as Company records."),...gap(1),h2("Merchant company records"),
      bullet("Legal name and trading name"),bullet("MID for Tyro and/or Nuvei"),bullet("Current payment provider, activation date, surcharge rate"),bullet("Linked contact — name, phone, email"),...gap(1),
      img("01_hubspot_companies.png","HubSpot — Companies list"),...gap(1),img("02_hubspot_company_detail.png","HubSpot — Merchant record"),...gap(1),h2("Dashboards"),
      boldt("Commission Overview"),bullet("Total monthly commission, by provider, month-over-month trends"),...gap(0),boldt("Merchant Performance"),bullet("Per-merchant commission, volume, and transaction counts"),...gap(1),
      img("03_hubspot_dashboard_commission.png","HubSpot — Commission Overview"),...gap(1),img("04_hubspot_dashboard_merchant.png","HubSpot — Merchant Performance"),...gap(1),new Paragraph({children:[new PageBreak()]}),
      h1("6. Monthly Process — Step by Step"),body("Each month when you receive commission reports:"),...gap(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[780,8580],rows:[hRow(["Step","Action"],[780,8580]),dRow(["1","Open Google Drive — OPT Commission Imports"],[780,8580]),dRow(["2","Upload Tyro .xlsx file to the Tyro subfolder"],[780,8580],true),dRow(["3","Upload Nuvei/Till .xlsx file to the Nuvei subfolder"],[780,8580]),dRow(["4","Wait up to 1 hour for n8n to process"],[780,8580],true),dRow(["5","Open HubSpot Commission Overview to verify new data"],[780,8580]),dRow(["6","Check merchant records if needed — Airtable is also updated automatically"],[780,8580],true)]}),
      ...gap(1),h2("Adding a new merchant"),bullet("Create a Company record in HubSpot with their details and MID"),bullet("The automation links them on the next import"),...gap(1),new Paragraph({children:[new PageBreak()]}),
      h1("7. Account Ownership"),...gap(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2340,2340,4680],rows:[hRow(["System","Owner","Notes"],[2340,2340,4680]),dRow(["HubSpot","OPT Solutions","Portal 441994755 — app-ap1.hubspot.com"],[2340,2340,4680]),dRow(["Google Drive","OPT Solutions","OPT Commission Imports folder"],[2340,2340,4680],true),dRow(["n8n","OPT Solutions","optsolutions.app.n8n.cloud — Starter plan"],[2340,2340,4680]),dRow(["Airtable","OPT Solutions","OPT Solutions workspace — free plan"],[2340,2340,4680],true),dRow(["Anthropic API","OPT Solutions","Key in n8n — renew at console.anthropic.com if expired"],[2340,2340,4680])]}),
      ...gap(1),new Paragraph({children:[new PageBreak()]}),
      h1("8. Support & Maintenance"),twoCol([["Contact","Richard Mabbun — richard@1altx.com"],["Company","1AltX LLC"],["Website","1altx.com"],["Response time","Within 1 business day"]]),...gap(1),h2("If something stops working"),
      bullet("Check n8n Executions for red failed runs"),bullet("Verify your Google Drive file is the correct format"),bullet("Email richard@1altx.com with the filename and error description"),...gap(1),h2("Ongoing managed subscription — $199/month"),
      bullet("Daily workflow monitoring and prompt resolution of failures"),bullet("Adjustments when processor report formats change"),bullet("Adding new payment processors"),...gap(2),rule(),...gap(1),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:sp(80,80),children:[new TextRun({text:"Thank you for the opportunity to build this system for OPT Solutions.",size:20,italics:true,color:DKGREY,font:"Arial"})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:sp(40,40),children:[new TextRun({text:"richard@1altx.com  |  1altx.com",size:18,color:ACCENT,font:"Arial"})]}),
    ]
  }]
});

Packer.toBuffer(doc).then(b=>{fs.writeFileSync(OUTPUT_PATH,b);console.log("Done: "+OUTPUT_PATH);}).catch(e=>console.error("Error:",e.message));
