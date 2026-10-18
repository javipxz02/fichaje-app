/**
 * FICHAJE – Google Apps Script Backend
 * ====================================
 * 
 * Este script actúa como API para sincronizar los registros
 * de fichaje con una hoja de Google Sheets.
 * 
 * INSTALACIÓN:
 * 1. Crea una nueva hoja de cálculo en Google Sheets
 * 2. Ve a Extensiones → Apps Script
 * 3. Pega este código en el editor (reemplaza todo el contenido)
 * 4. Haz clic en "Implementar" → "Nueva implementación"
 * 5. Tipo: "Aplicación web"
 * 6. Ejecutar como: "Yo" (tu cuenta)
 * 7. Acceso: "Cualquiera" (para que la PWA pueda conectar)
 * 8. Copia la URL y pégala en los Ajustes de la app Fichaje
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
        
        if (body.action === 'sync') {
            return syncRecords(body.records || []);
        }
        
        return jsonResponse({ status: 'error', message: 'Acción no reconocida' });
    } catch (err) {
        return jsonResponse({ status: 'error', message: err.message });
    }
}

/**
 * Sincroniza registros: añade los nuevos a la hoja
 */
function syncRecords(records) {
    if (!records || records.length === 0) {
        return jsonResponse({ status: 'ok', added: 0 });
    }
    
    const sheet = getOrCreateSheet();
    const existingData = sheet.getDataRange().getValues();
    
    // Obtener IDs existentes para evitar duplicados
    const idCol = 0; // Columna A = ID
    const existingIds = new Set();
    for (let i = 1; i < existingData.length; i++) {
        existingIds.add(existingData[i][idCol]);
    }
    
    let added = 0;
    records.forEach(r => {
        if (!existingIds.has(r.id)) {
            const totalHours = (r.totalMin / 60).toFixed(2);
            const overtimeHours = (r.overtime / 60).toFixed(2);
            
            sheet.appendRow([
                r.id,
                r.date,
                r.checkIn,
                r.checkOut,
                r.totalMin,
                parseFloat(totalHours),
                r.overtime,
                parseFloat(overtimeHours),
            ]);
            added++;
        }
    });
    
    // Ordenar por fecha descendente (más reciente arriba)
    if (added > 0 && sheet.getLastRow() > 2) {
        const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
        range.sort({ column: 2, ascending: false });
    }
    
    return jsonResponse({ status: 'ok', added });
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

