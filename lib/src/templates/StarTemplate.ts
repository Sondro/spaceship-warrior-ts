module example.templates {

  import Point = PIXI.Point;
  import Container = PIXI.Container;

  import MathUtils = artemis.utils.MathUtils;
  import Position = example.components.Position;
  import Sprite = example.components.Sprite;
  import Velocity = example.components.Velocity;
  import Bounds = example.components.Bounds;
  import ParallaxStar = example.components.ParallaxStar;
  import ColorAnimation = example.components.ColorAnimation;
  import Layer = example.components.Layer;
  import GroupManager = artemis.managers.GroupManager;
  import EntitySystem = artemis.EntitySystem;
  import Constants = example.core.Constants;
  import EntityTemplate = artemis.annotations.EntityTemplate;
  import IEntityTemplate = artemis.IEntityTemplate;

  @EntityTemplate('star')
  export class StarTemplate implements IEntityTemplate {

    public buildEntity(entity:artemis.Entity, world:artemis.World):artemis.Entity {

      var x = MathUtils.nextInt(Constants.FRAME_WIDTH);
      var y = MathUtils.nextInt(Constants.FRAME_HEIGHT);

      entity.addComponent(Position, x, y);
      entity.addComponent(Velocity, 0, MathUtils.random(-10, -60));
      entity.addComponent(ParallaxStar);
      entity.addComponent(Sprite, 'particle', (sprite:Sprite) => {
        var s:PIXI.Sprite = sprite.sprite_;
        s.tint = 0xffd800ff;
        var scale = s.scale;
        scale.x = scale.y = MathUtils.random(0.5, 1);
        var pos = s.position;
        pos.x = x;
        pos.y = y;
        s.alpha = MathUtils.nextDouble()*127;
        sprite.layer = Layer.BACKGROUND;
        sprite.addTo(EntitySystem.blackBoard.getEntry<Container>('sprites'));
      });
      entity.addComponent(ColorAnimation, (colorAnimation:ColorAnimation) => {
        colorAnimation.alphaAnimate = true;
        colorAnimation.repeat = true;
        colorAnimation.alphaSpeed = MathUtils.random(0.2, 0.7);
        colorAnimation.alphaMin = 0;
        colorAnimation.alphaMax = 255;
      });
      return entity;
    }
  }
}