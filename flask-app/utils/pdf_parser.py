import pdfplumber
import re


def extract_text_from_pdf(pdf_path):
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
    return full_text


def split_into_chapters(text):
    patterns = [
        r'(?:^|\n)\s*(?:제?\s*(\d+)\s*(?:단원|장|과|부|편|chapter|CHAPTER|Chapter))',
        r'(?:^|\n)\s*(?:(?:단원|장|과|부|편|chapter|CHAPTER|Chapter)\s*(\d+))',
        r'(?:^|\n)\s*(?:([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+)[\.\s])',
        r'(?:^|\n)\s*(?:(\d+)[\.\s]+[가-힣A-Za-z])',
    ]

    splits = []
    for pattern in patterns:
        matches = list(re.finditer(pattern, text, re.MULTILINE | re.IGNORECASE))
        if len(matches) >= 2:
            for i, match in enumerate(matches):
                start = match.start()
                end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                chapter_text = text[start:end].strip()

                first_line = chapter_text.split('\n')[0].strip()
                title = first_line[:50] if len(first_line) > 50 else first_line

                splits.append({
                    'title': title,
                    'content': chapter_text
                })
            break

    if not splits:
        chunk_size = 2000
        paragraphs = text.split('\n\n')
        current_chunk = ""
        chunk_num = 1

        for para in paragraphs:
            if len(current_chunk) + len(para) > chunk_size and current_chunk:
                first_line = current_chunk.strip().split('\n')[0][:40]
                splits.append({
                    'title': f"섹션 {chunk_num}: {first_line}",
                    'content': current_chunk.strip()
                })
                current_chunk = para
                chunk_num += 1
            else:
                current_chunk += "\n\n" + para

        if current_chunk.strip():
            first_line = current_chunk.strip().split('\n')[0][:40]
            splits.append({
                'title': f"섹션 {chunk_num}: {first_line}",
                'content': current_chunk.strip()
            })

    if not splits:
        splits.append({
            'title': '전체 내용',
            'content': text
        })

    return splits
