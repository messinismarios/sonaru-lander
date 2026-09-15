/**
 * "Is this the same picture?" - for generators that commit their output.
 *
 * **Written for `npm run og` at 8.10a and extracted here at 8.10b**, when the press kit's
 * logo rasters turned out to have exactly the problem the covers had: two consecutive
 * renders of an identical frozen frame are not byte-identical, so an unconditional write
 * rewrites committed binaries on every run and the repo grows a diff nobody can read.
 *
 * The cause differs and the remedy does not. A cover's noise is GPU rasterisation of a
 * large blurred gradient, amplified by JPEG's entropy coding. The lockup's is text
 * antialiasing under a **fractional** `deviceScaleFactor` - the shot is scaled to land on
 * exactly 1024px from whatever "Sonaru" happens to measure at 128px, and subpixel coverage
 * on a curve is not reproducible to the byte.
 *
 * The comparison is done in the browser both generators already have open, rather than by
 * adding a Node image library - the same reason there is no second image toolchain here.
 *
 * @param page a Playwright page used only for decoding; never photographed
 * @param mime how to decode the two buffers, e.g. `image/jpeg` or `image/png`
 */
export async function perceptuallyEqual(page, existing, fresh, mime) {
  return await page.evaluate(
    async ([a, b, type]) => {
      const load = (data) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = `data:${type};base64,${data}`;
        });
      const [imageA, imageB] = await Promise.all([load(a), load(b)]);
      if (imageA.width !== imageB.width || imageA.height !== imageB.height) return false;
      const canvas = document.createElement('canvas');
      canvas.width = imageA.width;
      canvas.height = imageA.height;
      const context = canvas.getContext('2d');
      context.drawImage(imageA, 0, 0);
      const dataA = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(imageB, 0, 0);
      const dataB = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let differing = 0;
      let max = 0;
      for (let i = 0; i < dataA.length; i += 4) {
        /*
         * Alpha is compared along with the colours, which the JPEG-only original did not
         * have to do: the logo files are transparent, and a mark whose edges softened
         * would be a real change showing no colour difference at all.
         */
        const delta = Math.max(
          Math.abs(dataA[i] - dataB[i]),
          Math.abs(dataA[i + 1] - dataB[i + 1]),
          Math.abs(dataA[i + 2] - dataB[i + 2]),
          Math.abs(dataA[i + 3] - dataB[i + 3]),
        );
        if (delta > 2) differing += 1;
        if (delta > max) max = delta;
      }
      const pixels = dataA.length / 4;
      /*
       * Two shapes of noise, both measured rather than assumed, and a rule for each.
       *
       * **The covers**: many pixels differ, every one of them slightly - 0.038% of the
       * frame by at most 8/255, GPU rasterisation of a big blurred gradient. Ten times
       * that noise floor, capped well below what an eye resolves.
       *
       * **The lockups**: one pixel in 277,504 differs (0.00036%), by **21/255** - a single
       * antialiased sample on the curve of an `S` under a fractional device scale factor.
       * The first rule rejects it on the cap alone, which is why the second exists: a
       * difference confined to a handful of pixels cannot be a change to the picture,
       * however far that handful moved. A real edit to the mark moves thousands.
       */
      return (differing / pixels < 0.005 && max <= 16) || differing / pixels < 0.0001;
    },
    [existing.toString('base64'), fresh.toString('base64'), mime],
  );
}
