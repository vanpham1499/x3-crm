import { strToU8, zipSync } from 'fflate';

export type XlsxCellFormat = 'number' | 'percent' | 'datetime';
export type XlsxCellValue = string | number | boolean | Date | null | undefined;

export type XlsxCell = {
  value: XlsxCellValue;
  format?: XlsxCellFormat;
};

export type XlsxSheet = {
  name: string;
  columns: Array<{
    header: string;
    width?: number;
  }>;
  rows: Array<Array<XlsxCellValue | XlsxCell>>;
};

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number) {
  let value = index + 1;
  let result = '';

  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return result;
}

function excelDateSerial(value: Date) {
  return (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
}

function isXlsxCell(value: XlsxCellValue | XlsxCell): value is XlsxCell {
  return Boolean(
    value && typeof value === 'object' && !(value instanceof Date) && 'value' in value,
  );
}

function styleIndex(format?: XlsxCellFormat) {
  if (format === 'number') return 2;
  if (format === 'percent') return 3;
  if (format === 'datetime') return 4;

  return 0;
}

function serializeCell(value: XlsxCellValue | XlsxCell, reference: string, header = false) {
  const cell = isXlsxCell(value) ? value : { value };
  const style = header ? 1 : styleIndex(cell.format);
  const styleAttribute = style ? ` s="${style}"` : '';

  if (cell.value === null || cell.value === undefined || cell.value === '') {
    return `<c r="${reference}"${styleAttribute}/>`;
  }

  if (cell.value instanceof Date && !Number.isNaN(cell.value.getTime())) {
    return `<c r="${reference}" s="4"><v>${excelDateSerial(cell.value)}</v></c>`;
  }

  if (typeof cell.value === 'number' && Number.isFinite(cell.value)) {
    return `<c r="${reference}"${styleAttribute}><v>${cell.value}</v></c>`;
  }

  if (typeof cell.value === 'boolean') {
    return `<c r="${reference}" t="b"${styleAttribute}><v>${cell.value ? 1 : 0}</v></c>`;
  }

  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${escapeXml(String(cell.value))}</t></is></c>`;
}

function sanitizeSheetName(name: string, fallback: string) {
  const sanitized = name
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31);

  return sanitized || fallback;
}

function worksheetXml(sheet: XlsxSheet) {
  const columnCount = Math.max(sheet.columns.length, 1);
  const lastColumn = columnName(columnCount - 1);
  const lastRow = Math.max(sheet.rows.length + 1, 1);
  const columnXml = sheet.columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${Math.max(8, Math.min(column.width ?? 18, 60))}" customWidth="1"/>`,
    )
    .join('');
  const headerCells = sheet.columns
    .map((column, index) => serializeCell(column.header, `${columnName(index)}1`, true))
    .join('');
  const dataRows = sheet.rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 2;
      const cells = sheet.columns
        .map((_, columnIndex) =>
          serializeCell(row[columnIndex], `${columnName(columnIndex)}${excelRow}`),
        )
        .join('');

      return `<row r="${excelRow}">${cells}</row>`;
    })
    .join('');

  return `${XML_HEADER}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnXml}</cols>
  <sheetData><row r="1" ht="28" customHeight="1">${headerCells}</row>${dataRows}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
}

function stylesXml() {
  return `${XML_HEADER}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="#,##0"/>
    <numFmt numFmtId="165" formatCode="0.00%"/>
    <numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF00A76F"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

export function createXlsxWorkbook(sheets: XlsxSheet[]) {
  if (sheets.length === 0) throw new Error('Workbook phải có ít nhất một sheet.');

  const usedNames = new Set<string>();
  const normalizedSheets = sheets.map((sheet, index) => {
    const baseName = sanitizeSheetName(sheet.name, `Sheet ${index + 1}`);
    let name = baseName;
    let suffix = 2;

    while (usedNames.has(name)) {
      const suffixText = ` (${suffix})`;
      name = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    usedNames.add(name);

    return { ...sheet, name };
  });
  const timestamp = new Date().toISOString();
  const files: Record<string, Uint8Array> = {};
  const addFile = (path: string, content: string) => {
    files[path] = strToU8(content);
  };

  addFile(
    '[Content_Types].xml',
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${normalizedSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  );
  addFile(
    '_rels/.rels',
    `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  addFile(
    'docProps/core.xml',
    `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>X3Sales CRM</dc:creator><cp:lastModifiedBy>X3Sales CRM</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`,
  );
  addFile(
    'docProps/app.xml',
    `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>X3Sales CRM</Application><TitlesOfParts><vt:vector size="${normalizedSheets.length}" baseType="lpstr">${normalizedSheets.map((sheet) => `<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts></Properties>`,
  );
  addFile(
    'xl/workbook.xml',
    `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${normalizedSheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets><calcPr calcId="191029"/></workbook>`,
  );
  addFile(
    'xl/_rels/workbook.xml.rels',
    `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalizedSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${normalizedSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  addFile('xl/styles.xml', stylesXml());
  normalizedSheets.forEach((sheet, index) => {
    addFile(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet));
  });

  return zipSync(files, { level: 6 });
}

export function downloadXlsxWorkbook(filename: string, sheets: XlsxSheet[]) {
  if (typeof window === 'undefined' || sheets.length === 0) return;

  const archive = createXlsxWorkbook(sheets);
  const blob = new Blob([archive], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
