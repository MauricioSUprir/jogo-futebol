# Marcos (MediaPipe Face Landmarker: 478 pontos, blendshapes e a matriz de pose) das fotos dos jogadores do TM.
# Uso: python -I marcos_fotos.py <modelo.task> <saida.json> <fotos...>
import sys, json, math, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
mod, saida = sys.argv[1:3]
det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=mod), num_faces=2, output_face_blendshapes=True,
    output_facial_transformation_matrixes=True))
out = {}
for arq in sys.argv[3:]:
    img = cv2.imread(arq)
    if img is None: continue
    h, w = img.shape[:2]
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    if not r.face_landmarks: out[arq] = None; continue
    # o maior rosto da foto
    k = max(range(len(r.face_landmarks)), key=lambda i: (max(p.x for p in r.face_landmarks[i]) - min(p.x for p in r.face_landmarks[i])))
    L = [[p.x * w, p.y * h, p.z * w] for p in r.face_landmarks[k]]
    M = np.array(r.facial_transformation_matrixes[k])
    R = M[:3, :3] / np.linalg.norm(M[:3, 0])
    yaw = math.degrees(math.atan2(-R[2, 0], math.hypot(R[0, 0], R[1, 0])))
    pitch = math.degrees(math.atan2(R[2, 1], R[2, 2]))
    roll = math.degrees(math.atan2(R[1, 0], R[0, 0]))
    bs = {c.category_name: round(c.score, 3) for c in r.face_blendshapes[k]}
    io = math.hypot(L[33][0] - L[263][0], L[33][1] - L[263][1])
    out[arq] = {'L': L, 'M': M.tolist(), 'yaw': yaw, 'pitch': pitch, 'roll': roll, 'bs': bs, 'olhos_px': io, 'w': w, 'h': h}
json.dump(out, open(saida, 'w'))
ok = [v for v in out.values() if v]
print(f'{len(ok)}/{len(out)} com rosto')
