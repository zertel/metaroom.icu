const Jimp = require('jimp');
const ScreenObject = require('./ScreenObject');

class BasicApp {
  constructor(appId,screen,width,height,bgColor,speed){
    this.enabled = true;
    this.appId = appId;
    this.screen = screen;
    if(width){
      this.width = width;
    }
    else{
      this.width = screen.width;
    }

    if(height){
      this.height = height;
    }
    else{
      this.height = screen.height;
    }
    if(bgColor){
      this.bgColor = bgColor;
    }
    if(speed){
      this.speed = speed;
    }
    else{
      this.speed = 0.1;
    }

    
    this.objects = {};
    this.orderedObjects = [];
    this.currentFrameBase64 = "";
    this.currentFrameNo = 0;

  }

  refresh(){
    this.objects = {};
    this.orderedObjects = [];
    this.currentFrameBase64 = "";
    this.currentFrameNo = 0;
  }

  setObject(id, newData) {
    if(!this.objects[id]){
      this.objects[id] = new ScreenObject(id);
      this.orderedObjects.push(this.objects[id]);
    }
    this.objects[id].type = newData.type;
    this.objects[id].x = newData.x;
    this.objects[id].y = newData.y;
    this.objects[id].w = newData.w;
    this.objects[id].h = newData.h;
    this.objects[id].data = newData.data;
    this.objects[id].visible = true;
    if(newData.onclick){
      this.objects[id].onclick = newData.onclick;
    }
  }
  removeObject(id){
    //console.log("removeObject("+id+")", this.objects[id]);
    if(this.objects[id] != null){
      this.orderedObjects = this.orderedObjects.filter((so)=>{ return so.id != id });
      this.objects[id] = null;
    }
    else{
      console.log(id+" zaten silinmiş.");
    }
  }

  async render(cb){    
    if(!this.enabled) return;

    if(this.bgColor){
      this.screen.setObject(this.appId+'-bg',{type:'box', x:0, y:0, w:this.width, h:this.height, data:this.bgColor});
    }

    //const newFrame = await Jimp.create(this.width, this.height, this.bgColor);
    const newFrame = await this.screen.createImage({
      width: this.width,
      height: this.height,
      background: this.screenThemeColor //[0,0,0,0] //r,g,b,a
    });

    if(this.orderedObjects.length > 0){
      for (let i = 0; i < this.orderedObjects.length; i++) {
        var so = this.orderedObjects[i];
        if(so != null && so.visible){   
          switch(so.type){

            case 'box':
                //console.log("BasicApp async render box", so);
                await newFrame.box(so.x, so.y, so.w, so.h, so.data);
              break;
              


            default:
                await newFrame.compositeBase64(so.data, so.x, so.y, so.w, so.h, so.opacity);
          }
        }
      }
  
    }

    await newFrame.getBase64((buffer) => {
      this.currentFrameBase64 = buffer;
      //this.currentFrameNo = this.setCounter; //newFrame.hash();

      this.currentFrameNo = Math.random();
      this.screen.setObject(this.appId+'-screen',{type:'image', x:0, y:0, w:this.width, h:this.height, 
        data:
          //'data:image/png;base64,'+
          this.currentFrameBase64,
        onclick: (so, data)=>{
          console.log(this.name + " isimli uygulamaya tıklandı.");
          this.clickDetector(data);
        }
      });
      if(cb)cb();
    
    });
  }


  clickDetector(data) {
    if(!this.enabled) return;

    //console.log(data);
    for (var i = this.orderedObjects.length - 1; i >= 0; i--) {
      var so = this.orderedObjects[i];      
      if(so.type != 'mouseCursor' && data.x > so.x && data.x < (so.x+so.w) && data.y > so.y && data.y < (so.y+so.h)){
        if(so.onclick){
          so.onclick(so);
        }
        else{
          console.log("İşlevsiz objeye tıklandı.",so.id);
        }
        break;
      }
    }
  }



  exit(){
    this.enabled = false;
    clearInterval(this.intervalId);
    this.objects = {};
    this.orderedObjects = [];
    this.currentFrameBase64 = "";
    this.currentFrameNo = 0;
    this.screen.removeObject(this.appId+'-bg');
    this.screen.removeObject(this.appId+'-screen');
    
    console.log(this.name + " sonlandırıldı.");
  }

  clear(){
    this.enabled = true;
  }

  async create(type,id,data){
    //console.log("BasicApp async create", type, id, data);
    switch(type){
      case 'button':

        if(typeof data.bg == 'number'){
          this.setObject(this.appId + '-button-' + id + "-bg", {type:'box', x:data.x, y:data.y, w:data.w, h:data.h, data:'#00000066', onclick:null});

          var fileDir = "/var/www/ezis/asset/"+(Math.floor(data.bg/1000)*1000)+"/"+(data.bg % 1000);

          var imageDataBase64 = await this.screen.readImageBase64(fileDir + ".png");
          //console.log("imageDataBase64",imageDataBase64)

          this.setObject(this.appId + '-button-' + id, {type:'image', x:data.x+2, y:data.y+2, w:data.w-4, h:data.h-4, data:imageDataBase64, onclick:data.onclick});
          this.render();
              
        }
        else{
          //console.log("button bg", data);
          this.setObject(this.appId + '-button-' + id, {type:'box', x:data.x, y:data.y, w:data.w, h:data.h, data:data.bg, onclick:data.onclick});
          this.render();
        }

        break; 
    }
  }
}

module.exports = BasicApp;
