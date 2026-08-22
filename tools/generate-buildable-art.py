"""Generate deterministic, nearest-neighbour buildable catalog pixel art."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "assets" / "buildables" / "catalog"
SCALE = 2
INK = "#171b19"
LIGHT = "#d0bf8d"
WOOD = "#765033"
WOOD_DARK = "#493522"
WOOD_HI = "#a97849"
STEEL = "#596568"
STEEL_HI = "#849194"
RUST = "#8a4e32"

SPECS = {
    "wood-wall": (2, 1), "metal-wall": (2, 1), "wood-door": (2, 1), "barricade": (2, 1),
    "wood-crate": (2, 1), "turret": (2, 2), "solar-generator": (2, 2), "fuel-generator": (2, 2),
    "battery-bank": (2, 2), "makeshift_workbench": (2, 1), "plank_workbench": (2, 1), "technical_workbench": (2, 1),
}

def canvas(cells):
    image = Image.new("RGBA", (cells[0] * 32, cells[1] * 32), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)

def framed(draw, box, fill, highlight=None):
    draw.rectangle(box, fill=INK)
    x1, y1, x2, y2 = box
    draw.rectangle((x1 + 1, y1 + 1, x2 - 1, y2 - 1), fill=fill)
    if highlight: draw.line((x1 + 2, y1 + 2, x2 - 2, y1 + 2), fill=highlight)

def fastener(draw, x, y, color=LIGHT):
    draw.point((x, y), fill=color)

def wood_wall(draw):
    framed(draw, (4, 8, 59, 25), WOOD, WOOD_HI)
    for y, color in [(13, WOOD_DARK), (19, "#5e4029")]: draw.line((5, y, 58, y), fill=color)
    for x in (16, 31, 46):
        draw.rectangle((x, 7, x + 3, 26), fill=INK); draw.rectangle((x + 1, 8, x + 2, 25), fill="#65452d")
        fastener(draw, x + 1, 10); fastener(draw, x + 2, 23)
    draw.line((8, 16, 13, 15, 15, 17), fill="#b88854"); draw.line((50, 20, 47, 17, 44, 22), fill=INK)

def metal_wall(draw):
    framed(draw, (4, 8, 59, 25), STEEL, STEEL_HI)
    draw.rectangle((6, 10, 31, 23), outline="#3e4749"); draw.rectangle((31, 10, 57, 23), outline="#3e4749")
    draw.rectangle((28, 7, 35, 26), fill=INK); draw.rectangle((29, 8, 34, 25), fill="#455154")
    for x in (8, 25, 38, 55):
        fastener(draw, x, 11); fastener(draw, x, 22)
    draw.rectangle((11, 20, 18, 23), fill=RUST); draw.point((44, 15), fill="#a86a45")

def wood_door(draw):
    framed(draw, (13, 3, 50, 29), WOOD_DARK, "#8f6842")
    framed(draw, (17, 5, 46, 28), WOOD, WOOD_HI)
    draw.line((18, 8, 45, 25), fill="#4c3422", width=3); draw.line((18, 9, 45, 26), fill="#9a6d43")
    for y in (9, 22): draw.rectangle((15, y, 18, y + 3), fill=STEEL_HI)
    draw.rectangle((40, 16, 43, 18), fill=INK); fastener(draw, 41, 17, "#d1b35d")
    draw.line((11, 30, 52, 30), fill="#8d8170", width=2)

def barricade(draw):
    for a, b in [((7, 24), (56, 7)), ((7, 8), (56, 25))]:
        draw.line((*a, *b), fill=INK, width=7); draw.line((*a, *b), fill=WOOD, width=5); draw.line((*a, *b), fill=WOOD_HI, width=1)
    framed(draw, (27, 5, 35, 28), STEEL, STEEL_HI)
    for p in ((17, 20), (46, 19), (31, 10), (31, 24)): fastener(draw, *p)
    draw.rectangle((10, 12, 18, 15), fill="#8a806d")

def wood_crate(draw):
    framed(draw, (7, 6, 56, 27), WOOD, WOOD_HI)
    for y in (12, 20): draw.line((9, y, 54, y), fill=WOOD_DARK)
    for x in (9, 51): draw.rectangle((x, 7, x + 3, 26), fill="#3e4544")
    draw.rectangle((26, 14, 37, 19), fill=INK); draw.rectangle((28, 15, 35, 17), fill="#9a8b6f")
    for p in ((11, 9), (53, 9), (11, 24), (53, 24)): fastener(draw, *p)

def turret(draw):
    framed(draw, (19, 30, 44, 52), "#3e4748", STEEL_HI); draw.ellipse((21, 26, 42, 47), fill=INK); draw.ellipse((23, 28, 40, 45), fill=STEEL)
    draw.ellipse((26, 31, 37, 42), fill="#303738"); draw.rectangle((36, 33, 58, 38), fill=INK); draw.rectangle((37, 34, 59, 36), fill=STEEL_HI)
    framed(draw, (14, 34, 23, 44), "#6b5940"); draw.line((18, 44, 24, 50), fill="#7e6b4a", width=2)
    draw.rectangle((29, 27, 34, 31), fill=INK); draw.point((31, 28), fill="#62c888")

def solar(draw):
    framed(draw, (7, 11, 56, 39), "#234a67", "#6086a0")
    for x in range(15, 56, 8): draw.line((x, 13, x, 37), fill="#172d43")
    for y in range(19, 39, 7): draw.line((9, y, 54, y), fill="#172d43")
    draw.line((20, 40, 16, 52), fill=STEEL, width=3); draw.line((44, 40, 48, 52), fill=STEEL, width=3); draw.line((16, 52, 49, 52), fill=INK, width=3)
    framed(draw, (48, 43, 58, 54), STEEL); draw.line((53, 54, 58, 59), fill="#d2a740", width=2)

def fuel(draw):
    framed(draw, (10, 19, 53, 49), "#59624e", "#879074"); framed(draw, (15, 25, 34, 42), "#303737")
    draw.rectangle((39, 23, 49, 42), fill="#875334"); draw.rectangle((41, 19, 47, 23), fill=INK); draw.rectangle((42, 18, 46, 20), fill="#c1944b")
    for y in (28, 32, 36): draw.line((18, y, 30, y), fill=STEEL_HI)
    draw.rectangle((8, 15, 13, 30), fill=INK); draw.rectangle((9, 14, 11, 23), fill=STEEL_HI); draw.line((51, 43, 59, 55), fill="#242928", width=2)

def battery(draw):
    framed(draw, (12, 16, 52, 51), "#343d40", STEEL_HI)
    for x in (16, 27, 38): framed(draw, (x, 22, x + 8, 45), "#4c5a5f", "#73848a")
    for x, color in ((19, "#bd5d4a"), (41, "#6abb7a")): draw.rectangle((x, 18, x + 3, 22), fill=color)
    draw.line((20, 18, 42, 18), fill=INK, width=2); draw.rectangle((29, 47, 35, 49), fill="#60c886"); draw.line((52, 42, 59, 54), fill="#1f2424", width=2)

def bench(draw, kind):
    palette = {"makeshift_workbench": (WOOD_DARK, WOOD, "#b68552"), "plank_workbench": ("#4c3523", "#84603d", "#bc8c57"), "technical_workbench": ("#303b3d", "#56686a", "#819496")}[kind]
    framed(draw, (5, 9, 58, 22), palette[1], palette[2]); draw.rectangle((8, 22, 13, 29), fill=palette[0]); draw.rectangle((50, 22, 55, 29), fill=palette[0])
    if kind == "makeshift_workbench":
        for x in (18, 34, 48): draw.line((x, 10, x - 3, 21), fill="#5d402b")
        draw.line((11, 7, 20, 16), fill=STEEL_HI, width=2); draw.rectangle((8, 6, 14, 9), fill=INK); draw.rectangle((43, 7, 48, 10), fill="#8f795f")
    elif kind == "plank_workbench":
        draw.rectangle((42, 5, 54, 12), fill=INK); draw.rectangle((44, 6, 52, 10), fill=STEEL); draw.line((9, 12, 35, 12), fill=LIGHT)
        for x in range(11, 36, 5): draw.point((x, 13), fill=INK)
        framed(draw, (20, 23, 43, 29), WOOD_DARK)
    else:
        framed(draw, (9, 12, 26, 20), "#274c43"); draw.line((12, 15, 22, 15), fill="#67bd85"); draw.point((17, 17), fill="#5f91be")
        draw.line((34, 7, 34, 17), fill=INK, width=2); draw.ellipse((31, 4, 38, 10), outline=STEEL_HI, width=2); draw.line((45, 8, 53, 16), fill="#bd744a", width=2)

DRAWERS = {"wood-wall": wood_wall, "metal-wall": metal_wall, "wood-door": wood_door, "barricade": barricade, "wood-crate": wood_crate,
           "turret": turret, "solar-generator": solar, "fuel-generator": fuel, "battery-bank": battery}

def generate():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, cells in SPECS.items():
        image, draw = canvas(cells)
        if name.endswith("workbench"): bench(draw, name)
        else: DRAWERS[name](draw)
        image.resize((image.width * SCALE, image.height * SCALE), Image.Resampling.NEAREST).save(OUT / f"{name}.png", optimize=False)

if __name__ == "__main__": generate()
