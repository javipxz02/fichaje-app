/* ============================================================
   FICHAJE – Main Application JavaScript
   ============================================================ */

(function () {
    'use strict';

    // ─── Constants ───────────────────────────────────────────
    const STORAGE_KEY = 'fichaje_data';
    const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    // ─── State ───────────────────────────────────────────────
    let data = loadData();
    let timerInterval = null;
    let currentPeriod = 'week';

    // ─── DOM refs ────────────────────────────────────────────
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const dom = {
        headerTitle: $('#headerTitle'),
        headerDate: $('#headerDate'),
        statusPill: $('#statusPill'),
        statusText: $('#statusText'),
        timerDisplay: $('#timerDisplay'),
        timerH: $('#timerH'),
        timerM: $('#timerM'),
        timerS: $('#timerS'),
        clockBtn: $('#clockBtn'),
        clockFace: $('#clockFace'),
        clockLabel: $('#clockLabel'),
        iconPlay: $('#iconPlay'),
        iconStop: $('#iconStop'),
        clockRing: $('#clockRing'),
        todayWorked: $('#todayWorked'),
        todayExtra: $('#todayExtra'),
        todayRecords: $('#todayRecords'),
        historyList: $('#historyList'),
        historyEmpty: $('#historyEmpty'),
        statTotal: $('#statTotal'),
        statExtra: $('#statExtra'),
        statAvg: $('#statAvg'),
        statDays: $('#statDays'),
        chartTitle: $('#chartTitle'),
        barChart: $('#barChart'),
        segmentIndicator: $('#segmentIndicator'),
        cfgDailyH: $('#cfgDailyH'),
        cfgWeeklyH: $('#cfgWeeklyH'),
        cfgSheetsUrl: $('#cfgSheetsUrl'),
        btnSync: $('#btnSync'),
        syncBar: $('#syncBar'),
        syncMsg: $('#syncMsg'),
        btnExport: $('#btnExport'),
        btnClear: $('#btnClear'),
        toast: $('#toast'),
        toastMsg: $('#toastMsg'),
        modalOverlay: $('#modalOverlay'),
        modalText: $('#modalText'),
        modalCancel: $('#modalCancel'),
        modalConfirm: $('#modalConfirm'),
    };

    // ─── Init ────────────────────────────────────────────────
    function init() {
        updateHeaderDate();
        applySettings();
        bindEvents();
        restoreSession();
        renderTodaySummary();
        renderHistory();
        renderStats();
        registerSW();
    }

    // ─── Data / Storage ──────────────────────────────────────
    function defaultData() {
        return {
            settings: { dailyHours: 8, weeklyHours: 40, sheetsUrl: '' },
            session: null,          // { checkIn: ISO string } or null
            records: [],            // { id, date, checkIn, checkOut, totalMin, overtime, synced }
        };
    }

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultData();
            const parsed = JSON.parse(raw);
            // Merge with defaults for forward compatibility
            return { ...defaultData(), ...parsed, settings: { ...defaultData().settings, ...parsed.settings } };
        } catch { return defaultData(); }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // ─── Header ──────────────────────────────────────────────
    function updateHeaderDate() {
        const now = new Date();
        const day = DAYS_FULL[now.getDay()];
        const d = now.getDate();
        const m = MONTHS_ES[now.getMonth()];
        dom.headerDate.textContent = `${day}, ${d} ${m}`;
    }

    // ─── Navigation ──────────────────────────────────────────
    function bindEvents() {
        // Tabs
        $$('.tab').forEach(tab => {
            tab.addEventListener('click', () => switchScreen(tab.dataset.screen));
        });

        // Clock button
        dom.clockBtn.addEventListener('click', toggleClock);

        // Period segment
        $$('.segment').forEach(seg => {
            seg.addEventListener('click', () => {
                currentPeriod = seg.dataset.period;
                $$('.segment').forEach(s => s.classList.remove('active'));
                seg.classList.add('active');
                dom.segmentIndicator.classList.toggle('right', currentPeriod === 'month');
                renderStats();
            });
        });

        // Settings inputs
        dom.cfgDailyH.addEventListener('change', () => {
            data.settings.dailyHours = parseFloat(dom.cfgDailyH.value) || 8;
            save();
            recalcOvertime();
            renderTodaySummary();
            renderStats();
        });
        dom.cfgWeeklyH.addEventListener('change', () => {
            data.settings.weeklyHours = parseFloat(dom.cfgWeeklyH.value) || 40;
            save();
        });
        dom.cfgSheetsUrl.addEventListener('change', () => {
            data.settings.sheetsUrl = dom.cfgSheetsUrl.value.trim();
            save();
        });

        // Buttons
        dom.btnSync.addEventListener('click', syncSheets);
        dom.btnExport.addEventListener('click', exportCSV);
        dom.btnClear.addEventListener('click', () => {
            showModal('¿Borrar todos los registros? Esta acción no se puede deshacer.', () => {
                data.records = [];
                data.session = null;
                save();
                stopTimer();
                setClockUI(false);
                renderTodaySummary();
                renderHistory();
                renderStats();
                toast('Datos borrados');
            });
        });

        // Modal
        dom.modalCancel.addEventListener('click', hideModal);
    }

    function switchScreen(id) {
        $$('.screen').forEach(s => s.classList.remove('active'));
        $(`#screen-${id}`).classList.add('active');
        $$('.tab').forEach(t => t.classList.remove('active'));
        $(`.tab[data-screen="${id}"]`).classList.add('active');

        const screen = $(`#screen-${id}`);
        dom.headerTitle.textContent = screen.dataset.title || 'Fichaje';

        // Refresh data when switching
        if (id === 'history') renderHistory();
        if (id === 'stats') renderStats();
    }

    // ─── Clock In / Out ──────────────────────────────────────
    function toggleClock() {
        if (data.session) {
            clockOut();
        } else {
            clockIn();
        }
    }

    function clockIn() {
        const now = new Date();
        data.session = { checkIn: now.toISOString() };
        save();
        setClockUI(true);
        startTimer(now);
        toast('✓ Entrada registrada');
        if (navigator.vibrate) navigator.vibrate(30);
    }

    function clockOut() {
        if (!data.session) return;
        const checkIn = new Date(data.session.checkIn);
        const checkOut = new Date();
        const totalMin = Math.round((checkOut - checkIn) / 60000);
        const dailyMin = data.settings.dailyHours * 60;

        // Calculate today's total to determine overtime
        const todayStr = dateStr(checkOut);
        const todayRecords = data.records.filter(r => r.date === todayStr);
        const prevMin = todayRecords.reduce((s, r) => s + r.totalMin, 0);
        const newTotalMin = prevMin + totalMin;
        const overtime = Math.max(0, newTotalMin - dailyMin);
        const prevOvertime = todayRecords.reduce((s, r) => s + r.overtime, 0);
        const thisOvertime = Math.max(0, overtime - prevOvertime);

        const record = {
            id: uid(),
            date: todayStr,
            checkIn: timeStr(checkIn),
            checkOut: timeStr(checkOut),
            totalMin,
            overtime: thisOvertime,
            synced: false,
        };

        data.records.push(record);
        data.session = null;
        save();

        stopTimer();
        setClockUI(false);
        renderTodaySummary();
        renderHistory();
        renderStats();
        toast('✓ Salida registrada — ' + formatDur(totalMin));
        if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    }

    function restoreSession() {
        if (data.session) {
            setClockUI(true);
            startTimer(new Date(data.session.checkIn));
        }
    }

    // ─── Timer ───────────────────────────────────────────────
    function startTimer(startDate) {
        stopTimer();
        update();
        timerInterval = setInterval(update, 1000);

        function update() {
            const diff = Math.floor((Date.now() - startDate.getTime()) / 1000);
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            dom.timerH.textContent = pad(h);
            dom.timerM.textContent = pad(m);
            dom.timerS.textContent = pad(s);
        }
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        dom.timerH.textContent = '00';
        dom.timerM.textContent = '00';
        dom.timerS.textContent = '00';
    }

    function setClockUI(active) {
        dom.clockBtn.classList.toggle('stop', active);
        dom.statusPill.classList.toggle('active', active);
        dom.timerDisplay.classList.toggle('running', active);
        dom.statusText.textContent = active ? 'Trabajando' : 'Sin fichar';
        dom.clockLabel.textContent = active ? 'Fichar Salida' : 'Fichar Entrada';
        dom.iconPlay.classList.toggle('hidden', active);
        dom.iconStop.classList.toggle('hidden', !active);
    }

    // ─── Render: Today ───────────────────────────────────────
    function renderTodaySummary() {
        const today = dateStr(new Date());
        const recs = data.records.filter(r => r.date === today);
        const totalMin = recs.reduce((s, r) => s + r.totalMin, 0);
        const dailyMin = data.settings.dailyHours * 60;
        const extra = Math.max(0, totalMin - dailyMin);

        dom.todayWorked.textContent = formatDur(totalMin);
        dom.todayExtra.textContent = formatDur(extra);

        if (recs.length === 0) {
            dom.todayRecords.innerHTML = '';
            return;
        }

        dom.todayRecords.innerHTML = recs.map(r => `
            <div class="record-row">
                <span class="record-time">${r.checkIn} → ${r.checkOut}</span>
                <span class="record-dur">${formatDur(r.totalMin)}</span>
            </div>
        `).join('');
    }

    // ─── Render: History ─────────────────────────────────────
    function renderHistory() {
        const sorted = [...data.records].sort((a, b) => b.date.localeCompare(a.date) || b.checkOut.localeCompare(a.checkOut));
        if (sorted.length === 0) {
            dom.historyList.innerHTML = '';
            dom.historyEmpty.classList.remove('hidden');
            return;
        }
        dom.historyEmpty.classList.add('hidden');

        // Group by date
        const groups = {};
        sorted.forEach(r => {
            if (!groups[r.date]) groups[r.date] = [];
            groups[r.date].push(r);
        });

        let html = '';
        Object.keys(groups).forEach(date => {
            const d = parseDate(date);
            const dayLabel = isToday(date) ? 'Hoy' : isYesterday(date) ? 'Ayer' : formatDateLabel(d);
            const recs = groups[date];
            const dayTotal = recs.reduce((s, r) => s + r.totalMin, 0);
            const dayExtra = Math.max(0, dayTotal - data.settings.dailyHours * 60);
            const deficit = dayTotal < data.settings.dailyHours * 60 ? data.settings.dailyHours * 60 - dayTotal : 0;

            html += `<div class="history-date-group animate-in">
                <div class="history-date">${dayLabel} · ${formatDur(dayTotal)}</div>
                <div class="history-card">`;

            recs.forEach(r => {
                let extraHtml = '';
                if (r.overtime > 0) extraHtml = `<span class="history-item-extra">+${formatDur(r.overtime)} extra</span>`;

                html += `<div class="history-item">
                    <div class="history-item-left">
                        <span class="history-item-time">${r.checkIn} → ${r.checkOut}</span>
                        ${extraHtml}
                    </div>
                    <span class="history-item-dur">${formatDur(r.totalMin)}</span>
                </div>`;
            });

            html += `</div></div>`;
        });

        dom.historyList.innerHTML = html;
    }

    // ─── Render: Stats ───────────────────────────────────────
    function renderStats() {
        const now = new Date();
        let startDate, endDate, dayLabels;

        if (currentPeriod === 'week') {
            const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
            dom.chartTitle.textContent = 'Esta semana';
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            dom.chartTitle.textContent = MONTHS_ES[now.getMonth()] + ' ' + now.getFullYear();
        }

        const startStr = dateStr(startDate);
        const endStr = dateStr(endDate);
        const recs = data.records.filter(r => r.date >= startStr && r.date <= endStr);

        // Aggregate by date
        const byDate = {};
        recs.forEach(r => {
            byDate[r.date] = (byDate[r.date] || 0) + r.totalMin;
        });

        const totalMin = recs.reduce((s, r) => s + r.totalMin, 0);
        const workedDays = Object.keys(byDate).length;
        const avgMin = workedDays > 0 ? Math.round(totalMin / workedDays) : 0;
        const expectedMin = currentPeriod === 'week'
            ? data.settings.weeklyHours * 60
            : data.settings.dailyHours * 60 * workedDays;
        const extraMin = Math.max(0, totalMin - expectedMin);

        dom.statTotal.textContent = formatDurShort(totalMin);
        dom.statExtra.textContent = formatDurShort(extraMin);
        dom.statAvg.textContent = formatDurShort(avgMin);
        dom.statDays.textContent = workedDays;

        // Bar chart
        if (currentPeriod === 'week') {
            renderWeekChart(startDate, byDate, dayLabels);
        } else {
            renderMonthChart(startDate, endDate, byDate);
        }
    }

    function renderWeekChart(startDate, byDate, labels) {
        const dailyTarget = data.settings.dailyHours * 60;
        let maxVal = dailyTarget;
        const values = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const key = dateStr(d);
            const val = byDate[key] || 0;
            values.push(val);
            if (val > maxVal) maxVal = val;
        }

        dom.barChart.innerHTML = values.map((v, i) => {
            const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
            const isOver = v > dailyTarget;
            return `<div class="bar-col">
                <span class="bar-val">${v > 0 ? formatDurShort(v) : ''}</span>
                <div class="bar ${isOver ? 'overtime' : ''}" style="height:${Math.max(pct, 3)}%"></div>
                <span class="bar-day">${labels[i]}</span>
            </div>`;
        }).join('');
    }

    function renderMonthChart(startDate, endDate, byDate) {
        // Group by week
        const dailyTarget = data.settings.dailyHours * 60;
        const weeks = [];
        let current = new Date(startDate);
        let weekNum = 1;

        while (current <= endDate) {
            let weekTotal = 0;
            const weekStart = new Date(current);
            for (let i = 0; i < 7 && current <= endDate; i++, current.setDate(current.getDate() + 1)) {
                weekTotal += byDate[dateStr(current)] || 0;
            }
            weeks.push({ label: `S${weekNum}`, total: weekTotal });
            weekNum++;
        }

        const weeklyTarget = data.settings.weeklyHours * 60;
        let maxVal = weeklyTarget;
        weeks.forEach(w => { if (w.total > maxVal) maxVal = w.total; });

        dom.barChart.innerHTML = weeks.map(w => {
            const pct = maxVal > 0 ? (w.total / maxVal) * 100 : 0;
            const isOver = w.total > weeklyTarget;
            return `<div class="bar-col">
                <span class="bar-val">${w.total > 0 ? formatDurShort(w.total) : ''}</span>
                <div class="bar ${isOver ? 'overtime' : ''}" style="height:${Math.max(pct, 3)}%"></div>
                <span class="bar-day">${w.label}</span>
            </div>`;
        }).join('');
    }

    // ─── Settings ────────────────────────────────────────────
    function applySettings() {
        dom.cfgDailyH.value = data.settings.dailyHours;
        dom.cfgWeeklyH.value = data.settings.weeklyHours;
        dom.cfgSheetsUrl.value = data.settings.sheetsUrl || '';
    }

    function recalcOvertime() {
        const dailyMin = data.settings.dailyHours * 60;
        // Group records by date and recalc overtime
        const byDate = {};
        data.records.forEach(r => {
            if (!byDate[r.date]) byDate[r.date] = [];
            byDate[r.date].push(r);
        });
        Object.values(byDate).forEach(dayRecs => {
            let cumul = 0;
            dayRecs.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
            dayRecs.forEach(r => {
                cumul += r.totalMin;
                r.overtime = Math.max(0, cumul - dailyMin);
                if (cumul - r.totalMin >= dailyMin) {
                    r.overtime = r.totalMin; // whole block is overtime
                } else {
                    r.overtime = Math.max(0, cumul - dailyMin);
                }
            });
        });
        save();
    }

    // ─── Google Sheets Sync ──────────────────────────────────
    async function syncSheets() {
        const url = data.settings.sheetsUrl;
        if (!url) {
            toast('Configura la URL del Apps Script primero');
            return;
        }

        dom.syncBar.classList.add('show');
        dom.syncMsg.textContent = 'Sincronizando…';

        const unsynced = data.records.filter(r => !r.synced);
        if (unsynced.length === 0) {
            dom.syncMsg.textContent = 'Todo sincronizado ✓';
            setTimeout(() => dom.syncBar.classList.remove('show'), 2000);
            return;
        }

        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'sync', records: unsynced }),
            });

            if (!resp.ok) throw new Error('Error ' + resp.status);

            const result = await resp.json();
            if (result.status === 'ok') {
                unsynced.forEach(r => r.synced = true);
                save();
                dom.syncMsg.textContent = `${unsynced.length} registro(s) sincronizado(s) ✓`;
                toast('Sincronización completada');
            } else {
                throw new Error(result.message || 'Error desconocido');
            }
        } catch (err) {
            dom.syncMsg.textContent = 'Error: ' + err.message;
            toast('Error al sincronizar');
        }

        setTimeout(() => dom.syncBar.classList.remove('show'), 3000);
    }

    // ─── Export CSV ──────────────────────────────────────────
    function exportCSV() {
        if (data.records.length === 0) {
            toast('No hay registros para exportar');
            return;
        }

        const header = 'Fecha,Entrada,Salida,Minutos Totales,Horas Totales,Minutos Extra,Horas Extra\n';
        const rows = data.records.map(r =>
            `${r.date},${r.checkIn},${r.checkOut},${r.totalMin},${(r.totalMin / 60).toFixed(2)},${r.overtime},${(r.overtime / 60).toFixed(2)}`
        ).join('\n');

        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fichaje_${dateStr(new Date())}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast('CSV descargado');
    }

    // ─── Toast ───────────────────────────────────────────────
    function toast(msg) {
        dom.toastMsg.textContent = msg;
        dom.toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => dom.toast.classList.remove('show'), 2500);
    }

    // ─── Modal ───────────────────────────────────────────────
    let _modalResolve = null;
    function showModal(text, onConfirm) {
        dom.modalText.textContent = text;
        dom.modalOverlay.classList.add('show');
        dom.modalConfirm.onclick = () => {
            hideModal();
            onConfirm();
        };
    }
    function hideModal() {
        dom.modalOverlay.classList.remove('show');
    }

    // ─── Service Worker ──────────────────────────────────────
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    // ─── Utilities ───────────────────────────────────────────
    function pad(n) { return String(n).padStart(2, '0'); }
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function dateStr(d) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    function timeStr(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
    function parseDate(s) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    function isToday(s) { return s === dateStr(new Date()); }
    function isYesterday(s) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return s === dateStr(y);
    }
    function formatDateLabel(d) {
        return `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
    }
    function formatDur(min) {
        if (min < 0) min = 0;
        const h = Math.floor(min / 60);
        const m = min % 60;
        return h > 0 ? `${h}h ${m}min` : `${m}min`;
    }
    function formatDurShort(min) {
        if (min < 0) min = 0;
        const h = Math.floor(min / 60);
        const m = min % 60;
        return m > 0 ? `${h}h${pad(m)}` : `${h}h`;
    }

    // ─── Boot ────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);
})();

