/*
*
*	Headless abilities
*
*/
G.abilities[39] =[

// 	First Ability: Larva Infest
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	_targetTeam: "enemy",
	_getHexes: function() {
		return this.creature.getHexMap(inlineback2hex);
	},

	require: function() {
		if (!this.atLeastOneTarget(this._getHexes(), this._targetTeam)) {
			return false;
		}
		return this.testRequirements();
	},

	//	activate() :
	activate : function() {
		var ability = this;
		var creature = this.creature;

		if (this.atLeastOneTarget(this._getHexes(), this._targetTeam)) {
			this.end();
			this.setUsed(false); // Infinite triggering
		}else{
			return false;
		}

		var targets = this.getTargets(this._getHexes());

		targets.each(function() {
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if (ability.isUpgraded()) {
				// Upgraded ability causes fatigue - endurance set to 0
				trg.addFatigue(trg.endurance);
			}

			// Add an effect that triggers on the target's start phase and adds the
			// debuff
			var effect = new Effect(
				ability.title, // Name
				creature, // Caster
				trg, // Target
				"onStartPhase", // Trigger
				{
					effectFn: function() {
						// Activate debuff
						trg.addEffect(new Effect(
							"", // No name to prevent logging
							creature,
							trg,
							"",
							{
								deleteTrigger: "",
								stackable: true,
								alterations: { endurance: -5 }
							}
						));
						// Note: effect activate by default adds the effect on the target,
						// but target already has this effect, so remove the trigger to
						// prevent infinite addition of this effect.
						this.trigger = "";
						this.deleteEffect();
					}
				}
			);

			trg.addEffect(effect, "%CreatureName" + trg.id + "% has been infested");
		});
	},
},



// 	Second Ability: Cartilage Dagger
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		var crea = this.creature;

		if( !this.testRequirements() ) return false;

		//At least one target
		if( !this.atLeastOneTarget(crea.getHexMap(frontnback2hex), "enemy") ) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var crea = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team : 0, // Team, 0 = enemies
			id : crea.id,
			flipped : crea.flipped,
			hexs : crea.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var d = { pierce : 12 };
		// Extra pierce damage if upgraded
		if (this.isUpgraded()) {
			var bonus = this.creature.endurance - target.endurance;
			if (bonus > 0) {
				d.pierce += bonus;
			}
		}

		//Bonus for fatigued foe
		d.pierce = target.endurance <= 0 ? d.pierce * 2 : d.pierce;

		var damage = new Damage(
			ability.creature, //Attacker
			d, //Damage Type
			1, //Area
			[]	//Effects
		);

		var dmg = target.takeDamage(damage);
	},
},



// 	Third Ability: Whip Move
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	_minDistance: 2,
	_getMaxDistance: function() {
		if (this.isUpgraded()) {
			return 8;
		}
		return 6;
	},
	_targetTeam: "both",
	_getValidDirections: function() {
		// Get all directions where there are no targets within min distance,
		// and a target within max distance
		var crea = this.creature;
		var x = crea.player.flipped ? crea.x - crea.size + 1 : crea.x;
		var validDirections = [0, 0, 0, 0, 0, 0];
		for (var i = 0; i < this.directions.length; i++) {
			if (this.directions[i] === 0) {
				continue;
			}
			var directions = [0, 0, 0, 0, 0, 0];
			directions[i] = 1;
			var testMin = this.testDirection({
				team: this._targetTeam,
				x: x,
				directions: directions,
				distance: this._minDistance,
				sourceCreature: crea
			});
			var testMax = this.testDirection({
				team: this._targetTeam,
				x: x,
				directions: directions,
				distance: this._getMaxDistance(),
				sourceCreature: crea
			});
			if (!testMin && testMax) {
				// Target needs to be moveable
				var fx = 0;
				if ((!this.creature.player.flipped && i>2) ||
						(this.creature.player.flipped && i<3)) {
					fx =  -1*(this.creature.size-1);
				}
				var dir = G.grid.getHexLine(
					this.creature.x+fx, this.creature.y, i, this.creature.player.flipped);
				if (this._getMaxDistance() > 0) {
					dir = dir.slice(0,this._getMaxDistance()+1);
				}
				dir = dir.filterCreature(true, true, this.creature.id);
				var target = dir.last().creature;
				if (target.stats.moveable) {
					validDirections[i] = 1;
				}
			}
		}
		return validDirections;
	},

	require : function(){
		if( !this.testRequirements() ) return false;

		// Creature must be moveable
		if (!this.creature.stats.moveable) {
			this.message = G.msg.abilities.notmoveable;
			return false;
		}

		// There must be at least one direction where there is a target within
		// min/max range
		var validDirections = this._getValidDirections();
		if (!validDirections.some(function(e) { return e === 1; })) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : this._targetTeam,
			id : crea.id,
			requireCreature : true,
			sourceCreature : crea,
			x : crea.x,
			y : crea.y,
			directions : this._getValidDirections(),
			distance: this._getMaxDistance()
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		var crea = this.creature;
		var target = path.last().creature;
		path = path.filter( function(){	return !this.creature; }); //remove creatures
		ability.end();

		//Movement
		var creature = (args.direction==4) ? crea.hexagons[crea.size-1] : crea.hexagons[0] ;
		path.filterCreature(false, false);
		var destination = null;
		var destinationTarget = null;
		if (target.size === 1) {
			// Small creature, pull target towards self
			destinationTarget = path.first();
		} else if (target.size === 2) {
			// Medium creature, pull self and target towards each other half way,
			// rounding upwards for self (self move one extra hex if required)
			var midpoint = Math.floor((path.length - 1) / 2);
			destination = path[midpoint];
			if (midpoint < path.length - 1) {
				destinationTarget = path[midpoint + 1];
			}
		} else {
			// Large creature, pull self towards target
			destination = path.last();
		}

		var x;
		var hex;
		if (destination !== null) {
			x = (args.direction === 4) ? destination.x + crea.size - 1 : destination.x;
			hex = G.grid.hexs[destination.y][x];
			crea.moveTo(hex, {
				ignoreMovementPoint: true,
				ignorePath: true,
				callback: function() {
					var interval = setInterval(function() {
						if (!G.freezedInput) {
							clearInterval(interval);
							G.activeCreature.queryMove();
						}
					}, 100);
				},
			});
		}
		if (destinationTarget !== null) {
			x = (args.direction === 1) ? destinationTarget.x + target.size - 1 : destinationTarget.x;
			hex = G.grid.hexs[destinationTarget.y][x];
			target.moveTo(hex, {
				ignoreMovementPoint: true,
				ignorePath: true,
				callback: function() {
					var interval = setInterval(function() {
						if (!G.freezedInput) {
							clearInterval(interval);
							G.activeCreature.queryMove();
						}
					}, 100);
				},
			});
		}
	},
},



// 	Fourth Ability: Boomerang Tool
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		slash : 10,
		crush : 5,
	},

	_getHexes: function() {
		// extra range if upgraded
		var hexes;
		if (this.isUpgraded()) {
			hexes = [
				  [0,0,0,0,0,0],
				   [0,1,1,1,1,1],
					[0,1,1,1,1,1],//origin line
				   [0,1,1,1,1,1]];
		} else {
			hexes = [
				  [0,0,0,0,0],
				   [0,1,1,1,1],
					[0,1,1,1,1],//origin line
				   [0,1,1,1,1]];
		}
		hexes.origin = [0, 2];
		return hexes;
	},


	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		var hexes = this._getHexes();

		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : "both",
			requireCreature : 0,
			id : crea.id,
			flipped : crea.player.flipped,
			choices: [
				crea.getHexMap(hexes),
				crea.getHexMap(hexes, true),
			],
		});
	},

	activate: function(hexs) {
		var damages = { slash : 10 };

		var ability = this;
		ability.end();

		ability.areaDamage(
			ability.creature, //Attacker
			damages, //Damage Type
			[],	//Effects
			ability.getTargets(hexs), //Targets
			true //Notriggers avoid double retailiation
		);

		ability.areaDamage(
			ability.creature, //Attacker
			damages, //Damage Type
			[],	//Effects
			ability.getTargets(hexs) //Targets
		);
	},
}
];
