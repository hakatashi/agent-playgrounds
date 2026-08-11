import json
import urllib.request
import base64
import argparse

def generate_image(prompt, negative_prompt, steps, cfg_scale, width, height, sampler_name, output_path):
    url = "http://127.0.0.1:7860/sdapi/v1/txt2img"
    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "width": width,
        "height": height,
        "sampler_name": sampler_name
    }
    
    headers = {'Content-Type': 'application/json'}
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    
    print(f"Sending request to Stable Diffusion API on {url}...")
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            images = res_data.get('images', [])
            if not images:
                print("Error: No images returned from the API.")
                return
            
            # Decode the first image
            image_data = base64.b64decode(images[0].split(",", 1)[-1])
            with open(output_path, 'wb') as f:
                f.write(image_data)
            print(f"Successfully saved generated image to {output_path}")
            
    except Exception as e:
        print(f"Error communicating with API: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate an image using Stable Diffusion WebUI API")
    parser.add_argument("--prompt", type=str, default="safe, source_anime, masterpiece, best quality, hatsune miku, 1girl, aqua eyes, aqua hair, twin tails, long hair, smiling, simple background, solo")
    parser.add_argument("--negative_prompt", type=str, default="nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry")
    parser.add_argument("--steps", type=int, default=28)
    parser.add_argument("--cfg_scale", type=float, default=5.5)
    parser.add_argument("--width", type=int, default=896)
    parser.add_argument("--height", type=int, default=1152)
    parser.add_argument("--sampler_name", type=str, default="Euler a")
    parser.add_argument("--output", type=str, default="hatsune_miku.png")
    
    args = parser.parse_args()
    generate_image(args.prompt, args.negative_prompt, args.steps, args.cfg_scale, args.width, args.height, args.sampler_name, args.output)
