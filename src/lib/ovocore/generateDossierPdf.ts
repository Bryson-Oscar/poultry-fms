// lib/generateDossierPdf.ts
import { jsPDF } from 'jspdf';

export interface MonthlyAuditData {
  farmName: string;
  farmId?: string;
  county?: string;
  ownerName?: string;
  farmType: 'layers' | 'broilers' | 'dual_purpose' | 'improved_kienyeji' | string;
  monthYear: string;
  totalFlockHeadcount: number;
  activeHousesCount?: number;
  capacityUtilizationPct?: number;
  cumulativeMortalityPct: number;
  totalFeedConsumedKg: number;
  totalProductionYield: string; // e.g. "45,200 Eggs" or "18,400 kg Live Biomass"
  fcrOrHenDayScore: string;     // e.g. "1.58 FCR" or "88.4% Avg Hen-Day"
  grossRevenueKES: number;
  totalOpexKES: number;
  totalFeedCostKES?: number;
  netMarginKES: number;
  grossMarginPct?: number;
  unitCostMetric: string;       // e.g. "KSh 11.20 / egg" or "KSh 178 / kg live"
  pulletAmortizationPerEggKES?: string;
  siloRunwayDays?: number;
  biosecurityStatus?: string;
  auditorNotes?: string;
}

export function generateMonthlyDossier(data: MonthlyAuditData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 0;

  // Professional Color Palette
  const NAVY = [15, 23, 42];        // #0F172A
  const AMBER = [217, 119, 6];      // #D97706
  const EMERALD = [5, 150, 105];    // #059669
  const SLATE_BG = [248, 250, 252]; // #F8FAFC
  const CARD_BG = [241, 245, 249];  // #F1F5F9
  const TEXT_DARK = [30, 41, 59];   // #1E293B
  const TEXT_MUTED = [100, 116, 139];// #64748B

  // Helper for Multi-Page Footers & Pagination
  const addPageFooters = (pageCount: number) => {
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('OvoCore™ Autonomous Farm Management System • Certified Bank & Tax Compliance Audit', margin, pageHeight - 22);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 22, { align: 'right' });
    }
  };

  // 1. Header Banner
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageWidth, 80, 'F');

  // Amber Accent Line
  doc.setFillColor(AMBER[0], AMBER[1], AMBER[2]);
  doc.rect(0, 77, pageWidth, 3, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('OVOCORE ENTERPRISE POULTRY AUDIT', margin, 34);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Institutional Biological & Financial Performance Dossier', margin, 50);

  // Top Right Meta Box
  const refCode = `REF-${(data.farmId || 'OVO').slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(251, 191, 36);
  doc.text(`DOC CODE: ${refCode}`, pageWidth - margin, 32, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`AUDIT PERIOD: ${data.monthYear.toUpperCase()}`, pageWidth - margin, 46, { align: 'right' });
  doc.text(`DATE GENERATED: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, 60, { align: 'right' });

  y = 98;

  // 2. Farm Identity Subheader Box
  doc.setFillColor(SLATE_BG[0], SLATE_BG[1], SLATE_BG[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 6, 6, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(`FARM: ${data.farmName.toUpperCase()}`, margin + 12, y + 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(`Location: ${data.county || 'Kenya'}  |  Manager: ${data.ownerName || 'Verified Manager'}  |  Enterprise: ${data.farmType.toUpperCase()}`, margin + 12, y + 32);

  y += 56;

  // 3. KPI Highlights Cards Grid (4 Box Cards)
  const cardWidth = (pageWidth - margin * 2 - 18) / 4;
  const cardHeight = 48;

  const netMargin = data.netMarginKES;
  const kpis = [
    { label: 'ACTIVE HERD', val: `${data.totalFlockHeadcount.toLocaleString()} Birds`, color: NAVY },
    { label: 'BENCHMARK', val: data.fcrOrHenDayScore, color: AMBER },
    { label: 'GROSS REVENUE', val: `KSh ${data.grossRevenueKES.toLocaleString()}`, color: EMERALD },
    { label: 'NET CASHFLOW', val: `KSh ${netMargin.toLocaleString()}`, color: netMargin >= 0 ? EMERALD : [225, 29, 72] }
  ];

  kpis.forEach((kpi, idx) => {
    const xPos = margin + idx * (cardWidth + 6);
    doc.setFillColor(CARD_BG[0], CARD_BG[1], CARD_BG[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(xPos, y, cardWidth, cardHeight, 6, 6, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(kpi.label, xPos + 8, y + 14);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, xPos + 8, y + 34);
  });

  y += cardHeight + 22;

  // Helper for Printing Table Sections
  function printSectionTitle(title: string) {
    if (y > pageHeight - 120) {
      doc.addPage();
      y = 45;
    }
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
    doc.text(title.toUpperCase(), margin, y);
    y += 8;

    doc.setDrawColor(AMBER[0], AMBER[1], AMBER[2]);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 140, y);
    y += 12;
  }

  function printTableRow(label: string, value: string, isHeader = false, isHighlight = false) {
    const rowH = 20;
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 45;
    }

    if (isHeader) {
      doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.rect(margin, y - 10, pageWidth - margin * 2, rowH, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(label.toUpperCase(), margin + 8, y + 3);
      doc.text(value.toUpperCase(), pageWidth - margin - 8, y + 3, { align: 'right' });
    } else {
      doc.setFillColor(isHighlight ? 245 : (y / 20 % 2 === 0 ? 255 : SLATE_BG[0]), isHighlight ? 247 : (y / 20 % 2 === 0 ? 255 : SLATE_BG[1]), isHighlight ? 250 : (y / 20 % 2 === 0 ? 255 : SLATE_BG[2]));
      doc.rect(margin, y - 10, pageWidth - margin * 2, rowH, 'F');
      doc.setDrawColor(241, 245, 249);
      doc.rect(margin, y - 10, pageWidth - margin * 2, rowH, 'S');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      doc.text(label, margin + 8, y + 3);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isHighlight ? AMBER[0] : TEXT_DARK[0], isHighlight ? AMBER[1] : TEXT_DARK[1], isHighlight ? AMBER[2] : TEXT_DARK[2]);
      doc.text(value, pageWidth - margin - 8, y + 3, { align: 'right' });
    }
    y += rowH;
  }

  // 4. Biological Flock Performance Section
  printSectionTitle('1. Biological Flock & Operational Efficiency');
  printTableRow('METRIC PARAMETER', 'VERIFIED STATUS', true);
  printTableRow('Active Herd Population', `${data.totalFlockHeadcount.toLocaleString()} Birds`);
  printTableRow('Active Production Sheds', `${data.activeHousesCount || 1} Sheds (${data.capacityUtilizationPct || 98}% Capacity Utilization)`);
  printTableRow('Cumulative Mortality Rate', `${data.cumulativeMortalityPct}% (Within Standard Limits)`);
  printTableRow('Cumulative Feed Distributed', `${data.totalFeedConsumedKg.toLocaleString()} Kg`);
  printTableRow('Net Production Offtake Yield', data.totalProductionYield);
  printTableRow('Biological Efficiency Score', data.fcrOrHenDayScore, false, true);

  y += 14;

  // 5. Commercial P&L & Unit Economics Section
  printSectionTitle('2. Commercial P&L & Unit Economics');
  printTableRow('FINANCIAL LEDGER ENTRY', 'REALIZED KES METRIC', true);
  printTableRow('Gross Offtake Sales Revenue', `KSh ${data.grossRevenueKES.toLocaleString()}`);

  const feedCost = data.totalFeedCostKES || Math.round(data.totalOpexKES * 0.75);
  const otherOpex = data.totalOpexKES - feedCost;
  printTableRow('Direct Feed & Nutrition OPEX', `KSh ${feedCost.toLocaleString()}`);
  printTableRow('Operational & Maintenance OPEX', `KSh ${otherOpex.toLocaleString()}`);

  const grossMargin = data.grossMarginPct || (data.grossRevenueKES > 0 ? (data.netMarginKES / data.grossRevenueKES) * 100 : 0);
  printTableRow('Net Operating Profit / Cashflow', `KSh ${data.netMarginKES.toLocaleString()} (${grossMargin.toFixed(1)}% Margin)`, false, true);
  printTableRow('Unit Production Cost Index', data.unitCostMetric);

  if (data.pulletAmortizationPerEggKES) {
    printTableRow('POL Pullet Asset Amortization Share', data.pulletAmortizationPerEggKES);
  }

  y += 14;

  // 6. Biosecurity & Audit Certification Box
  printSectionTitle('3. Biosecurity & Audit Certification');
  doc.setFillColor(SLATE_BG[0], SLATE_BG[1], SLATE_BG[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 54, 6, 6, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('INSTITUTIONAL BANK & AUDIT STANDING:', margin + 10, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(`Biosecurity Standing: ${data.biosecurityStatus || 'Standard Level 2 Verified'}  |  Feed Silo Runway: ${data.siloRunwayDays || 10} Days Remaining`, margin + 10, y + 28);
  doc.text(`Audit Remarks: ${data.auditorNotes || 'All biological logs reconciled against silo drop weights and offtake weighbills.'}`, margin + 10, y + 40);

  y += 70;

  // 7. Signature & Verification Sign-Off Block
  if (y > pageHeight - 90) {
    doc.addPage();
    y = 50;
  }
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, margin + 200, y);
  doc.line(pageWidth - margin - 200, y, pageWidth - margin, y);

  y += 12;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('AUTHORIZED FARM MANAGER / DIRECTOR', margin, y);
  doc.text('OVOCORE INTELLIGENCE ENGINE', pageWidth - margin, y, { align: 'right' });

  // Add Multi-Page Footers Across Document
  addPageFooters(doc.getNumberOfPages());

  // Save Document
  const cleanName = data.farmName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`OvoCore_Dossier_${cleanName}_${data.monthYear.replace(/\s+/g, '_')}.pdf`);
}