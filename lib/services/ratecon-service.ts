import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "../db";
import { AppError } from "../errors";
import { equipName } from "../sim/equipment";
import { longDay, money } from "../format";

const NAVY = rgb(0.06, 0.13, 0.27);
const BLUE = rgb(0.0, 0.36, 0.78);
const GRAY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.75, 0.78, 0.82);

/** Standard PDF fonts only cover WinAnsi — map the few characters we use that it lacks. */
function clean(s: string) {
  return s
    .replace(/→/g, "->")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…€™]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = clean(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function buildRateCon(loadId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const load = await prisma.load.findUnique({ where: { id: loadId }, include: { broker: true, truck: true, driver: true } });
  if (!load) throw new AppError("Load not found", 404);
  if (!load.bookedRate || !load.rateConNo) throw new AppError("Book the load first to generate a rate confirmation.", 409);
  const s = await prisma.settings.findUnique({ where: { key: "app" } });
  if (!s) throw new AppError("Carrier settings missing", 500);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rate Confirmation ${load.rateConNo}`);
  pdf.setAuthor(load.brokerName);
  pdf.setSubject(`Load ${load.ref}`);
  const page = pdf.addPage([612, 792]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const M = 36;
  const W = 612 - M * 2;
  let y = 792 - M;

  const text = (p: PDFPage, t: string, x: number, yy: number, size = 9, font = reg, color = NAVY) => p.drawText(clean(t), { x, y: yy, size, font, color });
  const hline = (yy: number, x1 = M, x2 = M + W, c = LINE, th = 0.7) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: th, color: c });
  const box = (x: number, yy: number, w: number, h: number, th = 0.8) => page.drawRectangle({ x, y: yy, width: w, height: h, borderColor: NAVY, borderWidth: th });
  const field = (label: string, value: string, x: number, yy: number, w: number) => {
    text(page, label, x, yy, 7, bold, GRAY);
    text(page, value || "—", x, yy - 11, 9.5, reg, NAVY);
    hline(yy - 15, x, x + w);
  };

  // ---- header: broker (issuer) and date ----
  text(page, load.brokerName.toUpperCase(), M, y - 4, 15, bold, BLUE);
  text(page, `${load.broker.address}, ${load.broker.hqCity}, ${load.broker.hqState} ${load.broker.zip}`, M, y - 18, 8.5, reg, GRAY);
  text(page, `MC ${load.broker.mc}  ·  DOT ${load.broker.dot}  ·  ${load.broker.phone}  ·  ${load.broker.email}`, M, y - 29, 8.5, reg, GRAY);
  const rx = M + W - 170;
  text(page, "Date:", rx, y - 4, 9, bold);
  text(page, longDay(load.bookedAt ?? new Date()), rx + 40, y - 4, 9);
  text(page, "Load #:", rx, y - 17, 9, bold);
  text(page, load.ref, rx + 40, y - 17, 9);
  text(page, "Conf #:", rx, y - 30, 9, bold);
  text(page, load.rateConNo, rx + 40, y - 30, 9);
  y -= 44;

  // ---- title bar with checkboxes ----
  page.drawRectangle({ x: M, y: y - 26, width: W, height: 26, color: rgb(0.95, 0.96, 0.98), borderColor: NAVY, borderWidth: 0.8 });
  const cb = (x: number, checked: boolean, label: string) => {
    page.drawRectangle({ x, y: y - 19, width: 11, height: 11, borderColor: NAVY, borderWidth: 1 });
    if (checked) text(page, "X", x + 2.2, y - 17.3, 10, bold);
    text(page, label, x + 17, y - 18, 13, bold);
  };
  cb(M + 14, false, "CUSTOMER");
  cb(M + 170, true, "BROKER RATE CONFIRMATION");
  y -= 40;

  // ---- references ----
  field("FREIGHT BILL NO.", load.rateConNo, M, y, 170);
  field("BILL OF LADING NO.", `BOL-${load.ref.replace(/\D/g, "")}`, M + 190, y, 170);
  field("TRAILER TYPE", `${equipName(load.equipment)} (${load.lengthFt} ft)`, M + 380, y, W - 380);
  y -= 26;

  // ---- terms paragraph ----
  const terms =
    `This confirmation is a contract between the broker named above and the carrier named below for the single shipment described. Carrier's cargo liability shall not exceed $100,000 unless agreed in writing. ` +
    `Carrier agrees not to re-broker, co-broker, double-broker or assign this load; violation voids payment. Claims for loss or damage must be filed within nine (9) months of delivery. ` +
    `Rate includes all charges unless an accessorial is listed below and approved in writing. Detention, layover and TONU are payable only with signed in/out times on the BOL. ` +
    `The rate confirmed below supersedes any previous verbal agreement.`;
  for (const ln of wrap(terms, reg, 7.4, W)) {
    text(page, ln, M, y, 7.4, reg, GRAY);
    y -= 9.2;
  }
  y -= 6;
  page.drawRectangle({ x: M, y: y - 14, width: W, height: 14, color: NAVY });
  text(page, "We respectfully ask that you give no load information to anyone other than the shipper, receiver and broker.", M + 6, y - 10, 7.6, bold, rgb(1, 1, 1));
  y -= 26;

  // ---- stops (left) + load info (right) ----
  const leftW = W * 0.56;
  const rightX = M + leftW + 16;
  const rightW = W - leftW - 16;
  const stopBlock = (title: string, st: typeof load.pickup, yy: number) => {
    text(page, title, M, yy, 10, bold, BLUE);
    let yl = yy - 16;
    field("FACILITY", st.facility, M, yl, leftW);
    yl -= 26;
    field("STREET ADDRESS", st.address, M, yl, leftW);
    yl -= 26;
    field("CITY", st.city, M, yl, leftW * 0.5 - 6);
    field("STATE", st.state, M + leftW * 0.5, yl, leftW * 0.2 - 6);
    field("ZIP", st.zip, M + leftW * 0.7, yl, leftW * 0.3);
    yl -= 26;
    field("DATE", longDay(st.date), M, yl, leftW * 0.5 - 6);
    field(st.appointment ? "APPOINTMENT" : "HOURS (FCFS)", st.appointment ? st.windowStart : `${st.windowStart} – ${st.windowEnd}`, M + leftW * 0.5, yl, leftW * 0.5);
    yl -= 26;
    field("CONTACT", `${st.contact}  ${st.phone}`, M, yl, leftW);
    return yl - 36;
  };
  y -= 8;
  const top = y;
  y = stopBlock("SHIPPER (PICK UP)", load.pickup, y);
  y = stopBlock("CONSIGNEE (DELIVERY)", load.delivery, y);

  let ry = top - 16;
  const c = load.cargo;
  const rightField = (label: string, value: string) => {
    field(label, value, rightX, ry, rightW);
    ry -= 26;
  };
  rightField("MILES", `${load.miles.toLocaleString("en-US")}`);
  rightField("WEIGHT", `${load.weight.toLocaleString("en-US")} lbs`);
  rightField("COMMODITY", load.commodity);
  rightField("PIECES / DIMENSIONS", `${c.pieces} pc · ${c.lengthFt}' L x ${c.widthIn}" W x ${c.heightIn}" H`);
  rightField("VAN OR FLAT", `${equipName(load.equipment)} · ${load.size === "PARTIAL" ? "Partial" : "Full"}`);
  rightField(
    "SECUREMENT",
    [c.tarps ? c.tarpSize ?? "Tarps" : null, c.chains ? "Chains" : null, c.straps ? "Straps" : null, c.oversize ? "Oversize" : null, c.permit ? "Permits by broker" : null, c.temp ? `Reefer ${c.temp}` : null]
      .filter(Boolean)
      .join(", ") || "Standard",
  );
  // rate box
  page.drawRectangle({ x: rightX, y: ry - 34, width: rightW, height: 40, color: rgb(0.93, 0.96, 1), borderColor: BLUE, borderWidth: 1 });
  text(page, "RATE OR CHARGE (ALL IN, USD)", rightX + 8, ry - 6, 7, bold, GRAY);
  text(page, money(load.bookedRate), rightX + 8, ry - 26, 18, bold, BLUE);
  text(page, `$${(load.bookedRate / load.miles).toFixed(2)}/mi`, rightX + rightW - 70, ry - 24, 9, reg, GRAY);
  ry -= 52;
  rightField("ACCESSORIAL CHARGES", c.tarps ? "Tarp pay included in rate" : "None");
  text(page, "PALLETS REQUIRED?", rightX, ry, 7, bold, GRAY);
  page.drawRectangle({ x: rightX + 80, y: ry - 2, width: 8, height: 8, borderColor: NAVY, borderWidth: 0.8 });
  text(page, "Yes", rightX + 92, ry - 1, 8);
  page.drawRectangle({ x: rightX + 118, y: ry - 2, width: 8, height: 8, borderColor: NAVY, borderWidth: 0.8 });
  text(page, "X", rightX + 119.5, ry - 0.8, 7.5, bold);
  text(page, "No", rightX + 130, ry - 1, 8);
  ry -= 16;
  for (const ln of wrap(`Payment to carrier within ${load.broker.daysToPay} days of receipt of invoice and signed BOL. Quick pay available at ${load.broker.quickPayPct}% fee.`, reg, 8, rightW)) {
    text(page, ln, rightX, ry, 8, reg, NAVY);
    ry -= 10;
  }
  ry -= 6;
  box(rightX, ry - 22, rightW, 26, 1.2);
  text(page, "Effective Date", rightX + 6, ry - 7, 7, bold, GRAY);
  text(page, longDay(load.bookedAt ?? new Date()), rightX + 6, ry - 18, 9.5, bold);
  y = Math.min(y, ry - 34);

  // ---- carrier & driver ----
  hline(y + 8, M, M + W, NAVY, 1);
  text(page, "CARRIER", M, y - 4, 10, bold, BLUE);
  text(page, `${s.carrierName}  ·  ${s.carrierMc}  ·  DOT ${s.carrierDot}`, M, y - 17, 9);
  text(page, `${s.carrierAddress}, ${s.carrierCity}, ${s.carrierState} ${s.carrierZip}  ·  ${s.carrierPhone}  ·  ${s.carrierEmail}`, M, y - 28, 8.5, reg, GRAY);
  text(page, `Truck #${load.truck?.number ?? "—"}   Driver: ${load.driver?.name ?? "—"}  ${load.driver?.phone ?? ""}   Dispatcher: ${s.dispatcherName}`, M, y - 40, 9);
  y -= 56;

  // ---- special instructions ----
  text(page, "SPECIAL INSTRUCTIONS", M, y, 10, bold, BLUE);
  y -= 13;
  const instr = [...load.instructions, ...(load.notes ? [load.notes] : [])];
  for (const item of instr) {
    const lines = wrap(item, reg, 8, W - 12);
    if (y - lines.length * 10 < 120) break;
    text(page, "•", M, y, 8);
    for (const ln of lines) {
      text(page, ln, M + 10, y, 8);
      y -= 10;
    }
  }

  // ---- signatures ----
  const sy = 92;
  const half = W / 2 - 10;
  const sig = (x: number, label: string, signedName: string | null, sub: string) => {
    text(page, "By:", x, sy + 16, 9, bold);
    hline(sy + 14, x + 20, x + half);
    if (signedName) text(page, signedName, x + 26, sy + 18, 11, reg, BLUE);
    text(page, "Signature", x + 20 + (half - 20) / 2 - 18, sy + 5, 7, reg, GRAY);
    hline(sy - 8, x + 20, x + half);
    text(page, label, x + 20 + (half - 20) / 2 - 12, sy - 17, 7, reg, GRAY);
    text(page, sub, x + 22, sy - 6, 8.5);
  };
  sig(M, "Carrier", null, s.carrierName);
  sig(M + W / 2 + 10, "Customer/Broker", `/s/ ${load.contact.name}`, load.brokerName);

  // ---- footer ----
  page.drawRectangle({ x: M, y: 40, width: W, height: 20, color: rgb(0.05, 0.05, 0.08) });
  text(page, "Sign and return to the broker before dispatch", M + W / 2 - 112, 46.5, 10, bold, rgb(1, 1, 1));
  text(page, `Return to: ${load.contact.email}  ·  ${load.contact.phone}${load.contact.ext ? ` ext ${load.contact.ext}` : ""}`, M, 28, 7.5, reg, GRAY);
  text(page, "Training document — all companies, people and numbers are fictional.", M + W - 238, 28, 7, reg, GRAY);

  const bytes = await pdf.save();
  return { bytes, filename: `RateCon-${load.ref}.pdf` };
}
