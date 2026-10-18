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
    let editingRecordId = null;

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
        schedulePillText: $('#schedulePillText'),
        clockBtn: $('#clockBtn'),
        clockFace: $('#clockFace'),
        clockLabel: $('#clockLabel'),
        iconPlay: $('#iconPlay'),
        iconStop: $('#iconStop'),
        clockRing: $('#clockRing'),
        lunchBtn: $('#lunchBtn'),
        lunchText: $('#lunchText'),
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
        // Settings L-J
        cfgWorkStart: $('#cfgWorkStart'),
        cfgWorkEnd: $('#cfgWorkEnd'),
        cfgDailyH: $('#cfgDailyH'),
        // Settings Viernes
        cfgFridayStart: $('#cfgFridayStart'),
        cfgFridayEnd: $('#cfgFridayEnd'),
        cfgFridayH: $('#cfgFridayH'),
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
        // Edit record modal
        editModalOverlay: $('#editModalOverlay'),
        editModalClose: $('#editModalClose'),
        editDate: $('#editDate'),
        editCheckIn: $('#editCheckIn'),
        editCheckOut: $('#editCheckOut'),
        editCalcBadge: $('#editCalcBadge'),
        btnSaveEdit: $('#btnSaveEdit'),
        btnDeleteRecord: $('#btnDeleteRecord'),
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
            settings: {
                workStart: '09:00',
                workEnd: '19:00',
                dailyHours: 10,
                fridayStart: '09:00',
                fridayEnd: '15:00',
                fridayHours: 6,
                weeklyHours: 46,
                sheetsUrl: '',
            },
            session: null,          // { checkIn: ISO, inLunch: boolean }
            records: [],            // { id, date, checkIn, checkOut, totalMin, overtime, synced }
        };
    }

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultData();
            const parsed = JSON.parse(raw);
            const defaults = defaultData();

            // Forward-compatibility migration: ensure Friday 9:00-15:00 (6h) is configured
            const settings = { ...defaults.settings, ...parsed.settings };
            if (!parsed.settings || !parsed.settings.fridayStart) {
                settings.fridayStart = '09:00';
                settings.fridayEnd = '15:00';
                settings.fridayHours = 6;
                settings.weeklyHours = 46;
            }

            return {
                ...defaults,
                ...parsed,
                settings,
            };
        } catch {
            return defaultData();
        }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // ─── Schedule Helpers ────────────────────────────────────
    function getDayTargetMin(dateInput) {
        let d;
        if (typeof dateInput === 'string') {
            d = parseDate(dateInput);
        } else if (dateInput instanceof Date) {
            d = dateInput;
        } else {
            d = new Date();
        }
        const isFriday = d.getDay() === 5;
        const hours = isFriday ? (data.settings.fridayHours || 6) : (data.settings.dailyHours || 10);
        return Math.round(hours * 60);
    }

    // ─── Header ──────────────────────────────────────────────
    function updateHeaderDate() {
        const now = new Date();
        const day = DAYS_FULL[now.getDay()];
        const d = now.getDate();
        const m = MONTHS_ES[now.getMonth()];
        dom.headerDate.textContent = `${day}, ${d} ${m}`;
    }

    function updateScheduleBadge() {
        if (!dom.schedulePillText) return;
        const now = new Date();
        const dayOfWeek = now.getDay();

        if (dayOfWeek === 5) {
            // Viernes
            const start = data.settings.fridayStart || '09:00';
            const end = data.settings.fridayEnd || '15:00';
            const h = data.settings.fridayHours || 6;
            dom.schedulePillText.textContent = `Hoy Viernes: ${start} – ${end} (${h}h)`;
        } else if (dayOfWeek >= 1 && dayOfWeek <= 4) {
            // Lunes a Jueves
            const start = data.settings.workStart || '09:00';
            const end = data.settings.workEnd || '19:00';
            const h = data.settings.dailyHours || 10;
            dom.schedulePillText.textContent = `Hoy: ${start} – ${end} (${h}h)`;
        } else {
            // Fin de semana
            dom.schedulePillText.textContent = `L-J: 09:00–19:00 (10h) · V: 09:00–15:00 (6h)`;
        }
    }

    // ─── Navigation & Events ─────────────────────────────────
    function bindEvents() {
        // Tabs
        $$('.tab').forEach(tab => {
            tab.addEventListener('click', () => switchScreen(tab.dataset.screen));
        });

        // Clock button
        dom.clockBtn.addEventListener('click', toggleClock);

        // Lunch button
        if (dom.lunchBtn) {
            dom.lunchBtn.addEventListener('click', toggleLunch);
        }

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

        // Settings L-J inputs
        if (dom.cfgWorkStart) {
            dom.cfgWorkStart.addEventListener('change', () => {
                data.settings.workStart = dom.cfgWorkStart.value || '09:00';
                recalcScheduleHours('mon_thu');
            });
        }
        if (dom.cfgWorkEnd) {
            dom.cfgWorkEnd.addEventListener('change', () => {
                data.settings.workEnd = dom.cfgWorkEnd.value || '19:00';
                recalcScheduleHours('mon_thu');
            });
        }
        dom.cfgDailyH.addEventListener('change', () => {
            data.settings.dailyHours = parseFloat(dom.cfgDailyH.value) || 10;
            updateWeeklyTotal();
            save();
            updateScheduleBadge();
            recalcOvertime();
            renderTodaySummary();
            renderStats();
        });

        // Settings Viernes inputs
        if (dom.cfgFridayStart) {
            dom.cfgFridayStart.addEventListener('change', () => {
                data.settings.fridayStart = dom.cfgFridayStart.value || '09:00';
                recalcScheduleHours('friday');
            });
        }
        if (dom.cfgFridayEnd) {
            dom.cfgFridayEnd.addEventListener('change', () => {
                data.settings.fridayEnd = dom.cfgFridayEnd.value || '15:00';
                recalcScheduleHours('friday');
            });
        }
        if (dom.cfgFridayH) {
            dom.cfgFridayH.addEventListener('change', () => {
                data.settings.fridayHours = parseFloat(dom.cfgFridayH.value) || 6;
                updateWeeklyTotal();
                save();
                updateScheduleBadge();
                recalcOvertime();
                renderTodaySummary();
                renderStats();
            });
        }

        dom.cfgWeeklyH.addEventListener('change', () => {
            data.settings.weeklyHours = parseFloat(dom.cfgWeeklyH.value) || 46;
            save();
        });
        dom.cfgSheetsUrl.addEventListener('change', () => {
            data.settings.sheetsUrl = dom.cfgSheetsUrl.value.trim();
            save();
        });

        // Edit Record modal events
        if (dom.editModalClose) {
            dom.editModalClose.addEventListener('click', closeEditModal);
        }
        if (dom.editCheckIn) {
            dom.editCheckIn.addEventListener('input', updateEditPreview);
        }
        if (dom.editCheckOut) {
            dom.editCheckOut.addEventListener('input', updateEditPreview);
        }
        if (dom.btnSaveEdit) {
            dom.btnSaveEdit.addEventListener('click', saveRecordEdit);
        }
        if (dom.btnDeleteRecord) {
            dom.btnDeleteRecord.addEventListener('click', deleteCurrentRecord);
        }
        if (dom.editModalOverlay) {
            dom.editModalOverlay.addEventListener('click', (e) => {
                if (e.target === dom.editModalOverlay) closeEditModal();
            });
        }

        // Actions
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

        // General Modal
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

    function recalcScheduleHours(type) {
        if (type === 'mon_thu') {
            const start = dom.cfgWorkStart.value || '09:00';
            const end = dom.cfgWorkEnd.value || '19:00';
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            let diffMin = (eh * 60 + em) - (sh * 60 + sm);
            if (diffMin <= 0) diffMin += 24 * 60;
            const hours = Math.round((diffMin / 60) * 10) / 10;
            data.settings.dailyHours = hours;
            dom.cfgDailyH.value = hours;
        } else if (type === 'friday') {
            const start = dom.cfgFridayStart.value || '09:00';
            const end = dom.cfgFridayEnd.value || '15:00';
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            let diffMin = (eh * 60 + em) - (sh * 60 + sm);
            if (diffMin <= 0) diffMin += 24 * 60;
            const hours = Math.round((diffMin / 60) * 10) / 10;
            data.settings.fridayHours = hours;
            if (dom.cfgFridayH) dom.cfgFridayH.value = hours;
        }

        updateWeeklyTotal();
        save();
        updateScheduleBadge();
        recalcOvertime();
        renderTodaySummary();
        renderStats();
    }

    function updateWeeklyTotal() {
        const total = (data.settings.dailyHours * 4) + data.settings.fridayHours;
        data.settings.weeklyHours = total;
        if (dom.cfgWeeklyH) dom.cfgWeeklyH.value = total;
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
        data.session = {
            checkIn: now.toISOString(),
            inLunch: false,
        };
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
        const dayTargetMin = getDayTargetMin(checkOut);

        // Calculate today's total to determine overtime
        const todayStr = dateStr(checkOut);
        const todayRecords = data.records.filter(r => r.date === todayStr);
        const prevMin = todayRecords.reduce((s, r) => s + r.totalMin, 0);
        const newTotalMin = prevMin + totalMin;
        const overtime = Math.max(0, newTotalMin - dayTargetMin);
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
            if (data.session.inLunch) {
                setLunchUI(true);
            }
            startTimer(new Date(data.session.checkIn));
        }
    }

    // ─── Lunch Option (Sigue contando) ───────────────────────
    function toggleLunch() {
        if (!data.session) return;
        data.session.inLunch = !data.session.inLunch;
        save();
        setLunchUI(data.session.inLunch);

        if (data.session.inLunch) {
            toast('🍽️ En comida (el tiempo sigue contando)');
            if (navigator.vibrate) navigator.vibrate(20);
        } else {
            toast('💼 De vuelta al trabajo');
            if (navigator.vibrate) navigator.vibrate([20, 20]);
        }
    }

    function setLunchUI(isLunch) {
        if (!dom.lunchBtn) return;
        dom.lunchBtn.classList.toggle('active', isLunch);
        dom.lunchText.textContent = isLunch ? 'Volver de comida' : 'Ir a comida';
        dom.statusPill.classList.toggle('lunch', isLunch);
        dom.statusText.textContent = isLunch ? 'En comida (contando)' : (data.session ? 'Trabajando' : 'Sin fichar');
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

        // Lunch button visibility
        if (dom.lunchBtn) {
            dom.lunchBtn.classList.toggle('hidden', !active);
            if (!active) {
                setLunchUI(false);
            }
        }
    }

    // ─── Render: Today ───────────────────────────────────────
    function renderTodaySummary() {
        const now = new Date();
        const today = dateStr(now);
        const recs = data.records.filter(r => r.date === today);
        const totalMin = recs.reduce((s, r) => s + r.totalMin, 0);
        const dayTargetMin = getDayTargetMin(now);
        const extra = Math.max(0, totalMin - dayTargetMin);

        dom.todayWorked.textContent = formatDur(totalMin);
        dom.todayExtra.textContent = formatDur(extra);

        if (recs.length === 0) {
            dom.todayRecords.innerHTML = '';
            return;
        }

        dom.todayRecords.innerHTML = recs.map(r => `
            <div class="record-row" data-id="${r.id}" title="Toca para editar">
                <span class="record-time">${r.checkIn} → ${r.checkOut}</span>
                <div class="history-item-right">
                    <span class="record-dur">${formatDur(r.totalMin)}</span>
                    <svg class="edit-hint-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                </div>
            </div>
        `).join('');

        // Attach click listeners to edit records
        dom.todayRecords.querySelectorAll('.record-row').forEach(row => {
            row.addEventListener('click', () => openEditModal(row.dataset.id));
        });
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
            const isFri = d.getDay() === 5;
            const dayLabel = isToday(date) ? 'Hoy' : isYesterday(date) ? 'Ayer' : formatDateLabel(d);
            const recs = groups[date];
            const dayTotal = recs.reduce((s, r) => s + r.totalMin, 0);
            const dayTarget = getDayTargetMin(date);
            const friBadge = isFri ? ' · Viernes' : '';

            html += `<div class="history-date-group animate-in">
                <div class="history-date">${dayLabel}${friBadge} · ${formatDur(dayTotal)}</div>
                <div class="history-card">`;

            recs.forEach(r => {
                let extraHtml = '';
                if (r.overtime > 0) extraHtml = `<span class="history-item-extra">+${formatDur(r.overtime)} extra</span>`;

                html += `<div class="history-item" data-id="${r.id}" title="Toca para editar">
                    <div class="history-item-left">
                        <span class="history-item-time">${r.checkIn} → ${r.checkOut}</span>
                        ${extraHtml}
                    </div>
                    <div class="history-item-right">
                        <span class="history-item-dur">${formatDur(r.totalMin)}</span>
                        <svg class="edit-hint-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                    </div>
                </div>`;
            });

            html += `</div></div>`;
        });

        dom.historyList.innerHTML = html;

        // Attach click to edit
        dom.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => openEditModal(item.dataset.id));
        });
    }

    // ─── Edit Record Modal ───────────────────────────────────
    function openEditModal(id) {
        const record = data.records.find(r => r.id === id);
        if (!record) return;

        editingRecordId = id;
        dom.editDate.value = record.date;
        dom.editCheckIn.value = record.checkIn;
        dom.editCheckOut.value = record.checkOut;
        updateEditPreview();

        dom.editModalOverlay.classList.add('show');
    }

    function closeEditModal() {
        dom.editModalOverlay.classList.remove('show');
        editingRecordId = null;
    }

    function updateEditPreview() {
        const inVal = dom.editCheckIn.value;
        const outVal = dom.editCheckOut.value;
        if (!inVal || !outVal) {
            dom.editCalcBadge.textContent = 'Duración: --';
            return;
        }

        const [ih, im] = inVal.split(':').map(Number);
        const [oh, om] = outVal.split(':').map(Number);
        let min = (oh * 60 + om) - (ih * 60 + im);
        if (min < 0) min += 24 * 60; // Overnight shift support

        dom.editCalcBadge.textContent = `Duración: ${formatDur(min)}`;
    }

    function saveRecordEdit() {
        if (!editingRecordId) return;
        const record = data.records.find(r => r.id === editingRecordId);
        if (!record) return;

        const newDate = dom.editDate.value;
        const newIn = dom.editCheckIn.value;
        const newOut = dom.editCheckOut.value;

        if (!newDate || !newIn || !newOut) {
            toast('Por favor completa todos los campos');
            return;
        }

        const [ih, im] = newIn.split(':').map(Number);
        const [oh, om] = newOut.split(':').map(Number);
        let min = (oh * 60 + om) - (ih * 60 + im);
        if (min < 0) min += 24 * 60;

        record.date = newDate;
        record.checkIn = newIn;
        record.checkOut = newOut;
        record.totalMin = min;
        record.synced = false;

        recalcOvertime();
        save();

        closeEditModal();
        renderTodaySummary();
        renderHistory();
        renderStats();
        toast('✓ Registro modificado');
    }

    function deleteCurrentRecord() {
        if (!editingRecordId) return;
        const idToDelete = editingRecordId;

        showModal('¿Eliminar este registro de fichaje?', () => {
            data.records = data.records.filter(r => r.id !== idToDelete);
            recalcOvertime();
            save();

            closeEditModal();
            renderTodaySummary();
            renderHistory();
            renderStats();
            toast('✓ Registro eliminado');
        });
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

        // Calculate expected target considering Fridays
        let expectedMin = 0;
        if (currentPeriod === 'week') {
            expectedMin = data.settings.weeklyHours * 60;
        } else {
            Object.keys(byDate).forEach(d => {
                expectedMin += getDayTargetMin(d);
            });
        }
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
        let maxVal = 10 * 60; // Base reference
        const items = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const key = dateStr(d);
            const val = byDate[key] || 0;
            const target = getDayTargetMin(d);
            items.push({ val, target });
            if (val > maxVal) maxVal = val;
        }

        dom.barChart.innerHTML = items.map((item, i) => {
            const pct = maxVal > 0 ? (item.val / maxVal) * 100 : 0;
            const isOver = item.val > item.target && item.target > 0;
            return `<div class="bar-col">
                <span class="bar-val">${item.val > 0 ? formatDurShort(item.val) : ''}</span>
                <div class="bar ${isOver ? 'overtime' : ''}" style="height:${Math.max(pct, 3)}%"></div>
                <span class="bar-day">${labels[i]}</span>
            </div>`;
        }).join('');
    }

    function renderMonthChart(startDate, endDate, byDate) {
        const weeks = [];
        let current = new Date(startDate);
        let weekNum = 1;

        while (current <= endDate) {
            let weekTotal = 0;
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

    // ─── Settings ────────────────────────────────────
    function applySettings() {
        if (dom.cfgWorkStart) dom.cfgWorkStart.value = data.settings.workStart || '09:00';
        if (dom.cfgWorkEnd) dom.cfgWorkEnd.value = data.settings.workEnd || '19:00';
        if (dom.cfgDailyH) dom.cfgDailyH.value = data.settings.dailyHours || 10;

        if (dom.cfgFridayStart) dom.cfgFridayStart.value = data.settings.fridayStart || '09:00';
        if (dom.cfgFridayEnd) dom.cfgFridayEnd.value = data.settings.fridayEnd || '15:00';
        if (dom.cfgFridayH) dom.cfgFridayH.value = data.settings.fridayHours || 6;

        if (dom.cfgWeeklyH) dom.cfgWeeklyH.value = data.settings.weeklyHours || 46;
        if (dom.cfgSheetsUrl) dom.cfgSheetsUrl.value = data.settings.sheetsUrl || '';
        updateScheduleBadge();
    }

    function recalcOvertime() {
        const byDate = {};
        data.records.forEach(r => {
            if (!byDate[r.date]) byDate[r.date] = [];
            byDate[r.date].push(r);
        });

        Object.entries(byDate).forEach(([dateStrKey, dayRecs]) => {
            const dayTargetMin = getDayTargetMin(dateStrKey);
            let cumul = 0;
            dayRecs.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
            dayRecs.forEach(r => {
                const prev = cumul;
                cumul += r.totalMin;
                if (cumul > dayTargetMin) {
                    r.overtime = Math.max(0, cumul - Math.max(dayTargetMin, prev));
                } else {
                    r.overtime = 0;
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

        try {
            // Send full current records to ensure edits and deletes reflect in Sheets
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'full_sync', records: data.records }),
            });

            if (!resp.ok) throw new Error('Error ' + resp.status);

            const result = await resp.json();
            if (result.status === 'ok') {
                data.records.forEach(r => r.synced = true);
                save();
                dom.syncMsg.textContent = `${data.records.length} registro(s) sincronizado(s) ✓`;
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
            navigator.serviceWorker.register('sw.js').then(reg => {
                // Force check for updates every time app opens
                reg.update();
            }).catch(() => {});

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
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
