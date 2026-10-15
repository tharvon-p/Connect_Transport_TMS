import re
import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="D3D3D3"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def md_to_docx(md_path, docx_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    doc = Document()

    # Page setup
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Base style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Cordia New'
    normal_style.font.size = Pt(14)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)

    i = 0
    while i < len(lines):
        line = lines[i].rstrip('\r\n')

        # Skip empty lines
        if not line.strip():
            i += 1
            continue

        # Skip mermaid blocks
        if line.strip().startswith('```'):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                i += 1
            i += 1
            continue

        # Horizontal Rule
        if line.strip() in ['---', '***']:
            p = doc.add_paragraph()
            p_border = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/></w:pBdr>')
            p._p.get_or_add_pPr().append(p_border)
            i += 1
            continue

        # Headers
        if line.startswith('# '):
            h = doc.add_heading(level=1)
            run = h.add_run(line[2:].strip())
            run.font.name = 'Cordia New'
            run.font.size = Pt(22)
            run.font.bold = True
            run.font.color.rgb = RGBColor(30, 58, 138)
            i += 1
            continue

        if line.startswith('## '):
            h = doc.add_heading(level=2)
            run = h.add_run(line[3:].strip())
            run.font.name = 'Cordia New'
            run.font.size = Pt(18)
            run.font.bold = True
            run.font.color.rgb = RGBColor(37, 99, 235)
            i += 1
            continue

        if line.startswith('### '):
            h = doc.add_heading(level=3)
            run = h.add_run(line[4:].strip())
            run.font.name = 'Cordia New'
            run.font.size = Pt(16)
            run.font.bold = True
            run.font.color.rgb = RGBColor(15, 23, 42)
            i += 1
            continue

        # Markdown Table Detection
        if '|' in line and i + 1 < len(lines) and '|' in lines[i+1] and '---' in lines[i+1]:
            table_lines = []
            while i < len(lines) and '|' in lines[i]:
                table_lines.append(lines[i].strip())
                i += 1
            
            # Parse table
            headers = [c.strip() for c in table_lines[0].split('|')[1:-1]]
            rows = []
            for r_line in table_lines[2:]:
                cells = [c.strip() for c in r_line.split('|')[1:-1]]
                if cells:
                    rows.append(cells)

            if headers:
                table = doc.add_table(rows=len(rows) + 1, cols=len(headers))
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                set_table_borders(table)

                # Format Header Row
                hdr_cells = table.rows[0].cells
                for col_idx, h_text in enumerate(headers):
                    hdr_cells[col_idx].text = h_text
                    set_cell_background(hdr_cells[col_idx], "1E293B")
                    set_cell_margins(hdr_cells[col_idx], 120, 120, 150, 150)
                    for p in hdr_cells[col_idx].paragraphs:
                        for run in p.runs:
                            run.font.name = 'Cordia New'
                            run.font.size = Pt(13)
                            run.font.bold = True
                            run.font.color.rgb = RGBColor(255, 255, 255)

                # Format Body Rows
                for row_idx, r_data in enumerate(rows):
                    row_cells = table.rows[row_idx + 1].cells
                    bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
                    for col_idx in range(len(headers)):
                        val = r_data[col_idx] if col_idx < len(r_data) else ""
                        row_cells[col_idx].text = val.replace('`', '')
                        set_cell_background(row_cells[col_idx], bg)
                        set_cell_margins(row_cells[col_idx], 80, 80, 120, 120)
                        for p in row_cells[col_idx].paragraphs:
                            for run in p.runs:
                                run.font.name = 'Cordia New'
                                run.font.size = Pt(12)
                                run.font.color.rgb = RGBColor(51, 65, 85)
                
                doc.add_paragraph() # space after table
            continue

        # Bullet lists
        if line.strip().startswith('- ') or line.strip().startswith('* '):
            text = line.strip()[2:].strip()
            p = doc.add_paragraph(style='List Bullet')
            add_formatted_runs(p, text)
            i += 1
            continue

        # Numbered list
        m_num = re.match(r'^(\d+)\.\s+(.*)', line.strip())
        if m_num:
            text = m_num.group(2)
            p = doc.add_paragraph(style='List Number')
            add_formatted_runs(p, text)
            i += 1
            continue

        # Regular Paragraph
        p = doc.add_paragraph()
        add_formatted_runs(p, line.strip())
        i += 1

    doc.save(docx_path)
    print(f"Successfully converted to {docx_path}")

def add_formatted_runs(paragraph, text):
    # Regex to handle bold **text** and `code`
    tokens = re.split(r'(\*\*.*?\*\*|\`.*?\`|\[.*?\]\(.*?\))', text)
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**'):
            run = paragraph.add_run(token[2:-2])
            run.font.bold = True
            run.font.name = 'Cordia New'
            run.font.size = Pt(14)
        elif token.startswith('`') and token.endswith('`'):
            run = paragraph.add_run(token[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(12)
            run.font.color.rgb = RGBColor(15, 23, 42)
        else:
            run = paragraph.add_run(token)
            run.font.name = 'Cordia New'
            run.font.size = Pt(14)

if __name__ == '__main__':
    md = r'c:\Users\kw_user\Desktop\Antigravity_Project\Connect_Transport_TMS\CONNECT_TRANSPORT_TMS_V1_BLUEPRINT.md'
    docx = r'c:\Users\kw_user\Desktop\Antigravity_Project\Connect_Transport_TMS\CONNECT_TRANSPORT_TMS_V1_BLUEPRINT.docx'
    md_to_docx(md, docx)
