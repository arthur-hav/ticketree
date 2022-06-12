from PIL import Image, ImageColor
from collections import Counter


def gen_7_palette(integer):
    base_hue = (integer % 32) * 360 // 32
    integer = integer // 32
    compl_hue1 = (66 + base_hue + (integer % 8) * (300 // 24)) % 360
    integer = integer // 8
    compl_hue2 = (-66 + base_hue - (integer % 8) * (300 // 24)) % 360
    print(base_hue, compl_hue1, compl_hue2)

    return [
        ImageColor.getrgb(f'hsl({base_hue},25%,5%)'),
        ImageColor.getrgb(f'hsl({compl_hue1}, 30%, 35%)'),
        ImageColor.getrgb(f'hsl({base_hue}, 45%, 60%)'),
        ImageColor.getrgb(f'hsl({compl_hue2}, 30%, 85%)'),
    ]


def _vomit(bigint, pal, img):
    init_int = bigint
    pixels = img.load()
    intersect = set()
    for j in range(0, img.size[1], 3):
        for i in range(0, img.size[0] // 2, 3):
            m_i = img.size[0] - i - 1
            for k in range(3):
                for l in range(3):
                    pixels[i + l, j + k] = pal[bigint % len(pal)]
                    pixels[m_i - l, j + k] = pal[bigint % len(pal)]
            intersect.add((i, j))
            intersect.add((i + 2, j))
            intersect.add((i, j + 2))
            intersect.add((i + 2, j + 2))
            intersect.add((m_i, j))
            intersect.add((m_i - 2, j))
            intersect.add((m_i, j + 2))
            intersect.add((m_i - 2, j + 2))
            bigint = bigint // 4
            if bigint == 0:
                bigint = init_int // 2
    for point in intersect:
        cluster = {point}
        for point2 in intersect:
            if abs(point[0] - point2[0]) < 2 and abs(point[1] - point2[1]) < 2:
                cluster.add(point2)

        colors = Counter([pixels[p] for p in cluster])
        max_color = max(colors.items(), key=lambda it: it[1])
        min_color = min(colors.items(), key=lambda it: it[1])
        if max_color[1] >= 2 and min_color[1] == 1:
            for p in cluster:
                pixels[p] = max_color[0]
    return img


def pyvomit128(bigint):
    img = Image.new('RGB', (24, 24), "black")
    pal = gen_7_palette(bigint)
    return _vomit(bigint, pal, img)


if __name__ == '__main__':
    import random
    random.seed(0)
    for i in range(10):
        pyvomit128(random.randint(0, 2**128)).save(f'img{i}.png')