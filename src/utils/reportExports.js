import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { calculateOverallStats, calculateAccountStats, calculateDepartmentStats, formatCurrency } from './reportCalculations';

/**
 * Export all report data to XLSX
 * @param {Object} reportData - Object containing all report data
 * @param {number} selectedYear - Selected year for the report
 */
export function exportToXLSX(reportData, selectedYear) {
  const { estimates, accounts } = reportData;
  const overallStats = calculateOverallStats(estimates);
  const accountStats = calculateAccountStats(estimates, accounts);
  const deptStats = calculateDepartmentStats(estimates);
  
  const workbook = XLSX.utils.book_new();
  
  // Overall Statistics Sheet
  const overallData = [
    ['End of Year Report', selectedYear],
    [''],
    ['Overall Statistics'],
    ['Total Estimates', overallStats.total],
    ['Won', overallStats.won],
    ['Lost', overallStats.lost],
    ['Pending', overallStats.pending],
    ['Win Rate (%)', overallStats.winRate],
    ['Total Value', overallStats.totalValue],
    ['Won Value', overallStats.wonValue],
    ['Lost Value', overallStats.lostValue],
    ['Pending Value', overallStats.pendingValue],
    ['Estimates vs Won Ratio (%)', overallStats.estimatesVsWonRatio],
    ['Revenue vs Won Ratio (%)', overallStats.revenueVsWonRatio],
  ];
  const overallSheet = XLSX.utils.aoa_to_sheet(overallData);
  XLSX.utils.book_append_sheet(workbook, overallSheet, 'Overall Stats');
  
  // Account Performance Sheet
  const accountData = [
    ['Account', 'Total', 'Won', 'Lost', 'Pending', 'Win Rate (%)', 'Total Value', 'Won Value', 'Lost Value', 'Pending Value', 'Est. vs Won (%)', 'Rev. vs Won (%)']
  ];
  accountStats.forEach(acc => {
    accountData.push([
      acc.accountName,
      acc.total,
      acc.won,
      acc.lost,
      acc.pending,
      acc.winRate,
      acc.totalValue,
      acc.wonValue,
      acc.lostValue,
      acc.pendingValue,
      acc.estimatesVsWonRatio,
      acc.revenueVsWonRatio
    ]);
  });
  const accountSheet = XLSX.utils.aoa_to_sheet(accountData);
  XLSX.utils.book_append_sheet(workbook, accountSheet, 'Account Performance');
  
  // Department Breakdown Sheet
  const deptData = [
    ['Department', 'Total', 'Won', 'Lost', 'Win Rate (%)', 'Total Value', 'Won Value', 'Lost Value', 'Est. vs Won (%)', 'Rev. vs Won (%)']
  ];
  deptStats.forEach(dept => {
    deptData.push([
      dept.division,
      dept.total,
      dept.won,
      dept.lost,
      dept.winRate,
      dept.totalValue,
      dept.wonValue,
      dept.lostValue,
      dept.estimatesVsWonRatio,
      dept.revenueVsWonRatio
    ]);
  });
  const deptSheet = XLSX.utils.aoa_to_sheet(deptData);
  XLSX.utils.book_append_sheet(workbook, deptSheet, 'Department Breakdown');
  
  // Detailed Estimates Sheet
  const estimatesData = [
    ['Estimate #', 'Account', 'Project', 'Date', 'Close Date', 'Status', 'Division', 'Total Value', 'Salesperson', 'Estimator']
  ];
  estimates.forEach(est => {
    const account = accounts.find(a => a.id === est.account_id);
    estimatesData.push([
      est.estimate_number || 'N/A',
      account?.name || 'Unknown',
      est.project_name || 'N/A',
      est.estimate_date || 'N/A',
      est.estimate_close_date || 'N/A',
      est.status || 'N/A',
      est.division || 'N/A',
      est.total_price_with_tax || 0,
      est.salesperson || 'N/A',
      est.estimator || 'N/A'
    ]);
  });
  const estimatesSheet = XLSX.utils.aoa_to_sheet(estimatesData);
  XLSX.utils.book_append_sheet(workbook, estimatesSheet, 'Detailed Estimates');
  
  // Generate file and download
  const fileName = `End_of_Year_Report_${selectedYear}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export all report data to PDF
 * @param {Object} reportData - Object containing all report data
 * @param {number} selectedYear - Selected year for the report
 */
export function exportToPDF(reportData, selectedYear) {
  const { estimates, accounts } = reportData;
  const overallStats = calculateOverallStats(estimates);
  const accountStats = calculateAccountStats(estimates, accounts);
  const deptStats = calculateDepartmentStats(estimates);
  
  const doc = new jsPDF();
  let yPos = 20;
  
  // Title
  doc.setFontSize(20);
  doc.text('End of Year Report', 14, yPos);
  yPos += 10;
  doc.setFontSize(14);
  doc.text(`Year: ${selectedYear}`, 14, yPos);
  yPos += 15;
  
  // Overall Statistics
  doc.setFontSize(16);
  doc.text('Overall Statistics', 14, yPos);
  yPos += 10;
  doc.setFontSize(10);
  
  const overallTableData = [
    ['Metric', 'Value'],
    ['Total Estimates', overallStats.total.toString()],
    ['Won', overallStats.won.toString()],
    ['Lost', overallStats.lost.toString()],
    ['Pending', overallStats.pending.toString()],
    ['Win Rate (%)', `${overallStats.winRate}%`],
    ['Total Value', formatCurrency(overallStats.totalValue)],
    ['Won Value', formatCurrency(overallStats.wonValue)],
    ['Lost Value', formatCurrency(overallStats.lostValue)],
    ['Estimates vs Won (%)', `${overallStats.estimatesVsWonRatio}%`],
    ['Revenue vs Won (%)', `${overallStats.revenueVsWonRatio}%`]
  ];
  
  doc.autoTable({
    startY: yPos,
    head: [overallTableData[0]],
    body: overallTableData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 9 }
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  // Account Performance (Top 20)
  doc.setFontSize(16);
  doc.text('Account Performance (Top 20)', 14, yPos);
  yPos += 10;
  
  const accountTableData = accountStats.slice(0, 20).map(acc => [
    acc.accountName.length > 30 ? acc.accountName.substring(0, 30) + '...' : acc.accountName,
    acc.total.toString(),
    acc.won.toString(),
    acc.lost.toString(),
    `${acc.winRate}%`,
    formatCurrency(acc.totalValue),
    formatCurrency(acc.wonValue)
  ]);
  
  doc.autoTable({
    startY: yPos,
    head: [['Account', 'Total', 'Won', 'Lost', 'Win Rate', 'Total Value', 'Won Value']],
    body: accountTableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 15 },
      2: { cellWidth: 15 },
      3: { cellWidth: 15 },
      4: { cellWidth: 20 },
      5: { cellWidth: 25 },
      6: { cellWidth: 25 }
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  // Department Breakdown
  doc.setFontSize(16);
  doc.text('Department Breakdown', 14, yPos);
  yPos += 10;
  
  const deptTableData = deptStats.map(dept => [
    dept.division,
    dept.total.toString(),
    dept.won.toString(),
    dept.lost.toString(),
    `${dept.winRate}%`,
    formatCurrency(dept.totalValue),
    formatCurrency(dept.wonValue),
    formatCurrency(dept.lostValue)
  ]);
  
  doc.autoTable({
    startY: yPos,
    head: [['Department', 'Total', 'Won', 'Lost', 'Win Rate', 'Total Value', 'Won Value', 'Lost Value']],
    body: deptTableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 9 }
  });
  
  // Save PDF
  const fileName = `End_of_Year_Report_${selectedYear}.pdf`;
  doc.save(fileName);
}

