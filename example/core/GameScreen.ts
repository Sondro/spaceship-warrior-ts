module example.core {

  import CollisionSystem = example.systems.CollisionSystem;
  import ColorAnimationSystem = example.systems.ColorAnimationSystem;
  import EntitySpawningTimerSystem = example.systems.EntitySpawningTimerSystem;
  import ExpiringSystem = example.systems.ExpiringSystem;
  import HealthRenderSystem = example.systems.HealthRenderSystem;
  import HudRenderSystem = example.systems.HudRenderSystem;
  import MovementSystem = example.systems.MovementSystem;
  import ParallaxStarRepeatingSystem = example.systems.ParallaxStarRepeatingSystem;
  import PlayerInputSystem = example.systems.PlayerInputSystem;
  import RemoveOffscreenShipsSystem = example.systems.RemoveOffscreenShipsSystem;
  import ScaleAnimationSystem = example.systems.ScaleAnimationSystem;
  import SoundEffectSystem = example.systems.SoundEffectSystem;
  import SpriteRenderSystem = example.systems.SpriteRenderSystem;
  import World = artemis.World;
  import GroupManager = artemis.managers.GroupManager;
  import Constants = example.core.Constants;
  import EntitySystem = artemis.EntitySystem;
  import PlayerTemplate = example.templates.PlayerTemplate;

  export class GameScreen {

    private world:World;

    private spriteRenderSystem:SpriteRenderSystem;
    private healthRenderSystem:HealthRenderSystem;
    private hudRenderSystem:HudRenderSystem;

    public spriteBatch:cc.SpriteBatchNode;

    constructor(game:CCLayer) {

      cc.spriteFrameCache.addSpriteFrames("res/images-packed/pack.plist");
      //this.spriteBatch = new cc.SpriteBatchNode("res/images-packed/pack.png");
      //game.addChild(this.spriteBatch);
      //EntitySystem.blackBoard.setEntry('spriteBatch', this.spriteBatch);

      EntitySystem.blackBoard.setEntry('spriteBatch', game);

      var world:World = this.world = new artemis.World();

      world.setManager(new GroupManager());
      world.setSystem(new MovementSystem());
      world.setSystem(new PlayerInputSystem(game));
      world.setSystem(new SoundEffectSystem());
      world.setSystem(new CollisionSystem(game));
      world.setSystem(new ExpiringSystem());
      world.setSystem(new EntitySpawningTimerSystem(game));
      world.setSystem(new ParallaxStarRepeatingSystem());
      world.setSystem(new ColorAnimationSystem());
      world.setSystem(new ScaleAnimationSystem());
      world.setSystem(new RemoveOffscreenShipsSystem());

      this.spriteRenderSystem = world.setSystem(new SpriteRenderSystem(game), true);
      this.healthRenderSystem = world.setSystem(new HealthRenderSystem(game), true);
      if (!cc.sys.isMobile) {
        this.hudRenderSystem = world.setSystem(new HudRenderSystem(game), true);
      }

      world.initialize();
      world.createEntityFromTemplate('player').addToWorld();

      //for (var i = 0; 500 > i; i++) {
      // world.createEntityFromTemplate('star').addToWorld();
      //}

    }

    public render(delta:number) {
      this.world.setDelta(delta);
      this.world.process();

      this.spriteRenderSystem.process();
      this.healthRenderSystem.process();
      if (!cc.sys.isMobile) {
        this.hudRenderSystem.process();
      }
    }
  }
}

