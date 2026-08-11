# Hatsune Miku Illustration Generation

This project contains a Python script to generate an illustration of Hatsune Miku using a local Stable Diffusion WebUI (Forge) instance via its HTTP API.

## Purpose

To automate the request to the Stable Diffusion API to generate high-quality anime illustrations (specifically Hatsune Miku) and save them locally.

## Prerequisites

1. **Python 3.x**: No external library is required, as the script uses Python's built-in `urllib` library.
2. **Stable Diffusion WebUI / Forge**: Must be running locally with the API enabled.
   - Start Stable Diffusion WebUI with the `--api` flag (e.g., `./webui.sh --api` or similar).
   - Ensure the API is accessible at `http://127.0.0.1:7860/`.
3. **Model Checkpoint**: The script is optimized to run with SDXL-based anime models (such as `waiIllustriousSDXL_v160.safetensors`).

## Usage

To generate the default Hatsune Miku illustration:

```bash
python3 generate.py
```

This will call the API with the predefined prompt and save the output as `hatsune_miku.png`.

### Customizing Generation

You can customize the generation parameters by passing command-line arguments:

```bash
python3 generate.py \
  --prompt "safe, source_anime, masterpiece, best quality, hatsune miku, 1girl, smiling, solo" \
  --negative_prompt "nsfw, lowres, bad anatomy, bad hands, text, error" \
  --steps 30 \
  --cfg_scale 7.0 \
  --width 1024 \
  --height 1024 \
  --sampler_name "Euler a" \
  --output "custom_miku.png"
```

### Arguments

- `--prompt`: Text prompt for generation.
- `--negative_prompt`: Things to avoid in the generated image.
- `--steps`: Number of sampling steps (default: 28).
- `--cfg_scale`: Classifier Free Guidance scale (default: 5.5).
- `--width`: Width of the generated image in pixels (default: 896).
- `--height`: Height of the generated image in pixels (default: 1152).
- `--sampler_name`: Sampler to use (default: "Euler a").
- `--output`: File path where the output image will be saved (default: "hatsune_miku.png").
