from pathlib import Path
from io import BytesIO
import base64
import colorsys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
REFERENCES = ROOT / 'design-review/v1.1/references'
OUTPUT = ROOT / 'frontend/public/art/panel'


def extract(name, bounds, polygon):
    image = Image.open(REFERENCES / name).convert('RGB')
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    rgb = np.asarray(image)
    white = rgb.min(axis=2) > 225
    labels, _ = ndimage.label(white)
    outside = np.unique(labels[np.asarray(mask) == 0])
    outside = outside[outside != 0]
    background = np.isin(labels, outside)
    alpha = np.asarray(mask).copy()
    alpha[background] = 0
    edge = ndimage.binary_dilation(background) & (alpha > 0)
    alpha[edge] = np.minimum(alpha[edge], (255 - rgb.min(axis=2)[edge]).astype(float) * 5).astype('uint8')
    rgba = image.convert('RGBA')
    rgba.putalpha(Image.fromarray(alpha))
    return rgba.crop(bounds)


def data(image):
    buffer = BytesIO()
    image.save(buffer, format='PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


def rig(filename, image, head_bottom, title):
    source = data(image)
    width = 632 * image.width / image.height
    left = (360 - width) / 2
    OUTPUT.joinpath(filename).write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 650" fill="none">
<title>{title}</title>
<metadata>Local reference-art preview. The Great Ace Attorney Chronicles character artwork © CAPCOM. Extracted from the user-supplied Creative Uncut reference sheet; not original Delegates artwork or licensed for public distribution.</metadata>
<defs><clipPath id="portrait"><path d="M0 0H360V{head_bottom}H0Z"/></clipPath><clipPath id="costume"><path d="M0 {head_bottom}H360V650H0Z"/></clipPath><image id="paint" x="{left:.2f}" y="8" width="{width:.2f}" height="632" preserveAspectRatio="none" href="{source}"/></defs>
<g class="body" clip-path="url(#costume)"><use href="#paint"/></g>
<g class="head" clip-path="url(#portrait)"><use href="#paint"/></g>
</svg>''')


japan = extract('japan.jpg', (64, 53, 603, 1309), [(232,168),(239,139),(287,125),(283,93),(321,88),(312,65),(339,52),(371,61),(358,91),(395,86),(399,128),(450,135),(448,164),(405,166),(422,249),(471,279),(472,303),(512,341),(573,438),(602,551),(579,699),(579,833),(549,859),(559,1165),(511,1218),(523,1308),(419,1310),(399,1214),(309,1210),(293,1298),(171,1296),(157,1246),(209,1228),(212,1190),(141,1177),(138,854),(102,847),(67,591),(78,504),(137,393),(171,296),(224,278),(258,253),(270,210),(283,171)])
british = extract('british.jpg', (30, 90, 754, 1300), [(369,171),(375,129),(401,105),(439,96),(480,103),(503,130),(507,179),(530,196),(538,252),(578,285),(614,312),(652,367),(685,445),(727,554),(751,662),(737,731),(744,764),(710,779),(691,969),(700,1051),(651,1076),(641,1190),(672,1250),(675,1296),(558,1296),(540,1250),(557,1208),(544,1084),(374,1083),(373,1203),(350,1283),(255,1296),(247,1249),(279,1207),(298,1082),(252,1062),(241,1018),(254,917),(242,906),(244,813),(212,773),(134,838),(81,835),(59,760),(30,721),(65,696),(111,685),(143,691),(159,668),(139,640),(148,591),(189,493),(222,400),(263,341),(301,312),(350,285),(363,251),(369,213)])
rig('japan-reference.svg', japan, 126, 'Japanese judge, supplied Capcom reference artwork')
rig('british-reference.svg', british, 143, 'British judge, supplied Capcom reference artwork')

pixels = np.array(british)
for row in range(pixels.shape[0]):
    for column in range(pixels.shape[1]):
        r, g, b, a = pixels[row, column]
        if a and int(r) > int(g) * 1.2 and int(r) > int(b) * 1.12:
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            pixels[row, column, :3] = np.array(colorsys.hsv_to_rgb(.455, s * .66, v * .82)) * 255
template = Path(__file__).with_name('woman-reference.template.svg').read_text()
OUTPUT.joinpath('woman-reference.svg').write_text(template.replace('COSTUME_DATA', data(Image.fromarray(pixels))))
print('Prepared attributed reference rigs and teal costume study.')
