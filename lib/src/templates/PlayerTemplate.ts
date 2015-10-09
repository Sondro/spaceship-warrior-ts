module example.templates {

  import Point = PIXI.Point;
  import Container = PIXI.Container;

  import GroupManager = artemis.managers.GroupManager;
  import EntitySystem = artemis.EntitySystem;
  import EntityTemplate = artemis.annotations.EntityTemplate;
  import IEntityTemplate = artemis.IEntityTemplate;
  import Entity = artemis.Entity;
  import World = artemis.World;

  import Position = example.components.Position;
  import Sprite = example.components.Sprite;
  import Health = example.components.Health;
  import Velocity = example.components.Velocity;
  import Bounds = example.components.Bounds;
  import Player = example.components.Player;
  import Layer = example.components.Layer;
  import Constants = example.core.Constants;
  import Groups = example.core.Groups;

  @EntityTemplate('player')
  export class PlayerTemplate implements IEntityTemplate {

    public buildEntity(entity:Entity, world:World):Entity {

      var x = Constants.FRAME_WIDTH/2;
      var y = Constants.FRAME_HEIGHT-80;

      //'ColorMatrixFilter'
      entity.addComponent(Position, ~~x, ~~y);
      entity.addComponent(Velocity, 0, 0);
      entity.addComponent(Bounds, 43);
      entity.addComponent(Health, 100, 100);
      entity.addComponent(Player);
      entity.addComponent(Sprite, 'fighter', (sprite:Sprite) => {
        var s:PIXI.Sprite = sprite.sprite_;
        //s.tint = 0x5dff81;
        s.position.set(~~x, ~~y);
        sprite.layer = Layer.ACTORS_3;
        sprite.addTo(EntitySystem.blackBoard.getEntry<Container>('sprites'));
      });
      world.getManager<GroupManager>(GroupManager).add(entity, Groups.PLAYER_SHIP);
      return entity;
    }
  }
}