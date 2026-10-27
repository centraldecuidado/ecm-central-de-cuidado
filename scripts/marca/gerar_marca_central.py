"""Icones da Central de teste da ECM, com o simbolo da Central de Cuidado (27/10/2026).

Por que existe: esta Central e a copia do sistema do Dr. Fabio, e os icones de
public/ eram os tres circulos dele (scripts/marca/gerar_marca.py). Aqui a marca
e a da Central de Cuidado: o "CC" com a cruz, branco sobre o azul-escuro.

O simbolo sai de public/perfil-whatsapp-central.jpg (CC branco no azul, 640 px)
e o logo com o nome sai de src/assets/logo-central-de-cuidado.webp, os dois ja
no projeto. Nada de fonte nem desenho novo.

Uso, da raiz do projeto:
    python scripts/marca/gerar_marca_central.py

Gera:
    public/favicon.ico, icone-16/32/192/512, icone-maskable-512,
    apple-touch-icon, icone-badge
    public/logo-email.png    cabecalho azul-escuro dos e-mails do login
    public/og.png            imagem de compartilhamento do link
    src/assets/fabio-icone.png  foto do robo no simulador (o nome ficou o do
                                arquivo de origem para nao mexer no codigo)
Depois de gerar, suba o ?v= dos icones em index.html, public/manifest.json e
public/sw.js: o navegador guarda icone por muito tempo.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

RAIZ = Path(__file__).resolve().parents[2]
ASSETS = RAIZ / 'src' / 'assets'
PUBLIC = RAIZ / 'public'

foto = Image.open(PUBLIC / 'perfil-whatsapp-central.jpg').convert('RGB')
AZUL = foto.getpixel((8, 8))

# O branco do simbolo vira transparencia: quanto mais claro, mais opaco. A
# borda suave do JPEG continua suave.
cinza = foto.convert('L')
fundo = sum(AZUL) / 3
alfa = cinza.point(lambda v: 0 if v <= fundo + 12 else min(255, round((v - fundo) * 255 / (255 - fundo))))
alfa = alfa.crop(alfa.getbbox())
simbolo = Image.new('RGBA', alfa.size, (255, 255, 255, 255))
simbolo.putalpha(alfa)


def quadrado(img):
    lado = max(img.size)
    q = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    q.alpha_composite(img, ((lado - img.width) // 2, (lado - img.height) // 2))
    return q


sim_q = quadrado(simbolo)


def em_fundo(lado, proporcao, arredondado):
    """Simbolo branco centralizado no azul. proporcao = parte do lado."""
    tela = Image.new('RGBA', (lado, lado), AZUL + (255,))
    s = round(lado * proporcao)
    tela.alpha_composite(sim_q.resize((s, s), Image.LANCZOS), ((lado - s) // 2, (lado - s) // 2))
    if arredondado:
        mascara = Image.new('L', (lado * 4, lado * 4), 0)
        ImageDraw.Draw(mascara).rounded_rectangle((0, 0, lado * 4 - 1, lado * 4 - 1), radius=round(lado * 4 * 0.22), fill=255)
        tela.putalpha(ImageChops.multiply(tela.getchannel('A'), mascara.resize((lado, lado), Image.LANCZOS)))
    return tela


# Aba do navegador: o quadrado azul arredondado, porque o CC branco sozinho
# some na aba clara.
for lado in (16, 32):
    em_fundo(lado * 4, 0.78, True).resize((lado, lado), Image.LANCZOS).save(PUBLIC / f'icone-{lado}.png', optimize=True)
em_fundo(256, 0.78, True).save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

# Atalho no celular. O maskable e recortado em circulo pelo Android: o simbolo
# fica dentro dos 80% centrais. O do iPhone e opaco, o iOS arredonda.
em_fundo(192, 0.72, True).save(PUBLIC / 'icone-192.png', optimize=True)
em_fundo(512, 0.72, True).save(PUBLIC / 'icone-512.png', optimize=True)
em_fundo(512, 0.58, False).save(PUBLIC / 'icone-maskable-512.png', optimize=True)
em_fundo(180, 0.70, False).convert('RGB').save(PUBLIC / 'apple-touch-icon.png', optimize=True)

# Selo da notificacao: o Android so usa a transparencia.
sim_q.resize((96, 96), Image.LANCZOS).save(PUBLIC / 'icone-badge.png', optimize=True)

# Foto do robo no simulador.
em_fundo(256, 0.70, False).convert('RGB').save(ASSETS / 'fabio-icone.png', optimize=True)

# Logo com o nome, em branco, para o fundo azul dos e-mails e da imagem do link.
logo = Image.open(ASSETS / 'logo-central-de-cuidado.webp').convert('RGBA')
logo = logo.crop(logo.getbbox())
branco = Image.new('RGBA', logo.size, (255, 255, 255, 255))
branco.putalpha(logo.getchannel('A'))

email = branco.resize((round(branco.width * 95 / branco.height), 95), Image.LANCZOS)
email.save(PUBLIC / 'logo-email.png', optimize=True)

og = Image.new('RGB', (1200, 630), AZUL)
alt = 190
grande = branco.resize((round(branco.width * alt / branco.height), alt), Image.LANCZOS)
og.paste(grande, ((1200 - grande.width) // 2, (630 - alt) // 2), grande)
og.save(PUBLIC / 'og.png', optimize=True)

print('icones da Central de Cuidado gerados, azul', AZUL)
