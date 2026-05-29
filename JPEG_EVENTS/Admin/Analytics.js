document.addEventListener("DOMContentLoaded", async () => {
    const user = Auth.protectPage("admin");
    if (!user) return;

    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../../index.html";
        return;
    }

    Chart.defaults.font.family = "'Jockey One', sans-serif";
    Chart.defaults.color = "#cfc7e8";
    Chart.defaults.plugins.tooltip.backgroundColor = "rgba(28, 20, 40, 0.9)";
    Chart.defaults.plugins.tooltip.titleFont = {
        family: "'Jockey One', sans-serif",
        size: 16
    };
    Chart.defaults.plugins.tooltip.bodyFont = {
        family: "'Jockey One', sans-serif",
        size: 14
    };

    const eventFilter = document.getElementById("eventFilter");
    const dateFilter = document.getElementById("dateFilter");
    const tableBody = document.getElementById("events-table-body");
    const exportBtn = document.getElementById("export-csv");

    let salesChart = null;
    let ticketTypeChart = null;
    let platformChart = null;
    let currentData = null;

    async function loadDashboard() {
        try {
            const eventValue = eventFilter?.value || "all";
            const daysValue = dateFilter?.value || "30";

            const response = await fetch(`/api/admin/dashboard?event=${eventValue}&days=${daysValue}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error("Failed to fetch dashboard data");

            const data = await response.json();
            console.log("DASHBOARD DATA:", data);
            console.log("EVENT LIST:", data.eventList);
            currentData = data;

            populateEventFilter(data.eventList);
            updateMetricCards(data);
            updatePerformanceTable(data.events);
            renderSalesChart(data.chartData || []);
            renderTicketTypeChart(data.ticketTypes || []);
            renderPlatformChart(data.platforms || []);

        } catch (err) {
            console.error("Error loading analytics:", err);
        }
    }

function populateEventFilter(events) {
    if (!eventFilter) return;

    console.log("Populating dropdown with:", events);

    const selectedValue = eventFilter.value || "all";

    eventFilter.innerHTML = `<option value="all">All My Events</option>`;

    if (!events || events.length === 0) {
        const option = document.createElement("option");
        option.disabled = true;
        option.textContent = "No events found";
        eventFilter.appendChild(option);
        return;
    }

    events.forEach(event => {
        const option = document.createElement("option");
        option.value = event.id;
        option.textContent = event.title;
        eventFilter.appendChild(option);
    });

    eventFilter.value = selectedValue;
}

    function formatPeso(value) {
        return `₱${Number(value || 0).toLocaleString()}`;
    }

    function updateMetricCards(data) {
        const stats = data.stats || {};

        document.getElementById("total-revenue").innerText =
            formatPeso(stats.total_revenue);

        document.getElementById("total-sold").innerText =
            Number(stats.total_tickets_sold || 0).toLocaleString();

        document.getElementById("page-views").innerText =
            Number(stats.total_views || 0).toLocaleString();

        document.getElementById("conversion-rate").innerText =
            `${stats.conversion_rate || 0}%`;
    }
    function updatePerformanceTable(events) {
        if (!tableBody) return;

        if (!events || events.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding:15px; text-align:center;">
                        No data found.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = events.map(event => {
            const sold = Number(event.sold || 0);
            const attended = Number(event.attended || 0);
            const revenue = Number(event.revenue || 0);
            const attendanceRate = sold > 0 ? Math.round((attended / sold) * 100) : 0;
            const noShows = sold - attended;

            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:15px;">
                        <div style="font-size:18px; color:#fff;">${event.title}</div>
                        <div style="font-size:14px; opacity:0.6;">Remaining Stock: ${event.capacity}</div>
                    </td>

                    <td style="padding:15px; font-size:18px;">${sold}</td>

                    <td style="padding:15px; font-size:18px;">
                        ${formatPeso(revenue)}
                    </td>

                    <td style="padding:15px;">
                        <span style="color:${attendanceRate < 50 ? "#ff3b3b" : "#4ade80"}; font-size:18px;">
                            ${attendanceRate}%
                        </span>
                        <span style="font-size:12px; margin-left:5px; opacity:0.5;">
                            (${noShows} no-shows)
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function renderSalesChart(chartData) {
        const ctx = document.getElementById("salesChart")?.getContext("2d");
        if (!ctx) return;

        if (salesChart) salesChart.destroy();

        salesChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: chartData.map(d => d.date),
                datasets: [{
                    label: "Revenue",
                    data: chartData.map(d => Number(d.amount || 0)),
                    borderColor: "#ffffff",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: "#ffffff",
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: "rgba(255, 255, 255, 0.05)" },
                        ticks: {
                            callback: value => "₱" + value.toLocaleString()
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function renderTicketTypeChart(ticketTypes) {
        const ctx = document.getElementById("ticketTypeChart")?.getContext("2d");
        if (!ctx) return;

        if (ticketTypeChart) ticketTypeChart.destroy();

        ticketTypeChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ticketTypes.length ? ticketTypes.map(t => t.label) : ["No Sales"],
                datasets: [{
                    data: ticketTypes.length ? ticketTypes.map(t => Number(t.value || 0)) : [1],
                    backgroundColor: ["#ffffff", "#cfc7e8", "#5b4b7a", "#8a7db3"],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "70%",
                plugins: {
                    legend: { position: "right" }
                }
            }
        });
    }

    function renderPlatformChart(platforms) {
        const ctx = document.getElementById("platformChart")?.getContext("2d");
        if (!ctx) return;

        if (platformChart) platformChart.destroy();

        platformChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: platforms.length ? platforms.map(p => p.label) : ["No Data"],
                datasets: [{
                    label: "Sales",
                    data: platforms.length ? platforms.map(p => Number(p.value || 0)) : [0],
                    backgroundColor: "#cfc7e8",
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: "rgba(255, 255, 255, 0.05)" }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    eventFilter?.addEventListener("change", loadDashboard);
    dateFilter?.addEventListener("change", loadDashboard);

    exportBtn?.addEventListener("click", () => {
        if (!currentData || typeof XLSX === "undefined") return;

        const excelData = currentData.events.map(event => {
            const sold = Number(event.sold || 0);
            const attended = Number(event.attended || 0);
            const attendanceRate = sold > 0 ? Math.round((attended / sold) * 100) : 0;

            return {
                "Event Title": event.title,
                "Tickets Sold": sold,
                "Total Revenue": formatPeso(event.revenue),
                "Attendance Rate": `${attendanceRate}%`
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics Export");
        XLSX.writeFile(workbook, `JPEG_Analytics_${new Date().toISOString().split("T")[0]}.xlsx`);
    });

    await loadDashboard();
});