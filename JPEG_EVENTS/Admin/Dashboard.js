document.addEventListener('DOMContentLoaded', async () => {
    // 1. SECURITY CHECK
    // Ensure Auth is globally available from auth-util.js
    const user = Auth.protectPage('admin');
    if (!user) return;

    const token = localStorage.getItem('token');
    
    // Check if user is logged in
    if (!token) {
        window.location.href = '../../index.html'; // Path to your main login/landing
        return;
    }

    try {
        // FIXED: Using relative path '/api/admin/dashboard' instead of localhost
        const response = await fetch('/api/admin/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch dashboard data');
        
        const data = await response.json();

        // 1. UPDATE STAT CARDS
        const revenueEl = document.getElementById('total-revenue');
        const soldEl = document.getElementById('total-sold');

        if (revenueEl) {
            revenueEl.innerText = `₱${parseFloat(data.stats.total_revenue).toLocaleString()}`;
        }
        if (soldEl) {
            soldEl.innerText = data.stats.total_tickets_sold.toLocaleString();
        }

        // 2. POPULATE THE PERFORMANCE TABLE
        const tableBody = document.getElementById('events-table-body');
        if (tableBody) {
            tableBody.innerHTML = ''; 
            data.events.forEach(event => {
                const attendanceRate = event.sold > 0 ? Math.round((event.attended / event.sold) * 100) : 0;
                
                const row = `
                    <tr>
                        <td style="padding: 15px;">
                            <div style="font-size: 18px; color: #fff;">${event.title}</div>
                            <div style="font-size: 12px; color: #cfc7e8; opacity: 0.6;">Capacity: ${event.capacity}</div>
                        </td>
                        <td style="padding: 15px;">${event.sold}</td>
                        <td style="padding: 15px;">₱${parseFloat(event.revenue).toLocaleString()}</td>
                        <td style="padding: 15px;">
                            <span class="attendance-pill">${attendanceRate}%</span>
                            <span style="font-size: 12px; margin-left: 5px; opacity: 0.5;">(${event.attended} scanned)</span>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        }

        // 3. RENDER THE SALES MOMENTUM CHART
        const chartCanvas = document.getElementById('salesChart');
        if (chartCanvas) {
            const ctx = chartCanvas.getContext('2d');
            Chart.defaults.font.family = "'Jockey One', sans-serif";
            Chart.defaults.color = '#cfc7e8';

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.chartData.map(d => d.date),
                    datasets: [{
                        label: 'Daily Revenue',
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

        // 4. EXPORT LOGIC
        const exportBtn = document.getElementById('export-csv');
        if (exportBtn && typeof XLSX !== 'undefined') {
            exportBtn.addEventListener('click', () => {
                const excelData = data.events.map(event => ({
                    "Event Title": event.title,
                    "Tickets Sold": event.sold,
                    "Venue Capacity": event.capacity,
                    "Total Revenue": `₱${parseFloat(event.revenue).toLocaleString()}`,
                    "Staff Scans": event.attended,
                    "Attendance Rate": `${event.sold > 0 ? Math.round((event.attended / event.sold) * 100) : 0}%`
                }));

                const worksheet = XLSX.utils.json_to_sheet(excelData);
                const workbook = XLSX.utils.book_new();
                const trendSheet = XLSX.utils.json_to_sheet(data.chartData);
                
                XLSX.utils.book_append_sheet(workbook, trendSheet, "Daily Sales Trends");
                XLSX.utils.book_append_sheet(workbook, worksheet, "Event Performance");
                XLSX.writeFile(workbook, `JPEG_Events_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            });
        }

    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
});