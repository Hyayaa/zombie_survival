from pathlib import Path
import argparse
import re
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "assets" / "items"
SCALE = 2
OUTLINE = "#171b1a"
SHADOW = "#303735"
LIGHT = "#e5dcc0"
METAL = "#879395"
METAL_LIGHT = "#bdc7c4"
WOOD = "#936941"
WOOD_LIGHT = "#c29057"
RED = "#a84239"
RED_LIGHT = "#d76855"
BLUE = "#46758a"
BLUE_LIGHT = "#78a9b3"
GREEN = "#65785a"
GREEN_LIGHT = "#9cac7a"
GOLD = "#b58b45"


def icon():
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def r(draw, box, fill, outline=OUTLINE, width=1):
    draw.rectangle(box, fill=fill, outline=outline, width=width)


def p(draw, points, fill, outline=OUTLINE):
    draw.polygon(points, fill=fill)
    draw.line(points + [points[0]], fill=outline, width=1, joint="curve")


def l(draw, points, fill, width=2):
    draw.line(points, fill=OUTLINE, width=width + 2)
    draw.line(points, fill=fill, width=width)


def draw_icon(item_id):
    image, d = icon()
    if item_id == "canned_food":
        r(d, (9, 5, 23, 27), METAL); r(d, (8, 5, 24, 8), METAL_LIGHT); r(d, (8, 24, 24, 27), SHADOW); r(d, (10, 11, 22, 21), "#b48b55"); d.rectangle((11, 12, 13, 20), fill="#dbc27a")
    elif item_id == "water":
        p(d, [(12, 4), (19, 4), (19, 8), (22, 12), (21, 27), (10, 27), (9, 12), (12, 8)], BLUE); r(d, (12, 3, 19, 7), METAL_LIGHT); d.polygon([(11, 14), (20, 12), (20, 24), (11, 24)], fill=BLUE_LIGHT); d.rectangle((12, 10, 14, 13), fill="#b9d7d8")
    elif item_id == "cabbage":
        p(d, [(5, 17), (8, 9), (15, 5), (22, 8), (27, 15), (24, 24), (16, 28), (8, 24)], GREEN); p(d, [(9, 17), (12, 9), (17, 7), (22, 13), (21, 22), (15, 26)], GREEN_LIGHT); l(d, [(16, 9), (15, 25)], "#d0d99a", 1); l(d, [(8, 16), (15, 20), (23, 14)], "#4c6547", 1)
    elif item_id == "carrot":
        p(d, [(12, 9), (24, 11), (16, 28), (10, 15)], "#d96f2f"); l(d, [(13, 8), (9, 3)], GREEN_LIGHT, 2); l(d, [(17, 8), (18, 2)], GREEN, 2); l(d, [(20, 9), (25, 4)], GREEN_LIGHT, 2); d.rectangle((13, 14, 18, 15), fill="#f39a43"); d.rectangle((13, 20, 16, 21), fill="#9f4828")
    elif item_id == "potato":
        p(d, [(6, 13), (11, 7), (21, 6), (27, 12), (25, 22), (18, 27), (8, 24), (4, 19)], "#9b7547"); d.rectangle((10, 12, 12, 14), fill="#5d442e"); d.rectangle((20, 10, 22, 12), fill="#c69a58"); d.rectangle((17, 20, 19, 22), fill="#60472f")
    elif item_id == "apple":
        p(d, [(8, 11), (14, 8), (18, 10), (22, 8), (27, 13), (24, 24), (17, 28), (9, 24), (5, 16)], RED); l(d, [(16, 10), (18, 3)], WOOD, 2); p(d, [(18, 6), (24, 4), (23, 9), (18, 10)], GREEN_LIGHT); d.rectangle((9, 13, 12, 17), fill=RED_LIGHT)
    elif item_id == "beef":
        p(d, [(5, 12), (11, 6), (23, 7), (28, 14), (24, 23), (14, 27), (6, 22)], "#9e3f3b"); p(d, [(9, 13), (14, 9), (21, 10), (24, 15), (20, 21), (13, 22), (9, 19)], RED_LIGHT); p(d, [(13, 14), (17, 12), (21, 15), (19, 19), (14, 20), (11, 17)], LIGHT)
    elif item_id == "pork":
        p(d, [(5, 15), (9, 8), (19, 5), (27, 11), (26, 21), (18, 27), (8, 24)], "#d17b78"); p(d, [(9, 14), (13, 9), (20, 9), (23, 14), (21, 21), (14, 23), (9, 20)], "#efa6a0"); d.rectangle((8, 10, 22, 11), fill=LIGHT); d.rectangle((20, 12, 23, 19), fill="#f2c7b3")
    elif item_id == "cloth":
        p(d, [(6, 10), (20, 6), (26, 12), (22, 25), (9, 27), (5, 20)], "#aaa39a"); l(d, [(8, 13), (22, 9)], LIGHT, 1); l(d, [(8, 20), (22, 17)], "#77746f", 1); l(d, [(12, 25), (10, 12)], "#d0c8bb", 1)
    elif item_id == "wood":
        for offset in (0, 5, 10): p(d, [(4 + offset, 24), (15 + offset, 5), (20 + offset, 8), (9 + offset, 27)], WOOD)
        l(d, [(8, 21), (19, 6)], WOOD_LIGHT, 1); l(d, [(17, 24), (27, 9)], "#69482f", 1)
    elif item_id == "metal":
        p(d, [(5, 12), (20, 5), (27, 11), (13, 18)], METAL); p(d, [(7, 19), (22, 12), (27, 18), (12, 26)], SHADOW); d.rectangle((10, 12, 11, 13), fill=METAL_LIGHT); d.rectangle((21, 9, 22, 10), fill=METAL_LIGHT); d.rectangle((11, 21, 12, 22), fill=METAL_LIGHT)
    elif item_id == "screws":
        for x, y in ((7, 8), (14, 5), (20, 10)): l(d, [(x, y), (x + 7, y + 15)], METAL_LIGHT, 2); r(d, (x - 2, y - 2, x + 4, y + 3), METAL); d.line((x - 1, y, x + 3, y), fill=SHADOW); d.line((x + 4, y + 9, x + 9, y + 7), fill=OUTLINE)
    elif item_id == "steel_plate":
        p(d, [(5, 12), (22, 7), (28, 12), (11, 18)], METAL); p(d, [(6, 19), (23, 14), (28, 19), (11, 26)], SHADOW); d.rectangle((8, 12, 10, 14), fill=METAL_LIGHT); d.rectangle((23, 10, 25, 12), fill=METAL_LIGHT); d.rectangle((11, 21, 13, 23), fill="#aab5b5")
    elif item_id == "solar_panel":
        p(d, [(4, 9), (24, 5), (29, 21), (8, 26)], "#284f70"); l(d, [(10, 8), (14, 24)], BLUE_LIGHT, 1); l(d, [(17, 6), (21, 22)], BLUE_LIGHT, 1); l(d, [(6, 15), (27, 11)], BLUE_LIGHT, 1); l(d, [(8, 21), (29, 17)], BLUE_LIGHT, 1); l(d, [(17, 25), (18, 29)], METAL, 2)
    elif item_id == "duct_tape":
        d.ellipse((5, 6, 27, 27), fill=SHADOW, outline=OUTLINE, width=2); d.ellipse((10, 10, 22, 22), fill="#171b1a", outline=METAL_LIGHT); p(d, [(18, 20), (29, 17), (28, 23), (20, 26)], METAL); d.rectangle((8, 8, 12, 11), fill=METAL_LIGHT)
    elif item_id == "circuit_board":
        r(d, (5, 6, 27, 27), "#3f7656"); r(d, (12, 11, 21, 20), SHADOW); r(d, (7, 9, 10, 13), GOLD); r(d, (22, 20, 25, 24), GOLD); l(d, [(7, 18), (12, 18)], "#d4b258", 1); l(d, [(20, 9), (24, 9), (24, 16)], "#d4b258", 1); d.rectangle((7, 25, 25, 27), fill=METAL_LIGHT)
    elif item_id == "electric_motor":
        p(d, [(7, 10), (12, 6), (23, 8), (26, 13), (24, 24), (18, 27), (8, 24), (5, 18)], METAL); r(d, (9, 11, 22, 23), SHADOW); l(d, [(23, 16), (30, 16)], METAL_LIGHT, 3); d.rectangle((11, 13, 13, 21), fill="#b96f42"); d.rectangle((15, 11, 17, 23), fill="#d39355"); d.rectangle((19, 13, 21, 21), fill="#8d552f")
    elif item_id == "fuel":
        p(d, [(8, 8), (12, 5), (23, 5), (26, 9), (25, 27), (7, 27)], GOLD); r(d, (12, 4, 20, 8), SHADOW); l(d, [(12, 12), (21, 22)], "#d1a75a", 2); l(d, [(21, 12), (12, 22)], "#7f5b2e", 2)
    elif item_id == "medicine":
        r(d, (10, 8, 22, 27), GREEN); r(d, (11, 4, 21, 9), METAL_LIGHT); r(d, (12, 13, 20, 22), LIGHT); d.rectangle((15, 14, 17, 21), fill=RED); d.rectangle((13, 17, 19, 19), fill=RED)
    elif item_id == "ammo":
        for x in (7, 12, 17, 22): p(d, [(x, 9), (x + 3, 7), (x + 4, 22), (x, 25)], "#8c7543"); d.rectangle((8, 20, 25, 26), fill=SHADOW)
    elif item_id == "pistol_ammo":
        for x, y in ((7, 12), (12, 9), (17, 12), (22, 9)): p(d, [(x, y), (x + 2, y - 3), (x + 4, y), (x + 4, y + 14), (x, y + 14)], GOLD)
    elif item_id == "smg_ammo":
        p(d, [(7, 5), (21, 6), (24, 23), (18, 28), (10, 25)], SHADOW); r(d, (9, 7, 20, 11), GOLD); d.line((11, 12, 19, 24), fill=METAL_LIGHT, width=2); d.line((14, 12, 21, 22), fill="#59615f", width=2)
    elif item_id == "shotgun_shell":
        for x, h in ((7, 18), (13, 21), (19, 18)): r(d, (x, 27 - h, x + 5, 27), RED); d.rectangle((x + 1, 28 - h, x + 4, 31 - h), fill=RED_LIGHT); d.rectangle((x, 24, x + 5, 27), fill=GOLD)
    elif item_id == "rifle_ammo":
        for x, y in ((8, 7), (14, 5), (20, 7)): p(d, [(x + 2, y), (x + 4, y + 5), (x + 4, 24), (x, 24), (x, y + 5)], GOLD); d.rectangle((7, 23, 25, 27), fill=SHADOW)
    elif item_id == "battery":
        r(d, (6, 9, 26, 27), SHADOW); r(d, (8, 11, 24, 25), BLUE); r(d, (9, 6, 14, 10), METAL_LIGHT); r(d, (19, 6, 24, 10), METAL_LIGHT); d.rectangle((10, 15, 13, 21), fill=LIGHT); d.rectangle((8, 17, 15, 19), fill=LIGHT); d.rectangle((19, 17, 23, 19), fill=LIGHT)
    elif item_id == "engine_part":
        p(d, [(9, 4), (15, 7), (21, 5), (26, 11), (23, 17), (26, 23), (19, 27), (14, 24), (7, 27), (4, 20), (8, 15), (5, 9)], METAL); r(d, (11, 10, 21, 21), SHADOW); r(d, (14, 12, 18, 24), GOLD); d.rectangle((8, 8, 11, 11), fill=METAL_LIGHT)
    elif item_id == "bandage":
        p(d, [(6, 11), (19, 6), (27, 13), (23, 23), (11, 27), (5, 21)], LIGHT); r(d, (12, 8, 20, 25), "#c9c1b2"); p(d, [(8, 14), (23, 9), (26, 14), (10, 20)], RED); d.rectangle((15, 12, 18, 17), fill=RED_LIGHT)
    elif item_id == "torch":
        l(d, [(10, 27), (18, 10)], WOOD_LIGHT, 4); p(d, [(14, 12), (12, 7), (17, 3), (20, 8), (19, 14)], "#d35f32"); p(d, [(16, 11), (15, 7), (18, 5), (19, 10)], "#f0b94f")
    elif item_id == "barricade":
        l(d, [(5, 25), (26, 7)], WOOD, 5); l(d, [(6, 7), (27, 25)], WOOD_LIGHT, 5); r(d, (13, 12, 19, 19), METAL); d.rectangle((8, 8, 9, 9), fill=METAL_LIGHT); d.rectangle((23, 22, 24, 23), fill=METAL_LIGHT)
    elif item_id == "turret_kit":
        r(d, (7, 18, 25, 26), SHADOW); p(d, [(12, 12), (19, 10), (22, 17), (17, 21), (10, 18)], METAL); l(d, [(18, 12), (28, 8)], METAL_LIGHT, 3); l(d, [(14, 24), (8, 29)], METAL, 2); l(d, [(20, 24), (26, 29)], METAL, 2)
    elif item_id == "solar_generator_kit":
        p(d, [(5, 9), (24, 5), (28, 20), (8, 25)], BLUE); l(d, [(11, 8), (14, 23)], BLUE_LIGHT, 1); l(d, [(18, 6), (21, 21)], BLUE_LIGHT, 1); l(d, [(7, 15), (26, 11)], BLUE_LIGHT, 1); l(d, [(9, 21), (28, 17)], BLUE_LIGHT, 1)
    elif item_id == "fuel_generator_kit":
        r(d, (5, 11, 26, 26), GREEN); r(d, (9, 14, 19, 23), SHADOW); r(d, (21, 5, 25, 13), METAL); d.rectangle((7, 8, 13, 12), fill=GREEN_LIGHT); d.rectangle((11, 17, 17, 20), fill=METAL_LIGHT); d.rectangle((23, 7, 28, 9), fill=OUTLINE)
    elif item_id == "battery_bank_kit":
        r(d, (5, 8, 27, 27), SHADOW); [r(d, (7 + column * 6, 11, 11 + column * 6, 24), BLUE if column % 2 == 0 else GREEN) for column in range(3)]; d.rectangle((8, 8, 10, 11), fill=METAL_LIGHT); d.rectangle((20, 8, 22, 11), fill=METAL_LIGHT)
    elif item_id == "generator_fuel":
        p(d, [(8, 7), (22, 7), (26, 11), (24, 27), (6, 27), (6, 11)], "#73512e"); r(d, (11, 4, 20, 9), SHADOW); p(d, [(14, 13), (18, 18), (16, 23), (12, 20)], GOLD)
    elif item_id == "molotov":
        p(d, [(12, 8), (19, 8), (21, 14), (24, 26), (8, 26), (11, 14)], "#6b7b67"); r(d, (12, 5, 19, 10), "#80674d"); p(d, [(14, 7), (11, 3), (17, 5), (20, 2), (21, 8)], RED); d.polygon([(10, 17), (21, 14), (22, 22), (9, 24)], fill="#b65b36")
    elif item_id == "scrap_cache":
        r(d, (5, 12, 27, 27), WOOD); d.rectangle((4, 9, 28, 14), fill=WOOD_LIGHT); r(d, (7, 6, 13, 13), METAL); p(d, [(17, 11), (21, 5), (25, 8), (22, 14)], GOLD); l(d, [(9, 20), (23, 17)], METAL_LIGHT, 2); d.rectangle((17, 21, 22, 25), fill=SHADOW)
    elif item_id == "basic_tshirt":
        p(d, [(8, 7), (13, 4), (19, 4), (24, 7), (29, 12), (24, 16), (22, 12), (22, 28), (10, 28), (10, 12), (8, 16), (3, 12)], "#a9aaa2"); d.rectangle((13, 5, 19, 8), fill=SHADOW); d.rectangle((12, 22, 20, 24), fill=LIGHT)
    elif item_id == "work_pants":
        p(d, [(9, 4), (23, 4), (24, 13), (21, 29), (15, 29), (15, 15), (13, 29), (7, 29), (8, 13)], "#59685f"); r(d, (9, 8, 14, 14), "#78877c"); r(d, (18, 8, 23, 14), "#78877c"); d.rectangle((9, 5, 22, 7), fill=SHADOW)
    elif item_id == "utility_belt":
        p(d, [(3, 12), (29, 12), (27, 20), (5, 20)], WOOD); r(d, (13, 11, 19, 20), GOLD); r(d, (5, 18, 11, 27), "#715137"); r(d, (21, 17, 27, 26), "#715137")
    elif item_id == "utility_vest":
        p(d, [(9, 5), (14, 3), (18, 3), (23, 5), (27, 13), (23, 16), (22, 29), (10, 29), (9, 16), (5, 13)], GREEN); r(d, (11, 12, 15, 19), GREEN_LIGHT); r(d, (17, 12, 21, 19), GREEN_LIGHT); r(d, (11, 21, 21, 27), "#4d5f47"); d.line((16, 6, 16, 27), fill=OUTLINE)
    elif item_id == "school_backpack":
        p(d, [(9, 8), (13, 4), (20, 4), (24, 8), (27, 27), (5, 27)], BLUE); r(d, (9, 17, 23, 27), "#365d70"); l(d, [(10, 10), (5, 16), (5, 24)], SHADOW, 2); l(d, [(23, 10), (28, 16), (28, 24)], SHADOW, 2); r(d, (14, 3, 19, 7), SHADOW)
    elif item_id == "hiking_backpack":
        p(d, [(8, 7), (13, 3), (21, 5), (25, 10), (27, 28), (5, 28)], GREEN); r(d, (8, 17, 24, 28), "#4c6045"); r(d, (4, 12, 9, 24), GREEN_LIGHT); r(d, (23, 12, 28, 24), GREEN_LIGHT); l(d, [(12, 7), (11, 27)], GOLD, 1); l(d, [(21, 8), (22, 27)], GOLD, 1)
    elif item_id == "military_backpack":
        p(d, [(7, 6), (12, 3), (22, 4), (26, 8), (28, 29), (4, 29)], "#4d5945"); r(d, (7, 10, 25, 16), "#69755d"); r(d, (7, 19, 14, 27), "#384234"); r(d, (18, 19, 25, 27), "#384234"); l(d, [(10, 8), (23, 8)], "#859173", 1); l(d, [(6, 17), (26, 17)], GOLD, 1)
    elif item_id == "knife":
        p(d, [(5, 25), (10, 19), (20, 5), (27, 4), (22, 12), (12, 22)], METAL_LIGHT); l(d, [(7, 26), (14, 19)], WOOD, 4); d.rectangle((11, 18, 15, 22), fill=GOLD)
    elif item_id == "bat":
        p(d, [(7, 28), (5, 25), (18, 7), (24, 4), (27, 7), (24, 12), (11, 28)], WOOD); l(d, [(8, 26), (22, 7)], WOOD_LIGHT, 2); d.rectangle((7, 23, 11, 27), fill="#5c4230")
    elif item_id == "pistol":
        p(d, [(5, 10), (24, 10), (27, 14), (18, 17), (16, 27), (10, 27), (10, 17), (5, 15)], METAL); d.rectangle((7, 11, 23, 13), fill=METAL_LIGHT); p(d, [(11, 17), (18, 17), (15, 26), (10, 26)], SHADOW); d.rectangle((23, 13, 28, 15), fill=OUTLINE)
    elif item_id == "smg":
        p(d, [(4, 11), (22, 9), (28, 12), (27, 16), (16, 17), (12, 22), (7, 21), (9, 17), (4, 16)], SHADOW); l(d, [(21, 12), (30, 11)], METAL_LIGHT, 2); p(d, [(13, 16), (19, 17), (18, 29), (12, 27)], METAL); d.rectangle((5, 12, 15, 14), fill=METAL_LIGHT)
    elif item_id == "shotgun":
        l(d, [(3, 12), (27, 9)], METAL, 4); l(d, [(6, 17), (28, 12)], SHADOW, 3); p(d, [(6, 15), (15, 17), (11, 23), (4, 24), (2, 20)], WOOD); d.rectangle((15, 13, 22, 18), fill=WOOD_LIGHT)
    elif item_id == "hunting_rifle":
        l(d, [(3, 10), (29, 7)], METAL_LIGHT, 2); p(d, [(6, 13), (17, 12), (21, 17), (14, 20), (9, 27), (3, 27), (8, 18), (3, 16)], WOOD); r(d, (14, 8, 21, 11), SHADOW); d.rectangle((20, 9, 29, 10), fill=OUTLINE)
    else:
        raise KeyError(item_id)
    return image


ITEM_IDS = (
    "canned_food", "water", "cabbage", "carrot", "potato", "apple", "beef", "pork",
    "cloth", "wood", "metal", "screws", "steel_plate", "solar_panel", "duct_tape", "circuit_board", "electric_motor", "fuel", "medicine", "ammo",
    "pistol_ammo", "smg_ammo", "shotgun_shell", "rifle_ammo", "battery", "engine_part",
    "bandage", "torch", "barricade", "turret_kit", "solar_generator_kit",
    "fuel_generator_kit", "battery_bank_kit", "generator_fuel", "molotov", "scrap_cache",
    "basic_tshirt", "work_pants", "utility_belt", "utility_vest", "school_backpack", "hiking_backpack", "military_backpack",
)
WEAPON_IDS = ("knife", "bat", "pistol", "smg", "shotgun", "hunting_rifle")


def load_footprints():
    item_source = (ROOT / "src" / "data" / "item-definitions.ts").read_text(encoding="utf-8")
    weapon_source = (ROOT / "src" / "data" / "weapon-definitions.ts").read_text(encoding="utf-8")
    footprints = {
        item_id: (int(width), int(height))
        for item_id, width, height in re.findall(r"([a-z_]+):\{width:(\d+),height:(\d+)\}", item_source)
    }
    for item_id, width, height in re.findall(r'id:\s*"([a-z_]+)".*?inventoryFootprint:\{width:(\d+),height:(\d+)\}', weapon_source):
        footprints[item_id] = (int(width), int(height))
    return footprints


def render_footprint_icon(item_id, footprint):
    source = draw_icon(item_id)
    width, height = footprint
    if item_id in {"bat", "shotgun"} and height > width:
        source = source.transpose(Image.Transpose.ROTATE_270)
    logical_size = (width * 32, height * 32)
    margin = 3
    artwork = source.resize((logical_size[0] - margin * 2, logical_size[1] - margin * 2), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", logical_size, (0, 0, 0, 0))
    canvas.alpha_composite(artwork, (margin, margin))
    return canvas.resize((width * 64, height * 64), Image.Resampling.NEAREST)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", nargs="*", choices=ITEM_IDS + WEAPON_IDS)
    args = parser.parse_args()
    selected = tuple(args.ids) if args.ids else ITEM_IDS + WEAPON_IDS
    footprints = load_footprints()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for item_id in selected:
        footprint = footprints[item_id]
        image = render_footprint_icon(item_id, footprint)
        assert image.size == (footprint[0] * 64, footprint[1] * 64)
        assert set(image.getchannel("A").get_flattened_data()).issubset({0, 255})
        image.save(OUTPUT / f"{item_id}.png", optimize=True)
    print(f"generated {len(selected)} icons in {OUTPUT}")


if __name__ == "__main__":
    main()
