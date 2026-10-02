# Detecta os pontos do rosto (MediaPipe Face Landmarker) e devolve olhos, boca e queixo.
# Uso como módulo: marcos(img_pil) -> dict ou None
import numpy as np, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
MODEL = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/face_landmarker.task'
_det = None
def det():
    global _det
    if _det is None:
        _det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=MODEL), num_faces=4))
    return _det
# índices do Face Mesh: centros dos olhos (média do contorno), cantos da boca, queixo, testa
# contorno do rosto (Face Mesh FACE_OVAL, em ordem)
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
OLHO_E = [33, 133, 159, 145]; OLHO_D = [362, 263, 386, 374]; BOCA = [13, 14, 61, 291]; QUEIXO = 152; TESTA = 10
def marcos(im):
    a = np.asarray(im.convert('RGB'))
    r = det().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=a))
    out = []
    W, H = im.size
    for lm in r.face_landmarks:
        P = lambda ids: np.mean([[lm[i].x * W, lm[i].y * H] for i in ids], axis=0)
        out.append({'oe': P(OLHO_E), 'od': P(OLHO_D), 'boca': P(BOCA), 'queixo': P([QUEIXO]), 'testa': P([TESTA]), 'oval': np.array([[lm[i].x * W, lm[i].y * H] for i in OVAL])})
    return out
if __name__ == '__main__':
    import sys
    from PIL import Image
    for f in sys.argv[1:]:
        print(f, [{k: v.round(1).tolist() for k, v in m.items()} for m in marcos(Image.open(f))])
