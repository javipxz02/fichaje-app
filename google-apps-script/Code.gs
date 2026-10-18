/**
 * FICHAJE – Google Apps Script Backend
 * ====================================
 * Soporta registro de entrada/salida, tiempo de comida,
 * cálculo de horas totales y horas extra.
 */

const SHEET_NAME = 'Fichajes';
const HEADERS = ['ID', 'Fecha', 'Entrada', 'Salida', 'Comida (min)', 'Comida (h)', 'Min. Totales', 'Horas Totales', 'Min. Extra', 'Horas Extra'];

/**
 * Maneja las solicitudes GET (consultar registros)
 */
function doGet(e) {
    try {
        const sheet = getOrCreateSheet();
        const data = sheet.getDataRange().getValues();
        
        if (data.length <= 1) {
            return jsonResponse({ status: 'ok', records: [] });
        }
        
        const headers = data[0];
        const records = data.slice(1).map(row => {
            const obj = {};
            headers.forEach((h, i) => obj[h] = row[i]);
            return obj;
        });
        
        return jsonResponse({ status: 'ok', records });
    } catch (err) {
        return jsonResponse({ status: 'error', message: err.message });
    }
}

/**
 * Maneja las solicitudes POST (sincronizar registros)
 */
function doPost(e) {
    try {
        const body = JSON.parse(e.postData.contents);
        
        if (body.action === 'full_sync' || body.action === 'sync') {
            return fullSyncRecords(body.records || []);
        }
        
        return jsonResponse({ status: 'error', message: 'Acción no reconocida' });
    } catch (err) {
        return jsonResponse({ status: 'error', message: err.message });
    }
}

/**
 * Sincronización completa: actualiza, modifica y borra según los datos de la app
 */
function fullSyncRecords(records) {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    
    // Limpiar filas anteriores (manteniendo la fila 1 de encabezados)
    if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
    
    if (!records || records.length === 0) {
        return jsonResponse({ status: 'ok', total: 0 });
    }
    
    // Ordenar de más reciente a más antiguo
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.checkIn.localeCompare(a.checkIn));
    
    const rows = sorted.map(r => {
        const lunchMin = r.lunchMin || 0;
        const lunchHours = parseFloat((lunchMin / 60).toFixed(2));
        const totalHours = parseFloat((r.totalMin / 60).toFixed(2));
        const overtimeHours = parseFloat(((r.overtime || 0) / 60).toFixed(2));
        return [
            r.id,
            r.date,
            r.checkIn,
            r.checkOut,
            lunchMin,
            lunchHours,
            r.totalMin,
            totalHours,
            r.overtime || 0,
            overtimeHours
        ];
    });
    
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    return jsonResponse({ status: 'ok', total: rows.length });
}

/**
 * Obtiene o crea la hoja con los encabezados y estilos correctos
 */
function getOrCreateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
    }
    
    // Asegurar encabezados actualizados
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    
    // Formato de encabezados
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#007AFF');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setHorizontalAlignment('center');
    
    // Anchos de columna
    sheet.setColumnWidth(1, 140);  // ID
    sheet.setColumnWidth(2, 110);  // Fecha
    sheet.setColumnWidth(3, 80);   // Entrada
    sheet.setColumnWidth(4, 80);   // Salida
    sheet.setColumnWidth(5, 100);  // Comida (min)
    sheet.setColumnWidth(6, 100);  // Comida (h)
    sheet.setColumnWidth(7, 100);  // Min. Totales
    sheet.setColumnWidth(8, 110);  // Horas Totales
    sheet.setColumnWidth(9, 90);   // Min. Extra
    sheet.setColumnWidth(10, 100); // Horas Extra
    
    sheet.setFrozenRows(1);
    
    return sheet;
}

/**
 * Respuesta JSON
 */
function jsonResponse(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}
