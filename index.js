
/* Track game data and state */
var game = (function(){
	var anim;// stores the current value of requestAnimationFrame
	
	var exposed_constructor = function(){
		this.state = function(){}// must be a function. The function will be executed at every animation frame (usually 60 fps).
		this._sprites = {};//for storing a named list of sprites
		this.storage = {
			useFriction : true,
			useRotation : true,
			useBoundary : false,
			useBlackHole : true,
			stats : undefined,
			points : {}
		};//for storing a named list of any game data
	}
	
	exposed_constructor.prototype = {
		begin: function(app){
			var renderer = app.renderer, stage = app.stage;
			var self = this;
			cancelAnimationFrame(anim);
			
			function renderFunc(){
				self.state();
				renderer.render(stage);
				anim = requestAnimationFrame(renderFunc);
			}
			renderFunc();
		},// when called, will trigger the periodic execution of game.state. Requires two arguments.
		
		clearState : function(){
			this.state = function(){};
		},// resets game.state to an empty function

		addSprite : function(obj){
			for(var key in obj){
				this._sprites[key] = obj[key];
			}
		},
		removeSprite : function(key){
			delete this._sprites[key];
		},
		getSprite : function(key){
			if(!key){
				return this._sprites;
			}
			return this._sprites[key];
		}
	}
	
	return (new exposed_constructor());
})();


/* Check & fix collision with borders */
function contain(el, box, noFix){
	var noFix = (noFix === true);
	var results = (function(){
		var arr = [], self = this;
		this.length = 0;
		this.toString = function(){
			return arr.toString();
		}
		this.has = function(x){
			return (arr.indexOf(x) > -1);
		}
		this.push = function(x){
			arr.push(x);
			this.length++;
		}
		return this;
	})();
	if(el.x < box.x){
		results.push("left");
		if(!noFix){
			el.x = box.x;
		}
	}
	if(el.y < box.y){
		results.push("top");
		if(!noFix){
			el.y = box.y;
		}
	}
	if(el.x + el.width > box.width){
		results.push("right");
		if(!noFix){
			el.x = (box.width -el.width);
		}
	}
	if(el.y + el.height > box.height){
		results.push("bottom");
		if(!noFix){
			el.y = (box.height - el.height);
		}
	}
	if(!results.length){
		return undefined;
	}
	return results;
}

/*check collision between two sprites */
function hitDetected(el1, el2){
	function le(el){ return el.x; }
	function re(el){
		return (el.x + el.width);
	}
	function te(el){ return el.y; }
	function be(el){
		return (el.y + el.height);
	}
	
	var xAxis_hit = ( ((le(el1) < re(el2)) && (le(el1) > le(el2))) || ((re(el1) > le(el2)) && (re(el1) < re(el2))) );
	var yAxis_hit = ( ((te(el1) < be(el2)) && (te(el1) > te(el2))) || ((be(el1) > te(el2)) && (be(el1) < be(el2))) );
	return (xAxis_hit && yAxis_hit);
}


/* Initialize and begin game */
(function(){

	var app = new PIXI.Application({ 
		width: window.innerWidth,//316,     // default: 800
		height: window.innerHeight - 80,//370,   // default: 600
		antialias: true,// default: false
		transparent: false,// default: false
		resolution: 1 // default: 1
	});
	$("body").prepend(app.view);
	app.view.classList.add("canvasBox");
	app.renderer.backgroundColor = "0x1F263B";
	
	var border1 = { x :0, y : 0, width : app.renderer.width, height : app.renderer.height };
 	var border2 = { x : (0 - (app.renderer.width * 50)), y : (0 - (app.renderer.height * 50)), width : (101 * app.renderer.width), height : (101 * app.renderer.height) };
	var bHole_border = {};
	
	//Use Pixi’s built-in `loader` object to load an image
	var asteroids = ["img/asteroid1.png", "img/asteroid2.png", "img/asteroid3.png"]; 
	PIXI.loader
		.add(["img/ball.png", "img/bHole1.png", "img/bHole2.png", "img/bHole3.png", "img/star.png"])
		.add(asteroids)
	.load(setup);
	//This `setup` function will run when the image has loaded


	function setup(){
		var appWid = app.renderer.width, appHei = app.renderer.height, bHole_x = (appWid / 2), bHole_y = (appHei / 2);

		addStars(app, appWid, appHei);
	
		var bHole = new PIXI.Sprite(PIXI.loader.resources["img/bHole1.png"].texture);
		bHole.width = 30;
		bHole.height = 30;
		bHole.position.set(bHole_x, bHole_y);
		bHole.scale.set(0.6, 0.6);
		bHole.rotation = 0;
		bHole.anchor.x = 0.5;
		bHole.anchor.y = 0.5;
		bHole.mass = 999999000000000000000;
		
		app.stage.addChild(bHole);
		game.addSprite({"bHole": bHole});
		
		bHole_border = { x: (bHole.x-4), y: (bHole.y-4), width: 8, height: 8 };
		
		var stats = new PIXI.Text("0 Asteroids", {font: "16px", fill: "red", wordWrap : true, wordWrapWidth : 140});
		stats.x = 100;
		stats.y = 2;
		app.stage.addChild(stats);
		game.storage.stats = stats;
		
		//Render the stage at intervals
		game.begin(app);
		game.state = function(){
			
			bHole.rotation += 0.5;
			var sprites = Lazy(game.getSprite()).omit(["bHole"]).toObject();
			for(var s in sprites){
				var sprite = sprites[s];
				updateAsteroidPosition(sprite, bHole, s);
				if(game.storage.useRotation){
					sprite.rotation += sprite.revolution;
				}
			}
		}
		
	}
	
	function updateAsteroidPosition(sprite, bHole, name){
		var useB = game.storage.useBoundary;
		var collision = (useB)? contain(sprite, border1) : false ;

		if(!hitDetected(sprite,border1)){
			var point = game.storage.points[name];
			point.text = normalizeNumber(getDistance(sprite, bHole));
			point.x = sprite.x;
			point.y = sprite.y;
			contain(point, border1);
			point.visible = true;
		}else{
			game.storage.points[name].visible = false;
		}
		var bHole_collision = hitDetected(sprite, bHole_border);
		var distance = (getDistance(bHole, sprite));
		var pull = getAcceleration( getGravity(bHole.mass, sprite.mass, distance), sprite.mass);

		pull = (pull > 1)? 1 : pull ;

		sprite.vx = sprite.accelerationX;
		sprite.vy = sprite.accelerationY;
		
		if(collision){
			if(collision.has("left") || collision.has("right")){
				sprite.vx = -sprite.vx;
				sprite.accelerationX = -sprite.accelerationX;
			}
			if(collision.has("top") || collision.has("bottom")){
				sprite.vy = sprite.vy;
				sprite.accelerationY = sprite.accelerationY;
			}
		}
		if(bHole_collision && game.storage.useBlackHole){
			removeSprite(name);
			return;
		}
		
		if(game.storage.useFriction){
			sprite.accelerationX *= 0.98;
			sprite.accelerationY *= 0.98;
		}else{
	//		sprite.accelerationX *= 0.99;
	//		sprite.accelerationY *= 0.99;
		}
		
		var t_dist = (getStraightDistance(bHole.x, sprite.x)+getStraightDistance(bHole.y, sprite.y));
		var adjusted_accX = (pull / (t_dist / getStraightDistance(bHole.x, sprite.x)))
		var adjusted_accY = (pull / (t_dist / getStraightDistance(bHole.y, sprite.y)))

		adjusted_accX+=getCF(sprite.mass, pull, distance);
		adjusted_accY+=getCF(sprite.mass, pull, distance);

		sprite.accelerationX = (sprite.x > bHole.x)? (sprite.accelerationX - adjusted_accX) : (sprite.accelerationX + adjusted_accX);
		sprite.accelerationY = (sprite.y > bHole.y)? (sprite.accelerationY - adjusted_accY) : (sprite.accelerationY + adjusted_accY);


//		console.log("accX : "+sprite.accelerationX+"\naccY : "+sprite.accelerationY);
		sprite.x += sprite.vx;
		sprite.y += sprite.vy;
	}
		
	function addSprite(num){
		if(typeof num == "number"){
			for(var i=1; i<=num; i++){
				addSprite();
			}
			return;
		}
		
		//Create the sprite from the texture
		var img = new PIXI.Sprite(PIXI.loader.resources[randChoice(asteroids)].texture);
		
		//for position 
		var x_rand = 0;//randInt(0, app.renderer.width), oppo = false;
		if(Math.random() < 0.5){
			img.position.set(x_rand, 0)
		}else{
			img.position.set(x_rand, 0)
			oppo = true;
		}
		img.scale.set(0.1, 0.1);
		
		//for control
		img.vx = 0;
		img.vy = 0;
		img.accelerationX = 5;
		img.accelerationY = 0;
		var mass = randChoice([randInt(5, 100), randInt(200, 500), randInt(1000, 2000)]);
		img.mass = mass 
		
		//for rotation
		img.anchor.x = 0.5;//x anchor
		img.anchor.y = 0.5;//y anchor
		img.revolution = (randInt(1, 4)/randInt(10, 20));
		img.rotation = 0; 
		
		img.updated = [];
		
		//Add the sprite to the stage
		app.stage.addChild(img);
		var spriteObj = {}, id = (new Date()).getTime();
		spriteObj[id] = img;
		game.addSprite(spriteObj);
		
/**/	var point = new PIXI.Text("000", {font: "10px", fill: "white", wordWrap : true, wordWrapWidth : 140});
		point.x = 30;
		point.y = 30;
		app.stage.addChild(point);/**/
		
		game.storage.points[id] = point;
		point.visible = false;
		
		var count = game.storage.stats;
		count.text = ((Number(count.text.split(" ")[0])+1)+" Asteroids");
	};
	function removeSprite(name){
		if(typeof name == "string"){
			var sprite = game.getSprite(name);
		}else{
			var sprites = Lazy(game.getSprite()).omit(["bHole"]).toObject();
			var spriteKeys = Object.keys(sprites);
			var name = spriteKeys[randInt(0, spriteKeys.length)];
			var sprite = sprites[name];
		}
		sprite.visible = false;
		game.storage.points[name].visible = false;
		game.removeSprite(name);
		var count = game.storage.stats;
		count.text = ((Number(count.text.split(" ")[0])-1)+" Asteroids");
	}
	function addStars(app, appWid, appHei){
		for(var i = 1; i<=1000; i++){
			var star = new PIXI.Sprite(PIXI.loader.resources["img/star.png"].texture);
			star.width = 30;
			star.height = 30;
			var starScale = (randInt(1, 100) < 8)? 0.25 : randChoice([0.09, 0.15, 0.08, 0.05]);
			star.scale.set(starScale, starScale);
			star.position.set(randInt(0, appWid), randInt(0, appHei));
			app.stage.addChild(star);
		}
	}
	
	
	$("#add").click(function(){
		addSprite(1);
	});
	$("#remove").click(function(){
		removeSprite();
	});
	$("#blackhole").click(function(){
		if($(this).prop("checked") == true){
			game.storage.useBlackHole = true;
		}else{
			game.storage.useBlackHole = false;
		}
	});
	$("#friction").click(function(){
		if($(this).prop("checked") == true){
			game.storage.useFriction = true;
		}else{
			game.storage.useFriction = false;
		}
	});
	$("#rotation").click(function(){
		if($(this).prop("checked") == true){
			game.storage.useRotation = true;
		}else{
			game.storage.useRotation = false;
		}
	});
	$("#boundary").click(function(){
		if($(this).prop("checked") == true){
			game.storage.useBoundary = true;
		}else{
			game.storage.useBoundary = false;
		}
	});
	

function randChoice(arr){
	return arr[Math.floor(Math.random() *arr.length)];
}
function randInt(min, max){
	return Math.floor(Math.random() *(max-min) +min);
}
function getGravity(m1, m2, r){
	var g = (6.674 * Math.pow(10, -11));
	var gmm = ((g * m1) * m2);
	var ans = (gmm / Math.pow(r, 2)); 
	return ans;
}
function getAcceleration(f, m){
	var ans = (f/m);
	return ans;
}
function getCF(m, v, r){
/*	Fc = (mv^2)/r
	
	Fc = centrifugal force, 
	m = mass, 
	v = speed,
	r = radius. */
	var ans = ((m * Math.pow(v, 2)) / r);
	return ans;
}
function getDistance(s1, s2){
	var ans = ( Math.sqrt((s1.x-s2.x) * (s1.x-s2.x)) )+((s1.y-s2.y) * (s1.y-s2.y));
	return (ans < 1)? 1 : ans ;
}
function getStraightDistance(a, b){
	if((a < 0 || b < 0) && !(a < 0 && b < 0)){
		if(a < 0){
			return (b+Math.abs(a));
		}else{
			return (a+Math.abs(b));
		}
	}else if(a < 0 && b < 0){
		var a = Math.abs(a), b = Math.abs(b);
	}
	return (a > b)? a-b : b-a ;
}
function normalizeNumber(num){
	var num_ = String(num), stages = ["k","m","b","t","qd","qt","st"];
	if(num_.indexOf(".") > -1){
		num_ = String(Math.round(num));
	}
	if(num < 1000){ return num_; }
	for(var i=3; i <= 18; i+=3){
		var len = num_.length;
		if(len > (i+3)){
			continue;
		}
		var mod = (len % i);
		var f = num_.substr(0, mod);
		f = (f)? f : 0;
		var rem = num_.substr(mod, 2);
		var stageInt = (f)? ((i/3)-1) : (i/3) ;
		var stage = stages[stageInt];
		return (f+"."+rem+""+stage);
	}
}


})();