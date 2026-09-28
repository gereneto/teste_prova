"""Converte a planilha "BNCC - Habilidades.xlsx" no arquivo src/data/bncc-ef1.json.

Mantém só as habilidades que valem para algum ano do 1º ao 5º.
Uso: python scripts/bncc_para_json.py "caminho/para/BNCC - Habilidades.xlsx"
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

DESTINO = Path(__file__).resolve().parent.parent / "src" / "data" / "bncc-ef1.json"


def limpa(texto):
    if texto is None:
        return ""
    return re.sub(r"\s+", " ", str(texto)).strip()


# Algumas células vieram com o cabeçalho de página do PDF da BNCC colado no fim,
# como "... culturas. 340 BASE NACIONAL COMUM CURRICULAR CIÊNCIAS – 5º ANO".
RODAPE_PDF = re.compile(r"\s*(\d{3}\s+)?BASE NACIONAL COMUM CURRICULAR.*$")


def limpa_texto(texto):
    return RODAPE_PDF.sub("", limpa(texto))


def main(caminho):
    ws = openpyxl.load_workbook(caminho, read_only=True, data_only=True).worksheets[0]
    linhas = list(ws.iter_rows(values_only=True))
    cab = [limpa(c) for c in linhas[0]]
    col = {nome: i for i, nome in enumerate(cab)}
    anos_cols = {ano: col[str(ano)] for ano in range(1, 6)}

    habilidades, vistos = [], set()
    for linha in linhas[1:]:
        codigo = limpa(linha[col["Código"]]).strip("()")
        if not re.fullmatch(r"EF\d\d[A-Z]{2}\d\d", codigo) or codigo in vistos:
            continue
        anos = [ano for ano, i in anos_cols.items() if limpa(linha[i]).lower() == "x"]
        if not anos:
            continue
        vistos.add(codigo)
        habilidades.append({
            "codigo": codigo,
            "componente": limpa(linha[col["Matéria"]]),
            "anos": anos,
            "unidade": limpa_texto(linha[col["Práticas de linguagem / Unidades temáticas"]]),
            "objeto": limpa_texto(linha[col["Objetos de conhecimento"]]),
            "descricao": limpa_texto(linha[col["Habilidades"]]),
        })

    habilidades.sort(key=lambda h: h["codigo"])
    DESTINO.write_text(json.dumps(habilidades, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(habilidades)} habilidades gravadas em {DESTINO}")


if __name__ == "__main__":
    main(sys.argv[1])
