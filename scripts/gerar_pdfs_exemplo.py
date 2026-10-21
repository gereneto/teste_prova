"""Gera os PDFs fictícios das provas usadas nos dados de exemplo: uma prova de cada disciplina para cada
ano (decisão de 2026-10-19). Por enquanto a prova é só de Português (2026-10-21).

Uso: python scripts/gerar_pdfs_exemplo.py
Saída: public/exemplos/prova-exemplo-{1..5}ano-pt.pdf, e os tamanhos para src/data/seed.ts
"""
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

DESTINO = Path(__file__).resolve().parent.parent / "public" / "exemplos"

# Mesmo número de questões de src/data/seed.ts (questoesDaProva): 8 no 1º e no 2º ano, 10 do 3º ao 5º.
DISCIPLINAS = {"pt": "Português"}


def questoes_da_prova(ano):
    return 8 if ano <= 2 else 10


def capa(c, ano, disciplina):
    largura, altura = A4
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(largura / 2, altura - 70 * mm, f"Avaliação anual · {disciplina}")
    c.setFont("Helvetica", 18)
    c.drawCentredString(largura / 2, altura - 82 * mm, f"{ano}º ano do Ensino Fundamental")
    c.setFont("Helvetica", 12)
    c.drawCentredString(largura / 2, altura - 100 * mm, "Prova de exemplo, com conteúdo fictício, para testar o site Prova Solar")
    c.rect(25 * mm, altura - 150 * mm, largura - 50 * mm, 30 * mm)
    c.drawString(30 * mm, altura - 130 * mm, "Nome: ______________________________________________")
    c.drawString(30 * mm, altura - 142 * mm, "Turma: ________      Nº: ______      Data: ____/____/______")
    c.setFont("Helvetica-Oblique", 11)
    instrucao = ("Marque suas respostas na folha de respostas." if ano == 5
                 else "Marque a alternativa nesta prova.")
    c.drawCentredString(largura / 2, altura - 165 * mm, instrucao)
    c.showPage()


def questoes(c, ano, disciplina):
    largura, altura = A4
    y = altura - 25 * mm
    for numero in range(1, questoes_da_prova(ano) + 1):
        if y < 70 * mm:
            c.showPage()
            y = altura - 25 * mm
        c.setFont("Helvetica-Bold", 13)
        c.drawString(20 * mm, y, f"Questão {numero}  ·  {disciplina}")
        c.setFont("Helvetica", 11)
        c.drawString(20 * mm, y - 8 * mm, "Enunciado de exemplo. Aqui entraria o texto, a imagem ou o problema da questão.")
        for i, letra in enumerate("ABCD"):
            linha = y - (17 + 7 * i) * mm
            if ano < 5:
                c.circle(23 * mm, linha + 1.3 * mm, 2.6 * mm)
                c.drawString(29 * mm, linha, f"{letra}) Alternativa de exemplo")
            else:
                c.drawString(22 * mm, linha, f"({letra}) Alternativa de exemplo")
        y -= 52 * mm
    c.showPage()


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    tamanhos = {}
    for ano in range(1, 6):
        for sufixo, disciplina in DISCIPLINAS.items():
            arquivo = DESTINO / f"prova-exemplo-{ano}ano-{sufixo}.pdf"
            c = canvas.Canvas(str(arquivo), pagesize=A4, invariant=1)
            c.setTitle(f"Prova de exemplo — {disciplina}, {ano}º ano")
            capa(c, ano, disciplina)
            questoes(c, ano, disciplina)
            c.save()
            tamanhos[f"{ano}-{sufixo}"] = arquivo.stat().st_size
            print(arquivo.name, arquivo.stat().st_size // 1024, "KB")
    print("TAMANHOS_PDF =", tamanhos)


if __name__ == "__main__":
    main()
