#!/usr/bin/env python3
"""解析 Excel 表格，返回 JSON 任务列表"""
import sys, json, openpyxl

def parse_excel(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb['发送任务'] if '发送任务' in wb.sheetnames else wb.active

    cols = {}
    for c in range(1, ws.max_column + 1):
        t = (ws.cell(2, c).value or '').strip()
        if t:
            cols[t] = c

    tasks = []
    for r in range(3, ws.max_row + 1):
        vals = [ws.cell(r, c).value for c in cols.values()]
        if not any(v is not None and str(v).strip() for v in vals):
            continue

        tasks.append({
            'app':       str(ws.cell(r, cols.get('* 应用', 0) or 1).value or '微信').strip(),
            'target':    str(ws.cell(r, cols.get('* 联系人/群聊', 0) or 1).value or '').strip(),
            'msg_type':  str(ws.cell(r, cols.get('* 消息类型', 0) or 1).value or '文字').strip(),
            'text':      str(ws.cell(r, cols.get('* 文字内容', 0) or 1).value or '').strip(),
            'image_path': str(ws.cell(r, cols.get('图片路径', 0) or 1).value or '').strip(),
            'send_time': str(ws.cell(r, cols.get('发送时间', 0) or 1).value or '').strip(),
            'repeat':    str(ws.cell(r, cols.get('重复', 0) or 1).value or '').strip(),
        })

    json.dump(tasks, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('ERROR: missing xlsx_path argument', file=sys.stderr)
        sys.exit(1)
    parse_excel(sys.argv[1])
