import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { calculateOverallStats, calculateAccountStats, calculateDepartmentStats, formatCurrency } from './reportCalculations';

/**
 * Export all report data to XLSX with professional formatting
 * @param {Object} reportData - Object containing all report data
 * @param {number} selectedYear - Selected year for the report
 * @param {string|number|null} selectedMonth - Selected month ('all' or 1-12)
 */
export function exportToXLSX(reportData, selectedYear, selectedMonth = 'all') {
  try {
    const { estimates, accounts } = reportData;
    const overallStats = calculateOverallStats(estimates);
    const accountStats = calculateAccountStats(estimates, accounts);
    const deptStats = calculateDepartmentStats(estimates);
    
    const workbook = XLSX.utils.book_new();
    
    // Helper function to create worksheet with proper column widths
    const createWorksheet = (data) => {
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Set column widths based on content
      const maxWidths = data[0].map((_, colIndex) => {
        return Math.max(
          ...data.map(row => {
            const cellValue = row[colIndex];
            if (cellValue === null || cellValue === undefined) return 10;
            const str = String(cellValue);
            // Account for currency formatting and long text
            if (str.includes('$') || str.includes(',')) return Math.max(str.length, 15);
            return Math.min(Math.max(str.length + 2, 10), 50);
          })
        );
      });
      
      ws['!cols'] = maxWidths.map(w => ({ wch: w }));
      
      return ws;
    };
    
    // Summary Sheet with Report Header
    const monthName = selectedMonth !== 'all' && selectedMonth 
      ? new Date(2000, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long' })
      : null;
    const reportTitle = monthName 
      ? `Sales Report - ${monthName} ${selectedYear}`
      : `Sales Report - ${selectedYear}`;
    
    const summaryData = [
      [reportTitle],
      [''],
      ['Report Generated:', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      [''],
      ['SUMMARY STATISTICS'],
      [''],
      ['Metric', 'Value'],
      ['Total Estimates', overallStats.total],
      ['Won', overallStats.won],
      ['Lost', overallStats.lost],
      ['Pending', overallStats.pending],
      ['Win Rate (%)', `${overallStats.winRate}%`],
      ['Total Value', overallStats.totalValue],
      ['Won Value', overallStats.wonValue],
      ['Lost Value', overallStats.lostValue],
      ['Pending Value', overallStats.pendingValue],
      ['Estimates vs Won Ratio (%)', `${overallStats.estimatesVsWonRatio}%`],
      ['Revenue vs Won Ratio (%)', `${overallStats.revenueVsWonRatio}%`]
    ];
    
    const summarySheet = createWorksheet(summaryData);
    // Merge title row
    if (!summarySheet['!merges']) summarySheet['!merges'] = [];
    summarySheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Account Performance Sheet
    const accountData = [
      ['Account Performance Report'],
      [''],
      ['Account', 'Total', 'Won', 'Lost', 'Pending', 'Win Rate (%)', 'Total Value', 'Won Value', 'Lost Value', 'Pending Value', 'Est. vs Won (%)', 'Rev. vs Won (%)']
    ];
    
    // Sort by won value descending
    const sortedAccountStats = [...accountStats].sort((a, b) => b.wonValue - a.wonValue);
    
    sortedAccountStats.forEach(acc => {
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
    
    const accountSheet = createWorksheet(accountData);
    // Merge title row
    if (!accountSheet['!merges']) accountSheet['!merges'] = [];
    accountSheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } });
    XLSX.utils.book_append_sheet(workbook, accountSheet, 'Account Performance');
    
    // Department Breakdown Sheet
    const deptData = [
      ['Department Breakdown Report'],
      [''],
      ['Department', 'Total', 'Won', 'Lost', 'Win Rate (%)', 'Total Value', 'Won Value', 'Lost Value', 'Est. vs Won (%)', 'Rev. vs Won (%)']
    ];
    
    deptStats.forEach(dept => {
      deptData.push([
        dept.division || 'Uncategorized',
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
    
    const deptSheet = createWorksheet(deptData);
    // Merge title row
    if (!deptSheet['!merges']) deptSheet['!merges'] = [];
    deptSheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } });
    XLSX.utils.book_append_sheet(workbook, deptSheet, 'Department Breakdown');
    
    // Detailed Estimates Sheet
    const estimatesData = [
      ['Detailed Estimates Report'],
      [''],
      ['Estimate #', 'Account', 'Project', 'Estimate Date', 'Close Date', 'Status', 'Division', 'Total Value', 'Salesperson', 'Estimator']
    ];
    
    // Sort estimates by date (newest first)
    const sortedEstimates = [...estimates].sort((a, b) => {
      const dateA = a.contract_end || a.contract_start || a.estimate_date || a.created_date || '';
      const dateB = b.contract_end || b.contract_start || b.estimate_date || b.created_date || '';
      return dateB.localeCompare(dateA);
    });
    
    sortedEstimates.forEach(est => {
      const account = accounts.find(a => a.id === est.account_id);
      estimatesData.push([
        est.estimate_number || 'N/A',
        account?.name || 'Unknown',
        est.project_name || 'N/A',
        est.estimate_date || 'N/A',
        // Per Estimates spec R2: Export contract_end (Priority 1) if available
        est.contract_end || est.contract_start || est.estimate_date || est.created_date || 'N/A',
        est.status || 'N/A',
        est.division || 'N/A',
        parseFloat(est.total_price || est.total_price_with_tax || 0),
        est.salesperson || 'N/A',
        est.estimator || 'N/A'
      ]);
    });
    
    const estimatesSheet = createWorksheet(estimatesData);
    // Merge title row
    if (!estimatesSheet['!merges']) estimatesSheet['!merges'] = [];
    estimatesSheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } });
    XLSX.utils.book_append_sheet(workbook, estimatesSheet, 'Detailed Estimates');
    
    // Generate file and download
    const monthSuffix = monthName ? `_${monthName}` : '';
    const fileName = `Sales_Report_${selectedYear}${monthSuffix}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  } catch (error) {
    console.error('Error exporting to XLSX:', error);
    throw new Error(`Failed to export XLSX: ${error.message}`);
  }
}

/**
 * Export all report data to PDF with professional styling
 * @param {Object} reportData - Object containing all report data
 * @param {number} selectedYear - Selected year for the report
 * @param {string|number|null} selectedMonth - Selected month ('all' or 1-12)
 */
export function exportToPDF(reportData, selectedYear, selectedMonth = 'all') {
  try {
    const { estimates, accounts } = reportData;
    const overallStats = calculateOverallStats(estimates);
    const accountStats = calculateAccountStats(estimates, accounts);
    const deptStats = calculateDepartmentStats(estimates);
    
    const monthName = selectedMonth !== 'all' && selectedMonth 
      ? new Date(2000, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long' })
      : null;
    const reportTitle = monthName 
      ? `Sales Report - ${monthName} ${selectedYear}`
      : `Sales Report - ${selectedYear}`;
    
    const doc = new jsPDF();
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    
    // Title Section
    doc.setFontSize(20);
    doc.setTextColor(30, 64, 175); // Blue color
    doc.setFont(undefined, 'bold');
    doc.text(reportTitle, margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPos);
    yPos += 15;
    
    // Summary Statistics Section
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont(undefined, 'bold');
    doc.text('Summary Statistics', margin, yPos);
    yPos += 10;
    
    // Create summary stats in a grid layout
    const summaryStats = [
      { label: 'Total Estimates', value: overallStats.total.toString(), color: [59, 130, 246] },
      { label: 'Won', value: overallStats.won.toString(), color: [16, 185, 129] },
      { label: 'Lost', value: overallStats.lost.toString(), color: [239, 68, 68] },
      { label: 'Pending', value: overallStats.pending.toString(), color: [245, 158, 11] },
      { label: 'Win Rate', value: `${overallStats.winRate}%`, color: [139, 92, 246] },
      { label: 'Total Value', value: formatCurrency(overallStats.totalValue), color: [59, 130, 246] },
      { label: 'Won Value', value: formatCurrency(overallStats.wonValue), color: [16, 185, 129] },
      { label: 'Lost Value', value: formatCurrency(overallStats.lostValue), color: [239, 68, 68] }
    ];
    
    // Draw summary cards
    const cardWidth = (pageWidth - (margin * 3)) / 2;
    const cardHeight = 25;
    let cardX = margin;
    let cardY = yPos;
    
    summaryStats.forEach((stat, index) => {
      if (index > 0 && index % 2 === 0) {
        cardX = margin;
        cardY += cardHeight + 5;
      }
      
      // Check if we need a new page
      if (cardY + cardHeight > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        cardY = 20;
      }
      
      // Draw card background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'F');
      
      // Draw colored border
      doc.setDrawColor(...stat.color);
      doc.setLineWidth(0.5);
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'D');
      
      // Label
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(stat.label, cardX + 5, cardY + 8);
      
      // Value
      doc.setFontSize(14);
      doc.setTextColor(...stat.color);
      doc.setFont(undefined, 'bold');
      doc.text(stat.value, cardX + 5, cardY + 18);
      
      cardX += cardWidth + margin;
    });
    
    yPos = cardY + cardHeight + 20;
    
    // Check if we need a new page
    if (yPos > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      yPos = 20;
    }
    
    // Account Performance Section
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont(undefined, 'bold');
    doc.text('Account Performance', margin, yPos);
    yPos += 10;
    
    // Sort accounts by won value
    const sortedAccounts = [...accountStats].sort((a, b) => b.wonValue - a.wonValue).slice(0, 30);
    
    const accountTableData = sortedAccounts.map(acc => [
      acc.accountName.length > 35 ? acc.accountName.substring(0, 35) + '...' : acc.accountName,
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
      headStyles: { 
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 18, halign: 'right' },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 28, halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
    
    // Check if we need a new page
    if (yPos > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      yPos = 20;
    }
    
    // Department Breakdown Section
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont(undefined, 'bold');
    doc.text('Department Breakdown', margin, yPos);
    yPos += 10;
    
    const deptTableData = deptStats.map(dept => [
      dept.division || 'Uncategorized',
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
      headStyles: { 
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 18, halign: 'right' },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25, halign: 'right' },
        7: { cellWidth: 25, halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });
    
    // Save PDF
    const monthSuffix = monthName ? `_${monthName}` : '';
    const fileName = `Sales_Report_${selectedYear}${monthSuffix}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error(`Failed to export PDF: ${error.message}`);
  }
}
