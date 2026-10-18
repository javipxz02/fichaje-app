/**
 * FICHAJE – Google Apps Script Backend
 * ====================================
 * 
 * Este script actúa como API para sincronizar los registros
 * de fichaje con una hoja de Google Sheets.
 * Soporta creación, modificación y borrado de registros.
 */

// Nombre de la hoja donde se guardarán los datos
const SHEET_NAME = 'Fichajes';

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
    
    // Limpiar filas anteriores (respetando la fila 1 de encabezados)
    if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
    }
    
    if (!records || records.length === 0) {
        return jsonResponse({ status: 'ok', total: 0 });
    }
    
    // Ordenar de más reciente a más antiguo
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.checkIn.localeCompare(a.checkIn));
    
    const rows = sorted.map(r => [
        r.id,
        r.date,
        r.checkIn,
        r.checkOut,
        r.totalMin,
        parseFloat((r.totalMin / 60).toFixed(2)),
        r.overtime || 0,
        parseFloat(((r.overtime || 0) / 60).toFixed(2))
    ]);
    
    sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    return jsonResponse({ status: 'ok', total: rows.length });
}

/**
 * Obtiene o crea la hoja con los encabezados correctos
 */
function getOrCreateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        
        // Crear encabezados
        const headers = ['ID', 'Fecha', 'Entrada', 'Salida', 'Min. Totales', 'Horas Totales', 'Min. Extra', 'Horas Extra'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        
        // Formatear encabezados
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#007AFF');
        headerRange.setFontColor('#FFFFFF');
        headerRange.setHorizontalAlignment('center');
        
        // Ajustar anchos de columna
        sheet.setColumnWidth(1, 140);  // ID
        sheet.setColumnWidth(2, 110);  // Fecha
        sheet.setColumnWidth(3, 80);   // Entrada
        sheet.setColumnWidth(4, 80);   // Salida
        sheet.setColumnWidth(5, 100);  // Min. Totales
        sheet.setColumnWidth(6, 110);  // Horas Totales
        sheet.setColumnWidth(7, 90);   // Min. Extra
        sheet.setColumnWidth(8, 100);  // Horas Extra
        
        // Congelar primera fila
        sheet.setFrozenRows(1);
    }
    
    return sheet;
}

/**
 * Crea una respuesta JSON con los headers CORS correctos
 */
function jsonResponse(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}
