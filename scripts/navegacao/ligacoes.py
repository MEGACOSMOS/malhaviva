# As ligações das casas, para dar a quem lá mora.
#
# Cada casa tem o seu endereço — malhaviva.pt/casa/D31 — que abre a
# navegação já com o percurso até ela (ver src/index.ts). Quem mora no
# bairro pode mandá-lo a quem o vem visitar. Para lhes chegar às mãos, faz
# aqui uma folha para imprimir, com um cartão por casa (o número, o código
# QR e o endereço), e uma tabela com todos os endereços.
#
#     python -P scripts/navegacao/ligacoes.py
#
# Lê as casas de public/navegacao/rede.json (só os números e os sítios) e
# grava em Documentos/Navegação, na pasta do projecto:
#   Ligações das casas.pdf — os cartões, 12 por folha A4;
#   Ligações das casas.csv — a casa e o endereço, uma por linha.
# Volta a correr-se se a lista das casas mudar.
import csv, json, os, re, sys
import qrcode
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import PROJECTO, PUBLICO, SAIDA

SITE = "https://malhaviva.pt"
PASTA = os.path.join(PROJECTO, "Documentos", "Navegação")
LETRA = os.path.join(PUBLICO, "fonts", "LiberationMono-Regular.ttf")
LETRA_CHEIA = os.path.join(PUBLICO, "fonts", "LiberationMono-Bold.ttf")
# A folha: A4 a 200 pontos por polegada, 3 × 4 cartões.
DPI = 200
FOLHA = (round(8.27 * DPI), round(11.69 * DPI))
MARGEM = round(0.45 * DPI)
COLUNAS, LINHAS = 3, 4


def ordem(n):
    m = re.match(r"([A-Z]*)(\d+)(?:\.(\d+))?", n)
    return (m.group(1) or "~", int(m.group(2)), int(m.group(3) or 0)) if m else ("~", 0, 0)


def main():
    rede = json.load(open(os.path.join(SAIDA, "rede.json"), encoding="utf8"))
    por_numero = {}
    for c in rede["casas"]:
        por_numero.setdefault(c["n"], []).append(c)
    casas = []
    for n in sorted(por_numero, key=ordem):
        lista = por_numero[n]
        for i, _ in enumerate(lista, 1):
            caminho = "/casa/" + n + ("/%d" % i if len(lista) > 1 else "")
            casas.append((n, i if len(lista) > 1 else None, SITE + caminho))
    os.makedirs(PASTA, exist_ok=True)

    with open(os.path.join(PASTA, "Ligações das casas.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Casa", "Sítio", "Ligação"])
        for n, sitio, url in casas:
            w.writerow([n, sitio or "", url])

    larg = (FOLHA[0] - 2 * MARGEM) // COLUNAS
    alt = (FOLHA[1] - 2 * MARGEM) // LINHAS
    grande = ImageFont.truetype(LETRA_CHEIA, round(alt * 0.11))
    medio = ImageFont.truetype(LETRA, round(alt * 0.045))
    pequeno = ImageFont.truetype(LETRA, round(alt * 0.04))
    folhas = []
    for k in range(0, len(casas), COLUNAS * LINHAS):
        folha = Image.new("RGB", FOLHA, "white")
        d = ImageDraw.Draw(folha)
        for j, (n, sitio, url) in enumerate(casas[k:k + COLUNAS * LINHAS]):
            x0 = MARGEM + (j % COLUNAS) * larg
            y0 = MARGEM + (j // COLUNAS) * alt
            # o recorte: um fio cinzento à volta de cada cartão
            d.rectangle([x0, y0, x0 + larg - 1, y0 + alt - 1], outline=(190, 190, 190), width=2)
            titulo = "Casa " + n + (" (sítio %d)" % sitio if sitio else "")
            if d.textlength(titulo, font=grande) > larg - 40:
                titulo = "Casa " + n + (" · %d" % sitio if sitio else "")
            d.text((x0 + larg / 2, y0 + alt * 0.1), titulo, font=grande, fill=(5, 5, 10), anchor="mm")
            qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=1, box_size=10)
            qr.add_data(url)
            qr.make(fit=True)
            img = qr.make_image(fill_color=(5, 5, 10), back_color="white").convert("RGB")
            lado = round(alt * 0.6)
            img = img.resize((lado, lado), Image.NEAREST)
            folha.paste(img, (round(x0 + (larg - lado) / 2), round(y0 + alt * 0.19)))
            d.text((x0 + larg / 2, y0 + alt * 0.85), url.replace("https://", ""), font=medio, fill=(5, 5, 10), anchor="mm")
            d.text((x0 + larg / 2, y0 + alt * 0.93), "Como chegar · Bairro de Penajóia", font=pequeno, fill=(110, 110, 110), anchor="mm")
        folhas.append(folha.convert("L"))
    pdf = os.path.join(PASTA, "Ligações das casas.pdf")
    folhas[0].save(pdf, save_all=True, append_images=folhas[1:], resolution=DPI)
    print("%d casas, %d folhas -> %s" % (len(casas), len(folhas), PASTA))


if __name__ == "__main__":
    main()
