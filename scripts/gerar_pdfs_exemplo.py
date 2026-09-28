"""Gera os PDFs fictícios de caderno de prova usados nos dados de exemplo.

Uso: python scripts/gerar_pdfs_exemplo.py
Saída: public/exemplos/caderno-exemplo-{1..5}ano.pdf
"""
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

DESTINO = Path(__file__).resolve().parent.parent / "public" / "exemplos"

# Mesma distribuição de disciplinas usada em src/data/seed.ts
DISCIPLINAS_1_2 = ["Português"] * 6 + ["Matemática"] * 6 + ["Ciências"] * 2 + ["História", "Geografia"]
DISCIPLINAS_3_5 = ["Português"] * 8 + ["Matemática"] * 8 + ["Ciências"] * 2 + ["História", "Geografia"]


def capa(c, ano):
    largura, altura = A4
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(largura / 2, altura - 70 * mm, "Avaliação diagnóstica")
    c.setFont("Helvetica", 18)
    c.drawCentredString(largura / 2, altura - 82 * mm, f"{ano}º ano do Ensino Fundamental")
    c.setFont("Helvetica", 12)
    c.drawCentredString(largura / 2, altura - 100 * mm, "Caderno de exemplo, com conteúdo fictício, para testar o site Prova Solar")
    c.rect(25 * mm, altura - 150 * mm, largura - 50 * mm, 30 * mm)
    c.drawString(30 * mm, altura - 130 * mm, "Nome: ______________________________________________")
    c.drawString(30 * mm, altura - 142 * mm, "Turma: ________      Nº: ______      Data: ____/____/______")
    c.setFont("Helvetica-Oblique", 11)
    instrucao = ("Marque a alternativa neste caderno." if ano <= 2
                 else "Marque suas respostas na folha de respostas.")
    c.drawCentredString(largura / 2, altura - 165 * mm, instrucao)
    c.showPage()


def questoes(c, ano):
    largura, altura = A4
    disciplinas = DISCIPLINAS_1_2 if ano <= 2 else DISCIPLINAS_3_5
    y = altura - 25 * mm
    for numero, disciplina in enumerate(disciplinas, start=1):
        if y < 70 * mm:
            c.showPage()
            y = altura - 25 * mm
        c.setFont("Helvetica-Bold", 13)
        c.drawString(20 * mm, y, f"Questão {numero}  ·  {disciplina}")
        c.setFont("Helvetica", 11)
        c.drawString(20 * mm, y - 8 * mm, "Enunciado de exemplo. Aqui entraria o texto, a imagem ou o problema da questão.")
        for i, letra in enumerate("ABCD"):
            linha = y - (17 + 7 * i) * mm
            if ano <= 2:
                c.circle(23 * mm, linha + 1.3 * mm, 2.6 * mm)
                c.drawString(29 * mm, linha, f"{letra}) Alternativa de exemplo")
            else:
                c.drawString(22 * mm, linha, f"({letra}) Alternativa de exemplo")
        y -= 52 * mm
    c.showPage()


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    for ano in range(1, 6):
        arquivo = DESTINO / f"caderno-exemplo-{ano}ano.pdf"
        c = canvas.Canvas(str(arquivo), pagesize=A4)
        c.setTitle(f"Caderno de exemplo — {ano}º ano")
        capa(c, ano)
        questoes(c, ano)
        c.save()
        print(arquivo.name, arquivo.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
