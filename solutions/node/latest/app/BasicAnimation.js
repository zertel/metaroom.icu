class BasicAnimation {
  constructor(id, screen) {
    this.screen = screen;
    this.id = id;

    this.clear();
  }
  clear(){
    this.enabled = false;
    this.playing = false;
    this.timeStamp = 0;
    this.loop = false;
    this.duration = 0;
    this.speed = 1;
    this.screenObjects = {};
  }
  play(){
    if(this.enabled){
      this.playing = true;
      this.draw();
    }
  }
  draw(){
    if(this.enabled && this.playing && this.screenObjects){
      for(var objId in this.screenObjects){
        if(this.screenObjects[objId].opacity){
          var opacity = this.screenObjects[objId].opacity;
          for(var i=0; i<this.screenObjects[objId].opacity.length; i++){
            
            if(this.screenObjects[objId].opacity[i].s <= this.timeStamp && this.screenObjects[objId].opacity[i].e > this.timeStamp){
              if(!this.screenObjects[objId].opacity[i].temp){
                this.screenObjects[objId].opacity[i].temp = { startOpacity: this.screen.objects[objId].opacity };
              }
              

              this.screen.objects[objId].opacity = this.screenObjects[objId].opacity[i].temp.startOpacity - (Math.round(((this.screenObjects[objId].opacity[i].temp.startOpacity-this.screenObjects[objId].opacity[i].v) / (this.screenObjects[objId].opacity[i].e-this.screenObjects[objId].opacity[i].s)) * this.timeStamp *100)/100);
              //console.log(this.screenObjects[objId].opacity[i].temp);
              //console.log(this.screenObjects[objId].opacity[i].temp.startOpacity - (Math.round(((this.screenObjects[objId].opacity[i].temp.startOpacity-this.screenObjects[objId].opacity[i].v) / (this.screenObjects[objId].opacity[i].e-this.screenObjects[objId].opacity[i].s)) * this.timeStamp *100)/100 ));
              
            }

            if(this.screenObjects[objId].opacity[i].e == this.timeStamp){
              this.screen.objects[objId].opacity = this.screenObjects[objId].opacity[i].v;
              delete this.screenObjects[objId].opacity[i].temp;
            }

            // 1 + (-0.1)
          }

        }
      }
      //console.log(this.screenObjects[objId].opacity);

      this.timeStamp++;
      if(this.timeStamp>this.duration){
        if(this.loop){
          this.timeStamp=0;
          setTimeout(this.draw.bind(this),34);
        }
      }
      else{
        setTimeout(this.draw.bind(this),34);
      }
    }
  }
}

module.exports = BasicAnimation;
