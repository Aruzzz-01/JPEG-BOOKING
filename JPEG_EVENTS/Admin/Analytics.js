document.addEventListener('DOMContentLoaded', async () => {
    // SECURITY CHECK
    const user = Auth.protectPage('admin');
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../../index.html';
        return;
    }

    // --- GLOBAL CHART STYLING ---
    Chart.defaults.font.family = "'Jockey One', sans-serif";
    Chart.defaults.color = '#cfc7e8';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(28, 20, 40, 0.9)';
    Chart.defaults.plugins.tooltip.titleFont = { family: "'Jockey One', sans-serif", size: 16 };
    Chart.defaults.plugins.tooltip.bodyFont = { family: "'Jockey One', sans-serif", size: 14 };

    try {
        const response = await fetch('/api/admin/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch dashboard data');
        const data = await response.json();

        // 1. UPDATE METRIC CARDS (REAL DATA)
        document.getElementById('total-revenue').innerText = `₱${parseFloat(data.stats.total_revenue).toLocaleString()}`;
        document.getElementById('total-sold').innerText = parseInt(data.stats.total_tickets_sold).toLocaleString();
        document.getElementById('page-views').innerText = parseInt(data.stats.total_views).toLocaleString();
        document.getElementById('conversion-rate').innerText = `${data.stats.conversion_rate}%`;

        // 2. POPULATE THE PERFORMANCE TABLE
        const tableBody = document.getElementById('events-table-body');
        if (tableBody) {
            tableBody.innerHTML = data.events.map(event => {
                const attendanceRate = event.sold > 0 ? Math.round((event.attended / event.sold) * 100) : 0;
                return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 15px;">
                            <div style="font-size: 18px; color: #fff;">${event.title}</div>
                            <div style="font-size: 14px; opacity: 0.6;">Cap: ${event.capacity}</div>
                        </td>
                        <td style="padding: 15px; font-size: 18px;">${event.sold}</td>
                        <td style="padding: 15px; font-size: 18px;">₱${parseFloat(event.revenue).toLocaleString()}</td>
                        <td style="padding: 15px;">
                            <span style="color: ${attendanceRate < 50 ? '#ff3b3b' : '#4ade80'}; font-size: 18px;">${attendanceRate}%</span>
                            <span style="font-size: 12px; margin-left: 5px; opacity: 0.5;">(${event.sold - event.attended} no-shows)</span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // 3. RENDER MAIN LINE CHART (Revenue Timeline)
        const salesCtx = document.getElementById('salesChart')?.getContext('2d');
        if (salesCtx) {
            new Chart(salesCtx, {
                type: 'line',
                data: {
                    labels: data.chartData.map(d => d.date),
                    datasets: [{
                        label: 'Revenue',
                        data: data.chartData.map(d => d.amount),
                        borderColor: '#ffffff',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#ffffff',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { callback: value => '₱' + value.toLocaleString() }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // 4. RENDER DOUGHNUT CHART (Ticket Types - REAL DATA)
        const typeCtx = document.getElementById('ticketTypeChart')?.getContext('2d');
        if (typeCtx && data.ticketTypes) {
            new Chart(typeCtx, {
                type: 'doughnut',
                data: {
                    labels: data.ticketTypes.map(t => t.label),
                    datasets: [{
                        data: data.ticketTypes.map(t => t.value),
                        backgroundColor: ['#ffffff', '#cfc7e8', '#5b4b7a', '#8a7db3'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: { legend: { position: 'right' } }
                }
            });
        }

        // 5. RENDER BAR CHART (Platform/Device - REAL DATA)
        const platformCtx = document.getElementById('platformChart')?.getContext('2d');
        if (platformCtx && data.platforms) {
            new Chart(platformCtx, {
                type: 'bar',
                data: {
                    labels: data.platforms.map(p => p.label),
                    datasets: [{
                        label: 'Sales',
                        data: data.platforms.map(p => p.value),
                        backgroundColor: '#cfc7e8',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // 6. EXPORT LOGIC
        const exportBtn = document.getElementById('export-csv');
        if (exportBtn && typeof XLSX !== 'undefined') {
            exportBtn.addEventListener('click', () => {
                const excelData = data.events.map(event => ({
                    "Event Title": event.title,
                    "Tickets Sold": event.sold,
                    "Total Revenue": `₱${parseFloat(event.revenue).toLocaleString()}`,
                    "Attendance Rate": `${event.sold > 0 ? Math.round((event.attended / event.sold) * 100) : 0}%`
                }));

                const worksheet = XLSX.utils.json_to_sheet(excelData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics Export");
                XLSX.writeFile(workbook, `JPEG_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
            });
        }

    } catch (err) {
        console.error('Error loading analytics:', err);
    }
});