from pathlib import Path
import argparse
import json
import re
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "assets" / "items"
RANGED_METADATA_OUTPUT = OUTPUT / "ranged-weapon-art.json"
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
    elif item_id == "makeshift_workbench_kit":
        r(d, (4, 10, 27, 24), WOOD); d.rectangle((5, 11, 26, 15), fill=WOOD_LIGHT); l(d, [(8, 22), (6, 29)], SHADOW, 3); l(d, [(23, 22), (26, 29)], SHADOW, 3); r(d, (8, 6, 18, 11), "#807568"); d.rectangle((10, 7, 16, 8), fill=METAL_LIGHT); l(d, [(21, 8), (25, 18)], GOLD, 2)
    elif item_id == "plank_workbench_kit":
        r(d, (3, 9, 28, 24), "#765337"); d.rectangle((4, 10, 27, 14), fill=WOOD_LIGHT); d.line((11, 10, 11, 23), fill="#5d402c"); d.line((20, 10, 20, 23), fill="#5d402c"); l(d, [(7, 22), (5, 29)], SHADOW, 3); l(d, [(24, 22), (27, 29)], SHADOW, 3); r(d, (7, 6, 15, 11), METAL); r(d, (19, 5, 24, 12), "#65785a"); d.rectangle((20, 6, 22, 10), fill=GREEN_LIGHT)
    elif item_id == "technical_workbench_kit":
        r(d, (3, 9, 29, 24), "#425554"); d.rectangle((4, 10, 28, 14), fill="#718481"); r(d, (6, 16, 14, 22), "#3f7656"); d.rectangle((8, 17, 12, 18), fill=GOLD); r(d, (18, 15, 26, 22), METAL); d.rectangle((20, 16, 24, 18), fill=METAL_LIGHT); l(d, [(7, 23), (5, 29)], SHADOW, 3); l(d, [(25, 23), (28, 29)], SHADOW, 3); d.rectangle((15, 5, 18, 13), fill="#b96f42")
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
        p(d, [(10, 12), (25, 12), (29, 15), (25, 18), (10, 18)], METAL_LIGHT); d.rectangle((12, 13, 25, 14), fill="#dce4df"); r(d, (3, 13, 11, 18), WOOD); d.rectangle((9, 12, 12, 19), fill=GOLD); d.rectangle((4, 14, 9, 15), fill=WOOD_LIGHT)
    elif item_id == "bat":
        p(d, [(3, 14), (10, 13), (23, 10), (29, 12), (29, 18), (23, 20), (10, 17), (3, 17)], WOOD); d.rectangle((5, 14, 21, 15), fill=WOOD_LIGHT); d.rectangle((3, 13, 9, 18), fill="#5c4230"); d.rectangle((10, 14, 12, 17), fill=GOLD)
    elif item_id == "pistol":
        p(d, [(3, 8), (26, 8), (30, 11), (30, 15), (20, 16), (18, 19), (8, 18), (8, 15), (3, 14)], METAL); d.rectangle((5, 9, 26, 11), fill=METAL_LIGHT); d.rectangle((8, 12, 23, 14), fill="#596361"); d.rectangle((12, 9, 18, 10), fill="#d6ddda"); d.rectangle((21, 9, 23, 10), fill=OUTLINE); d.rectangle((25, 7, 27, 9), fill=OUTLINE); d.rectangle((29, 11, 31, 14), fill="#0f1211"); p(d, [(9, 17), (18, 17), (16, 29), (9, 29)], SHADOW); d.rectangle((11, 19, 16, 26), fill="#48504e"); p(d, [(17, 16), (21, 17), (19, 22), (16, 22)], OUTLINE); d.rectangle((18, 18, 19, 20), fill=GOLD); d.rectangle((11, 28, 16, 30), fill=METAL)
    elif item_id == "smg":
        p(d, [(2, 11), (7, 8), (11, 10), (11, 16), (6, 18), (2, 16)], "#303735"); r(d, (8, 9, 24, 17), "#596361"); d.rectangle((10, 10, 21, 12), fill=METAL_LIGHT); d.rectangle((13, 13, 23, 16), fill="#3e4745"); l(d, [(23, 12), (30, 12)], METAL, 3); d.rectangle((29, 10, 31, 14), fill=OUTLINE); d.rectangle((11, 7, 14, 9), fill=OUTLINE); d.rectangle((21, 7, 23, 10), fill=OUTLINE); p(d, [(11, 17), (17, 17), (15, 28), (10, 27)], "#242a29"); p(d, [(17, 17), (22, 17), (23, 29), (18, 29)], METAL); d.rectangle((19, 19, 21, 27), fill="#758184"); p(d, [(7, 17), (12, 18), (10, 23), (6, 22)], OUTLINE); d.rectangle((9, 18, 10, 20), fill=GOLD)
    elif item_id == "shotgun":
        p(d, [(2, 14), (8, 10), (14, 12), (17, 16), (12, 20), (5, 21), (2, 18)], WOOD); d.rectangle((5, 14, 13, 16), fill=WOOD_LIGHT); r(d, (13, 11, 20, 18), "#424b49"); d.rectangle((14, 12, 19, 14), fill=METAL_LIGHT); p(d, [(14, 18), (18, 18), (17, 23), (13, 23)], OUTLINE); d.rectangle((15, 19, 16, 21), fill=GOLD); l(d, [(19, 11), (30, 9)], METAL_LIGHT, 2); l(d, [(19, 15), (30, 13)], "#596361", 2); d.rectangle((29, 8, 31, 14), fill=OUTLINE); r(d, (20, 15, 26, 19), WOOD); d.rectangle((21, 16, 25, 17), fill=WOOD_LIGHT); d.rectangle((18, 9, 20, 11), fill=OUTLINE)
    elif item_id == "hunting_rifle":
        p(d, [(2, 15), (8, 11), (16, 12), (20, 16), (15, 19), (11, 26), (4, 27), (7, 19), (2, 18)], WOOD); d.rectangle((5, 14, 15, 16), fill=WOOD_LIGHT); r(d, (14, 10, 21, 18), "#4c5553"); d.rectangle((16, 11, 20, 13), fill=METAL_LIGHT); p(d, [(15, 18), (19, 18), (18, 23), (14, 23)], OUTLINE); d.rectangle((16, 19, 17, 21), fill=GOLD); d.rectangle((20, 9, 23, 12), fill="#242928"); l(d, [(21, 12), (30, 10)], METAL_LIGHT, 2); d.rectangle((29, 9, 31, 12), fill=OUTLINE); r(d, (12, 6, 23, 9), SHADOW); d.rectangle((14, 5, 16, 7), fill=METAL); d.rectangle((21, 5, 23, 7), fill=METAL); d.rectangle((23, 13, 25, 16), fill=GOLD)
    else:
        raise KeyError(item_id)
    return image


ITEM_IDS = (
    "canned_food", "water", "cabbage", "carrot", "potato", "apple", "beef", "pork",
    "cloth", "wood", "metal", "screws", "steel_plate", "solar_panel", "duct_tape", "circuit_board", "electric_motor", "fuel", "medicine", "ammo",
    "pistol_ammo", "smg_ammo", "shotgun_shell", "rifle_ammo", "battery", "engine_part",
    "bandage", "torch", "barricade", "turret_kit", "solar_generator_kit",
    "fuel_generator_kit", "battery_bank_kit", "makeshift_workbench_kit", "plank_workbench_kit", "technical_workbench_kit", "generator_fuel", "molotov", "scrap_cache",
    "basic_tshirt", "work_pants", "utility_belt", "utility_vest", "school_backpack", "hiking_backpack", "military_backpack",
)


def load_weapon_ids():
    source = (ROOT / "src" / "data" / "weapon-definitions.ts").read_text(encoding="utf-8")
    return tuple(re.findall(r'^  ([a-z_]+): \{ id: "\1"', source, re.MULTILINE))


WEAPON_IDS = load_weapon_ids()


def load_ranged_weapon_ids():
    source = (ROOT / "src" / "data" / "weapon-definitions.ts").read_text(encoding="utf-8")
    return tuple(match.group(1) for match in re.finditer(r'^  ([a-z_]+): \{[^\n]*kind: "ranged"', source, re.MULTILINE))


RANGED_WEAPON_IDS = load_ranged_weapon_ids()
RANGED_WEAPON_PARTS = {
    "pistol": ("slide", "barrel", "front_sight", "rear_sight", "trigger_guard", "trigger", "grip", "magazine", "ejection_port", "slide_groove", "muzzle"),
    "smg": ("short_stock", "rear_body", "receiver", "grip", "magazine", "short_barrel", "muzzle", "top_sight", "metal_body", "polymer_body"),
    "shotgun": ("stock", "receiver", "trigger_guard", "trigger", "pump", "long_barrel", "tubular_magazine", "front_sight", "muzzle"),
    "hunting_rifle": ("wood_stock", "receiver", "trigger_guard", "trigger", "bolt", "long_barrel", "scope", "scope_mount", "muzzle"),
}
RANGED_WEAPON_CATEGORIES = {"pistol": "pistol", "smg": "smg", "shotgun": "shotgun", "hunting_rifle": "rifle"}


def draw_ranged_icon(item_id, logical_size):
    image = Image.new("RGBA", logical_size, (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    if item_id == "pistol":
        p(d, [(6, 15), (49, 15), (58, 20), (58, 27), (43, 30), (38, 34), (18, 34), (18, 29), (6, 26)], "#687270")
        d.rectangle((9, 16, 48, 19), fill="#c5ceca"); d.rectangle((15, 20, 50, 23), fill="#8f9b99"); d.rectangle((29, 16, 39, 18), fill="#e1e6df")
        r(d, (43, 20, 51, 25), "#39413f"); d.rectangle((46, 21, 49, 23), fill="#1d2322"); d.rectangle((53, 14, 56, 17), fill="#202625"); d.rectangle((56, 20, 60, 26), fill="#101413")
        p(d, [(20, 33), (38, 33), (34, 54), (20, 54)], "#303735"); d.rectangle((23, 36, 34, 49), fill="#4d5754"); d.rectangle((24, 38, 32, 39), fill="#737e7a"); d.rectangle((22, 52, 34, 56), fill="#171b1a")
        p(d, [(36, 32), (44, 33), (42, 43), (35, 43)], "#171b1a"); d.rectangle((38, 35, 40, 39), fill=GOLD); d.rectangle((10, 14, 14, 16), fill="#202625"); d.rectangle((31, 21, 33, 25), fill="#596461")
    elif item_id == "smg":
        p(d, [(6, 25), (15, 18), (28, 19), (32, 25), (28, 34), (16, 37), (6, 34)], "#2c3331"); d.rectangle((10, 26, 25, 29), fill="#59625f")
        r(d, (25, 20, 70, 36), "#4d5754"); d.rectangle((29, 21, 61, 25), fill="#b7c1bd"); d.rectangle((34, 27, 68, 34), fill="#65716d"); d.rectangle((42, 29, 57, 32), fill="#303735")
        l(d, [(68, 25), (88, 25)], "#879395", 4); d.rectangle((86, 22, 91, 29), fill="#171b1a"); d.rectangle((38, 17, 43, 21), fill="#171b1a"); d.rectangle((60, 16, 65, 21), fill="#171b1a")
        p(d, [(31, 35), (45, 35), (41, 54), (31, 52)], "#242a29"); d.rectangle((34, 39, 40, 49), fill="#4f5956"); p(d, [(48, 35), (61, 35), (65, 55), (52, 55)], "#7a8581"); d.rectangle((53, 38, 60, 51), fill="#a8b1ad")
        p(d, [(25, 35), (34, 36), (31, 45), (23, 44)], "#171b1a"); d.rectangle((28, 37, 30, 41), fill=GOLD)
    elif item_id == "shotgun":
        p(d, [(7, 30), (17, 22), (37, 23), (48, 30), (41, 39), (22, 43), (8, 39)], "#7d5435"); d.rectangle((12, 30, 37, 34), fill="#c18a52"); d.rectangle((17, 25, 35, 28), fill="#9c6a40"); d.rectangle((9, 35, 24, 38), fill="#5e402c")
        r(d, (39, 23, 61, 39), "#46504e"); d.rectangle((42, 24, 58, 28), fill="#b4bfbb"); d.rectangle((44, 30, 58, 36), fill="#65706d"); d.rectangle((56, 25, 61, 31), fill="#2a302f")
        p(d, [(43, 38), (55, 38), (53, 49), (42, 49)], "#171b1a"); d.rectangle((46, 40, 49, 45), fill=GOLD)
        l(d, [(59, 24), (119, 20)], "#aeb8b5", 3); l(d, [(59, 31), (120, 28)], "#596361", 3); d.rectangle((117, 18, 122, 31), fill="#171b1a"); d.rectangle((118, 20, 120, 23), fill="#d3dbd6")
        r(d, (69, 30, 91, 39), "#8b5d38"); d.rectangle((72, 31, 88, 34), fill="#c18a52"); d.line((77, 31, 75, 38), fill="#5e402c", width=2); d.line((84, 31, 82, 38), fill="#5e402c", width=2); d.rectangle((59, 19, 63, 23), fill="#171b1a")
    elif item_id == "hunting_rifle":
        p(d, [(7, 32), (18, 23), (42, 24), (54, 31), (48, 39), (31, 42), (23, 53), (10, 54), (16, 41), (7, 39)], "#805538"); d.rectangle((13, 31, 42, 35), fill="#c08a55"); d.rectangle((18, 25, 40, 28), fill="#9b6941")
        r(d, (42, 23, 64, 39), "#46504e"); d.rectangle((45, 24, 61, 28), fill="#b8c2be"); d.rectangle((48, 30, 61, 36), fill="#65706d"); d.rectangle((61, 27, 67, 33), fill=GOLD)
        p(d, [(44, 38), (56, 38), (53, 49), (43, 49)], "#171b1a"); d.rectangle((47, 40, 50, 45), fill=GOLD)
        l(d, [(63, 26), (120, 22)], "#aeb8b5", 3); d.rectangle((117, 20, 122, 27), fill="#171b1a"); r(d, (38, 14, 70, 20), "#303735"); d.rectangle((42, 15, 66, 17), fill="#7a8581"); d.rectangle((43, 11, 48, 15), fill="#596361"); d.rectangle((62, 11, 67, 15), fill="#596361")
    else:
        raise KeyError(item_id)
    return image


def load_footprints():
    item_source = (ROOT / "src" / "data" / "item-definitions.ts").read_text(encoding="utf-8")
    weapon_source = (ROOT / "src" / "data" / "weapon-definitions.ts").read_text(encoding="utf-8")
    footprints = {
        item_id: (max(int(width), int(height)), min(int(width), int(height)))
        for item_id, width, height in re.findall(r"([a-z_]+):\{width:(\d+),height:(\d+)\}", item_source)
    }
    for item_id, width, height in re.findall(r'id:\s*"([a-z_]+)".*?inventoryFootprint:\{width:(\d+),height:(\d+)\}', weapon_source):
        footprints[item_id] = (max(int(width), int(height)), min(int(width), int(height)))
    return footprints


def render_footprint_icon(item_id, footprint):
    width, height = footprint
    logical_size = (width * 32, height * 32)
    if item_id in RANGED_WEAPON_IDS:
        return draw_ranged_icon(item_id, logical_size).resize((width * 64, height * 64), Image.Resampling.NEAREST)
    source = draw_icon(item_id)
    margin = 3
    artwork = source.resize((logical_size[0] - margin * 2, logical_size[1] - margin * 2), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", logical_size, (0, 0, 0, 0))
    canvas.alpha_composite(artwork, (margin, margin))
    return canvas.resize((width * 64, height * 64), Image.Resampling.NEAREST)


def validate_icon(item_id, image, footprint):
    assert footprint[0] >= footprint[1], (item_id, footprint)
    expected_size = (footprint[0] * 64, footprint[1] * 64)
    assert image.size == expected_size, (item_id, image.size, expected_size)
    assert set(image.getchannel("A").get_flattened_data()).issubset({0, 255}), item_id
    bounds = image.getchannel("A").getbbox()
    assert bounds is not None, item_id
    left, top, right, bottom = bounds
    assert left > 0 and top > 0 and right < image.width and bottom < image.height, (item_id, bounds)
    used_width, used_height = right - left, bottom - top
    if item_id in WEAPON_IDS:
        assert max(used_width / image.width, used_height / image.height) >= 0.75, (item_id, bounds)
    if item_id in {"knife", "bat"}:
        assert used_width > used_height * 2, (item_id, bounds)
    if item_id in RANGED_WEAPON_IDS:
        colors = {pixel for pixel in image.get_flattened_data() if pixel[3]}
        assert 7 <= len(colors) <= 14, (item_id, len(colors))
        assert used_width > used_height, (item_id, bounds)
        assert 0.75 <= used_width / image.width <= 0.92, (item_id, bounds)


def ranged_weapon_metadata(item_id, image, footprint):
    bounds = image.getchannel("A").getbbox()
    assert bounds is not None
    stock_x = bounds[0]
    muzzle_x = bounds[2] - 1
    return {
        "id": item_id,
        "itemId": item_id,
        "facing": "east",
        "direction": "east",
        "category": RANGED_WEAPON_CATEGORIES[item_id],
        "source": "WEAPON_DEFINITIONS",
        "footprint": {"width": footprint[0], "height": footprint[1]},
        "canvas": {"width": image.width, "height": image.height},
        "alphaBounds": {"left": bounds[0], "top": bounds[1], "right": bounds[2], "bottom": bounds[3]},
        "keypoints": {"stockX": stock_x, "muzzleX": muzzle_x},
        "parts": list(RANGED_WEAPON_PARTS[item_id]),
    }


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
        validate_icon(item_id, image, footprint)
        assert image.tobytes() == render_footprint_icon(item_id, footprint).tobytes(), item_id
        image.save(OUTPUT / f"{item_id}.png", optimize=True)
    ranged_metadata = [ranged_weapon_metadata(item_id, render_footprint_icon(item_id, footprints[item_id]), footprints[item_id]) for item_id in RANGED_WEAPON_IDS]
    RANGED_METADATA_OUTPUT.write_text(json.dumps({"weapons": ranged_metadata}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(selected)} icons in {OUTPUT}")


if __name__ == "__main__":
    main()
