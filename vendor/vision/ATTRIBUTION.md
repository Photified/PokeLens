# On-device image recognition

DINOv2-small by Meta Research, Apache 2.0. Original model: https://huggingface.co/facebook/dinov2-small
ONNX conversion: https://huggingface.co/Xenova/dinov2-small
Model: model_quantized.onnx, SHA-256 3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917.
Split into two files without changing weights. License: DINOV2-LICENSE.txt.

ONNX Runtime Web 1.22.0, Microsoft, MIT (ONNX-RUNTIME-LICENSE.txt).
OpenCV.js 4.11.0, OpenCV contributors, Apache 2.0 (OPENCV-LICENSE.txt).

The full flattened card is resized to 224 × 224 RGB. Pixels are divided by 255, then normalized with mean [0.485, 0.456, 0.406] and standard deviation [0.229, 0.224, 0.225]. The CLS token is L2-normalized. Reference vectors use per-row int8 quantization with norms restored at search time. Scores are similarities, not probabilities.

Reference card images and prices belong to their respective owners. The browser downloads numerical image features, not every catalog photograph. Listing thumbnails load from TCGplayer. User photographs never go to an inference server.
