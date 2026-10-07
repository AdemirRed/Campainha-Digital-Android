#!/usr/bin/env python3
"""Find people in a 24h-recording clip.

usage: detect_people.py <clip.webm> <best_frame_out.jpg>

Samples the clip at 1 frame/second (ffmpeg), runs YOLOv4-tiny (OpenCV DNN,
CPU) and prints JSON: {"frames": N, "hits": [{"t": sec, "conf": c}], "best_t": sec|null}.
Writes the most confident person frame (with a box drawn) to best_frame_out.

Face detection only fires for someone facing the doorbell up close; people
walking past on the street are side-on/back-on and small. A body detector
catches them.
"""
import json
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np

YOLO_DIR = os.environ.get("YOLO_DIR", "/opt/yolo")
CONF_MIN = float(os.environ.get("PERSON_CONF_MIN", "0.45"))
PERSON_CLASS = 0


def load_net():
    net = cv2.dnn.readNetFromDarknet(
        os.path.join(YOLO_DIR, "yolov4-tiny.cfg"),
        os.path.join(YOLO_DIR, "yolov4-tiny.weights"),
    )
    net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
    net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    return net


def detect(net, img):
    h, w = img.shape[:2]
    blob = cv2.dnn.blobFromImage(img, 1 / 255.0, (416, 416), swapRB=True, crop=False)
    net.setInput(blob)
    outs = net.forward(net.getUnconnectedOutLayersNames())
    boxes, confs = [], []
    for out in outs:
        for det in out:
            scores = det[5:]
            if int(np.argmax(scores)) != PERSON_CLASS:
                continue
            conf = float(scores[PERSON_CLASS]) * float(det[4])
            if conf < CONF_MIN:
                continue
            cx, cy, bw, bh = det[0] * w, det[1] * h, det[2] * w, det[3] * h
            boxes.append([int(cx - bw / 2), int(cy - bh / 2), int(bw), int(bh)])
            confs.append(conf)
    if not boxes:
        return []
    keep = cv2.dnn.NMSBoxes(boxes, confs, CONF_MIN, 0.4)
    keep = np.array(keep).flatten().tolist() if len(keep) else []
    return [(boxes[i], confs[i]) for i in keep]


def main():
    clip, best_out = sys.argv[1], sys.argv[2]
    tmp = tempfile.mkdtemp(prefix="people-")
    try:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", clip, "-vf", "fps=1,scale=640:-2",
             os.path.join(tmp, "f%04d.jpg")],
            check=False, timeout=180,
        )
        frames = sorted(f for f in os.listdir(tmp) if f.endswith(".jpg"))
        net = load_net()
        hits, centers = [], []
        best = None  # (conf, t, img, box)
        for i, name in enumerate(frames):
            img = cv2.imread(os.path.join(tmp, name))
            if img is None:
                continue
            dets = detect(net, img)
            if not dets:
                continue
            box, conf = max(dets, key=lambda d: d[1])
            hits.append({"t": i, "conf": round(conf, 3)})
            centers.append((box[0] + box[2] / 2, box[1] + box[3] / 2))
            if best is None or conf > best[0]:
                best = (conf, i, img, box)

        # Something person-shaped that never moves and is there the whole
        # clip (a statue, a coat on a rail, the bench...) is not a passer-by.
        if hits and len(hits) >= 0.8 * max(1, len(frames)) and len(centers) > 3:
            spread = float(np.std(np.array(centers), axis=0).max())
            if spread < 8:
                hits, best = [], None

        if best is not None:
            _, _, img, (x, y, bw, bh) = best
            cv2.rectangle(img, (x, y), (x + bw, y + bh), (60, 220, 60), 2)
            cv2.imwrite(best_out, img, [cv2.IMWRITE_JPEG_QUALITY, 82])

        print(json.dumps({
            "frames": len(frames),
            "hits": hits,
            "best_t": best[1] if best else None,
        }))
    finally:
        for f in os.listdir(tmp):
            os.remove(os.path.join(tmp, f))
        os.rmdir(tmp)


if __name__ == "__main__":
    main()
