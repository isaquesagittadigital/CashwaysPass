import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

@Injectable({
    providedIn: 'root'
})
export class ExportService {

    constructor() { }

    async exportDashboardToPdf(data: {
        schoolName: string;
        filter: string;
        stats: any[];
        turmas: any[];
        donutChartId: string;
        barChartId?: string;
    }) {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let currentY = 20;

        // 1. Header with Logo (SVG to Base64)
        // For now we'll use a placeholder colored rectangle if logo is not easily available as base64, 
        // but I can try to find the actual SVG or draw a nice header.
        doc.setFillColor(0, 96, 155); // #00609b
        doc.rect(margin, currentY, 40, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text('CASHWAYS', margin + 5, currentY + 7);

        doc.setTextColor(100, 100, 100);
        doc.setFontSize(10);
        doc.text(`Relatório Administrativo - ${data.schoolName}`, pageWidth - margin, currentY + 5, { align: 'right' });
        doc.text(`Período: ${data.filter}`, pageWidth - margin, currentY + 10, { align: 'right' });

        currentY += 20;

        // 2. Stats Grid (KPIs)
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo Diário', margin, currentY);
        currentY += 10;

        const statsTableData = data.stats.map(s => [s.label, s.value, s.points]);
        autoTable(doc, {
            startY: currentY,
            head: [['Indicador', 'Valor', 'Pontuação/Qtd']],
            body: statsTableData,
            margin: { left: margin, right: margin },
            theme: 'striped',
            headStyles: { fillColor: [0, 96, 155] },
            styles: { fontSize: 9 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // 3. Charts Section
        doc.setFontSize(14);
        doc.text('Análise Visual', margin, currentY);
        currentY += 5;

        const donutEl = document.getElementById(data.donutChartId);
        const barEl = data.barChartId ? document.getElementById(data.barChartId) : null;

        if (donutEl) {
            try {
                const donutCanvas = await html2canvas(donutEl, { scale: 2 } as any);
                const donutImg = donutCanvas.toDataURL('image/png');

                const chartWidth = (pageWidth - 2 * margin - 10) / 2;
                doc.addImage(donutImg, 'PNG', margin, currentY, chartWidth, 60);

                if (barEl) {
                    const barCanvas = await html2canvas(barEl, { scale: 2 } as any);
                    const barImg = barCanvas.toDataURL('image/png');
                    doc.addImage(barImg, 'PNG', margin + chartWidth + 10, currentY, chartWidth, 60);
                }

                currentY += 70;
            } catch (e) {
                console.error('Error capturing charts:', e);
                doc.text('[Erro ao renderizar gráficos]', margin, currentY + 10);
                currentY += 20;
            }
        }

        // 4. Table Resumo por turma
        if (data.turmas && data.turmas.length > 0) {
            if (currentY > 230) {
                doc.addPage();
                currentY = 20;
            }
            doc.setFontSize(14);
            doc.text('Resumo por Turma', margin, currentY);
            currentY += 5;

            autoTable(doc, {
                startY: currentY,
                head: [['Turma', 'Qtd. Alunos', 'Total Investido', 'Total Gasto', 'Saldo']],
                body: data.turmas.map(t => [t.name, t.students, t.invested, t.spent, t.balance]),
                margin: { left: margin, right: margin },
                theme: 'grid',
                headStyles: { fillColor: [0, 96, 155] },
                styles: { fontSize: 8 }
            });
        }

        // Footer
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Gerado em ${new Date().toLocaleString('pt-BR')} - Cashways Pass v2.0`,
                margin,
                doc.internal.pageSize.getHeight() - 10
            );
            doc.text(
                `Página ${i} de ${totalPages}`,
                pageWidth - margin,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'right' }
            );
        }

        doc.save(`Relatorio_Dashboard_${data.schoolName.replace(/\s+/g, '_')}_${data.filter}.pdf`);
    }
}
