const sharp = require('sharp');
class ImageDriverSharp {
  constructor(options){
    //this.base64Temp = "";
    this.sharpImage = null;
  }
  async create(options){
    //console.log("ImageDriverSharp: async create", options, this.color(options.background));
    this.options = options;
    this.sharpImage = await sharp({
      create: {
        width: options.width,
        height: options.height,
        channels: 4,
        background: this.color(options.background)
      }
    });

    //await Jimp.create(options.width, options.height, this.color(options.background));
  }
  async readBase64(fileName){
    //console.log("ImageDriverJimp: async readBase64", fileName);
    var sharpImage = await sharp(fileName);
    return await sharpImage.webp().toBuffer().toString('base64');
  }

  async compositeBase64(bufferBase64, x, y, w, h, opacity){
    var imageData = bufferBase64.split(',')[1];
    if(!imageData) return;

    //console.log("async compositeBase64", x, y, w, h, opacity, imageData.length+"byte");
    var altImageBuffer = await sharp(Buffer.from(imageData, 'base64'))
      .resize(w, h, {fit: 'fill'})
      .toBuffer();
    this.sharpImage = await sharp(
      await this.sharpImage.composite([
        { input: altImageBuffer, left: 20, top: 20 },
        {
          input: Buffer.from([0,0,0,255 * opacity]),
          raw: {
            width: 1,
            height: 1,
            channels: 4,
          },
          tile: true,
          blend: 'dest-in',
        }
      ]).webp().toBuffer()
    );
  }

  async getBase64(cb){
    await this.sharpImage.webp({ 
      lossless: true,
      //quality: 85
    }).toBuffer().then((bigImageBuffer) => {
      const base64Image = 'data:image/webp;base64,' + bigImageBuffer.toString('base64');
      cb(base64Image);
    });
  }

  async box(x, y, w, h, rgba, opacity){
    //console.log("ImageDriverSharp.box:", x, y, w, h, rgba, this.color(rgba, opacity));
    await sharp({create: {width:w, height:h, channels:4, background: this.color(rgba, opacity)}}).webp().toBuffer().then(async (boxBuffer) => {
      this.sharpImage = await sharp(
        await this.sharpImage.composite([{ input: boxBuffer, left: x, top: y }]).webp().toBuffer()
      );
    });
  }


  // Bir noktanın üçgen içinde olup olmadığını kontrol eden işlev 
  isInsideTriangle(x, y, x1, y1, x2, y2, x3, y3) {
    var area = 0.5 * (-y2 * x3 + y1 * (-x2 + x3) + x1 * (y2 - y3) + x2 * y3);
    var s = 1 / (2 * area) * (y1 * x3 - x1 * y3 + (y3 - y1) * x + (x1 - x3) * y);
    var t = 1 / (2 * area) * (x1 * y2 - y1 * x2 + (y1 - y2) * x + (x2 - x1) * y);
    return s > 0 && t > 0 && 1 - s - t > 0;
  }

  async mouseCursor(x,y){

    await sharp({create: {width:20, height:20, channels:4, background: this.color('randRgb', 1)}}).webp().toBuffer().then(async (boxBuffer) => {
      this.sharpImage = await sharp(
        await this.sharpImage.composite([{ input: boxBuffer, left: x, top: y }]).webp().toBuffer()
      );
    });
    /*/
    this.sharpImage.extend({
      left: x,   // Dikdörtgenin genişliğine göre konumu ayarla
      top: y, // Dikdörtgenin yüksekliğine göre konumu ayarla
      right: this.options.width - x - 20,
      bottom: this.options.height - y - 20,
      background: { r: 0, g: 255, b: 0, alpha: 1 }
    });

    const fillColor = 0x00FF0099 + Math.ceil(Math.random()*100); 
    const fillColor2 = 0x00AA00ff;
    await this.sharpImage.scan(x, y, 130, 130, (_x, _y, idx) => {
        if (this.isInsideTriangle(_x, _y, x+1, y+1, x+7, y+6, x+4, y+12)) {
            this.sharpImage.bitmap.data[idx] = (fillColor2 >> 24) & 0xFF; // R
            this.sharpImage.bitmap.data[idx + 1] = (fillColor2 >> 16) & 0xFF; // G
            this.sharpImage.bitmap.data[idx + 2] = (fillColor2 >> 8) & 0xFF; // B
            this.sharpImage.bitmap.data[idx + 3] = fillColor2 & 0xFF; // A
        }
        if (this.isInsideTriangle(_x, _y, x, y, x+12, y+7, x+5, y+8)) {
            this.sharpImage.bitmap.data[idx] = (fillColor >> 24) & 0xFF; // R
            this.sharpImage.bitmap.data[idx + 1] = (fillColor >> 16) & 0xFF; // G
            this.sharpImage.bitmap.data[idx + 2] = (fillColor >> 8) & 0xFF; // B
            this.sharpImage.bitmap.data[idx + 3] = fillColor & 0xFF; // A
        }
    });
    /*/
  }

  color(rgba, opacity){
    if(!opacity) opacity=1;

    if(rgba == 'randRgb'){
      rgba = [
        Math.floor(Math.random()*256),
        Math.floor(Math.random()*256),
        Math.floor(Math.random()*256),
        255
      ]
    }
    else if(typeof rgba == 'string'){
      rgba = this.hexToRgba(rgba);
    }
    else if(typeof rgba == 'object' && rgba.length < 3){
      rgba = [255, 255, 255, 255];
    }
    else if(typeof rgba == 'object' && rgba.length < 4){
      rgba[3] = 255;
    }
    else if(typeof rgba == 'object' && rgba.length > 4 || !rgba){
      rgba = [0, 0, 0, 0];
    }
    //console.log("RGBA",rgba, typeof rgba == 'object', rgba.length, opacity);
    rgba[3] /= opacity;
    
    return { r: rgba[0], g: rgba[1], b: rgba[2], alpha: (rgba[3]>0 ? 255/rgba[3] : 0) }
  }


  hexToRgba(hex) {
    if(hex.length == 7){
      hex += 'FF';
    }
    // Hexadecimal renk kodunu 6 haneli bir diziye dönüştürür
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    // Dönüştürülen diziyi RGB değerlerine ayrıştırır
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    const a = parseInt(result[4], 16);

    // RGB değerlerini bir obje olarak döndürür
    return [ r, g, b, a ];
  }
}

module.exports = ImageDriverSharp;
