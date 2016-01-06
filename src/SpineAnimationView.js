/**
 * @file 
 * The View of Spine Animation.
 */
import .spine as spine;
import ui.View as View;
import ui.ImageView as ImageView;

exports = Class(View, function (supr) {
	
	/**
	 * Class constructor
	 *
	 * @see resetAllAnimations
	 */
	this.init = function (opts) {
		supr(this, 'init', arguments);
		
		this.resetAllAnimations();
	}
	
	/**
	 * Start an animation. After the specified number of iterations, returns to its defaultAnimation.
	 *
	 * @param {string} name
	 *	  Name of the animation to start playing.
	 * @param {object} opts
	 *    Options to start animation
	 *    - iterations {number}			Number of times to repeat the animation.
	 *    - callback {function} 		Called at end of the animation.
	 *	  - eventCallback {function}	Called at events of the animation.
	 *	  - loop {boolean}				Continuously loop an animation.	 
	 */
	this.startAnimation = function (name, opts) {
		var loop = opts ? (opts.loop || false) : false;		
		this.state.setAnimationByName(0, name, loop);
		this.style.visible = true;
		this._isPlaying = true;
		this._isOnDefault = false;		
		
		if (opts) {
			this._currentAnimationOpts = {
				iterations: opts.iterations || 1,
				callback: opts.callback,
				eventCallback: opts.eventCallback,
				loop: loop,
				animationName: name
			};
		} else {
			this._currentAnimationOpts = {
				iterations: 1,
				callback: null,
				eventCallback: null,
				loop: false,
				animationName: name
			};
		}
	}

	/**
	 * Stops the current animation and sets its visibility to false.
	 */
	this.stopAnimation = function () {
		this._isOnDefault = true;
		this.style.visible = false;
		this._isPlaying = false;
		this._currentAnimationOpts = null;
	}
	
	/**
	 * If the current animation loops, start the default animation, otherwise, stop the animation.
	 */
	this.resetAnimation = function () {
		if (this._opts.defaultAnimation) {
			this.state.setAnimationByName(0, this._opts.defaultAnimation, this._opts.loop || true);			
			this.style.visible = true;			
			this._isPlaying = true;
			
			this._isOnDefault = true;
			this._currentAnimationOpts = null;
		} else {
			this.stopAnimation();
		}
	}
	
	/**
	 * Set the framerate of the animation.
	 *
	 * @param {number} fps
	 *    Frame per second.
	 */
	this.setFramerate = function (fps) {
		this.frameRate = fps || 30;
	}
	
	/**
	 * Pause the animation.
	 */
	this.pause = function () {
		this._isPlaying = false;
	}
	
	/**
	 * Resume a paused animation.
	 */
	this.resume = function () {
		this._isPlaying = true;
	}
	
	/**
	 * Completely reset all the sprite’s animations. If provided, update the options.
	 *
	 * @param {object} newOpts
	 *	  New options of the animation, to override the old parameters.
 	 *    - spineData {object}			The pure json data of the spine animation.
	 *    - jsonText {string}			The json text of the spine animation.
	 *    - jsonFile {string}			Path to the json text file in the resources folder.
	 *    - imagePath {string}			Path to the images of this spine animation.
	 *    - animationScale {number}		Scale of the animation. Do not scale the view.
	 *    - defaultAnimation {string}	The default animation.
	 *	  - frameRate {number}			Rate at which the animation will play each frame.
	 *    - loop {boolean}				Animation will continue to play forever.
	 *    - autoStart {boolean}			Animation will start as soon as initialised.
	 */
	this.resetAllAnimations = function(newOpts) {
		var jsonData;
		var opts = merge(newOpts || {}, this._opts);
		
		if (opts.spineData) {
			jsonData = opts.spineData;
		} else if (opts.jsonText) {
			jsonData = JSON.parse(opts.jsonText);
		} else {
			jsonData = JSON.parse(CACHE[opts.jsonFile]);
		}
		
		if (jsonData) {
			var imagePath = (opts.imagePath || '') + '/';		
			var self = this;
			this.rendererObjects = [];
			var json = new spine.SkeletonJson({
				newRegionAttachment: function (skin, name, path) {
					var image = new ImageView({
						superview: self,
						autoSize: true,					
						visible: false,		
						image: imagePath + path + ".png",
					});

					var attachment = new spine.RegionAttachment(name);
					attachment.rendererObject = image;			
					self.rendererObjects.push(image);
					return attachment;
				},
				newBoundingBoxAttachment: function (skin, name) {
					return new spine.BoundingBoxAttachment(name);
				}
			});
			json.scale = opts.animationScale;
			this.skeletonData = json.readSkeletonData(jsonData);
			spine.Bone.yDown = true;
	
			this.skeleton = new spine.Skeleton(this.skeletonData);

			this.state = this.createState();
	
			this.state.data.defaultMix = opts.defaultMix || 0.4;
			
			if (opts.defaultAnimation) {
				this.state.setAnimationByName(0, opts.defaultAnimation, opts.loop || true);					
			}
			
			this._currentAnimationOpts = null;
			this._isOnDefault = true;
			this._isPlaying = opts.autoStart || false;
			this.frameRate = opts.frameRate || 30;
			
			this.state.onComplete = function (track, loopCount) {
				if (self._isOnDefault) {
					if (!self._opts.loop) {
						self.resetAnimation();
					}				
				} else if (self._currentAnimationOpts)  {
					var opts = self._currentAnimationOpts;
					if (!opts.loop) {
						--opts.iterations;
						if (opts.iterations <= 0) {
							opts.callback && opts.callback();
							self.resetAnimation();
						} else {
							self.state.setAnimationByName(0, opts.animationName, false);
						}
					}						 					
				}
			};
			
			this.state.onEvent = function (track, data) {
				if (!self._isOnDefault && self._currentAnimationOpts) {
					var opts = self._currentAnimationOpts;
					opts.eventCallback && opts.eventCallback(data);
				}
			};
		}
	}
	
	/**
	 * Get the duration (in seconds) of an animation.
	 *
	 * @param {string} animationName
	 *    Name of the required animation.
	 */
	this.getDuration = function (animationName) {
		var animation = this.skeletonData.findAnimation(animationName);
		if (!animation) throw "Animation not found: " + animationName;		
		return animation.duration * 1000 * (30 / this.frameRate);
	}
	
	/**
	 * Create a spine animation state for advanced usage.	 
	 */
	this.createState = function () {
		var stateData = new spine.AnimationStateData(this.skeletonData);
		return new spine.AnimationState(stateData);
	}

	/**
	 * This callback function is executed on every tick of the game engine.
	 */
	this.tick = function (dt) {
		if (this._isPlaying && this.style.visible) {
			this.state.update(dt * (0.001 * 30 / this.frameRate));				
			this.state.apply(this.skeleton);		
		}
		
		this._present();	
	}
	
	/**
	 * Arrange all render objects into skeletal transformation.
	 */
	this._present = function () {
		var skeleton = this.skeleton, drawOrder = skeleton.drawOrder;	
		skeleton.updateWorldTransform();		
				
		// Hide all elements first
		var slots = this.rendererObjects;
		for (var i = 0, n = this.rendererObjects.length; i < n; ++i) {			
			var img = this.rendererObjects[i];
			img.style.visible = false;
		}
		
		// Show active elements in order
		for (var i = 0, n = drawOrder.length; i < n; i++) {
			var slot = drawOrder[i];
			var attachment = slot.attachment;
			if (!(attachment instanceof spine.RegionAttachment)) continue;
			
			// Show the visible slot
			var bone = slot.bone;
			var x = bone.worldX + attachment.x * bone.m00 + attachment.y * bone.m01;
			var y = bone.worldY + attachment.x * bone.m10 + attachment.y * bone.m11;
			var rotation = -(bone.worldRotation + attachment.rotation) * (Math.PI / 180);
			var w = attachment.width * bone.worldScaleX, h = attachment.height * bone.worldScaleY;
			var hw = w / 2, hh = h / 2;
			
			var img = attachment.rendererObject;
			
			img.style.anchorX = hw;
			img.style.anchorY = hh;
			img.style.width = w;
			img.style.height = h;
			
			img.style.x = x - hw;
			img.style.y = y - hh;
			img.style.r = rotation;
			
			img.style.zIndex = i;			
			img.style.visible = true;
		}	
	}
});

