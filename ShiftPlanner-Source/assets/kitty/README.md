# Kitty artwork

- `hello-kitty.png`: reference image downloaded from [CityPNG — HD Portrait Of Sweet Hello Kitty Waving PNG](https://www.citypng.com/photo/19dd1fa4/hd-portrait-of-sweet-hello-kitty-waving-png). The source page describes the image as free for personal use. Hello Kitty is a Sanrio character.
- `hello-kitty-cutout.png`: transparent cutout prepared from that reference with ImageGen for this personal app. The original downloaded preview has a checkerboard baked into its pixels, so it is retained only as a reference.
- `css/kitty.css` clips the cutout into body and arm layers and animates the arm around its shoulder. The source pixels are unchanged by the animation. A pause button and `prefers-reduced-motion` support are included.
- `scripts/build-standalone.cjs` embeds the PNG into the standalone HTML; no external image request is needed at runtime.
