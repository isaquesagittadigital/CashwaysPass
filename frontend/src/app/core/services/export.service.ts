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

    async exportReportToPdf(data: {
        schoolInfo: {
            razaoSocial: string;
            cnpj: string;
            modeloContratacao: string;
            periodo: string;
        };
        filter: string;
        metrics: {
            totalRevenue: number;
            totalDevices: number;
            totalStudents: number;
            transferProvision: number;
            totalTransferred: number;
            expenseProvision: number;
            transactionCount: number;
        };
        charts: { id: string, title: string }[];
    }) {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let currentY = 20;

        // 1. Header
        doc.setFillColor(0, 96, 155); // #00609b
        doc.rect(margin, currentY, 40, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text('CASHWAYS', margin + 5, currentY + 7);

        doc.setTextColor(100, 100, 100);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Relatório Financeiro e Operacional', pageWidth - margin, currentY + 5, { align: 'right' });
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, currentY + 10, { align: 'right' });

        currentY += 25;

        // 2. School Information Title
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Relatório Consolidado', margin, currentY);
        currentY += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Período de análise: ${data.filter}`, margin, currentY);
        currentY += 15;

        // 3. School Details Table
        autoTable(doc, {
            startY: currentY,
            head: [['Razão Social', 'CNPJ', 'Modelo', 'Período']],
            body: [[
                data.schoolInfo.razaoSocial,
                data.schoolInfo.cnpj,
                data.schoolInfo.modeloContratacao,
                data.schoolInfo.periodo
            ]],
            theme: 'plain',
            headStyles: { fillColor: [243, 244, 246], textColor: [75, 85, 99], fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 5 },
            margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // 4. KPIs (Metrics) Grid
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text('Métricas Principais', margin, currentY);
        currentY += 8;

        const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

        autoTable(doc, {
            startY: currentY,
            body: [
                ['Total de Receitas', formatBRL(data.metrics.totalRevenue), 'Provisão de Repasse', formatBRL(data.metrics.transferProvision)],
                ['Total de Dispositivos', data.metrics.totalDevices.toString(), 'Total Repassado', formatBRL(data.metrics.totalTransferred)],
                ['Total de Alunos', data.metrics.totalStudents.toString(), 'Provisão de Despesas', formatBRL(data.metrics.expenseProvision)],
                ['Qtd. de Transações', data.metrics.transactionCount.toString(), '', '']
            ],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 4 },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [249, 250, 251], cellWidth: 40 },
                1: { cellWidth: 50 },
                2: { fontStyle: 'bold', fillColor: [249, 250, 251], cellWidth: 40 },
                3: { cellWidth: 50 }
            },
            margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable.finalY + 20;

        // 5. Charts Section
        for (const chart of data.charts) {
            const chartEl = document.getElementById(chart.id);
            if (chartEl) {
                if (currentY > 200) {
                    doc.addPage();
                    currentY = 20;
                }
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(chart.title, margin, currentY);
                currentY += 10;

                try {
                    const canvas = await html2canvas(chartEl, { 
                        scale: 2,
                        backgroundColor: '#ffffff',
                        logging: false
                    } as any);
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = pageWidth - (2 * margin);
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    
                    doc.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
                    currentY += imgHeight + 20;
                } catch (e) {
                    console.error(`Error capturing chart ${chart.id}:`, e);
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(10);
                    doc.text('[Gráfico indisponível para exportação]', margin, currentY);
                    currentY += 15;
                }
            }
        }

        // Footer
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Gerado via Cashways Pass - v2.5 - ${new Date().toLocaleString('pt-BR')}`,
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

        doc.save(`Relatorio_Financeiro_${data.schoolInfo.razaoSocial.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    }
}
